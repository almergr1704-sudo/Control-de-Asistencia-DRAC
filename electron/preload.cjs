const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura las APIs de escritorio al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Firewall de Windows y Reparación de Red Institucional
  checkFirewallStatus: (port = 7496) => {
    return ipcRenderer.invoke('firewall:check-status', port);
  },
  repairNetworkConfig: (port = 7496) => {
    return ipcRenderer.invoke('firewall:repair-network', port);
  },

  // Comunicación y Diagnóstico ZKTeco Standalone (TCP 7496 inicial / 4370 alternativo)
  diagnoseZkDevice: (ip, port = 7496, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:diagnose-device', { ip, port, timeoutMs, model, serial, commKey });
  },
  readZkDevicePunches: (ip, port = 7496, timeoutMs = 5000, commKey = 0) => {
    return ipcRenderer.invoke('zk:read-punches', { ip, port, timeoutMs, commKey });
  },
  runIndependentDiagnostics: (ip, port = 7496, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:run-independent-diagnostics', { ip, port, timeoutMs, model, serial, commKey });
  },
  pingZkDevice: (ip, port = 7496, timeoutMs = 3000) => {
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
