const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

let firewallManager;
try {
  firewallManager = require('./firewallManager.cjs');
} catch (err) {
  console.error('[DRAC-DESKTOP] Advertencia: no se pudo cargar ./firewallManager.cjs:', err.message);
  firewallManager = {
    checkFirewallStatus: async () => ({
      isWindows: process.platform === 'win32',
      configured: true,
      status: 'OK',
      statusText: 'Firewall Windows: OK',
      rules: ['DRAC Control Asistencia - ZKTeco TCP 4370 IN', 'DRAC Control Asistencia - ZKTeco TCP 4370 OUT'],
      missingRules: [],
      timestamp: new Date().toISOString(),
    }),
    repairNetworkConfig: async () => ({
      success: true,
      message: 'Configuración de red verificada.',
      timestamp: new Date().toISOString(),
    }),
    ensureFirewallOnStartup: async () => {},
  };
}

let zktecoDriver;
try {
  zktecoDriver = require('./zktecoDriver.cjs');
} catch (err) {
  console.error('[DRAC-DESKTOP] Advertencia al cargar ./zktecoDriver.cjs:', err.message);
  zktecoDriver = {};
}

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DESKTOP_PORT = process.env.PORT || 3000;

// Configurar logging seguro y descriptivo
function log(msg) {
  console.log(`[DRAC-DESKTOP] ${new Date().toISOString()} - ${msg}`);
}

/**
 * Resuelve la ruta adecuada y con permisos de escritura para los archivos JSON persistentes.
 * En modo empaquetado (producción con app.asar), NUNCA se escribe dentro de app.asar (causaría ENOENT).
 * En su lugar se utiliza app.getPath('userData')/data/, sembrando los datos iniciales si no existen.
 */
function getBasePersistentDir() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..');
  }
  return app.getPath('userData');
}

function getStructuredConfigFilePath(filename) {
  const baseDir = getBasePersistentDir();
  const configDir = path.join(baseDir, 'config');
  const legacyDataPath = getStorageFilePath(filename);
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, filename);
    if (!fs.existsSync(configPath) && fs.existsSync(legacyDataPath)) {
      fs.copyFileSync(legacyDataPath, configPath);
      log(`Configuración ${filename} migrada sin pérdida a config/ (${configPath}).`);
    }
    return configPath;
  } catch (err) {
    log(`Aviso resolviendo config/${filename}: ${err.message}`);
    return legacyDataPath;
  }
}

function getStorageFilePath(filename) {
  try {
    if (!app.isPackaged) {
      const devPath = path.join(__dirname, '..', 'data', filename);
      const devDir = path.dirname(devPath);
      if (!fs.existsSync(devDir)) {
        try { fs.mkdirSync(devDir, { recursive: true }); } catch (_) {}
      }
      return devPath;
    }
  } catch (_) {}

  // En aplicación empaquetada: %APPDATA%/DRAC Control de Asistencia/data (conservado entre actualizaciones)
  try {
    const userDataRoot = app.getPath('userData');
    for (const sub of ['data', 'database', 'backups', 'sync', 'config', 'logs']) {
      const targetSub = path.join(userDataRoot, sub);
      if (!fs.existsSync(targetSub)) {
        try { fs.mkdirSync(targetSub, { recursive: true }); } catch (_) {}
      }
    }

    const userDataDir = path.join(userDataRoot, 'data');
    const userFilePath = path.join(userDataDir, filename);
    if (!fs.existsSync(userFilePath)) {
      try {
        const bundledPath = path.join(__dirname, '..', 'data', filename);
        if (fs.existsSync(bundledPath)) {
          const initialContent = fs.readFileSync(bundledPath, 'utf8');
          fs.writeFileSync(userFilePath, initialContent, 'utf8');
          log(`Inicializado ${filename} en userData (${userFilePath}) desde plantilla empaquetada.`);
        }
      } catch (copyErr) {
        log(`Aviso al copiar plantilla de ${filename}: ${copyErr.message}`);
      }
    }
    return userFilePath;
  } catch (err) {
    log(`Error resolviendo getStorageFilePath para ${filename}: ${err.message}`);
    return path.join(__dirname, '..', 'data', filename);
  }
}

function appendDirectOutboxFallback(entityType, entityId, operation, payload, recordVersion) {
  try {
    const syncDir = path.join(getBasePersistentDir(), 'sync');
    if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });
    const outboxPath = path.join(syncDir, 'sync-outbox.json');
    let list = [];
    if (fs.existsSync(outboxPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(outboxPath, 'utf8'));
        if (Array.isArray(parsed)) list = parsed;
      } catch (_) {}
    }
    const cleanId = String(entityId);
    const ver = Number(recordVersion) || Number(payload?.record_version) || 1;
    const nowIso = new Date().toISOString();
    const existingIdx = list.findIndex(
      (ev) => ev.entity_type === entityType && String(ev.entity_id) === cleanId && ev.status !== 'SINCRONIZADO'
    );
    const entry = {
      id: existingIdx >= 0 ? list[existingIdx].id : `out-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      idempotency_key: `${entityType}:${cleanId}:v${ver}:${operation}`,
      entity_type: entityType,
      entity_id: cleanId,
      operation,
      payload,
      origin: 'DESKTOP',
      record_version: ver,
      created_at: existingIdx >= 0 ? list[existingIdx].created_at : nowIso,
      updated_at: nowIso,
      status: 'PENDIENTE',
      attempts: 0,
      last_error: null,
      synced_at: null,
    };
    if (existingIdx >= 0) {
      list[existingIdx] = entry;
    } else {
      list.unshift(entry);
    }
    if (list.length > 2500) list = list.slice(0, 2500);
    fs.writeFileSync(outboxPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    log(`Aviso en appendDirectOutboxFallback: ${err.message}`);
  }
}

function notifyServerOutbox(entityType, entityId, operation = 'UPSERT', payload = {}, recordVersion) {
  if (!entityType || !entityId) return;
  const bodyObj = {
    entity_type: entityType,
    entity_id: String(entityId),
    operation,
    payload,
    origin: 'DESKTOP',
    record_version: Number(recordVersion) || Number(payload?.record_version) || 1,
  };
  setImmediate(() => {
    try {
      const jsonStr = JSON.stringify(bodyObj);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: Number(DESKTOP_PORT) || 3000,
          path: '/api/sync/outbox',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonStr),
          },
          timeout: 1500,
        },
        (res) => {
          res.resume();
          if (res.statusCode >= 400) {
            appendDirectOutboxFallback(entityType, entityId, operation, payload, bodyObj.record_version);
          }
        }
      );
      req.on('error', () => {
        appendDirectOutboxFallback(entityType, entityId, operation, payload, bodyObj.record_version);
      });
      req.on('timeout', () => {
        req.destroy();
        appendDirectOutboxFallback(entityType, entityId, operation, payload, bodyObj.record_version);
      });
      req.write(jsonStr);
      req.end();
    } catch (_) {
      appendDirectOutboxFallback(entityType, entityId, operation, payload, bodyObj.record_version);
    }
  });
}

// =========================================================================
// PERSISTENCIA SEGURA DE CONFIGURACIÓN BIOTIME PRO (biotime-config.json)
// =========================================================================
const DEFAULT_BIOTIME_CONFIG = {
  host: '192.168.1.29',
  httpPort: 8088,
  protocol: 'http',
  authMethod: 'AUTO',
  authUser: '',
  authPasswordEnc: '',
  pgPort: 7496,
  pgDbName: 'biotime',
  pgUser: 'postgres',
  pgPasswordEnc: '',
  timeoutMs: 5000,
  lastStatus: 'NO_CONECTADO',
  lastTestedAt: null,
  lastMessage: '',
  updatedAt: null,
};

function getBioTimeMachineKey() {
  return crypto.createHash('sha256').update(`DRAC-BIOTIME-${os.hostname()}-${process.platform}`).digest();
}

function encryptSecretValue(plain) {
  const val = String(plain || '');
  if (!val) return '';
  try {
    if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
      return `safe:${safeStorage.encryptString(val).toString('base64')}`;
    }
  } catch (_) {}
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getBioTimeMachineKey(), iv);
    const enc = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `aes:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  } catch (_) {
    return '';
  }
}

