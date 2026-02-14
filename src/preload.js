const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  convert: (data) => ipcRenderer.invoke('convert-to-pdf', data),
  onStatusUpdate: (callback) => ipcRenderer.on('conversion-status', (_event, value) => callback(value)),
  openPath: (path) => ipcRenderer.invoke('open-path', path)
});
