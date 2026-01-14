const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { uIOhook } = require('uiohook-napi')

let mainWindow
let stats = {
  keyboard: 0,
  mouse: 0,
  clicks: 0
}

let trackingActive = false
let screenshotQueue = []
let screenshotDirPath = null
let queueFilePath = null
let connectivityTimer = null
let connectivityIntervalMs = 30000
let onlineState = true
let syncTimer = null

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function ensurePaths() {
  const baseDir = path.join(app.getPath('userData'), 'marq')
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }
  const sDir = path.join(baseDir, 'screenshots')
  if (!fs.existsSync(sDir)) {
    fs.mkdirSync(sDir, { recursive: true })
  }
  screenshotDirPath = sDir
  queueFilePath = path.join(baseDir, 'screenshot_queue.json')
  if (!fs.existsSync(queueFilePath)) {
    fs.writeFileSync(queueFilePath, JSON.stringify([]))
  }
}

function loadQueue() {
  try {
    if (!queueFilePath || !fs.existsSync(queueFilePath)) return
    const raw = fs.readFileSync(queueFilePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      screenshotQueue = parsed
    }
  } catch (e) {
    console.error('SCREENSHOT_FAIL loadQueue', e)
    screenshotQueue = []
  }
}

function saveQueue() {
  try {
    if (!queueFilePath) return
    fs.writeFileSync(queueFilePath, JSON.stringify(screenshotQueue))
  } catch (e) {
    console.error('SCREENSHOT_FAIL saveQueue', e)
  }
}

function recoverQueueOnStartup() {
  let changed = false
  const now = Date.now()
  screenshotQueue.forEach(item => {
    if (item.status === 'uploading') {
      item.status = 'pending'
      item.next_retry_at = now
      changed = true
    }
    if (!item.file_path) return
    if (!fs.existsSync(item.file_path)) {
      item.status = 'failed_missing_file'
      changed = true
    }
  })
  if (changed) saveQueue()
}

function computeBackoff(attempts) {
  if (attempts <= 1) return 30000
  if (attempts === 2) return 60000
  if (attempts === 3) return 120000
  return 300000
}

function getBaseUrl() {
  if (mainWindow && mainWindow.webContents && mainWindow.webContents.getURL) {
    try {
      const current = mainWindow.webContents.getURL()
      if (current && current.startsWith('http')) {
        const u = new URL(current)
        return u.origin
      }
    } catch (e) {
    }
  }
  return 'http://localhost:3000'
}

async function isOnline() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const url = getBaseUrl() + '/api/agent/offline/status?limit=1'
    await fetch(url, { method: 'GET', headers: { Authorization: 'Bearer desktop-agent' }, signal: controller.signal })
    clearTimeout(timeout)
    return true
  } catch (e) {
    clearTimeout(timeout)
    return false
  }
}

async function refreshConnectivity() {
  const online = await isOnline()
  onlineState = online
}

function scheduleConnectivityChecks() {
  if (connectivityTimer) {
    clearInterval(connectivityTimer)
    connectivityTimer = null
  }
  connectivityIntervalMs = trackingActive ? 10000 : 30000
  connectivityTimer = setInterval(() => {
    refreshConnectivity()
  }, connectivityIntervalMs)
}

function enqueueScreenshot(item) {
  screenshotQueue.push(item)
  saveQueue()
}

async function uploadScreenshotItem(item) {
  if (!item || !item.file_path) return false
  if (!fs.existsSync(item.file_path)) {
    item.status = 'failed_missing_file'
    saveQueue()
    return false
  }
  const now = Date.now()
  item.status = 'uploading'
  item.next_retry_at = now
  saveQueue()
  try {
    const buf = fs.readFileSync(item.file_path)
    const base64 = buf.toString('base64')
    const dataUrl = 'data:image/jpeg;base64,' + base64
    const payload = {
      event_id: item.id,
      tracking_session_id: item.session_id || item.sessionId,
      user_id: item.user_id || item.userId,
      org_id: item.org_id || item.orgId,
      timestamp: item.captured_at || item.capturedAt,
      sha256: item.sha256,
      image: dataUrl
    }
    const url = getBaseUrl() + '/api/activity/screenshot'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    let already = false
    let ok = res.ok
    try {
      const json = await res.json()
      if (json && json.status === 'already_received') {
        already = true
      }
    } catch (e) {
    }
    if (ok || already) {
      item.status = 'acked'
      saveQueue()
      try {
        fs.unlinkSync(item.file_path)
      } catch (e) {
      }
      screenshotQueue = screenshotQueue.filter(q => q.id !== item.id)
      saveQueue()
      return true
    }
    const nextAttempts = (item.attempts || 0) + 1
    item.attempts = nextAttempts
    item.status = 'failed'
    item.next_retry_at = now + computeBackoff(nextAttempts)
    saveQueue()
    return false
  } catch (e) {
    const nowFail = Date.now()
    const nextAttempts = (item.attempts || 0) + 1
    item.attempts = nextAttempts
    item.status = 'failed'
    item.next_retry_at = nowFail + computeBackoff(nextAttempts)
    saveQueue()
    console.error('SCREENSHOT_FAIL upload', e)
    return false
  }
}

