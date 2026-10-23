const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const http = require('http');

const firewallManager = require('./firewallManager.cjs');
const zktecoDriver = require('./zktecoDriver.cjs');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DESKTOP_PORT = process.env.PORT || 3000;

// Configurar logging seguro y descriptivo
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
      webSecurity: false,
    },
    show: false,
    backgroundColor: '#07080A',
    autoHideMenuBar: true,
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const devUrl = process.env.ELECTRON_START_URL || `http://localhost:${DESKTOP_PORT}`;

  // Mostrar cuando esté listo para evitar flash blanco
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Ventana principal cargada y visible.');
  });

  // Temporizador de seguridad para garantizar visibilidad si ready-to-show no dispara
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      log('Mostrando ventana por timeout de seguridad.');
      mainWindow.show();
    }
  }, 2500);

  // Atajos para inspección (F12 / Ctrl+Shift+I) y recarga (F5)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  // Manejo de errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log(`[ERROR CARGA] (${errorCode}) ${errorDescription} en: ${validatedURL}`);
    if (fs.existsSync(indexPath) && !validatedURL.endsWith('index.html')) {
      log(`Intentando recuperación con archivo local compilado: ${indexPath}`);
      mainWindow.loadFile(indexPath);
    }
  });

  // Cargar frontend: si existe dist/index.html (empaquetado o post-build), cargarlo directamente
  if (app.isPackaged || fs.existsSync(indexPath)) {
    log(`Cargando frontend empaquetado desde ${indexPath}...`);
    mainWindow.loadFile(indexPath).catch((err) => {
      log(`Aviso al cargar loadFile: ${err.message}. Intentando fallback URL ${devUrl}`);
      mainWindow.loadURL(devUrl).catch((devErr) => {
        log(`Error al cargar URL dev de contingencia: ${devErr.message}`);
      });
    });
  } else {
    log(`Modo Desarrollo activo: cargando URL dev ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      log(`Error cargando URL dev: ${err.message}. Reintentando en 2s...`);
      setTimeout(() => mainWindow && !mainWindow.isDestroyed() && mainWindow.loadURL(devUrl), 2000);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =========================================================================
// IPC HANDLERS - GESTIÓN DE FIREWALL DE WINDOWS & RED
// =========================================================================

// Consultar estado de las reglas del Firewall de Windows para TCP 4370
ipcMain.handle('firewall:check-status', async () => {
  log('IPC firewall:check-status invocado.');
  try {
    return await firewallManager.checkFirewallStatus();
  } catch (err) {
    log(`Error en firewall:check-status: ${err.message}`);
    return {
      isWindows: process.platform === 'win32',
      configured: false,
      status: 'REQUIERE CONFIGURACIÓN',
      statusText: 'Firewall Windows: REQUIERE CONFIGURACIÓN',
      isAdmin: false,
      error: err.message,
      rules: [],
      missingRules: ['DRAC Control Asistencia - ZKTeco TCP 4370'],
      details: `Fallo al auditar Firewall: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
});

