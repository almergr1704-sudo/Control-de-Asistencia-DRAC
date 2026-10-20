const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura las APIs de escritorio al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Firewall de Windows y Reparación de Red Institucional
  checkFirewallStatus: () => {
    return ipcRenderer.invoke('firewall:check-status');
  },
  repairNetworkConfig: () => {
    return ipcRenderer.invoke('firewall:repair-network');
  },

  // Comunicación y Diagnóstico ZKTeco Standalone (TCP 4370)
  diagnoseZkDevice: (ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:diagnose-device', { ip, port, timeoutMs, model, serial, commKey });
  },
  readZkDevicePunches: (ip, port = 4370, timeoutMs = 5000, commKey = 0) => {
    return ipcRenderer.invoke('zk:read-punches', { ip, port, timeoutMs, commKey });
  },
  runIndependentDiagnostics: (ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:run-independent-diagnostics', { ip, port, timeoutMs, model, serial, commKey });
  },
  pingZkDevice: (ip, port = 4370, timeoutMs = 3000) => {
    return ipcRenderer.invoke('zk:ping-device', { ip, port, timeoutMs });
  },

  // Integración BioTime Platform Service Console (C:\BioTime)
  checkBioTimeStatus: (params = {}) => {
    return ipcRenderer.invoke('biotime:check-status', params);
  },
  syncBioTimePunches: (params = {}) => {
    return ipcRenderer.invoke('biotime:sync-punches', params);
  },
  getRawPunches: () => {
    return ipcRenderer.invoke('punches:get-all');
  },

  // Hardware y Sistema Operativo
  getSystemInfo: () => {
    return ipcRenderer.invoke('system:get-info');
  },

  // Controles de ventana
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
});
