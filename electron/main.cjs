const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const os = require('os');
const http = require('http');

const firewallManager = require('./firewallManager.cjs');
const zktecoDriver = require('./zktecoDriver.cjs');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DESKTOP_PORT = process.env.PORT || 3000;

function log(msg) {
  console.log(`[DRAC-DESKTOP] ${new Date().toISOString()} - ${msg}`);
}

async function createWindow() {
  log('Inicializando ventana principal de DRAC Control de Asistencia...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'DRAC Control de Asistencia - Dirección Regional de Agricultura Cajamarca',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
    show: false,
    backgroundColor: '#07080A',
    autoHideMenuBar: true,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Ventana principal cargada y visible.');
  });

  if (isDev) {
    const devUrl = `http://localhost:${DESKTOP_PORT}`;
    log(`Modo Desarrollo: cargando ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      log(`Error cargando URL dev: ${err.message}. Reintentando en 2s...`);
      setTimeout(() => mainWindow.loadURL(devUrl), 2000);
    });
  } else {
    try {
      const serverPath = path.join(__dirname, '..', 'dist', 'server.cjs');
      log(`Iniciando backend integrado en ${serverPath}...`);
      require(serverPath);
    } catch (err) {
      log(`Aviso al iniciar backend integrado: ${err.message}`);
    }

    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      log(`Fallback cargando archivo estático: ${err.message}`);
      mainWindow.loadURL(`http://localhost:${DESKTOP_PORT}`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =========================================================================
// IPC HANDLERS - SERVICIOS NATIVOS DE ESCRITORIO
// =========================================================================

// 1. Verificación y Reparación del Firewall de Windows
ipcMain.handle('firewall:check-status', async () => {
  log('IPC: Consultando estado del Firewall de Windows...');
  return await firewallManager.checkFirewallStatus();
});

ipcMain.handle('firewall:repair-network', async () => {
  log('IPC: Ejecutando acción administrativa: Reparar Configuración de Red...');
  return await firewallManager.repairNetworkConfig();
});

// 2. Diagnóstico de Marcadores ZKTeco
ipcMain.handle('zk:diagnose-device', async (_event, { ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serialNumber = '', commKey = 0 }) => {
  log(`IPC: Diagnóstico completo ZKTeco hacia ${ip}:${port} (Modelo: ${model}, CommKey: ${commKey})`);
  return await zktecoDriver.diagnoseZkDevice(ip, port, timeoutMs, model, serialNumber, commKey);
});

ipcMain.handle('zk:independent-diagnostics', async (_event, { ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serialNumber = '', commKey = 0 }) => {
  log(`IPC: Ejecutando 6 comprobaciones independientes ZKTeco hacia ${ip}:${port}`);
  return await zktecoDriver.runIndependentDiagnostics(ip, port, timeoutMs, model, serialNumber, commKey);
});

ipcMain.handle('zk:read-punches', async (_event, { ip, port = 4370, timeoutMs = 5000, commKey = 0 }) => {
  log(`IPC: Lectura física de marcaciones ZKTeco hacia ${ip}:${port}`);
  return await zktecoDriver.readZkDevicePunches(ip, port, timeoutMs, commKey);
});

ipcMain.handle('zk:probe-tcp', async (_event, { ip, port = 4370, timeoutMs = 2500 }) => {
  return await zktecoDriver.probeTcpPort(ip, port, timeoutMs);
});

ipcMain.handle('zk:ping-device', async (_event, { ip, port = 4370, timeoutMs = 3000 }) => {
  log(`IPC: Ping físico TCP a marcador ${ip}:${port}`);
  const probe = await zktecoDriver.probeTcpPort(ip, port, timeoutMs);
  return {
    success: probe.ok,
    reachable: probe.ok,
    ip,
    port,
    latencyMs: probe.latency,
    error: probe.code || probe.error,
    message: probe.ok
      ? `Marcador respondiendo en ${ip}:${port} (${probe.latency}ms)`
      : `No se pudo conectar a ${ip}:${port} (${probe.code || probe.error || 'UNREACHABLE'})`,
    timestamp: new Date().toISOString(),
  };
});

// 3. Información del Sistema Local y Hardware
ipcMain.handle('system:get-info', async () => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, ip: net.address });
      }
    }
  }

  const fw = await firewallManager.checkFirewallStatus();

  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    osRelease: os.release(),
    type: os.type(),
    appVersion: app.getVersion(),
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    networkAddresses: addresses,
    firewallConfigured: fw.configured,
    firewallStatus: fw.status,
    isAdmin: fw.isAdmin,
    localTime: new Date().toISOString(),
  };
});

// 4. Control de Ventana
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// =========================================================================
// CICLO DE VIDA DE LA APLICACIÓN
// =========================================================================
app.whenReady().then(async () => {
  log('Electron App Ready. Verificando requerimientos de red...');
  // Verificación y activación automática de reglas de Firewall de Windows en primer inicio
  await firewallManager.ensureFirewallOnStartup();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
