const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura las APIs de escritorio al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Verificación física de marcadores ZKTeco
  pingZkDevice: (ip, port = 4370, timeoutMs = 3000) => {
    return ipcRenderer.invoke('zk:ping-device', { ip, port, timeoutMs });
  },

  // Obtener información del hardware y SO
  getSystemInfo: () => {
    return ipcRenderer.invoke('system:get-info');
  },

  // Controles de ventana
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
