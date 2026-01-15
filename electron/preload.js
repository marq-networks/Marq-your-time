const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onActivityUpdate: (callback) => ipcRenderer.on('activity-update', (_event, value) => callback(value)),
  startTracking: () => ipcRenderer.send('start-tracking'),
  stopTracking: () => ipcRenderer.send('stop-tracking'),
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  setTrackingContext: (payload) => ipcRenderer.send('set-tracking-context', payload)
})
