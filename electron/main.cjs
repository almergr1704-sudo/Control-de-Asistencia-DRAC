const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const os = require('os');
const fs = require('fs');
const { diagnoseZkDevice, readZkDevicePunches, probeTcpPort } = require('./zktecoDriver.cjs');

// Bloqueo de instancia única para evitar que se abran múltiples procesos en Windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Manejo global de excepciones para prevenir que la app se cierre inesperadamente
process.on('uncaughtException', (err) => {
  log(`[CRITICAL] Uncaught Exception: ${err ? err.stack || err.message : 'Unknown'}`);
});

process.on('unhandledRejection', (reason) => {
  log(`[WARNING] Unhandled Rejection: ${reason}`);
});

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DESKTOP_PORT = process.env.PORT || 3000;

// Configuración de archivo de log persistente en la carpeta del usuario
let logFilePath = null;
function initLogger() {
  try {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    logFilePath = path.join(userDataDir, 'drac-desktop.log');
  } catch (e) {
    // Si falla la inicialización temprana de ruta, se usará console.log
  }
}

function log(msg) {
  const line = `[DRAC-DESKTOP] ${new Date().toISOString()} - ${msg}\n`;
  console.log(line.trim());
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, line, 'utf-8');
    } catch (_) {}
  }
}

// Resolver ruta de icono institucional de manera segura
function resolveIconPath() {
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'icon.png'),
    path.join(__dirname, '..', 'dist', 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

// Resolver ruta de index.html institucional
function resolveIndexPath() {
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'dist', 'index.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(app.getAppPath(), 'dist', 'index.html');
}

async function createWindow() {
  initLogger();
  log('Iniciando ventana principal de DRAC Control de Asistencia...');
  log(`AppPath: ${app.getAppPath()}`);

  const icon = resolveIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'DRAC Control de Asistencia - Dirección Regional de Agricultura Cajamarca',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Permite consultar Supabase HTTPS sin bloqueo de origen file://
      allowRunningInsecureContent: true,
    },
    show: false,
    backgroundColor: '#07080A',
    autoHideMenuBar: true,
  });

  // Mostrar cuando esté listo para evitar pantalla en blanco inicial
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Ventana principal lista y mostrada al usuario.');
  });

  // Prevenir que la app abra navegadores externos (Chrome, Edge)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    log(`[VENTANA EXTERNA] Petición bloqueada: ${url} (manteniendo app en su propia ventana)`);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Si intenta navegar fuera del archivo local, cancelar navegación
    if (!navigationUrl.startsWith('file:') && !navigationUrl.includes('localhost')) {
      event.preventDefault();
      log(`[NAVEGACIÓN EXTERNA] Bloqueada para mantener aplicación en ventana local: ${navigationUrl}`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`[ERROR] Fallo al cargar URL (${errorCode}: ${errorDescription}) en: ${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`[CRITICAL] Proceso de renderizado terminado: ${details.reason} (código de salida: ${details.exitCode})`);
  });

  const targetHtml = resolveIndexPath();
  const hasLocalBuild = fs.existsSync(targetHtml);
  const forceDevServer = process.env.ELECTRON_DEV === 'true' && !hasLocalBuild;

  if (forceDevServer) {
    const devUrl = `http://localhost:${DESKTOP_PORT}`;
    log(`Modo Desarrollo explícito activado: conectando a ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      log(`Error conectando a devUrl: ${err.message}. Intentando cargar build local...`);
      if (hasLocalBuild) {
        mainWindow.loadFile(targetHtml);
      }
    });
  } else {
    // Modo de producción nativo: Cargar directamente el index.html local compilado sin depender de localhost ni abrir navegadores
    log(`Cargando interfaz de producción independiente de escritorio: ${targetHtml}`);
    mainWindow.loadFile(targetHtml).catch((err) => {
      log(`[ERROR CRÍTICO] Error al cargar ${targetHtml}: ${err.message}`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==========================================
// IPC HANDLERS - SERVICIOS NATIVOS DE ESCRITORIO
// ==========================================

// 1. Diagnóstico Real en 6 Etapas para Marcadores ZKTeco (Protocolo Standalone TCP/UDP)
ipcMain.handle('zk:diagnose-device', async (_event, { ip, port = 4370, timeoutMs = 3000, model = 'G3-id', serialNumber = '' }) => {
  log(`[ZK DIAGNOSTICO] Iniciando prueba por etapas contra marcador: ${ip}:${port} (${model})`);
  try {
    const result = await diagnoseZkDevice(ip, port, timeoutMs, model, serialNumber);
    log(`[ZK DIAGNOSTICO RESULTADO] ${ip}:${port} -> Estado: ${result.status} | Mensaje: ${result.message}`);
    return result;
  } catch (err) {
    log(`[ZK DIAGNOSTICO ERROR] ${ip}:${port} -> Excepción: ${err.message}`);
    return {
      success: false,
      status: 'ERROR',
      message: 'Error inesperado durante el diagnóstico del biométrico.',
      cause: err.message || String(err),
      ip,
      port,
      model,
      serial_number: serialNumber,
      user_count: 0,
      clock_punches_count: 0,
      error_count: 1,
      step_details: [],
      timestamp: new Date().toISOString(),
    };
  }
});

// 2. Lectura Física de Marcaciones Almacenadas en el Reloj ZKTeco
ipcMain.handle('zk:read-punches', async (_event, { ip, port = 4370, timeoutMs = 5000 }) => {
  log(`[ZK LECTURA] Conectando y leyendo marcaciones físicas desde marcador: ${ip}:${port}`);
  try {
    const result = await readZkDevicePunches(ip, port, timeoutMs);
    log(`[ZK LECTURA OK] ${ip}:${port} -> Serial: ${result.serial_number} | Marcaciones leídas: ${result.total_clock_punches}`);
    return { success: true, ...result };
  } catch (err) {
    log(`[ZK LECTURA ERROR] ${ip}:${port} -> ${err.message}`);
    return {
      success: false,
      message: err.message || 'Error al leer marcaciones del marcador.',
      punches: [],
      total_clock_punches: 0,
      ip,
      port,
      timestamp: new Date().toISOString(),
    };
  }
});

// 3. Verificación Rápida de Socket TCP (Compatibilidad)
ipcMain.handle('zk:ping-device', async (_event, { ip, port = 4370, timeoutMs = 2000 }) => {
  log(`[ZK PING] Verificando conectividad física con marcador ZKTeco: ${ip}:${port}`);
  const probe = await probeTcpPort(ip, port, timeoutMs);
  return {
    success: probe.ok,
    reachable: probe.ok,
    ip,
    port,
    latencyMs: probe.latency,
    message: probe.ok ? `Marcador respondiendo en ${ip}:${port} (${probe.latency}ms)` : probe.error,
    error: probe.error,
    timestamp: new Date().toISOString(),
  };
});

// 2. Información del Sistema Local y Hardware
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

// 3. Control de Ventana
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

// Ciclo de vida de la aplicación
app.whenReady().then(createWindow);

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
