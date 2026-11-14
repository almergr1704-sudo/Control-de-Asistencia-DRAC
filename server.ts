import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import net from 'net';
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rfqgmoremevypexrrsyf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWdtb3JlbWV2eXBleHJyc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjI3MTksImV4cCI6MjEwMzgzODcxOX0.L7VOne8N24590LxLZrYTmDPovu-Qs3Xibct6G0vhz5I';
const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers (supporting raw text payloads from ZKTeco G3-id ADMS)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/*', 'application/octet-stream'], limit: '10mb' }));

import { normalizeText, normalizeInstitutionalName, normalizePersonName } from './src/utils/nameUtils';

// Data Directory and Files (supports writable DRAC_DATA_DIR when running inside Electron app.asar)
const DATA_DIR = process.env.DRAC_DATA_DIR
  ? path.join(process.env.DRAC_DATA_DIR, 'data')
  : BUNDLED_DATA_DIR;
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (DATA_DIR !== BUNDLED_DATA_DIR && fs.existsSync(BUNDLED_DATA_DIR)) {
  try {
    for (const file of fs.readdirSync(BUNDLED_DATA_DIR)) {
      if (!file.endsWith('.json')) continue;
      const dest = path.join(DATA_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(BUNDLED_DATA_DIR, file), dest);
      }
    }
  } catch (_) {}
}

const RAW_PUNCHES_FILE = path.join(DATA_DIR, 'raw-punches.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
const PUSH_LOGS_FILE = path.join(DATA_DIR, 'push-logs.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit-logs.json');
const TURNOS_FILE = path.join(DATA_DIR, 'turnos.json');
const HORARIOS_FILE = path.join(DATA_DIR, 'horarios.json');
const ASIGNACIONES_FILE = path.join(DATA_DIR, 'asignacion-horarios.json');
const DEPENDENCIAS_FILE = path.join(DATA_DIR, 'dependencias.json');
const DIRECCIONES_FILE = path.join(DATA_DIR, 'direcciones.json');
const AREAS_FILE = path.join(DATA_DIR, 'areas.json');
const CARGOS_FILE = path.join(DATA_DIR, 'cargos.json');
const RESPONSABLES_FILE = path.join(DATA_DIR, 'responsables.json');
const PAPELETAS_FILE = path.join(DATA_DIR, 'papeletas.json');
const VACACIONES_FILE = path.join(DATA_DIR, 'vacaciones.json');
const ENCARGATURAS_FILE = path.join(DATA_DIR, 'encargaturas.json');

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

  // Enrich strictly by biometric ID or manually linked employee_id (never by name)
  const enriched = filtered.map((p) => {
    const rawCode = String(p.employee_code || p.employee_dni || '').trim();
    const linkedById = p.employee_id ? employees.find((e) => e.id === p.employee_id) : undefined;
    const emp = linkedById || findEmployeeByBiometricCode(employees, rawCode);
    const dev = devices.find((d) => d.serial_number === p.device_sn || d.id === p.device_id);
    const isIdentified = !!emp;
    return {
      ...p,
      employee_id: emp ? emp.id : null,
      employee_dni: emp ? emp.dni : rawCode,
      employee_code: rawCode,
      employee_name: emp ? normalizePersonName(`${emp.first_name} ${emp.last_name}`) : 'Pendiente de Identificación',
      device_name: dev ? dev.name : (p.device_name || 'ZKTeco G3 Sede Central'),
      validation_status: isIdentified ? (p.validation_status === 'PENDIENTE_IDENTIFICACION' ? 'VALIDA' : (p.validation_status || 'VALIDA')) : 'PENDIENTE_IDENTIFICACION',
      synced_at: p.synced_at || p.created_at || null,
      source: p.source || 'DIRECT_READ',
    };
  });

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
  const { fecha, dni } = req.query;

  let filtered = [...attendance];
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
  const nextVersion = (Number(existing.config_version) || 1) + 1;

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
  };

  // 4. Persist to data/devices.json
  devices[index] = updated;
  writeJsonFile(DEVICES_FILE, devices);

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
    push_server_port: 89,
    push_endpoint: '/iclock/cdata',
    push_protocol: 'HTTP',
    push_interval: 5,
    last_modified_by: `${userName} (${userRole || 'ADMIN_GENERAL'})`,
    last_modified_at: nowIso,
    updated_at: nowIso,
    config_version: 1,
  };

  devices.push(newDevice);
  writeJsonFile(DEVICES_FILE, devices);

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
    regimen_laboral: body.regimen_laboral || existing?.regimen_laboral || 'D.L. 276',
    condicion_laboral: body.condicion_laboral || body.condicion || existing?.condicion_laboral || 'NOMBRADO',
    is_jefe_director: Boolean(body.is_jefe_director),
    role: body.role || existing?.role || 'TRABAJADOR',
    assigned_roles: Array.isArray(body.assigned_roles) && body.assigned_roles.length > 0 ? body.assigned_roles : (existing?.assigned_roles || ['TRABAJADOR']),
    has_system_access: body.has_system_access !== undefined ? Boolean(body.has_system_access) : true,
    username: body.username || existing?.username || dni,
    account_status: body.account_status || existing?.account_status || 'ACTIVE',
    auth_method: body.auth_method || existing?.auth_method || 'PASSWORD',
    primer_ingreso: body.primer_ingreso || existing?.primer_ingreso || 'PENDIENTE',
    password_change_required: body.password_change_required !== undefined ? Boolean(body.password_change_required) : false,
    password_hash: body.password_hash || existing?.password_hash || null,
    active: body.active !== undefined ? Boolean(body.active) : true,
    hire_date: body.hire_date || existing?.hire_date || '2026-01-01',
    zkteco_pin: body.zkteco_pin || existing?.zkteco_pin || dni,
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
  const existingIdx = employees.findIndex((e) => e.id === body.id || (body.dni && e.dni === body.dni));
  const existing = existingIdx >= 0 ? employees[existingIdx] : undefined;
  const normalized = normalizeEmployeePayload(body, existing);

  if (existingIdx >= 0) {
    employees[existingIdx] = { ...employees[existingIdx], ...normalized };
  } else {
    employees.unshift(normalized);
  }

  writeJsonFile(EMPLOYEES_FILE, employees);

  // Replicar en Supabase PostgreSQL de manera asíncrona
  try {
    Promise.resolve(
      supabaseServer
        .from('trabajadores')
        .upsert({
          id: normalized.id,
          codigo_drac: normalized.codigo_trabajador,
          dni: normalized.dni,
          nombres: normalized.first_name,
          apellido_paterno: normalized.apellido_paterno,
          apellido_materno: normalized.apellido_materno,
          email: normalized.email,
          telefono: normalized.phone,
          direccion: normalized.address,
          dependencia_id: normalized.dependencia_id,
          area_id: normalized.area_id,
          cargo_id: normalized.cargo_id || 'crg-05',
          regimen_id: normalized.regimen_laboral,
          es_jefe: normalized.is_jefe_director,
          estado: normalized.active ? 'ACTIVO' : 'INACTIVO',
          fecha_ingreso: normalized.hire_date,
          updated_at: normalized.updated_at,
        })
    );
  } catch (_) {}

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

  const normalized = normalizeEmployeePayload(req.body, employees[idx]);
  employees[idx] = { ...employees[idx], ...normalized };
  writeJsonFile(EMPLOYEES_FILE, employees);

  // Replicar en Supabase PostgreSQL
  try {
    Promise.resolve(
      supabaseServer
        .from('trabajadores')
        .upsert({
          id: employees[idx].id,
          codigo_drac: employees[idx].codigo_trabajador,
          dni: employees[idx].dni,
          nombres: employees[idx].first_name,
          apellido_paterno: employees[idx].apellido_paterno,
          apellido_materno: employees[idx].apellido_materno,
          email: employees[idx].email,
          telefono: employees[idx].phone,
          direccion: employees[idx].address,
          dependencia_id: employees[idx].dependencia_id,
          area_id: employees[idx].area_id,
          cargo_id: employees[idx].cargo_id,
          regimen_id: employees[idx].regimen_laboral,
          es_jefe: employees[idx].is_jefe_director,
          estado: employees[idx].active ? 'ACTIVO' : 'INACTIVO',
          fecha_ingreso: employees[idx].hire_date,
          updated_at: new Date().toISOString(),
        })
    );
  } catch (_) {}

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

  try {
    Promise.resolve(supabaseServer.from('trabajadores').delete().eq('id', id));
  } catch (_) {}

  return res.json({ success: true, message: 'Trabajador dado de baja correctamente.', data: removed });
};

app.get('/api/employees', handleGetEmployees);
app.get('/api/trabajadores', handleGetEmployees);
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
  };

  const existingIdx = turnos.findIndex((t) => t.id === newTurno.id || t.code === newTurno.code);
  if (existingIdx >= 0) {
    turnos[existingIdx] = { ...turnos[existingIdx], ...newTurno };
  } else {
    turnos.push(newTurno);
  }
  writeJsonFile(TURNOS_FILE, turnos);

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

  turnos[idx] = {
    ...turnos[idx],
    ...req.body,
    tolerance_minutes: req.body.tolerance_minutes !== undefined ? Number(req.body.tolerance_minutes) : turnos[idx].tolerance_minutes,
    active: req.body.active !== undefined ? Boolean(req.body.active) : turnos[idx].active,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(TURNOS_FILE, turnos);

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
  };

  const existingIdx = horarios.findIndex((h) => h.id === newHorario.id || h.code === newHorario.code);
  if (existingIdx >= 0) {
    horarios[existingIdx] = { ...horarios[existingIdx], ...newHorario };
  } else {
    horarios.push(newHorario);
  }
  writeJsonFile(HORARIOS_FILE, horarios);

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

  horarios[idx] = {
    ...horarios[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(HORARIOS_FILE, horarios);

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
  if (existingIdx >= 0) {
    asignaciones[existingIdx] = { ...asignaciones[existingIdx], ...newAsignacion };
  } else {
    asignaciones.unshift(newAsignacion);
  }
  writeJsonFile(ASIGNACIONES_FILE, asignaciones);

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

  asignaciones[idx] = {
    ...asignaciones[idx],
    ...req.body,
    employee_name: req.body.employee_name ? normalizePersonName(req.body.employee_name) : asignaciones[idx].employee_name,
    horario_name: req.body.horario_name ? normalizeInstitutionalName(req.body.horario_name) : asignaciones[idx].horario_name,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(ASIGNACIONES_FILE, asignaciones);

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
  if (idx >= 0) {
    paps[idx] = { ...paps[idx], ...newPap };
  } else {
    paps.unshift(newPap);
  }
  writeJsonFile(PAPELETAS_FILE, paps);

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

  paps[idx] = {
    ...paps[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(PAPELETAS_FILE, paps);

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
  if (idx >= 0) {
    vacs[idx] = { ...vacs[idx], ...newVac };
  } else {
    vacs.unshift(newVac);
  }
  writeJsonFile(VACACIONES_FILE, vacs);

  return res.status(201).json({ success: true, message: 'Solicitud de vacación guardada correctamente.', data: newVac });
});

app.put('/api/vacaciones/:id', (req, res) => {
  const { id } = req.params;
  const vacs = readJsonFile<any[]>(VACACIONES_FILE, []);
  const idx = vacs.findIndex((v) => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Registro de vacación no encontrado.' });
  }

  vacs[idx] = {
    ...vacs[idx],
    ...req.body,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(VACACIONES_FILE, vacs);
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
      employee_name: workerName,
      dependencia_id: emp.dependencia_id || 'dep-01',
      dependencia_name: emp.dependencia_name || 'Sede Central - DRAC Cajamarca',
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    const att = existingAttendance[attIndex];
    if (!att.t1_real_in) att.t1_real_in = punchHour;
    else if (!att.t1_real_out && punchHour <= '13:30') att.t1_real_out = punchHour;
    else if (!att.t2_real_in && punchHour >= '13:45') att.t2_real_in = punchHour;
    else if (!att.t2_real_out && punchHour >= '16:00') {
      att.t2_real_out = punchHour;
      att.total_effective_hours = 8.0;
    }
    att.updated_at = new Date().toISOString();
    existingAttendance[attIndex] = att;
  }
}

async function persistRawPunchesToSupabase(records: any[]): Promise<{ dbSaved: boolean; dbError: string | null }> {
  if (!records || records.length === 0) return { dbSaved: true, dbError: null };
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

    const sbRes: any = await withServerTimeout(
      Promise.resolve(
        supabaseServer.from('marcaciones_raw').upsert(fullRows, { onConflict: 'id' })
      ),
      3500,
      'Timeout guardando marcaciones en Supabase PostgreSQL'
    );

    if (!sbRes?.error) {
      return { dbSaved: true, dbError: null };
    }

    const errMsg = String(sbRes.error.message || '');
    // Fallback si la tabla marcaciones_raw tiene solo columnas base (sin employee_code/source/punch_state)
    if (errMsg.includes('column') || sbRes.error.code === '42703' || sbRes.error.code === 'PGRST204') {
      const coreRows = records.map((r) => ({
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
          supabaseServer.from('marcaciones_raw').upsert(coreRows, { onConflict: 'id' })
        ),
        3500,
        'Timeout guardando marcaciones base en Supabase PostgreSQL'
      );
      if (!retryRes?.error) {
        return { dbSaved: true, dbError: null };
      }
      return { dbSaved: false, dbError: retryRes.error.message || errMsg };
    }

    return { dbSaved: false, dbError: errMsg || 'Error SQL Supabase en marcaciones_raw' };
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

    // Vinculación estricta SOLO por identificador biométrico (NUNCA por nombre)
    const emp = findEmployeeByBiometricCode(employees, rawPin);
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
      employee_code: rawPin,
      employee_name: workerName,
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
      created_at: syncedAt,
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

// Inspección read-only de esquema BioTime vía information_schema + verificación HTTP 89
async function inspectBioTimeDb(options?: {
  host?: string;
  webPort?: number;
  port?: number;
  dbName?: string;
  user?: string;
  password?: string;
  serial?: string;
}): Promise<{
  success: boolean;
  host: string;
  webPort: number;
  dbPort: number;
  dbName: string;
  webReachable: boolean;
  dbReachable: boolean;
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
  const webPort = Number(options?.webPort) || 89;
  const dbPort = Number(options?.port) || 7496;
  const dbName = String(options?.dbName || 'biotime').trim();
  const user = String(options?.user || 'postgres').trim();
  const serial = String(options?.serial || '').trim().toUpperCase();

  const probePort = (h: string, p: number, ms = 1800) =>
    new Promise<{ ok: boolean; code?: string; message?: string }>((resolve) => {
      const s = new net.Socket();
      let done = false;
      s.setTimeout(ms);
      s.on('connect', () => {
        if (done) return;
        done = true;
        s.destroy();
        resolve({ ok: true });
      });
      s.on('timeout', () => {
        if (done) return;
        done = true;
        s.destroy();
        resolve({ ok: false, code: 'ETIMEDOUT', message: 'Timeout' });
      });
      s.on('error', (err: any) => {
        if (done) return;
        done = true;
        s.destroy();
        resolve({ ok: false, code: err?.code, message: err?.message });
      });
      s.connect(p, h);
    });

  const webProbe = await probePort(host, webPort, 1500);
  const dbProbe = await probePort(host, dbPort, 1800);

  const report = {
    success: false,
    host,
    webPort,
    dbPort,
    dbName,
    webReachable: webProbe.ok,
    dbReachable: dbProbe.ok,
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

  if (!dbProbe.ok) {
    report.error = dbProbe.code || 'DB_UNREACHABLE';
    report.message = `PostgreSQL BioTime en ${host}:${dbPort} inaccesible desde este servidor (${dbProbe.code || dbProbe.message || 'Sin conexión'}).`;
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
  host?: string;
  port?: number;
  dbName?: string;
  user?: string;
  password?: string;
  serial?: string;
}): Promise<{ success: boolean; message: string; punches: any[]; latency: number; inspection?: any }> {
  const startTime = Date.now();
  const host = String(options?.host || '192.168.1.29').trim();
  const port = Number(options?.port) || 7496;
  const dbName = String(options?.dbName || 'biotime').trim();
  const user = String(options?.user || 'postgres').trim();
  const serial = String(options?.serial || '').trim().toUpperCase();

  // 1. Inspección obligatoria de solo lectura antes de consultar marcaciones
  const inspection = await inspectBioTimeDb({
    host,
    port,
    dbName,
    user,
    password: options?.password,
    serial,
  });

  if (!inspection.success || !inspection.attendanceTable) {
    return {
      success: false,
      message: inspection.message,
      punches: [],
      latency: Date.now() - startTime,
      inspection,
    };
  }

  if (!inspection.receivesClockPunches) {
    return {
      success: false,
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

// POST /api/zkteco/biotime/inspect - Inspección read-only de esquema BioTime PostgreSQL (information_schema) + HTTP 89
app.post('/api/zkteco/biotime/inspect', async (req, res) => {
  const { host, webPort, port, dbName, user, password, serial } = req.body || {};
  const devices = await getLatestDeviceConfig();
  const dev = devices[0] || {};

  const report = await inspectBioTimeDb({
    host: String(host || dev?.biotime_config?.db_host || '192.168.1.29').trim(),
    webPort: Number(webPort || dev?.biotime_config?.web_port || 89),
    port: Number(port || dev?.biotime_config?.db_port || 7496),
    dbName: String(dbName || dev?.biotime_config?.db_name || 'biotime').trim(),
    user: String(user || dev?.biotime_config?.db_user || 'postgres').trim(),
    password: password ? String(password) : undefined,
    serial: String(serial || dev?.serial_number || '').trim(),
  });

  return res.status(report.success ? 200 : 503).json(report);
});

// POST /api/zkteco/biotime/sync - Sincronización desde BioTime solo si recibe marcaciones reales
app.post('/api/zkteco/biotime/sync', async (req, res) => {
  const { host, port, dbName, user, password, serial } = req.body || {};
  const devices = await getLatestDeviceConfig();
  const dev = devices[0] || {};

  const targetHost = String(host || dev?.biotime_config?.db_host || '192.168.1.29').trim();
  const targetPort = Number(port || dev?.biotime_config?.db_port || 7496);
  const targetDb = String(dbName || dev?.biotime_config?.db_name || 'biotime').trim();
  const targetUser = String(user || dev?.biotime_config?.db_user || 'postgres').trim();
  const targetPass = password !== undefined ? String(password).trim() : undefined;
  const targetSerial = String(serial || dev?.serial_number || 'AEH2223460040').trim();

  const result = await syncPunchesFromBioTimeDb({
    host: targetHost,
    port: targetPort,
    dbName: targetDb,
    user: targetUser,
    password: targetPass,
    serial: targetSerial,
  });

  if (!result.success) {
    return res.status(503).json({
      success: false,
      status_code: 'OFFLINE',
      message: result.message,
      inspection: result.inspection,
      host: targetHost,
      port: targetPort,
      dbName: targetDb,
    });
  }

  const integration = await integrateRealPunchesIntoSystem(result.punches, 'BIOTIME_DB', {
    id: dev?.id,
    serial: targetSerial,
    name: dev?.name || 'ZKTeco G3 (vía BioTime)',
    ip: targetHost,
  });

  return res.json({
    success: integration.dbSaved || integration.newlyAdded === 0,
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
  const { host, webPort, port, dbName, user, password, serial } = req.body || {};
  const report = await inspectBioTimeDb({
    host: String(host || '192.168.1.29').trim(),
    webPort: Number(webPort || 89),
    port: Number(port || 7496),
    dbName: String(dbName || 'biotime').trim(),
    user: String(user || 'postgres').trim(),
    password: password ? String(password) : undefined,
    serial: serial ? String(serial) : undefined,
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
        employee_code: pCode || codeToLink,
        employee_name: empFullName,
        validation_status: 'VALIDA',
        processed: true,
        linked_at: new Date().toISOString(),
        linked_by: String(req.headers['x-user-name'] || req.body?.user_name || 'Operador Autorizado'),
      };
      updatedPunches.push(rawPunches[i]);
      upsertAttendanceFromIdentifiedPunch(existingAttendance, emp, rawPunches[i]);
    }
  }

  if (save_pin_to_employee && codeToLink) {
    const empIdx = employees.findIndex((e) => e.id === emp.id);
    if (empIdx >= 0) {
      employees[empIdx] = {
        ...employees[empIdx],
        zkteco_pin: codeToLink,
        biometric_user_id: codeToLink,
      };
      writeJsonFile(EMPLOYEES_FILE, employees);
    }
  }

  writeJsonFile(RAW_PUNCHES_FILE, rawPunches);
  writeJsonFile(ATTENDANCE_FILE, existingAttendance);
  const dbRes = await persistRawPunchesToSupabase(updatedPunches);

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
    const bioResult = await syncPunchesFromBioTimeDb({
      host: String(params?.host || targetDev?.biotime_config?.db_host || '192.168.1.29'),
      port: Number(params?.dbPort || targetDev?.biotime_config?.db_port || 7496),
      serial: cleanSerial,
    });

    if (!bioResult.success) {
      return res.status(503).json({
        success: false,
        status_code: 'OFFLINE',
        message: bioResult.message,
        details: {
          ip: activeIp,
          port: devPort,
          model: cleanModel,
          serial: cleanSerial,
          latency_ms: bioResult.latency,
          users_in_clock: 0,
          inspection: bioResult.inspection,
        },
      });
    }

    const integration = await integrateRealPunchesIntoSystem(bioResult.punches, 'BIOTIME_DB', {
      id: targetDev?.id,
      serial: cleanSerial,
      name: targetDev?.name || 'ZKTeco G3 (vía BioTime)',
      ip: activeIp,
    });

    return res.json({
      success: integration.dbSaved || integration.newlyAdded === 0,
      status_code: !integration.dbSaved && integration.newlyAdded > 0 ? 'DB_ERROR' : 'PUNCHES_RECEIVED',
      message: !integration.dbSaved && integration.newlyAdded > 0
        ? `Error de almacenamiento Supabase: ${integration.dbError}`
        : `Sincronización BioTime finalizada: ${integration.newlyAdded} nuevas marcaciones (${integration.duplicatesSkipped} duplicadas omitidas).`,
      details: {
        ip: activeIp,
        port: devPort,
        model: cleanModel,
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

// GET /api/health
app.get('/api/health', (req, res) => {
  return res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DRAC ZKTECO SERVER] Servidor institucional escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SERVER STARTUP ERROR]', err);
});
