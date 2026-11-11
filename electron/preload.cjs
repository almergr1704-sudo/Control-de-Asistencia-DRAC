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
  readZkDevicePunches: (ip, port = 7496, timeoutMs = 5000, commKey = 0, model = 'ZKTeco G3', serial = 'AEH2223460040') => {
    return ipcRenderer.invoke('zk:read-punches', { ip, port, timeoutMs, commKey, model, serial });
  },
  runIndependentDiagnostics: (ip, port = 7496, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0) => {
    return ipcRenderer.invoke('zk:run-independent-diagnostics', { ip, port, timeoutMs, model, serial, commKey });
  },
  pingZkDevice: (ip, port = 7496, timeoutMs = 3000) => {
    return ipcRenderer.invoke('zk:ping-device', { ip, port, timeoutMs });
  },

  // Persistencia y Gestión Directa de Marcadores Biométricos
  getDevices: () => {
    return ipcRenderer.invoke('device:get-all');
  },
  updateDevice: (id, payload) => {
    return ipcRenderer.invoke('device:update', { id, payload });
  },
  createDevice: (payload) => {
    return ipcRenderer.invoke('device:create', payload);
  },
  deleteDevice: (id) => {
    return ipcRenderer.invoke('device:delete', id);
  },
  onDeviceConfigChanged: (callback) => {
    const handler = (_event, device) => callback(device);
    ipcRenderer.on('device:config-changed', handler);
    return () => ipcRenderer.removeListener('device:config-changed', handler);
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

  // Turnos, Horarios y Asignaciones
  getTurnos: () => ipcRenderer.invoke('turnos:get-all'),
  saveTurno: (turno) => ipcRenderer.invoke('turnos:save', turno),
  deleteTurno: (id) => ipcRenderer.invoke('turnos:delete', id),

  getHorarios: () => ipcRenderer.invoke('horarios:get-all'),
  saveHorario: (horario) => ipcRenderer.invoke('horarios:save', horario),
  deleteHorario: (id) => ipcRenderer.invoke('horarios:delete', id),

  getAsignaciones: () => ipcRenderer.invoke('asignaciones:get-all'),
  saveAsignacion: (asignacion) => ipcRenderer.invoke('asignaciones:save', asignacion),
  deleteAsignacion: (id) => ipcRenderer.invoke('asignaciones:delete', id),

  // Controles de ventana
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
});
