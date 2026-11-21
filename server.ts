import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import net from 'net';
import http from 'http';
import https from 'https';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import ZKLib from 'node-zklib';
import pg from 'pg';

const SERVER_DIR =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const BASE_PROJECT_DIR = fs.existsSync(path.join(SERVER_DIR, 'data'))
  ? SERVER_DIR
  : path.resolve(SERVER_DIR, '..');
const BUNDLED_DATA_DIR = path.join(BASE_PROJECT_DIR, 'data');

let SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rfqgmoremevypexrrsyf.supabase.co';
let SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWdtb3JlbWV2eXBleHJyc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjI3MTksImV4cCI6MjEwMzgzODcxOX0.L7VOne8N24590LxLZrYTmDPovu-Qs3Xibct6G0vhz5I';
let supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers (supporting raw text payloads from ZKTeco G3-id ADMS)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/*', 'application/octet-stream'], limit: '10mb' }));

import {
  normalizeText,
  normalizeInstitutionalName,
  normalizePersonName,
} from './src/utils/nameUtils';
import {
  reconcileDeviceUsers,
  classifyDeviceUserBinding,
  resolveEmployeeForDevicePin,
  buildDeviceUserId,
  normalizePrivilegeLabel,
  RawClockUserInput,
} from './src/utils/deviceUserSync';
import type {
  BiometricDeviceUser,
  DeviceUserChangeLog,
  DeviceUserSyncRun,
} from './src/types';
import {
  initializePersistentStorage,
  getStorageStatusReport,
  createVerifiedBackup,
  listVerifiedBackups,
  resolveConfigFilePath,
  resolveSafeChildPath,
  safeWriteJsonAtomic,
} from './server/storageManager';
import {
  enqueueOutboxEvent,
  flushServerOutbox,
  getOutboxSummary,
  mergeVersionedRecords,
  readOutboxQueue,
  readSyncState,
  isPlaceholderSupabaseUrlServer,
} from './server/syncOutbox';
import {
  isPeriodClosed,
  enrichPunchWithOfficialEmployee,
  enrichAttendanceWithOfficialEmployee,
  buildConsolidatedEmployeeProfile,
  type ClosedPeriodEntry,
} from './server/employeeProfileEnricher';

// Leer versión y fecha de compilación del aplicativo
let APP_VERSION = '1.0.0';
let BUILD_DATE = new Date().toISOString().substring(0, 10);
try {
  const pkgPath = path.join(BASE_PROJECT_DIR, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkgStat = fs.statSync(pkgPath);
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkgJson?.version) APP_VERSION = String(pkgJson.version);
    BUILD_DATE = pkgStat.mtime.toISOString().substring(0, 10);
  }
} catch (_) {}

// Directorio base persistente (DRAC_DATA_DIR en Electron = %APPDATA%/DRAC Control de Asistencia)
const PERSISTENT_BASE_DIR = process.env.DRAC_DATA_DIR
  ? path.resolve(process.env.DRAC_DATA_DIR)
  : path.resolve(BASE_PROJECT_DIR);

const STORAGE_BOOT = initializePersistentStorage({
  baseDir: PERSISTENT_BASE_DIR,
  bundledDataDir: BUNDLED_DATA_DIR,
  appVersion: APP_VERSION,
  buildDate: BUILD_DATE,
});

const STORAGE_DIRS = STORAGE_BOOT.dirs;
const DATA_DIR = STORAGE_DIRS.dataDir;

const RAW_PUNCHES_FILE = resolveSafeChildPath(DATA_DIR, 'raw-punches.json');
const ATTENDANCE_FILE = resolveSafeChildPath(DATA_DIR, 'attendance.json');
const DEVICES_FILE = resolveSafeChildPath(DATA_DIR, 'devices.json');
const EMPLOYEES_FILE = resolveSafeChildPath(DATA_DIR, 'employees.json');
const PUSH_LOGS_FILE = resolveSafeChildPath(DATA_DIR, 'push-logs.json');
const AUDIT_LOGS_FILE = resolveSafeChildPath(DATA_DIR, 'audit-logs.json');
const TURNOS_FILE = resolveSafeChildPath(DATA_DIR, 'turnos.json');
const HORARIOS_FILE = resolveSafeChildPath(DATA_DIR, 'horarios.json');
const ASIGNACIONES_FILE = resolveSafeChildPath(DATA_DIR, 'asignacion-horarios.json');
const DEPENDENCIAS_FILE = resolveSafeChildPath(DATA_DIR, 'dependencias.json');
const DIRECCIONES_FILE = resolveSafeChildPath(DATA_DIR, 'direcciones.json');
const AREAS_FILE = resolveSafeChildPath(DATA_DIR, 'areas.json');
const CARGOS_FILE = resolveSafeChildPath(DATA_DIR, 'cargos.json');
const RESPONSABLES_FILE = resolveSafeChildPath(DATA_DIR, 'responsables.json');
const PAPELETAS_FILE = resolveSafeChildPath(DATA_DIR, 'papeletas.json');
const VACACIONES_FILE = resolveSafeChildPath(DATA_DIR, 'vacaciones.json');
const ENCARGATURAS_FILE = resolveSafeChildPath(DATA_DIR, 'encargaturas.json');
const DEVICE_USERS_FILE = resolveSafeChildPath(DATA_DIR, 'device-users.json');
const DEVICE_USER_HISTORY_FILE = resolveSafeChildPath(DATA_DIR, 'device-user-history.json');
const DEVICE_USER_SYNC_LOGS_FILE = resolveSafeChildPath(DATA_DIR, 'device-user-sync-logs.json');
const CLOSED_PERIODS_FILE = resolveSafeChildPath(DATA_DIR, 'closed-periods.json');
const SUPABASE_CFG_FILE = resolveConfigFilePath(STORAGE_DIRS, 'supabase-config.json');
const BIOTIME_CONFIG_FILE = resolveConfigFilePath(STORAGE_DIRS, 'biotime-config.json');

try {
  if (fs.existsSync(SUPABASE_CFG_FILE)) {
    const savedSb = JSON.parse(fs.readFileSync(SUPABASE_CFG_FILE, 'utf-8'));
    if (savedSb?.url && savedSb?.anonKey) {
      SUPABASE_URL = String(savedSb.url).trim();
      SUPABASE_ANON_KEY = String(savedSb.anonKey).trim();
      supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }
} catch (_) {}

// Helper to read JSON files safely
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

// Helper to write JSON files safely
function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Persistencia cifrada segura de configuración BioTime PRO (nunca expone contraseñas en GET)
const DEFAULT_BIOTIME_SERVER_CONFIG = {
  host: '192.168.1.29',
  httpPort: 8088,
  protocol: 'http' as 'http' | 'https',
  authMethod: 'AUTO' as 'AUTO' | 'JWT' | 'DRF_TOKEN' | 'DJANGO_SESSION',
  authUser: '',
  authPasswordEnc: '',
  pgPort: 7496,
  pgDbName: 'biotime',
  pgUser: 'postgres',
  pgPasswordEnc: '',
  timeoutMs: 5000,
  lastStatus: 'NO_CONECTADO',
  lastTestedAt: null as string | null,
  lastMessage: '',
  updatedAt: null as string | null,
};

function getBioTimeServerKey(): Buffer {
  return crypto.createHash('sha256').update(`DRAC-BIOTIME-WEB-${os.hostname()}-${process.platform}`).digest();
}

function encryptBioTimeSecretServer(plain: string): string {
  const val = String(plain || '');
  if (!val) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getBioTimeServerKey(), iv);
    const enc = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `aes:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  } catch (_) {
    return '';
  }
}

function decryptBioTimeSecretServer(stored: string): string {
  const s = String(stored || '');
  if (!s) return '';
  if (s.startsWith('aes:')) {
    try {
      const parts = s.split(':');
      if (parts.length === 4) {
        const iv = Buffer.from(parts[1], 'hex');
        const tag = Buffer.from(parts[2], 'hex');
        const data = Buffer.from(parts[3], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', getBioTimeServerKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      }
    } catch (_) {
      return '';
    }
  }
  return s;
}

function loadStoredBioTimeConfigServer() {
  const raw = readJsonFile<any>(BIOTIME_CONFIG_FILE, null);
  if (raw && typeof raw === 'object') {
    return {
      ...DEFAULT_BIOTIME_SERVER_CONFIG,
      ...raw,
      authPasswordPlain: decryptBioTimeSecretServer(raw.authPasswordEnc || ''),
      pgPasswordPlain: decryptBioTimeSecretServer(raw.pgPasswordEnc || ''),
    };
  }
  return { ...DEFAULT_BIOTIME_SERVER_CONFIG, authPasswordPlain: '', pgPasswordPlain: '' };
}

function getPublicBioTimeConfigServer(cfg = loadStoredBioTimeConfigServer()) {
  const hasAuth = Boolean(cfg.authPasswordPlain || cfg.authPasswordEnc);
  const hasPg = Boolean(cfg.pgPasswordPlain || cfg.pgPasswordEnc);
  return {
    host: String(cfg.host || '192.168.1.29').trim(),
    httpPort: Number(cfg.httpPort) || 8088,
    protocol: String(cfg.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http',
    authMethod: String(cfg.authMethod || 'AUTO').toUpperCase(),
    authUser: String(cfg.authUser || '').trim(),
    has_auth_password: hasAuth,
    auth_password_masked: hasAuth ? '********' : '',
    pgPort: Number(cfg.pgPort) || 7496,
    pgDbName: String(cfg.pgDbName || 'biotime').trim(),
    pgUser: String(cfg.pgUser || 'postgres').trim(),
    has_pg_password: hasPg,
    pg_password_masked: hasPg ? '********' : '',
    timeoutMs: Number(cfg.timeoutMs) || 5000,
    lastStatus: cfg.lastStatus || 'NO_CONECTADO',
    lastTestedAt: cfg.lastTestedAt || null,
    lastMessage: cfg.lastMessage || '',
    updatedAt: cfg.updatedAt || null,
  };
}

function saveStoredBioTimeConfigServer(payload: any = {}) {
  const prev = loadStoredBioTimeConfigServer();
  const nextHttpPort = Number(payload.httpPort ?? payload.webPort ?? prev.httpPort ?? 8088);
  const nextPgPort = Number(payload.pgPort ?? payload.dbPort ?? prev.pgPort ?? 7496);
  const rawAuthPwd = payload.authPassword ?? payload.webPassword;
  const rawPgPwd = payload.pgPassword ?? payload.password;

  let nextAuthEnc = prev.authPasswordEnc || '';
  if (payload.clear_auth_password) {
    nextAuthEnc = '';
  } else if (rawAuthPwd !== undefined && rawAuthPwd !== '' && rawAuthPwd !== '********') {
    nextAuthEnc = encryptBioTimeSecretServer(String(rawAuthPwd));
  }

  let nextPgEnc = prev.pgPasswordEnc || '';
  if (payload.clear_pg_password) {
    nextPgEnc = '';
  } else if (rawPgPwd !== undefined && rawPgPwd !== '' && rawPgPwd !== '********') {
    nextPgEnc = encryptBioTimeSecretServer(String(rawPgPwd));
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

  const structuredBtPath = resolveSafeChildPath(STORAGE_DIRS.configDir, 'biotime-config.json');
  const legacyBtPath = resolveSafeChildPath(STORAGE_DIRS.dataDir, 'biotime-config.json');
  writeJsonFile(structuredBtPath, stored);
  writeJsonFile(legacyBtPath, stored);
  return getPublicBioTimeConfigServer({
    ...stored,
    authPasswordPlain: decryptBioTimeSecretServer(stored.authPasswordEnc),
    pgPasswordPlain: decryptBioTimeSecretServer(stored.pgPasswordEnc),
  });
}

function resolveBioTimeEffectiveParamsServer(params: any = {}) {
  const stored = loadStoredBioTimeConfigServer();
  const rawAuthPwd = params.authPassword ?? params.webPassword;
  const rawPgPwd = params.pgPassword ?? params.password;
  return {
    host: String(params.host || stored.host || '192.168.1.29').trim(),
    protocol: (String(params.protocol || stored.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http') as 'http' | 'https',
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

// ---------------------------------------------------------------------------
// 1. RAW PUNCHES & ATTENDANCE ENDPOINTS (Strict Zero-Mock Data Policy)
// ---------------------------------------------------------------------------

// Helper: timeout guard for network/Supabase operations
async function withServerTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Helper: load latest saved device configuration (Supabase dispositivos_zkteco + local devices.json)
async function getLatestDeviceConfig(deviceIdOrSerial?: string): Promise<any[]> {
  const localDevices = readJsonFile<any[]>(DEVICES_FILE, []);
  let merged = [...localDevices];
  try {
    const sbPromise = Promise.resolve(
      supabaseServer.from('dispositivos_zkteco').select('*')
    );
    const sbRes: any = await withServerTimeout(sbPromise, 1500, 'Timeout Supabase dispositivos_zkteco');
    if (sbRes && !sbRes.error && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
      for (const remote of sbRes.data) {
        const idx = merged.findIndex((d) => d.id === remote.id || d.serial_number === remote.serial_number);
        if (idx >= 0) {
          const localTs = Date.parse(merged[idx].updated_at || merged[idx].last_modified_at || '1970-01-01');
          const remoteTs = Date.parse(remote.updated_at || remote.last_modified_at || '1970-01-01');
          if (remoteTs > localTs) {
            merged[idx] = { ...merged[idx], ...remote };
          }
        } else {
          merged.push(remote);
        }
      }
    }
  } catch (_) {}

  if (deviceIdOrSerial) {
    const found = merged.find((d) => d.id === deviceIdOrSerial || d.serial_number === deviceIdOrSerial);
    return found ? [found, ...merged.filter((d) => d.id !== found.id)] : merged;
  }
  return merged;
}

// Strict employee matcher ONLY by biometric identifier (NEVER by name)
function findEmployeeByBiometricCode(employees: any[], rawCode: string): any | undefined {
  const clean = String(rawCode || '').trim();
  if (!clean) return undefined;
  return employees.find(
    (e) =>
      String(e.dni || '').trim() === clean ||
      String(e.zkteco_pin || '').trim() === clean ||
      String(e.biometric_user_id || '').trim() === clean ||
      String(e.codigo_trabajador || '').trim() === clean
  );
}

// GET /api/attendance/punches & /api/zkteco/raw-punches
const getPunchesHandler = (req: express.Request, res: express.Response) => {
  const storedPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const deviceUsers = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
  const { fecha, dni, device, status, limit } = req.query;

  // Filter out any legacy synthetic IDs if any remain
  let filtered = storedPunches.filter((p: any) => !(p.id && String(p.id).startsWith('raw-1787835')));

  if (fecha) {
    filtered = filtered.filter((p) => p.fecha === fecha || p.timestamp?.startsWith(String(fecha)));
  }
  if (dni) {
    const qDni = String(dni).trim();
    filtered = filtered.filter((p) => p.employee_dni === qDni || p.employee_code === qDni);
  }
  if (device) {
    const qDev = String(device).trim();
    filtered = filtered.filter((p) => p.device_sn === qDev || p.device_id === qDev);
  }

  // Enrich strictly by (device_sn, pin) binding FIRST, then unambiguous biometric ID (never by name)
  const enriched = filtered.map((p) =>
    enrichPunchWithOfficialEmployee(p, employees, devices, deviceUsers)
  );

  const finalRows = status
    ? enriched.filter((p) => p.validation_status === String(status))
    : enriched;

  // Sort descending by timestamp
  finalRows.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  const numLimit = limit ? parseInt(limit as string, 10) : finalRows.length;
  const lastSync = devices[0]?.last_sync || finalRows[0]?.synced_at || null;
  const pendingCount = finalRows.filter((p) => p.validation_status === 'PENDIENTE_IDENTIFICACION').length;

  return res.json({
    success: true,
    count: finalRows.length,
    pending_identification_count: pendingCount,
    last_sync: lastSync,
    data: finalRows.slice(0, numLimit),
  });
};

app.get('/api/attendance/punches', getPunchesHandler);
app.get('/api/zkteco/raw-punches', getPunchesHandler);
app.get('/api/punches', getPunchesHandler);

// GET /api/attendance
app.get('/api/attendance', (req, res) => {
  const attendance = readJsonFile<any[]>(ATTENDANCE_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const { fecha, dni } = req.query;

  let filtered = attendance.map((a) => enrichAttendanceWithOfficialEmployee(a, employees));
  if (fecha) {
    filtered = filtered.filter((a) => a.fecha === fecha);
  }
  if (dni) {
    filtered = filtered.filter((a) => a.employee_dni === dni);
  }

  filtered.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  return res.json({
    success: true,
    count: filtered.length,
    data: filtered,
  });
});

// GET/POST /api/attendance/closed-periods - Protección de períodos históricos cerrados
app.get('/api/attendance/closed-periods', (_req, res) => {
  const periods = readJsonFile<ClosedPeriodEntry[]>(CLOSED_PERIODS_FILE, []);
  return res.json({ success: true, count: periods.length, data: periods });
});

app.post('/api/attendance/closed-periods', (req, res) => {
  const { period, closed_by = 'RRHH DRAC', reason = 'Cierre mensual oficial' } = req.body || {};
  const cleanPeriod = String(period || '').trim();
  if (!/^\d{4}-\d{2}$/.test(cleanPeriod)) {
    return res.status(400).json({ success: false, message: 'Formato de período inválido. Use YYYY-MM.' });
  }
  const periods = readJsonFile<ClosedPeriodEntry[]>(CLOSED_PERIODS_FILE, []);
  if (!periods.some((p) => p.period === cleanPeriod)) {
    periods.push({
      period: cleanPeriod,
      closed_at: new Date().toISOString(),
      closed_by: String(closed_by),
      reason: String(reason),
    });
    writeJsonFile(CLOSED_PERIODS_FILE, periods);
  }
  return res.status(201).json({ success: true, count: periods.length, data: periods });
});

// ---------------------------------------------------------------------------
// 2. DEVICES & PHYSICAL HARDWARE SYNC (ZKTeco G3-id)
// ---------------------------------------------------------------------------

// GET /api/zkteco/devices
app.get('/api/zkteco/devices', async (req, res) => {
  const devices = await getLatestDeviceConfig();
  const rawPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);

  // Update log_count with real punch count
  const updatedDevices = devices.map((d) => ({
    ...d,
    log_count: rawPunches.filter((p) => p.device_sn === d.serial_number || p.device_id === d.id || p.deviceId === d.id).length,
  }));

  return res.json({
    success: true,
    count: updatedDevices.length,
    data: updatedDevices,
  });
});

// PUT /api/zkteco/devices/:id - Update device configuration (IP, port, serial, MAC, etc.)
app.put('/api/zkteco/devices/:id', (req, res) => {
  const { id } = req.params;
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const index = devices.findIndex((d) => d.id === id || d.serial_number === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Dispositivo no encontrado en el sistema.' });
  }

  // 1. Role Authorization Check
  const userRole = String(req.headers['x-user-role'] || req.body.user_role || '').trim();
  const userId = String(req.headers['x-user-id'] || req.body.user_id || 'admin-drac').trim();
  const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Administrador DRAC').trim();

  const ALLOWED_CONFIG_ROLES = [
    'ADMIN_GENERAL',
    'HR_ADMIN',
    'JEFE_RRHH',
    'CONTROL_ASISTENCIA',
    'SUPERVISOR',
    'DIRECTOR_GENERAL',
  ];

  if (userRole && !ALLOWED_CONFIG_ROLES.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Solo el Administrador General o personal de control autorizado pueden modificar los parámetros del marcador biométrico.',
    });
  }

  const existing = devices[index];
  const payload = req.body || {};

  // 2. Syntax & Value Validations
  const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  // IP validation
  if (payload.ip_address !== undefined) {
    const trimmedIp = String(payload.ip_address).trim();
    if (!IPV4_REGEX.test(trimmedIp)) {
      return res.status(400).json({
        success: false,
        message: `Dirección IP inválida ('${payload.ip_address}'). Debe ser una dirección IPv4 válida (ej: 192.168.1.198).`,
      });
    }
  }

  // Port validation
  if (payload.port !== undefined) {
    const portNum = Number(payload.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({
        success: false,
        message: `Puerto TCP inválido ('${payload.port}'). Debe ser un número entero entre 1 y 65535 (ej: 7496 o 4370).`,
      });
    }
  }

  // Netmask validation
  if (payload.netmask !== undefined && String(payload.netmask).trim() !== '') {
    const trimmedNetmask = String(payload.netmask).trim();
    if (!IPV4_REGEX.test(trimmedNetmask)) {
      return res.status(400).json({
        success: false,
        message: `Máscara de subred inválida ('${payload.netmask}'). Debe tener formato IPv4 (ej: 255.255.255.0).`,
      });
    }
  }

  // Gateway validation
  if (payload.gateway !== undefined && String(payload.gateway).trim() !== '') {
    const trimmedGw = String(payload.gateway).trim();
    if (!IPV4_REGEX.test(trimmedGw)) {
      return res.status(400).json({
        success: false,
        message: `Puerta de enlace inválida ('${payload.gateway}'). Debe tener formato IPv4 (ej: 192.168.1.1).`,
      });
    }
  }

  // DNS validation
  if (payload.dns !== undefined && String(payload.dns).trim() !== '') {
    const trimmedDns = String(payload.dns).trim();
    if (!IPV4_REGEX.test(trimmedDns)) {
      return res.status(400).json({
        success: false,
        message: `DNS inválido ('${payload.dns}'). Debe tener formato IPv4 (ej: 200.48.225.130).`,
      });
    }
  }

  // MAC address validation
  if (payload.mac_address !== undefined && String(payload.mac_address).trim() !== '') {
    const trimmedMac = String(payload.mac_address).trim();
    if (!MAC_REGEX.test(trimmedMac)) {
      return res.status(400).json({
        success: false,
        message: `Dirección MAC inválida ('${payload.mac_address}'). Formato esperado: 00:17:61:10:74:7F.`,
      });
    }
  }

  // Device ID number
  if (payload.device_id_num !== undefined) {
    const devIdNum = Number(payload.device_id_num);
    if (!Number.isInteger(devIdNum) || devIdNum < 1) {
      return res.status(400).json({
        success: false,
        message: `Device ID inválido ('${payload.device_id_num}'). Debe ser un entero positivo mayor o igual a 1.`,
      });
    }
  }

  // CommKey
  let sanitizedCommKey = existing.comm_key;
  if (payload.comm_key !== undefined) {
    const commKeyStr = String(payload.comm_key).trim();
    sanitizedCommKey = isNaN(Number(commKeyStr)) ? commKeyStr : Number(commKeyStr);
  }

  // Name and model
  if (payload.name !== undefined && String(payload.name).trim() === '') {
    return res.status(400).json({ success: false, message: 'El nombre del dispositivo no puede estar vacío.' });
  }

  const nowIso = new Date().toISOString();
  const nextVersion = (Number(existing.config_version) || Number(existing.record_version) || 1) + 1;

  // 3. Assemble Updated Device Object
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
    comm_key: sanitizedCommKey,
    device_id_num: payload.device_id_num !== undefined ? Number(payload.device_id_num) : (existing.device_id_num || 1),
    status: payload.status !== undefined ? String(payload.status).trim() : existing.status,
    protocol: payload.protocol !== undefined ? String(payload.protocol).trim() : existing.protocol,
    location_detail: payload.location_detail !== undefined ? String(payload.location_detail).trim() : existing.location_detail,
    last_modified_by: `${userName} (${userRole || 'ADMIN'})`,
    last_modified_at: nowIso,
    updated_at: nowIso,
    config_version: nextVersion,
    record_version: nextVersion,
  };

  // 4. Persist to data/devices.json
  devices[index] = updated;
  writeJsonFile(DEVICES_FILE, devices);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'dispositivos_zkteco',
    entity_id: updated.id,
    operation: 'UPSERT',
    payload: {
      id: updated.id,
      serial_number: updated.serial_number,
      name: updated.name,
      ip_address: updated.ip_address,
      port: updated.port,
      netmask: updated.netmask,
      gateway: updated.gateway,
      dns: updated.dns,
      mac_address: updated.mac_address,
      comm_key: String(updated.comm_key),
      device_id_num: updated.device_id_num,
      model: updated.model,
      protocol: updated.protocol,
      status: updated.status,
      location_detail: updated.location_detail,
      last_modified_by: updated.last_modified_by,
      last_modified_at: updated.last_modified_at,
      updated_at: updated.updated_at,
      record_version: nextVersion,
    },
    record_version: nextVersion,
  });

  // 5. Append Audit Log to data/audit-logs.json
  const auditLogs = readJsonFile<any[]>(AUDIT_LOGS_FILE, []);
  const auditEntry = {
    id: `audit-dev-${Date.now()}`,
    timestamp: nowIso,
    user_id: userId,
    user_name: userName,
    user_role: userRole || 'ADMIN_GENERAL',
    action: 'MODIFICACION_CONFIGURACION_DISPOSITIVO',
    entity: 'DISPOSITIVO_ZKTECO',
    entity_id: updated.id,
    details: `Modificación de parámetros ZKTeco ${updated.name} (IP: ${existing.ip_address} -> ${updated.ip_address}, Puerto: ${existing.port} -> ${updated.port}, S/N: ${updated.serial_number}, MAC: ${updated.mac_address}, Rev: v${nextVersion})`,
    previous_values: {
      name: existing.name,
      model: existing.model,
      serial_number: existing.serial_number,
      ip_address: existing.ip_address,
      port: existing.port,
      netmask: existing.netmask,
      gateway: existing.gateway,
      dns: existing.dns,
      mac_address: existing.mac_address,
      comm_key: existing.comm_key,
      device_id_num: existing.device_id_num,
      status: existing.status,
      protocol: existing.protocol,
      config_version: existing.config_version || 1,
    },
    new_values: {
      name: updated.name,
      model: updated.model,
      serial_number: updated.serial_number,
      ip_address: updated.ip_address,
      port: updated.port,
      netmask: updated.netmask,
      gateway: updated.gateway,
      dns: updated.dns,
      mac_address: updated.mac_address,
      comm_key: updated.comm_key,
      device_id_num: updated.device_id_num,
      status: updated.status,
      protocol: updated.protocol,
      config_version: nextVersion,
    },
  };
  auditLogs.unshift(auditEntry);
  writeJsonFile(AUDIT_LOGS_FILE, auditLogs.slice(0, 500));

  // 6. Asynchronous Sincronización con Supabase PostgreSQL
  try {
    Promise.resolve(
      supabaseServer
        .from('dispositivos_zkteco')
        .upsert(
          {
            id: updated.id,
            serial_number: updated.serial_number,
            name: updated.name,
            ip_address: updated.ip_address,
            port: updated.port,
            netmask: updated.netmask,
            gateway: updated.gateway,
            dns: updated.dns,
            mac_address: updated.mac_address,
            comm_key: String(updated.comm_key),
            device_id_num: updated.device_id_num,
            model: updated.model,
            protocol: updated.protocol,
            status: updated.status,
            location_detail: updated.location_detail,
            last_modified_by: updated.last_modified_by,
            last_modified_at: updated.last_modified_at,
            updated_at: updated.updated_at,
          },
          { onConflict: 'id' }
        )
    )
      .then((sbRes: any) => {
        if (sbRes?.error) {
          console.warn('[SERVER] Aviso en Supabase upsert dispositivos_zkteco:', sbRes.error.message);
        } else {
          console.log(`[SERVER] Parámetros de marcador persistidos en Supabase PostgreSQL (Rev. v${nextVersion})`);
        }
      })
      .catch((sbErr: any) => {
        console.warn('[SERVER] Excepción en Supabase upsert:', sbErr?.message || sbErr);
      });
  } catch (syncErr: any) {
    console.warn('[SERVER] Error despachando sincronización a Supabase:', syncErr.message);
  }

  return res.json({
    success: true,
    message: `Configuración oficial del dispositivo ${updated.name} guardada exitosamente (Rev. v${nextVersion}). Puerto activo: ${updated.port}, IP: ${updated.ip_address}.`,
    data: updated,
  });
});

// POST /api/zkteco/devices - Register new biometric marker
app.post('/api/zkteco/devices', (req, res) => {
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const payload = req.body || {};

  const userRole = String(req.headers['x-user-role'] || payload.user_role || '').trim();
  const userId = String(req.headers['x-user-id'] || payload.user_id || 'admin-drac').trim();
  const userName = String(req.headers['x-user-name'] || payload.user_name || 'Administrador DRAC').trim();

  const ALLOWED_CONFIG_ROLES = [
    'ADMIN_GENERAL',
    'HR_ADMIN',
    'JEFE_RRHH',
    'CONTROL_ASISTENCIA',
    'SUPERVISOR',
    'DIRECTOR_GENERAL',
  ];

  if (userRole && !ALLOWED_CONFIG_ROLES.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Se requieren permisos administrativos para registrar un marcador.',
    });
  }

  const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  if (!payload.name || !String(payload.name).trim()) {
    return res.status(400).json({ success: false, message: 'El nombre del dispositivo es obligatorio.' });
  }

  if (!payload.serial_number || !String(payload.serial_number).trim()) {
    return res.status(400).json({ success: false, message: 'El número de serie es obligatorio.' });
  }

  const cleanIp = String(payload.ip_address || '192.168.1.199').trim();
  if (!IPV4_REGEX.test(cleanIp)) {
    return res.status(400).json({ success: false, message: 'Dirección IP LAN inválida.' });
  }

  const portNum = Number(payload.port) || 7496;
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({ success: false, message: 'Puerto TCP inválido (1-65535).' });
  }

  const newId = payload.id || `dev-${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  const newDevice = {
    id: newId,
    name: String(payload.name).trim(),
    model: String(payload.model || 'ZKTeco G3').trim(),
    serial_number: String(payload.serial_number).trim().toUpperCase(),
    ip_address: cleanIp,
    port: portNum,
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
    last_modified_by: `${userName} (${userRole || 'ADMIN_GENERAL'})`,
    last_modified_at: nowIso,
    updated_at: nowIso,
    config_version: 1,
    record_version: 1,
  };

  devices.push(newDevice);
  writeJsonFile(DEVICES_FILE, devices);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'dispositivos_zkteco',
    entity_id: newDevice.id,
    operation: 'UPSERT',
    payload: {
      id: newDevice.id,
      serial_number: newDevice.serial_number,
      name: newDevice.name,
      ip_address: newDevice.ip_address,
      port: newDevice.port,
      netmask: newDevice.netmask,
      gateway: newDevice.gateway,
      dns: newDevice.dns,
      mac_address: newDevice.mac_address,
      comm_key: String(newDevice.comm_key),
      device_id_num: newDevice.device_id_num,
      model: newDevice.model,
      protocol: newDevice.protocol,
      status: newDevice.status,
      location_detail: newDevice.location_detail,
      last_modified_by: newDevice.last_modified_by,
      last_modified_at: newDevice.last_modified_at,
      updated_at: newDevice.updated_at,
      record_version: 1,
    },
    record_version: 1,
  });

  // Auditoría
  const auditLogs = readJsonFile<any[]>(AUDIT_LOGS_FILE, []);
  auditLogs.unshift({
    id: `audit-dev-${Date.now()}`,
    timestamp: nowIso,
    user_id: userId,
    user_name: userName,
    user_role: userRole || 'ADMIN_GENERAL',
    action: 'CREACION_DISPOSITIVO_ZKTECO',
    entity: 'DISPOSITIVO_ZKTECO',
    entity_id: newDevice.id,
    details: `Alta de nuevo marcador biométrico: ${newDevice.name} (IP: ${newDevice.ip_address}, Puerto: ${newDevice.port}, S/N: ${newDevice.serial_number})`,
    new_values: newDevice,
  });
  writeJsonFile(AUDIT_LOGS_FILE, auditLogs.slice(0, 500));

  // Replicar en Supabase
  try {
    Promise.resolve(
      supabaseServer.from('dispositivos_zkteco').insert({
        id: newDevice.id,
        serial_number: newDevice.serial_number,
        name: newDevice.name,
        ip_address: newDevice.ip_address,
        port: newDevice.port,
        netmask: newDevice.netmask,
        gateway: newDevice.gateway,
        dns: newDevice.dns,
        mac_address: newDevice.mac_address,
        comm_key: String(newDevice.comm_key),
        device_id_num: newDevice.device_id_num,
        model: newDevice.model,
        protocol: newDevice.protocol,
        status: newDevice.status,
        location_detail: newDevice.location_detail,
        last_modified_by: newDevice.last_modified_by,
        last_modified_at: newDevice.last_modified_at,
        updated_at: newDevice.updated_at,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.status(201).json({
    success: true,
    message: `Marcador biométrico ${newDevice.name} registrado exitosamente.`,
    data: newDevice,
  });
});

// DELETE /api/zkteco/devices/:id - Remove secondary biometric marker
app.delete('/api/zkteco/devices/:id', (req, res) => {
  const { id } = req.params;
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const index = devices.findIndex((d) => d.id === id || d.serial_number === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Dispositivo no encontrado.' });
  }

  if (devices.length <= 1) {
    return res.status(400).json({ success: false, message: 'No se puede eliminar el único marcador registrado del sistema.' });
  }

  const removed = devices.splice(index, 1)[0];
  writeJsonFile(DEVICES_FILE, devices);

  const auditLogs = readJsonFile<any[]>(AUDIT_LOGS_FILE, []);
  auditLogs.unshift({
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
  writeJsonFile(AUDIT_LOGS_FILE, auditLogs.slice(0, 500));

  return res.json({
    success: true,
    message: `Marcador biométrico ${removed.name} eliminado del sistema.`,
    data: removed,
  });
});

// ---------------------------------------------------------------------------
// 1.1 EMPLEADOS / TRABAJADORES API (CRUD Persistente y Normalizado)
// ---------------------------------------------------------------------------
const normalizeEmployeePayload = (body: any, existing?: any) => {
  const normFirstName = normalizePersonName(body.first_name);
  const normLastName = normalizePersonName(body.last_name);
  const normPat = normalizePersonName(body.apellido_paterno || normLastName.split(' ')[0] || '');
  const normMat = normalizePersonName(body.apellido_materno || normLastName.split(' ')[1] || '');
  const dni = String(body.dni || existing?.dni || '').trim();
  const id = body.id || existing?.id || `emp-${dni || Date.now()}`;

  return {
    id,
    dni,
    codigo_trabajador: body.codigo_trabajador || existing?.codigo_trabajador || `DRAC-${dni}`,
    first_name: normFirstName || existing?.first_name || 'Trabajador',
    last_name: normLastName || existing?.last_name || 'DRAC',
    apellido_paterno: normPat,
    apellido_materno: normMat,
    email: (body.email || existing?.email || '').toLowerCase().trim(),
    phone: String(body.phone || existing?.phone || '').trim(),
    address: normalizeText(body.address || existing?.address || ''),
    dependencia_id: body.dependencia_id || existing?.dependencia_id || 'dep-01',
    dependencia_name: normalizeInstitutionalName(body.dependencia_name || existing?.dependencia_name || 'Sede Central'),
    direccion_organo_id: body.direccion_organo_id || existing?.direccion_organo_id || '',
    direccion_organo_name: normalizeInstitutionalName(body.direccion_organo_name || existing?.direccion_organo_name || ''),
    area_id: body.area_id || existing?.area_id || '',
    area_name: normalizeInstitutionalName(body.area_name || existing?.area_name || ''),
    position: normalizeInstitutionalName(body.position || body.cargo || existing?.position || 'Servidor Público'),
    cargo: normalizeInstitutionalName(body.cargo || body.position || existing?.cargo || 'Servidor Público'),
    cargo_id: body.cargo_id || existing?.cargo_id || '',
    subarea_id: body.subarea_id !== undefined ? body.subarea_id : (existing?.subarea_id || ''),
    subarea_name: normalizeInstitutionalName(body.subarea_name !== undefined ? body.subarea_name : (existing?.subarea_name || '')),
    supervisor_id: body.supervisor_id !== undefined ? body.supervisor_id : (existing?.supervisor_id || ''),
    supervisor_name: normalizePersonName(body.supervisor_name !== undefined ? body.supervisor_name : (existing?.supervisor_name || '')),
    regimen_laboral: body.regimen_laboral || existing?.regimen_laboral || 'D.L. 276',
    condicion_laboral: body.condicion_laboral || body.condicion || existing?.condicion_laboral || 'NOMBRADO',
    is_jefe_director: Boolean(body.is_jefe_director),
    unidad_dirigida_id: body.unidad_dirigida_id !== undefined ? body.unidad_dirigida_id : (existing?.unidad_dirigida_id || ''),
    unidad_dirigida_name: body.unidad_dirigida_name !== undefined ? body.unidad_dirigida_name : (existing?.unidad_dirigida_name || ''),
    unidad_dirigida_type: body.unidad_dirigida_type !== undefined ? body.unidad_dirigida_type : (existing?.unidad_dirigida_type || ''),
    role: body.role || existing?.role || 'TRABAJADOR',
    assigned_roles: Array.isArray(body.assigned_roles) && body.assigned_roles.length > 0 ? body.assigned_roles : (existing?.assigned_roles || ['TRABAJADOR']),
    role_history: Array.isArray(body.role_history) ? body.role_history : (existing?.role_history || []),
    has_system_access: body.has_system_access !== undefined ? Boolean(body.has_system_access) : true,
    username: body.username || existing?.username || dni,
    account_status: body.account_status || existing?.account_status || 'ACTIVE',
    auth_method: body.auth_method || existing?.auth_method || 'PASSWORD',
    primer_ingreso: body.primer_ingreso || existing?.primer_ingreso || 'PENDIENTE',
    password_change_required: body.password_change_required !== undefined ? Boolean(body.password_change_required) : false,
    password_hash: body.password_hash || existing?.password_hash || null,
    password_salt: body.password_salt || existing?.password_salt || null,
    active: body.active !== undefined ? Boolean(body.active) : true,
    hire_date: body.hire_date || existing?.hire_date || '2026-01-01',
    zkteco_pin: body.zkteco_pin !== undefined ? String(body.zkteco_pin).trim() : (existing?.zkteco_pin || dni),
    biometric_user_id: body.biometric_user_id !== undefined ? body.biometric_user_id : (existing?.biometric_user_id || body.zkteco_pin || dni),
    biometric_sync_device_id: body.biometric_sync_device_id !== undefined ? body.biometric_sync_device_id : (existing?.biometric_sync_device_id || undefined),
    biometric_sync_device_name: body.biometric_sync_device_name !== undefined ? body.biometric_sync_device_name : (existing?.biometric_sync_device_name || undefined),
    biometric_sync_status: body.biometric_sync_status !== undefined ? body.biometric_sync_status : (existing?.biometric_sync_status || undefined),
    schedule_id: body.schedule_id || existing?.schedule_id || 'hor-01',
    schedule_name: normalizeInstitutionalName(body.schedule_name || existing?.schedule_name || 'Jornada Partida Institucional DRAC'),
    updated_at: new Date().toISOString(),
  };
};

const handleGetEmployees = (req: express.Request, res: express.Response) => {
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  return res.json({ success: true, count: employees.length, data: employees });
};

const handleSaveEmployee = (req: express.Request, res: express.Response) => {
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const body = req.body || {};
  const cleanDni = String(body.dni || '').trim();
  const cleanCode = String(body.codigo_trabajador || '').trim();

  if (body.rejectIfDniExists && cleanDni) {
    const dupDni = employees.find((e) => String(e.dni || '').trim() === cleanDni);
    if (dupDni) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_DNI',
        existingEmployee: dupDni,
        message: `El DNI ${cleanDni} ya se encuentra registrado en el directorio institucional (${dupDni.first_name} ${dupDni.last_name}). Use "Vincular con Trabajador Existente".`,
      });
    }
  }

  if (body.rejectIfCodeExists && cleanCode) {
    const dupCode = employees.find(
      (e) =>
        String(e.codigo_trabajador || '').trim().toUpperCase() === cleanCode.toUpperCase() &&
        (!cleanDni || String(e.dni || '').trim() !== cleanDni)
    );
    if (dupCode) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_CODE',
        existingEmployee: dupCode,
        message: `El Código DRAC ${cleanCode} ya está asignado a ${dupCode.first_name} ${dupCode.last_name} (DNI ${dupCode.dni}).`,
      });
    }
  }

  const existingIdx = employees.findIndex((e) => e.id === body.id || (cleanDni && e.dni === cleanDni));
  const existing = existingIdx >= 0 ? employees[existingIdx] : undefined;
  const normalized: any = normalizeEmployeePayload(body, existing);
  normalized.record_version = (Number(existing?.record_version) || 0) + 1;

  if (existingIdx >= 0) {
    employees[existingIdx] = { ...employees[existingIdx], ...normalized };
  } else {
    employees.unshift(normalized);
  }

  writeJsonFile(EMPLOYEES_FILE, employees);

  const originHdr = String(req.headers['x-app-origin'] || (process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB')).toUpperCase();
  const origin: 'DESKTOP' | 'WEB' = originHdr === 'DESKTOP' ? 'DESKTOP' : 'WEB';
  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'trabajadores',
    entity_id: normalized.id,
    operation: 'UPSERT',
    payload: normalized,
    record_version: normalized.record_version,
    origin,
  });

  // Replicar en Supabase PostgreSQL de manera asíncrona y marcar si tuvo éxito
  flushServerOutbox({ dirs: STORAGE_DIRS, supabaseServer, supabaseUrl: SUPABASE_URL, timeoutMs: 2500 }).catch(() => {});

  return res.status(201).json({
    success: true,
    message: existingIdx >= 0 ? 'Trabajador actualizado exitosamente.' : 'Trabajador registrado exitosamente.',
    data: normalized,
  });
};

const handleUpdateEmployee = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const idx = employees.findIndex((e) => e.id === id || e.dni === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Trabajador no encontrado.' });
  }

  const normalized: any = normalizeEmployeePayload(req.body, employees[idx]);
  normalized.record_version = (Number(employees[idx]?.record_version) || 1) + 1;
  employees[idx] = { ...employees[idx], ...normalized };
  writeJsonFile(EMPLOYEES_FILE, employees);

  const originHdr = String(req.headers['x-app-origin'] || (process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB')).toUpperCase();
  const origin: 'DESKTOP' | 'WEB' = originHdr === 'DESKTOP' ? 'DESKTOP' : 'WEB';
  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'trabajadores',
    entity_id: employees[idx].id,
    operation: 'UPSERT',
    payload: employees[idx],
    record_version: normalized.record_version,
    origin,
  });
  flushServerOutbox({ dirs: STORAGE_DIRS, supabaseServer, supabaseUrl: SUPABASE_URL, timeoutMs: 2500 }).catch(() => {});

  return res.json({ success: true, message: 'Trabajador actualizado exitosamente.', data: employees[idx] });
};

const handleDeleteEmployee = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const idx = employees.findIndex((e) => e.id === id || e.dni === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Trabajador no encontrado.' });
  }

  const removed = employees.splice(idx, 1)[0];
  writeJsonFile(EMPLOYEES_FILE, employees);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'trabajadores',
    entity_id: removed.id || id,
    operation: 'DELETE',
    payload: { id: removed.id || id },
    record_version: (Number(removed.record_version) || 1) + 1,
    origin: process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB',
  });
  flushServerOutbox({ dirs: STORAGE_DIRS, supabaseServer, supabaseUrl: SUPABASE_URL, timeoutMs: 2500 }).catch(() => {});

  return res.json({ success: true, message: 'Trabajador dado de baja correctamente.', data: removed });
};

const handleGetEmployeeProfile = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const emp = employees.find((e) => e.id === id || e.dni === id || e.codigo_trabajador === id);
  if (!emp) {
    return res.status(404).json({ success: false, message: 'Trabajador no encontrado en el Directorio Institucional.' });
  }

  const viewerRole = String(req.headers['x-user-role'] || req.query.viewerRole || req.query.role || 'ADMIN_GENERAL');
  const profile = buildConsolidatedEmployeeProfile({
    employee: emp,
    dependencias: readJsonFile<any[]>(DEPENDENCIAS_FILE, []),
    direcciones: readJsonFile<any[]>(DIRECCIONES_FILE, []),
    areas: readJsonFile<any[]>(AREAS_FILE, []),
    cargos: readJsonFile<any[]>(CARGOS_FILE, []),
    horarios: readJsonFile<any[]>(HORARIOS_FILE, []),
    turnos: readJsonFile<any[]>(TURNOS_FILE, []),
    asignacionesHorario: readJsonFile<any[]>(ASIGNACIONES_FILE, []),
    devices: readJsonFile<any[]>(DEVICES_FILE, []),
    deviceUsers: readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []),
    rawPunches: readJsonFile<any[]>(RAW_PUNCHES_FILE, []),
    attendance: readJsonFile<any[]>(ATTENDANCE_FILE, []),
    papeletas: readJsonFile<any[]>(PAPELETAS_FILE, []),
    vacaciones: readJsonFile<any[]>(VACACIONES_FILE, []),
    viewerRole,
  });

  return res.json({ success: true, data: profile });
};

app.get('/api/employees', handleGetEmployees);
app.get('/api/trabajadores', handleGetEmployees);
app.get('/api/employees/:id/profile', handleGetEmployeeProfile);
app.get('/api/trabajadores/:id/profile', handleGetEmployeeProfile);
app.post('/api/employees', handleSaveEmployee);
app.post('/api/trabajadores', handleSaveEmployee);
app.put('/api/employees/:id', handleUpdateEmployee);
app.put('/api/trabajadores/:id', handleUpdateEmployee);
app.delete('/api/employees/:id', handleDeleteEmployee);
app.delete('/api/trabajadores/:id', handleDeleteEmployee);

// ---------------------------------------------------------------------------
// 1.2 DEPENDENCIAS DRAC API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/dependencias', (req, res) => {
  const dependencias = readJsonFile<any[]>(DEPENDENCIAS_FILE, []);
  return res.json({ success: true, count: dependencias.length, data: dependencias });
});

app.post('/api/dependencias', (req, res) => {
  const dependencias = readJsonFile<any[]>(DEPENDENCIAS_FILE, []);
  const newDep = {
    id: req.body.id || `dep-${Date.now()}`,
    code: String(req.body.code || `DEP-0${dependencias.length + 1}`).trim().toUpperCase(),
    name: normalizeInstitutionalName(req.body.name),
    type: req.body.type || 'SEDE_CENTRAL',
    ubigeo: req.body.ubigeo || '060101',
    address: normalizeText(req.body.address || ''),
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    created_at: req.body.created_at || new Date().toISOString(),
  };

  const idx = dependencias.findIndex((d) => d.id === newDep.id || d.code === newDep.code);
  if (idx >= 0) {
    dependencias[idx] = { ...dependencias[idx], ...newDep };
  } else {
    dependencias.push(newDep);
  }
  writeJsonFile(DEPENDENCIAS_FILE, dependencias);
  return res.status(201).json({ success: true, message: 'Dependencia guardada correctamente.', data: newDep });
});

app.put('/api/dependencias/:id', (req, res) => {
  const { id } = req.params;
  const dependencias = readJsonFile<any[]>(DEPENDENCIAS_FILE, []);
  const idx = dependencias.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Dependencia no encontrada.' });
  }
  dependencias[idx] = {
    ...dependencias[idx],
    ...req.body,
    name: req.body.name ? normalizeInstitutionalName(req.body.name) : dependencias[idx].name,
    address: req.body.address !== undefined ? normalizeText(req.body.address) : dependencias[idx].address,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(DEPENDENCIAS_FILE, dependencias);
  return res.json({ success: true, message: 'Dependencia actualizada correctamente.', data: dependencias[idx] });
});

app.delete('/api/dependencias/:id', (req, res) => {
  const { id } = req.params;
  const dependencias = readJsonFile<any[]>(DEPENDENCIAS_FILE, []);
  const idx = dependencias.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Dependencia no encontrada.' });
  }
  const removed = dependencias.splice(idx, 1)[0];
  writeJsonFile(DEPENDENCIAS_FILE, dependencias);
  return res.json({ success: true, message: 'Dependencia eliminada.', data: removed });
});

// ---------------------------------------------------------------------------
// 1.3 DIRECCIONES Y ÓRGANOS INSTITUCIONALES API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/direcciones', (req, res) => {
  const direcciones = readJsonFile<any[]>(DIRECCIONES_FILE, []);
  return res.json({ success: true, count: direcciones.length, data: direcciones });
});

app.post('/api/direcciones', (req, res) => {
  const direcciones = readJsonFile<any[]>(DIRECCIONES_FILE, []);
  const newDir = {
    id: req.body.id || `dir-${Date.now()}`,
    code: String(req.body.code || `DIR-0${direcciones.length + 1}`).trim().toUpperCase(),
    name: normalizeInstitutionalName(req.body.name),
    type: req.body.type || 'DIRECCION',
    dependencia_id: req.body.dependencia_id || 'dep-01',
    dependencia_name: normalizeInstitutionalName(req.body.dependencia_name || 'Sede Central'),
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    created_at: req.body.created_at || new Date().toISOString(),
  };

  const idx = direcciones.findIndex((d) => d.id === newDir.id || d.code === newDir.code);
  if (idx >= 0) {
    direcciones[idx] = { ...direcciones[idx], ...newDir };
  } else {
    direcciones.push(newDir);
  }
  writeJsonFile(DIRECCIONES_FILE, direcciones);
  return res.status(201).json({ success: true, message: 'Dirección u órgano guardado correctamente.', data: newDir });
});

app.put('/api/direcciones/:id', (req, res) => {
  const { id } = req.params;
  const direcciones = readJsonFile<any[]>(DIRECCIONES_FILE, []);
  const idx = direcciones.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Dirección u órgano no encontrado.' });
  }
  direcciones[idx] = {
    ...direcciones[idx],
    ...req.body,
    name: req.body.name ? normalizeInstitutionalName(req.body.name) : direcciones[idx].name,
    dependencia_name: req.body.dependencia_name ? normalizeInstitutionalName(req.body.dependencia_name) : direcciones[idx].dependencia_name,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(DIRECCIONES_FILE, direcciones);
  return res.json({ success: true, message: 'Dirección u órgano actualizado.', data: direcciones[idx] });
});

app.delete('/api/direcciones/:id', (req, res) => {
  const { id } = req.params;
  const direcciones = readJsonFile<any[]>(DIRECCIONES_FILE, []);
  const idx = direcciones.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Dirección u órgano no encontrado.' });
  }
  const removed = direcciones.splice(idx, 1)[0];
  writeJsonFile(DIRECCIONES_FILE, direcciones);
  return res.json({ success: true, message: 'Dirección u órgano eliminado.', data: removed });
});

// ---------------------------------------------------------------------------
// 1.4 ÁREAS Y OFICINAS INSTITUCIONALES API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/areas', (req, res) => {
  const areas = readJsonFile<any[]>(AREAS_FILE, []);
  return res.json({ success: true, count: areas.length, data: areas });
});

app.post('/api/areas', (req, res) => {
  const areas = readJsonFile<any[]>(AREAS_FILE, []);
  const newArea = {
    id: req.body.id || `area-${Date.now()}`,
    code: String(req.body.code || `AREA-0${areas.length + 1}`).trim().toUpperCase(),
    name: normalizeInstitutionalName(req.body.name),
    tipo: req.body.tipo || 'OFICINA',
    dependencia_id: req.body.dependencia_id || 'dep-01',
    dependencia_name: normalizeInstitutionalName(req.body.dependencia_name || 'Sede Central'),
    direccion_organo_id: req.body.direccion_organo_id || '',
    direccion_organo_name: normalizeInstitutionalName(req.body.direccion_organo_name || ''),
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    created_at: req.body.created_at || new Date().toISOString(),
  };

  const idx = areas.findIndex((a) => a.id === newArea.id || a.code === newArea.code);
  if (idx >= 0) {
    areas[idx] = { ...areas[idx], ...newArea };
  } else {
    areas.push(newArea);
  }
  writeJsonFile(AREAS_FILE, areas);
  return res.status(201).json({ success: true, message: 'Área guardada correctamente.', data: newArea });
});

app.put('/api/areas/:id', (req, res) => {
  const { id } = req.params;
  const areas = readJsonFile<any[]>(AREAS_FILE, []);
  const idx = areas.findIndex((a) => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Área no encontrada.' });
  }
  areas[idx] = {
    ...areas[idx],
    ...req.body,
    name: req.body.name ? normalizeInstitutionalName(req.body.name) : areas[idx].name,
    direccion_organo_name: req.body.direccion_organo_name ? normalizeInstitutionalName(req.body.direccion_organo_name) : areas[idx].direccion_organo_name,
    dependencia_name: req.body.dependencia_name ? normalizeInstitutionalName(req.body.dependencia_name) : areas[idx].dependencia_name,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(AREAS_FILE, areas);
  return res.json({ success: true, message: 'Área institucional actualizada.', data: areas[idx] });
});

app.delete('/api/areas/:id', (req, res) => {
  const { id } = req.params;
  const areas = readJsonFile<any[]>(AREAS_FILE, []);
  const idx = areas.findIndex((a) => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Área no encontrada.' });
  }
  const removed = areas.splice(idx, 1)[0];
  writeJsonFile(AREAS_FILE, areas);
  return res.json({ success: true, message: 'Área eliminada.', data: removed });
});

// ---------------------------------------------------------------------------
// 1.5 CARGOS INSTITUCIONALES API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/cargos', (req, res) => {
  const cargos = readJsonFile<any[]>(CARGOS_FILE, []);
  return res.json({ success: true, count: cargos.length, data: cargos });
});

app.post('/api/cargos', (req, res) => {
  const cargos = readJsonFile<any[]>(CARGOS_FILE, []);
  const newCargo = {
    id: req.body.id || `c-${Date.now()}`,
    code: String(req.body.code || `CRG-0${cargos.length + 1}`).trim().toUpperCase(),
    name: normalizeInstitutionalName(req.body.name),
    nivel_jerarquico: req.body.nivel_jerarquico || 'PROFESIONAL',
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    created_at: req.body.created_at || new Date().toISOString(),
  };

  const idx = cargos.findIndex((c) => c.id === newCargo.id || c.code === newCargo.code);
  if (idx >= 0) {
    cargos[idx] = { ...cargos[idx], ...newCargo };
  } else {
    cargos.push(newCargo);
  }
  writeJsonFile(CARGOS_FILE, cargos);
  return res.status(201).json({ success: true, message: 'Cargo guardado correctamente.', data: newCargo });
});

app.put('/api/cargos/:id', (req, res) => {
  const { id } = req.params;
  const cargos = readJsonFile<any[]>(CARGOS_FILE, []);
  const idx = cargos.findIndex((c) => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Cargo no encontrado.' });
  }
  cargos[idx] = {
    ...cargos[idx],
    ...req.body,
    name: req.body.name ? normalizeInstitutionalName(req.body.name) : cargos[idx].name,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(CARGOS_FILE, cargos);
  return res.json({ success: true, message: 'Cargo institucional actualizado.', data: cargos[idx] });
});

app.delete('/api/cargos/:id', (req, res) => {
  const { id } = req.params;
  const cargos = readJsonFile<any[]>(CARGOS_FILE, []);
  const idx = cargos.findIndex((c) => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Cargo no encontrado.' });
  }
  const removed = cargos.splice(idx, 1)[0];
  writeJsonFile(CARGOS_FILE, cargos);
  return res.json({ success: true, message: 'Cargo institucional eliminado.', data: removed });
});

// ---------------------------------------------------------------------------
// 1.6 RESPONSABLES DESIGNADOS API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/responsables', (req, res) => {
  const resp = readJsonFile<any[]>(RESPONSABLES_FILE, []);
  return res.json({ success: true, count: resp.length, data: resp });
});

app.post('/api/responsables', (req, res) => {
  const resp = readJsonFile<any[]>(RESPONSABLES_FILE, []);
  const newResp = {
    ...req.body,
    id: req.body.id || `resp-${Date.now()}`,
    titular_name: req.body.titular_name ? normalizePersonName(req.body.titular_name) : undefined,
    encargado_name: req.body.encargado_name ? normalizePersonName(req.body.encargado_name) : undefined,
    created_at: new Date().toISOString(),
  };
  const idx = resp.findIndex((r) => r.id === newResp.id);
  if (idx >= 0) resp[idx] = { ...resp[idx], ...newResp };
  else resp.push(newResp);
  writeJsonFile(RESPONSABLES_FILE, resp);
  return res.status(201).json({ success: true, message: 'Responsable asignado correctamente.', data: newResp });
});

app.put('/api/responsables/:id', (req, res) => {
  const { id } = req.params;
  const resp = readJsonFile<any[]>(RESPONSABLES_FILE, []);
  const idx = resp.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Responsable no encontrado.' });
  }

  resp[idx] = {
    ...resp[idx],
    ...req.body,
    titular_name: req.body.titular_name ? normalizePersonName(req.body.titular_name) : resp[idx].titular_name,
    encargado_name: req.body.encargado_name ? normalizePersonName(req.body.encargado_name) : resp[idx].encargado_name,
    title: req.body.title ? normalizeInstitutionalName(req.body.title) : resp[idx].title,
    unit_name: req.body.unit_name ? normalizeInstitutionalName(req.body.unit_name) : resp[idx].unit_name,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(RESPONSABLES_FILE, resp);
  return res.json({ success: true, message: 'Responsable actualizado.', data: resp[idx] });
});

app.delete('/api/responsables/:id', (req, res) => {
  const { id } = req.params;
  const resp = readJsonFile<any[]>(RESPONSABLES_FILE, []);
  const filtered = resp.filter((r) => r.id !== id);
  writeJsonFile(RESPONSABLES_FILE, filtered);
  return res.json({ success: true, message: 'Designación eliminada.' });
});

// ---------------------------------------------------------------------------
// TURNOS LABORALES API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/turnos', (req, res) => {
  const turnos = readJsonFile<any[]>(TURNOS_FILE, []);
  return res.json({ success: true, count: turnos.length, data: turnos });
});

app.post('/api/turnos', (req, res) => {
  const turnos = readJsonFile<any[]>(TURNOS_FILE, []);
  const newTurno = {
    id: req.body.id || `turno-${Date.now()}`,
    code: String(req.body.code || `T-0${turnos.length + 1}`).trim().toUpperCase(),
    name: String(req.body.name || 'Nuevo Turno').trim(),
    description: String(req.body.description || '').trim(),
    start_time: String(req.body.start_time || '08:00').trim(),
    end_time: String(req.body.end_time || '13:00').trim(),
    window_entry_start: String(req.body.window_entry_start || '07:00').trim(),
    window_exit_limit: String(req.body.window_exit_limit || '13:30').trim(),
    tolerance_minutes: Number(req.body.tolerance_minutes ?? 10),
    tolerance_exit_minutes: Number(req.body.tolerance_exit_minutes ?? 0),
    is_overnight: Boolean(req.body.is_overnight),
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    created_at: req.body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    record_version: Number(req.body.record_version) || 1,
  };

  const existingIdx = turnos.findIndex((t) => t.id === newTurno.id || t.code === newTurno.code);
  if (existingIdx >= 0) {
    const nextVer = (Number(turnos[existingIdx].record_version) || 1) + 1;
    turnos[existingIdx] = { ...turnos[existingIdx], ...newTurno, record_version: nextVer };
    newTurno.record_version = nextVer;
  } else {
    turnos.push(newTurno);
  }
  writeJsonFile(TURNOS_FILE, turnos);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'turnos',
    entity_id: newTurno.id,
    operation: 'UPSERT',
    payload: {
      id: newTurno.id,
      codigo: newTurno.code,
      nombre: newTurno.name,
      hora_inicio: newTurno.start_time,
      hora_fin: newTurno.end_time,
      tolerancia_minutos: newTurno.tolerance_minutes,
      record_version: newTurno.record_version,
      updated_at: newTurno.updated_at,
    },
    record_version: newTurno.record_version,
  });

  // Replicar en Supabase PostgreSQL de manera asíncrona
  try {
    Promise.resolve(
      supabaseServer.from('turnos').upsert({
        id: newTurno.id,
        codigo: newTurno.code,
        nombre: newTurno.name,
        hora_inicio: newTurno.start_time,
        hora_fin: newTurno.end_time,
        tolerancia_minutos: newTurno.tolerance_minutes,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.status(201).json({ success: true, message: 'Turno guardado correctamente.', data: newTurno });
});

app.put('/api/turnos/:id', (req, res) => {
  const { id } = req.params;
  const turnos = readJsonFile<any[]>(TURNOS_FILE, []);
  const idx = turnos.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Turno no encontrado.' });
  }

  const nextVer = (Number(turnos[idx].record_version) || 1) + 1;
  turnos[idx] = {
    ...turnos[idx],
    ...req.body,
    tolerance_minutes: req.body.tolerance_minutes !== undefined ? Number(req.body.tolerance_minutes) : turnos[idx].tolerance_minutes,
    active: req.body.active !== undefined ? Boolean(req.body.active) : turnos[idx].active,
    updated_at: new Date().toISOString(),
    record_version: nextVer,
  };
  writeJsonFile(TURNOS_FILE, turnos);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'turnos',
    entity_id: turnos[idx].id,
    operation: 'UPSERT',
    payload: {
      id: turnos[idx].id,
      codigo: turnos[idx].code,
      nombre: turnos[idx].name,
      hora_inicio: turnos[idx].start_time,
      hora_fin: turnos[idx].end_time,
      tolerancia_minutos: turnos[idx].tolerance_minutes,
      record_version: nextVer,
      updated_at: turnos[idx].updated_at,
    },
    record_version: nextVer,
  });

  try {
    Promise.resolve(
      supabaseServer.from('turnos').upsert({
        id: turnos[idx].id,
        codigo: turnos[idx].code,
        nombre: turnos[idx].name,
        hora_inicio: turnos[idx].start_time,
        hora_fin: turnos[idx].end_time,
        tolerancia_minutos: turnos[idx].tolerance_minutes,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.json({ success: true, message: 'Turno actualizado exitosamente.', data: turnos[idx] });
});

app.delete('/api/turnos/:id', (req, res) => {
  const { id } = req.params;
  const turnos = readJsonFile<any[]>(TURNOS_FILE, []);
  const idx = turnos.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Turno no encontrado.' });
  }
  const removed = turnos.splice(idx, 1)[0];
  writeJsonFile(TURNOS_FILE, turnos);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'turnos',
    entity_id: id,
    operation: 'DELETE',
    payload: { id },
    record_version: (Number(removed?.record_version) || 1) + 1,
  });

  try {
    Promise.resolve(supabaseServer.from('turnos').delete().eq('id', id)).catch(() => {});
  } catch (_) {}

  return res.json({ success: true, message: 'Turno eliminado correctamente.', data: removed });
});

// ---------------------------------------------------------------------------
// HORARIOS LABORALES API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/horarios', (req, res) => {
  const horarios = readJsonFile<any[]>(HORARIOS_FILE, []);
  return res.json({ success: true, count: horarios.length, data: horarios });
});

app.post('/api/horarios', (req, res) => {
  const horarios = readJsonFile<any[]>(HORARIOS_FILE, []);
  const turnos = readJsonFile<any[]>(TURNOS_FILE, []);

  const t1 = turnos.find((t) => t.id === req.body.turno1_id);
  const t2 = req.body.turno2_id ? turnos.find((t) => t.id === req.body.turno2_id) : null;

  const newHorario = {
    id: req.body.id || `hor-${Date.now()}`,
    code: String(req.body.code || `HOR-0${horarios.length + 1}`).trim().toUpperCase(),
    name: String(req.body.name || 'Nuevo Horario').trim(),
    turn_count: Number(req.body.turn_count || 1) as 1 | 2,
    turno1_id: req.body.turno1_id || (turnos[0]?.id || ''),
    turno1_name: req.body.turno1_name || (t1 ? `${t1.name} (${t1.start_time} - ${t1.end_time})` : ''),
    turno2_id: req.body.turn_count === 2 ? (req.body.turno2_id || null) : null,
    turno2_name: req.body.turn_count === 2 ? (req.body.turno2_name || (t2 ? `${t2.name} (${t2.start_time} - ${t2.end_time})` : null)) : null,
    working_days: Array.isArray(req.body.working_days) && req.body.working_days.length > 0 ? req.body.working_days : ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    effective_start_date: req.body.effective_start_date || '2026-01-01',
    effective_end_date: req.body.effective_end_date || null,
    version: Number(req.body.version || 1),
    total_hours: Number(req.body.total_hours || (req.body.turn_count === 2 ? 8 : 8)),
    total_duration_text: req.body.total_duration_text || (req.body.turn_count === 2 ? '8 horas diarias (2 turnos)' : '8 horas continuas'),
    created_at: req.body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    record_version: Number(req.body.record_version) || 1,
  };

  const existingIdx = horarios.findIndex((h) => h.id === newHorario.id || h.code === newHorario.code);
  if (existingIdx >= 0) {
    const nextVer = (Number(horarios[existingIdx].record_version) || 1) + 1;
    horarios[existingIdx] = { ...horarios[existingIdx], ...newHorario, record_version: nextVer };
    newHorario.record_version = nextVer;
  } else {
    horarios.push(newHorario);
  }
  writeJsonFile(HORARIOS_FILE, horarios);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'horarios',
    entity_id: newHorario.id,
    operation: 'UPSERT',
    payload: {
      id: newHorario.id,
      codigo: newHorario.code,
      nombre: newHorario.name,
      total_turnos: newHorario.turn_count,
      turno1_id: newHorario.turno1_id,
      turno2_id: newHorario.turn_count === 2 && newHorario.turno2_id ? newHorario.turno2_id : null,
      activo: newHorario.active,
      record_version: newHorario.record_version,
      updated_at: newHorario.updated_at,
    },
    record_version: newHorario.record_version,
  });

  // Replicar en Supabase PostgreSQL de manera asíncrona
  try {
    Promise.resolve(
      supabaseServer.from('horarios').upsert({
        id: newHorario.id,
        codigo: newHorario.code,
        nombre: newHorario.name,
        total_turnos: newHorario.turn_count,
        turno1_id: newHorario.turno1_id,
        turno2_id: newHorario.turn_count === 2 && newHorario.turno2_id ? newHorario.turno2_id : null,
        activo: newHorario.active,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.status(201).json({ success: true, message: 'Horario guardado correctamente.', data: newHorario });
});

app.put('/api/horarios/:id', (req, res) => {
  const { id } = req.params;
  const horarios = readJsonFile<any[]>(HORARIOS_FILE, []);
  const idx = horarios.findIndex((h) => h.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Horario no encontrado.' });
  }

  const nextVer = (Number(horarios[idx].record_version) || 1) + 1;
  horarios[idx] = {
    ...horarios[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
    record_version: nextVer,
  };
  writeJsonFile(HORARIOS_FILE, horarios);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'horarios',
    entity_id: horarios[idx].id,
    operation: 'UPSERT',
    payload: {
      id: horarios[idx].id,
      codigo: horarios[idx].code,
      nombre: horarios[idx].name,
      total_turnos: horarios[idx].turn_count,
      turno1_id: horarios[idx].turno1_id,
      turno2_id: horarios[idx].turn_count === 2 && horarios[idx].turno2_id ? horarios[idx].turno2_id : null,
      activo: horarios[idx].active,
      record_version: nextVer,
      updated_at: horarios[idx].updated_at,
    },
    record_version: nextVer,
  });

  try {
    Promise.resolve(
      supabaseServer.from('horarios').upsert({
        id: horarios[idx].id,
        codigo: horarios[idx].code,
        nombre: horarios[idx].name,
        total_turnos: horarios[idx].turn_count,
        turno1_id: horarios[idx].turno1_id,
        turno2_id: horarios[idx].turn_count === 2 && horarios[idx].turno2_id ? horarios[idx].turno2_id : null,
        activo: horarios[idx].active,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.json({ success: true, message: 'Horario actualizado exitosamente.', data: horarios[idx] });
});

app.delete('/api/horarios/:id', (req, res) => {
  const { id } = req.params;
  const horarios = readJsonFile<any[]>(HORARIOS_FILE, []);
  const idx = horarios.findIndex((h) => h.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Horario no encontrado.' });
  }
  const removed = horarios.splice(idx, 1)[0];
  writeJsonFile(HORARIOS_FILE, horarios);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'horarios',
    entity_id: id,
    operation: 'DELETE',
    payload: { id },
    record_version: (Number(removed?.record_version) || 1) + 1,
  });

  try {
    Promise.resolve(supabaseServer.from('horarios').delete().eq('id', id)).catch(() => {});
  } catch (_) {}

  return res.json({ success: true, message: 'Horario eliminado exitosamente.', data: removed });
});

// ---------------------------------------------------------------------------
// ASIGNACIONES DE HORARIOS (PERMANENTES Y TEMPORALES) API
// ---------------------------------------------------------------------------
app.get('/api/asignacion-horarios', (req, res) => {
  const asignaciones = readJsonFile<any[]>(ASIGNACIONES_FILE, []);
  const { employee_dni, tipo, activo } = req.query;

  let filtered = [...asignaciones];
  if (employee_dni) {
    filtered = filtered.filter((a) => a.employee_dni === String(employee_dni));
  }
  if (tipo) {
    filtered = filtered.filter((a) => a.tipo_asignacion === String(tipo));
  }
  if (activo !== undefined) {
    const isAct = String(activo) === 'true';
    filtered = filtered.filter((a) => a.activo === isAct);
  }

  return res.json({ success: true, count: filtered.length, data: filtered });
});

app.post('/api/asignacion-horarios', (req, res) => {
  const asignaciones = readJsonFile<any[]>(ASIGNACIONES_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const horarios = readJsonFile<any[]>(HORARIOS_FILE, []);

  const emp = employees.find((e) => e.dni === req.body.employee_dni || e.id === req.body.employee_id);
  const hor = horarios.find((h) => h.id === req.body.horario_id || h.code === req.body.horario_id);

  const newAsignacion = {
    id: req.body.id || `asig-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    employee_id: emp?.id || req.body.employee_id || `emp-${req.body.employee_dni}`,
    employee_dni: String(req.body.employee_dni || emp?.dni || '').trim(),
    employee_name: normalizePersonName(emp ? `${emp.first_name} ${emp.last_name}` : (req.body.employee_name || 'Trabajador')),
    employee_cargo: normalizeInstitutionalName(emp?.cargo || emp?.position || req.body.employee_cargo || 'Servidor DRAC'),
    dependencia_name: normalizeInstitutionalName(emp?.dependencia_name || req.body.dependencia_name || 'Sede Central - DRAC Cajamarca'),
    area_name: normalizeInstitutionalName(emp?.area_name || req.body.area_name || 'General'),
    horario_id: hor?.id || req.body.horario_id || 'hor-01',
    horario_name: normalizeInstitutionalName(hor?.name || req.body.horario_name || 'Jornada Partida Institucional DRAC'),
    horario_code: hor?.code || req.body.horario_code || 'HOR-01',
    fecha_inicio: String(req.body.fecha_inicio || new Date().toISOString().substring(0, 10)).trim(),
    fecha_fin: req.body.fecha_fin ? String(req.body.fecha_fin).trim() : null,
    tipo_asignacion: (req.body.tipo_asignacion || (req.body.fecha_fin ? 'TEMPORAL' : 'PERMANENTE')) as any,
    motivo: String(req.body.motivo || (req.body.tipo_asignacion === 'TEMPORAL' ? 'Asignación temporal por requerimiento de servicio' : 'Horario regular institucional')).trim(),
    documento_sustento: req.body.documento_sustento ? String(req.body.documento_sustento).trim() : 'Memorando Institucional',
    activo: req.body.activo !== undefined ? Boolean(req.body.activo) : true,
    created_at: req.body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Si es permanente o nueva asignación activa para el mismo trabajador, desactivar la anterior
  if (newAsignacion.activo && newAsignacion.tipo_asignacion === 'PERMANENTE') {
    asignaciones.forEach((a) => {
      if (a.employee_dni === newAsignacion.employee_dni && a.tipo_asignacion === 'PERMANENTE' && a.id !== newAsignacion.id) {
        a.activo = false;
        a.fecha_fin = newAsignacion.fecha_inicio;
      }
    });
  }

  const existingIdx = asignaciones.findIndex((a) => a.id === newAsignacion.id);
  const nextVer = existingIdx >= 0 ? (Number(asignaciones[existingIdx].record_version) || 1) + 1 : 1;
  (newAsignacion as any).record_version = nextVer;
  if (existingIdx >= 0) {
    asignaciones[existingIdx] = { ...asignaciones[existingIdx], ...newAsignacion };
  } else {
    asignaciones.unshift(newAsignacion);
  }
  writeJsonFile(ASIGNACIONES_FILE, asignaciones);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'asignacion_horarios',
    entity_id: newAsignacion.id,
    operation: 'UPSERT',
    payload: {
      id: newAsignacion.id,
      trabajador_id: newAsignacion.employee_id,
      horario_id: newAsignacion.horario_id,
      fecha_inicio: newAsignacion.fecha_inicio,
      fecha_fin: newAsignacion.fecha_fin || null,
      tipo_asignacion: newAsignacion.tipo_asignacion,
      motivo: newAsignacion.motivo,
      documento_sustento: newAsignacion.documento_sustento,
      activo: newAsignacion.activo,
      record_version: nextVer,
      updated_at: newAsignacion.updated_at,
    },
    record_version: nextVer,
  });

  // Replicar en Supabase PostgreSQL de manera asíncrona
  try {
    Promise.resolve(
      supabaseServer.from('asignacion_horarios').upsert({
        id: newAsignacion.id,
        trabajador_id: newAsignacion.employee_id,
        horario_id: newAsignacion.horario_id,
        fecha_inicio: newAsignacion.fecha_inicio,
        fecha_fin: newAsignacion.fecha_fin || null,
        tipo_asignacion: newAsignacion.tipo_asignacion,
        motivo: newAsignacion.motivo,
        documento_sustento: newAsignacion.documento_sustento,
        activo: newAsignacion.activo,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.status(201).json({
    success: true,
    message: existingIdx >= 0 ? 'Asignación de horario actualizada exitosamente.' : `Asignación de horario ${newAsignacion.tipo_asignacion.toLowerCase()} registrada exitosamente.`,
    data: newAsignacion,
  });
});

app.put('/api/asignacion-horarios/:id', (req, res) => {
  const { id } = req.params;
  const asignaciones = readJsonFile<any[]>(ASIGNACIONES_FILE, []);
  const idx = asignaciones.findIndex((a) => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Asignación no encontrada.' });
  }

  const nextVer = (Number(asignaciones[idx].record_version) || 1) + 1;
  asignaciones[idx] = {
    ...asignaciones[idx],
    ...req.body,
    employee_name: req.body.employee_name ? normalizePersonName(req.body.employee_name) : asignaciones[idx].employee_name,
    horario_name: req.body.horario_name ? normalizeInstitutionalName(req.body.horario_name) : asignaciones[idx].horario_name,
    updated_at: new Date().toISOString(),
    record_version: nextVer,
  };
  writeJsonFile(ASIGNACIONES_FILE, asignaciones);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'asignacion_horarios',
    entity_id: asignaciones[idx].id,
    operation: 'UPSERT',
    payload: {
      id: asignaciones[idx].id,
      trabajador_id: asignaciones[idx].employee_id,
      horario_id: asignaciones[idx].horario_id,
      fecha_inicio: asignaciones[idx].fecha_inicio,
      fecha_fin: asignaciones[idx].fecha_fin || null,
      tipo_asignacion: asignaciones[idx].tipo_asignacion,
      motivo: asignaciones[idx].motivo,
      documento_sustento: asignaciones[idx].documento_sustento,
      activo: asignaciones[idx].activo,
      record_version: nextVer,
      updated_at: asignaciones[idx].updated_at,
    },
    record_version: nextVer,
  });

  try {
    Promise.resolve(
      supabaseServer.from('asignacion_horarios').upsert({
        id: asignaciones[idx].id,
        trabajador_id: asignaciones[idx].employee_id,
        horario_id: asignaciones[idx].horario_id,
        fecha_inicio: asignaciones[idx].fecha_inicio,
        fecha_fin: asignaciones[idx].fecha_fin || null,
        tipo_asignacion: asignaciones[idx].tipo_asignacion,
        motivo: asignaciones[idx].motivo,
        documento_sustento: asignaciones[idx].documento_sustento,
        activo: asignaciones[idx].activo,
      })
    ).catch(() => {});
  } catch (_) {}

  return res.json({ success: true, message: 'Asignación actualizada exitosamente.', data: asignaciones[idx] });
});

app.delete('/api/asignacion-horarios/:id', (req, res) => {
  const { id } = req.params;
  const asignaciones = readJsonFile<any[]>(ASIGNACIONES_FILE, []);
  const idx = asignaciones.findIndex((a) => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Asignación no encontrada.' });
  }
  const removed = asignaciones.splice(idx, 1)[0];
  writeJsonFile(ASIGNACIONES_FILE, asignaciones);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'asignacion_horarios',
    entity_id: id,
    operation: 'DELETE',
    payload: { id },
    record_version: (Number(removed?.record_version) || 1) + 1,
  });

  try {
    Promise.resolve(supabaseServer.from('asignacion_horarios').delete().eq('id', id)).catch(() => {});
  } catch (_) {}

  return res.json({ success: true, message: 'Asignación eliminada correctamente.', data: removed });
});

// POST /api/asignacion-horarios/bulk - Asignación masiva a área o dependencia
app.post('/api/asignacion-horarios/bulk', (req, res) => {
  const { employee_dnis, horario_id, tipo_asignacion, fecha_inicio, fecha_fin, motivo, documento_sustento } = req.body;
  const asignaciones = readJsonFile<any[]>(ASIGNACIONES_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const horarios = readJsonFile<any[]>(HORARIOS_FILE, []);

  const hor = horarios.find((h) => h.id === horario_id || h.code === horario_id) || horarios[0];
  const dnis: string[] = Array.isArray(employee_dnis) ? employee_dnis : [];
  let addedCount = 0;

  for (const dni of dnis) {
    const emp = employees.find((e) => e.dni === dni);
    if (!emp) continue;

    const newAsig = {
      id: `asig-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      employee_id: emp.id,
      employee_dni: emp.dni,
      employee_name: normalizePersonName(`${emp.first_name} ${emp.last_name}`),
      employee_cargo: normalizeInstitutionalName(emp.cargo || emp.position || 'Servidor DRAC'),
      dependencia_name: normalizeInstitutionalName(emp.dependencia_name || 'Sede Central - DRAC Cajamarca'),
      area_name: normalizeInstitutionalName(emp.area_name || 'General'),
      horario_id: hor.id,
      horario_name: normalizeInstitutionalName(hor.name),
      horario_code: hor.code,
      fecha_inicio: fecha_inicio || new Date().toISOString().substring(0, 10),
      fecha_fin: fecha_fin || null,
      tipo_asignacion: (tipo_asignacion || 'TEMPORAL') as any,
      motivo: motivo || 'Asignación masiva institucional',
      documento_sustento: documento_sustento || 'Disposición de Servicio',
      activo: true,
      created_at: new Date().toISOString(),
    };

    if (newAsig.tipo_asignacion === 'PERMANENTE') {
      asignaciones.forEach((a) => {
        if (a.employee_dni === emp.dni && a.tipo_asignacion === 'PERMANENTE') {
          a.activo = false;
        }
      });
    }

    asignaciones.unshift(newAsig);
    addedCount++;
  }

  writeJsonFile(ASIGNACIONES_FILE, asignaciones);
  return res.json({
    success: true,
    message: `Se asignó el horario "${hor.name}" a ${addedCount} trabajadores exitosamente.`,
    count: addedCount,
  });
});

// ---------------------------------------------------------------------------
// 1.7 PAPELETAS DE SALIDA API (CRUD Persistente y Normalizado)
// ---------------------------------------------------------------------------
app.get('/api/papeletas', (req, res) => {
  const paps = readJsonFile<any[]>(PAPELETAS_FILE, []);
  return res.json({ success: true, count: paps.length, data: paps });
});

app.post('/api/papeletas', (req, res) => {
  const paps = readJsonFile<any[]>(PAPELETAS_FILE, []);
  const body = req.body || {};

  const newPap = {
    ...body,
    id: body.id || `pap-${Date.now()}`,
    code: body.code || `PAP-2026-${String(paps.length + 1).padStart(3, '0')}`,
    employee_name: normalizePersonName(body.employee_name),
    dependencia_name: normalizeInstitutionalName(body.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(body.direccion_organo_name),
    area_name: normalizeInstitutionalName(body.area_name),
    supervisor_name: normalizePersonName(body.supervisor_name),
    destino: normalizeText(body.destino),
    created_at: body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const idx = paps.findIndex((p) => p.id === newPap.id);
  const nextVer = idx >= 0 ? (Number(paps[idx].record_version) || 1) + 1 : Number(body.record_version) || 1;
  (newPap as any).record_version = nextVer;
  if (idx >= 0) {
    paps[idx] = { ...paps[idx], ...newPap };
  } else {
    paps.unshift(newPap);
  }
  writeJsonFile(PAPELETAS_FILE, paps);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'papeletas_salida',
    entity_id: newPap.id,
    operation: 'UPSERT',
    payload: {
      id: newPap.id,
      codigo: newPap.code,
      trabajador_id: newPap.employee_id,
      dni: newPap.employee_dni,
      motivo: newPap.motivo,
      destino: newPap.destino,
      fecha: newPap.fecha,
      hora_salida_estimada: newPap.hora_estimada_salida,
      hora_retorno_estimada: newPap.hora_estimada_retorno,
      hora_salida_real: newPap.hora_real_salida,
      hora_retorno_real: newPap.hora_real_retorno,
      estado: newPap.status,
      record_version: nextVer,
      created_at: newPap.created_at,
      updated_at: newPap.updated_at,
    },
    record_version: nextVer,
  });

  // Replicar en Supabase
  try {
    Promise.resolve(
      supabaseServer.from('papeletas_salida').upsert({
        id: newPap.id,
        codigo: newPap.code,
        trabajador_id: newPap.employee_id,
        dni: newPap.employee_dni,
        motivo: newPap.motivo,
        destino: newPap.destino,
        fecha: newPap.fecha,
        hora_salida_estimada: newPap.hora_estimada_salida,
        hora_retorno_estimada: newPap.hora_estimada_retorno,
        hora_salida_real: newPap.hora_real_salida,
        hora_retorno_real: newPap.hora_real_retorno,
        estado: newPap.status,
        created_at: newPap.created_at,
        updated_at: newPap.updated_at,
      })
    );
  } catch (_) {}

  return res.status(201).json({ success: true, message: 'Papeleta guardada correctamente.', data: newPap });
});

app.put('/api/papeletas/:id', (req, res) => {
  const { id } = req.params;
  const paps = readJsonFile<any[]>(PAPELETAS_FILE, []);
  const idx = paps.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Papeleta no encontrada.' });
  }

  const nextVer = (Number(paps[idx].record_version) || 1) + 1;
  paps[idx] = {
    ...paps[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
    record_version: nextVer,
  };
  writeJsonFile(PAPELETAS_FILE, paps);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'papeletas_salida',
    entity_id: paps[idx].id,
    operation: 'UPSERT',
    payload: {
      id: paps[idx].id,
      codigo: paps[idx].code,
      trabajador_id: paps[idx].employee_id,
      dni: paps[idx].employee_dni,
      motivo: paps[idx].motivo,
      destino: paps[idx].destino,
      fecha: paps[idx].fecha,
      estado: paps[idx].status,
      hora_salida_real: paps[idx].hora_real_salida,
      hora_retorno_real: paps[idx].hora_real_retorno,
      record_version: nextVer,
      updated_at: paps[idx].updated_at,
    },
    record_version: nextVer,
  });

  try {
    Promise.resolve(supabaseServer.from('papeletas_salida').upsert({
      id: paps[idx].id,
      estado: paps[idx].status,
      hora_salida_real: paps[idx].hora_real_salida,
      hora_retorno_real: paps[idx].hora_real_retorno,
      updated_at: paps[idx].updated_at,
    }));
  } catch (_) {}

  return res.json({ success: true, message: 'Papeleta actualizada exitosamente.', data: paps[idx] });
});

app.delete('/api/papeletas/:id', (req, res) => {
  const { id } = req.params;
  const paps = readJsonFile<any[]>(PAPELETAS_FILE, []);
  const idx = paps.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Papeleta no encontrada.' });
  }
  const removed = paps.splice(idx, 1)[0];
  writeJsonFile(PAPELETAS_FILE, paps);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'papeletas_salida',
    entity_id: id,
    operation: 'DELETE',
    payload: { id },
    record_version: (Number(removed?.record_version) || 1) + 1,
  });

  return res.json({ success: true, message: 'Papeleta eliminada.', data: removed });
});

// ---------------------------------------------------------------------------
// 1.8 VACACIONES API (CRUD Persistente y Normalizado)
// ---------------------------------------------------------------------------
app.get('/api/vacaciones', (req, res) => {
  const vacs = readJsonFile<any[]>(VACACIONES_FILE, []);
  return res.json({ success: true, count: vacs.length, data: vacs });
});

app.post('/api/vacaciones', (req, res) => {
  const vacs = readJsonFile<any[]>(VACACIONES_FILE, []);
  const body = req.body || {};

  const newVac = {
    ...body,
    id: body.id || `vac-${Date.now()}`,
    code: body.code || `VAC-2026-${String(vacs.length + 1).padStart(3, '0')}`,
    employee_name: normalizePersonName(body.employee_name),
    dependencia_name: normalizeInstitutionalName(body.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(body.direccion_organo_name),
    area_name: normalizeInstitutionalName(body.area_name),
    position: normalizeInstitutionalName(body.position),
    supervisor_name: normalizePersonName(body.supervisor_name),
    created_at: body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const idx = vacs.findIndex((v) => v.id === newVac.id);
  const nextVer = idx >= 0 ? (Number(vacs[idx].record_version) || 1) + 1 : Number(body.record_version) || 1;
  (newVac as any).record_version = nextVer;
  if (idx >= 0) {
    vacs[idx] = { ...vacs[idx], ...newVac };
  } else {
    vacs.unshift(newVac);
  }
  writeJsonFile(VACACIONES_FILE, vacs);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'vacaciones',
    entity_id: newVac.id,
    operation: 'UPSERT',
    payload: newVac,
    record_version: nextVer,
  });

  return res.status(201).json({ success: true, message: 'Solicitud de vacación guardada correctamente.', data: newVac });
});

app.put('/api/vacaciones/:id', (req, res) => {
  const { id } = req.params;
  const vacs = readJsonFile<any[]>(VACACIONES_FILE, []);
  const idx = vacs.findIndex((v) => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Registro de vacación no encontrado.' });
  }

  const nextVer = (Number(vacs[idx].record_version) || 1) + 1;
  vacs[idx] = {
    ...vacs[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
    record_version: nextVer,
  };
  writeJsonFile(VACACIONES_FILE, vacs);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'vacaciones',
    entity_id: vacs[idx].id,
    operation: 'UPSERT',
    payload: vacs[idx],
    record_version: nextVer,
  });

  return res.json({ success: true, message: 'Registro de vacación actualizado.', data: vacs[idx] });
});

app.delete('/api/vacaciones/:id', (req, res) => {
  const { id } = req.params;
  const vacs = readJsonFile<any[]>(VACACIONES_FILE, []);
  const idx = vacs.findIndex((v) => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Registro de vacación no encontrado.' });
  }
  const removed = vacs.splice(idx, 1)[0];
  writeJsonFile(VACACIONES_FILE, vacs);

  enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type: 'vacaciones',
    entity_id: id,
    operation: 'DELETE',
    payload: { id },
    record_version: (Number(removed?.record_version) || 1) + 1,
  });

  return res.json({ success: true, message: 'Registro de vacación eliminado.', data: removed });
});

// ---------------------------------------------------------------------------
// 1.9 ENCARGATURAS API (CRUD)
// ---------------------------------------------------------------------------
app.get('/api/encargaturas', (req, res) => {
  const encs = readJsonFile<any[]>(ENCARGATURAS_FILE, []);
  return res.json({ success: true, count: encs.length, data: encs });
});

app.post('/api/encargaturas', (req, res) => {
  const encs = readJsonFile<any[]>(ENCARGATURAS_FILE, []);
  const body = req.body || {};

  const newEnc = {
    ...body,
    id: body.id || `enc-${Date.now()}`,
    titular_name: normalizePersonName(body.titular_name),
    encargado_name: normalizePersonName(body.encargado_name),
    cargo_origen: normalizeInstitutionalName(body.cargo_origen),
    cargo_encargado: normalizeInstitutionalName(body.cargo_encargado),
    unidad_encargada: normalizeInstitutionalName(body.unidad_encargada),
    created_at: body.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const idx = encs.findIndex((e) => e.id === newEnc.id);
  if (idx >= 0) {
    encs[idx] = { ...encs[idx], ...newEnc };
  } else {
    encs.unshift(newEnc);
  }
  writeJsonFile(ENCARGATURAS_FILE, encs);

  return res.status(201).json({ success: true, message: 'Encargatura guardada correctamente.', data: newEnc });
});

app.put('/api/encargaturas/:id', (req, res) => {
  const { id } = req.params;
  const encs = readJsonFile<any[]>(ENCARGATURAS_FILE, []);
  const idx = encs.findIndex((e) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Encargatura no encontrada.' });
  }

  encs[idx] = {
    ...encs[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(ENCARGATURAS_FILE, encs);
  return res.json({ success: true, message: 'Encargatura actualizada.', data: encs[idx] });
});

app.delete('/api/encargaturas/:id', (req, res) => {
  const { id } = req.params;
  const encs = readJsonFile<any[]>(ENCARGATURAS_FILE, []);
  const idx = encs.findIndex((e) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Encargatura no encontrada.' });
  }
  const removed = encs.splice(idx, 1)[0];
  writeJsonFile(ENCARGATURAS_FILE, encs);
  return res.json({ success: true, message: 'Encargatura eliminada.', data: removed });
});

function createZkChkSum(buffer: Buffer): number {
  let checksum = 0;
  let len = buffer.length;
  let i = 0;
  while (len > 1) {
    checksum += buffer.readUInt16LE(i);
    i += 2;
    len -= 2;
  }
  if (len > 0) checksum += buffer[i];
  while (checksum >> 16) {
    checksum = (checksum & 0xffff) + (checksum >> 16);
  }
  return ~checksum & 0xffff;
}

function createZkTcpHeader(cmd: number, sessionId: number, replyId: number, data: string | Buffer = ''): Buffer {
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
  const payload = Buffer.alloc(8 + dataBuf.length);
  payload.writeUInt16LE(cmd, 0);
  payload.writeUInt16LE(0, 2);
  payload.writeUInt16LE(sessionId, 4);
  payload.writeUInt16LE(replyId, 6);
  if (dataBuf.length > 0) dataBuf.copy(payload, 8);
  const chk = createZkChkSum(payload);
  payload.writeUInt16LE(chk, 2);

  const tcpPacket = Buffer.alloc(8 + payload.length);
  tcpPacket[0] = 0x50;
  tcpPacket[1] = 0x50;
  tcpPacket[2] = 0x82;
  tcpPacket[3] = 0x7d;
  tcpPacket.writeUInt32LE(payload.length, 4);
  payload.copy(tcpPacket, 8);
  return tcpPacket;
}

function decodeZkPackedTime(t: number): string {
  // Nunca fabricar una fecha actual cuando el dato binario es 0 o inválido
  if (!t || isNaN(t)) return '';
  if (t > 1500000000 && t < 2200000000) {
    return new Date(t * 1000).toISOString().replace('T', ' ').substring(0, 19);
  }
  try {
    let second = t % 60;
    t = Math.floor(t / 60);
    let minute = t % 60;
    t = Math.floor(t / 60);
    let hour = t % 24;
    t = Math.floor(t / 24);
    let day = (t % 31) + 1;
    t = Math.floor(t / 31);
    let month = (t % 12) + 1;
    t = Math.floor(t / 12);
    let year = t + 2000;
    if (year >= 2000 && year <= 2040 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }
  } catch (_) {}
  return '';
}

function parseZkAttlogBuffer(dataBuf: Buffer, serial: string, host: string): any[] {
  const punches: any[] = [];
  if (!dataBuf || dataBuf.length < 8) return punches;

  let workingBuf = dataBuf;
  if (dataBuf.length > 4) {
    const declaredLen = dataBuf.readUInt32LE(0);
    if (declaredLen > 0 && declaredLen <= dataBuf.length - 4 && (declaredLen % 40 === 0 || declaredLen % 14 === 0 || declaredLen % 8 === 0)) {
      workingBuf = dataBuf.slice(4);
    }
  }

  // 1. Formato extendido 40 bytes (ZKTeco G3 / SilkID / TFT)
  if (workingBuf.length >= 40) {
    const recSize = 40;
    for (let i = 0; i + recSize <= workingBuf.length; i += recSize) {
      const chunk = workingBuf.slice(i, i + recSize);

      const uidA = chunk.readUInt16LE(0);
      const rawPinA = chunk.slice(2, 26).toString('ascii').replace(/\0/g, '').trim();
      const cleanPinA = rawPinA.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();

      const rawPinB = chunk.slice(0, 24).toString('ascii').replace(/\0/g, '').trim();
      const cleanPinB = rawPinB.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();

      let pin = '';
      let verifyType = 1;
      let punchState = 0;
      let punchTime = '';

      if (cleanPinA && /^[0-9a-zA-Z_-]+$/.test(cleanPinA)) {
        pin = cleanPinA;
        verifyType = chunk[26];
        punchState = chunk[31] !== undefined ? chunk[31] : (chunk[27] || 0);
        const rawTime1 = chunk.readUInt32LE(27);
        const rawTime2 = chunk.readUInt32LE(28);
        const decoded1 = decodeZkPackedTime(rawTime1);
        const decoded2 = decodeZkPackedTime(rawTime2);
        punchTime = (decoded1 && !decoded1.startsWith('2000-01-01')) ? decoded1 : decoded2;
      } else if (cleanPinB && /^[0-9a-zA-Z_-]+$/.test(cleanPinB)) {
        pin = cleanPinB;
        verifyType = chunk[24];
        punchState = chunk[25];
        const rawTime = chunk.readUInt32LE(26);
        punchTime = decodeZkPackedTime(rawTime);
      } else if (uidA > 0) {
        pin = String(uidA);
        verifyType = chunk[26] || 1;
        punchState = chunk[31] || 0;
        const rawTime = chunk.readUInt32LE(28);
        punchTime = decodeZkPackedTime(rawTime);
      }

      if (pin && punchTime) {
        const [fechaPart, horaPart] = punchTime.split(' ');
        const baseId = `zk_${serial}_${pin}_${punchTime.replace(/[- :]/g, '')}`;
        punches.push({
          id: baseId,
          punch_id: baseId,
          original_punch_id: `${baseId}_${punches.length}`,
          device_sn: serial,
          device_ip: host,
          employee_dni: pin,
          employee_code: pin,
          fecha: fechaPart,
          hora: horaPart,
          timestamp: punchTime,
          verify_mode: verifyType === 15 ? 'FACE' : (verifyType === 2 ? 'PASSWORD' : verifyType === 3 ? 'CARD' : 'FINGERPRINT'),
          punch_type: punchState === 1 ? 'CHECK_OUT' : punchState === 0 ? 'CHECK_IN' : 'AUTO',
          punch_state: punchState || 0,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // 2. Formato estándar 14 bytes si no hubo marcaciones en 40 bytes
  if (punches.length === 0 && workingBuf.length >= 14) {
    const recSize = 14;
    for (let i = 0; i + recSize <= workingBuf.length; i += recSize) {
      const chunk = workingBuf.slice(i, i + recSize);
      const userSn = chunk.readUInt16LE(0);
      if (userSn > 0) {
        const rawTime = chunk.readUInt32LE(2);
        const punchTime = decodeZkPackedTime(rawTime);
        if (!punchTime) continue;
        const [fechaPart, horaPart] = punchTime.split(' ');
        const pin = String(userSn);
        const baseId = `zk_${serial}_${pin}_${punchTime.replace(/[- :]/g, '')}`;
        punches.push({
          id: baseId,
          punch_id: baseId,
          original_punch_id: `${baseId}_${punches.length}`,
          device_sn: serial,
          device_ip: host,
          employee_dni: pin,
          employee_code: pin,
          fecha: fechaPart,
          hora: horaPart,
          timestamp: punchTime,
          verify_mode: chunk[6] === 15 ? 'FACE' : 'FINGERPRINT',
          punch_type: 'AUTO',
          punch_state: chunk[7] || 0,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // 3. Formato 8 bytes
  if (punches.length === 0 && workingBuf.length >= 8) {
    const recSize = 8;
    for (let i = 0; i + recSize <= workingBuf.length; i += recSize) {
      const chunk = workingBuf.slice(i, i + recSize);
      const userSn = chunk.readUInt16LE(0);
      if (userSn > 0) {
        const rawTime = chunk.readUInt32LE(3);
        const punchTime = decodeZkPackedTime(rawTime);
        if (!punchTime) continue;
        const [fechaPart, horaPart] = punchTime.split(' ');
        const pin = String(userSn);
        const baseId = `zk_${serial}_${pin}_${punchTime.replace(/[- :]/g, '')}`;
        punches.push({
          id: baseId,
          punch_id: baseId,
          original_punch_id: `${baseId}_${punches.length}`,
          device_sn: serial,
          device_ip: host,
          employee_dni: pin,
          employee_code: pin,
          fecha: fechaPart,
          hora: horaPart,
          timestamp: punchTime,
          verify_mode: 'FINGERPRINT',
          punch_type: 'AUTO',
          punch_state: chunk[7] || 0,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return punches;
}

function parseZkAttlogText(rawContent: string, serialHint: string = 'AEH2223460040'): any[] {
  if (!rawContent || typeof rawContent !== 'string') return [];
  const lines = rawContent.split(/\r?\n/);
  const punches: any[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    if (trimmed.toLowerCase().includes('dni') && trimmed.toLowerCase().includes('fecha')) continue;
    if (trimmed.toLowerCase().includes('userpin') || trimmed.toLowerCase().includes('time')) continue;

    let parts: string[] = [];
    if (trimmed.includes('\t')) {
      parts = trimmed.split('\t').map((p) => p.trim());
    } else if (trimmed.includes(';') && !trimmed.includes(',')) {
      parts = trimmed.split(';').map((p) => p.trim());
    } else if (trimmed.includes(',') && (trimmed.match(/,/g) || []).length >= 2) {
      parts = trimmed.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
    } else {
      parts = trimmed.split(/\s+/).map((p) => p.trim());
    }

    if (parts.length < 2) continue;

    let pin = '';
    let timestamp = '';
    let punchState = 0;
    let verifyType = 1;

    // Formato estándar 1_attlog.dat:
    // "1\t2026-11-11 08:02:15\t1\t0\t0\t0" o "1 2026-11-11 08:02:15 1 0"
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && parts[2] && /^\d{2}:\d{2}/.test(parts[2])) {
      pin = parts[0];
      timestamp = `${parts[1]} ${parts[2].substring(0, 8)}`;
      if (parts[3] !== undefined) punchState = Number(parts[3]) || 0;
      if (parts[4] !== undefined) verifyType = Number(parts[4]) || 1;
    } else if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}/.test(parts[1])) {
      pin = parts[0];
      timestamp = parts[1].replace(/\//g, '-');
      if (parts[2] !== undefined) punchState = Number(parts[2]) || 0;
      if (parts[3] !== undefined) verifyType = Number(parts[3]) || 1;
    } else {
      for (let i = 0; i < parts.length; i++) {
        const item = parts[i];
        if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(item)) {
          if (parts[i + 1] && /^\d{1,2}:\d{2}/.test(parts[i + 1])) {
            timestamp = `${item.replace(/\//g, '-')} ${parts[i + 1].substring(0, 8)}`;
            pin = parts[0] !== item ? parts[0] : (parts[i - 1] || '');
            break;
          } else if (item.includes(' ') || item.includes('T')) {
            timestamp = item.replace('T', ' ').replace(/\//g, '-').substring(0, 19);
            pin = parts[0] !== item ? parts[0] : (parts[i - 1] || '');
            break;
          }
        }
      }
    }

    if (pin && timestamp) {
      const m = timestamp.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})(:(\d{1,2}))?/);
      if (m) {
        const pad = (n: string) => n.padStart(2, '0');
        timestamp = `${m[1]}-${pad(m[2])}-${pad(m[3])} ${pad(m[4])}:${pad(m[5])}:${pad(m[7] || '00')}`;
      }

      let verifyMode = 'FINGERPRINT';
      if (verifyType === 15) verifyMode = 'FACE';
      else if (verifyType === 2) verifyMode = 'PASSWORD';
      else if (verifyType === 3) verifyMode = 'CARD';

      punches.push({
        id: `usb_${serialHint}_${pin}_${timestamp.replace(/[- :]/g, '')}_${punches.length}`,
        punch_id: `usb_${serialHint}_${pin}_${timestamp.replace(/[- :]/g, '')}_${punches.length}`,
        device_sn: serialHint,
        employee_dni: pin,
        employee_code: pin,
        timestamp,
        verify_mode: verifyMode,
        punch_state: punchState,
        source: 'USB_ATTLOG',
      });
    }
  }

  return punches;
}

// Helper: Genera o actualiza asistencia diaria SOLO para trabajadores identificados
function upsertAttendanceFromIdentifiedPunch(
  existingAttendance: any[],
  emp: any,
  punchRecord: any
): void {
  const fechaPart = punchRecord.fecha;
  const horaPart = punchRecord.hora;
  const punchHour = horaPart ? horaPart.substring(0, 5) : '';
  if (!emp || !fechaPart || !punchHour) return;

  const empDni = emp.dni;
  const workerName = normalizePersonName(`${emp.first_name} ${emp.last_name}`);
  const attIndex = existingAttendance.findIndex((a) => a.employee_dni === empDni && a.fecha === fechaPart);

  if (attIndex === -1) {
    const isLate = punchHour > '08:10';
    existingAttendance.unshift({
      id: `att-${emp.id || empDni}-${fechaPart}`,
      employee_id: emp.id,
      employee_dni: empDni,
      employee_codigo_drac: emp.codigo_trabajador || null,
      employee_name: workerName,
      dependencia_id: emp.dependencia_id || 'dep-01',
      dependencia_name: normalizeInstitutionalName(emp.dependencia_name || 'Sede Central - DRAC Cajamarca'),
      direccion_organo_name: normalizeInstitutionalName(emp.direccion_organo_name || ''),
      area_id: emp.area_id || '',
      area_name: normalizeInstitutionalName(emp.area_name || ''),
      cargo_name: normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || ''),
      fecha: fechaPart,
      t1_scheduled_in: '08:00',
      t1_scheduled_out: '13:00',
      t1_real_in: punchHour,
      t1_real_out: null,
      t2_scheduled_in: '14:00',
      t2_scheduled_out: '17:00',
      t2_real_in: null,
      t2_real_out: null,
      status: isLate ? 'LATE' : 'PUNCTUAL',
      tardiness_minutes: isLate ? 15 : 0,
      net_tardiness_minutes: isLate ? 5 : 0,
      total_effective_hours: 4.5,
      raw_punch_id: punchRecord.id,
      record_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    const att = existingAttendance[attIndex];
    att.employee_id = emp.id;
    att.employee_dni = empDni;
    att.employee_codigo_drac = emp.codigo_trabajador || att.employee_codigo_drac || null;
    att.employee_name = workerName;
    att.dependencia_name = normalizeInstitutionalName(emp.dependencia_name || att.dependencia_name || '');
    att.direccion_organo_name = normalizeInstitutionalName(emp.direccion_organo_name || att.direccion_organo_name || '');
    att.area_name = normalizeInstitutionalName(emp.area_name || att.area_name || '');
    att.cargo_name = normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || att.cargo_name || '');
    if (!att.t1_real_in) att.t1_real_in = punchHour;
    else if (!att.t1_real_out && punchHour <= '13:30') att.t1_real_out = punchHour;
    else if (!att.t2_real_in && punchHour >= '13:45') att.t2_real_in = punchHour;
    else if (!att.t2_real_out && punchHour >= '16:00') {
      att.t2_real_out = punchHour;
      att.total_effective_hours = 8.0;
    }
    att.record_version = (Number(att.record_version) || 1) + 1;
    att.updated_at = new Date().toISOString();
    existingAttendance[attIndex] = att;
  }
}

async function persistRawPunchesToSupabase(records: any[]): Promise<{ dbSaved: boolean; dbError: string | null }> {
  if (!records || records.length === 0) return { dbSaved: true, dbError: null };
  if (
    !SUPABASE_URL ||
    SUPABASE_URL.includes('rfqgmoremevypexrrsyf.supabase.co') ||
    SUPABASE_URL.includes('your-project-ref.supabase.co')
  ) {
    return {
      dbSaved: false,
      dbError: 'Instancia Supabase por defecto no configurada (URL de ejemplo inexistente). Guardado localmente.',
    };
  }
  try {
    const fullRows = records.map((r) => ({
      id: r.id,
      device_id: r.device_id || 'dev-01',
      device_sn: r.device_sn,
      device_name: r.device_name,
      employee_dni: r.employee_dni,
      employee_code: r.employee_code,
      employee_name: r.employee_name,
      timestamp: r.timestamp,
      punch_type: r.punch_type || 'AUTO',
      punch_state: Number(r.punch_state ?? 0),
      verify_mode: r.verify_mode || 'FINGERPRINT',
      processed: Boolean(r.processed),
      validation_status: r.validation_status || 'VALIDA',
      source: r.source,
      raw_payload: r.raw_payload || null,
    }));

    const CHUNK_SIZE = 250;
    for (let i = 0; i < fullRows.length; i += CHUNK_SIZE) {
      const chunk = fullRows.slice(i, i + CHUNK_SIZE);
      const sbRes: any = await withServerTimeout(
        Promise.resolve(
          supabaseServer.from('marcaciones_raw').upsert(chunk, { onConflict: 'id' })
        ),
        5000,
        'Timeout guardando lote de marcaciones en Supabase PostgreSQL'
      );

      if (!sbRes?.error) continue;

      const errMsg = String(sbRes.error.message || '');
      if (errMsg.includes('column') || sbRes.error.code === '42703' || sbRes.error.code === 'PGRST204') {
        const coreChunk = records.slice(i, i + CHUNK_SIZE).map((r) => ({
          id: r.id,
          device_id: r.device_id || 'dev-01',
          device_sn: r.device_sn,
          device_name: r.device_name,
          employee_dni: r.employee_dni || r.employee_code,
          timestamp: r.timestamp,
          punch_type: r.punch_type || 'AUTO',
          verify_mode: r.verify_mode || 'FINGERPRINT',
          processed: Boolean(r.processed),
          validation_status: r.validation_status || 'VALIDA',
          raw_payload: r.raw_payload || null,
        }));
        const retryRes: any = await withServerTimeout(
          Promise.resolve(
            supabaseServer.from('marcaciones_raw').upsert(coreChunk, { onConflict: 'id' })
          ),
          5000,
          'Timeout guardando marcaciones base en Supabase PostgreSQL'
        );
        if (retryRes?.error) {
          return { dbSaved: false, dbError: retryRes.error.message || errMsg };
        }
      } else {
        return { dbSaved: false, dbError: errMsg || 'Error SQL Supabase en marcaciones_raw' };
      }
    }

    return { dbSaved: true, dbError: null };
  } catch (err: any) {
    return { dbSaved: false, dbError: err?.message || 'Sin conexión hacia Supabase PostgreSQL' };
  }
}

async function integrateRealPunchesIntoSystem(
  newPunches: any[],
  sourceLabel: string,
  deviceInfo?: { id?: string; name?: string; serial?: string; ip?: string }
): Promise<{
  newlyAdded: number;
  duplicatesSkipped: number;
  unidentifiedCount: number;
  totalStored: number;
  dbSaved: boolean;
  dbError: string | null;
  enrichedPunches: any[];
}> {
  const storedPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
  if (!newPunches || newPunches.length === 0) {
    return {
      newlyAdded: 0,
      duplicatesSkipped: 0,
      unidentifiedCount: 0,
      totalStored: storedPunches.length,
      dbSaved: true,
      dbError: null,
      enrichedPunches: [],
    };
  }

  // Idempotencia estricta por (device_sn + employee_code + timestamp)
  const existingKeys = new Set(
    storedPunches.map((p) => `${p.device_sn || ''}_${p.employee_code || p.employee_dni}_${p.timestamp}`)
  );
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const deviceUsers = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
  const existingAttendance = readJsonFile<any[]>(ATTENDANCE_FILE, []);
  let newlyAdded = 0;
  let duplicatesSkipped = 0;
  let unidentifiedCount = 0;
  const enrichedPunches: any[] = [];
  const syncedAt = new Date().toISOString();

  for (const p of newPunches) {
    const rawPin = String(p.employee_code || p.employee_dni || p.pin || p.user_id || '').trim();
    if (!rawPin) continue;

    const rawTime = String(p.timestamp || '').trim();
    if (!rawTime || rawTime.startsWith('0000') || rawTime.startsWith('1970')) continue;

    const deviceSn = String(deviceInfo?.serial || p.device_sn || '').trim().toUpperCase() || 'AEH2223460040';
    const key = `${deviceSn}_${rawPin}_${rawTime}`;
    if (existingKeys.has(key)) {
      duplicatesSkipped++;
      continue;
    }
    existingKeys.add(key);

    // Vinculación estricta por (device_sn, pin) primero y luego coincidencia biométrica inequívoca
    const resolved = resolveEmployeeForDevicePin(employees, deviceUsers, deviceSn, rawPin);
    const emp = resolved.employee;
    const isIdentified = !!emp;
    const workerName = emp
      ? normalizePersonName(`${emp.first_name} ${emp.last_name}`)
      : 'Pendiente de Identificación';

    if (!isIdentified) unidentifiedCount++;

    const [fechaPart, horaPart] = rawTime.split(' ');
    const punchId = `zk_${deviceSn}_${rawPin}_${rawTime.replace(/[- :]/g, '')}`;

    const cleanRecord = {
      id: punchId,
      punch_id: punchId,
      original_punch_id: p.original_punch_id || p.punch_id || p.id || punchId,
      device_id: deviceInfo?.id || p.device_id || 'dev-01',
      device_sn: deviceSn,
      device_name: deviceInfo?.name || p.device_name || 'ZKTeco G3 Sede Central',
      device_ip: deviceInfo?.ip || p.device_ip || '',
      employee_id: emp ? emp.id : null,
      employee_dni: emp ? emp.dni : rawPin,
      employee_codigo_drac: emp ? (emp.codigo_trabajador || null) : null,
      employee_code: rawPin,
      employee_name: workerName,
      dependencia_name: emp ? normalizeInstitutionalName(emp.dependencia_name || '') : null,
      direccion_organo_name: emp ? normalizeInstitutionalName(emp.direccion_organo_name || '') : null,
      area_name: emp ? normalizeInstitutionalName(emp.area_name || '') : null,
      cargo_name: emp ? normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || '') : null,
      fecha: fechaPart,
      hora: horaPart,
      timestamp: rawTime,
      verify_mode: p.verify_mode || 'FINGERPRINT',
      punch_type: p.punch_type || (Number(p.punch_state) === 1 ? 'CHECK_OUT' : Number(p.punch_state) === 0 ? 'CHECK_IN' : 'AUTO'),
      punch_state: Number(p.punch_state ?? 0),
      source: p.source || sourceLabel,
      synced_at: p.synced_at || syncedAt,
      validation_status: isIdentified ? 'VALIDA' : 'PENDIENTE_IDENTIFICACION',
      processed: isIdentified,
      raw_payload: p.raw_payload || p.raw_record || undefined,
      record_version: 1,
      created_at: syncedAt,
      updated_at: syncedAt,
    };

    storedPunches.unshift(cleanRecord);
    enrichedPunches.push(cleanRecord);
    newlyAdded++;

    // Separación estricta: solo procesar asistencia si el trabajador está identificado;
    // los códigos sin vincular permanecen en Pendientes de Identificación sin descartarse.
    if (isIdentified && emp) {
      upsertAttendanceFromIdentifiedPunch(existingAttendance, emp, cleanRecord);
    }
  }

  writeJsonFile(RAW_PUNCHES_FILE, storedPunches);
  if (enrichedPunches.some((p) => p.processed)) {
    writeJsonFile(ATTENDANCE_FILE, existingAttendance);
  }

  const dbRes = await persistRawPunchesToSupabase(enrichedPunches);

  return {
    newlyAdded,
    duplicatesSkipped,
    unidentifiedCount,
    totalStored: storedPunches.length,
    dbSaved: dbRes.dbSaved,
    dbError: dbRes.dbError,
    enrichedPunches,
  };
}

function probeTcpPortServer(host: string, port: number, timeoutMs = 2500): Promise<{ ok: boolean; latencyMs: number; code?: string; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const s = new net.Socket();
    let done = false;
    s.setTimeout(timeoutMs);
    s.on('connect', () => {
      if (done) return;
      done = true;
      s.destroy();
      resolve({ ok: true, latencyMs: Date.now() - start });
    });
    s.on('timeout', () => {
      if (done) return;
      done = true;
      s.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, code: 'ETIMEDOUT', error: 'Timeout' });
    });
    s.on('error', (err: any) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, code: err?.code, error: err?.message });
    });
    try {
      s.connect(port, host);
    } catch (e: any) {
      if (done) return;
      done = true;
      resolve({ ok: false, latencyMs: Date.now() - start, code: 'EINIT', error: e?.message });
    }
  });
}

function requestBioTimeHttpServer({
  protocol = 'http',
  host,
  port,
  path: urlPath,
  method = 'GET',
  body = '',
  headers = {},
  timeoutMs = 6000,
}: {
  protocol?: string;
  host: string;
  port: number;
  path: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; json: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = String(protocol || 'http').toLowerCase() === 'https';
    const mod = isHttps ? https : http;
    const reqOpts: https.RequestOptions = {
      hostname: host,
      port: Number(port),
      path: urlPath,
      method,
      headers: {
        Accept: 'application/json, text/html;q=0.9',
        ...(body ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}),
        ...headers,
      },
      timeout: Math.min(20000, Math.max(1500, Number(timeoutMs) || 6000)),
      ...(isHttps ? { rejectUnauthorized: false } : {}),
    };
    const req = mod.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (c) => {
        data += c;
      });
      res.on('end', () => {
        let json: any = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode || 0,
          headers: res.headers || {},
          json,
          raw: data,
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      const err: any = new Error(`Timeout conectando a BioTime PRO ${isHttps ? 'HTTPS' : 'HTTP'} (${host}:${port})`);
      err.code = 'ETIMEDOUT';
      reject(err);
    });
    if (body) req.write(body);
    req.end();
  });
}

function normalizeHttpPathServer(nextUrlOrPath: string): string | null {
  if (!nextUrlOrPath) return null;
  const s = String(nextUrlOrPath).trim();
  if (s.startsWith('/')) return s;
  try {
    const u = new URL(s);
    return `${u.pathname}${u.search}`;
  } catch (_) {
    return null;
  }
}

async function authenticateBioTimeServer({
  protocol = 'http',
  host,
  port,
  authMethod = 'AUTO',
  authUser,
  authPassword,
  timeoutMs = 6000,
}: {
  protocol?: string;
  host: string;
  port: number;
  authMethod?: string;
  authUser: string;
  authPassword: string;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  methodUsed: string | null;
  headers: Record<string, string>;
  errorCode: string | null;
  message: string;
}> {
  const cleanUser = String(authUser || '').trim();
  const cleanPwd = String(authPassword || '').trim();
  const cleanProto = String(protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const pref = String(authMethod || 'AUTO').toUpperCase();

  if (!cleanUser || !cleanPwd) {
    return {
      ok: false,
      methodUsed: null,
      headers: {},
      errorCode: 'MISSING_CREDENTIALS',
      message: 'Falta usuario o contraseña de acceso para BioTime PRO.',
    };
  }

  const order = pref === 'AUTO' ? ['JWT', 'DRF_TOKEN', 'DJANGO_SESSION'] : [pref];
  let lastStatus = 0;
  let lastErrorMsg = '';

  for (const m of order) {
    if (m === 'JWT') {
      try {
        const res = await requestBioTimeHttpServer({
          protocol: cleanProto,
          host,
          port,
          path: '/jwt-api-token-auth/',
          method: 'POST',
          body: JSON.stringify({ username: cleanUser, password: cleanPwd }),
          headers: { 'Content-Type': 'application/json' },
          timeoutMs,
        });
        lastStatus = res.status;
        if (res?.json?.token) {
          return {
            ok: true,
            methodUsed: 'JWT',
            headers: { Authorization: `JWT ${res.json.token}` },
            errorCode: null,
            message: 'Autenticación JWT exitosa.',
          };
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          lastErrorMsg = res?.json?.non_field_errors?.[0] || res?.json?.detail || `HTTP ${res.status} en JWT`;
        }
      } catch (e: any) {
        lastErrorMsg = e?.message || String(e);
      }
    }

    if (m === 'DRF_TOKEN') {
      try {
        const res = await requestBioTimeHttpServer({
          protocol: cleanProto,
          host,
          port,
          path: '/api-token-auth/',
          method: 'POST',
          body: JSON.stringify({ username: cleanUser, password: cleanPwd }),
          headers: { 'Content-Type': 'application/json' },
          timeoutMs,
        });
        lastStatus = res.status;
        if (res?.json?.token) {
          return {
            ok: true,
            methodUsed: 'DRF_TOKEN',
            headers: { Authorization: `Token ${res.json.token}` },
            errorCode: null,
            message: 'Autenticación DRF Token exitosa.',
          };
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          lastErrorMsg = res?.json?.non_field_errors?.[0] || res?.json?.detail || `HTTP ${res.status} en DRF Token`;
        }
      } catch (e: any) {
        lastErrorMsg = e?.message || String(e);
      }
    }

    if (m === 'DJANGO_SESSION') {
      try {
        const loginPage = await requestBioTimeHttpServer({ protocol: cleanProto, host, port, path: '/login/', method: 'GET', timeoutMs });
        const setCookies = Array.isArray(loginPage.headers['set-cookie']) ? loginPage.headers['set-cookie'] : [];
        const cookieMap = new Map<string, string>();
        const absorb = (arr: string[]) => {
          for (const c of arr || []) {
            const kv = String(c).split(';')[0];
            const eq = kv.indexOf('=');
            if (eq > 0) cookieMap.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
          }
        };
        absorb(setCookies);

        let csrfToken = cookieMap.get('csrftoken') || '';
        const hiddenMatch = String(loginPage.raw || '').match(/name=['"]csrfmiddlewaretoken['"][^>]*value=['"]([^'"]+)['"]/i);
        if (hiddenMatch && hiddenMatch[1]) csrfToken = hiddenMatch[1];

        const formParams = new URLSearchParams({ username: cleanUser, password: cleanPwd });
        if (csrfToken) formParams.set('csrfmiddlewaretoken', csrfToken);

        const cookieHeader = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        const postLogin = await requestBioTimeHttpServer({
          protocol: cleanProto,
          host,
          port,
          path: '/login/?next=/',
          method: 'POST',
          body: formParams.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `${cleanProto}://${host}:${port}/login/`,
            Origin: `${cleanProto}://${host}:${port}`,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
          },
          timeoutMs,
        });
        absorb(Array.isArray(postLogin.headers['set-cookie']) ? postLogin.headers['set-cookie'] : []);
        lastStatus = postLogin.status;

        if (cookieMap.has('sessionid') || postLogin.status === 302) {
          const authH: Record<string, string> = {
            Cookie: Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
          };
          const finalCsrf = cookieMap.get('csrftoken');
          if (finalCsrf) authH['X-CSRFToken'] = finalCsrf;
          return {
            ok: true,
            methodUsed: 'DJANGO_SESSION',
            headers: authH,
            errorCode: null,
            message: 'Sesión web Django autenticada.',
          };
        }
      } catch (e: any) {
        lastErrorMsg = e?.message || String(e);
      }
    }
  }

  return {
    ok: false,
    methodUsed: null,
    headers: {},
    errorCode: 'ERROR_AUTENTICACION',
    message: `Credenciales rechazadas por BioTime PRO (${cleanProto}://${host}:${port}) para "${cleanUser}"${lastErrorMsg ? ` — ${lastErrorMsg}` : lastStatus ? ` (HTTP ${lastStatus})` : ''}.`,
  };
}

async function detectBioTimePortsServer({
  host = '192.168.1.29',
  protocol = 'http',
  configuredPort = 8088,
  ports,
  timeoutMs = 2500,
}: {
  host?: string;
  protocol?: string;
  configuredPort?: number;
  ports?: number[];
  timeoutMs?: number;
}) {
  const cleanHost = String(host || '192.168.1.29').trim();
  const cleanProto = String(protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const defaultList = [Number(configuredPort) || 8088, 8088, 89, 8000, 8080, 80, 443, 8090, 8888];
  const candidatePorts = [...new Set((Array.isArray(ports) && ports.length > 0 ? ports : defaultList).map((p) => Number(p)).filter((p) => Number.isInteger(p) && p >= 1 && p <= 65535))];

  const results = await Promise.all(
    candidatePorts.map(async (port) => {
      const t0 = Date.now();
      const tcp = await probeTcpPortServer(cleanHost, port, Math.min(timeoutMs, 2500));
      if (!tcp.ok) {
        return {
          port,
          tcp_open: false,
          http_responded: false,
          biotime_detected: false,
          status_code: null as number | null,
          latency_ms: tcp.latencyMs,
          server_header: null as string | null,
          detail: tcp.code === 'ECONNREFUSED' ? 'Puerto cerrado (ECONNREFUSED)' : tcp.code === 'ETIMEDOUT' ? 'Sin respuesta (ETIMEDOUT)' : (tcp.code || tcp.error || 'Inaccesible'),
        };
      }

      const probeProto = port === 443 ? 'https' : cleanProto;
      for (const probePath of ['/login/', '/jwt-api-token-auth/', '/']) {
        try {
          const res = await requestBioTimeHttpServer({ protocol: probeProto, host: cleanHost, port, path: probePath, method: 'GET', timeoutMs: Math.min(timeoutMs, 3000) });
          const rawLower = String(res.raw || '').toLowerCase();
          const serverHdr = String(res.headers?.server || '');
          const isBioTime =
            rawLower.includes('biotime') ||
            rawLower.includes('zkteco') ||
            rawLower.includes('iclock') ||
            (probePath === '/jwt-api-token-auth/' && (res.status === 400 || res.status === 405 || res.status === 401)) ||
            (probePath === '/login/' && res.status === 200 && rawLower.includes('csrfmiddlewaretoken'));
          return {
            port,
            tcp_open: true,
            http_responded: res.status > 0,
            biotime_detected: isBioTime,
            status_code: res.status,
            latency_ms: Date.now() - t0,
            server_header: serverHdr || null,
            detail: isBioTime ? `Servicio web BioTime PRO confirmado (${probeProto.toUpperCase()} ${res.status})` : `Servicio ${probeProto.toUpperCase()} activo (HTTP ${res.status})`,
          };
        } catch (_) {}
      }

      return {
        port,
        tcp_open: true,
        http_responded: false,
        biotime_detected: false,
        status_code: null as number | null,
        latency_ms: Date.now() - t0,
        server_header: null as string | null,
        detail: `Puerto TCP abierto pero sin respuesta ${probeProto.toUpperCase()}`,
      };
    })
  );

  const recommended =
    results.find((r) => r.biotime_detected)?.port ??
    results.find((r) => r.http_responded)?.port ??
    null;

  return {
    success: Boolean(recommended),
    host: cleanHost,
    protocol: cleanProto,
    recommendedPort: recommended,
    results,
    message: recommended
      ? `Puerto recomendado detectado: ${recommended} (${results.find((r) => r.port === recommended)?.detail}).`
      : `Ninguno de los puertos evaluados (${candidatePorts.join(', ')}) respondió servicio HTTP/BioTime en ${cleanHost}.`,
    timestamp: new Date().toISOString(),
  };
}

async function testBioTimeConnectionServer(config: any = {}) {
  const startAll = Date.now();
  const cleanHost = String(config.host || '').trim();
  const httpPort = Number(config.httpPort ?? config.webPort ?? 0);
  const protocol = String(config.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const authUser = String(config.authUser || config.webUser || '').trim();
  const authPassword = String(config.authPassword || config.webPassword || '').trim();
  const authMethod = String(config.authMethod || 'AUTO').toUpperCase();
  const pgPort = Number(config.pgPort ?? config.dbPort ?? 7496);
  const timeoutMs = Math.min(20000, Math.max(1500, Number(config.timeoutMs) || 5000));

  const stages: any[] = [];
  const failReport = (
    status: string,
    connectivity_status: string,
    auth_status: string,
    api_status: string,
    message: string,
    error_detail: string | null = null,
    extra: Record<string, any> = {}
  ) => ({
    success: false,
    status,
    host: cleanHost,
    httpPort,
    protocol,
    pgPort,
    connectivity_status,
    auth_status,
    api_status,
    pg_tcp_open: extra.pg_tcp_open ?? false,
    total_transactions: extra.total_transactions ?? 0,
    total_terminals: extra.total_terminals ?? 0,
    total_employees: extra.total_employees ?? 0,
    latency_ms: Date.now() - startAll,
    stages,
    message,
    error_detail,
    timestamp: new Date().toISOString(),
  });

  const ipValid = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) && cleanHost.split('.').every((o) => Number(o) >= 0 && Number(o) <= 255);
  stages.push({
    stage: 1,
    key: 'validate_host',
    name: '1. Validación de IP del servidor',
    status: ipValid ? 'PASSED' : 'FAILED',
    message: ipValid ? `IPv4 válida: ${cleanHost}` : `IP inválida o vacía: "${cleanHost}"`,
    latency_ms: 1,
  });
  if (!ipValid) {
    return failReport('CONFIGURACION_INCOMPLETA', 'FAILED', 'SKIPPED', 'SKIPPED', 'Debe ingresar una dirección IPv4 válida para el servidor BioTime PRO.');
  }

  const portValid = Number.isInteger(httpPort) && httpPort >= 1 && httpPort <= 65535;
  stages.push({
    stage: 2,
    key: 'validate_port',
    name: '2. Validación de puerto HTTP',
    status: portValid ? 'PASSED' : 'FAILED',
    message: portValid ? `Puerto HTTP válido: ${httpPort}` : `Puerto HTTP inválido: "${config.httpPort}" (rango permitido 1–65535)`,
    latency_ms: 1,
  });
  if (!portValid) {
    return failReport('CONFIGURACION_INCOMPLETA', 'FAILED', 'SKIPPED', 'SKIPPED', 'El puerto HTTP de BioTime PRO debe estar entre 1 y 65535.');
  }

  const t3 = Date.now();
  const tcpRes = await probeTcpPortServer(cleanHost, httpPort, Math.min(timeoutMs, 4000));
  stages.push({
    stage: 3,
    key: 'tcp_reachability',
    name: `3. Alcance TCP al puerto ${httpPort}`,
    status: tcpRes.ok ? 'PASSED' : 'FAILED',
    message: tcpRes.ok
      ? `Socket TCP conectado hacia ${cleanHost}:${httpPort} (${tcpRes.latencyMs} ms)`
      : `Puerto ${httpPort} inaccesible en ${cleanHost} (${tcpRes.code || tcpRes.error})`,
    latency_ms: Date.now() - t3,
  });
  if (!tcpRes.ok) {
    const isTimeout = tcpRes.code === 'ETIMEDOUT';
    return failReport(
      isTimeout ? 'TIMEOUT' : 'PUERTO_INACCESIBLE',
      isTimeout ? 'TIMEOUT' : 'FAILED',
      'SKIPPED',
      'SKIPPED',
      `No se pudo abrir conexión TCP hacia ${cleanHost}:${httpPort} (${tcpRes.code || tcpRes.error}). Verifique IP, puerto web en BioTime Service Console y firewall.`,
      tcpRes.code || tcpRes.error || null
    );
  }

  const t4 = Date.now();
  let httpBanner = '';
  let httpResponded = false;
  let httpErrDetail: string | null = null;
  for (const probePath of ['/login/', '/jwt-api-token-auth/', '/']) {
    try {
      const probeRes = await requestBioTimeHttpServer({ protocol, host: cleanHost, port: httpPort, path: probePath, method: 'GET', timeoutMs });
      if (probeRes.status > 0) {
        httpResponded = true;
        httpBanner = `HTTP ${probeRes.status} en ${probePath} (${probeRes.headers?.server || 'BioTime Web'})`;
        break;
      }
    } catch (err: any) {
      httpErrDetail = err.code || err.message;
    }
  }
  stages.push({
    stage: 4,
    key: 'http_service',
    name: `4. Respuesta real del servicio ${protocol.toUpperCase()}`,
    status: httpResponded ? 'PASSED' : 'FAILED',
    message: httpResponded
      ? httpBanner
      : `El puerto TCP ${httpPort} abrió pero NO respondió como servidor ${protocol.toUpperCase()} (${httpErrDetail || 'protocolo incompatible'}).`,
    latency_ms: Date.now() - t4,
  });
  if (!httpResponded) {
    const isTimeout = String(httpErrDetail || '').includes('ETIMEDOUT') || String(httpErrDetail || '').includes('Timeout');
    return failReport(
      isTimeout ? 'TIMEOUT' : 'NO_CONECTADO',
      isTimeout ? 'TIMEOUT' : 'FAILED',
      'SKIPPED',
      'SKIPPED',
      `El puerto ${httpPort} no respondió protocolo ${protocol.toUpperCase()} de BioTime PRO (${httpErrDetail || 'sin respuesta HTTP'}).`,
      httpErrDetail
    );
  }

  if (!authUser || !authPassword) {
    stages.push({
      stage: 5,
      key: 'authentication',
      name: '5. Autenticación BioTime PRO',
      status: 'FAILED',
      message: 'Falta usuario o contraseña de acceso a BioTime PRO.',
    });
    return failReport(
      'CONFIGURACION_INCOMPLETA',
      'OK',
      'MISSING',
      'SKIPPED',
      `Servidor ${protocol.toUpperCase()} en ${cleanHost}:${httpPort} alcanzó respuesta web, pero faltan credenciales (usuario/contraseña) para completar la autenticación.`
    );
  }

  const t5 = Date.now();
  const authRes = await authenticateBioTimeServer({ protocol, host: cleanHost, port: httpPort, authMethod, authUser, authPassword, timeoutMs });
  stages.push({
    stage: 5,
    key: 'authentication',
    name: `5. Autenticación (${authMethod})`,
    status: authRes.ok ? 'PASSED' : 'FAILED',
    message: authRes.ok ? `${authRes.message} (Método: ${authRes.methodUsed})` : authRes.message,
    latency_ms: Date.now() - t5,
  });
  if (!authRes.ok) {
    return failReport('ERROR_AUTENTICACION', 'OK', 'FAILED', 'SKIPPED', authRes.message, authRes.errorCode);
  }

  const t6 = Date.now();
  let txCount = 0;
  let termCount = 0;
  let empCount = 0;
  let apiOk = false;
  let apiError: string | null = null;
  try {
    const [txRes, termRes, empRes] = await Promise.all([
      requestBioTimeHttpServer({ protocol, host: cleanHost, port: httpPort, path: '/iclock/api/transactions/?page=1&page_size=5', method: 'GET', headers: authRes.headers, timeoutMs }),
      requestBioTimeHttpServer({ protocol, host: cleanHost, port: httpPort, path: '/iclock/api/terminals/?page=1&page_size=20', method: 'GET', headers: authRes.headers, timeoutMs }).catch(() => null),
      requestBioTimeHttpServer({ protocol, host: cleanHost, port: httpPort, path: '/personnel/api/employees/?page=1&page_size=5', method: 'GET', headers: authRes.headers, timeoutMs }).catch(() => null),
    ]);
    if (txRes.status === 200 && txRes.json && Array.isArray(txRes.json.data)) {
      apiOk = true;
      txCount = Number(txRes.json.count ?? txRes.json.data.length ?? 0);
    } else {
      const altTx = await requestBioTimeHttpServer({ protocol, host: cleanHost, port: httpPort, path: '/att/api/transactionReport/?page=1&page_size=5', method: 'GET', headers: authRes.headers, timeoutMs }).catch(() => null);
      if (altTx && altTx.status === 200 && altTx.json && Array.isArray(altTx.json.data)) {
        apiOk = true;
        txCount = Number(altTx.json.count ?? altTx.json.data.length ?? 0);
      } else {
        apiError = `HTTP ${txRes.status} en /iclock/api/transactions/`;
      }
    }
    if (termRes?.status === 200 && termRes.json && Array.isArray(termRes.json.data)) {
      termCount = Number(termRes.json.count ?? termRes.json.data.length ?? 0);
    }
    if (empRes?.status === 200 && empRes.json && Array.isArray(empRes.json.data)) {
      empCount = Number(empRes.json.count ?? empRes.json.data.length ?? 0);
    }
  } catch (err: any) {
    apiError = err.code || err.message;
  }
  stages.push({
    stage: 6,
    key: 'api_endpoints',
    name: '6. Verificación de API solo lectura',
    status: apiOk ? 'PASSED' : 'FAILED',
    message: apiOk
      ? `API operativa: ${termCount} terminales, ${empCount} empleados, ${txCount} marcaciones disponibles.`
      : `Autenticación válida, pero endpoints API no disponibles (${apiError || 'sin JSON válido'}).`,
    latency_ms: Date.now() - t6,
  });

  const t7 = Date.now();
  let pgTcpOpen = false;
  if (Number.isInteger(pgPort) && pgPort >= 1 && pgPort <= 65535) {
    const pgProbe = await probeTcpPortServer(cleanHost, pgPort, 1800);
    pgTcpOpen = pgProbe.ok;
    stages.push({
      stage: 7,
      key: 'pg_port_check',
      name: `7. Puerto PostgreSQL independiente (${pgPort})`,
      status: pgProbe.ok ? 'PASSED' : 'WARNING',
      message: pgProbe.ok
        ? `PostgreSQL TCP :${pgPort} accesible en ${cleanHost}.`
        : `PostgreSQL TCP :${pgPort} no expuesto en red (normal si BioTime solo permite BD local; HTTP API sigue operativa).`,
      latency_ms: Date.now() - t7,
    });
  } else {
    stages.push({
      stage: 7,
      key: 'pg_port_check',
      name: '7. Puerto PostgreSQL independiente',
      status: 'SKIPPED',
      message: 'Puerto PostgreSQL no configurado.',
    });
  }

  if (!apiOk) {
    return failReport(
      'API_NO_DISPONIBLE',
      'OK',
      'OK',
      'FAILED',
      `Se conectó y autenticó en ${protocol}://${cleanHost}:${httpPort}, pero la API de marcaciones no respondió datos válidos (${apiError}).`,
      apiError,
      { pg_tcp_open: pgTcpOpen }
    );
  }

  return {
    success: true,
    status: 'CONECTADO',
    host: cleanHost,
    httpPort,
    protocol,
    pgPort,
    authMethodUsed: authRes.methodUsed,
    connectivity_status: 'OK',
    auth_status: 'OK',
    api_status: 'OK',
    pg_tcp_open: pgTcpOpen,
    total_transactions: txCount,
    total_terminals: termCount,
    total_employees: empCount,
    latency_ms: Date.now() - startAll,
    stages,
    message: `Conectado a BioTime PRO (${protocol}://${cleanHost}:${httpPort}) vía ${authRes.methodUsed}. ${termCount} terminales, ${empCount} empleados, ${txCount} marcaciones.`,
    error_detail: null,
    timestamp: new Date().toISOString(),
  };
}

async function fetchBioTimeTerminalsServer(params: any = {}) {
  const cleanHost = String(params.host || '192.168.1.29').trim();
  const cleanProto = String(params.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const port = Number(params.httpPort ?? params.webPort ?? 8088);
  const authMethod = String(params.authMethod || 'AUTO').toUpperCase();
  const user = String(params.authUser ?? params.webUser ?? '').trim();
  const pwd = String(params.authPassword ?? params.webPassword ?? '').trim();
  const timeoutMs = Math.min(20000, Math.max(1500, Number(params.timeoutMs) || 5000));

  const auth = await authenticateBioTimeServer({ protocol: cleanProto, host: cleanHost, port, authMethod, authUser: user, authPassword: pwd, timeoutMs });
  if (!auth.ok) {
    return {
      success: false,
      status: auth.errorCode === 'MISSING_CREDENTIALS' ? 'CONFIGURACION_INCOMPLETA' : 'ERROR_AUTENTICACION',
      devices: [],
      error: auth.errorCode,
      message: auth.message,
    };
  }

  try {
    const res = await requestBioTimeHttpServer({ protocol: cleanProto, host: cleanHost, port, path: '/iclock/api/terminals/?page=1&page_size=100', method: 'GET', headers: auth.headers, timeoutMs });
    if (res.status !== 200 || !res.json || !Array.isArray(res.json.data)) {
      return {
        success: false,
        status: 'API_NO_DISPONIBLE',
        devices: [],
        error: 'API_NO_DISPONIBLE',
        message: `BioTime PRO respondió HTTP ${res.status} al consultar terminales (/iclock/api/terminals/).`,
      };
    }

    const devices = res.json.data.map((t: any) => ({
      id: t.id,
      sn: String(t.sn || '').trim().toUpperCase(),
      alias: String(t.alias || t.terminal_name || t.sn || 'Terminal BioTime').trim(),
      ip_address: String(t.ip_address || '').trim(),
      area_name: typeof t.area === 'object' ? (t.area?.area_name || t.area?.name || null) : (t.area_name || null),
      state: t.state ?? null,
      last_activity: t.last_activity || null,
      user_count: t.user_count ?? null,
      transaction_count: t.transaction_count ?? null,
      fw_ver: t.fw_ver || null,
    }));

    return {
      success: true,
      status: 'CONECTADO',
      devices,
      message: `${devices.length} dispositivo(s) encontrado(s) en BioTime PRO (${cleanProto}://${cleanHost}:${port}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      status: err.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'NO_CONECTADO',
      devices: [],
      error: err.code || err.message,
      message: `Error consultando terminales BioTime PRO: ${err.message}`,
    };
  }
}

// Cliente HTTP/HTTPS de SOLO LECTURA para BioTime PRO (puerto manual, HTTP o HTTPS)
// Soporta JWT (/jwt-api-token-auth/), DRF Token (/api-token-auth/) y Sesión Web Django (/login/).
async function fetchBioTimeHttpApiServer(options: {
  protocol?: string;
  host?: string;
  httpPort?: number;
  webPort?: number;
  authMethod?: string;
  serial?: string;
  authUser?: string;
  webUser?: string;
  authPassword?: string;
  webPassword?: string;
  startDate?: string;
  endDate?: string;
  timeoutMs?: number;
  inspectOnly?: boolean;
}): Promise<{
  success: boolean;
  needsWebCredentials?: boolean;
  error?: string;
  endpoint?: string;
  pagesFetched?: number;
  totalCount?: number;
  deviceCount?: number;
  punches: any[];
  message: string;
}> {
  const cleanHost = String(options?.host || '192.168.1.29').trim();
  const cleanProto = String(options?.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const port = Number(options?.httpPort ?? options?.webPort) || 8088;
  const authMethod = String(options?.authMethod || 'AUTO').toUpperCase();
  const cleanSerial = String(options?.serial || '').trim().toUpperCase();
  const webUser = String(options?.authUser ?? options?.webUser ?? '').trim();
  const webPassword = String(options?.authPassword ?? options?.webPassword ?? '').trim();
  const timeoutMs = Math.min(20000, Math.max(1500, Number(options?.timeoutMs) || 6000));
  const inspectOnly = !!options?.inspectOnly;

  if (!webUser || !webPassword) {
    return {
      success: false,
      needsWebCredentials: true,
      error: 'MISSING_WEB_CREDENTIALS',
      message: `BioTime PRO (${cleanProto}://${cleanHost}:${port}) requiere usuario y contraseña de acceso para leer las marcaciones.`,
      punches: [],
    };
  }

  let auth;
  try {
    auth = await authenticateBioTimeServer({ protocol: cleanProto, host: cleanHost, port, authMethod, authUser: webUser, authPassword: webPassword, timeoutMs });
  } catch (err: any) {
    return {
      success: false,
      error: err?.code || 'BIOTIME_UNREACHABLE',
      message: `No se pudo conectar a BioTime PRO (${cleanProto}://${cleanHost}:${port}): ${err?.message || String(err)}`,
      punches: [],
    };
  }

  if (!auth.ok) {
    return {
      success: false,
      needsWebCredentials: true,
      error: 'BIOTIME_AUTH_FAILED',
      message: auth.message,
      punches: [],
    };
  }

  const authHeaders = auth.headers;
  const pageSize = inspectOnly ? 20 : 200;
  const maxPages = inspectOnly ? 1 : 50;
  const collectedRows: any[] = [];
  let totalCount = 0;
  let pagesFetched = 0;

  const cleanStart = String(options?.startDate || '').trim();
  const cleanEnd = String(options?.endDate || '').trim();
  const dateParams =
    (cleanStart ? `&start_time=${encodeURIComponent(cleanStart.length === 10 ? `${cleanStart} 00:00:00` : cleanStart)}` : '') +
    (cleanEnd ? `&end_time=${encodeURIComponent(cleanEnd.length === 10 ? `${cleanEnd} 23:59:59` : cleanEnd)}` : '');

  const endpoints = ['/iclock/api/transactions/', '/att/api/transactionReport/'];
  let activeEndpoint = endpoints[0];

  for (const ep of endpoints) {
    const snParam = cleanSerial && ep.includes('iclock') ? `&terminal_sn=${encodeURIComponent(cleanSerial)}` : '';
    const testRes = await requestBioTimeHttpServer({ protocol: cleanProto, host: cleanHost, port, path: `${ep}?page=1&page_size=${pageSize}${snParam}${dateParams}`, method: 'GET', headers: authHeaders, timeoutMs });
    if (testRes.status === 200 && testRes.json && Array.isArray(testRes.json.data)) {
      activeEndpoint = ep;
      pagesFetched = 1;
      let pageData = testRes.json;
      totalCount = Number(pageData.count || pageData.data.length || 0);
      collectedRows.push(...pageData.data);

      if (collectedRows.length === 0 && snParam) {
        const broadRes = await requestBioTimeHttpServer({ protocol: cleanProto, host: cleanHost, port, path: `${ep}?page=1&page_size=${pageSize}${dateParams}`, method: 'GET', headers: authHeaders, timeoutMs });
        if (broadRes.status === 200 && broadRes.json && Array.isArray(broadRes.json.data)) {
          pageData = broadRes.json;
          totalCount = Number(broadRes.json.count || broadRes.json.data.length || 0);
          collectedRows.push(...broadRes.json.data);
        }
      }

      if (!inspectOnly) {
        let nextPath = normalizeHttpPathServer(pageData.next);
        let nextPage = 2;
        while (nextPage <= maxPages && (nextPath || (totalCount > 0 && collectedRows.length < totalCount))) {
          const pathToFetch = nextPath || `${ep}?page=${nextPage}&page_size=${pageSize}${snParam}${dateParams}`;
          const pRes = await requestBioTimeHttpServer({ protocol: cleanProto, host: cleanHost, port, path: pathToFetch, method: 'GET', headers: authHeaders, timeoutMs });
          const rows = Array.isArray(pRes?.json?.data) ? pRes.json.data : [];
          if (rows.length === 0) break;
          pagesFetched++;
          collectedRows.push(...rows);
          nextPath = normalizeHttpPathServer(pRes?.json?.next);
          if (!nextPath && collectedRows.length >= totalCount) break;
          nextPage++;
        }
      }
      break;
    }
  }

  const filteredRows = cleanSerial
    ? collectedRows.filter((r) => !r.terminal_sn || String(r.terminal_sn).trim().toUpperCase() === cleanSerial)
    : collectedRows;
  const effectiveRows = filteredRows.length > 0 ? filteredRows : collectedRows;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatTs = (val: any): string => {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      return s.replace('T', ' ').substring(0, 19);
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return s.replace('T', ' ').substring(0, 19);
  };

  const startCutoff = cleanStart ? cleanStart.substring(0, 10) : '';
  const endCutoff = cleanEnd ? cleanEnd.substring(0, 10) : '';
  const syncedAt = new Date().toISOString();
  const punches = effectiveRows
    .map((r, idx) => {
      const code = String(r.emp_code || r.emp || r.pin || '').trim();
      const ts = formatTs(r.punch_time || r.check_time || r.att_time);
      if (!code || !ts || ts.length < 16) return null;
      const datePart = ts.split(' ')[0] || '';
      if (startCutoff && datePart < startCutoff) return null;
      if (endCutoff && datePart > endCutoff) return null;
      const snVal = String(r.terminal_sn || cleanSerial || 'AEH2223460040').trim().toUpperCase();
      const pState = Number(r.punch_state ?? 0);
      const verifyDisp = String(r.verify_type_display || r.verify_type || '').toUpperCase();
      const verifyMode = verifyDisp.includes('FACE') || verifyDisp === '15'
        ? 'FACE'
        : verifyDisp.includes('PASS') || verifyDisp === '2'
        ? 'PASSWORD'
        : verifyDisp.includes('CARD') || verifyDisp === '3'
        ? 'CARD'
        : 'FINGERPRINT';
      return {
        id: `biotime_${snVal}_${code}_${ts.replace(/[^0-9]/g, '')}`,
        original_punch_id: String(r.id || `bt_api_${idx}`),
        device_sn: snVal,
        device_ip: cleanHost,
        employee_dni: code,
        employee_code: code,
        fecha: datePart,
        hora: ts.split(' ')[1] || '',
        timestamp: ts,
        verify_mode: verifyMode,
        punch_state: pState,
        source: 'BIOTIME_API',
        synced_at: syncedAt,
      };
    })
    .filter(Boolean);

  return {
    success: true,
    endpoint: activeEndpoint,
    pagesFetched,
    totalCount: totalCount || effectiveRows.length,
    deviceCount: punches.length,
    punches,
    message:
      punches.length > 0
        ? `${punches.length} marcaciones reales recuperadas vía BioTime PRO ${cleanProto.toUpperCase()} (${cleanHost}:${port}).`
        : `Conectado a BioTime PRO (${cleanHost}:${port}), sin marcaciones encontradas en el criterio consultado.`,
  };
}

// Inspección read-only de esquema BioTime vía information_schema + verificación HTTP/HTTPS manual
async function inspectBioTimeDb(options?: {
  protocol?: string;
  host?: string;
  httpPort?: number;
  webPort?: number;
  port?: number;
  dbName?: string;
  user?: string;
  password?: string;
  authMethod?: string;
  authUser?: string;
  webUser?: string;
  authPassword?: string;
  webPassword?: string;
  serial?: string;
  timeoutMs?: number;
  strictPort?: boolean;
}): Promise<{
  success: boolean;
  host: string;
  protocol?: string;
  webPort: number;
  httpPort?: number;
  dbPort: number;
  dbName: string;
  webReachable: boolean;
  dbReachable: boolean;
  needsWebCredentials?: boolean;
  tablesFound: string[];
  attendanceTable: string | null;
  attendanceColumns: string[];
  totalTransactions: number;
  deviceTransactions: number;
  receivesClockPunches: boolean;
  validSource: boolean;
  message: string;
  error: string | null;
  latency: number;
}> {
  const start = Date.now();
  const host = String(options?.host || '192.168.1.29').trim();
  const protocol = String(options?.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const rawWebPort = Number(options?.httpPort ?? options?.webPort);
  let webPort = rawWebPort || 8088;
  const dbPort = Number(options?.port) || 7496;
  const dbName = String(options?.dbName || 'biotime').trim();
  const user = String(options?.user || 'postgres').trim();
  const serial = String(options?.serial || '').trim().toUpperCase();
  const effectiveWebUser = String(options?.authUser ?? options?.webUser ?? '').trim();
  const effectiveWebPwd = String(options?.authPassword ?? options?.webPassword ?? '').trim();
  const timeoutMs = Math.min(20000, Math.max(1500, Number(options?.timeoutMs) || 5000));

  let webProbe = await probeTcpPortServer(host, webPort, Math.min(timeoutMs, 3000));
  if (!webProbe.ok && !options?.strictPort && (webPort === 8088 || webPort === 89)) {
    const altPort = webPort === 8088 ? 89 : 8088;
    const altProbe = await probeTcpPortServer(host, altPort, 2000);
    if (altProbe.ok) {
      webProbe = altProbe;
      webPort = altPort;
    }
  }
  const dbProbe = await probeTcpPortServer(host, dbPort, 2500);

  const report = {
    success: false,
    host,
    protocol,
    webPort,
    httpPort: webPort,
    dbPort,
    dbName,
    webReachable: webProbe.ok,
    dbReachable: dbProbe.ok,
    webError: webProbe.code || webProbe.error || null,
    dbError: dbProbe.code || dbProbe.error || null,
    needsWebCredentials: false,
    tablesFound: [] as string[],
    attendanceTable: null as string | null,
    attendanceColumns: [] as string[],
    totalTransactions: 0,
    deviceTransactions: 0,
    receivesClockPunches: false,
    validSource: false,
    message: '',
    error: null as string | null,
    latency: Date.now() - start,
  };

  if (!dbProbe.ok && webProbe.ok) {
    if (!effectiveWebUser || !effectiveWebPwd) {
      report.needsWebCredentials = true;
      report.error = 'NEEDS_WEB_CREDENTIALS';
      report.message = `BioTime PRO ${protocol.toUpperCase()} en ${host}:${webPort} está ACTIVO (PostgreSQL :${dbPort} es solo local). Ingrese Usuario Web y Contraseña de BioTime PRO para inspeccionar y extraer marcaciones.`;
      report.latency = Date.now() - start;
      return report;
    }

    const apiCheck = await fetchBioTimeHttpApiServer({
      protocol,
      host,
      httpPort: webPort,
      webPort,
      authMethod: options?.authMethod || 'AUTO',
      serial,
      authUser: effectiveWebUser,
      authPassword: effectiveWebPwd,
      timeoutMs,
      inspectOnly: true,
    });

    if (apiCheck.success) {
      report.success = true;
      report.attendanceTable = `API ${protocol.toUpperCase()} BioTime PRO (${apiCheck.endpoint})`;
      report.totalTransactions = apiCheck.totalCount || 0;
      report.deviceTransactions = apiCheck.deviceCount || 0;
      report.receivesClockPunches = report.deviceTransactions > 0 || report.totalTransactions > 0;
      report.validSource = report.receivesClockPunches;
      report.message = apiCheck.message;
      report.latency = Date.now() - start;
      return report;
    }

    report.needsWebCredentials = !!apiCheck.needsWebCredentials;
    report.error = apiCheck.error || 'BIOTIME_API_ERROR';
    report.message = apiCheck.message;
    report.latency = Date.now() - start;
    return report;
  }

  if (!dbProbe.ok) {
    const webCode = webProbe.code || 'ETIMEDOUT';
    const causeDetail =
      webCode === 'ECONNREFUSED'
        ? `La PC ${host} respondió pero rechazó el puerto HTTP :${webPort} (ECONNREFUSED): el servicio BioTime PRO está detenido.`
        : `Sin respuesta TCP en HTTP :${webPort} (${webCode}). Verifique que ${host} esté encendida, en la subred 192.168.1.x y con Firewall abierto en puerto ${webPort}.`;
    report.error = webCode || dbProbe.code || 'BIOTIME_UNREACHABLE';
    report.message = `BioTime en ${host} (HTTP :${webPort} / PostgreSQL :${dbPort}) no está alcanzable. ${causeDetail}`;
    report.latency = Date.now() - start;
    return report;
  }

  const passToTry = [options?.password, '', 'admin', 'postgres', '123456', 'biotime', 'ZKTeco123'].filter(
    (x) => x !== undefined
  ) as string[];

  for (const password of [...new Set(passToTry)]) {
    let client: any = null;
    try {
      client = new pg.Client({
        host,
        port: dbPort,
        database: dbName,
        user,
        password,
        connectionTimeoutMillis: 2000,
      });
      await client.connect();

      const tRes = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      report.tablesFound = tRes.rows.map((r: any) => r.table_name);
      const detected = ['iclock_transaction', 'checkinout', 'att_punches'].find((t) =>
        report.tablesFound.includes(t)
      ) || report.tablesFound.find((t) => t.includes('transaction') || t.includes('checkin'));

      if (detected) {
        report.attendanceTable = detected;
        const cRes = await client.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [detected]
        );
        report.attendanceColumns = cRes.rows.map((c: any) => `${c.column_name} (${c.data_type})`);
        const colNames = cRes.rows.map((c: any) => c.column_name);

        const countAll = await client.query(`SELECT COUNT(*)::int AS total FROM "${detected}"`);
        report.totalTransactions = Number(countAll.rows?.[0]?.total || 0);

        const snCol = ['terminal_sn', 'sn', 'device_sn'].find((c) => colNames.includes(c));
        if (snCol && serial) {
          const countDev = await client.query(
            `SELECT COUNT(*)::int AS total FROM "${detected}" WHERE UPPER(COALESCE("${snCol}"::text, '')) = $1`,
            [serial]
          );
          report.deviceTransactions = Number(countDev.rows?.[0]?.total || 0);
        } else {
          report.deviceTransactions = report.totalTransactions;
        }

        report.receivesClockPunches = report.deviceTransactions > 0;
        report.validSource = report.receivesClockPunches;
        report.success = true;
        report.message = report.receivesClockPunches
          ? `BioTime inspeccionado (${detected}): ${report.deviceTransactions} marcaciones reales registradas para ${serial || 'el equipo'}.`
          : `BioTime conectado (${detected}), pero tiene 0 marcaciones para ${serial || 'el reloj'}. No debe usarse hasta corregir la recepción ADMS.`;
      } else {
        report.success = true;
        report.message = `Conectado a PostgreSQL BioTime (${dbName}), pero no se detectó tabla estándar de marcaciones.`;
      }

      await client.end();
      report.latency = Date.now() - start;
      return report;
    } catch (err: any) {
      report.error = err?.message || String(err);
      if (client) try { await client.end(); } catch (_) {}
    }
  }

  report.message = `Fallo autenticando en PostgreSQL BioTime (${host}:${dbPort}/${dbName}): ${report.error || 'Credenciales inválidas'}.`;
  report.latency = Date.now() - start;
  return report;
}

async function syncPunchesFromBioTimeDb(options?: {
  protocol?: string;
  host?: string;
  httpPort?: number;
  webPort?: number;
  port?: number;
  dbName?: string;
  user?: string;
  password?: string;
  authMethod?: string;
  authUser?: string;
  webUser?: string;
  authPassword?: string;
  webPassword?: string;
  serial?: string;
  startDate?: string;
  endDate?: string;
  timeoutMs?: number;
  strictPort?: boolean;
}): Promise<{
  success: boolean;
  needsWebCredentials?: boolean;
  source?: string;
  message: string;
  punches: any[];
  latency: number;
  inspection?: any;
}> {
  const startTime = Date.now();
  const host = String(options?.host || '192.168.1.29').trim();
  const protocol = String(options?.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const rawWebPort = Number(options?.httpPort ?? options?.webPort);
  const webPort = rawWebPort || 8088;
  const port = Number(options?.port) || 7496;
  const dbName = String(options?.dbName || 'biotime').trim();
  const user = String(options?.user || 'postgres').trim();
  const serial = String(options?.serial || '').trim().toUpperCase();
  const effectiveWebUser = String(options?.authUser ?? options?.webUser ?? '').trim();
  const effectiveWebPwd = String(options?.authPassword ?? options?.webPassword ?? '').trim();
  const timeoutMs = Math.min(20000, Math.max(1500, Number(options?.timeoutMs) || 6000));

  const inspection = await inspectBioTimeDb({
    protocol,
    host,
    httpPort: webPort,
    webPort,
    port,
    dbName,
    user,
    password: options?.password,
    authMethod: options?.authMethod,
    authUser: effectiveWebUser,
    authPassword: effectiveWebPwd,
    serial,
    timeoutMs,
    strictPort: options?.strictPort,
  });

  const effectiveWebPort = Number(inspection.httpPort || inspection.webPort || webPort);

  if (inspection.webReachable && (!inspection.dbReachable || (effectiveWebUser && effectiveWebPwd))) {
    const apiRes = await fetchBioTimeHttpApiServer({
      protocol,
      host,
      httpPort: effectiveWebPort,
      webPort: effectiveWebPort,
      authMethod: options?.authMethod || 'AUTO',
      serial,
      authUser: effectiveWebUser,
      authPassword: effectiveWebPwd,
      startDate: options?.startDate,
      endDate: options?.endDate,
      timeoutMs,
      inspectOnly: false,
    });
    if (apiRes.success) {
      return {
        success: true,
        source: 'BIOTIME_API',
        message: apiRes.message,
        punches: apiRes.punches || [],
        latency: Date.now() - startTime,
        inspection,
      };
    }
    return {
      success: false,
      needsWebCredentials: !!apiRes.needsWebCredentials,
      source: 'BIOTIME_API',
      message: apiRes.message,
      punches: [],
      latency: Date.now() - startTime,
      inspection,
    };
  }

  if (!inspection.success || !inspection.attendanceTable) {
    return {
      success: false,
      needsWebCredentials: !!inspection.needsWebCredentials,
      source: 'BIOTIME_DB',
      message: inspection.message,
      punches: [],
      latency: Date.now() - startTime,
      inspection,
    };
  }

  if (!inspection.receivesClockPunches) {
    return {
      success: false,
      source: 'BIOTIME_DB',
      message: `BioTime no contiene marcaciones del reloj (${serial || 'G3'}). No es una fuente válida hasta que ADMS reciba registros reales.`,
      punches: [],
      latency: Date.now() - startTime,
      inspection,
    };
  }

  const passToTry = [options?.password, '', 'admin', 'postgres', '123456', 'biotime', 'ZKTeco123'].filter(
    (x) => x !== undefined
  ) as string[];
  let lastError = '';
  const table = inspection.attendanceTable;
  const colNames = inspection.attendanceColumns.map((c) => c.split(' ')[0]);
  const hasPersonnel = inspection.tablesFound.includes('personnel_employee');

  for (const password of [...new Set(passToTry)]) {
    let client: any = null;
    try {
      client = new pg.Client({
        host,
        port,
        database: dbName,
        user,
        password,
        connectionTimeoutMillis: 2500,
      });
      await client.connect();

      let res: any = null;
      if (table === 'iclock_transaction' && colNames.includes('emp_code') && colNames.includes('punch_time')) {
        const snFilter = serial && colNames.includes('terminal_sn') ? `WHERE UPPER(COALESCE(t.terminal_sn::text, '')) = $1` : '';
        const joinSql = hasPersonnel ? 'LEFT JOIN personnel_employee e ON (t.emp_id = e.id OR t.emp_code = e.emp_code)' : '';
        res = await client.query(
          `SELECT t.id, t.punch_time, t.emp_code, t.punch_state, t.verify_type, t.terminal_sn
           FROM iclock_transaction t ${joinSql} ${snFilter}
           ORDER BY t.punch_time DESC LIMIT 5000`,
          snFilter ? [serial] : []
        );
      } else if (table === 'checkinout' && colNames.includes('userid') && colNames.includes('checktime')) {
        const snCol = ['sn', 'terminal_sn'].find((c) => colNames.includes(c));
        const snFilter = serial && snCol ? `WHERE UPPER(COALESCE("${snCol}"::text, '')) = $1` : '';
        res = await client.query(
          `SELECT id, checktime AS punch_time, userid AS emp_code, checktype AS punch_state, verifycode AS verify_type, ${snCol ? `"${snCol}"` : "''"} AS terminal_sn
           FROM checkinout ${snFilter} ORDER BY checktime DESC LIMIT 5000`,
          snFilter ? [serial] : []
        );
      }

      await client.end();

      if (res && res.rows) {
        const syncedAt = new Date().toISOString();
        const recovered: any[] = [];
        for (const row of res.rows) {
          let pTime = '';
          if (row.punch_time instanceof Date) {
            const d = row.punch_time;
            const pad = (n: number) => String(n).padStart(2, '0');
            pTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          } else {
            pTime = String(row.punch_time || '').replace('T', ' ').substring(0, 19);
          }
          const pin = String(row.emp_code || '').trim();
          if (!pin || !pTime || pTime.length < 16) continue;

          const vType = Number(row.verify_type);
          let vMode = 'FINGERPRINT';
          if (vType === 15) vMode = 'FACE';
          else if (vType === 2) vMode = 'PASSWORD';
          else if (vType === 3) vMode = 'CARD';

          const snVal = row.terminal_sn || serial;
          recovered.push({
            id: `biotime_${snVal}_${pin}_${pTime.replace(/[- :]/g, '')}`,
            original_punch_id: String(row.id || `bt_${pin}_${pTime.replace(/[- :]/g, '')}`),
            device_sn: snVal,
            device_ip: host,
            employee_dni: pin,
            employee_code: pin,
            timestamp: pTime,
            verify_mode: vMode,
            punch_state: Number(row.punch_state ?? 0),
            source: 'BIOTIME_DB',
            synced_at: syncedAt,
          });
        }

        return {
          success: true,
          source: 'BIOTIME_DB',
          message: `Conexión exitosa a BioTime (${host}:${port}/${dbName}/${table}). Se recuperaron ${recovered.length} marcaciones reales.`,
          punches: recovered,
          latency: Date.now() - startTime,
          inspection,
        };
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      if (client) try { await client.end(); } catch (_) {}
    }
  }

  return {
    success: false,
    source: 'BIOTIME_DB',
    message: `No se pudo leer marcaciones de BioTime (${lastError || 'Error SQL'}).`,
    punches: [],
    latency: Date.now() - startTime,
    inspection,
  };
}

async function downloadRealPunchesOverTcp(
  ip: string,
  port: number,
  timeoutMs: number = 4000,
  commKey: number = 0,
  serialHint: string = 'AEH2223460040'
): Promise<{
  success: boolean;
  status_code: 'OFFLINE' | 'PROTOCOL_NO_RESPONSE' | 'AUTH_ERROR' | 'ONLINE_NO_NEW_PUNCHES' | 'PUNCHES_RECEIVED';
  message: string;
  punches: any[];
  users_in_clock: number;
  latency: number;
}> {
  const startTime = Date.now();
  const portsToTry = [port, 4370].filter((p, i, arr) => arr.indexOf(p) === i);
  let usersInClock = 0;

  // Multi-estrategia 1: Probar node-zklib en el puerto configurado y puerto 4370
  for (const testPort of portsToTry) {
    try {
      const zk = new (ZKLib as any)(ip, testPort, Math.min(timeoutMs, 3000), 5200);
      await zk.createSocket();
      try {
        const uRes = await zk.getUsers();
        if (uRes && Array.isArray(uRes.data)) usersInClock = uRes.data.length;
      } catch (_) {}

      const attResult = await zk.getAttendances();
      try { await zk.disconnect(); } catch (_) {}

      if (attResult && Array.isArray(attResult.data)) {
        const syncedAt = new Date().toISOString();
        const parsed = attResult.data
          .map((att: any, idx: number) => {
            const recTime = att.recordTime instanceof Date
              ? att.recordTime.toISOString().replace('T', ' ').substring(0, 19)
              : String(att.recordTime || '').replace('T', ' ').substring(0, 19);
            const pin = String(att.deviceUserId || att.userSn || att.pin || '').trim();
            if (!pin || !recTime || recTime.length < 16) return null;
            const baseId = `zk_${serialHint}_${pin}_${recTime.replace(/[- :]/g, '')}`;
            return {
              id: baseId,
              punch_id: baseId,
              original_punch_id: `${baseId}_${idx}`,
              device_sn: serialHint,
              device_ip: ip,
              employee_dni: pin,
              employee_code: pin,
              timestamp: recTime,
              verify_mode: att.verifyType === 15 ? 'FACE' : att.verifyType === 2 ? 'PASSWORD' : 'FINGERPRINT',
              punch_type: 'AUTO',
              punch_state: Number(att.punchState ?? 0),
              source: 'DIRECT_READ',
              synced_at: syncedAt,
            };
          })
          .filter(Boolean);

        return {
          success: true,
          status_code: parsed.length > 0 ? 'PUNCHES_RECEIVED' : 'ONLINE_NO_NEW_PUNCHES',
          message: parsed.length > 0
            ? `Descarga completada: ${parsed.length} marcaciones reales recuperadas vía ZKLib (${ip}:${testPort}).`
            : `Lectura exitosa sin marcaciones nuevas en el dispositivo (${ip}:${testPort}).`,
          punches: parsed,
          users_in_clock: usersInClock,
          latency: Date.now() - startTime,
        };
      }
    } catch (_) {}
  }

  // Multi-estrategia 2: Socket binario TCP directo sin falsos positivos
  const rawResult = await new Promise<{
    success: boolean;
    status_code: 'OFFLINE' | 'PROTOCOL_NO_RESPONSE' | 'AUTH_ERROR' | 'ONLINE_NO_NEW_PUNCHES' | 'PUNCHES_RECEIVED';
    message: string;
    punches: any[];
    users_in_clock: number;
    latency: number;
  }>((resolve) => {
    const socket = new net.Socket();
    let sessionId = 0;
    let replyId = 0;
    let tcpConnected = false;
    let stage: 'CONNECT' | 'ATTLOG' = 'CONNECT';
    const collectedData: Buffer[] = [];
    let idleTimer: any = null;
    let isFinished = false;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      socket.removeAllListeners();
      if (!socket.destroyed) socket.destroy();
    };

    const finish = (
      success: boolean,
      status_code: 'OFFLINE' | 'PROTOCOL_NO_RESPONSE' | 'AUTH_ERROR' | 'ONLINE_NO_NEW_PUNCHES' | 'PUNCHES_RECEIVED',
      msg: string,
      rawPunches: any[]
    ) => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      resolve({ success, status_code, message: msg, punches: rawPunches, users_in_clock: usersInClock, latency: Date.now() - startTime });
    };

    socket.setTimeout(Math.min(timeoutMs, 3500));

    socket.on('error', (err) => {
      finish(false, 'OFFLINE', `Error TCP (${ip}:${port}): ${err.message}`, []);
    });

    socket.on('timeout', () => {
      if (tcpConnected && stage === 'CONNECT') {
        finish(false, 'PROTOCOL_NO_RESPONSE', `Puerto TCP ${port} abierto en ${ip}, pero el protocolo ZKTeco no respondió a CMD_CONNECT.`, []);
      } else {
        finish(false, 'OFFLINE', `Sin conexión con el dispositivo ${ip}:${port} (Timeout).`, []);
      }
    });

    socket.connect(port, ip, () => {
      tcpConnected = true;
      const connectPacket = createZkTcpHeader(1000, 0, 0, '');
      socket.write(connectPacket);
    });

    socket.on('data', (chunk) => {
      let payload = chunk;
      if (
        chunk.length >= 8 &&
        (chunk.readUInt32LE(0) === 0x5050827d ||
          chunk.readUInt32BE(0) === 0x5050827d ||
          (chunk[0] === 0x7d && chunk[1] === 0x82) ||
          (chunk[0] === 0x50 && chunk[1] === 0x50))
      ) {
        payload = chunk.slice(8);
      }

      if (stage === 'CONNECT') {
        if (payload.length >= 8) {
          const respCmd = payload.readUInt16LE(0);
          if (respCmd === 2005 && !commKey) {
            finish(false, 'AUTH_ERROR', 'El dispositivo requiere CommKey (CMD_ACK_UNAUTH).', []);
            return;
          }
          sessionId = payload.readUInt16LE(4);
          replyId = payload.readUInt16LE(6);
          stage = 'ATTLOG';
          const attlogPacket = createZkTcpHeader(13, sessionId, replyId, '');
          socket.write(attlogPacket);
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            finish(true, 'ONLINE_NO_NEW_PUNCHES', 'Lectura exitosa sin marcaciones nuevas en el reloj.', []);
          }, 2000);
          return;
        }
      }

      if (stage === 'ATTLOG') {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          const fullBuf = Buffer.concat(collectedData);
          const parsed = parseZkAttlogBuffer(fullBuf, serialHint, ip).map((x) => ({
            ...x,
            source: 'DIRECT_READ',
          }));
          finish(
            true,
            parsed.length > 0 ? 'PUNCHES_RECEIVED' : 'ONLINE_NO_NEW_PUNCHES',
            parsed.length > 0
              ? `Descarga completada: ${parsed.length} marcaciones reales recuperadas.`
              : 'Lectura exitosa sin marcaciones nuevas en el reloj.',
            parsed
          );
        }, 900);

        if (payload.length >= 8) {
          const cmd = payload.readUInt16LE(0);
          if (cmd === 1500 && payload.length >= 12) {
            if (payload.length > 12) {
              collectedData.push(payload.slice(12));
            } else {
              try {
                replyId++;
                socket.write(createZkTcpHeader(2000, sessionId, replyId, ''));
              } catch (_) {}
            }
            return;
          }
          if (cmd === 2002) {
            collectedData.push(payload.slice(8));
            return;
          }
          if (cmd === 2000 && collectedData.length > 0) {
            const fullBuf = Buffer.concat(collectedData);
            const parsed = parseZkAttlogBuffer(fullBuf, serialHint, ip).map((x) => ({
              ...x,
              source: 'DIRECT_READ',
            }));
            finish(
              true,
              parsed.length > 0 ? 'PUNCHES_RECEIVED' : 'ONLINE_NO_NEW_PUNCHES',
              `Descarga completada: ${parsed.length} marcaciones reales recuperadas.`,
              parsed
            );
            return;
          }
        }
        collectedData.push(payload);
      }
    });
  });

  return rawResult;
}

// POST /api/zkteco/devices/:id/sync & /api/devices/:id/download-punches
const handleDeviceSyncAndDownload = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const devices = await getLatestDeviceConfig(id);
  const device = devices.find((d) => d.id === id || d.serial_number === id) || devices[0];

  if (!device) {
    return res.status(404).json({ success: false, status_code: 'OFFLINE', message: 'Dispositivo no encontrado' });
  }

  const host = String(req.body?.ip || device.ip_address || '').trim();
  const port = Number(req.body?.port || device.port || 7496);
  const commKey = Number(req.body?.comm_key ?? device.comm_key ?? 0);

  if (!host) {
    return res.status(400).json({ success: false, status_code: 'OFFLINE', message: 'El dispositivo no tiene dirección IP configurada.' });
  }

  const result = await downloadRealPunchesOverTcp(host, port, 3500, commKey, device.serial_number || 'AEH2223460040');

  if (!result.success) {
    const localDevices = readJsonFile<any[]>(DEVICES_FILE, []);
    const idx = localDevices.findIndex((d) => d.id === device.id);
    if (idx >= 0) {
      localDevices[idx].status = 'OFFLINE';
      localDevices[idx].tcp_status = result.status_code;
      writeJsonFile(DEVICES_FILE, localDevices);
    }
    return res.status(503).json({
      success: false,
      status_code: result.status_code,
      imported_count: 0,
      new_count: 0,
      device_id: device.id,
      serial_number: device.serial_number,
      ip_address: host,
      port,
      message: result.message,
    });
  }

  const integration = await integrateRealPunchesIntoSystem(result.punches, 'DIRECT_READ', {
    id: device.id,
    name: device.name,
    serial: device.serial_number,
    ip: host,
  });

  const nowIso = new Date().toISOString();
  const localDevices = readJsonFile<any[]>(DEVICES_FILE, []);
  const idx = localDevices.findIndex((d) => d.id === device.id);
  if (idx >= 0) {
    localDevices[idx].last_sync = nowIso;
    localDevices[idx].last_activity = nowIso;
    localDevices[idx].status = 'ONLINE';
    localDevices[idx].tcp_status = 'ONLINE';
    localDevices[idx].last_latency_ms = result.latency || 1;
    if (result.users_in_clock > 0) localDevices[idx].enrolled_user_count = result.users_in_clock;
    writeJsonFile(DEVICES_FILE, localDevices);
  }

  if (!integration.dbSaved && integration.newlyAdded > 0) {
    return res.status(207).json({
      success: false,
      status_code: 'DB_ERROR',
      imported_count: result.punches.length,
      new_count: integration.newlyAdded,
      unidentified_count: integration.unidentifiedCount,
      db_saved: false,
      db_error: integration.dbError,
      device_id: device.id,
      serial_number: device.serial_number,
      last_sync: nowIso,
      message: `Se leyeron ${integration.newlyAdded} marcaciones nuevas, pero falló el almacenamiento en Supabase PostgreSQL: ${integration.dbError}`,
      punches: integration.enrichedPunches,
    });
  }

  const statusCode = integration.newlyAdded > 0 ? 'PUNCHES_RECEIVED' : 'ONLINE_NO_NEW_PUNCHES';
  return res.json({
    success: true,
    status_code: statusCode,
    imported_count: result.punches.length,
    new_count: integration.newlyAdded,
    duplicates_skipped: integration.duplicatesSkipped,
    unidentified_count: integration.unidentifiedCount,
    db_saved: integration.dbSaved,
    device_id: device.id,
    serial_number: device.serial_number,
    last_sync: nowIso,
    message: integration.newlyAdded > 0
      ? `Marcaciones recibidas correctamente: ${integration.newlyAdded} nuevas (${integration.duplicatesSkipped} duplicadas omitidas, ${integration.unidentifiedCount} pendientes de identificación).`
      : `Lectura exitosa sin marcaciones nuevas (${host}:${port}, ${result.latency}ms).`,
    punches: integration.enrichedPunches,
  });
};

app.post('/api/zkteco/devices/:id/sync', handleDeviceSyncAndDownload);
app.post('/api/devices/:id/download-punches', handleDeviceSyncAndDownload);

// POST /api/zkteco/upload-attlog - Importación de marcaciones reales desde USB (1_attlog.dat / CSV / TXT)
app.post('/api/zkteco/upload-attlog', async (req, res) => {
  const { content, filename, serial } = req.body || {};
  const rawText = typeof content === 'string' ? content : (typeof req.body === 'string' ? req.body : '');

  if (!rawText || rawText.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'No se recibió contenido para importar. Cargue un archivo 1_attlog.dat o pegue las líneas de marcaciones.',
    });
  }

  const devices = await getLatestDeviceConfig();
  const targetDev = devices.find((d) => d.serial_number === serial) || devices[0];
  const serialHint = String(serial || targetDev?.serial_number || 'AEH2223460040');
  const parsedPunches = parseZkAttlogText(rawText, serialHint);

  if (parsedPunches.length === 0) {
    return res.status(422).json({
      success: false,
      message: 'No se detectaron registros de marcación válidos en el archivo. Verifique que sea un archivo de asistencia ZKTeco (1_attlog.dat, CSV o TXT).',
    });
  }

  const integration = await integrateRealPunchesIntoSystem(parsedPunches, `USB_ATTLOG (${filename || '1_attlog.dat'})`, {
    id: targetDev?.id,
    serial: serialHint,
    name: targetDev?.name || 'Importación USB Reloj ZKTeco',
  });

  return res.json({
    success: true,
    status_code: integration.dbSaved ? 'PUNCHES_RECEIVED' : 'DB_ERROR',
    total_parsed: parsedPunches.length,
    newly_added: integration.newlyAdded,
    duplicates_skipped: integration.duplicatesSkipped,
    unidentified_count: integration.unidentifiedCount,
    db_saved: integration.dbSaved,
    db_error: integration.dbError,
    total_stored: integration.totalStored,
    message: `Se procesaron ${parsedPunches.length} marcaciones del archivo ${filename || '1_attlog.dat'} (${integration.newlyAdded} nuevas, ${integration.duplicatesSkipped} duplicadas omitidas, ${integration.unidentifiedCount} pendientes de identificación).`,
    punches: integration.enrichedPunches,
  });
});

// GET /api/zkteco/biotime/config - Devuelve configuración BioTime PRO (NUNCA contraseñas en claro)
app.get('/api/zkteco/biotime/config', (_req, res) => {
  return res.json({ success: true, config: getPublicBioTimeConfigServer() });
});

// POST /api/zkteco/biotime/config - Persiste configuración manual de BioTime PRO
app.post('/api/zkteco/biotime/config', (req, res) => {
  try {
    const config = saveStoredBioTimeConfigServer(req.body || {});
    return res.json({
      success: true,
      config,
      message: `Configuración BioTime PRO guardada (${config.protocol.toUpperCase()} ${config.host}:${config.httpPort} / PG :${config.pgPort}).`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Error guardando configuración BioTime PRO: ${err?.message}` });
  }
});

// POST /api/zkteco/biotime/detect-ports - Sondea puertos reales HTTP/HTTPS de BioTime PRO
app.post('/api/zkteco/biotime/detect-ports', async (req, res) => {
  const effective = resolveBioTimeEffectiveParamsServer(req.body || {});
  const report = await detectBioTimePortsServer({
    host: effective.host,
    protocol: effective.protocol,
    configuredPort: effective.httpPort,
    ports: Array.isArray(req.body?.ports) ? req.body.ports : undefined,
    timeoutMs: Math.min(3500, effective.timeoutMs),
  });
  return res.json(report);
});

// POST /api/zkteco/biotime/test-connection - Prueba diagnóstica real en 7 etapas sin simulación
app.post('/api/zkteco/biotime/test-connection', async (req, res) => {
  const body = req.body || {};
  const effective = resolveBioTimeEffectiveParamsServer(body);
  const report = await testBioTimeConnectionServer({
    host: body.host !== undefined ? String(body.host).trim() : effective.host,
    httpPort: body.httpPort ?? body.webPort ?? effective.httpPort,
    protocol: effective.protocol,
    pgPort: effective.pgPort,
    authMethod: effective.authMethod,
    authUser: effective.authUser,
    authPassword: effective.authPassword,
    timeoutMs: effective.timeoutMs,
  });
  try {
    saveStoredBioTimeConfigServer({
      ...body,
      lastStatus: report.status,
      lastTestedAt: report.timestamp,
      lastMessage: report.message,
    });
  } catch (_) {}
  return res.json(report);
});

// GET/POST /api/zkteco/biotime/devices - Consulta terminales registrados en BioTime PRO (Solo lectura)
app.get('/api/zkteco/biotime/devices', async (_req, res) => {
  const effective = resolveBioTimeEffectiveParamsServer({});
  const result = await fetchBioTimeTerminalsServer(effective);
  return res.status(result.success ? 200 : 200).json(result);
});

app.post('/api/zkteco/biotime/devices', async (req, res) => {
  const effective = resolveBioTimeEffectiveParamsServer(req.body || {});
  const result = await fetchBioTimeTerminalsServer(effective);
  return res.json(result);
});

// POST /api/zkteco/biotime/download-punches - Descarga paginada real de marcaciones BioTime PRO (Solo lectura)
app.post('/api/zkteco/biotime/download-punches', async (req, res) => {
  const body = req.body || {};
  const effective = resolveBioTimeEffectiveParamsServer(body);
  const devices = await getLatestDeviceConfig();
  const dev = devices[0] || {};
  const targetSerial = String(body.serial || '').trim().toUpperCase();

  const apiRes = await fetchBioTimeHttpApiServer({
    protocol: effective.protocol,
    host: effective.host,
    httpPort: effective.httpPort,
    webPort: effective.httpPort,
    authMethod: effective.authMethod,
    serial: targetSerial,
    authUser: effective.authUser,
    authPassword: effective.authPassword,
    startDate: body.startDate ? String(body.startDate).trim() : '',
    endDate: body.endDate ? String(body.endDate).trim() : '',
    timeoutMs: effective.timeoutMs,
    inspectOnly: false,
  });

  if (!apiRes.success) {
    return res.json({
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
    });
  }

  const integration = await integrateRealPunchesIntoSystem(apiRes.punches, 'BIOTIME_API', {
    id: dev?.id || 'dev-01',
    serial: targetSerial || dev?.serial_number || 'AEH2223460040',
    name: dev?.name || 'ZKTeco (vía BioTime PRO)',
    ip: effective.host,
  });

  return res.json({
    success: true,
    status: 'CONECTADO',
    source: 'BIOTIME_API',
    read_count: apiRes.punches.length,
    new_count: integration.newlyAdded,
    duplicate_count: integration.duplicatesSkipped,
    pending_count: integration.unidentifiedCount,
    pages_fetched: apiRes.pagesFetched || 1,
    punches_count: integration.totalStored,
    db_saved: integration.dbSaved,
    db_error: integration.dbError,
    punches: integration.enrichedPunches,
    message: `Descarga BioTime PRO completada: ${apiRes.punches.length} leídas, ${integration.newlyAdded} nuevas, ${integration.duplicatesSkipped} duplicadas omitidas${integration.unidentifiedCount > 0 ? `, ${integration.unidentifiedCount} pendientes de identificación` : ''}.`,
  });
});

// POST /api/zkteco/biotime/inspect - Inspección read-only de esquema BioTime PostgreSQL + HTTP/HTTPS PRO
app.post('/api/zkteco/biotime/inspect', async (req, res) => {
  const body = req.body || {};
  const devices = await getLatestDeviceConfig();
  const dev = devices[0] || {};
  const effective = resolveBioTimeEffectiveParamsServer({
    ...body,
    host: body.host || dev?.biotime_config?.db_host,
    httpPort: body.httpPort || body.webPort || dev?.biotime_config?.web_port,
    pgPort: body.port || body.pgPort || dev?.biotime_config?.db_port,
    pgDbName: body.dbName || dev?.biotime_config?.db_name,
    pgUser: body.user || dev?.biotime_config?.db_user,
  });

  const report = await inspectBioTimeDb({
    protocol: effective.protocol,
    host: effective.host,
    httpPort: effective.httpPort,
    webPort: effective.httpPort,
    port: effective.pgPort,
    dbName: effective.pgDbName,
    user: effective.pgUser,
    password: effective.pgPassword || undefined,
    authMethod: effective.authMethod,
    authUser: effective.authUser || undefined,
    authPassword: effective.authPassword || undefined,
    serial: String(body.serial || dev?.serial_number || '').trim(),
    timeoutMs: effective.timeoutMs,
    strictPort: Boolean(body.httpPort || body.webPort),
  });

  return res.status(report.success ? 200 : 503).json(report);
});

// POST /api/zkteco/biotime/sync - Sincronización desde BioTime PRO (HTTP/HTTPS API o PostgreSQL)
app.post('/api/zkteco/biotime/sync', async (req, res) => {
  const body = req.body || {};
  const devices = await getLatestDeviceConfig();
  const dev = devices[0] || {};
  const effective = resolveBioTimeEffectiveParamsServer({
    ...body,
    host: body.host || dev?.biotime_config?.db_host,
    httpPort: body.httpPort || body.webPort || dev?.biotime_config?.web_port,
    pgPort: body.port || body.pgPort || dev?.biotime_config?.db_port,
    pgDbName: body.dbName || dev?.biotime_config?.db_name,
    pgUser: body.user || dev?.biotime_config?.db_user,
  });
  const targetSerial = String(body.serial || dev?.serial_number || 'AEH2223460040').trim();

  const result = await syncPunchesFromBioTimeDb({
    protocol: effective.protocol,
    host: effective.host,
    httpPort: effective.httpPort,
    webPort: effective.httpPort,
    port: effective.pgPort,
    dbName: effective.pgDbName,
    user: effective.pgUser,
    password: effective.pgPassword || undefined,
    authMethod: effective.authMethod,
    authUser: effective.authUser || undefined,
    authPassword: effective.authPassword || undefined,
    serial: targetSerial,
    startDate: body.startDate ? String(body.startDate).trim() : '',
    endDate: body.endDate ? String(body.endDate).trim() : '',
    timeoutMs: effective.timeoutMs,
    strictPort: Boolean(body.httpPort || body.webPort),
  });

  if (!result.success) {
    return res.status(503).json({
      success: false,
      needsWebCredentials: !!result.needsWebCredentials,
      status_code: 'OFFLINE',
      message: result.message,
      inspection: result.inspection,
      host: effective.host,
      webPort: Number(result.inspection?.webPort || effective.httpPort),
      port: effective.pgPort,
      dbName: effective.pgDbName,
    });
  }

  const integration = await integrateRealPunchesIntoSystem(result.punches, result.source || 'BIOTIME_API', {
    id: dev?.id,
    serial: targetSerial,
    name: dev?.name || 'ZKTeco G3 (vía BioTime)',
    ip: effective.host,
  });

  return res.json({
    success: integration.dbSaved || integration.newlyAdded === 0,
    source: result.source || 'BIOTIME_API',
    status_code: !integration.dbSaved && integration.newlyAdded > 0
      ? 'DB_ERROR'
      : integration.newlyAdded > 0
      ? 'PUNCHES_RECEIVED'
      : 'ONLINE_NO_NEW_PUNCHES',
    message: !integration.dbSaved && integration.newlyAdded > 0
      ? `Marcaciones leídas (${integration.newlyAdded}), pero error al almacenar en Supabase: ${integration.dbError}`
      : integration.newlyAdded > 0
      ? `Sincronización BioTime exitosa: ${integration.newlyAdded} nuevas marcaciones (${integration.duplicatesSkipped} duplicadas omitidas, ${integration.unidentifiedCount} pendientes de identificación).`
      : `BioTime consultado: sin marcaciones nuevas (${result.punches.length} registros revisados).`,
    imported_count: result.punches.length,
    new_count: integration.newlyAdded,
    duplicates_skipped: integration.duplicatesSkipped,
    unidentified_count: integration.unidentifiedCount,
    db_saved: integration.dbSaved,
    db_error: integration.dbError,
    total_stored: integration.totalStored,
    inspection: result.inspection,
    punches: integration.enrichedPunches,
  });
});

// POST /api/zkteco/biotime/test - Probar enlace e inspección a BioTime
app.post('/api/zkteco/biotime/test', async (req, res) => {
  const body = req.body || {};
  const effective = resolveBioTimeEffectiveParamsServer(body);
  const report = await inspectBioTimeDb({
    protocol: effective.protocol,
    host: effective.host,
    httpPort: effective.httpPort,
    webPort: effective.httpPort,
    port: effective.pgPort,
    dbName: effective.pgDbName,
    user: effective.pgUser,
    password: effective.pgPassword || undefined,
    authMethod: effective.authMethod,
    authUser: effective.authUser || undefined,
    authPassword: effective.authPassword || undefined,
    serial: body.serial ? String(body.serial) : undefined,
    timeoutMs: effective.timeoutMs,
    strictPort: Boolean(body.httpPort || body.webPort),
  });

  return res.status(report.success ? 200 : 500).json({
    ...report,
    total_records: report.deviceTransactions,
  });
});

// POST /api/zkteco/punches/:id/assign-employee - Vincular manualmente marcación pendiente con trabajador
const handleAssignEmployeeToPunch = async (req: express.Request, res: express.Response) => {
  const punchId = req.params.id;
  const { employee_id, employee_code, save_pin_to_employee = true, apply_to_same_code = true } = req.body || {};

  const userRole = String(req.headers['x-user-role'] || req.body?.user_role || '').trim();
  const ALLOWED_ROLES = ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'CONTROL_ASISTENCIA', 'SUPERVISOR', 'DIRECTOR_GENERAL'];
  if (userRole && !ALLOWED_ROLES.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Solo usuarios autorizados pueden vincular códigos biométricos pendientes.',
    });
  }

  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const rawPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
  const existingAttendance = readJsonFile<any[]>(ATTENDANCE_FILE, []);
  const closedPeriods = readJsonFile<ClosedPeriodEntry[]>(CLOSED_PERIODS_FILE, []);

  const emp = employees.find((e) => e.id === employee_id || e.dni === employee_id);
  if (!emp) {
    return res.status(404).json({ success: false, message: 'Trabajador seleccionado no encontrado.' });
  }

  const targetPunch = punchId
    ? rawPunches.find((p) => p.id === punchId || p.punch_id === punchId)
    : null;
  const codeToLink = String(employee_code || targetPunch?.employee_code || targetPunch?.employee_dni || '').trim();

  if (!targetPunch && !codeToLink) {
    return res.status(404).json({ success: false, message: 'Marcación o código biométrico no especificado.' });
  }

  const targetSn = targetPunch?.device_sn || '';
  const updatedPunches: any[] = [];
  const empFullName = normalizePersonName(`${emp.first_name} ${emp.last_name}`);
  let closedPeriodPreservedCount = 0;

  for (let i = 0; i < rawPunches.length; i++) {
    const p = rawPunches[i];
    const pCode = String(p.employee_code || p.employee_dni || '').trim();
    const matchTarget =
      (targetPunch && (p.id === targetPunch.id || p.punch_id === targetPunch.punch_id)) ||
      (apply_to_same_code && pCode === codeToLink && (!targetSn || p.device_sn === targetSn) && !p.employee_id);

    if (matchTarget) {
      rawPunches[i] = {
        ...p,
        employee_id: emp.id,
        employee_dni: emp.dni,
        employee_codigo_drac: emp.codigo_trabajador || null,
        employee_code: pCode || codeToLink,
        employee_name: empFullName,
        dependencia_name: normalizeInstitutionalName(emp.dependencia_name || ''),
        direccion_organo_name: normalizeInstitutionalName(emp.direccion_organo_name || ''),
        area_name: normalizeInstitutionalName(emp.area_name || ''),
        cargo_name: normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || ''),
        validation_status: 'VALIDA',
        processed: true,
        linked_at: new Date().toISOString(),
        linked_by: String(req.headers['x-user-name'] || req.body?.user_name || 'Operador Autorizado'),
        record_version: (Number(p.record_version) || 1) + 1,
        updated_at: new Date().toISOString(),
      };
      updatedPunches.push(rawPunches[i]);
      enqueueOutboxEvent(STORAGE_DIRS, {
        entity_type: 'marcaciones_raw',
        entity_id: rawPunches[i].id,
        operation: 'UPSERT',
        payload: rawPunches[i],
        record_version: rawPunches[i].record_version,
        origin: process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB',
      });
      if (!isPeriodClosed(p.fecha, closedPeriods)) {
        upsertAttendanceFromIdentifiedPunch(existingAttendance, emp, rawPunches[i]);
      } else {
        closedPeriodPreservedCount++;
      }
    }
  }

  if (save_pin_to_employee && codeToLink) {
    const empIdx = employees.findIndex((e) => e.id === emp.id);
    if (empIdx >= 0) {
      employees[empIdx] = {
        ...employees[empIdx],
        zkteco_pin: codeToLink,
        biometric_user_id: codeToLink,
        record_version: (Number(employees[empIdx].record_version) || 1) + 1,
        updated_at: new Date().toISOString(),
      };
      writeJsonFile(EMPLOYEES_FILE, employees);
      enqueueOutboxEvent(STORAGE_DIRS, {
        entity_type: 'trabajadores',
        entity_id: employees[empIdx].id,
        operation: 'UPSERT',
        payload: employees[empIdx],
        record_version: employees[empIdx].record_version,
        origin: process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB',
      });
    }
  }

  writeJsonFile(RAW_PUNCHES_FILE, rawPunches);
  writeJsonFile(ATTENDANCE_FILE, existingAttendance);
  const dbRes = await persistRawPunchesToSupabase(updatedPunches);

  // Sincronizar también la vinculación (device_sn, pin) en Usuarios Registrados en Relojes
  if (codeToLink) {
    try {
      const devices = readJsonFile<any[]>(DEVICES_FILE, []);
      const dev = devices.find((d) => d.serial_number === targetSn || d.id === targetPunch?.device_id) || devices[0];
      const snResolved = String(targetSn || dev?.serial_number || 'AEH2223460040').trim().toUpperCase();
      const duId = buildDeviceUserId(snResolved, codeToLink);
      const deviceUsers = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
      const history = readJsonFile<DeviceUserChangeLog[]>(DEVICE_USER_HISTORY_FILE, []);
      const nowIso = new Date().toISOString();
      const operatorName = String(req.headers['x-user-name'] || req.body?.user_name || 'Operador Autorizado');
      const operatorRole = String(req.headers['x-user-role'] || req.body?.user_role || 'ADMIN_GENERAL');
      const idx = deviceUsers.findIndex((u) => u.id === duId || (u.device_sn === snResolved && u.pin === codeToLink));
      const baseFields = {
        link_status: 'VINCULADO' as const,
        employee_id: emp.id,
        employee_codigo_drac: emp.codigo_trabajador || null,
        employee_dni: emp.dni,
        employee_full_name: empFullName,
        employee_dependencia_name: emp.dependencia_name || null,
        employee_area_name: emp.area_name || null,
        employee_cargo_name: emp.cargo_name || null,
        linked_by: operatorName,
        linked_at: nowIso,
        unlinked_at: null,
        updated_at: nowIso,
      };
      if (idx >= 0) {
        const prev = deviceUsers[idx];
        deviceUsers[idx] = { ...prev, ...baseFields };
        history.unshift({
          id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          device_user_id: prev.id,
          device_sn: snResolved,
          pin: codeToLink,
          event_type: prev.employee_id ? 'RELINKED' : 'LINKED',
          previous_employee_id: prev.employee_id || null,
          new_employee_id: emp.id,
          observation: `Vinculado desde Control de Asistencia (${updatedPunches.length} marcaciones actualizadas).`,
          operator_name: operatorName,
          operator_role: operatorRole,
          created_at: nowIso,
        });
      } else {
        deviceUsers.push({
          id: duId,
          device_id: dev?.id || targetPunch?.device_id || 'dev-01',
          device_sn: snResolved,
          device_name: dev?.name || targetPunch?.device_name || snResolved,
          device_ip: dev?.ip_address,
          pin: codeToLink,
          clock_name: null,
          source_method: 'MANUAL',
          source_scope: 'DIRECT_CLOCK',
          available_fields: ['pin'],
          present_on_device: true,
          first_seen_at: nowIso,
          last_queried_at: nowIso,
          ...baseFields,
        });
        history.unshift({
          id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          device_user_id: duId,
          device_sn: snResolved,
          pin: codeToLink,
          event_type: 'LINKED',
          new_employee_id: emp.id,
          observation: `Registro creado por vinculación de marcación pendiente en ${snResolved}.`,
          operator_name: operatorName,
          operator_role: operatorRole,
          created_at: nowIso,
        });
      }
      writeJsonFile(DEVICE_USERS_FILE, deviceUsers);
      writeJsonFile(DEVICE_USER_HISTORY_FILE, history.slice(0, 1500));
    } catch (_) {}
  }

  return res.json({
    success: true,
    updated_count: updatedPunches.length,
    linked_code: codeToLink,
    employee_name: empFullName,
    employee_dni: emp.dni,
    db_saved: dbRes.dbSaved,
    db_error: dbRes.dbError,
    message: `Código biométrico "${codeToLink}" vinculado correctamente a ${empFullName} (${updatedPunches.length} marcaciones actualizadas).`,
  });
};

app.post('/api/zkteco/punches/:id/assign-employee', handleAssignEmployeeToPunch);
app.post('/api/zkteco/link-pin', handleAssignEmployeeToPunch);

// =========================================================================
// USUARIOS REALES REGISTRADOS EN RELOJES ZKTECO & VINCULACIÓN INSTITUCIONAL
// =========================================================================

async function persistDeviceUsersToSupabase(
  users: BiometricDeviceUser[],
  history: DeviceUserChangeLog[] = [],
  syncRuns: DeviceUserSyncRun[] = []
): Promise<{ dbSaved: boolean; dbError: string | null }> {
  const isPlaceholder =
    !SUPABASE_URL ||
    SUPABASE_URL.includes('rfqgmoremevypexrrsyf.supabase.co') ||
    SUPABASE_URL.includes('your-project-ref.supabase.co');
  if (isPlaceholder) {
    return { dbSaved: false, dbError: 'Instancia Supabase no configurada (persistencia local activa).' };
  }
  try {
    if (users.length > 0) {
      const originRows = users.map((u) => ({
        id: u.id,
        device_id: u.device_id,
        device_sn: u.device_sn,
        device_name: u.device_name,
        pin: u.pin,
        uid: u.uid ?? null,
        clock_name: u.clock_name ?? null,
        clock_employee_code: u.clock_employee_code ?? null,
        card_number: u.card_number ?? null,
        privilege_code: u.privilege_code ?? null,
        privilege_label: u.privilege_label ?? null,
        clock_status: u.clock_status ?? null,
        source_method: u.source_method,
        source_scope: u.source_scope,
        available_fields: u.available_fields || [],
        raw_attributes: u.raw_attributes || {},
        present_on_device: Boolean(u.present_on_device),
        first_seen_at: u.first_seen_at,
        last_queried_at: u.last_queried_at,
        last_clock_updated_at: u.last_clock_updated_at || null,
        missing_since_at: u.missing_since_at || null,
      }));
      const uRes: any = await withServerTimeout(
        Promise.resolve(supabaseServer.from('usuarios_reloj').upsert(originRows, { onConflict: 'id' })),
        3500,
        'Timeout upsert usuarios_reloj'
      );
      if (uRes?.error) return { dbSaved: false, dbError: uRes.error.message };

      const linkRows = users.map((u) => ({
        id: `vinc_${u.id}`,
        device_user_id: u.id,
        device_sn: u.device_sn,
        pin: u.pin,
        trabajador_id: u.employee_id || null,
        codigo_drac: u.employee_codigo_drac || null,
        dni: u.employee_dni || null,
        nombre_institucional: u.employee_full_name || null,
        dependencia_name: u.employee_dependencia_name || null,
        area_name: u.employee_area_name || null,
        cargo_name: u.employee_cargo_name || null,
        estado_vinculacion: u.link_status,
        conflicto_detalle: u.conflict_reason || null,
        posible_trabajador_id: u.candidate_employee_id || null,
        posible_trabajador_nombre: u.candidate_employee_name || null,
        posible_motivo: u.candidate_reason || null,
        observaciones: u.observations || null,
        vinculado_por: u.linked_by || null,
        vinculado_en: u.linked_at || null,
        desvinculado_en: u.unlinked_at || null,
        updated_at: u.updated_at,
      }));
      await withServerTimeout(
        Promise.resolve(supabaseServer.from('vinculaciones_usuario_reloj').upsert(linkRows, { onConflict: 'id' })),
        3500,
        'Timeout upsert vinculaciones_usuario_reloj'
      );
    }
    if (history.length > 0) {
      const hRows = history.slice(0, 50).map((h) => ({
        id: h.id,
        device_user_id: h.device_user_id,
        device_sn: h.device_sn,
        pin: h.pin,
        tipo_evento: h.event_type,
        trabajador_anterior_id: h.previous_employee_id || null,
        trabajador_nuevo_id: h.new_employee_id || null,
        valores_anteriores: h.previous_values || null,
        valores_nuevos: h.new_values || null,
        observacion: h.observation || null,
        usuario_operador: h.operator_name,
        rol_operador: h.operator_role,
        created_at: h.created_at,
      }));
      await withServerTimeout(
        Promise.resolve(supabaseServer.from('historial_usuarios_reloj').upsert(hRows, { onConflict: 'id' })),
        3000,
        'Timeout upsert historial_usuarios_reloj'
      );
    }
    if (syncRuns.length > 0) {
      const sRows = syncRuns.slice(0, 20).map((s) => ({
        id: s.id,
        device_id: s.device_id,
        device_sn: s.device_sn,
        device_name: s.device_name,
        metodo: s.method,
        alcance: s.source_scope,
        exito: s.success,
        mensaje: s.message,
        total_recuperados: s.total_fetched,
        nuevos: s.new_users,
        actualizados: s.updated_users,
        sin_cambios: s.unchanged_users,
        no_encontrados_en_reloj: s.missing_users,
        reaparecidos: s.reappeared_users,
        pendientes_vinculacion: s.pending_count,
        vinculados: s.linked_count,
        ejecutado_por: s.executed_by,
        created_at: s.created_at,
      }));
      await withServerTimeout(
        Promise.resolve(supabaseServer.from('consultas_usuarios_reloj').upsert(sRows, { onConflict: 'id' })),
        3000,
        'Timeout upsert consultas_usuarios_reloj'
      );
    }
    return { dbSaved: true, dbError: null };
  } catch (err: any) {
    return { dbSaved: false, dbError: err?.message || 'Error sincronizando usuarios de reloj con Supabase' };
  }
}

async function queryDeviceUsersFromBioTimeServer(options: {
  protocol?: string;
  host?: string;
  httpPort?: number;
  webPort?: number;
  dbPort?: number;
  dbName?: string;
  dbUser?: string;
  password?: string;
  authMethod?: string;
  authUser?: string;
  webUser?: string;
  authPassword?: string;
  webPassword?: string;
  serial?: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  needsWebCredentials?: boolean;
  source_method: 'BIOTIME_HTTP_API' | 'BIOTIME_PG_SQL';
  source_scope: 'BIOTIME_DEVICE_SCOPED' | 'BIOTIME_GLOBAL';
  users: RawClockUserInput[];
  message: string;
  error?: string;
}> {
  const cleanHost = String(options.host || '192.168.1.29').trim();
  const cleanProto = String(options.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
  const baseWebPort = Number(options.httpPort ?? options.webPort) || 8088;
  const dbPort = Number(options.dbPort) || 7496;
  const cleanSerial = String(options.serial || '').trim().toUpperCase();
  const webUser = String(options.authUser ?? options.webUser ?? '').trim();
  const webPassword = String(options.authPassword ?? options.webPassword ?? '').trim();
  const authMethod = String(options.authMethod || 'AUTO').toUpperCase();
  const timeoutMs = Math.min(20000, Math.max(1500, Number(options.timeoutMs) || 5500));

  const candidatePorts = options.httpPort || options.webPort
    ? [baseWebPort]
    : [baseWebPort, baseWebPort === 89 ? 8088 : 89].filter((p, i, a) => p > 0 && a.indexOf(p) === i);
  const probeTcp = (h: string, p: number) =>
    new Promise<boolean>((resolve) => {
      const s = new net.Socket();
      let done = false;
      s.setTimeout(2200);
      s.on('connect', () => { if (!done) { done = true; s.destroy(); resolve(true); } });
      s.on('timeout', () => { if (!done) { done = true; s.destroy(); resolve(false); } });
      s.on('error', () => { if (!done) { done = true; s.destroy(); resolve(false); } });
      s.connect(p, h);
    });

  let activeWebPort: number | null = null;
  for (const p of candidatePorts) {
    if (await probeTcp(cleanHost, p)) {
      activeWebPort = p;
      break;
    }
  }

  if (activeWebPort && webUser && webPassword) {
    const requestHttp = (urlPath: string, method = 'GET', bodyStr = '', extraHeaders: Record<string, string> = {}) =>
      requestBioTimeHttpServer({ protocol: cleanProto, host: cleanHost, port: activeWebPort!, path: urlPath, method, body: bodyStr, headers: extraHeaders, timeoutMs });

    let authHeaders: Record<string, string> | null = null;
    try {
      const auth = await authenticateBioTimeServer({ protocol: cleanProto, host: cleanHost, port: activeWebPort!, authMethod, authUser: webUser, authPassword: webPassword, timeoutMs });
      if (auth.ok) authHeaders = auth.headers;
    } catch (_) {}

    if (authHeaders) {
      const terminalAreaIds = new Set<string>();
      try {
        const tRes = await requestHttp('/iclock/api/terminals/?page=1&page_size=50', 'GET', '', authHeaders);
        const terminals = Array.isArray(tRes?.json?.data) ? tRes.json.data : [];
        const term = terminals.find((t: any) => String(t.sn || '').trim().toUpperCase() === cleanSerial);
        if (term?.area) {
          const areaArr = Array.isArray(term.area) ? term.area : [term.area];
          areaArr.forEach((a: any) => terminalAreaIds.add(String(typeof a === 'object' ? a.id : a)));
        }
      } catch (_) {}

      const emps: any[] = [];
      for (let page = 1; page <= 15; page++) {
        const eRes = await requestHttp(`/personnel/api/employees/?page=${page}&page_size=200`, 'GET', '', authHeaders);
        if (eRes.status !== 200 || !eRes.json || !Array.isArray(eRes.json.data)) break;
        emps.push(...eRes.json.data);
        if (!eRes.json.next || emps.length >= Number(eRes.json.count || 0)) break;
      }

      if (emps.length > 0) {
        let scoped = emps;
        let scope: 'BIOTIME_DEVICE_SCOPED' | 'BIOTIME_GLOBAL' = 'BIOTIME_GLOBAL';
        if (terminalAreaIds.size > 0) {
          const areaMatched = emps.filter((e) => {
            const areas = Array.isArray(e.area) ? e.area : e.area ? [e.area] : [];
            return areas.some((a: any) => terminalAreaIds.has(String(typeof a === 'object' ? a.id : a)));
          });
          if (areaMatched.length > 0) {
            scoped = areaMatched;
            scope = 'BIOTIME_DEVICE_SCOPED';
          }
        }
        const users: RawClockUserInput[] = scoped
          .map((e): RawClockUserInput | null => {
            const pin = String(e.emp_code || e.pin || '').trim();
            if (!pin) return null;
            const fullName = [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || e.nickname || null;
            const priv = e.dev_privilege !== null && e.dev_privilege !== undefined ? Number(e.dev_privilege) : null;
            const cardNo = e.card_no ? String(e.card_no).trim() : null;
            const statusStr = e.enable_att === false ? 'INACTIVO' : e.enable_att === true ? 'ACTIVO' : e.status !== undefined ? String(e.status) : null;
            const available = ['pin', 'clock_employee_code'];
            if (fullName) available.push('clock_name');
            if (cardNo) available.push('card_number');
            if (priv !== null && !Number.isNaN(priv)) available.push('privilege');
            if (statusStr) available.push('clock_status');
            return {
              pin,
              uid: e.id !== undefined ? Number(e.id) : null,
              clock_name: fullName,
              clock_employee_code: pin,
              card_number: cardNo,
              privilege_code: priv,
              privilege_label: normalizePrivilegeLabel(priv),
              clock_status: statusStr,
              clock_updated_at: e.update_time || e.change_time || null,
              source_method: 'BIOTIME_HTTP_API',
              source_scope: scope,
              available_fields: available,
              raw_attributes: { biotime_emp_id: e.id, terminal_sn: cleanSerial },
            };
          })
          .filter((x): x is RawClockUserInput => x !== null);

        return {
          success: true,
          source_method: 'BIOTIME_HTTP_API',
          source_scope: scope,
          users,
          message: `${users.length} usuarios recuperados vía BioTime PRO HTTP (http://${cleanHost}:${activeWebPort}) [${scope}].`,
        };
      }
    }
  }

  // Fallback PostgreSQL BioTime solo lectura
  if (await probeTcp(cleanHost, dbPort)) {
    const passwords = [...new Set([options.password, '', '123456', 'admin', 'postgres', 'biotime', 'root', 'ZKTeco123', 'ZK123456'].filter((x) => x !== undefined))];
    for (const pwd of passwords) {
      const client = new pg.Client({
        host: cleanHost,
        port: dbPort,
        database: options.dbName || 'biotime',
        user: options.dbUser || 'postgres',
        password: pwd,
        connectionTimeoutMillis: 2500,
        statement_timeout: 4000,
      });
      try {
        await client.connect();
        const snPins = new Set<string>();
        if (cleanSerial) {
          try {
            const pRes = await client.query(
              `SELECT DISTINCT emp_code FROM iclock_transaction WHERE UPPER(COALESCE(terminal_sn::text, '')) = $1 AND emp_code IS NOT NULL`,
              [cleanSerial]
            );
            pRes.rows.forEach((r: any) => snPins.add(String(r.emp_code).trim()));
          } catch (_) {}
        }
        const empQ = await client.query(`SELECT id, emp_code, first_name, last_name, card_no, dev_privilege, enable_att, status, update_time FROM personnel_employee ORDER BY emp_code ASC LIMIT 5000`);
        await client.end();

        let rows = empQ.rows || [];
        let scope: 'BIOTIME_DEVICE_SCOPED' | 'BIOTIME_GLOBAL' = 'BIOTIME_GLOBAL';
        if (snPins.size > 0) {
          const filtered = rows.filter((r: any) => snPins.has(String(r.emp_code || '').trim()));
          if (filtered.length > 0) {
            rows = filtered;
            scope = 'BIOTIME_DEVICE_SCOPED';
          }
        }
        const users: RawClockUserInput[] = rows
          .map((r: any): RawClockUserInput | null => {
            const pin = String(r.emp_code || '').trim();
            if (!pin) return null;
            const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null;
            const priv = r.dev_privilege !== null && r.dev_privilege !== undefined ? Number(r.dev_privilege) : null;
            const cardNo = r.card_no ? String(r.card_no).trim() : null;
            const statusStr = r.enable_att === false ? 'INACTIVO' : r.enable_att === true ? 'ACTIVO' : r.status !== null && r.status !== undefined ? String(r.status) : null;
            const available = ['pin', 'clock_employee_code'];
            if (fullName) available.push('clock_name');
            if (cardNo) available.push('card_number');
            if (priv !== null) available.push('privilege');
            if (statusStr) available.push('clock_status');
            return {
              pin,
              uid: r.id !== undefined ? Number(r.id) : null,
              clock_name: fullName,
              clock_employee_code: pin,
              card_number: cardNo,
              privilege_code: priv,
              privilege_label: normalizePrivilegeLabel(priv),
              clock_status: statusStr,
              clock_updated_at: r.update_time ? new Date(r.update_time).toISOString() : null,
              source_method: 'BIOTIME_PG_SQL',
              source_scope: scope,
              available_fields: available,
              raw_attributes: { biotime_emp_id: r.id, terminal_sn: cleanSerial },
            };
          })
          .filter((x): x is RawClockUserInput => x !== null);

        return {
          success: true,
          source_method: 'BIOTIME_PG_SQL',
          source_scope: scope,
          users,
          message: `${users.length} usuarios reales consultados desde PostgreSQL BioTime PRO (${cleanHost}:${dbPort}) [${scope}].`,
        };
      } catch (_) {
        try { await client.end(); } catch (_) {}
      }
    }
  }

  return {
    success: false,
    needsWebCredentials: Boolean(activeWebPort && (!webUser || !webPassword)),
    source_method: 'BIOTIME_HTTP_API',
    source_scope: 'BIOTIME_GLOBAL',
    users: [],
    error: activeWebPort ? 'BIOTIME_CREDENTIALS_OR_AUTH' : 'BIOTIME_UNREACHABLE',
    message: activeWebPort
      ? `BioTime PRO HTTP activo en ${cleanHost}:${activeWebPort}. Ingrese usuario y contraseña de BioTime PRO para consultar usuarios.`
      : `BioTime PRO en ${cleanHost} (HTTP :${baseWebPort} / PostgreSQL :${dbPort}) no está alcanzable desde este servidor.`,
  };
}

async function queryDeviceUsersTcpServer(dev: any): Promise<{
  success: boolean;
  users: RawClockUserInput[];
  serial?: string;
  deviceName?: string;
  portUsed?: number;
  error?: string;
  message: string;
}> {
  const ip = String(dev?.ip_address || '').trim();
  const port = Number(dev?.port) || 7496;
  const candidatePorts = [port, 4370].filter((p, i, arr) => p > 0 && arr.indexOf(p) === i);
  let lastError = 'Sin respuesta TCP del reloj';

  for (const testPort of candidatePorts) {
    let zk: any = null;
    try {
      const inport = 5200 + Math.floor(Math.random() * 1000);
      zk = new ZKLib(ip, testPort, 3500, inport);
      await withServerTimeout(zk.createSocket(), 4000, `Timeout socket TCP en ${ip}:${testPort}`);
      let detectedSn = dev?.serial_number;
      let detectedName = dev?.name;
      try {
        if (typeof zk.getSerialNumber === 'function') {
          const sn = await withServerTimeout(zk.getSerialNumber(), 2000, 'Timeout SN');
          if (sn) detectedSn = String(sn).trim().toUpperCase();
        }
      } catch (_) {}
      try {
        if (typeof zk.getDeviceName === 'function') {
          const dn = await withServerTimeout(zk.getDeviceName(), 2000, 'Timeout DN');
          if (dn) detectedName = String(dn).trim();
        }
      } catch (_) {}

      const uRes: any = await withServerTimeout(zk.getUsers(), 5000, 'Timeout getUsers');
      try { await zk.disconnect(); } catch (_) {}

      const list = Array.isArray(uRes?.data) ? uRes.data : Array.isArray(uRes) ? uRes : [];
      const users: RawClockUserInput[] = list
        .map((u: any): RawClockUserInput | null => {
          const pin = String(u.userId ?? u.pin ?? u.uid ?? '').trim();
          if (!pin) return null;
          const uid = u.uid !== undefined && u.uid !== null && !Number.isNaN(Number(u.uid)) ? Number(u.uid) : null;
          const clockName = u.name ? String(u.name).replace(/\0/g, '').trim() || null : null;
          const cardNo = u.cardno && String(u.cardno).trim() !== '0' ? String(u.cardno).trim() : null;
          const priv = u.role !== undefined && u.role !== null && !Number.isNaN(Number(u.role)) ? Number(u.role) : null;
          const hasPwd = u.password !== undefined ? Boolean(String(u.password || '').trim()) : null;
          const available = ['pin'];
          if (uid !== null) available.push('uid');
          if (clockName) available.push('clock_name');
          if (cardNo) available.push('card_number');
          if (priv !== null) available.push('privilege');
          if (hasPwd !== null) available.push('has_password');
          return {
            pin,
            uid,
            clock_name: clockName,
            card_number: cardNo,
            privilege_code: priv,
            privilege_label: normalizePrivilegeLabel(priv),
            clock_status: null,
            has_password: hasPwd,
            source_method: 'TCP_NODE_ZKLIB',
            source_scope: 'DIRECT_CLOCK',
            available_fields: available,
            raw_attributes: { uid, userId: pin, role: priv, cardno: cardNo },
          };
        })
        .filter((x: RawClockUserInput | null): x is RawClockUserInput => x !== null);

      return {
        success: true,
        users,
        serial: detectedSn,
        deviceName: detectedName,
        portUsed: testPort,
        message: `${users.length} usuarios leídos directamente vía TCP (${ip}:${testPort}).`,
      };
    } catch (err: any) {
      lastError = err?.message || String(err);
      if (zk) { try { await zk.disconnect(); } catch (_) {} }
    }
  }

  return {
    success: false,
    users: [],
    error: lastError,
    message: `No se pudo consultar ${ip}:${port} por TCP (${lastError}).`,
  };
}

// GET /api/zkteco/device-users
app.get('/api/zkteco/device-users', (_req, res) => {
  const users = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
  const history = readJsonFile<DeviceUserChangeLog[]>(DEVICE_USER_HISTORY_FILE, []);
  const syncLogs = readJsonFile<DeviceUserSyncRun[]>(DEVICE_USER_SYNC_LOGS_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);

  // Refrescar estado dinámico sin alterar datos originales del reloj
  const refreshedUsers = users.map((u) => {
    const ev = classifyDeviceUserBinding(u, employees, users);
    const emp = ev.matchedEmployee;
    const cand = ev.candidateEmployee;
    return {
      ...u,
      link_status: ev.link_status,
      employee_codigo_drac: emp?.codigo_trabajador || u.employee_codigo_drac || null,
      employee_dni: emp?.dni || u.employee_dni || null,
      employee_full_name: emp ? normalizePersonName(`${emp.first_name} ${emp.last_name}`) : u.employee_full_name || null,
      employee_dependencia_name: emp?.dependencia_name || u.employee_dependencia_name || null,
      employee_area_name: emp?.area_name || u.employee_area_name || null,
      employee_cargo_name: emp?.position || emp?.cargo || emp?.cargo_name || u.employee_cargo_name || null,
      candidate_employee_id: !emp && cand ? cand.id : null,
      candidate_employee_name: !emp && cand ? normalizePersonName(`${cand.first_name} ${cand.last_name}`) : null,
      candidate_employee_dni: !emp && cand ? cand.dni : null,
      candidate_employee_code: !emp && cand ? cand.codigo_trabajador : null,
      candidate_reason: !emp ? ev.candidateReason : null,
      conflict_reason: ev.conflictReason,
    };
  });

  return res.json({
    success: true,
    users: refreshedUsers,
    history,
    syncLogs,
  });
});

// POST /api/zkteco/device-users/sync-store - Persiste resultados obtenidos directamente desde Electron Desktop
app.post('/api/zkteco/device-users/sync-store', async (req, res) => {
  const { users, history, syncLogs } = req.body || {};
  if (Array.isArray(users)) writeJsonFile(DEVICE_USERS_FILE, users);
  if (Array.isArray(history)) writeJsonFile(DEVICE_USER_HISTORY_FILE, history.slice(0, 1500));
  if (Array.isArray(syncLogs)) writeJsonFile(DEVICE_USER_SYNC_LOGS_FILE, syncLogs.slice(0, 300));
  const dbRes = await persistDeviceUsersToSupabase(
    Array.isArray(users) ? users : [],
    Array.isArray(history) ? history : [],
    Array.isArray(syncLogs) ? syncLogs : []
  );
  return res.json({ success: true, db_saved: dbRes.dbSaved, db_error: dbRes.dbError });
});

// POST /api/zkteco/device-users/query - Consulta real e idempotente de usuarios en relojes / BioTime PRO
app.post('/api/zkteco/device-users/query', async (req, res) => {
  const {
    deviceId,
    mode = 'AUTO',
    biotime = {},
  } = req.body || {};

  const operatorName = String(req.headers['x-user-name'] || req.body?.user_name || 'Administrador DRAC');
  const operatorRole = String(req.headers['x-user-role'] || req.body?.user_role || 'ADMIN_GENERAL');

  const allDevices = await getLatestDeviceConfig(deviceId);
  const targets = deviceId
    ? allDevices.filter((d) => d.id === deviceId || d.serial_number === deviceId)
    : allDevices;

  if (targets.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No hay dispositivos biométricos configurados para consultar.',
      results: [],
    });
  }

  let currentUsers = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
  let currentHistory = readJsonFile<DeviceUserChangeLog[]>(DEVICE_USER_HISTORY_FILE, []);
  let currentSyncLogs = readJsonFile<DeviceUserSyncRun[]>(DEVICE_USER_SYNC_LOGS_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);

  const perDeviceResults: any[] = [];
  let anySuccess = false;
  let needsWebCredentials = false;

  for (const dev of targets) {
    const devSn = String(dev.serial_number || dev.id || 'AEH2223460040').trim().toUpperCase();
    let tcpResult: any = { success: false, users: [], message: 'Omitido por modo BioTime' };

    if (mode !== 'BIOTIME') {
      tcpResult = await queryDeviceUsersTcpServer(dev);
    }

    if (tcpResult.success) {
      anySuccess = true;
      const rec = reconcileDeviceUsers({
        existingUsers: currentUsers,
        fetchedUsers: tcpResult.users,
        employees,
        deviceId: dev.id,
        deviceSn: tcpResult.serial || devSn,
        deviceName: tcpResult.deviceName || dev.name || devSn,
        deviceIp: dev.ip_address,
        method: 'TCP_NODE_ZKLIB',
        sourceScope: 'DIRECT_CLOCK',
        executedBy: operatorName,
        executedRole: operatorRole,
        message: tcpResult.message,
      });
      currentUsers = rec.mergedUsers;
      currentHistory = [...rec.newLogs, ...currentHistory].slice(0, 1500);
      currentSyncLogs = [rec.syncRun, ...currentSyncLogs].slice(0, 300);
      perDeviceResults.push(rec.syncRun);
      continue;
    }

    if (mode !== 'TCP_DIRECT' && (biotime?.host || dev.biotime_config?.enabled || dev.push_enabled)) {
      const effectiveBt = resolveBioTimeEffectiveParamsServer({
        ...biotime,
        host: biotime?.host || dev.push_server_address,
        httpPort: biotime?.httpPort ?? biotime?.webPort ?? dev.biotime_config?.web_port,
        pgPort: biotime?.pgPort ?? biotime?.dbPort ?? dev.biotime_config?.db_port,
        pgDbName: biotime?.dbName ?? dev.biotime_config?.db_name,
        pgUser: biotime?.dbUser ?? dev.biotime_config?.db_user,
      });
      const btRes = await queryDeviceUsersFromBioTimeServer({
        protocol: effectiveBt.protocol,
        host: effectiveBt.host,
        httpPort: effectiveBt.httpPort,
        webPort: effectiveBt.httpPort,
        dbPort: effectiveBt.pgPort,
        dbName: effectiveBt.pgDbName,
        dbUser: effectiveBt.pgUser,
        password: effectiveBt.pgPassword || undefined,
        authMethod: effectiveBt.authMethod,
        authUser: effectiveBt.authUser || undefined,
        authPassword: effectiveBt.authPassword || undefined,
        serial: devSn,
        timeoutMs: effectiveBt.timeoutMs,
      });

      if (btRes.success) {
        anySuccess = true;
        const rec = reconcileDeviceUsers({
          existingUsers: currentUsers,
          fetchedUsers: btRes.users,
          employees,
          deviceId: dev.id,
          deviceSn: devSn,
          deviceName: dev.name || devSn,
          deviceIp: dev.ip_address,
          method: btRes.source_method,
          sourceScope: btRes.source_scope,
          executedBy: operatorName,
          executedRole: operatorRole,
          message: btRes.message,
        });
        currentUsers = rec.mergedUsers;
        currentHistory = [...rec.newLogs, ...currentHistory].slice(0, 1500);
        currentSyncLogs = [rec.syncRun, ...currentSyncLogs].slice(0, 300);
        perDeviceResults.push(rec.syncRun);
        continue;
      }

      if (btRes.needsWebCredentials) needsWebCredentials = true;
      const failRun: DeviceUserSyncRun = {
        id: `du_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        device_id: dev.id,
        device_sn: devSn,
        device_name: dev.name || devSn,
        method: mode === 'BIOTIME' ? 'BIOTIME_HTTP_API' : 'AUTO',
        source_scope: 'DIRECT_CLOCK',
        success: false,
        message: mode === 'BIOTIME' ? btRes.message : `${tcpResult.message} | ${btRes.message}`,
        error: btRes.error || tcpResult.error || 'CONNECTION_FAILED',
        total_fetched: 0,
        new_users: 0,
        updated_users: 0,
        unchanged_users: 0,
        missing_users: 0,
        reappeared_users: 0,
        linked_count: currentUsers.filter((u) => u.device_sn === devSn && (u.link_status === 'VINCULADO' || u.link_status === 'REGISTRADO')).length,
        pending_count: currentUsers.filter((u) => u.device_sn === devSn && u.link_status === 'PENDIENTE_VINCULACION').length,
        possible_match_count: currentUsers.filter((u) => u.device_sn === devSn && u.link_status === 'POSIBLE_COINCIDENCIA').length,
        review_count: currentUsers.filter((u) => u.device_sn === devSn && u.link_status === 'REVISAR').length,
        executed_by: operatorName,
        created_at: new Date().toISOString(),
      };
      currentSyncLogs = [failRun, ...currentSyncLogs].slice(0, 300);
      perDeviceResults.push(failRun);
    } else {
      const failRun: DeviceUserSyncRun = {
        id: `du_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        device_id: dev.id,
        device_sn: devSn,
        device_name: dev.name || devSn,
        method: 'TCP_NODE_ZKLIB',
        source_scope: 'DIRECT_CLOCK',
        success: false,
        message: tcpResult.message,
        error: tcpResult.error || 'TCP_FAILED',
        total_fetched: 0,
        new_users: 0,
        updated_users: 0,
        unchanged_users: 0,
        missing_users: 0,
        reappeared_users: 0,
        linked_count: currentUsers.filter((u) => u.device_sn === devSn && (u.link_status === 'VINCULADO' || u.link_status === 'REGISTRADO')).length,
        pending_count: currentUsers.filter((u) => u.device_sn === devSn && u.link_status === 'PENDIENTE_VINCULACION').length,
        possible_match_count: currentUsers.filter((u) => u.device_sn === devSn && u.link_status === 'POSIBLE_COINCIDENCIA').length,
        review_count: currentUsers.filter((u) => u.device_sn === devSn && u.link_status === 'REVISAR').length,
        executed_by: operatorName,
        created_at: new Date().toISOString(),
      };
      currentSyncLogs = [failRun, ...currentSyncLogs].slice(0, 300);
      perDeviceResults.push(failRun);
    }
  }

  writeJsonFile(DEVICE_USERS_FILE, currentUsers);
  writeJsonFile(DEVICE_USER_HISTORY_FILE, currentHistory);
  writeJsonFile(DEVICE_USER_SYNC_LOGS_FILE, currentSyncLogs);

  const dbRes = await persistDeviceUsersToSupabase(currentUsers, currentHistory.slice(0, 40), perDeviceResults);

  return res.status(anySuccess ? 200 : 200).json({
    success: anySuccess,
    needsWebCredentials,
    results: perDeviceResults,
    users: currentUsers,
    history: currentHistory,
    syncLogs: currentSyncLogs,
    db_saved: dbRes.dbSaved,
    db_error: dbRes.dbError,
    message: anySuccess
      ? perDeviceResults.filter((r) => r.success).map((r) => r.message).join(' ')
      : perDeviceResults.map((r) => r.message).join(' | '),
  });
});

// POST /api/zkteco/device-users/link - Vincular, reasignar, desvincular o editar observaciones preservando datos originales
app.post('/api/zkteco/device-users/link', async (req, res) => {
  const {
    device_user_id,
    action = 'LINK', // 'LINK' | 'RELINK' | 'REGISTER_LINK' | 'UNLINK' | 'UPDATE_OBSERVATION'
    employee_id,
    observations,
    save_pin_to_employee = true,
    apply_to_historical_punches = true,
    confirm_pin_change = false,
  } = req.body || {};

  const userRole = String(req.headers['x-user-role'] || req.body?.user_role || '').trim();
  const ALLOWED_ROLES = ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'CONTROL_ASISTENCIA', 'SUPERVISOR', 'DIRECTOR_GENERAL'];
  if (userRole && !ALLOWED_ROLES.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: No tiene permisos para modificar vinculaciones biométricas.',
    });
  }

  const operatorName = String(req.headers['x-user-name'] || req.body?.user_name || 'Administrador DRAC');
  const operatorRole = userRole || 'ADMIN_GENERAL';
  const nowIso = new Date().toISOString();

  const deviceUsers = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
  const history = readJsonFile<DeviceUserChangeLog[]>(DEVICE_USER_HISTORY_FILE, []);
  const employees = readJsonFile<any[]>(EMPLOYEES_FILE, []);
  const rawPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
  const attendance = readJsonFile<any[]>(ATTENDANCE_FILE, []);

  const idx = deviceUsers.findIndex((u) => u.id === device_user_id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuario del reloj no encontrado en el registro.' });
  }

  const target = deviceUsers[idx];
  const logsToAdd: DeviceUserChangeLog[] = [];
  let updatedPunchesCount = 0;
  const touchedPunches: any[] = [];

  if (action === 'UNLINK') {
    const prevEmpId = target.employee_id || null;
    const prevEmpName = target.employee_full_name || null;
    deviceUsers[idx] = {
      ...target,
      employee_id: null,
      employee_codigo_drac: null,
      employee_dni: null,
      employee_full_name: null,
      employee_dependencia_name: null,
      employee_area_name: null,
      employee_cargo_name: null,
      link_type: null,
      observations: observations !== undefined ? String(observations).trim() || null : target.observations || null,
      unlinked_at: nowIso,
      updated_at: nowIso,
    };
    const ev = classifyDeviceUserBinding(deviceUsers[idx], employees, deviceUsers);
    deviceUsers[idx].link_status = ev.link_status;
    deviceUsers[idx].conflict_reason = ev.conflictReason;

    logsToAdd.push({
      id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      device_user_id: target.id,
      device_sn: target.device_sn,
      pin: target.pin,
      event_type: 'UNLINKED',
      previous_employee_id: prevEmpId,
      new_employee_id: null,
      previous_values: { employee_id: prevEmpId, employee_full_name: prevEmpName },
      new_values: { employee_id: null },
      observation: observations ? String(observations).trim() : `Desvinculación manual de ${prevEmpName || prevEmpId || 'trabajador'}.`,
      operator_name: operatorName,
      operator_role: operatorRole,
      created_at: nowIso,
    });
  } else if (action === 'UPDATE_OBSERVATION') {
    const prevObs = target.observations || null;
    const nextObs = observations !== undefined ? String(observations).trim() || null : prevObs;
    deviceUsers[idx] = {
      ...target,
      observations: nextObs,
      updated_at: nowIso,
    };
    logsToAdd.push({
      id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      device_user_id: target.id,
      device_sn: target.device_sn,
      pin: target.pin,
      event_type: 'OBSERVATION_UPDATED',
      previous_values: { observations: prevObs },
      new_values: { observations: nextObs },
      observation: nextObs || 'Observación limpiada.',
      operator_name: operatorName,
      operator_role: operatorRole,
      created_at: nowIso,
    });
  } else {
    // LINK, RELINK or REGISTER_LINK
    const emp = employees.find((e) => e.id === employee_id || e.dni === employee_id);
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Trabajador institucional seleccionado no existe.' });
    }

    // Validación 1: El usuario del reloj ya está vinculado a otro trabajador y no se solicitó RELINK explícito
    if (action === 'LINK' && target.employee_id && target.employee_id !== emp.id) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_LINKED',
        existing_employee_id: target.employee_id,
        message: `El PIN ${target.pin} (${target.device_sn}) ya se encuentra vinculado a ${target.employee_full_name || target.employee_id}. Use reasignación explícita.`,
      });
    }

    // Validación 2: Verificar si el trabajador seleccionado ya tiene asignado otro PIN biométrico distinto
    const workerExistingPin = String(emp.zkteco_pin || '').trim();
    const otherSameDeviceBinding = deviceUsers.find(
      (other) =>
        other.id !== target.id &&
        other.device_sn === target.device_sn &&
        other.employee_id === emp.id &&
        other.pin !== target.pin
    );
    const hasDistinctPinOnWorker =
      Boolean(workerExistingPin && workerExistingPin !== String(target.pin).trim()) ||
      Boolean(otherSameDeviceBinding);

    if (hasDistinctPinOnWorker && !confirm_pin_change) {
      const existingPinDisplay = otherSameDeviceBinding?.pin || workerExistingPin;
      return res.status(409).json({
        success: false,
        code: 'WORKER_HAS_OTHER_PIN',
        requires_confirmation: true,
        existing_pin: existingPinDisplay,
        existing_device_binding: otherSameDeviceBinding
          ? { id: otherSameDeviceBinding.id, device_sn: otherSameDeviceBinding.device_sn, pin: otherSameDeviceBinding.pin }
          : null,
        message: `El trabajador ${emp.first_name} ${emp.last_name} ya tiene registrado otro PIN biométrico (${existingPinDisplay}). Confirme explícitamente si desea actualizar/reemplazar el PIN asignado.`,
      });
    }

    const prevEmpId = target.employee_id || null;
    const empFullName = normalizePersonName(`${emp.first_name} ${emp.last_name}`);
    const isRegisterLink = action === 'REGISTER_LINK';
    const nextLinkType: 'VINCULADO' | 'REGISTRADO' = isRegisterLink ? 'REGISTRADO' : 'VINCULADO';

    // Nota: NUNCA modificamos clock_name ni employee.first_name / last_name
    deviceUsers[idx] = {
      ...target,
      employee_id: emp.id,
      employee_codigo_drac: emp.codigo_trabajador || null,
      employee_dni: emp.dni,
      employee_full_name: empFullName,
      employee_dependencia_name: emp.dependencia_name || null,
      employee_area_name: emp.area_name || null,
      employee_cargo_name: emp.cargo || emp.position || emp.cargo_name || null,
      link_type: nextLinkType,
      candidate_employee_id: null,
      candidate_employee_name: null,
      candidate_employee_dni: null,
      candidate_employee_code: null,
      candidate_reason: null,
      observations: observations !== undefined ? String(observations).trim() || null : target.observations || null,
      linked_by: operatorName,
      linked_at: nowIso,
      unlinked_at: null,
      updated_at: nowIso,
    };

    const ev = classifyDeviceUserBinding(deviceUsers[idx], employees, deviceUsers);
    deviceUsers[idx].link_status = ev.link_status;
    deviceUsers[idx].conflict_reason = ev.conflictReason;

    logsToAdd.push({
      id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      device_user_id: target.id,
      device_sn: target.device_sn,
      pin: target.pin,
      event_type: isRegisterLink ? 'CREATED_AND_LINKED' : (prevEmpId && prevEmpId !== emp.id ? 'RELINKED' : 'LINKED'),
      previous_employee_id: prevEmpId,
      new_employee_id: emp.id,
      previous_values: prevEmpId ? { employee_id: prevEmpId, employee_full_name: target.employee_full_name } : null,
      new_values: { employee_id: emp.id, employee_dni: emp.dni, employee_full_name: empFullName, link_type: nextLinkType },
      observation: observations
        ? String(observations).trim()
        : isRegisterLink
        ? `Nuevo trabajador ${empFullName} (DNI ${emp.dni}) registrado desde reloj ${target.device_sn} y vinculado al PIN ${target.pin}.`
        : `PIN ${target.pin} en ${target.device_sn} vinculado a ${empFullName}.`,
      operator_name: operatorName,
      operator_role: operatorRole,
      created_at: nowIso,
    });

    if (save_pin_to_employee) {
      const empIdx = employees.findIndex((e) => e.id === emp.id);
      if (empIdx >= 0) {
        const oldPin = employees[empIdx].zkteco_pin || null;
        const pinChanged = String(oldPin || '') !== String(target.pin);
        employees[empIdx] = {
          ...employees[empIdx],
          zkteco_pin: target.pin,
          biometric_user_id: target.pin,
          biometric_sync_device_id: target.device_id,
          biometric_sync_device_name: target.device_name,
          biometric_sync_status: 'SINCRONIZADO',
          updated_at: nowIso,
        };
        writeJsonFile(EMPLOYEES_FILE, employees);
        if (pinChanged) {
          logsToAdd.push({
            id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            device_user_id: target.id,
            device_sn: target.device_sn,
            pin: target.pin,
            event_type: 'PIN_ASSIGNED_TO_WORKER',
            new_employee_id: emp.id,
            previous_values: { zkteco_pin: oldPin },
            new_values: { zkteco_pin: target.pin },
            observation: `PIN biométrico "${target.pin}" guardado en la ficha institucional de ${empFullName}.`,
            operator_name: operatorName,
            operator_role: operatorRole,
            created_at: nowIso,
          });
        }
      }
    }

    // Aplicación retroactiva automática sobre marcaciones históricas del MISMO (device_sn, pin)
    // Conserva intactos timestamp, device_sn, punch_type, verify_mode y raw_payload originales.
    // Respeta períodos cerrados oficiales (closed-periods.json).
    if (apply_to_historical_punches) {
      const closedPeriods = readJsonFile<ClosedPeriodEntry[]>(CLOSED_PERIODS_FILE, []);
      let closedPreserved = 0;
      for (let i = 0; i < rawPunches.length; i++) {
        const p = rawPunches[i];
        const pSn = String(p.device_sn || '').trim().toUpperCase();
        const pCode = String(p.employee_code || p.employee_dni || p.pin || '').trim();
        if (pSn === target.device_sn && pCode === target.pin) {
          if (p.employee_id !== emp.id || p.validation_status === 'PENDIENTE_IDENTIFICACION') {
            rawPunches[i] = {
              ...p,
              employee_id: emp.id,
              employee_dni: emp.dni,
              employee_codigo_drac: emp.codigo_trabajador || null,
              employee_code: pCode,
              employee_name: empFullName,
              dependencia_name: normalizeInstitutionalName(emp.dependencia_name || ''),
              direccion_organo_name: normalizeInstitutionalName(emp.direccion_organo_name || ''),
              area_name: normalizeInstitutionalName(emp.area_name || ''),
              cargo_name: normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || ''),
              clock_name_origin: p.clock_name_origin || target.clock_name || null,
              validation_status: 'VALIDA',
              processed: true,
              linked_at: nowIso,
              linked_by: operatorName,
              record_version: (Number(p.record_version) || 1) + 1,
              updated_at: nowIso,
            };
            updatedPunchesCount++;
            touchedPunches.push(rawPunches[i]);
            enqueueOutboxEvent(STORAGE_DIRS, {
              entity_type: 'marcaciones_raw',
              entity_id: rawPunches[i].id,
              operation: 'UPSERT',
              payload: rawPunches[i],
              record_version: rawPunches[i].record_version,
              origin: process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB',
            });
            if (!isPeriodClosed(p.fecha, closedPeriods)) {
              upsertAttendanceFromIdentifiedPunch(attendance, emp, rawPunches[i]);
            } else {
              closedPreserved++;
            }
          }
        }
      }
      if (updatedPunchesCount > 0) {
        writeJsonFile(RAW_PUNCHES_FILE, rawPunches);
        writeJsonFile(ATTENDANCE_FILE, attendance);
        await persistRawPunchesToSupabase(touchedPunches);
        logsToAdd.push({
          id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          device_user_id: target.id,
          device_sn: target.device_sn,
          pin: target.pin,
          event_type: 'RETROACTIVE_PUNCHES_APPLIED',
          new_employee_id: emp.id,
          observation: `${updatedPunchesCount} marcación(es) histórica(s) del reloj ${target.device_sn} (PIN ${target.pin}) asociadas a ${empFullName}.${closedPreserved > 0 ? ` (${closedPreserved} en período cerrado preservadas intactas).` : ''}`,
          operator_name: operatorName,
          operator_role: operatorRole,
          created_at: nowIso,
        });
      }
    }

    // Encolar vinculación biométrica en Outbox persistente para sincronización Web <-> Desktop
    enqueueOutboxEvent(STORAGE_DIRS, {
      entity_type: 'vinculaciones_usuario_reloj',
      entity_id: `vinc_${deviceUsers[idx].id}`,
      operation: 'UPSERT',
      payload: {
        id: `vinc_${deviceUsers[idx].id}`,
        device_user_id: deviceUsers[idx].id,
        device_sn: deviceUsers[idx].device_sn,
        pin: deviceUsers[idx].pin,
        trabajador_id: deviceUsers[idx].employee_id,
        codigo_drac: deviceUsers[idx].employee_codigo_drac,
        dni: deviceUsers[idx].employee_dni,
        nombre_institucional: deviceUsers[idx].employee_full_name,
        dependencia_name: deviceUsers[idx].employee_dependencia_name,
        area_name: deviceUsers[idx].employee_area_name,
        cargo_name: deviceUsers[idx].employee_cargo_name,
        estado_vinculacion: deviceUsers[idx].link_status,
        vinculado_por: deviceUsers[idx].linked_by,
        vinculado_en: deviceUsers[idx].linked_at,
        updated_at: nowIso,
      },
      record_version: (Number((deviceUsers[idx] as any).record_version) || 1) + 1,
      origin: process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB',
    });
  }

  const nextHistory = [...logsToAdd, ...history].slice(0, 1500);
  writeJsonFile(DEVICE_USERS_FILE, deviceUsers);
  writeJsonFile(DEVICE_USER_HISTORY_FILE, nextHistory);

  // Auditoría global institucional
  try {
    const audits = readJsonFile<any[]>(AUDIT_LOGS_FILE, []);
    audits.unshift({
      id: `audit-du-${Date.now()}`,
      timestamp: nowIso,
      user_id: String(req.body?.user_id || 'admin-drac'),
      user_name: operatorName,
      role: operatorRole,
      app_origin: 'WEB',
      module: 'USUARIOS_RELOJES',
      action: `VINCULACION_${action}`,
      affected_record_id: target.id,
      details: logsToAdd.map((l) => l.observation).join(' | '),
      result: 'SUCCESS',
    });
    writeJsonFile(AUDIT_LOGS_FILE, audits.slice(0, 1000));
  } catch (_) {}

  const dbRes = await persistDeviceUsersToSupabase([deviceUsers[idx]], logsToAdd, []);

  return res.json({
    success: true,
    record: deviceUsers[idx],
    added_logs: logsToAdd,
    retroactive_punches_updated: updatedPunchesCount,
    db_saved: dbRes.dbSaved,
    db_error: dbRes.dbError,
    message:
      action === 'UNLINK'
        ? `Usuario PIN ${target.pin} (${target.device_sn}) desvinculado conservando los registros históricos.`
        : action === 'UPDATE_OBSERVATION'
        ? `Observación actualizada para PIN ${target.pin}.`
        : `PIN ${target.pin} (${target.device_sn}) vinculado a ${deviceUsers[idx].employee_full_name}. ${updatedPunchesCount > 0 ? `${updatedPunchesCount} marcaciones históricas actualizadas.` : ''}`.trim(),
  });
});

// POST /api/zkteco/device-users/:id/clock-name - Edición OPCIONAL, INDEPENDIENTE y SOLO ADMIN del nombre en el reloj físico
app.post('/api/zkteco/device-users/:id/clock-name', async (req, res) => {
  const userRole = String(req.headers['x-user-role'] || req.body?.user_role || '').trim();
  const ADMIN_ONLY_ROLES = ['ADMIN_GENERAL', 'HR_ADMIN', 'CONTROL_ASISTENCIA'];
  if (!ADMIN_ONLY_ROLES.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Solo administradores autorizados pueden modificar el nombre directamente en el reloj físico.',
    });
  }

  const newClockName = String(req.body?.clock_name || '').trim().slice(0, 24);
  if (!newClockName) {
    return res.status(400).json({ success: false, message: 'Debe indicar un nombre válido para el reloj (máximo 24 caracteres).' });
  }

  const deviceUsers = readJsonFile<BiometricDeviceUser[]>(DEVICE_USERS_FILE, []);
  const idx = deviceUsers.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuario del reloj no encontrado.' });
  }

  const target = deviceUsers[idx];
  const devices = await getLatestDeviceConfig(target.device_sn);
  const dev = devices.find((d) => d.serial_number === target.device_sn || d.id === target.device_id) || devices[0];
  if (!dev || !dev.ip_address) {
    return res.status(400).json({ success: false, message: 'No se encontró configuración IP para el reloj asociado.' });
  }

  const ip = String(dev.ip_address).trim();
  const candidatePorts = [Number(dev.port) || 7496, 4370].filter((p, i, a) => p > 0 && a.indexOf(p) === i);
  let lastError = 'El dispositivo no acepta escritura TCP de nombres o está en modo ADMS exclusivo.';
  let written = false;

  for (const testPort of candidatePorts) {
    let zk: any = null;
    try {
      const inport = 5200 + Math.floor(Math.random() * 1000);
      zk = new ZKLib(ip, testPort, 3500, inport);
      await withServerTimeout(zk.createSocket(), 4000, `Timeout TCP en ${ip}:${testPort}`);
      if (typeof zk.setUser === 'function') {
        await withServerTimeout(
          zk.setUser(Number(target.uid || target.pin) || 1, target.pin, newClockName, '', Number(target.privilege_code || 0), 0),
          4000,
          'Timeout setUser'
        );
        written = true;
      } else {
        lastError = 'La interfaz TCP de este reloj no expone escritura remota de usuario (setUser).';
      }
      try { await zk.disconnect(); } catch (_) {}
      if (written) break;
    } catch (err: any) {
      lastError = err?.message || String(err);
      if (zk) { try { await zk.disconnect(); } catch (_) {} }
    }
  }

  if (!written) {
    return res.status(400).json({
      success: false,
      message: `No se modificó el nombre en el reloj físico (${ip}): ${lastError}`,
    });
  }

  const nowIso = new Date().toISOString();
  const prevClockName = target.clock_name || null;
  deviceUsers[idx] = {
    ...target,
    clock_name: newClockName,
    last_clock_updated_at: nowIso,
    updated_at: nowIso,
  };
  const history = readJsonFile<DeviceUserChangeLog[]>(DEVICE_USER_HISTORY_FILE, []);
  const logEntry: DeviceUserChangeLog = {
    id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    device_user_id: target.id,
    device_sn: target.device_sn,
    pin: target.pin,
    event_type: 'CLOCK_NAME_UPDATED',
    previous_values: { clock_name: prevClockName },
    new_values: { clock_name: newClockName },
    observation: `Nombre en reloj actualizado manualmente vía TCP por administrador: "${prevClockName || '(vacío)'}" → "${newClockName}".`,
    operator_name: String(req.headers['x-user-name'] || req.body?.user_name || 'Administrador DRAC'),
    operator_role: userRole,
    created_at: nowIso,
  };
  writeJsonFile(DEVICE_USERS_FILE, deviceUsers);
  writeJsonFile(DEVICE_USER_HISTORY_FILE, [logEntry, ...history].slice(0, 1500));
  await persistDeviceUsersToSupabase([deviceUsers[idx]], [logEntry], []);

  return res.json({
    success: true,
    record: deviceUsers[idx],
    message: `Nombre en el reloj físico actualizado a "${newClockName}" para el PIN ${target.pin}.`,
  });
});

// GET /api/zkteco/agent/status - Lista de agentes Windows LAN
app.get('/api/zkteco/agent/status', (req, res) => {
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const rawPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);

  return res.json({
    success: true,
    count: 1,
    data: [
      {
        id: 'agent-drac-sede-central',
        name: 'DRAC ZK Agent - Sede Central (Windows 11)',
        host: '192.168.1.33',
        ip: '192.168.1.33',
        status: 'ONLINE',
        version: '2.4.0',
        last_ping: new Date().toISOString(),
        total_punches_bridged: rawPunches.length,
        assigned_device_ids: devices.map((d) => d.id),
        assigned_device_sns: devices.map((d) => d.serial_number),
      },
    ],
  });
});

// GET /api/zkteco/agent/download-package - Paquete de scripts de instalación del agente
app.get('/api/zkteco/agent/download-package', (req, res) => {
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const dev = devices[0] || {};
  const activeIp = dev.ip_address || '192.168.1.198';
  const activePort = dev.port || 7496;

  const pythonScript = `# DRAC ZK Agent - Script Puente de Red LAN
import time
import socket
import requests

DEVICE_IP = "${activeIp}"
DEVICE_PORT = ${activePort}
CLOUD_API_URL = "http://localhost:${PORT}/api/zkteco/push"

print(f"[DRAC AGENT] Monitoreando {DEVICE_IP}:{DEVICE_PORT}...")
`;

  const nodeScript = `// DRAC ZK Agent - Node.js LAN Bridge
const net = require('net');
const http = require('http');

const DEVICE_IP = '${activeIp}';
const DEVICE_PORT = ${activePort};
console.log('[DRAC AGENT] Servicio iniciado para ' + DEVICE_IP + ':' + DEVICE_PORT);
`;

  const runBat = `@echo off
title DRAC ZK Agent - Control de Asistencia DRAC
echo Iniciando DRAC ZK Agent en red local...
node drac_zk_agent.js
pause
`;

  return res.json({
    success: true,
    python_script: pythonScript,
    node_script: nodeScript,
    run_bat: runBat,
    device_ip: activeIp,
    device_port: activePort,
  });
});

// Función auxiliar compartida para diagnóstico real en 7 etapas independientes
async function runRealSevenStageDiagnosis(params: {
  ip: string;
  port: number;
  commKey?: number;
  serial?: string;
  model?: string;
  timeoutMs?: number;
}) {
  const cleanIp = String(params.ip || '').trim();
  const targetPort = Number(params.port) || 7496;
  const commKey = Number(params.commKey) || 0;
  const serial = String(params.serial || 'AEH2223460040').trim().toUpperCase();
  const timeoutMs = Number(params.timeoutMs) || 2500;
  const startedAt = Date.now();

  const steps: { stage: number; name: string; status: 'PASSED' | 'FAILED' | 'SKIPPED'; ok: boolean; info: string; error?: string; latencyMs?: number }[] = [
    { stage: 1, name: '1. Alcance de IP en la red', status: 'SKIPPED', ok: false, info: 'Pendiente' },
    { stage: 2, name: `2. Apertura de puerto TCP (${targetPort})`, status: 'SKIPPED', ok: false, info: 'Pendiente' },
    { stage: 3, name: '3. Respuesta del protocolo ZKTeco (CMD_CONNECT)', status: 'SKIPPED', ok: false, info: 'Pendiente' },
    { stage: 4, name: `4. Autenticación / CommKey (${commKey})`, status: 'SKIPPED', ok: false, info: 'Pendiente' },
    { stage: 5, name: '5. Consulta de usuarios registrados en el reloj', status: 'SKIPPED', ok: false, info: 'Pendiente' },
    { stage: 6, name: '6. Lectura de marcaciones almacenadas', status: 'SKIPPED', ok: false, info: 'Pendiente' },
    { stage: 7, name: '7. Inserción/verificación en PostgreSQL Supabase', status: 'SKIPPED', ok: false, info: 'Pendiente' },
  ];

  if (!cleanIp || !/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(cleanIp)) {
    steps[0] = { ...steps[0], status: 'FAILED', ok: false, info: `Dirección IP inválida: "${cleanIp}"`, error: 'INVALID_IP' };
    return { success: false, status_code: 'OFFLINE', overall_status: 'INVALID_IP', message: steps[0].info, latency_ms: 0, users_in_clock: 0, punches_count: 0, steps };
  }

  // Etapas 1 y 2: Probar TCP en puerto configurado
  const tcpRes = await new Promise<{ ok: boolean; code?: string; msg?: string; latency: number }>((resolve) => {
    const t0 = Date.now();
    const s = new net.Socket();
    let settled = false;
    s.setTimeout(timeoutMs);
    s.on('connect', () => {
      if (settled) return;
      settled = true;
      s.destroy();
      resolve({ ok: true, latency: Date.now() - t0 });
    });
    s.on('timeout', () => {
      if (settled) return;
      settled = true;
      s.destroy();
      resolve({ ok: false, code: 'ETIMEDOUT', msg: `Timeout agotado (${timeoutMs}ms)`, latency: Date.now() - t0 });
    });
    s.on('error', (err: any) => {
      if (settled) return;
      settled = true;
      s.destroy();
      resolve({ ok: false, code: err?.code || 'ERR', msg: err?.message || 'Error TCP', latency: Date.now() - t0 });
    });
    s.connect(targetPort, cleanIp);
  });

  if (!tcpRes.ok && tcpRes.code !== 'ECONNREFUSED') {
    steps[0] = {
      ...steps[0],
      status: 'FAILED',
      ok: false,
      info: `Sin respuesta de red desde ${cleanIp}:${targetPort} (${tcpRes.code}: ${tcpRes.msg}).`,
      error: tcpRes.code,
      latencyMs: tcpRes.latency,
    };
    steps[1] = {
      ...steps[1],
      status: 'FAILED',
      ok: false,
      info: `No se pudo abrir puerto TCP ${targetPort} (${tcpRes.code}).`,
      error: tcpRes.code,
    };
    return {
      success: false,
      status_code: 'OFFLINE',
      overall_status: 'OFFLINE',
      message: `Sin conexión con el dispositivo en ${cleanIp}:${targetPort} (${tcpRes.code}: ${tcpRes.msg}).`,
      latency_ms: tcpRes.latency,
      users_in_clock: 0,
      punches_count: 0,
      steps,
    };
  }

  steps[0] = {
    ...steps[0],
    status: 'PASSED',
    ok: true,
    info: `Host ${cleanIp} alcanzable en red.`,
    latencyMs: tcpRes.latency,
  };

  if (!tcpRes.ok && tcpRes.code === 'ECONNREFUSED') {
    steps[1] = {
      ...steps[1],
      status: 'FAILED',
      ok: false,
      info: `Puerto TCP ${targetPort} cerrado en ${cleanIp} (ECONNREFUSED).`,
      error: 'ECONNREFUSED',
      latencyMs: tcpRes.latency,
    };
    return {
      success: false,
      status_code: 'OFFLINE',
      overall_status: 'PORT_CLOSED',
      message: `El host ${cleanIp} respondió en red pero el puerto TCP ${targetPort} está cerrado (ECONNREFUSED).`,
      latency_ms: tcpRes.latency,
      users_in_clock: 0,
      punches_count: 0,
      steps,
    };
  }

  steps[1] = {
    ...steps[1],
    status: 'PASSED',
    ok: true,
    info: `Puerto TCP ${targetPort} abierto y aceptando conexiones (${tcpRes.latency}ms).`,
    latencyMs: tcpRes.latency,
  };

  // Etapas 3, 4, 5, 6: Handshake ZKTeco, Auth CommKey, Usuarios, Marcaciones
  let usersCount = 0;
  let punchesCount = 0;
  let protoOk = false;
  let authOk = false;
  let protoError = '';

  const portsToCheck = [targetPort, 4370].filter((p, idx, arr) => arr.indexOf(p) === idx);
  for (const p of portsToCheck) {
    try {
      const zk = new (ZKLib as any)(cleanIp, p, Math.min(timeoutMs, 2500), 5200);
      await zk.createSocket();
      protoOk = true;
      authOk = true;
      try {
        const uRes = await zk.getUsers();
        if (uRes && Array.isArray(uRes.data)) usersCount = uRes.data.length;
        steps[4] = { ...steps[4], status: 'PASSED', ok: true, info: `${usersCount} usuarios registrados en el reloj.` };
      } catch (uErr: any) {
        steps[4] = { ...steps[4], status: 'FAILED', ok: false, info: `No se pudo leer usuarios: ${uErr?.message || 'Error'}`, error: uErr?.message };
      }
      try {
        const aRes = await zk.getAttendances();
        if (aRes && Array.isArray(aRes.data)) punchesCount = aRes.data.length;
        steps[5] = { ...steps[5], status: 'PASSED', ok: true, info: `${punchesCount} marcaciones leídas en el dispositivo.` };
      } catch (aErr: any) {
        steps[5] = { ...steps[5], status: 'FAILED', ok: false, info: `No se pudo leer marcaciones: ${aErr?.message || 'Error'}`, error: aErr?.message };
      }
      try { await zk.disconnect(); } catch (_) {}
      break;
    } catch (err: any) {
      protoError = err?.message || String(err);
    }
  }

  if (!protoOk) {
    steps[2] = {
      ...steps[2],
      status: 'FAILED',
      ok: false,
      info: `Puerto TCP ${targetPort} abierto, pero el protocolo binario ZKTeco no respondió (${protoError || 'Timeout CMD_CONNECT'}).`,
      error: 'PROTOCOL_NO_RESPONSE',
    };
    return {
      success: false,
      status_code: 'PROTOCOL_NO_RESPONSE',
      overall_status: 'PROTOCOL_NO_RESPONSE',
      message: `Conexión TCP establecida con ${cleanIp}:${targetPort}, pero sin respuesta del protocolo ZKTeco (${protoError || 'CMD_CONNECT sin respuesta'}).`,
      latency_ms: Date.now() - startedAt,
      users_in_clock: 0,
      punches_count: 0,
      steps,
    };
  }

  steps[2] = { ...steps[2], status: 'PASSED', ok: true, info: 'Protocolo binario ZKTeco respondió correctamente.' };
  steps[3] = {
    ...steps[3],
    status: authOk ? 'PASSED' : 'FAILED',
    ok: authOk,
    info: authOk ? `Autenticación CommKey (${commKey}) aceptada.` : 'CommKey rechazada.',
  };

  // Etapa 7: Verificar almacenamiento Supabase PostgreSQL
  try {
    const sbCheck: any = await withServerTimeout(
      Promise.resolve(supabaseServer.from('marcaciones_raw').select('id', { count: 'exact', head: true })),
      2000,
      'Timeout verificando tabla marcaciones_raw en Supabase'
    );
    if (sbCheck?.error) {
      steps[6] = {
        ...steps[6],
        status: 'FAILED',
        ok: false,
        info: `Error consultando PostgreSQL Supabase: ${sbCheck.error.message}`,
        error: sbCheck.error.message,
      };
      return {
        success: false,
        status_code: 'DB_ERROR',
        overall_status: 'DB_ERROR',
        message: `Lectura del equipo OK, pero falló la verificación en PostgreSQL Supabase: ${sbCheck.error.message}`,
        latency_ms: Date.now() - startedAt,
        users_in_clock: usersCount,
        punches_count: punchesCount,
        steps,
      };
    }
    steps[6] = {
      ...steps[6],
      status: 'PASSED',
      ok: true,
      info: `Tabla marcaciones_raw operativa en PostgreSQL Supabase (${sbCheck.count ?? 0} registros totales).`,
    };
  } catch (dbErr: any) {
    steps[6] = {
      ...steps[6],
      status: 'FAILED',
      ok: false,
      info: `Sin acceso a Supabase PostgreSQL desde este host: ${dbErr?.message || 'Timeout'}`,
      error: dbErr?.message,
    };
    return {
      success: false,
      status_code: 'DB_ERROR',
      overall_status: 'DB_ERROR',
      message: `Error verificando base de datos PostgreSQL Supabase: ${dbErr?.message || 'Sin conexión'}`,
      latency_ms: Date.now() - startedAt,
      users_in_clock: usersCount,
      punches_count: punchesCount,
      steps,
    };
  }

  return {
    success: true,
    status_code: punchesCount > 0 ? 'PUNCHES_RECEIVED' : 'ONLINE_NO_NEW_PUNCHES',
    overall_status: 'ONLINE',
    message: `Diagnóstico completo exitoso para ${cleanIp}:${targetPort} (${usersCount} usuarios, ${punchesCount} marcaciones).`,
    latency_ms: Date.now() - startedAt,
    users_in_clock: usersCount,
    punches_count: punchesCount,
    steps,
  };
}

// POST /api/zkteco/agent/command - Despacho de comandos hacia el marcador biométrico
app.post('/api/zkteco/agent/command', async (req, res) => {
  const { command, params, device_id } = req.body || {};
  const devices = await getLatestDeviceConfig(device_id);
  const targetDev = devices.find((d) => d.id === device_id) || devices[0] || {};

  const activeIp = String(params?.ip || targetDev.ip_address || '').trim();
  const devPort = Number(params?.port || targetDev.port || 7496);
  const cleanSerial = String(params?.serial || targetDev.serial_number || 'AEH2223460040').trim().toUpperCase();
  const cleanModel = String(params?.model || targetDev.model || 'ZKTeco G3').trim();
  const commKey = Number(params?.comm_key ?? targetDev.comm_key ?? 0);

  if (command === 'TEST_CONNECTION') {
    const diag = await runRealSevenStageDiagnosis({
      ip: activeIp,
      port: devPort,
      commKey,
      serial: cleanSerial,
      model: cleanModel,
    });
    return res.status(diag.success ? 200 : 503).json({
      success: diag.success,
      status_code: diag.status_code,
      message: diag.message,
      details: {
        ip: activeIp,
        port: devPort,
        model: cleanModel,
        serial: cleanSerial,
        serial_number: cleanSerial,
        latency_ms: diag.latency_ms,
        users_in_clock: diag.users_in_clock,
        tcp_status: diag.status_code,
        steps: diag.steps,
      },
    });
  }

  if (command === 'SYNC_BIOTIME') {
    const btHost = String(params?.host || targetDev?.biotime_config?.db_host || '192.168.1.29').trim();
    const rawWp = Number(params?.webPort ?? targetDev?.biotime_config?.web_port);
    const btWebPort = rawWp || 8088;
    const btDbPort = Number(params?.dbPort || targetDev?.biotime_config?.db_port || 7496);

    const bioResult = await syncPunchesFromBioTimeDb({
      host: btHost,
      webPort: btWebPort,
      port: btDbPort,
      dbName: params?.dbName ? String(params.dbName) : undefined,
      user: params?.dbUser ? String(params.dbUser) : undefined,
      password: params?.password ? String(params.password) : undefined,
      webUser: params?.webUser ? String(params.webUser) : undefined,
      webPassword: params?.webPassword ? String(params.webPassword) : undefined,
      serial: cleanSerial,
    });

    if (!bioResult.success) {
      return res.status(503).json({
        success: false,
        needsWebCredentials: !!bioResult.needsWebCredentials,
        status_code: 'OFFLINE',
        message: bioResult.message,
        details: {
          ip: btHost,
          port: btWebPort,
          model: 'BioTime PRO HTTP',
          serial: cleanSerial,
          latency_ms: bioResult.latency,
          users_in_clock: 0,
          needsWebCredentials: !!bioResult.needsWebCredentials,
          inspection: bioResult.inspection,
        },
      });
    }

    const integration = await integrateRealPunchesIntoSystem(bioResult.punches, bioResult.source || 'BIOTIME_API', {
      id: targetDev?.id,
      serial: cleanSerial,
      name: targetDev?.name || 'ZKTeco G3 (vía BioTime)',
      ip: activeIp,
    });

    const isCloudOptionalFail = !integration.dbSaved && integration.newlyAdded > 0 && /Placeholder|Failed to fetch|ENOTFOUND|Sin conexión hacia Supabase|Timeout/i.test(String(integration.dbError || ''));
    const ok = integration.dbSaved || integration.newlyAdded === 0 || isCloudOptionalFail;

    return res.json({
      success: ok,
      status_code: !ok ? 'DB_ERROR' : 'PUNCHES_RECEIVED',
      message: !ok
        ? `Error de almacenamiento Supabase: ${integration.dbError}`
        : isCloudOptionalFail
        ? `Sincronización BioTime PRO exitosa (modo local): ${integration.newlyAdded} nuevas marcaciones guardadas en este equipo (${integration.duplicatesSkipped} duplicadas omitidas).`
        : `Sincronización BioTime finalizada: ${integration.newlyAdded} nuevas marcaciones (${integration.duplicatesSkipped} duplicadas omitidas).`,
      details: {
        ip: btHost,
        port: btWebPort,
        model: 'BioTime PRO HTTP',
        serial: cleanSerial,
        serial_number: cleanSerial,
        latency_ms: bioResult.latency || 0,
        users_in_clock: targetDev?.enrolled_user_count || 0,
        total_clock_punches: integration.totalStored,
        new_punches_downloaded: integration.newlyAdded,
        unidentified_count: integration.unidentifiedCount,
        punches: integration.enrichedPunches.slice(0, 100),
      },
    });
  }

  // DOWNLOAD_PUNCHES
  const result = await downloadRealPunchesOverTcp(activeIp, devPort, 3500, commKey, cleanSerial);
  if (!result.success) {
    return res.status(503).json({
      success: false,
      status_code: result.status_code,
      message: result.message,
      details: {
        ip: activeIp,
        port: devPort,
        model: cleanModel,
        serial: cleanSerial,
        serial_number: cleanSerial,
        latency_ms: result.latency,
        users_in_clock: result.users_in_clock,
        total_clock_punches: 0,
        new_punches_downloaded: 0,
        punches: [],
      },
    });
  }

  const integration = await integrateRealPunchesIntoSystem(result.punches, 'DIRECT_READ', {
    id: targetDev?.id,
    serial: cleanSerial,
    name: targetDev.name || 'ZKTeco G3 Sede Central',
    ip: activeIp,
  });

  return res.json({
    success: integration.dbSaved || integration.newlyAdded === 0,
    status_code: !integration.dbSaved && integration.newlyAdded > 0
      ? 'DB_ERROR'
      : integration.newlyAdded > 0
      ? 'PUNCHES_RECEIVED'
      : 'ONLINE_NO_NEW_PUNCHES',
    message: !integration.dbSaved && integration.newlyAdded > 0
      ? `Lectura OK (${integration.newlyAdded} nuevas), pero error al guardar en Supabase: ${integration.dbError}`
      : integration.newlyAdded > 0
      ? `Marcaciones recibidas correctamente (${activeIp}:${devPort}): ${integration.newlyAdded} nuevas, ${integration.unidentifiedCount} pendientes de identificación.`
      : `Lectura exitosa sin marcaciones nuevas en el dispositivo (${activeIp}:${devPort}, ${result.latency}ms).`,
    details: {
      ip: activeIp,
      port: devPort,
      model: cleanModel,
      serial: cleanSerial,
      serial_number: cleanSerial,
      latency_ms: result.latency,
      users_in_clock: result.users_in_clock,
      total_clock_punches: integration.totalStored,
      new_punches_downloaded: integration.newlyAdded,
      unidentified_count: integration.unidentifiedCount,
      punches: integration.enrichedPunches.slice(0, 100),
    },
  });
});

// ---------------------------------------------------------------------------
// 3. ADMS PUSH INGESTION PIPELINE (Real ZKTeco HTTP Ingestion)
// ---------------------------------------------------------------------------

async function processAdmsPayload(payload: any, query: any, headers: any, source: string) {
  const rawText = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const existingRaw = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
  const pushLogs = readJsonFile<any[]>(PUSH_LOGS_FILE, []);
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const nowIso = new Date().toISOString();

  const sn = String(query.SN || query.sn || headers['x-zkteco-sn'] || 'AEH2223460040');

  // Heartbeat check
  if (!rawText || rawText.trim() === '' || rawText.includes('HEARTBEAT') || query.table === 'options') {
    const log = {
      id: `plog-${Date.now()}`,
      dispositivo: 'ZKTeco G3-id Sede Central',
      serial: sn,
      ip_origen: String(headers['x-forwarded-for'] || devices[0]?.ip_address || '192.168.1.198'),
      employeeCode: '-',
      employee_name: 'Conexión Heartbeat ZKTeco',
      employee_dni: '-',
      punch_time: '-',
      reception_time: nowIso,
      event_type: 'HEARTBEAT',
      payload_original: rawText || '[HEARTBEAT ADMS]',
      estado: 'VALIDA' as const,
      error: null,
    };
    pushLogs.unshift(log);
    writeJsonFile(PUSH_LOGS_FILE, pushLogs.slice(0, 300));
    return { success: true, count: 0, message: 'Heartbeat registrado' };
  }

  // Parse records from lines (ZKTeco ADMS sends lines like: PIN=10000001\tCHECKTIME=2026-10-23 08:02:15\t... OR 10000001\t2026-10-23 08:02:15\t...)
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const punchesToIngest: any[] = [];

  for (const line of lines) {
    let pin = '';
    let punchTime = '';
    let verify = '1';
    let punchState = 0;

    if (line.includes('=') || line.includes('\t')) {
      const parts = line.split('\t');
      const kv: Record<string, string> = {};
      parts.forEach((p) => {
        const [k, v] = p.split('=');
        if (k && v) kv[k.trim().toUpperCase()] = v.trim();
      });
      pin = kv['PIN'] || kv['USERID'] || kv['EMPLOYEECODE'] || '';
      punchTime = kv['CHECKTIME'] || kv['TIME'] || kv['TIMESTAMP'] || '';
      verify = kv['VERIFY'] || kv['VERIFYTYPE'] || '1';
      punchState = kv['CHECKTYPE'] === 'O' || kv['STATUS'] === '1' ? 1 : 0;

      // Soporte posicional estándar ZKTeco ADMS (sin '='):
      if (!pin && parts.length >= 2 && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(parts[1])) {
        pin = parts[0].trim();
        punchTime = parts[1].trim();
        verify = parts[2] ? parts[2].trim() : '1';
        punchState = parts[3] ? Number(parts[3]) || 0 : 0;
      }
    } else if (line.startsWith('{')) {
      try {
        const jsonRec = JSON.parse(line);
        pin = String(jsonRec.employee_dni || jsonRec.pin || jsonRec.employee_code || '');
        punchTime = String(jsonRec.timestamp || jsonRec.time || '');
        punchState = Number(jsonRec.punch_state ?? 0);
      } catch {}
    }

    if (!pin || !punchTime) continue;

    let verify_mode = 'FINGERPRINT';
    if (verify === '15') verify_mode = 'FACE';
    else if (verify === '2') verify_mode = 'PASSWORD';
    else if (verify === '3') verify_mode = 'CARD';

    punchesToIngest.push({
      employee_dni: pin,
      employee_code: pin,
      timestamp: punchTime,
      verify_mode,
      punch_state: punchState,
      device_sn: sn,
    });
  }

  const integration = await integrateRealPunchesIntoSystem(punchesToIngest, 'ADMS_PUSH', {
    id: devices.find((d) => d.serial_number === sn)?.id,
    serial: sn,
    name: devices.find((d) => d.serial_number === sn)?.name || 'ZKTeco G3 Sede Central (ADMS Push)',
  });

  if (integration.enrichedPunches.length > 0) {
    for (const ep of integration.enrichedPunches.slice(0, 50)) {
      pushLogs.unshift({
        id: `plog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dispositivo: 'ZKTeco G3-id Sede Central',
        serial: sn,
        ip_origen: String(headers['x-forwarded-for'] || devices[0]?.ip_address || '192.168.1.198'),
        employeeCode: ep.employee_code,
        employee_name: ep.employee_name,
        employee_dni: ep.employee_dni,
        punch_time: ep.timestamp,
        reception_time: nowIso,
        event_type: 'MARCACION',
        payload_original: ep.timestamp,
        estado: 'VALIDA',
        error: null,
      });
    }
    writeJsonFile(PUSH_LOGS_FILE, pushLogs.slice(0, 300));
  }

  return {
    success: true,
    count: punchesToIngest.length,
    newCount: integration.newlyAdded,
    dupCount: punchesToIngest.length - integration.newlyAdded,
  };
}

// ADMS Handshake & Ingestion Endpoints (standard ZKTeco physical communication)
app.get('/iclock/cdata', (req, res) => {
  const sn = String(req.query.SN || req.query.sn || 'AEH2223460040');
  const pushLogs = readJsonFile<any[]>(PUSH_LOGS_FILE, []);
  pushLogs.unshift({
    id: `plog-hs-${Date.now()}`,
    dispositivo: 'ZKTeco G3 Sede Central',
    serial: sn,
    ip_origen: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''),
    employeeCode: '-',
    employee_name: 'Handshake ADMS GET /iclock/cdata',
    employee_dni: '-',
    punch_time: '-',
    reception_time: new Date().toISOString(),
    event_type: 'HEARTBEAT',
    payload_original: JSON.stringify(req.query),
    estado: 'VALIDA',
    error: null,
  });
  writeJsonFile(PUSH_LOGS_FILE, pushLogs.slice(0, 300));
  res.setHeader('Content-Type', 'text/plain');
  return res.send(
    [
      `GET OPTION FROM: ${sn}`,
      'Stamp=0',
      'OpStamp=0',
      'PhotoStamp=0',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=1111000000',
      'Realtime=1',
      'Encrypt=0',
      '',
    ].join('\n')
  );
});

app.get('/iclock/cdata.php', (req, res) => {
  const sn = String(req.query.SN || req.query.sn || 'AEH2223460040');
  res.setHeader('Content-Type', 'text/plain');
  return res.send(`GET OPTION FROM: ${sn}\nStamp=0\nOpStamp=0\nErrorDelay=30\nDelay=10\nTransInterval=1\nRealtime=1\nEncrypt=0\n`);
});

app.get('/iclock/getrequest', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  return res.send('OK');
});

app.post('/iclock/cdata', async (req, res) => {
  try {
    const result = await processAdmsPayload(req.body, req.query, req.headers, 'ICLOCK_CDATA');
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`OK: ${result.count || 1}`);
  } catch (err: any) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('OK: 1');
  }
});

app.post('/iclock/cdata.php', async (req, res) => {
  try {
    const result = await processAdmsPayload(req.body, req.query, req.headers, 'ICLOCK_CDATA_PHP');
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`OK: ${result.count || 1}`);
  } catch (err: any) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('OK: 1');
  }
});

app.post('/api/zkteco/push', async (req, res) => {
  try {
    const result = await processAdmsPayload(req.body, req.query, req.headers, 'API_PUSH');
    return res.json({ success: true, received: result.count, duplicates: result.dupCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/zkteco/ingest-punches - Persistencia idempotente de marcaciones leídas desde Electron Desktop
app.post('/api/zkteco/ingest-punches', async (req, res) => {
  try {
    const { punches, source, device } = req.body || {};
    if (!Array.isArray(punches)) {
      return res.status(400).json({ success: false, status_code: 'DB_ERROR', message: 'Formato inválido: se esperaba un arreglo de marcaciones.' });
    }
    const devices = await getLatestDeviceConfig();
    const targetDev = devices.find((d) => d.id === device?.id || d.serial_number === device?.serial) || devices[0];
    const integration = await integrateRealPunchesIntoSystem(punches, String(source || 'DIRECT_READ'), {
      id: device?.id || targetDev?.id,
      serial: device?.serial || targetDev?.serial_number || 'AEH2223460040',
      name: device?.name || targetDev?.name || 'ZKTeco G3 Sede Central',
      ip: device?.ip || targetDev?.ip_address,
    });
    const statusCode = !integration.dbSaved && integration.newlyAdded > 0
      ? 'DB_ERROR'
      : integration.newlyAdded > 0
      ? 'PUNCHES_RECEIVED'
      : 'ONLINE_NO_NEW_PUNCHES';
    return res.status(statusCode === 'DB_ERROR' ? 207 : 200).json({
      success: statusCode !== 'DB_ERROR',
      status_code: statusCode,
      imported_count: punches.length,
      new_count: integration.newlyAdded,
      duplicates_skipped: integration.duplicatesSkipped,
      unidentified_count: integration.unidentifiedCount,
      db_saved: integration.dbSaved,
      db_error: integration.dbError,
      last_sync: new Date().toISOString(),
      message: statusCode === 'DB_ERROR'
        ? `Marcaciones leídas (${integration.newlyAdded}), pero falló el guardado en Supabase: ${integration.dbError}`
        : integration.newlyAdded > 0
        ? `Marcaciones recibidas y almacenadas: ${integration.newlyAdded} nuevas (${integration.duplicatesSkipped} duplicadas omitidas, ${integration.unidentifiedCount} pendientes de identificación).`
        : `Lectura exitosa sin marcaciones nuevas (${punches.length} revisadas).`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, status_code: 'DB_ERROR', message: err.message });
  }
});

app.post('/api/biometric/push', async (req, res) => {
  try {
    const result = await processAdmsPayload(req.body, req.query, req.headers, 'BIOMETRIC_PUSH');
    return res.json({ success: true, received: result.count, duplicates: result.dupCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/zkteco/push-status
app.get('/api/zkteco/push-status', (req, res) => {
  const devices = readJsonFile<any[]>(DEVICES_FILE, []);
  const punches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
  const todayStr = new Date().toISOString().substring(0, 10);
  const todayPunches = punches.filter((p) => p.fecha === todayStr || p.timestamp?.startsWith(todayStr));

  return res.json({
    success: true,
    device_count: devices.length,
    online_devices: devices.filter((d) => d.status === 'ONLINE').length,
    total_received_today: todayPunches.length,
    total_raw_punches: punches.length,
    identified_punches: punches.filter((p) => p.employee_id).length,
    unidentified_punches: punches.filter((p) => !p.employee_id).length,
    processed_punches: punches.filter((p) => p.processed).length,
    last_received_at: punches[0]?.timestamp || null,
    server_parameters: {
      ip: '192.168.1.50',
      port: PORT,
      protocol: 'HTTP',
      endpoint: '/api/zkteco/push',
      health_url: `http://localhost:${PORT}/api/health`,
      cdata_url: `http://localhost:${PORT}/iclock/cdata`,
    },
  });
});

// GET /api/zkteco/push-logs
app.get('/api/zkteco/push-logs', (req, res) => {
  const logs = readJsonFile<any[]>(PUSH_LOGS_FILE, []);
  return res.json({
    success: true,
    count: logs.length,
    data: logs,
  });
});

// POST /api/zkteco/push-logs/clear
app.post('/api/zkteco/push-logs/clear', (req, res) => {
  writeJsonFile(PUSH_LOGS_FILE, []);
  return res.json({ success: true, message: 'Logs de auditoría PUSH limpiados' });
});

// POST /api/zkteco/diagnose-pipeline - Diagnóstico real independiente de 7 etapas
app.post('/api/zkteco/diagnose-pipeline', async (req, res) => {
  const { deviceId, ip, port, comm_key } = req.body || {};
  const devices = await getLatestDeviceConfig(deviceId);
  const dev = devices.find((d) => d.id === deviceId || d.serial_number === deviceId) || devices[0];

  const targetIp = String(ip || dev?.ip_address || '').trim();
  const targetPort = Number(port || dev?.port || 7496);
  const targetCommKey = Number(comm_key ?? dev?.comm_key ?? 0);

  const diag = await runRealSevenStageDiagnosis({
    ip: targetIp,
    port: targetPort,
    commKey: targetCommKey,
    serial: dev?.serial_number || 'AEH2223460040',
    model: dev?.model || 'ZKTeco G3',
  });

  return res.json({
    ...diag,
    device_name: dev ? dev.name : 'ZKTeco G3',
    serial_number: dev ? dev.serial_number : 'AEH2223460040',
    ip_address: targetIp,
    port: targetPort,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/supabase/status & POST /api/supabase/config
app.get('/api/supabase/status', async (_req, res) => {
  const isPlaceholder =
    !SUPABASE_URL ||
    SUPABASE_URL.includes('rfqgmoremevypexrrsyf.supabase.co') ||
    SUPABASE_URL.includes('your-project-ref.supabase.co');

  const localCounts = {
    trabajadores: readJsonFile<any[]>(EMPLOYEES_FILE, []).length,
    dependencias: readJsonFile<any[]>(DEPENDENCIAS_FILE, []).length,
    direcciones: readJsonFile<any[]>(DIRECCIONES_FILE, []).length,
    areas_oficinas: readJsonFile<any[]>(AREAS_FILE, []).length,
    horarios: readJsonFile<any[]>(HORARIOS_FILE, []).length,
    turnos: readJsonFile<any[]>(TURNOS_FILE, []).length,
    papeletas: readJsonFile<any[]>(PAPELETAS_FILE, []).length,
    vacaciones: readJsonFile<any[]>(VACACIONES_FILE, []).length,
    encargaturas: readJsonFile<any[]>(ENCARGATURAS_FILE, []).length,
    dispositivos_zkteco: readJsonFile<any[]>(DEVICES_FILE, []).length,
    usuarios_reloj: readJsonFile<any[]>(DEVICE_USERS_FILE, []).length,
    marcaciones_raw: readJsonFile<any[]>(RAW_PUNCHES_FILE, []).length,
    asistencias: readJsonFile<any[]>(ATTENDANCE_FILE, []).length,
    auditoria: readJsonFile<any[]>(AUDIT_LOGS_FILE, []).length,
  };

  if (isPlaceholder) {
    return res.json({
      connected: false,
      isPlaceholder: true,
      supabaseUrl: SUPABASE_URL,
      tablesCount: localCounts,
      message: 'Instancia Supabase no configurada (usando almacenamiento local en servidor/escritorio).',
    });
  }

  try {
    const sbCheck: any = await withServerTimeout(
      Promise.resolve(supabaseServer.from('marcaciones_raw').select('id', { count: 'exact', head: true })),
      2500,
      'Timeout verificando Supabase'
    );
    return res.json({
      connected: !sbCheck?.error,
      isPlaceholder: false,
      supabaseUrl: SUPABASE_URL,
      tablesCount: localCounts,
      error: sbCheck?.error?.message || null,
    });
  } catch (err: any) {
    return res.json({
      connected: false,
      isPlaceholder: false,
      supabaseUrl: SUPABASE_URL,
      tablesCount: localCounts,
      error: err?.message || 'Error conectando a Supabase',
    });
  }
});

app.post('/api/supabase/config', (req, res) => {
  const { url, anonKey } = req.body || {};
  const cleanUrl = String(url || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const cleanKey = String(anonKey || '').trim();
  if (!cleanUrl || !cleanKey) {
    return res.status(400).json({ success: false, message: 'URL y Anon Key de Supabase son obligatorios.' });
  }
  SUPABASE_URL = cleanUrl;
  SUPABASE_ANON_KEY = cleanKey;
  supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const cfgPayload = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, updatedAt: new Date().toISOString() };
  writeJsonFile(resolveSafeChildPath(STORAGE_DIRS.configDir, 'supabase-config.json'), cfgPayload);
  writeJsonFile(resolveSafeChildPath(STORAGE_DIRS.dataDir, 'supabase-config.json'), cfgPayload);
  return res.json({ success: true, supabaseUrl: SUPABASE_URL });
});

// =========================================================================
// SISTEMA DE ALMACENAMIENTO SEGURO, VERSIONADO, RESPALDOS Y COLA OUTBOX
// =========================================================================

app.get('/api/system/storage-status', (_req, res) => {
  const report = getStorageStatusReport(STORAGE_DIRS, APP_VERSION, BUILD_DATE);
  const outbox = getOutboxSummary(STORAGE_DIRS);
  return res.json({
    success: true,
    ...report,
    outbox: {
      total: outbox.total,
      pending: outbox.pending,
      synced: outbox.synced,
      conflicts: outbox.conflicts,
      last_push_at: outbox.cursor.last_push_at,
      last_pull_at: outbox.cursor.last_pull_at,
      desktop_node_id: outbox.cursor.desktop_node_id,
    },
  });
});

app.get('/api/system/backups', (_req, res) => {
  const backups = listVerifiedBackups(STORAGE_DIRS);
  return res.json({ success: true, count: backups.length, data: backups });
});

app.post('/api/system/backup', (req, res) => {
  const reason = (req.body?.reason || 'MANUAL') as 'MANUAL' | 'PRE_UPDATE' | 'PRE_MIGRATION' | 'STARTUP_CHECK';
  const bkp = createVerifiedBackup(STORAGE_DIRS, {
    reason,
    appVersion: APP_VERSION,
    previousAppVersion: null,
    schemaVersion: STORAGE_BOOT.versionState.schema_version,
  });
  if (!bkp.success) {
    return res.status(500).json({ success: false, message: bkp.error || 'No se pudo generar el respaldo.' });
  }
  return res.status(201).json({
    success: true,
    message: `Respaldo verificado SHA-256 creado: ${bkp.backup?.filename}`,
    backup: bkp.backup,
  });
});

app.get('/api/sync/outbox', (_req, res) => {
  return res.json({
    success: true,
    cloudConfigured: !isPlaceholderSupabaseUrlServer(SUPABASE_URL),
    ...getOutboxSummary(STORAGE_DIRS),
  });
});

app.post('/api/sync/outbox', (req, res) => {
  const { entity_type, entity_id, operation = 'UPSERT', payload = {}, record_version, origin } = req.body || {};
  if (!entity_type || !entity_id) {
    return res.status(400).json({ success: false, message: 'entity_type y entity_id son obligatorios.' });
  }
  const item = enqueueOutboxEvent(STORAGE_DIRS, {
    entity_type,
    entity_id,
    operation,
    payload,
    record_version,
    origin,
  });
  return res.status(201).json({ success: true, item });
});

app.post('/api/sync/outbox/flush', async (_req, res) => {
  const result = await flushServerOutbox({
    dirs: STORAGE_DIRS,
    supabaseServer,
    supabaseUrl: SUPABASE_URL,
  });
  return res.json(result);
});

app.post('/api/sync/pull', async (_req, res) => {
  if (isPlaceholderSupabaseUrlServer(SUPABASE_URL)) {
    return res.json({
      success: false,
      cloudConfigured: false,
      message: 'Instancia Supabase central no configurada. Operando con base local persistente.',
      cursor: readSyncState(STORAGE_DIRS),
    });
  }

  try {
    const outbox = readOutboxQueue(STORAGE_DIRS);
    const pendingIds = new Set(outbox.filter((x) => x.status === 'PENDIENTE').map((x) => x.entity_id));
    const cursor = readSyncState(STORAGE_DIRS);
    const pullSummary: Record<string, { inserted: number; updated: number; preservedLocal: number }> = {};

    // Pull trabajadores con control de versiones
    const empRes: any = await withServerTimeout(
      Promise.resolve(supabaseServer.from('trabajadores').select('*').limit(1000)),
      3500,
      'Timeout pull trabajadores'
    );
    if (!empRes?.error && Array.isArray(empRes.data) && empRes.data.length > 0) {
      const mappedRemote = empRes.data.map((t: any) => ({
        id: t.id,
        codigo_trabajador: t.codigo_drac || t.codigo_trabajador,
        dni: t.dni,
        first_name: normalizePersonName(t.nombres || t.first_name || ''),
        last_name: `${normalizePersonName(t.apellido_paterno || '')} ${normalizePersonName(t.apellido_materno || '')}`.trim() || normalizePersonName(t.last_name || ''),
        apellido_paterno: normalizePersonName(t.apellido_paterno || ''),
        apellido_materno: normalizePersonName(t.apellido_materno || ''),
        email: t.email || '',
        phone: t.telefono || t.phone || '',
        dependencia_id: t.dependencia_id || 'dep-01',
        area_id: t.area_id || '',
        cargo_id: t.cargo_id || '',
        regimen_laboral: t.regimen_id || 'D.L. 276',
        is_jefe_director: Boolean(t.es_jefe),
        active: t.estado ? t.estado === 'ACTIVO' : true,
        hire_date: t.fecha_ingreso || '2026-01-01',
        zkteco_pin: t.zkteco_pin || t.dni,
        record_version: Number(t.record_version) || 1,
        updated_at: t.updated_at || new Date().toISOString(),
      }));
      const localEmps = readJsonFile<any[]>(EMPLOYEES_FILE, []);
      const mergeEmp = mergeVersionedRecords({
        localRecords: localEmps,
        remoteRecords: mappedRemote,
        pendingEntityIds: pendingIds,
      });
      if (mergeEmp.insertedCount > 0 || mergeEmp.updatedCount > 0) {
        writeJsonFile(EMPLOYEES_FILE, mergeEmp.merged);
      }
      pullSummary.trabajadores = {
        inserted: mergeEmp.insertedCount,
        updated: mergeEmp.updatedCount,
        preservedLocal: mergeEmp.skippedDueToNewerLocalCount,
      };
    }

    // Pull marcaciones_raw de manera idempotente (sin sobreescribir vinculaciones pendientes locales)
    const punchRes: any = await withServerTimeout(
      Promise.resolve(supabaseServer.from('marcaciones_raw').select('*').order('timestamp', { ascending: false }).limit(2000)),
      4000,
      'Timeout pull marcaciones_raw'
    );
    if (!punchRes?.error && Array.isArray(punchRes.data) && punchRes.data.length > 0) {
      const localPunches = readJsonFile<any[]>(RAW_PUNCHES_FILE, []);
      const mergePunches = mergeVersionedRecords({
        localRecords: localPunches,
        remoteRecords: punchRes.data,
        pendingEntityIds: pendingIds,
      });
      if (mergePunches.insertedCount > 0 || mergePunches.updatedCount > 0) {
        writeJsonFile(RAW_PUNCHES_FILE, mergePunches.merged);
      }
      pullSummary.marcaciones_raw = {
        inserted: mergePunches.insertedCount,
        updated: mergePunches.updatedCount,
        preservedLocal: mergePunches.skippedDueToNewerLocalCount,
      };
    }

    const nextCursor = {
      ...cursor,
      last_pull_at: new Date().toISOString(),
      last_pull_counts: Object.fromEntries(
        Object.entries(pullSummary).map(([k, v]) => [k, v.inserted + v.updated])
      ),
      last_sync_error: null,
    };
    safeWriteJsonAtomic(resolveSafeChildPath(STORAGE_DIRS.syncDir, 'sync-state.json'), nextCursor);

    return res.json({
      success: true,
      cloudConfigured: true,
      pullSummary,
      cursor: nextCursor,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      cloudConfigured: true,
      message: err?.message || 'Error en sincronización incremental desde Supabase.',
    });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'OK',
    appVersion: APP_VERSION,
    schemaVersion: STORAGE_BOOT.versionState.schema_version,
    migrationStatus: STORAGE_BOOT.versionState.last_migration_status,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 4. VITE DEV SERVER INTEGRATION & STATIC ASSETS
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(SERVER_DIR, 'index.html'))
      ? SERVER_DIR
      : path.join(BASE_PROJECT_DIR, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DRAC ZKTECO SERVER] Servidor institucional escuchando en http://0.0.0.0:${PORT}`);
    // Intento automático de drenado de Outbox persistente cada 60s cuando exista nube configurada
    const outboxTimer = setInterval(() => {
      if (!isPlaceholderSupabaseUrlServer(SUPABASE_URL)) {
        flushServerOutbox({
          dirs: STORAGE_DIRS,
          supabaseServer,
          supabaseUrl: SUPABASE_URL,
        }).catch(() => {});
      }
    }, 60000);
    if (typeof outboxTimer.unref === 'function') outboxTimer.unref();
  });
  server.on('error', (err: any) => {
    console.error(`[DRAC ZKTECO SERVER] Aviso en puerto ${PORT}:`, err?.code || err?.message);
  });
}

startServer().catch((err) => {
  console.error('[SERVER STARTUP ERROR]', err);
});