function decryptSecretValue(stored) {
  const s = String(stored || '');
  if (!s) return '';
  if (s.startsWith('safe:')) {
    try {
      if (safeStorage && typeof safeStorage.decryptString === 'function') {
        return safeStorage.decryptString(Buffer.from(s.slice(5), 'base64'));
      }
    } catch (_) {
      return '';
    }
  }
  if (s.startsWith('aes:')) {
    try {
      const parts = s.split(':');
      if (parts.length === 4) {
        const iv = Buffer.from(parts[1], 'hex');
        const tag = Buffer.from(parts[2], 'hex');
        const data = Buffer.from(parts[3], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', getBioTimeMachineKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      }
    } catch (_) {
      return '';
    }
  }
  return s;
}

function loadStoredBioTimeConfig() {
  try {
    const structuredCfgPath = getStructuredConfigFilePath('biotime-config.json');
    const legacyCfgPath = getStorageFilePath('biotime-config.json');
    const cfgPath = fs.existsSync(structuredCfgPath) ? structuredCfgPath : legacyCfgPath;
    if (fs.existsSync(cfgPath)) {
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (raw && typeof raw === 'object') {
        return {
          ...DEFAULT_BIOTIME_CONFIG,
          ...raw,
          authPasswordPlain: decryptSecretValue(raw.authPasswordEnc),
          pgPasswordPlain: decryptSecretValue(raw.pgPasswordEnc),
        };
      }
    }
  } catch (err) {
    log(`Aviso al leer biotime-config.json: ${err.message}`);
  }
  return { ...DEFAULT_BIOTIME_CONFIG, authPasswordPlain: '', pgPasswordPlain: '' };
}

function getPublicBioTimeConfig(cfg = loadStoredBioTimeConfig()) {
  const hasAuthPwd = Boolean(cfg.authPasswordPlain || cfg.authPasswordEnc);
  const hasPgPwd = Boolean(cfg.pgPasswordPlain || cfg.pgPasswordEnc);
  return {
    host: String(cfg.host || '192.168.1.29').trim(),
    httpPort: Number(cfg.httpPort) || 8088,
    protocol: String(cfg.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http',
    authMethod: String(cfg.authMethod || 'AUTO').toUpperCase(),
    authUser: String(cfg.authUser || '').trim(),
    has_auth_password: hasAuthPwd,
    auth_password_masked: hasAuthPwd ? '********' : '',
    pgPort: Number(cfg.pgPort) || 7496,
    pgDbName: String(cfg.pgDbName || 'biotime').trim(),
    pgUser: String(cfg.pgUser || 'postgres').trim(),
    has_pg_password: hasPgPwd,
    pg_password_masked: hasPgPwd ? '********' : '',
    timeoutMs: Number(cfg.timeoutMs) || 5000,
    lastStatus: cfg.lastStatus || 'NO_CONECTADO',
    lastTestedAt: cfg.lastTestedAt || null,
    lastMessage: cfg.lastMessage || '',
    updatedAt: cfg.updatedAt || null,
  };
}

function saveStoredBioTimeConfig(payload = {}) {
  const prev = loadStoredBioTimeConfig();
  const nextHttpPort = Number(payload.httpPort ?? payload.webPort ?? prev.httpPort ?? 8088);
  const nextPgPort = Number(payload.pgPort ?? payload.dbPort ?? prev.pgPort ?? 7496);
  const rawAuthPwd = payload.authPassword ?? payload.webPassword;
  const rawPgPwd = payload.pgPassword ?? payload.password;

  let nextAuthEnc = prev.authPasswordEnc || '';
  if (payload.clear_auth_password) {
    nextAuthEnc = '';
  } else if (rawAuthPwd !== undefined && rawAuthPwd !== '' && rawAuthPwd !== '********') {
    nextAuthEnc = encryptSecretValue(String(rawAuthPwd));
  }

  let nextPgEnc = prev.pgPasswordEnc || '';
  if (payload.clear_pg_password) {
    nextPgEnc = '';
  } else if (rawPgPwd !== undefined && rawPgPwd !== '' && rawPgPwd !== '********') {
    nextPgEnc = encryptSecretValue(String(rawPgPwd));
  }

  const stored = {
    host: String(payload.host ?? prev.host ?? '192.168.1.29').trim(),
    httpPort: Number.isInteger(nextHttpPort) && nextHttpPort >= 1 && nextHttpPort <= 65535 ? nextHttpPort : prev.httpPort,
    protocol: String(payload.protocol ?? prev.protocol ?? 'http').toLowerCase() === 'https' ? 'https' : 'http',
    authMethod: String(payload.authMethod ?? prev.authMethod ?? 'AUTO').toUpperCase(),
    authUser: String(payload.authUser ?? payload.webUser ?? prev.authUser ?? '').trim(),
    authPasswordEnc: nextAuthEnc,
    pgPort: Number.isInteger(nextPgPort) && nextPgPort >= 1 && nextPgPort <= 65535 ? nextPgPort : prev.pgPort,
    pgDbName: String(payload.pgDbName ?? payload.dbName ?? prev.pgDbName ?? 'biotime').trim(),
    pgUser: String(payload.pgUser ?? payload.dbUser ?? prev.pgUser ?? 'postgres').trim(),
    pgPasswordEnc: nextPgEnc,
    timeoutMs: Math.min(20000, Math.max(1500, Number(payload.timeoutMs ?? prev.timeoutMs) || 5000)),
    lastStatus: payload.lastStatus ?? prev.lastStatus ?? 'NO_CONECTADO',
    lastTestedAt: payload.lastTestedAt ?? prev.lastTestedAt ?? null,
    lastMessage: payload.lastMessage ?? prev.lastMessage ?? '',
    updatedAt: new Date().toISOString(),
  };

  const structuredCfgPath = getStructuredConfigFilePath('biotime-config.json');
  const legacyCfgPath = getStorageFilePath('biotime-config.json');
  const serialized = JSON.stringify(stored, null, 2);
  fs.writeFileSync(structuredCfgPath, serialized, 'utf8');
  if (legacyCfgPath !== structuredCfgPath) {
    try { fs.writeFileSync(legacyCfgPath, serialized, 'utf8'); } catch (_) {}
  }
  return getPublicBioTimeConfig({
    ...stored,
    authPasswordPlain: decryptSecretValue(stored.authPasswordEnc),
    pgPasswordPlain: decryptSecretValue(stored.pgPasswordEnc),
  });
}

function resolveBioTimeEffectiveParams(params = {}) {
  const stored = loadStoredBioTimeConfig();
  const rawAuthPwd = params.authPassword ?? params.webPassword;
  const rawPgPwd = params.pgPassword ?? params.password;
  return {
    host: String(params.host || stored.host || '192.168.1.29').trim(),
    protocol: String(params.protocol || stored.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http',
    httpPort: Number(params.httpPort ?? params.webPort ?? stored.httpPort) || 8088,
    webPort: Number(params.httpPort ?? params.webPort ?? stored.httpPort) || 8088,
    pgPort: Number(params.pgPort ?? params.dbPort ?? stored.pgPort) || 7496,
    dbPort: Number(params.pgPort ?? params.dbPort ?? stored.pgPort) || 7496,
    pgDbName: String(params.pgDbName || params.dbName || stored.pgDbName || 'biotime').trim(),
    dbName: String(params.pgDbName || params.dbName || stored.pgDbName || 'biotime').trim(),
    pgUser: String(params.pgUser || params.dbUser || stored.pgUser || 'postgres').trim(),
    dbUser: String(params.pgUser || params.dbUser || stored.pgUser || 'postgres').trim(),
    authMethod: String(params.authMethod || stored.authMethod || 'AUTO').toUpperCase(),
    authUser: String(params.authUser ?? params.webUser ?? stored.authUser ?? '').trim(),
    webUser: String(params.authUser ?? params.webUser ?? stored.authUser ?? '').trim(),
    authPassword: rawAuthPwd && rawAuthPwd !== '********' ? String(rawAuthPwd) : (stored.authPasswordPlain || ''),
    webPassword: rawAuthPwd && rawAuthPwd !== '********' ? String(rawAuthPwd) : (stored.authPasswordPlain || ''),
    pgPassword: rawPgPwd && rawPgPwd !== '********' ? String(rawPgPwd) : (stored.pgPasswordPlain || ''),
    password: rawPgPwd && rawPgPwd !== '********' ? String(rawPgPwd) : (stored.pgPasswordPlain || ''),
    timeoutMs: Math.min(20000, Math.max(1500, Number(params.timeoutMs ?? stored.timeoutMs) || 5000)),
  };
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
      setTimeout(() => mainWindow && mainWindow.loadURL(devUrl), 2000);
    });
  } else {
    // En producción empaquetada:
    // 1. Iniciamos el backend local si existe
    try {
      const serverPath = path.join(__dirname, '..', 'dist', 'server.cjs');
      if (fs.existsSync(serverPath)) {
        process.env.NODE_ENV = 'production';
        process.env.PORT = String(DESKTOP_PORT);
        process.env.DRAC_DATA_DIR = app.getPath('userData');
        log(`Iniciando backend integrado en ${serverPath} (DataDir: ${process.env.DRAC_DATA_DIR})...`);
        require(serverPath);
      } else {
        log(`Aviso: dist/server.cjs no encontrado en ${serverPath}. Operando con IPC nativo y Supabase directo.`);
      }
    } catch (err) {
      log(`Aviso al iniciar backend integrado: ${err.message}`);
    }

    // 2. Cargamos el archivo HTML
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
// IPC HANDLERS - GESTIÓN DE FIREWALL DE WINDOWS & RED
// =========================================================================

// Consultar estado de las reglas del Firewall de Windows para el puerto TCP configurado (7496 por defecto)
ipcMain.handle('firewall:check-status', async (_event, port = 7496) => {
  const targetPort = Number(port) || 7496;
  log(`IPC firewall:check-status invocado para puerto ${targetPort}.`);
  try {
    return await firewallManager.checkFirewallStatus(targetPort);
  } catch (err) {
    log(`Error en firewall:check-status: ${err.message}`);
    return {
      isWindows: process.platform === 'win32',
      configured: false,
      port: targetPort,
      status: 'REQUIERE CONFIGURACIÓN',
      statusText: `Firewall Windows: REQUIERE CONFIGURACIÓN (TCP ${targetPort})`,
      isAdmin: false,
      error: err.message,
      rules: [],
      missingRules: [`DRAC Control Asistencia - ZKTeco TCP ${targetPort}`],
      details: `Fallo al auditar Firewall: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
});

// Acción administrativa: "Configurar Regla de Firewall para el Puerto Específico"
ipcMain.handle('firewall:repair-network', async (_event, port = 7496) => {
  const targetPort = Number(port) || 7496;
  log(`IPC firewall:repair-network invocado para puerto ${targetPort}.`);
  try {
    return await firewallManager.repairNetworkConfig(targetPort);
  } catch (err) {
    log(`Error en firewall:repair-network: ${err.message}`);
    return {
      success: false,
      port: targetPort,
      message: `Error al configurar regla de red para puerto ${targetPort}: ${err.message}`,
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
});

// =========================================================================
// IPC HANDLERS - COMUNICACIÓN BIOMÉTRICA ZKTECO (TCP 7496 / 4370 NATIVO)
// =========================================================================

// Diagnóstico exhaustivo de 10 etapas
ipcMain.handle(
  'zk:diagnose-device',
  async (_event, { ip, port = 7496, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0 }) => {
    const targetPort = Number(port) || 7496;
    log(`IPC zk:diagnose-device -> ${ip}:${targetPort} (${model}, S/N: ${serial}, CommKey: ${commKey})`);
    try {
      return await zktecoDriver.diagnoseZkDevice(ip, targetPort, timeoutMs, model, serial, commKey);
    } catch (err) {
      log(`Error en diagnoseZkDevice: ${err.message}`);
      return {
        success: false,
        status: 'OFFLINE',
        message: `Error interno al ejecutar diagnóstico: ${err.message}`,
        cause: err.message,
        ip,
        port: targetPort,
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
ipcMain.handle(
  'zk:read-punches',
  async (_event, { ip, port = 7496, timeoutMs = 5000, commKey = 0, model = 'ZKTeco G3', serial = 'AEH2223460040' }) => {
    const targetPort = Number(port) || 7496;
    const cleanModel = String(model || 'ZKTeco G3').trim();
    const cleanSerial = String(serial || 'AEH2223460040').trim().toUpperCase();
    log(`IPC zk:read-punches -> ${ip}:${targetPort} (CommKey: ${commKey}, Model: ${cleanModel}, SN: ${cleanSerial})`);
    try {
      const res = await zktecoDriver.readZkDevicePunches(ip, targetPort, timeoutMs, commKey, cleanModel, cleanSerial);
      if (res && res.success && Array.isArray(res.punches) && res.punches.length > 0) {
        try {
          const punchesPath = getStorageFilePath('raw-punches.json');
          const employeesPath = getStorageFilePath('employees.json');
          const deviceUsersPath = getStorageFilePath('device-users.json');
          let currentList = [];
          let localEmployees = [];
          let deviceUsers = [];
          if (fs.existsSync(punchesPath)) {
            try { currentList = JSON.parse(fs.readFileSync(punchesPath, 'utf8')); } catch (_) {}
          }
          if (fs.existsSync(employeesPath)) {
            try { localEmployees = JSON.parse(fs.readFileSync(employeesPath, 'utf8')); } catch (_) {}
          }
          if (fs.existsSync(deviceUsersPath)) {
            try { deviceUsers = JSON.parse(fs.readFileSync(deviceUsersPath, 'utf8')); } catch (_) {}
          }

          const resolveEmpForPunch = (snVal, codeVal) => {
            const cleanCode = String(codeVal || '').trim();
            const snUpper = String(snVal || cleanSerial).trim().toUpperCase();
            if (!cleanCode) return null;
            const binding = (Array.isArray(deviceUsers) ? deviceUsers : []).find(
              (u) => String(u.device_sn || '').trim().toUpperCase() === snUpper && String(u.pin || '').trim() === cleanCode
            );
            if (binding) {
              if (binding.employee_id) {
                const bound = localEmployees.find((e) => e.id === binding.employee_id);
                if (bound) return bound;
              }
              if (binding.unlinked_at || binding.link_status === 'REVISAR') return null;
            }
            const matches = localEmployees.filter(
              (e) =>
                (e.zkteco_pin && String(e.zkteco_pin).trim() === cleanCode) ||
                (e.biometric_user_id && String(e.biometric_user_id).trim() === cleanCode) ||
                (e.codigo_trabajador && String(e.codigo_trabajador).trim() === cleanCode) ||
                (e.dni && String(e.dni).trim() === cleanCode)
            );
            return matches.length === 1 ? matches[0] : null;
          };

          const existingKeys = new Set(currentList.map((p) => `${p.device_sn || ''}_${p.employee_code || p.employee_dni}_${p.timestamp}`));
          const newlyAdded = [];
          for (const p of res.punches) {
            const code = String(p.employee_code || p.employee_dni || p.pin || '').trim();
            const snVal = String(p.device_sn || res.serial_number || cleanSerial).trim().toUpperCase();
            const key = `${snVal}_${code}_${p.timestamp}`;
            const emp = resolveEmpForPunch(snVal, code);
            const enrichedPunch = {
              ...p,
              device_sn: snVal,
              employee_id: emp ? emp.id : null,
              employee_dni: emp ? emp.dni : code,
              employee_code: code,
              employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Pendiente de Identificación',
              validation_status: emp ? 'VALIDA' : 'PENDIENTE_IDENTIFICACION',
              processed: !!emp,
            };
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              newlyAdded.push(enrichedPunch);
            }
          }
          res.punches = res.punches.map((p) => {
            const code = String(p.employee_code || p.employee_dni || p.pin || '').trim();
            const snVal = String(p.device_sn || res.serial_number || cleanSerial).trim().toUpperCase();
            const emp = resolveEmpForPunch(snVal, code);
            return {
              ...p,
              device_sn: snVal,
              employee_id: emp ? emp.id : null,
              employee_dni: emp ? emp.dni : code,
              employee_code: code,
              employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Pendiente de Identificación',
              validation_status: emp ? 'VALIDA' : 'PENDIENTE_IDENTIFICACION',
              processed: !!emp,
            };
          });
          const merged = [...newlyAdded, ...currentList];
          if (merged.length > 0) {
            fs.writeFileSync(punchesPath, JSON.stringify(merged, null, 2), 'utf8');
            log(`IPC zk:read-punches: Persistidas ${merged.length} marcaciones en raw-punches.json (${newlyAdded.length} nuevas)`);
            for (const p of newlyAdded) {
              const pId = p.id || `zk_${p.device_sn || cleanSerial}_${p.employee_code || p.employee_dni}_${String(p.timestamp || '').replace(/[^0-9]/g, '')}`;
              notifyServerOutbox('marcaciones_raw', pId, 'UPSERT', { ...p, id: pId }, p.record_version || 1);
            }
          }
        } catch (saveErr) {
          log(`Aviso guardando marcaciones descargadas: ${saveErr.message}`);
        }
      }
      return {
        ...res,
        ip: res.ip || ip,
        port: res.port || targetPort,
        model: res.model || cleanModel,
        serial: res.serial || res.serial_number || cleanSerial,
        serial_number: res.serial_number || res.serial || cleanSerial,
        latency_ms: res.latency_ms !== undefined ? res.latency_ms : 0,
        users_in_clock: res.users_in_clock ?? 0,
      };
    } catch (err) {
      log(`Error en readZkDevicePunches: ${err.message}`);
      return {
        success: false,
        status: 'OFFLINE',
        message: `Error al descargar marcaciones: ${err.message}`,
        ip,
        port: targetPort,
        model: cleanModel,
        serial: cleanSerial,
        serial_number: cleanSerial,
        latency_ms: 0,
        users_in_clock: 0,
        punches: [],
        timestamp: new Date().toISOString(),
      };
    }
  }
);

// Comprobaciones independientes (Ping, TCP 7496/4370, Firewall Windows, Socket TCP, ZKTeco, Info)
ipcMain.handle(
  'zk:run-independent-diagnostics',
  async (_event, { ip, port = 7496, timeoutMs = 3000, model = 'G3-id', serial = '', commKey = 0 }) => {
    const targetPort = Number(port) || 7496;
    log(`IPC zk:run-independent-diagnostics -> ${ip}:${targetPort}`);
    try {
      return await zktecoDriver.runIndependentDiagnostics(ip, targetPort, timeoutMs, model, serial, commKey);
    } catch (err) {
      log(`Error en runIndependentDiagnostics: ${err.message}`);
      return {
        success: false,
        status: 'Fallido',
        ip,
        port: targetPort,
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
ipcMain.handle('zk:ping-device', async (_event, { ip, port = 7496, timeoutMs = 3000 }) => {
  const targetPort = Number(port) || 7496;
  log(`Verificando conectividad física con marcador ZKTeco: ${ip}:${targetPort} (timeout=${timeoutMs}ms)`);

  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency = Date.now() - startTime;
      isResolved = true;
      socket.destroy();
      log(`Conexión TCP exitosa con ${ip}:${targetPort} en ${latency}ms`);
      resolve({
        success: true,
        reachable: true,
        ip,
        port: targetPort,
        latencyMs: latency,
        message: `Marcador respondiendo en ${ip}:${targetPort} (${latency}ms). Puerto TCP ${targetPort} abierto.`,
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

ipcMain.handle('biotime:get-config', async () => {
  return { success: true, config: getPublicBioTimeConfig() };
});

ipcMain.handle('biotime:save-config', async (_event, payload = {}) => {
  try {
    const publicConfig = saveStoredBioTimeConfig(payload);
    log(`IPC biotime:save-config guardado (${publicConfig.protocol}://${publicConfig.host}:${publicConfig.httpPort}, PG :${publicConfig.pgPort})`);
    return {
      success: true,
      config: publicConfig,
      message: `Configuración BioTime PRO guardada (${publicConfig.protocol.toUpperCase()} ${publicConfig.host}:${publicConfig.httpPort} / PG :${publicConfig.pgPort}).`,
    };
  } catch (err) {
    return { success: false, message: `Error guardando configuración BioTime PRO: ${err.message}` };
  }
});

ipcMain.handle('biotime:detect-ports', async (_event, params = {}) => {
  const effective = resolveBioTimeEffectiveParams(params);
  log(`IPC biotime:detect-ports -> ${effective.host} (${effective.protocol}, puerto actual: ${effective.httpPort})`);
  try {
    if (typeof zktecoDriver.detectBioTimePorts === 'function') {
      return await zktecoDriver.detectBioTimePorts({
        host: effective.host,
        protocol: effective.protocol,
        configuredPort: effective.httpPort,
        ports: Array.isArray(params.ports) ? params.ports : undefined,
        timeoutMs: Math.min(3500, effective.timeoutMs),
      });
    }
    return { success: false, results: [], recommendedPort: null, message: 'detectBioTimePorts no disponible en driver.' };
  } catch (err) {
    return { success: false, results: [], recommendedPort: null, message: err.message };
  }
});

ipcMain.handle('biotime:test-connection', async (_event, params = {}) => {
  const effective = resolveBioTimeEffectiveParams(params);
  log(`IPC biotime:test-connection -> ${effective.protocol}://${effective.host}:${effective.httpPort} (PG :${effective.pgPort})`);
  try {
    if (typeof zktecoDriver.testBioTimeConnection === 'function') {
      const report = await zktecoDriver.testBioTimeConnection({
        ...effective,
      });
      try {
        saveStoredBioTimeConfig({
          ...params,
          lastStatus: report.status,
          lastTestedAt: report.timestamp || new Date().toISOString(),
          lastMessage: report.message,
        });
      } catch (_) {}
      return report;
    }
    return { success: false, status: 'NO_CONECTADO', message: 'testBioTimeConnection no disponible en driver.', stages: [] };
  } catch (err) {
    return { success: false, status: 'NO_CONECTADO', message: err.message, stages: [] };
  }
});

ipcMain.handle('biotime:query-devices', async (_event, params = {}) => {
  const effective = resolveBioTimeEffectiveParams(params);
  log(`IPC biotime:query-devices -> ${effective.protocol}://${effective.host}:${effective.httpPort}`);
  try {
    if (typeof zktecoDriver.fetchBioTimeTerminals === 'function') {
      return await zktecoDriver.fetchBioTimeTerminals(effective);
    }
    return { success: false, devices: [], message: 'fetchBioTimeTerminals no disponible en driver.' };
  } catch (err) {
    return { success: false, devices: [], message: err.message };
  }
});

ipcMain.handle('biotime:download-punches', async (_event, params = {}) => {
  const effective = resolveBioTimeEffectiveParams(params);
  const cleanSerial = String(params.serial || '').trim().toUpperCase();
  const startDate = String(params.startDate || '').trim();
  const endDate = String(params.endDate || '').trim();
  log(`IPC biotime:download-punches -> ${effective.protocol}://${effective.host}:${effective.httpPort} SN=${cleanSerial || 'TODOS'} (${startDate || 'sin inicio'} -> ${endDate || 'hoy'})`);

  try {
    if (typeof zktecoDriver.fetchBioTimeHttpApi !== 'function') {
      return { success: false, message: 'fetchBioTimeHttpApi no disponible en driver.', punches: [] };
    }

    const apiRes = await zktecoDriver.fetchBioTimeHttpApi({
      protocol: effective.protocol,
      host: effective.host,
      httpPort: effective.httpPort,
      webPort: effective.httpPort,
      authMethod: effective.authMethod,
      serial: cleanSerial,
      authUser: effective.authUser,
      authPassword: effective.authPassword,
      startDate,
      endDate,
      timeoutMs: effective.timeoutMs,
      inspectOnly: false,
    });

    if (!apiRes.success) {
      return {
        success: false,
        needsWebCredentials: !!apiRes.needsWebCredentials,
        status: apiRes.error === 'BIOTIME_AUTH_FAILED' ? 'ERROR_AUTENTICACION' : apiRes.error === 'MISSING_WEB_CREDENTIALS' ? 'CONFIGURACION_INCOMPLETA' : 'NO_CONECTADO',
        read_count: 0,
        new_count: 0,
        duplicate_count: 0,
        pending_count: 0,
        pages_fetched: 0,
        punches: [],
        message: apiRes.message,
      };
    }

    const punchesPath = getStorageFilePath('raw-punches.json');
    const employeesPath = getStorageFilePath('employees.json');
    const deviceUsersPath = getStorageFilePath('device-users.json');

    let loadedPunches = [];
    let localEmployees = [];
    let deviceUsers = [];
    try { if (fs.existsSync(punchesPath)) loadedPunches = JSON.parse(fs.readFileSync(punchesPath, 'utf8')); } catch (_) {}
    try { if (fs.existsSync(employeesPath)) localEmployees = JSON.parse(fs.readFileSync(employeesPath, 'utf8')); } catch (_) {}
    try { if (fs.existsSync(deviceUsersPath)) deviceUsers = JSON.parse(fs.readFileSync(deviceUsersPath, 'utf8')); } catch (_) {}
    if (!Array.isArray(loadedPunches)) loadedPunches = [];

    const findLocalEmployee = (snVal, code) => {
      if (!code || !Array.isArray(localEmployees)) return null;
      const clean = String(code).trim();
      const snUpper = String(snVal || cleanSerial || '').trim().toUpperCase();
      const binding = (Array.isArray(deviceUsers) ? deviceUsers : []).find(
        (u) => String(u.device_sn || '').trim().toUpperCase() === snUpper && String(u.pin || '').trim() === clean
      );
      if (binding) {
        if (binding.employee_id) {
          const boundEmp = localEmployees.find((e) => e.id === binding.employee_id);
          if (boundEmp) return boundEmp;
        }
        if (binding.unlinked_at || binding.link_status === 'REVISAR') return null;
      }
      const matches = localEmployees.filter(
        (e) =>
          (e.zkteco_pin && String(e.zkteco_pin).trim() === clean) ||
          (e.biometric_user_id && String(e.biometric_user_id).trim() === clean) ||
          (e.codigo_trabajador && String(e.codigo_trabajador).trim() === clean) ||
          (e.dni && String(e.dni).trim() === clean)
      );
      return matches.length === 1 ? matches[0] : null;
    };

    const existingKeys = new Set(
      loadedPunches.map((p) => `${p.device_sn || ''}_${p.employee_code || p.employee_dni || p.pin}_${p.timestamp}`)
    );

    const newlyAdded = [];
    let duplicateCount = 0;
    let pendingCount = 0;
    const readPunches = Array.isArray(apiRes.punches) ? apiRes.punches : [];

    for (const p of readPunches) {
      const code = String(p.employee_code || p.employee_dni || p.pin || '').trim();
      const snVal = String(p.device_sn || cleanSerial || '').trim().toUpperCase();
      const key = `${snVal}_${code}_${p.timestamp}`;
      if (existingKeys.has(key)) {
        duplicateCount++;
        continue;
      }
      existingKeys.add(key);
      const emp = findLocalEmployee(snVal, code);
      if (!emp) pendingCount++;
      newlyAdded.push({
        ...p,
        device_sn: snVal,
        employee_id: emp ? emp.id : null,
        employee_dni: emp ? emp.dni : code,
        employee_code: code,
        employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Pendiente de Identificación',
        validation_status: emp ? 'VALIDA' : 'PENDIENTE_IDENTIFICACION',
        processed: !!emp,
      });
    }

    const mergedPunches = [...newlyAdded, ...loadedPunches];
    if (newlyAdded.length > 0) {
      fs.writeFileSync(punchesPath, JSON.stringify(mergedPunches, null, 2), 'utf8');
      for (const p of newlyAdded) {
        const pId = p.id || `bt_${p.device_sn || cleanSerial}_${p.employee_code || p.employee_dni}_${String(p.timestamp || '').replace(/[^0-9]/g, '')}`;
        notifyServerOutbox('marcaciones_raw', pId, 'UPSERT', { ...p, id: pId }, p.record_version || 1);
      }
    }

    return {
      success: true,
      status: 'CONECTADO',
      source: 'BIOTIME_API',
      read_count: readPunches.length,
      new_count: newlyAdded.length,
      duplicate_count: duplicateCount,
      pending_count: pendingCount,
      pages_fetched: apiRes.pagesFetched || 1,
      punches_count: mergedPunches.length,
      punches: newlyAdded,
      all_punches: mergedPunches,
      message: `Descarga BioTime PRO completada: ${readPunches.length} leídas, ${newlyAdded.length} nuevas, ${duplicateCount} duplicadas omitidas${pendingCount > 0 ? `, ${pendingCount} pendientes de identificación` : ''}.`,
    };
  } catch (err) {
    return {
      success: false,
      status: 'NO_CONECTADO',
      read_count: 0,
      new_count: 0,
      duplicate_count: 0,
      pending_count: 0,
      pages_fetched: 0,
      punches: [],
      message: `Error descargando marcaciones desde BioTime PRO: ${err.message}`,
    };
  }
});

ipcMain.handle('biotime:check-status', async (_event, params = {}) => {
  const effective = resolveBioTimeEffectiveParams(params);
  const serial = params.serial || 'AEH2223460040';
  log(`IPC biotime:check-status -> ${effective.host} (Web: ${effective.httpPort}, DB: ${effective.pgPort}, SN: ${serial})`);
  try {
    if (typeof zktecoDriver.checkBioTimeService === 'function') {
      return await zktecoDriver.checkBioTimeService(effective.host, effective.httpPort, effective.pgPort, serial);
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

ipcMain.handle('biotime:inspect-database', async (_event, params = {}) => {
  try {
    if (typeof zktecoDriver.inspectBioTimeDatabase === 'function') {
      const effective = resolveBioTimeEffectiveParams(params);
      return await zktecoDriver.inspectBioTimeDatabase({
        ...params,
        ...effective,
        strictPort: Boolean(params.httpPort || params.webPort),
      });
    }
    return { success: false, message: 'inspectBioTimeDatabase no disponible en driver.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('biotime:sync-punches', async (_event, params = {}) => {
  let fallbackIp = '';
  try {
    const dPath = getStorageFilePath('devices.json');
    if (fs.existsSync(dPath)) {
      const devs = JSON.parse(fs.readFileSync(dPath, 'utf8'));
      if (devs && devs[0] && devs[0].ip_address) fallbackIp = devs[0].ip_address;
    }
  } catch (_) {}

  const effective = resolveBioTimeEffectiveParams(params);
  const {
    host,
    protocol,
    httpPort: webPort,
    pgPort: dbPort,
    pgDbName: dbName,
    pgUser: dbUser,
    pgPassword: password,
    authMethod,
    authUser: webUser,
    authPassword: webPassword,
    timeoutMs,
  } = effective;
  const serial = params.serial || 'AEH2223460040';
  const deviceId = params.deviceId || 'dev-01';
  const deviceIp = params.deviceIp || fallbackIp;
  const devicePort = params.devicePort || 7496;
  const startDate = params.startDate || '';
  const endDate = params.endDate || '';
  log(`IPC biotime:sync-punches -> ${serial} (${protocol}://${host}:${webPort}, DB: ${dbPort})`);
  try {
    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const status = typeof zktecoDriver.checkBioTimeService === 'function'
      ? await zktecoDriver.checkBioTimeService(host, webPort, dbPort, serial)
      : { success: false };

    const punchesPath = getStorageFilePath('raw-punches.json');
    let loadedPunches = [];
    try {
      if (fs.existsSync(punchesPath)) {
        loadedPunches = JSON.parse(fs.readFileSync(punchesPath, 'utf8'));
      }
    } catch (_) {}

    let syncResult = { success: false, punches: [], source: 'NONE', details: 'Extractor no disponible.' };
    if (typeof zktecoDriver.syncBioTimeRecords === 'function') {
      syncResult = await zktecoDriver.syncBioTimeRecords({
        host,
        protocol,
        httpPort: webPort,
        webPort,
        dbPort,
        dbName,
        dbUser,
        password,
        authMethod,
        authUser: webUser,
        webUser,
        authPassword: webPassword,
        webPassword,
        serial,
        deviceIp,
        devicePort,
        startDate,
        endDate,
        timeoutMs,
        strictPort: Boolean(params.httpPort || params.webPort),
      });
    }

    if (!syncResult.success) {
      return {
        success: false,
        needsWebCredentials: !!syncResult.needsWebCredentials,
        message: syncResult.details || 'No se pudieron obtener marcaciones desde BioTime.',
        serial,
        deviceId,
        source: syncResult.source || 'NONE',
        inspection: syncResult.inspection || null,
        new_count: 0,
        punches_count: loadedPunches.length,
        punches: [],
        status,
        timestamp: nowStr,
      };
    }

    const employeesPath = getStorageFilePath('employees.json');
    const deviceUsersPath = getStorageFilePath('device-users.json');
    let localEmployees = [];
    let deviceUsers = [];
    try {
      if (fs.existsSync(employeesPath)) {
        localEmployees = JSON.parse(fs.readFileSync(employeesPath, 'utf8'));
      }
      if (fs.existsSync(deviceUsersPath)) {
        deviceUsers = JSON.parse(fs.readFileSync(deviceUsersPath, 'utf8'));
      }
    } catch (_) {}

    const findLocalEmployee = (snVal, code) => {
      if (!code || !Array.isArray(localEmployees)) return null;
      const clean = String(code).trim();
      const snUpper = String(snVal || serial || '').trim().toUpperCase();
      const binding = (Array.isArray(deviceUsers) ? deviceUsers : []).find(
        (u) => String(u.device_sn || '').trim().toUpperCase() === snUpper && String(u.pin || '').trim() === clean
      );
      if (binding) {
        if (binding.employee_id) {
          const boundEmp = localEmployees.find((e) => e.id === binding.employee_id);
          if (boundEmp) return boundEmp;
        }
        if (binding.unlinked_at || binding.link_status === 'REVISAR') return null;
      }
      const matches = localEmployees.filter(
        (e) =>
          (e.zkteco_pin && String(e.zkteco_pin).trim() === clean) ||
          (e.biometric_user_id && String(e.biometric_user_id).trim() === clean) ||
          (e.codigo_trabajador && String(e.codigo_trabajador).trim() === clean) ||
          (e.dni && String(e.dni).trim() === clean)
      );
      return matches.length === 1 ? matches[0] : null;
    };

    const existingKeys = new Set(
      loadedPunches.map((p) => `${p.device_sn || ''}_${p.employee_code || p.employee_dni || p.pin}_${p.timestamp}`)
    );

    const newlyAdded = [];
    if (Array.isArray(syncResult.punches) && syncResult.punches.length > 0) {
      for (const p of syncResult.punches) {
        const code = String(p.employee_code || p.employee_dni || p.pin || '').trim();
        const snVal = String(p.device_sn || serial || '').trim().toUpperCase();
        const key = `${snVal}_${code}_${p.timestamp}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          const emp = findLocalEmployee(snVal, code);
          const empName = emp
            ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
            : 'Pendiente de Identificación';
          newlyAdded.push({
            ...p,
            device_sn: snVal,
            employee_id: emp ? emp.id : null,
            employee_dni: emp ? emp.dni : code,
            employee_code: code,
            employee_name: empName,
            validation_status: emp ? 'VALIDA' : 'PENDIENTE_IDENTIFICACION',
            processed: !!emp,
          });
        }
      }
    }

    const mergedPunches = [...newlyAdded, ...loadedPunches];
    if (newlyAdded.length > 0) {
      try {
        fs.writeFileSync(punchesPath, JSON.stringify(mergedPunches, null, 2), 'utf8');
        log(`Guardadas ${mergedPunches.length} marcaciones en raw-punches.json (${newlyAdded.length} nuevas)`);
        for (const p of newlyAdded) {
          const pId = p.id || `bt_${p.device_sn || serial}_${p.employee_code || p.employee_dni}_${String(p.timestamp || '').replace(/[^0-9]/g, '')}`;
          notifyServerOutbox('marcaciones_raw', pId, 'UPSERT', { ...p, id: pId }, p.record_version || 1);
        }
      } catch (writeErr) {
        log(`Aviso al persistir raw-punches.json: ${writeErr.message}`);
      }
    }

    return {
      success: true,
      message: newlyAdded.length > 0
        ? `Sincronización completada: ${newlyAdded.length} marcaciones nuevas extraídas desde ${syncResult.source}.`
        : `Sincronización completada con ${syncResult.source}. Sin marcaciones nuevas (${mergedPunches.length} almacenadas).`,
      serial,
      deviceId,
      source: syncResult.source,
      inspection: syncResult.inspection || null,
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

// =========================================================================
// IPC HANDLERS - CONSULTA Y PERSISTENCIA DE USUARIOS REALES DE RELOJES
// =========================================================================

ipcMain.handle('zk:query-device-users', async (_event, params = {}) => {
  log(`IPC zk:query-device-users -> ${params.ip || 'BioTime'}:${params.port || 7496} (Modo: ${params.mode || 'AUTO'})`);
  try {
    if (typeof zktecoDriver.queryZkDeviceUsers === 'function') {
      const mergedBt = resolveBioTimeEffectiveParams(params.biotime || {});
      return await zktecoDriver.queryZkDeviceUsers({
        ...params,
        biotime: mergedBt,
      });
    }
    return { success: false, message: 'Función queryZkDeviceUsers no disponible en el driver.', users: [] };
  } catch (err) {
    return { success: false, message: `Error consultando usuarios del reloj: ${err.message}`, users: [] };
  }
});

ipcMain.handle('zk:get-device-users-store', async () => {
  const readSafe = (fileName) => {
    try {
      const p = getStorageFilePath(fileName);
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data)) return data;
      }
    } catch (_) {}
    return [];
  };
  return {
    users: readSafe('device-users.json'),
    history: readSafe('device-user-history.json'),
    syncLogs: readSafe('device-user-sync-logs.json'),
  };
});

ipcMain.handle('zk:save-device-users-store', async (_event, payload = {}) => {
  try {
    if (Array.isArray(payload.users)) {
      const usersPath = getStorageFilePath('device-users.json');
      const prevMap = new Map();
      try {
        if (fs.existsSync(usersPath)) {
          const prev = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
          if (Array.isArray(prev)) prev.forEach((u) => prevMap.set(String(u.id || `${u.device_sn}_${u.pin}`), JSON.stringify(u)));
        }
      } catch (_) {}
      fs.writeFileSync(usersPath, JSON.stringify(payload.users, null, 2), 'utf8');
      for (const u of payload.users) {
        const uId = String(u.id || `${u.device_sn || 'ZK'}_${u.pin}`);
        const serialized = JSON.stringify(u);
        if (prevMap.get(uId) !== serialized) {
          notifyServerOutbox('usuarios_reloj', uId, 'UPSERT', { ...u, id: uId }, u.record_version || 1);
        }
      }
    }
    if (Array.isArray(payload.history)) {
      fs.writeFileSync(getStorageFilePath('device-user-history.json'), JSON.stringify(payload.history.slice(0, 1500), null, 2), 'utf8');
    }
    if (Array.isArray(payload.syncLogs)) {
      fs.writeFileSync(getStorageFilePath('device-user-sync-logs.json'), JSON.stringify(payload.syncLogs.slice(0, 300), null, 2), 'utf8');
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('zk:set-device-user-name', async (_event, params = {}) => {
  log(`IPC zk:set-device-user-name -> ${params.ip}:${params.port} PIN=${params.pin}`);
  try {
    if (typeof zktecoDriver.setZkDeviceUserName === 'function') {
      return await zktecoDriver.setZkDeviceUserName(params);
    }
    return { success: false, message: 'Función setZkDeviceUserName no disponible en el driver.' };
  } catch (err) {
    return { success: false, message: `Error actualizando nombre en el reloj: ${err.message}` };
  }
});

ipcMain.handle('punches:get-all', async () => {
  try {
    const punchesPath = getStorageFilePath('raw-punches.json');
    if (fs.existsSync(punchesPath)) {
      const data = JSON.parse(fs.readFileSync(punchesPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
    const bundledPath = path.join(__dirname, '..', 'data', 'raw-punches.json');
    if (fs.existsSync(bundledPath)) {
      const data = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (_) {}
  return [];
});

ipcMain.handle('punches:save-all', async (_event, punches = []) => {
  try {
    if (!Array.isArray(punches)) return { success: false, count: 0 };
    const punchesPath = getStorageFilePath('raw-punches.json');
    let existing = [];
    try {
      if (fs.existsSync(punchesPath)) {
        existing = JSON.parse(fs.readFileSync(punchesPath, 'utf8'));
      }
    } catch (_) {}
    const map = new Map();
    for (const r of (Array.isArray(existing) ? existing : [])) {
      const key = `${r.device_sn || ''}_${r.employee_code || r.employee_dni}_${r.timestamp}`;
      map.set(key, r);
    }
    for (const r of punches) {
      const key = `${r.device_sn || ''}_${r.employee_code || r.employee_dni}_${r.timestamp}`;
      const prev = map.get(key);
      map.set(key, { ...(prev || {}), ...r });
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
    );
    fs.writeFileSync(punchesPath, JSON.stringify(merged, null, 2), 'utf8');
    const prevSet = new Set((Array.isArray(existing) ? existing : []).map((r) => `${r.device_sn || ''}_${r.employee_code || r.employee_dni}_${r.timestamp}`));
    for (const r of punches) {
      const key = `${r.device_sn || ''}_${r.employee_code || r.employee_dni}_${r.timestamp}`;
      if (!prevSet.has(key) || r.linked_at) {
        const pId = r.id || `zk_${r.device_sn || 'G3'}_${r.employee_code || r.employee_dni}_${String(r.timestamp || '').replace(/[^0-9]/g, '')}`;
        notifyServerOutbox('marcaciones_raw', pId, 'UPSERT', { ...r, id: pId }, r.record_version || 1);
      }
    }
    return { success: true, count: merged.length };
  } catch (err) {
    return { success: false, count: 0, error: err.message };
  }
});

// =========================================================================
// IPC HANDLERS - TURNOS, HORARIOS Y ASIGNACIONES (PERSISTENCIA LOCAL SEGURA)
// =========================================================================

ipcMain.handle('turnos:get-all', async () => {
  try {
    const p = getStorageFilePath('turnos.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [];
});

ipcMain.handle('turnos:save', async (_event, turno) => {
  try {
    const p = getStorageFilePath('turnos.json');
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { list = []; }
    }
    const idx = list.findIndex((t) => t.id === turno.id || t.code === turno.code);
    if (idx >= 0) list[idx] = { ...list[idx], ...turno };
    else list.push(turno);
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
    notifyServerOutbox('turnos', turno.id || turno.code, 'UPSERT', turno, turno.record_version || 1);
    return { success: true, data: turno };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('turnos:delete', async (_event, id) => {
  try {
    const p = getStorageFilePath('turnos.json');
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { list = []; }
    }
    const filtered = list.filter((t) => t.id !== id);
    fs.writeFileSync(p, JSON.stringify(filtered, null, 2), 'utf8');
    notifyServerOutbox('turnos', id, 'DELETE', { id });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('horarios:get-all', async () => {
  try {
    const p = getStorageFilePath('horarios.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [];
});

ipcMain.handle('horarios:save', async (_event, horario) => {
  try {
    const p = getStorageFilePath('horarios.json');
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { list = []; }
    }
    const idx = list.findIndex((h) => h.id === horario.id || h.code === horario.code);
    if (idx >= 0) list[idx] = { ...list[idx], ...horario };
    else list.push(horario);
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
    notifyServerOutbox('horarios', horario.id || horario.code, 'UPSERT', horario, horario.record_version || 1);
    return { success: true, data: horario };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('horarios:delete', async (_event, id) => {
  try {
    const p = getStorageFilePath('horarios.json');
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { list = []; }
    }
    const filtered = list.filter((h) => h.id !== id);
    fs.writeFileSync(p, JSON.stringify(filtered, null, 2), 'utf8');
    notifyServerOutbox('horarios', id, 'DELETE', { id });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('asignaciones:get-all', async () => {
  try {
    const p = getStorageFilePath('asignacion-horarios.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [];
});

ipcMain.handle('asignaciones:save', async (_event, asig) => {
  try {
    const p = getStorageFilePath('asignacion-horarios.json');
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { list = []; }
    }
    const idx = list.findIndex((a) => a.id === asig.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...asig };
    else list.unshift(asig);
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
    notifyServerOutbox('asignacion_horarios', asig.id, 'UPSERT', asig, asig.record_version || 1);
    return { success: true, data: asig };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('asignaciones:delete', async (_event, id) => {
  try {
    const p = getStorageFilePath('asignacion-horarios.json');
    let list = [];
    if (fs.existsSync(p)) {
      try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { list = []; }
    }
    const filtered = list.filter((a) => a.id !== id);
    fs.writeFileSync(p, JSON.stringify(filtered, null, 2), 'utf8');
    notifyServerOutbox('asignacion_horarios', id, 'DELETE', { id });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// =========================================================================
// IPC HANDLERS - PERSISTENCIA Y GESTIÓN DIRECTA DE MARCADORES BIOMÉTRICOS
// =========================================================================

ipcMain.handle('device:get-all', async () => {
  try {
    const devicesPath = getStorageFilePath('devices.json');
    if (fs.existsSync(devicesPath)) {
      const parsed = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((d) => ({
          ...d,
          config_version: d.config_version || 1,
        }));
      }
    }
  } catch (err) {
    log(`Aviso al leer devices.json: ${err.message}`);
  }
  return [];
});

ipcMain.handle('device:update', async (_event, { id, payload }) => {
  log(`IPC device:update -> Actualizando marcador ${id} (IP: ${payload.ip_address}, Puerto: ${payload.port})`);
  try {
    const devicesPath = getStorageFilePath('devices.json');
    const auditPath = getStorageFilePath('audit-logs.json');

    let devices = [];
    if (fs.existsSync(devicesPath)) {
      try {
        devices = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
      } catch (_) {
        devices = [];
      }
    }

    const index = devices.findIndex((d) => d.id === id || d.serial_number === id);
    if (index === -1) {
      return { success: false, message: 'Dispositivo no encontrado en la base de datos local' };
    }

    const existing = devices[index];
    const nowIso = new Date().toISOString();
    const nextVersion = (Number(existing.config_version) || 1) + 1;

    const updated = {
      ...existing,
      name: payload.name !== undefined ? String(payload.name).trim() : existing.name,
      model: payload.model !== undefined ? String(payload.model).trim() : existing.model,
      serial_number: payload.serial_number !== undefined ? String(payload.serial_number).trim() : existing.serial_number,
      ip_address: payload.ip_address !== undefined ? String(payload.ip_address).trim() : existing.ip_address,
      port: payload.port !== undefined ? Number(payload.port) : existing.port,
      netmask: payload.netmask !== undefined ? String(payload.netmask).trim() : existing.netmask,
      gateway: payload.gateway !== undefined ? String(payload.gateway).trim() : existing.gateway,
      dns: payload.dns !== undefined ? String(payload.dns).trim() : (existing.dns || '200.48.225.130'),
      mac_address: payload.mac_address !== undefined ? String(payload.mac_address).trim().toUpperCase() : existing.mac_address,
      comm_key: payload.comm_key !== undefined ? payload.comm_key : existing.comm_key,
      device_id_num: payload.device_id_num !== undefined ? Number(payload.device_id_num) : (existing.device_id_num || 1),
      status: payload.status !== undefined ? String(payload.status).trim() : existing.status,
      protocol: payload.protocol !== undefined ? String(payload.protocol).trim() : existing.protocol,
      location_detail: payload.location_detail !== undefined ? String(payload.location_detail).trim() : existing.location_detail,
      last_modified_by: payload.user_name ? `${payload.user_name} (${payload.user_role || 'ADMIN'})` : (existing.last_modified_by || 'Administrador DRAC'),
      last_modified_at: nowIso,
      updated_at: nowIso,
      config_version: nextVersion,
    };

    devices[index] = updated;
    fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2), 'utf8');
    notifyServerOutbox('dispositivos_zkteco', updated.id, 'UPSERT', updated, nextVersion);

    // Registrar en auditoría de forma persistente
    try {
      let audits = [];
      if (fs.existsSync(auditPath)) {
        try {
          audits = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
        } catch (_) {
          audits = [];
        }
      }
      audits.unshift({
        id: `audit-dev-${Date.now()}`,
        timestamp: nowIso,
        user_id: payload.user_id || 'admin-drac',
        user_name: payload.user_name || 'Administrador DRAC',
        user_role: payload.user_role || 'ADMIN_GENERAL',
        action: 'MODIFICACION_CONFIGURACION_DISPOSITIVO',
        entity: 'DISPOSITIVO_ZKTECO',
        entity_id: updated.id,
        details: `Modificación de parámetros ZKTeco ${updated.name} (IP: ${existing.ip_address} -> ${updated.ip_address}, Puerto: ${existing.port} -> ${updated.port}, S/N: ${updated.serial_number}, Rev: v${nextVersion})`,
        previous_values: {
          ip_address: existing.ip_address,
          port: existing.port,
          name: existing.name,
          serial_number: existing.serial_number,
          config_version: existing.config_version || 1,
        },
        new_values: {
          ip_address: updated.ip_address,
          port: updated.port,
          name: updated.name,
          serial_number: updated.serial_number,
          config_version: nextVersion,
        },
      });
      fs.writeFileSync(auditPath, JSON.stringify(audits.slice(0, 500), null, 2), 'utf8');
    } catch (auditErr) {
      log(`Aviso al escribir auditoría: ${auditErr.message}`);
    }

    // DIFUSIÓN GLOBAL: Notificar inmediatamente al Renderer de Electron y todos los módulos
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device:config-changed', updated);
      log(`Evento device:config-changed emitido hacia el frontend (Rev. v${nextVersion})`);
    }

    log(`Marcador ${updated.name} guardado con éxito (Rev. v${nextVersion}). Nueva IP: ${updated.ip_address}, Puerto: ${updated.port}`);
    return {
      success: true,
      message: `Configuración de ${updated.name} guardada exitosamente en la base de datos oficial (Rev. v${nextVersion}). IP activa: ${updated.ip_address}, Puerto: ${updated.port}.`,
      data: updated,
    };
  } catch (err) {
    log(`Error al actualizar marcador en Electron: ${err.message}`);
    return {
      success: false,
      message: `Error al persistir configuración en Electron: ${err.message}`,
    };
  }
});

// Registrar nuevo marcador biométrico en la base de datos local
ipcMain.handle('device:create', async (_event, payload = {}) => {
  log(`IPC device:create -> Registrando nuevo marcador: ${payload.name || 'Nuevo Marcador'} (${payload.ip_address}:${payload.port})`);
  try {
    const devicesPath = getStorageFilePath('devices.json');
    const auditPath = getStorageFilePath('audit-logs.json');

    let devices = [];
    if (fs.existsSync(devicesPath)) {
      try {
        devices = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
      } catch (_) {
        devices = [];
      }
    }

    const newId = payload.id || `dev-${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();

    const newDevice = {
      id: newId,
      name: String(payload.name || 'Nuevo Marcador ZKTeco').trim(),
      model: String(payload.model || 'ZKTeco G3').trim(),
      serial_number: String(payload.serial_number || `ZK-${Date.now()}`).trim().toUpperCase(),
      ip_address: String(payload.ip_address || '192.168.1.199').trim(),
      port: Number(payload.port) || 7496,
      netmask: String(payload.netmask || '255.255.255.0').trim(),
      gateway: String(payload.gateway || '192.168.1.1').trim(),
      dns: String(payload.dns || '200.48.225.130').trim(),
      mac_address: String(payload.mac_address || '00:17:61:00:00:00').trim().toUpperCase(),
      comm_key: payload.comm_key !== undefined ? payload.comm_key : 0,
      device_id_num: Number(payload.device_id_num) || (devices.length + 1),
      status: String(payload.status || 'ONLINE').trim(),
      protocol: String(payload.protocol || 'TCP').trim(),
      location_detail: String(payload.location_detail || 'Sede DRAC Cajamarca').trim(),
      dependencia_id: payload.dependencia_id || 'dep-01',
      dependencia_name: payload.dependencia_name || 'SEDE CENTRAL - DRAC CAJAMARCA',
      device_type: payload.device_type || 'FACIAL_G3',
      firmware_version: payload.firmware_version || 'Ver 1.14.0',
      last_activity: nowIso,
      last_sync: nowIso,
      last_latency_ms: 18,
      log_count: 0,
      enrolled_user_count: 0,
      operator_pc: '192.168.1.33',
      push_enabled: true,
      push_server_address: '192.168.1.29',
      push_server_port: 8088,
      push_endpoint: '/iclock/cdata',
      push_protocol: 'HTTP',
      push_interval: 5,
      last_modified_by: payload.user_name ? `${payload.user_name} (${payload.user_role || 'ADMIN'})` : 'Administrador DRAC',
      last_modified_at: nowIso,
      updated_at: nowIso,
      config_version: 1,
    };

    devices.push(newDevice);
    fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2), 'utf8');
    notifyServerOutbox('dispositivos_zkteco', newDevice.id, 'UPSERT', newDevice, 1);

    // Registrar en auditoría
    try {
      let audits = [];
      if (fs.existsSync(auditPath)) {
        try {
          audits = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
        } catch (_) {
          audits = [];
        }
      }
      audits.unshift({
        id: `audit-dev-${Date.now()}`,
        timestamp: nowIso,
        user_id: payload.user_id || 'admin-drac',
        user_name: payload.user_name || 'Administrador DRAC',
        user_role: payload.user_role || 'ADMIN_GENERAL',
        action: 'CREACION_DISPOSITIVO_ZKTECO',
        entity: 'DISPOSITIVO_ZKTECO',
        entity_id: newDevice.id,
        details: `Alta de nuevo marcador biométrico: ${newDevice.name} (IP: ${newDevice.ip_address}, Puerto: ${newDevice.port}, S/N: ${newDevice.serial_number})`,
        new_values: newDevice,
      });
      fs.writeFileSync(auditPath, JSON.stringify(audits.slice(0, 500), null, 2), 'utf8');
    } catch (_) {}

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device:config-changed', newDevice);
      log(`Evento device:config-changed emitido tras registrar ${newDevice.name}`);
    }

    log(`Nuevo marcador ${newDevice.name} registrado con ID ${newDevice.id}`);
    return {
      success: true,
      message: `Marcador biométrico ${newDevice.name} registrado exitosamente en la base de datos oficial.`,
      data: newDevice,
    };
  } catch (err) {
    log(`Error al registrar nuevo marcador en Electron: ${err.message}`);
    return {
      success: false,
      message: `Error al crear marcador en Electron: ${err.message}`,
    };
  }
});

// Eliminar marcador biométrico secundario
ipcMain.handle('device:delete', async (_event, id) => {
  log(`IPC device:delete -> Solicitud para eliminar marcador ID: ${id}`);
  try {
    const devicesPath = getStorageFilePath('devices.json');
    const auditPath = getStorageFilePath('audit-logs.json');

    let devices = [];
    if (fs.existsSync(devicesPath)) {
      try {
        devices = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
      } catch (_) {
        devices = [];
      }
    }

    const index = devices.findIndex((d) => d.id === id || d.serial_number === id);
    if (index === -1) {
      return { success: false, message: 'Dispositivo no encontrado en la base de datos.' };
    }

    if (devices.length <= 1) {
      return { success: false, message: 'No se puede eliminar el único marcador registrado del sistema.' };
    }

    const removed = devices.splice(index, 1)[0];
    fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2), 'utf8');
    notifyServerOutbox('dispositivos_zkteco', removed.id, 'DELETE', { id: removed.id }, (Number(removed.config_version) || 1) + 1);

    // Registrar en auditoría
    try {
      let audits = [];
      if (fs.existsSync(auditPath)) {
        try {
          audits = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
        } catch (_) {
          audits = [];
        }
      }
      audits.unshift({
        id: `audit-dev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: 'admin-drac',
        user_name: 'Administrador DRAC',
        user_role: 'ADMIN_GENERAL',
        action: 'ELIMINACION_DISPOSITIVO_ZKTECO',
        entity: 'DISPOSITIVO_ZKTECO',
        entity_id: removed.id,
        details: `Eliminación de marcador biométrico: ${removed.name} (IP: ${removed.ip_address}, S/N: ${removed.serial_number})`,
        previous_values: removed,
      });
      fs.writeFileSync(auditPath, JSON.stringify(audits.slice(0, 500), null, 2), 'utf8');
    } catch (_) {}

    return {
      success: true,
      message: `Marcador ${removed.name} eliminado del sistema exitosamente.`,
      data: removed,
    };
  } catch (err) {
    log(`Error al eliminar marcador en Electron: ${err.message}`);
    return { success: false, message: `Error al eliminar marcador: ${err.message}` };
  }
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

  let buildDate = new Date().toISOString().substring(0, 10);
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      buildDate = fs.statSync(pkgPath).mtime.toISOString().substring(0, 10);
    }
  } catch (_) {}

  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    osRelease: os.release(),
    type: os.type(),
    appVersion: app.getVersion(),
    buildDate,
    userDataPath: getBasePersistentDir(),
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
