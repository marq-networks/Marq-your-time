const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require('electron')
const path = require('path')
const { uIOhook, UiohookKey } = require('uiohook-napi')
const fs = require('fs')
const fsp = fs.promises
const crypto = require('crypto')
const screenshotDesktop = require('screenshot-desktop')

const BASE_URL = app.isPackaged
  ? 'http://localhost:3000'
  : 'http://localhost:3000'

const SCREENSHOT_INTERVAL_MS = 5 * 60 * 1000
const CONNECTIVITY_INTERVAL_ACTIVE_MS = 10 * 1000
const CONNECTIVITY_INTERVAL_IDLE_MS = 30 * 1000

let screenshotDir
let screenshotQueuePath
let screenshotTimer = null
let connectivityTimer = null
let syncTimer = null
let isOnline = false
let processingQueue = false

let trackingContext = {
  trackingSessionId: null,
  memberId: null,
  orgId: null,
  allowScreenshots: false,
  consentRequired: false,
  trackingAllowed: false
}

let mainWindow
let stats = {
  keyboard: 0,
  mouse: 0,
  clicks: 0
}

let trackingActive = false

function ensurePaths() {
  const userDataPath = app.getPath('userData')
  const baseDir = path.join(userDataPath, 'marq')
  screenshotDir = path.join(baseDir, 'screenshots')
  screenshotQueuePath = path.join(baseDir, 'screenshot-queue.json')
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true })
  if (!fs.existsSync(screenshotQueuePath)) {
    fs.writeFileSync(screenshotQueuePath, '[]', 'utf8')
  }
}

function loadQueue() {
  try {
    const data = fs.readFileSync(screenshotQueuePath, 'utf8')
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  fs.writeFileSync(screenshotQueuePath, JSON.stringify(queue, null, 2), 'utf8')
}

function startupRecovery() {
  const queue = loadQueue()
  let changed = false
  const now = Date.now()
  for (const item of queue) {
    if (item.status === 'uploading') {
      item.status = 'pending'
      item.next_retry_at = 0
      changed = true
    }
    if (item.file_path && !fs.existsSync(item.file_path)) {
      item.status = 'failed_missing_file'
      item.next_retry_at = now
      changed = true
    }
  }
  if (changed) saveQueue(queue)
}

function getBackoffMs(attempts) {
  if (attempts <= 1) return 30 * 1000
  if (attempts === 2) return 60 * 1000
  if (attempts === 3) return 2 * 60 * 1000
  return 5 * 60 * 1000
}

async function getCookieHeader() {
  try {
    const cookies = await session.defaultSession.cookies.get({ url: BASE_URL })
    if (!cookies.length) return ''
    return cookies.map(c => `${c.name}=${c.value}`).join('; ')
  } catch {
    return ''
  }
}

function fetchWithTimeout(url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const id = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
    fetch(url, { ...(options || {}), signal: controller.signal })
      .then(res => {
        clearTimeout(id)
        resolve(res)
      })
      .catch(err => {
        clearTimeout(id)
        reject(err)
      })
  })
}

async function refreshTrackingContext() {
  const cookieHeader = await getCookieHeader()
  const headers = cookieHeader ? { Cookie: cookieHeader } : {}
  const res = await fetchWithTimeout(`${BASE_URL}/api/tracking/current`, { headers }, 3000)
  if (!res.ok) {
    isOnline = false
    return
  }
  const data = await res.json()
  trackingContext = {
    trackingSessionId: data.trackingSessionId || null,
    memberId: data.memberId || null,
    orgId: data.orgId || null,
    allowScreenshots: !!(data.settings && data.settings.allowScreenshots),
    consentRequired: !!data.consentRequired,
    trackingAllowed: !!data.trackingAllowed
  }
  isOnline = true
}

async function checkConnectivity() {
  try {
    await refreshTrackingContext()
  } catch {
    isOnline = false
  }
  if (!trackingActive || !trackingContext.allowScreenshots || !trackingContext.trackingAllowed || trackingContext.consentRequired) {
    stopScreenshotLoop()
  } else if (!screenshotTimer) {
    startScreenshotLoop()
  }
}

function startConnectivityChecker() {
  if (connectivityTimer) clearInterval(connectivityTimer)
  const intervalMs = trackingActive ? CONNECTIVITY_INTERVAL_ACTIVE_MS : CONNECTIVITY_INTERVAL_IDLE_MS
  connectivityTimer = setInterval(() => {
    checkConnectivity()
  }, intervalMs)
}

function stopConnectivityChecker() {
  if (connectivityTimer) {
    clearInterval(connectivityTimer)
    connectivityTimer = null
  }
}

