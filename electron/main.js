const { app, BrowserWindow, ipcMain } = require('electron')
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

  // CHANGE THIS: The URL of your deployed Next.js app
  // When you build the app for others, it will use this URL.
  // When running locally (npm run electron), it uses localhost.
  const PROD_URL = 'https://marq-your-time.vercel.app'
  const devUrl = 'http://localhost:3000'
  const appUrl = app.isPackaged ? PROD_URL : devUrl

  mainWindow.loadURL(appUrl)
  
  // Handle loading errors
  mainWindow.webContents.on('did-fail-load', () => {
    console.log('Failed to load URL:', appUrl)
    // You could load a local error page here if you wanted
  })
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
