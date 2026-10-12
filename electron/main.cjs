const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const os = require('os');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DESKTOP_PORT = process.env.PORT || 3000;

// Configurar logging seguro
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

  // Mostrar cuando esté listo para evitar flash blanco
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Ventana principal cargada y visible.');
  });

  // Cargar frontend
  if (isDev) {
    const devUrl = `http://localhost:${DESKTOP_PORT}`;
    log(`Modo Desarrollo: cargando ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      log(`Error cargando URL dev: ${err.message}. Reintentando en 2s...`);
      setTimeout(() => mainWindow.loadURL(devUrl), 2000);
    });
  } else {
    // En producción empaquetada:
    // 1. Iniciamos el servidor Express local compilado si está disponible
    try {
      const serverPath = path.join(__dirname, '..', 'dist', 'server.cjs');
      log(`Iniciando backend integrado en ${serverPath}...`);
      require(serverPath);
    } catch (err) {
      log(`Aviso al iniciar backend integrado: ${err.message}`);
    }

    // 2. Cargamos la aplicación
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
    for (const net of networkInterfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, ip: net.address });
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