async function captureAndQueueScreenshot() {
  const eventId = crypto.randomUUID()
  const ts = Date.now()
  const sessionId = trackingContext.trackingSessionId
  const memberId = trackingContext.memberId
  const orgId = trackingContext.orgId
  const sessionPart = sessionId || 'nosession'
  const fileName = `${eventId}__${sessionPart}__${ts}.jpg`
  const filePath = path.join(screenshotDir, fileName)

  try {
    const image = await screenshotDesktop({ format: 'jpg' })
    console.log('SCREENSHOT_CAPTURE_OK')
    await fsp.writeFile(filePath, image)
    console.log('SCREENSHOT_SAVE_OK')
    const sha256 = crypto.createHash('sha256').update(image).digest('hex')
    const queue = loadQueue()
    queue.push({
      id: eventId,
      session_id: sessionId,
      user_id: memberId,
      org_id: orgId,
      captured_at: ts,
      file_path: filePath,
      sha256,
      status: 'pending',
      attempts: 0,
      next_retry_at: 0
    })
    saveQueue(queue)
    console.log('SCREENSHOT_QUEUE_OK')
    return { eventId, filePath, ts }
  } catch (err) {
    console.error('SCREENSHOT_FAIL', err)
    throw err
  }
}

function startScreenshotLoop() {
  if (screenshotTimer) return
  if (!trackingActive) return
  if (!trackingContext.allowScreenshots) return
  if (!trackingContext.trackingAllowed || trackingContext.consentRequired) return

  const loop = async () => {
    if (!trackingActive || !trackingContext.allowScreenshots || !trackingContext.trackingAllowed || trackingContext.consentRequired) {
      stopScreenshotLoop()
      return
    }
    try {
      await captureAndQueueScreenshot()
    } catch {}
    screenshotTimer = setTimeout(loop, SCREENSHOT_INTERVAL_MS)
  }
  screenshotTimer = setTimeout(loop, SCREENSHOT_INTERVAL_MS)
}

function stopScreenshotLoop() {
  if (screenshotTimer) {
    clearTimeout(screenshotTimer)
    screenshotTimer = null
  }
}

async function uploadScreenshotItem(item) {
  const cookieHeader = await getCookieHeader()
  const headers = {
    'Content-Type': 'application/json'
  }
  if (cookieHeader) headers.Cookie = cookieHeader
  const buf = await fsp.readFile(item.file_path)
  const b64 = buf.toString('base64')
  const body = {
    tracking_session_id: item.session_id,
    timestamp: item.captured_at,
    image: `data:image/jpeg;base64,${b64}`,
    event_id: item.id,
    session_id: item.session_id,
    user_id: item.user_id,
    org_id: item.org_id,
    sha256: item.sha256
  }
  const res = await fetchWithTimeout(`${BASE_URL}/api/activity/screenshot`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  }, 15000)
  if (!res.ok) {
    try {
      const json = await res.json()
      const msg = json && (json.error || json.message || '')
      if (typeof msg === 'string' && msg.toLowerCase().includes('already')) {
        return true
      }
    } catch {}
    return false
  }
  return true
}

async function processScreenshotQueue() {
  if (processingQueue) return
  processingQueue = true
  try {
    if (!isOnline) return
    const queue = loadQueue()
    const now = Date.now()
    const candidates = queue.filter(q => (q.status === 'pending' || q.status === 'failed') && (!q.next_retry_at || q.next_retry_at <= now))
    if (!candidates.length) return
    const nextId = candidates[0].id
    const idx = queue.findIndex(q => q.id === nextId)
    if (idx === -1) return
    const item = queue[idx]
    if (!item.file_path || !fs.existsSync(item.file_path)) {
      item.status = 'failed_missing_file'
      item.next_retry_at = now
      saveQueue(queue)
      return
    }
    item.status = 'uploading'
    saveQueue(queue)
    const ok = await uploadScreenshotItem(item)
    if (ok) {
      item.status = 'acked'
      try {
        await fsp.unlink(item.file_path)
      } catch {}
      queue.splice(idx, 1)
      saveQueue(queue)
    } else {
      item.attempts = (item.attempts || 0) + 1
      item.status = 'failed'
      item.next_retry_at = now + getBackoffMs(item.attempts)
      saveQueue(queue)
    }
  } finally {
    processingQueue = false
  }
}

function startSyncWorker() {
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    if (isOnline) {
      processScreenshotQueue()
    }
  }, 15000)
}

function stopSyncWorker() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
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
  startupRecovery()
  createWindow()
  startConnectivityChecker()
  startSyncWorker()

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
  startConnectivityChecker()
  if (!screenshotTimer) startScreenshotLoop()
})

ipcMain.on('stop-tracking', () => {
  trackingActive = false
  stopScreenshotLoop()
  startConnectivityChecker()
})

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] })
  return sources.map(source => ({
    id: source.id,
    name: source.name
  }))
})

ipcMain.handle('capture-screen', async () => {
  try {
    const image = await screenshotDesktop({ format: 'jpg' })
    const b64 = image.toString('base64')
    return { dataUrl: `data:image/jpeg;base64,${b64}` }
  } catch (e) {
    console.error('Screen capture error:', e)
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
  stopScreenshotLoop()
  stopConnectivityChecker()
  stopSyncWorker()
  if (process.platform !== 'darwin') app.quit()
})
