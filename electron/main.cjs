const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const os = require('os');
const fs = require('fs');

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
  log(`Modo: ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN (EMPAQUETADO)'}`);
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

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`[ERROR] Fallo al cargar URL (${errorCode}: ${errorDescription}) en: ${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`[CRITICAL] Proceso de renderizado terminado: ${details.reason} (código de salida: ${details.exitCode})`);
  });

  if (isDev) {
    const devUrl = `http://localhost:${DESKTOP_PORT}`;
    log(`Modo Desarrollo: conectando a ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      log(`Error conectando a devUrl: ${err.message}. Reintentando...`);
      setTimeout(() => mainWindow.loadURL(devUrl), 2000);
    });
  } else {
    // Cargar directamente el index.html local compilado
    const targetHtml = resolveIndexPath();
    log(`Cargando archivo principal: ${targetHtml}`);
    mainWindow.loadFile(targetHtml).catch((err) => {
      log(`Error al cargar ${targetHtml}: ${err.message}`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==========================================
// IPC HANDLERS - SERVICIOS NATIVOS DE ESCRITORIO
// ==========================================

// 1. Verificación Real TCP Socket para Marcadores ZKTeco
ipcMain.handle('zk:ping-device', async (_event, { ip, port = 4370, timeoutMs = 3000 }) => {
  log(`Verificando conectividad física con marcador ZKTeco: ${ip}:${port}`);

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
        message: `Marcador respondiendo en ${ip}:${port} (${latency}ms)`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        log(`Timeout de conexión con marcador ${ip}:${port}`);
        resolve({
          success: false,
          reachable: false,
          ip,
          port,
          message: `Tiempo de espera agotado (${timeoutMs}ms) al conectar con ${ip}:${port}`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        log(`Error conectando con marcador ${ip}:${port}: ${err.message}`);
        resolve({
          success: false,
          reachable: false,
          ip,
          port,
          error: err.code || err.message,
          message: `No se pudo establecer conexión con ${ip}:${port} (${err.code || 'UNREACHABLE'})`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.connect(port, ip);
  });
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
