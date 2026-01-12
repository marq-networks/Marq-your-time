const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')
const { uIOhook, UiohookKey } = require('uiohook-napi')

let mainWindow
let stats = {
  keyboard: 0,
  mouse: 0,
  clicks: 0
}

let trackingActive = false

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
  mainWindow.loadURL('http://localhost:3000')
}

app.whenReady().then(() => {
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
})

ipcMain.on('stop-tracking', () => {
  trackingActive = false
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
    // Request a reasonable resolution (1080p) to ensure performance and reliability
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    })
    
    // Find the primary display or fallback to the first one
    const primarySource = sources[0]
    
    if (primarySource && primarySource.thumbnail) {
      return primarySource.thumbnail.toDataURL()
    }
    return null
  } catch (e) {
    console.error('Screen capture error:', e)
    return null
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