// Acción administrativa: "Reparar Configuración de Red"
ipcMain.handle('firewall:repair-network', async () => {
  log('IPC firewall:repair-network invocado.');
  try {
    return await firewallManager.repairNetworkConfig();
  } catch (err) {
    log(`Error en firewall:repair-network: ${err.message}`);
    return {
      success: false,
      message: `Error al reparar configuración de red: ${err.message}`,
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
});

// =========================================================================
// IPC HANDLERS - COMUNICACIÓN BIOMÉTRICA ZKTECO (TCP 4370 NATIVO)
// =========================================================================

// Diagnóstico exhaustivo de 10 etapas
ipcMain.handle(
  'zk:diagnose-device',
  async (_event, { ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0 }) => {
    log(`IPC zk:diagnose-device -> ${ip}:${port} (${model}, S/N: ${serial}, CommKey: ${commKey})`);
    try {
      return await zktecoDriver.diagnoseZkDevice(ip, port, timeoutMs, model, serial, commKey);
    } catch (err) {
      log(`Error en diagnoseZkDevice: ${err.message}`);
      return {
        success: false,
        status: 'OFFLINE',
        message: `Error interno al ejecutar diagnóstico: ${err.message}`,
        cause: err.message,
        ip,
        port,
        model,
        serial_number: serial,
        user_count: 0,
        clock_punches_count: 0,
        error_count: 1,
        step_details: [],
        timestamp: new Date().toISOString(),
      };
    }
  }
);

// Lectura directa de marcaciones mediante socket TCP
ipcMain.handle('zk:read-punches', async (_event, { ip, port = 4370, timeoutMs = 5000, commKey = 0 }) => {
  log(`IPC zk:read-punches -> ${ip}:${port} (CommKey: ${commKey})`);
  try {
    return await zktecoDriver.readZkDevicePunches(ip, port, timeoutMs, commKey);
  } catch (err) {
    log(`Error en readZkDevicePunches: ${err.message}`);
    return {
      success: false,
      message: `Error al descargar marcaciones: ${err.message}`,
      punches: [],
      timestamp: new Date().toISOString(),
    };
  }
});

// Comprobaciones independientes (Ping, TCP 4370, Firewall Windows, Socket TCP, ZKTeco, Info)
ipcMain.handle(
  'zk:run-independent-diagnostics',
  async (_event, { ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0 }) => {
    log(`IPC zk:run-independent-diagnostics -> ${ip}:${port}`);
    try {
      return await zktecoDriver.runIndependentDiagnostics(ip, port, timeoutMs, model, serial, commKey);
    } catch (err) {
      log(`Error en runIndependentDiagnostics: ${err.message}`);
      return {
        success: false,
        status: 'Fallido',
        ip,
        port,
        model,
        serial_number: serial,
        tests: [
          { id: 'general', name: 'Diagnóstico Independiente', status: 'Fallido', message: err.message, error: err.message },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }
);

// Verificación Real TCP Socket para Marcadores ZKTeco con discriminación de errores precisa
ipcMain.handle('zk:ping-device', async (_event, { ip, port = 4370, timeoutMs = 3000 }) => {
  log(`Verificando conectividad física con marcador ZKTeco: ${ip}:${port} (timeout=${timeoutMs}ms)`);

  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency = Date.now() - startTime;
      isResolved = true;
      socket.destroy();
      log(`Conexión TCP exitosa con ${ip}:${port} en ${latency}ms`);
      resolve({
        success: true,
        reachable: true,
        ip,
        port,
        latencyMs: latency,
        message: `Marcador respondiendo en ${ip}:${port} (${latency}ms). Puerto TCP 4370 abierto.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        log(`Timeout de conexión con marcador ${ip}:${port} (${timeoutMs}ms)`);
        resolve({
          success: false,
          reachable: false,
          ip,
          port,
          error: 'ETIMEDOUT',
          message: `Timeout agotado (${timeoutMs}ms). El marcador en ${ip}:${port} no respondió. Verifique si el equipo está encendido o si hay bloqueo en Firewall.`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        const code = err.code || 'UNKNOWN';
        log(`Error conectando con marcador ${ip}:${port} [${code}]: ${err.message}`);

        let userFriendlyMsg = `Error TCP (${code}): ${err.message}`;
        if (code === 'ECONNREFUSED') {
          userFriendlyMsg = `Conexión rechazada por puerto cerrado (ECONNREFUSED). El host ${ip} respondió pero el puerto TCP ${port} no escucha o el biométrico está configurado en modo PUSH / ADMS (Servidor Cloud) en lugar de Standalone / SDK local.`;
        } else if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
          userFriendlyMsg = `Dispositivo no alcanzable o equipo apagado (${code}). No existe ruta física de red hacia ${ip}.`;
        } else if (code === 'ECONNRESET' || code === 'EPIPE') {
          userFriendlyMsg = `Conexión reseteada por el dispositivo o firewall (${code}). La sesión fue cerrada abruptamente.`;
        }

        resolve({
          success: false,
          reachable: false,
          ip,
          port,
          error: code,
          message: userFriendlyMsg,
          timestamp: new Date().toISOString(),
        });
      }
    });

    try {
      socket.connect(port, ip);
    } catch (e) {
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          reachable: false,
          ip,
          port,
          error: 'EINIT',
          message: `Error al inicializar socket TCP: ${e.message}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
});

// =========================================================================
// IPC HANDLERS - INTEGRACIÓN BIOTIME PLATFORM SERVICE CONSOLE (C:\BioTime)
// =========================================================================

ipcMain.handle('biotime:check-status', async (_event, params = {}) => {
  const { host = '192.168.1.29', webPort = 89, dbPort = 7496, serial = 'AEH2223460040' } = params;
  log(`IPC biotime:check-status -> ${host} (Web: ${webPort}, DB: ${dbPort}, SN: ${serial})`);
  try {
    if (typeof zktecoDriver.checkBioTimeService === 'function') {
      return await zktecoDriver.checkBioTimeService(host, webPort, dbPort, serial);
    }
    return {
      success: false,
      message: 'Función checkBioTimeService no disponible en el driver',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    log(`Error en checkBioTimeService: ${err.message}`);
    return {
      success: false,
      message: `Error al comprobar BioTime: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
});

ipcMain.handle('biotime:sync-punches', async (_event, params = {}) => {
  const {
    host = '192.168.1.29',
    webPort = 89,
    dbPort = 7496,
    serial = 'AEH2223460040',
    deviceId = 'dev-01',
    deviceIp = '192.168.1.180',
    devicePort = 7496,
  } = params;
  log(`IPC biotime:sync-punches -> ${serial} (Host: ${host}, Web: ${webPort}, DB: ${dbPort})`);
  try {
    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const status = typeof zktecoDriver.checkBioTimeService === 'function'
      ? await zktecoDriver.checkBioTimeService(host, webPort, dbPort, serial)
      : { success: true };

    const punchesPath = path.join(__dirname, '..', 'data', 'raw-punches.json');
    let loadedPunches = [];
    try {
      if (fs.existsSync(punchesPath)) {
        loadedPunches = JSON.parse(fs.readFileSync(punchesPath, 'utf8'));
      }
    } catch (_) {}

    // Invocación del extractor real
    let syncResult = { punches: [], source: 'NONE', details: '' };
    if (typeof zktecoDriver.syncBioTimeRecords === 'function') {
      syncResult = await zktecoDriver.syncBioTimeRecords({
        host,
        webPort,
        dbPort,
        serial,
        deviceIp,
        devicePort,
        existingPunches: loadedPunches,
      });
    }

    // Deduplicación y fusión por (employee_dni, timestamp)
    const existingKeys = new Set(
      loadedPunches.map((p) => `${p.employee_dni || p.pin}_${p.timestamp}`)
    );

    const newlyAdded = [];
    if (Array.isArray(syncResult.punches) && syncResult.punches.length > 0) {
      for (const p of syncResult.punches) {
        const key = `${p.employee_dni || p.pin}_${p.timestamp}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          newlyAdded.push(p);
        }
      }
    }

    const mergedPunches = [...newlyAdded, ...loadedPunches];

    try {
      fs.writeFileSync(punchesPath, JSON.stringify(mergedPunches, null, 2), 'utf8');
      log(`Guardadas ${mergedPunches.length} marcaciones en raw-punches.json (${newlyAdded.length} nuevas)`);
    } catch (writeErr) {
      log(`Aviso al persistir raw-punches.json: ${writeErr.message}`);
    }

    return {
      success: true,
      message: newlyAdded.length > 0
        ? `Sincronización completada: ${newlyAdded.length} marcaciones nuevas extraídas desde ${syncResult.source}. Total en staging: ${mergedPunches.length}.`
        : `Sincronización completada con ${syncResult.source || 'BioTime'}. Todas las marcaciones se encuentran actualizadas (${mergedPunches.length} registros).`,
      serial,
      deviceId,
      source: syncResult.source,
      new_count: newlyAdded.length,
      punches_count: mergedPunches.length,
      punches: mergedPunches,
      status,
      timestamp: nowStr,
    };
  } catch (err) {
    log(`Error en biotime:sync-punches: ${err.message}`);
    return {
      success: false,
      message: `Error al sincronizar con BioTime: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
});

ipcMain.handle('punches:get-all', async () => {
  try {
    const punchesPath = path.join(__dirname, '..', 'data', 'raw-punches.json');
    if (fs.existsSync(punchesPath)) {
      return JSON.parse(fs.readFileSync(punchesPath, 'utf8'));
    }
  } catch (_) {}
  return [];
});

// =========================================================================
// IPC HANDLERS - INFORMACIÓN DEL SISTEMA LOCAL Y HARDWARE
// =========================================================================

ipcMain.handle('system:get-info', async () => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(networkInterfaces)) {
    for (const netIf of networkInterfaces[name] || []) {
      if (netIf.family === 'IPv4' && !netIf.internal) {
        addresses.push({ interface: name, ip: netIf.address });
      }
    }
  }

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
    localTime: new Date().toISOString(),
  };
});

// =========================================================================
// CONTROL DE VENTANA
// =========================================================================

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

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// =========================================================================
// CICLO DE VIDA DE LA APLICACIÓN
// =========================================================================

app.whenReady().then(async () => {
  await createWindow();

  // En Windows, verificar reglas del Firewall de Windows en segundo plano
  if (process.platform === 'win32') {
    firewallManager.ensureFirewallOnStartup().catch((err) => {
      log(`Aviso en ensureFirewallOnStartup: ${err.message}`);
    });
  }
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
