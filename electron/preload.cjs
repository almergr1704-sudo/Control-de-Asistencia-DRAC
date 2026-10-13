const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura las APIs de escritorio al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Firewall de Windows y Configuración de Red
  checkFirewallStatus: () => ipcRenderer.invoke('firewall:check-status'),
  repairNetworkConfig: () => ipcRenderer.invoke('firewall:repair-network'),

  // Diagnóstico completo y 6 comprobaciones independientes ZKTeco
  diagnoseZkDevice: (ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serialNumber = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:diagnose-device', { ip, port, timeoutMs, model, serialNumber, commKey });
  },
  runIndependentDiagnostics: (ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serialNumber = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:independent-diagnostics', { ip, port, timeoutMs, model, serialNumber, commKey });
  },
  readZkDevicePunches: (ip, port = 4370, timeoutMs = 5000, commKey = 0) => {
    return ipcRenderer.invoke('zk:read-punches', { ip, port, timeoutMs, commKey });
  },
  pingZkDevice: (ip, port = 4370, timeoutMs = 3000) => {
    return ipcRenderer.invoke('zk:ping-device', { ip, port, timeoutMs });
  },
  probeTcpPort: (ip, port = 4370, timeoutMs = 2500) => {
    return ipcRenderer.invoke('zk:probe-tcp', { ip, port, timeoutMs });
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