async function processScreenshotQueue() {
  if (!onlineState) return
  const now = Date.now()
  const candidates = screenshotQueue.filter(item => {
    if (!item) return false
    if (item.status !== 'pending' && item.status !== 'failed') return false
    if (item.next_retry_at && item.next_retry_at > now) return false
    return true
  }).sort((a, b) => {
    const at = a.captured_at || a.capturedAt || 0
    const bt = b.captured_at || b.capturedAt || 0
    return at - bt
  })
  for (let i = 0; i < candidates.length; i++) {
    await uploadScreenshotItem(candidates[i])
  }
}

function startSyncWorker() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  syncTimer = setInterval(() => {
    processScreenshotQueue()
  }, 15000)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // In production, this might load a file, but for now we keep localhost
  const url = app.isPackaged 
    ? 'http://localhost:3000' // In a real production build, this would point to the deployed URL or a local server
    : 'http://localhost:3000'
  
  mainWindow.loadURL(url)
}

app.whenReady().then(() => {
  ensurePaths()
  loadQueue()
  recoverQueueOnStartup()
  refreshConnectivity()
  scheduleConnectivityChecks()
  startSyncWorker()
  createWindow()

  uIOhook.on('keydown', () => {
    if (trackingActive) stats.keyboard++
  })

  uIOhook.on('mousemove', () => {
     if (trackingActive) stats.mouse++
  })

  uIOhook.on('mousedown', () => {
    if (trackingActive) stats.clicks++
  })

  uIOhook.start()
})

ipcMain.on('start-tracking', () => {
  trackingActive = true
  scheduleConnectivityChecks()
})

ipcMain.on('stop-tracking', () => {
  trackingActive = false
  scheduleConnectivityChecks()
})

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] })
  return sources.map(source => ({
    id: source.id,
    name: source.name
  }))
})

ipcMain.handle('capture-screen', async (_event, meta) => {
  try {
    const trackingSessionId = meta && (meta.trackingSessionId || meta.tracking_session_id) ? (meta.trackingSessionId || meta.tracking_session_id) : null
    const eventId = uuid()
    const capturedAt = Date.now()
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    })
    
    // Find the primary display or fallback to the first one
    const primarySource = sources[0]
    
    if (primarySource && primarySource.thumbnail) {
      const nativeImage = primarySource.thumbnail
      const jpegBuf = nativeImage.toJPEG(80)
      if (!screenshotDirPath) {
        ensurePaths()
      }
      const sessionPart = trackingSessionId || 'no_session'
      const filename = eventId + '__' + sessionPart + '__' + String(capturedAt) + '.jpg'
      const filePath = path.join(screenshotDirPath, filename)
      try {
        fs.writeFileSync(filePath, jpegBuf)
        console.log('SCREENSHOT_SAVE_OK', filePath)
        const sha = crypto.createHash('sha256').update(jpegBuf).digest('hex')
        const queueItem = {
          id: eventId,
          session_id: trackingSessionId,
          user_id: null,
          org_id: null,
          captured_at: capturedAt,
          file_path: filePath,
          sha256: sha,
          status: onlineState ? 'acked' : 'pending',
          attempts: 0,
          next_retry_at: capturedAt
        }
        if (!onlineState) {
          enqueueScreenshot(queueItem)
          console.log('SCREENSHOT_QUEUE_OK', eventId)
        }
        console.log('SCREENSHOT_CAPTURE_OK', eventId)
      } catch (err) {
        console.error('SCREENSHOT_FAIL save', err)
      }
      return { dataUrl: primarySource.thumbnail.toDataURL() }
    }
    return { error: 'No screen sources found' }
  } catch (e) {
    console.error('SCREENSHOT_FAIL', e)
    return { error: e.message }
  }
})

// Send stats every second
setInterval(() => {
  if (trackingActive && mainWindow) {
    // Send deltas and reset
    const delta = { ...stats }
    stats = { keyboard: 0, mouse: 0, clicks: 0 }
    
    if (delta.keyboard > 0 || delta.mouse > 0 || delta.clicks > 0) {
      mainWindow.webContents.send('activity-update', delta)
    }
  }
}, 1000)

app.on('window-all-closed', () => {
  uIOhook.stop()
  if (process.platform !== 'darwin') app.quit()
})
