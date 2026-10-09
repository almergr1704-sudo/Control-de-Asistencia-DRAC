const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura las APIs de escritorio al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Diagnóstico real en 10 etapas de marcadores ZKTeco
  diagnoseZkDevice: (ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serialNumber = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:diagnose-device', { ip, port, timeoutMs, model, serialNumber, commKey });
  },

  // Lectura física de marcaciones desde el reloj
  readZkDevicePunches: (ip, port = 4370, timeoutMs = 5000, commKey = 0) => {
    return ipcRenderer.invoke('zk:read-punches', { ip, port, timeoutMs, commKey });
  },

  // Verificación física TCP de marcadores ZKTeco (Ping rápido)
  pingZkDevice: (ip, port = 4370, timeoutMs = 2000) => {
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
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
});
