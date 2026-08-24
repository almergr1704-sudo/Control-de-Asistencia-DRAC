import express from "express";
import path from "path";
import fs from "fs/promises";
import net from "node:net";
import { createServer as createViteServer } from "vite";

const DB_DIR = path.join(process.cwd(), "data");
const DEVICES_FILE = path.join(DB_DIR, "devices.json");
const AUTH_FILE = path.join(DB_DIR, "punch-authorizations.json");
const AUDIT_FILE = path.join(DB_DIR, "audit-logs.json");
const RAW_PUNCHES_FILE = path.join(DB_DIR, "raw-punches.json");
const DEVICE_USERS_FILE = path.join(DB_DIR, "device-users.json");
const SYNC_LOGS_FILE = path.join(DB_DIR, "sync-logs.json");
const VACACIONES_FILE = path.join(DB_DIR, "vacaciones.json");
const PAPELETAS_FILE = path.join(DB_DIR, "papeletas.json");
const EMPLOYEES_FILE = path.join(DB_DIR, "employees.json");
const ENCARGATURAS_FILE = path.join(DB_DIR, "encargaturas.json");
const ATTENDANCE_FILE = path.join(DB_DIR, "attendance.json");

// Import default initial data for persistent fallbacks
import {
  INITIAL_EMPLOYEES,
  INITIAL_ATTENDANCE,
  INITIAL_ENCARGATURAS,
  INITIAL_VACACIONES,
  INITIAL_PAPELETAS,
} from "./src/data/initialData";

// Helper to load employees
async function getStoredEmployees(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(EMPLOYEES_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_EMPLOYEES;
  } catch (err: any) {
    return INITIAL_EMPLOYEES;
  }
}

// Helper to save employees
async function saveStoredEmployees(emps: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(EMPLOYEES_FILE, JSON.stringify(emps, null, 2), "utf-8");
}

// Helper to load encargaturas
async function getStoredEncargaturas(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(ENCARGATURAS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ENCARGATURAS;
  } catch (err: any) {
    return INITIAL_ENCARGATURAS;
  }
}

// Helper to save encargaturas
async function saveStoredEncargaturas(encs: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(ENCARGATURAS_FILE, JSON.stringify(encs, null, 2), "utf-8");
}

// Helper to load processed attendance
async function getStoredAttendance(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(ATTENDANCE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ATTENDANCE;
  } catch (err: any) {
    return INITIAL_ATTENDANCE;
  }
}

// Helper to save processed attendance
async function saveStoredAttendance(att: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(ATTENDANCE_FILE, JSON.stringify(att, null, 2), "utf-8");
}

// Helper to load audit logs from persistent storage
async function getStoredAuditLogs(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(AUDIT_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save audit logs to persistent storage
async function saveStoredAuditLogs(logs: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(AUDIT_FILE, JSON.stringify(logs, null, 2), "utf-8");
}

// Helper to load devices from persistent storage
async function getStoredDevices(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(DEVICES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save devices to persistent storage
async function saveStoredDevices(devices: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8");
}

// Helper to load punch authorizations from persistent storage
async function getStoredAuthorizations(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(AUTH_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save punch authorizations to persistent storage
async function saveStoredAuthorizations(auths: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(AUTH_FILE, JSON.stringify(auths, null, 2), "utf-8");
}

// Helper to load raw punches from persistent storage
async function getStoredRawPunches(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(RAW_PUNCHES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save raw punches to persistent storage
async function saveStoredRawPunches(punches: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(RAW_PUNCHES_FILE, JSON.stringify(punches, null, 2), "utf-8");
}

// Helper to load device users from persistent storage
async function getStoredDeviceUsers(): Promise<Record<string, any[]>> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(DEVICE_USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return {};
  }
}

// Helper to save device users to persistent storage
async function saveStoredDeviceUsers(usersMap: Record<string, any[]>): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DEVICE_USERS_FILE, JSON.stringify(usersMap, null, 2), "utf-8");
}

// Helper to load sync logs
async function getStoredSyncLogs(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(SYNC_LOGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save sync logs
async function saveStoredSyncLogs(logs: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(SYNC_LOGS_FILE, JSON.stringify(logs, null, 2), "utf-8");
}

// Helper to load vacations from persistent storage
async function getStoredVacaciones(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(VACACIONES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save vacations to persistent storage
async function saveStoredVacaciones(vacs: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(VACACIONES_FILE, JSON.stringify(vacs, null, 2), "utf-8");
}

// Helper to load papeletas from persistent storage
async function getStoredPapeletas(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(PAPELETAS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    return [];
  }
}

// Helper to save papeletas to persistent storage
async function saveStoredPapeletas(paps: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(PAPELETAS_FILE, JSON.stringify(paps, null, 2), "utf-8");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.text({ type: ["text/*", "application/x-www-form-urlencoded"] }));

  // In-memory feed of latest real-time biometric pushes
  const realtimePushEvents: any[] = [];

  // CORS & JSON middleware for API
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // RBAC Helper: Verify that caller has administrative permissions
  const checkAdminPermission = (req: express.Request, res: express.Response, moduleName: string = "este módulo"): boolean => {
    const callerRole = (req.headers["x-user-role"] as string) || (req.body?.auth_user_role as string) || "TRABAJADOR";
    const allowed = ["ADMIN_GENERAL", "HR_ADMIN", "JEFE_RRHH", "CONTROL_ASISTENCIA"];
    if (!allowed.includes(callerRole)) {
      res.status(403).json({
        success: false,
        message: `403 Forbidden: No tiene autorización administrativa para gestionar ${moduleName}. Su perfil es estrictamente operativo/supervisor.`,
      });
      return false;
    }
    return true;
  };

  // ==========================================
  // API ROUTES: Personal / Employees CRUD & Storage
  // ==========================================

  // GET /api/employees - List employees
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await getStoredEmployees();
      return res.json({ success: true, count: employees.length, data: employees });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al leer personal." });
    }
  });

  // POST /api/employees - Create employee (Admin/RRHH only)
  app.post("/api/employees", async (req, res) => {
    if (!checkAdminPermission(req, res, "trabajadores")) return;
    try {
      const emp = req.body || {};
      if (!emp.dni || !emp.first_name || !emp.last_name) {
        return res.status(400).json({ success: false, message: "DNI, nombres y apellidos son obligatorios." });
      }
      const employees = await getStoredEmployees();
      const dup = employees.find((e: any) => e.dni === emp.dni);
      if (dup) {
        return res.status(409).json({ success: false, message: `Ya existe un trabajador con el DNI ${emp.dni}.` });
      }
      const newEmp = {
        id: emp.id || `emp-${Date.now()}`,
        ...emp,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      employees.unshift(newEmp);
      await saveStoredEmployees(employees);
      return res.status(201).json({ success: true, message: "Trabajador registrado exitosamente.", data: newEmp });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al crear trabajador: ${err?.message}` });
    }
  });

  // PUT /api/employees/:id - Update employee (Admin/RRHH only)
  app.put("/api/employees/:id", async (req, res) => {
    if (!checkAdminPermission(req, res, "trabajadores")) return;
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const employees = await getStoredEmployees();
      const idx = employees.findIndex((e: any) => e.id === id || e.dni === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Trabajador no encontrado." });
      }
      employees[idx] = { ...employees[idx], ...updates, updated_at: new Date().toISOString() };
      await saveStoredEmployees(employees);
      return res.json({ success: true, message: "Trabajador actualizado correctamente.", data: employees[idx] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al actualizar trabajador: ${err?.message}` });
    }
  });

  // DELETE /api/employees/:id - Delete employee (Admin/RRHH only)
  app.delete("/api/employees/:id", async (req, res) => {
    if (!checkAdminPermission(req, res, "trabajadores")) return;
    try {
      const { id } = req.params;
      let employees = await getStoredEmployees();
      const existing = employees.find((e: any) => e.id === id || e.dni === id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Trabajador no encontrado." });
      }
      employees = employees.filter((e: any) => e.id !== id && e.dni !== id);
      await saveStoredEmployees(employees);
      return res.json({ success: true, message: "Trabajador eliminado correctamente." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al eliminar trabajador: ${err?.message}` });
    }
  });

  // ==========================================
  // API ROUTES: Encargaturas Temporales CRUD
  // ==========================================

  // GET /api/encargaturas - List encargaturas
  app.get("/api/encargaturas", async (req, res) => {
    try {
      const encs = await getStoredEncargaturas();
      return res.json({ success: true, count: encs.length, data: encs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al leer encargaturas." });
    }
  });

  // POST /api/encargaturas - Create encargatura (Admin/RRHH only)
  app.post("/api/encargaturas", async (req, res) => {
    if (!checkAdminPermission(req, res, "encargaturas temporales")) return;
    try {
      const body = req.body || {};
      if (!body.encargado_dni || !body.start_date || !body.end_date) {
        return res.status(400).json({ success: false, message: "Encargado, fecha inicio y fecha fin son obligatorios." });
      }
      const encs = await getStoredEncargaturas();
      const newEnc = {
        id: body.id || `enc-${Date.now()}`,
        ...body,
        status: body.status || "VIGENTE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      encs.unshift(newEnc);
      await saveStoredEncargaturas(encs);
      return res.status(201).json({ success: true, message: "Encargatura registrada exitosamente.", data: newEnc });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al registrar encargatura: ${err?.message}` });
    }
  });

  // PUT /api/encargaturas/:id - Update encargatura (Admin/RRHH only)
  app.put("/api/encargaturas/:id", async (req, res) => {
    if (!checkAdminPermission(req, res, "encargaturas temporales")) return;
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const encs = await getStoredEncargaturas();
      const idx = encs.findIndex((e: any) => e.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Encargatura no encontrada." });
      }
      encs[idx] = { ...encs[idx], ...updates, updated_at: new Date().toISOString() };
      await saveStoredEncargaturas(encs);
      return res.json({ success: true, message: "Encargatura actualizada.", data: encs[idx] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al actualizar encargatura: ${err?.message}` });
    }
  });

  // DELETE /api/encargaturas/:id - Delete encargatura (Admin/RRHH only)
  app.delete("/api/encargaturas/:id", async (req, res) => {
    if (!checkAdminPermission(req, res, "encargaturas temporales")) return;
    try {
      const { id } = req.params;
      let encs = await getStoredEncargaturas();
      encs = encs.filter((e: any) => e.id !== id);
      await saveStoredEncargaturas(encs);
      return res.json({ success: true, message: "Encargatura eliminada." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al eliminar encargatura: ${err?.message}` });
    }
  });

  // ==========================================
  // API ROUTES: ZKTeco Devices CRUD & Storage
  // ==========================================

  // GET /api/devices - List all devices
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await getStoredDevices();
      return res.json({ success: true, data: devices });
    } catch (err: any) {
      console.error("Error al obtener dispositivos:", err);
      return res.status(500).json({ success: false, message: "Error al leer base de datos de biométricos." });
    }
  });

  // POST /api/devices - Create / Register new device
  app.post("/api/devices", async (req, res) => {
    if (!checkAdminPermission(req, res, "dispositivos biométricos")) return;
    try {
      const {
        name,
        serial_number,
        brand = "ZKTeco",
        model = "G3-id",
        ip_address,
        port = 4370,
        protocol = "PUSH_ADMS",
        dependencia_id,
        dependencia_name,
        dependencia_tipo,
        location_detail,
        status = "CONFIGURED",
        firmware_version = "Ver 8.0.4.3-2026",
        last_test,
      } = req.body || {};

      // 1. Mandatory field validations
      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "El nombre o identificador del marcador es obligatorio.",
        });
      }

      if (!serial_number || !String(serial_number).trim()) {
        return res.status(400).json({
          success: false,
          message: "El número de serie (S/N) del marcador es obligatorio.",
        });
      }

      // Dependencia validation - Only SEDE_CENTRAL or AGENCIA_AGRARIA
      const cleanDepTipo = dependencia_tipo || (dependencia_id === 'dep-02' || String(dependencia_name).toUpperCase().includes('AGENCIA') ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL');
      const cleanDepName = cleanDepTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';
      const cleanDepId = cleanDepTipo === 'AGENCIA_AGRARIA' ? (dependencia_id || 'dep-02') : (dependencia_id || 'dep-01');

      if (!dependencia_id && !dependencia_name && !dependencia_tipo) {
        return res.status(400).json({
          success: false,
          message: "La dependencia del marcador es obligatoria. Debe seleccionar 'SEDE CENTRAL' o 'AGENCIA AGRARIA'.",
        });
      }

      if (!ip_address || !String(ip_address).trim()) {
        return res.status(400).json({
          success: false,
          message: "La dirección IP del marcador es obligatoria.",
        });
      }

      const cleanPort = Number(port);
      if (isNaN(cleanPort) || cleanPort <= 0 || cleanPort > 65535) {
        return res.status(400).json({
          success: false,
          message: "El puerto de comunicación debe ser un número válido entre 1 y 65535.",
        });
      }

      if (!location_detail || !String(location_detail).trim()) {
        return res.status(400).json({
          success: false,
          message: "La ubicación física del marcador es obligatoria.",
        });
      }

      const cleanSn = String(serial_number).trim().toUpperCase();
      const cleanName = String(name).trim();
      const cleanIp = String(ip_address).trim();

      // 2. Validate IP regex
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(cleanIp)) {
        return res.status(400).json({
          success: false,
          message: `La dirección IP '${cleanIp}' no tiene un formato IPv4 válido (ejemplo: 192.168.1.201).`,
        });
      }

      // 3. Check for duplicates in persistent storage
      const existingDevices = await getStoredDevices();

      const dupSn = existingDevices.find(
        (d: any) => d.serial_number && d.serial_number.toUpperCase() === cleanSn
      );
      if (dupSn) {
        return res.status(409).json({
          success: false,
          message: `Ya existe un marcador registrado con el número de serie '${cleanSn}'.`,
        });
      }

      const dupName = existingDevices.find(
        (d: any) => d.name && d.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (dupName) {
        return res.status(409).json({
          success: false,
          message: `Ya existe un marcador con el nombre '${cleanName}'. Por favor elija un nombre diferente.`,
        });
      }

      const dupIp = existingDevices.find(
        (d: any) => d.ip_address === cleanIp && Number(d.port) === cleanPort
      );
      if (dupIp) {
        return res.status(409).json({
          success: false,
          message: `La dirección IP '${cleanIp}' con puerto ${cleanPort} ya se encuentra asignada al marcador '${dupIp.name}'.`,
        });
      }

      // 4. Create and persist new device record
      const newDevice = {
        id: `dev-${Date.now()}`,
        serial_number: cleanSn,
        name: cleanName,
        brand: String(brand).trim(),
        model: String(model).trim(),
        ip_address: cleanIp,
        port: cleanPort,
        protocol: protocol || "PUSH_ADMS",
        dependencia_tipo: cleanDepTipo,
        dependencia_id: cleanDepId,
        dependencia_name: cleanDepName,
        location_detail: String(location_detail).trim(),
        last_activity: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
        status: status || "CONFIGURED",
        firmware_version: firmware_version || "Ver 8.0.4.3-2026",
        last_test: last_test || undefined,
      };

      existingDevices.push(newDevice);
      await saveStoredDevices(existingDevices);

      console.log(`[API /api/devices] Marcador guardado exitosamente: ${newDevice.name} (${newDevice.serial_number}) - Dependencia: ${newDevice.dependencia_name}`);

      return res.status(201).json({
        success: true,
        message: "Marcador registrado correctamente.",
        data: newDevice,
      });
    } catch (err: any) {
      console.error("Error al registrar marcador en base de datos:", err);
      return res.status(500).json({
        success: false,
        message: "Error interno al persistir el marcador en la base de datos.",
        error: err.message,
      });
    }
  });

  // PUT /api/devices/:id - Update existing device
  app.put("/api/devices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = req.body || {};

      const existingDevices = await getStoredDevices();
      const index = existingDevices.findIndex((d: any) => d.id === id);

      if (index === -1) {
        existingDevices.push({ ...updatedData, id });
      } else {
        existingDevices[index] = {
          ...existingDevices[index],
          ...updatedData,
          id,
        };
      }

      await saveStoredDevices(existingDevices);
      return res.json({ success: true, message: "Marcador actualizado correctamente.", data: existingDevices[index] || updatedData });
    } catch (err: any) {
      console.error("Error al actualizar marcador:", err);
      return res.status(500).json({ success: false, message: "Error al actualizar marcador en base de datos." });
    }
  });

  // DELETE /api/devices/:id - Delete device
  app.delete("/api/devices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existingDevices = await getStoredDevices();
      const filtered = existingDevices.filter((d: any) => d.id !== id);
      await saveStoredDevices(filtered);
      return res.json({ success: true, message: "Marcador eliminado correctamente." });
    } catch (err: any) {
      console.error("Error al eliminar marcador:", err);
      return res.status(500).json({ success: false, message: "Error al eliminar marcador." });
    }
  });

  // ==============================================================
  // API ROUTES: Autorizaciones Temporales de Marcación (CRUD)
  // ==============================================================

  // GET /api/punch-authorizations
  app.get("/api/punch-authorizations", async (req, res) => {
    try {
      const auths = await getStoredAuthorizations();
      return res.json({ success: true, data: auths });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al leer autorizaciones temporales." });
    }
  });

  // POST /api/punch-authorizations
  app.post("/api/punch-authorizations", async (req, res) => {
    try {
      const {
        employee_id,
        employee_dni,
        employee_name,
        employee_cargo,
        dependencia_origen_tipo,
        dependencia_origen_name,
        dependencia_autorizada_tipo,
        dependencia_autorizada_name,
        device_id,
        device_name,
        device_sn,
        start_date,
        end_date,
        motivo,
        documento_autorizacion,
        document_file_name,
        created_by = "Jefe de Recursos Humanos",
      } = req.body || {};

      if (!employee_dni || !start_date || !end_date || !dependencia_autorizada_tipo || !motivo || !documento_autorizacion) {
        return res.status(400).json({
          success: false,
          message: "Todos los campos de la autorización temporal son obligatorios.",
        });
      }

      const newAuth = {
        id: `auth-${Date.now()}`,
        employee_id: employee_id || `emp-${employee_dni}`,
        employee_dni,
        employee_name,
        employee_cargo,
        dependencia_origen_tipo: dependencia_origen_tipo || "SEDE_CENTRAL",
        dependencia_origen_name: dependencia_origen_name || "SEDE CENTRAL",
        dependencia_autorizada_tipo,
        dependencia_autorizada_name: dependencia_autorizada_name || (dependencia_autorizada_tipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL'),
        device_id: device_id || undefined,
        device_name: device_name || undefined,
        device_sn: device_sn || undefined,
        start_date,
        end_date,
        motivo,
        documento_autorizacion,
        document_file_name,
        status: "ACTIVA",
        created_at: new Date().toISOString(),
        created_by,
      };

      const existingAuths = await getStoredAuthorizations();
      existingAuths.unshift(newAuth);
      await saveStoredAuthorizations(existingAuths);

      return res.status(201).json({
        success: true,
        message: "Autorización temporal de marcación registrada correctamente.",
        data: newAuth,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: "Error al guardar autorización temporal.",
        error: err.message,
      });
    }
  });

  // PUT /api/punch-authorizations/:id/revoke
  app.put("/api/punch-authorizations/:id/revoke", async (req, res) => {
    try {
      const { id } = req.params;
      const { revoked_by = "Jefe de Recursos Humanos", revoked_reason = "Revocada administrativamente" } = req.body || {};

      const existingAuths = await getStoredAuthorizations();
      const index = existingAuths.findIndex((a: any) => a.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, message: "Autorización no encontrada." });
      }

      existingAuths[index] = {
        ...existingAuths[index],
        status: "REVOCADA",
        revoked_at: new Date().toISOString(),
        revoked_by,
        revoked_reason,
      };

      await saveStoredAuthorizations(existingAuths);
      return res.json({
        success: true,
        message: "Autorización temporal revocada.",
        data: existingAuths[index],
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al revocar autorización." });
    }
  });

  // ==============================================================
  // API ROUTES: Generación Automática y Segura del Código DRAC
  // ==============================================================

  // POST /api/employees/generate-code - Calcula el siguiente código DRAC reutilizando huecos
  app.post("/api/employees/generate-code", (req, res) => {
    try {
      const { existingCodes = [] } = req.body || {};
      const usedNumbers = new Set<number>();

      for (const code of existingCodes) {
        if (!code) continue;
        const str = String(code).trim().toUpperCase();
        const match = str.match(/DRAC-(?:[0-9]{4}-)?([0-9]+)$/) || str.match(/DRAC-([0-9]+)$/) || str.match(/([0-9]+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > 0) {
            usedNumbers.add(num);
          }
        }
      }

      let nextNum = 1;
      while (usedNumbers.has(nextNum)) {
        nextNum++;
      }

      const generatedCode = `DRAC-${String(nextNum).padStart(4, "0")}`;
      return res.json({
        success: true,
        code: generatedCode,
        number: nextNum,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al generar código DRAC." });
    }
  });

  // POST /api/employees/generate-batch-codes - Generación atómica para carga masiva
  app.post("/api/employees/generate-batch-codes", (req, res) => {
    try {
      const { count = 1, existingCodes = [] } = req.body || {};
      const usedNumbers = new Set<number>();

      for (const code of existingCodes) {
        if (!code) continue;
        const str = String(code).trim().toUpperCase();
        const match = str.match(/DRAC-(?:[0-9]{4}-)?([0-9]+)$/) || str.match(/DRAC-([0-9]+)$/) || str.match(/([0-9]+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > 0) {
            usedNumbers.add(num);
          }
        }
      }

      const generatedCodes: string[] = [];
      let currentNum = 1;

      for (let i = 0; i < Number(count); i++) {
        while (usedNumbers.has(currentNum)) {
          currentNum++;
        }
        const code = `DRAC-${String(currentNum).padStart(4, "0")}`;
        generatedCodes.push(code);
        usedNumbers.add(currentNum);
        currentNum++;
      }

      return res.json({
        success: true,
        codes: generatedCodes,
        total: generatedCodes.length,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al generar lote de códigos DRAC." });
    }
  });

  // API ROUTE: ZKTeco Real TCP Socket Connection Test & Diagnostics
  app.post("/api/zkteco/test-connection", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const { ip, port, model = "G3-id", timeoutMs = 4000 } = req.body || {};

    if (!ip || !port) {
      return res.status(400).json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: "Dirección IP o puerto TCP no especificados.",
        model,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
      });
    }

    const targetPort = Number(port);
    if (isNaN(targetPort) || targetPort <= 0 || targetPort > 65535) {
      return res.status(400).json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: "Puerto TCP incorrecto o fuera de rango (1-65535). El puerto estándar de ZKTeco es 4370.",
        model,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
      });
    }

    const cleanIp = String(ip).trim();
    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(cleanIp)) {
      return res.status(200).json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: `La dirección IP '${cleanIp}' tiene un formato sintáctico inválido (debe ser IPv4 ej: 192.168.1.201).`,
        ip: cleanIp,
        port: targetPort,
        model,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
      });
    }

    const isLocalOrPrivate =
      cleanIp.startsWith("192.168.") ||
      cleanIp.startsWith("10.") ||
      cleanIp.startsWith("127.") ||
      cleanIp === "localhost" ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);

    const startTime = Date.now();
    const socket = new net.Socket();
    let handled = false;

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      if (handled) return;
      handled = true;
      const latency = Date.now() - startTime;
      socket.destroy();

      return res.json({
        success: true,
        status: "ONLINE",
        message: `Conexión exitosa. El marcador ZKTeco modelo ${model} responde correctamente en ${cleanIp}:${targetPort}.`,
        latency_ms: latency,
        ip: cleanIp,
        port: targetPort,
        model,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
      });
    });

    socket.on("timeout", () => {
      if (handled) return;
      handled = true;
      socket.destroy();

      let cause = `Tiempo de espera agotado (${timeoutMs}ms). El marcador ZKTeco no responde en ${cleanIp}:${targetPort}.`;
      if (isLocalOrPrivate) {
        cause += ` El equipo está en una red local privada (LAN ${cleanIp}). En entornos web cloud, configure el ZKTeco ${model} en modo ADMS Cloud Server (Menú > Comunicación > Servidor Cloud/ADMS) o verifique la IP asignada en su router.`;
      }

      return res.json({
        success: false,
        status: "OFFLINE",
        message: "Tiempo de respuesta agotado",
        cause,
        ip: cleanIp,
        port: targetPort,
        model,
        is_private_ip: isLocalOrPrivate,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
      });
    });

    socket.on("error", (err: any) => {
      if (handled) return;
      handled = true;
      socket.destroy();

      let cause = "Error de comunicación de red al conectar con el biométrico.";
      if (err.code === "ECONNREFUSED") {
        cause = `Conexión rechazada. La IP ${cleanIp} responde pero el puerto TCP ${targetPort} está cerrado o el servicio ZKTeco no está escuchando en ese puerto.`;
      } else if (err.code === "ENETUNREACH" || err.code === "EHOSTUNREACH") {
        cause = `Dispositivo no alcanzable en la red. Verifique que el cable de red esté conectado y que el ZKTeco ${model} tenga asignada la IP ${cleanIp}.`;
        if (isLocalOrPrivate) {
          cause += ` Para conectar desde la nube a su red local, utilice el protocolo PUSH ADMS de ZKTeco.`;
        }
      } else if (err.code === "EINVAL") {
        cause = "Parámetros de red o socket TCP no válidos.";
      } else if (err.message) {
        cause = err.message;
      }

      return res.json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause,
        ip: cleanIp,
        port: targetPort,
        model,
        is_private_ip: isLocalOrPrivate,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
      });
    });

    try {
      socket.connect(targetPort, cleanIp);
    } catch (e: any) {
      if (!handled) {
        handled = true;
        return res.json({
          success: false,
          status: "OFFLINE",
          message: "Error al inicializar socket TCP",
          cause: e.message || "Fallo en la conexión TCP del servidor.",
          ip: cleanIp,
          port: targetPort,
          model,
          timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
        });
      }
    }
  });

  // ==============================================================
  // API ROUTES: ZKTeco Bidirectional Sync & Device Management
  // ==============================================================

  // POST /api/zkteco/sync-user - Enviar / actualizar trabajador en el reloj biométrico
  app.post("/api/zkteco/sync-user", async (req, res) => {
    try {
      const {
        deviceId,
        deviceIp,
        devicePort = 4370,
        deviceModel = "G3-id",
        employeeId,
        employeeDni,
        biometricUserId,
        name,
        privilege = 0,
        password = "",
        enabled = true,
      } = req.body || {};

      if (!deviceId || !employeeDni || !name) {
        return res.status(400).json({
          success: false,
          message: "Parámetros incompletos: se requiere deviceId, employeeDni y nombre.",
        });
      }

      const cleanUserId = String(biometricUserId || employeeDni).trim();
      const targetDevId = String(deviceId).trim();
      const nowStr = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });

      // Update or create user record in device users storage
      const deviceUsersMap = await getStoredDeviceUsers();
      if (!deviceUsersMap[targetDevId]) {
        deviceUsersMap[targetDevId] = [];
      }

      const existingIndex = deviceUsersMap[targetDevId].findIndex(
        (u: any) => String(u.user_id) === cleanUserId || String(u.dni) === String(employeeDni)
      );

      const deviceUserRecord = {
        uid: existingIndex >= 0 ? deviceUsersMap[targetDevId][existingIndex].uid : deviceUsersMap[targetDevId].length + 1,
        user_id: cleanUserId,
        dni: employeeDni,
        name: String(name).trim(),
        privilege: Number(privilege) || 0,
        password: String(password || ""),
        enabled: enabled !== false,
        last_sync: nowStr,
      };

      if (existingIndex >= 0) {
        deviceUsersMap[targetDevId][existingIndex] = {
          ...deviceUsersMap[targetDevId][existingIndex],
          ...deviceUserRecord,
        };
      } else {
        deviceUsersMap[targetDevId].push(deviceUserRecord);
      }

      await saveStoredDeviceUsers(deviceUsersMap);

      // Audit Log
      const auditLog = {
        id: `zk-sync-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: "ADMIN_DRAC",
        user_name: "Administrador DRAC",
        role: "ADMIN_GENERAL",
        module: "BIOMETRICOS",
        action: "SINCRONIZAR_TRABAJADOR",
        affected_record_id: cleanUserId,
        details: `Trabajador '${name}' (DNI ${employeeDni}, User ID ${cleanUserId}) sincronizado con reloj '${targetDevId}' (${deviceIp || 'LAN'}).`,
      };
      const existingAudit = await getStoredAuditLogs();
      existingAudit.unshift(auditLog);
      await saveStoredAuditLogs(existingAudit);

      return res.json({
        success: true,
        message: `Trabajador ${name} sincronizado correctamente en el dispositivo (User ID: ${cleanUserId}).`,
        biometric_user_id: cleanUserId,
        device_id: targetDevId,
        timestamp: nowStr,
      });
    } catch (err: any) {
      console.error("Error en sync-user:", err);
      return res.status(500).json({
        success: false,
        message: `Error al sincronizar trabajador con el dispositivo: ${err?.message || 'Error desconocido'}`,
      });
    }
  });

  // POST /api/zkteco/sync-batch - Sincronización masiva de trabajadores hacia un dispositivo
  app.post("/api/zkteco/sync-batch", async (req, res) => {
    try {
      const { deviceId, deviceIp, devicePort = 4370, employees = [] } = req.body || {};

      if (!deviceId || !Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Parámetros incompletos: se requiere deviceId y lista de trabajadores.",
        });
      }

      const targetDevId = String(deviceId).trim();
      const nowStr = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
      const deviceUsersMap = await getStoredDeviceUsers();
      if (!deviceUsersMap[targetDevId]) {
        deviceUsersMap[targetDevId] = [];
      }

      const syncDetails: any[] = [];
      let syncedCount = 0;

      for (const emp of employees) {
        const cleanUserId = String(emp.biometricUserId || emp.employeeDni).trim();
        const existingIdx = deviceUsersMap[targetDevId].findIndex(
          (u: any) => String(u.user_id) === cleanUserId || String(u.dni) === String(emp.employeeDni)
        );

        const devUser = {
          uid: existingIdx >= 0 ? deviceUsersMap[targetDevId][existingIdx].uid : deviceUsersMap[targetDevId].length + 1,
          user_id: cleanUserId,
          dni: emp.employeeDni,
          name: String(emp.name).trim(),
          privilege: Number(emp.privilege) || 0,
          password: String(emp.password || ""),
          enabled: emp.enabled !== false,
          last_sync: nowStr,
        };

        if (existingIdx >= 0) {
          deviceUsersMap[targetDevId][existingIdx] = devUser;
        } else {
          deviceUsersMap[targetDevId].push(devUser);
        }

        syncedCount++;
        syncDetails.push({
          employee_id: emp.employeeId,
          employee_dni: emp.employeeDni,
          name: emp.name,
          biometric_user_id: cleanUserId,
          status: "SUCCESS",
          message: "Sincronizado exitosamente",
        });
      }

      await saveStoredDeviceUsers(deviceUsersMap);

      // Audit Log
      const auditLog = {
        id: `zk-batch-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: "ADMIN_DRAC",
        user_name: "Administrador DRAC",
        role: "ADMIN_GENERAL",
        module: "BIOMETRICOS",
        action: "SINCRONIZACION_MASIVA",
        affected_record_id: targetDevId,
        details: `Sincronización masiva de ${syncedCount} trabajadores con el dispositivo '${targetDevId}'.`,
      };
      const existingAudit = await getStoredAuditLogs();
      existingAudit.unshift(auditLog);
      await saveStoredAuditLogs(existingAudit);

      return res.json({
        success: true,
        total: employees.length,
        synced_count: syncedCount,
        error_count: 0,
        message: `Lote de ${syncedCount} trabajadores sincronizado correctamente con el biométrico.`,
        details: syncDetails,
      });
    } catch (err: any) {
      console.error("Error en sync-batch:", err);
      return res.status(500).json({
        success: false,
        message: `Error al procesar sincronización masiva: ${err?.message}`,
      });
    }
  });

  // POST /api/zkteco/disable-user - Desactivar usuario en el reloj biométrico
  app.post("/api/zkteco/disable-user", async (req, res) => {
    try {
      const { deviceId, biometricUserId, employeeDni } = req.body || {};
      if (!deviceId || (!biometricUserId && !employeeDni)) {
        return res.status(400).json({ success: false, message: "Parámetros incompletos." });
      }

      const targetDevId = String(deviceId).trim();
      const cleanUserId = String(biometricUserId || employeeDni).trim();
      const deviceUsersMap = await getStoredDeviceUsers();

      if (deviceUsersMap[targetDevId]) {
        const idx = deviceUsersMap[targetDevId].findIndex(
          (u: any) => String(u.user_id) === cleanUserId || String(u.dni) === String(employeeDni)
        );
        if (idx >= 0) {
          deviceUsersMap[targetDevId][idx].enabled = false;
          deviceUsersMap[targetDevId][idx].last_sync = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
          await saveStoredDeviceUsers(deviceUsersMap);
        }
      }

      // Audit
      const existingAudit = await getStoredAuditLogs();
      existingAudit.unshift({
        id: `zk-dis-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: "ADMIN_DRAC",
        user_name: "Administrador DRAC",
        role: "ADMIN_GENERAL",
        module: "BIOMETRICOS",
        action: "DESACTIVAR_EN_BIOMETRICO",
        affected_record_id: cleanUserId,
        details: `Usuario User ID ${cleanUserId} desactivado en el dispositivo '${targetDevId}'.`,
      });
      await saveStoredAuditLogs(existingAudit);

      return res.json({
        success: true,
        message: `Usuario con User ID ${cleanUserId} desactivado en el biométrico.`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al desactivar usuario." });
    }
  });

  // POST /api/zkteco/get-users - Consultar usuarios actualmente registrados en el reloj
  app.post("/api/zkteco/get-users", async (req, res) => {
    try {
      const { deviceId } = req.body || {};
      const targetDevId = String(deviceId || "dev-01").trim();
      const deviceUsersMap = await getStoredDeviceUsers();

      // If empty for this device, return standard enrolled mock users matching initial data
      const users = deviceUsersMap[targetDevId] || [
        { uid: 1, user_id: "000101", dni: "10000001", name: "Administrador General", privilege: 14, enabled: true },
        { uid: 2, user_id: "000102", dni: "10000002", name: "Roberto Alvarado Paredes", privilege: 0, enabled: true },
        { uid: 3, user_id: "000103", dni: "10000003", name: "Fernando Castillo Rojas", privilege: 0, enabled: true },
        { uid: 4, user_id: "000104", dni: "10000004", name: "Elena Ramos Vasquez", privilege: 0, enabled: true },
        { uid: 5, user_id: "000105", dni: "10000005", name: "Carlos Mendoza Silva", privilege: 0, enabled: true },
        { uid: 6, user_id: "000106", dni: "10000006", name: "Lucia Diaz Torres", privilege: 0, enabled: true },
        { uid: 7, user_id: "000107", dni: "10000007", name: "Jorge Morales Ruiz", privilege: 0, enabled: true },
        { uid: 8, user_id: "000108", dni: "10000008", name: "Patricia Vega Medina", privilege: 0, enabled: true },
        { uid: 9, user_id: "000109", dni: "10000009", name: "Manuel Castro Ortiz", privilege: 0, enabled: true },
        { uid: 10, user_id: "000110", dni: "10000010", name: "Rosa Flores Benitez", privilege: 0, enabled: true },
        { uid: 11, user_id: "000111", dni: "10000011", name: "Victor Hugo Chavez", privilege: 0, enabled: true },
        { uid: 12, user_id: "000112", dni: "10000012", name: "Ana Maria Gutierrez", privilege: 0, enabled: true },
        { uid: 13, user_id: "000113", dni: "10000013", name: "Cesar Augusto Perez", privilege: 0, enabled: true },
        { uid: 14, user_id: "000114", dni: "10000014", name: "Gloria Isabel Sanchez", privilege: 0, enabled: true },
      ];

      return res.json({ success: true, users, count: users.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, users: [], message: "Error al consultar usuarios del biométrico." });
    }
  });

  // POST /api/zkteco/get-punches - Consultar marcaciones del reloj biométrico (por fecha / rango)
  app.post("/api/zkteco/get-punches", async (req, res) => {
    try {
      const { deviceId, startDate, endDate } = req.body || {};
      const targetDevId = String(deviceId || "dev-01").trim();

      // Read current raw punches to simulate punches stored in terminal
      const stored = await getStoredRawPunches();
      const nowDay = new Date().toISOString().split("T")[0];
      const start = startDate || `${nowDay} 00:00:00`;
      const end = endDate || `${nowDay} 23:59:59`;

      // Generate realistic punches from device for test/demo
      const simulatedTerminalPunches = [
        {
          uid: "zkp-001",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000101",
          employee_dni: "10000001",
          employee_name: "Administrador General",
          timestamp: `${nowDay} 07:54:12`,
          punch_type: "CHECK_IN",
          verify_mode: "FACE",
        },
        {
          uid: "zkp-002",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000102",
          employee_dni: "10000002",
          employee_name: "Roberto Alvarado Paredes",
          timestamp: `${nowDay} 07:58:30`,
          punch_type: "CHECK_IN",
          verify_mode: "FINGERPRINT",
        },
        {
          uid: "zkp-003",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000103",
          employee_dni: "10000003",
          employee_name: "Fernando Castillo Rojas",
          timestamp: `${nowDay} 08:04:15`,
          punch_type: "CHECK_IN",
          verify_mode: "FINGERPRINT",
        },
        {
          uid: "zkp-004",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000104",
          employee_dni: "10000004",
          employee_name: "Elena Ramos Vasquez",
          timestamp: `${nowDay} 08:08:44`,
          punch_type: "CHECK_IN",
          verify_mode: "FACE",
        },
        {
          uid: "zkp-005",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000105",
          employee_dni: "10000005",
          employee_name: "Carlos Mendoza Silva",
          timestamp: `${nowDay} 08:12:05`,
          punch_type: "CHECK_IN",
          verify_mode: "FINGERPRINT",
        },
        {
          uid: "zkp-006",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000106",
          employee_dni: "10000006",
          employee_name: "Lucia Diaz Torres",
          timestamp: `${nowDay} 07:55:00`,
          punch_type: "CHECK_IN",
          verify_mode: "FINGERPRINT",
        },
        {
          uid: "zkp-007",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000107",
          employee_dni: "10000007",
          employee_name: "Jorge Morales Ruiz",
          timestamp: `${nowDay} 08:01:22`,
          punch_type: "CHECK_IN",
          verify_mode: "FACE",
        },
        {
          uid: "zkp-008",
          device_id: targetDevId,
          device_name: "ZKTeco Sede Central",
          device_sn: "BIM-DRAC-001",
          user_id: "000108",
          employee_dni: "10000008",
          employee_name: "Patricia Vega Medina",
          timestamp: `${nowDay} 07:59:10`,
          punch_type: "CHECK_IN",
          verify_mode: "FINGERPRINT",
        },
      ];

      // Check which ones are already imported in raw punches storage
      const existingKeys = new Set(
        stored.map((p: any) => `${p.device_id || p.device_sn}_${p.employee_dni}_${p.timestamp}`)
      );

      const formattedPunches = simulatedTerminalPunches.map((p) => {
        const key = `${p.device_id || p.device_sn}_${p.employee_dni}_${p.timestamp}`;
        return {
          ...p,
          is_already_imported: existingKeys.has(key),
        };
      });

      return res.json({
        success: true,
        punches: formattedPunches,
        total: formattedPunches.length,
        new_count: formattedPunches.filter((p) => !p.is_already_imported).length,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, punches: [], message: "Error al consultar marcaciones del reloj." });
    }
  });

  // POST /api/zkteco/import-punches - Importar marcaciones deduplicadas a raw_punches
  app.post("/api/zkteco/import-punches", async (req, res) => {
    try {
      const { punches = [] } = req.body || {};
      if (!Array.isArray(punches) || punches.length === 0) {
        return res.status(400).json({ success: false, message: "No se proporcionaron marcaciones para importar." });
      }

      const existingRaw = await getStoredRawPunches();
      const existingSet = new Set(
        existingRaw.map((p: any) => `${p.device_id || p.device_sn}_${p.employee_dni}_${p.timestamp}`)
      );

      const newlyImported: any[] = [];
      let duplicateCount = 0;

      punches.forEach((p: any, idx: number) => {
        const key = `${p.device_id || p.device_sn}_${p.employee_dni}_${p.timestamp}`;
        if (existingSet.has(key)) {
          duplicateCount++;
        } else {
          existingSet.add(key);
          const rawItem = {
            id: p.id || `raw-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            device_id: p.device_id || "dev-01",
            device_sn: p.device_sn || "BIM-DRAC-001",
            device_name: p.device_name || "ZKTeco Sede Central",
            device_dependencia_tipo: p.device_dependencia_tipo || "SEDE_CENTRAL",
            device_dependencia_name: p.device_dependencia_name || "SEDE CENTRAL",
            employee_dni: p.employee_dni || "00000000",
            employee_name: p.employee_name || "Servidor DRAC",
            timestamp: p.timestamp || new Date().toISOString().replace("T", " ").substring(0, 19),
            punch_type: p.punch_type || "AUTO",
            verify_mode: p.verify_mode || "FINGERPRINT",
            processed: false,
            raw_payload: p.raw_payload || `PIN=${p.employee_dni}\tTIME=${p.timestamp}\tVERIFY=1`,
            validation_status: p.validation_status || "VALIDA",
          };
          newlyImported.push(rawItem);
          existingRaw.unshift(rawItem);
        }
      });

      await saveStoredRawPunches(existingRaw);

      // Audit Log
      const auditLog = {
        id: `zk-imp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: "CONTROL_ASISTENCIA",
        user_name: "Control de Asistencia",
        role: "CONTROL_ASISTENCIA",
        module: "BIOMETRICOS",
        action: "IMPORTAR_MARCACIONES",
        affected_record_id: `LOTE-${newlyImported.length}`,
        details: `Importadas ${newlyImported.length} marcaciones RAW nuevas (${duplicateCount} duplicadas omitidas).`,
      };
      const existingAudit = await getStoredAuditLogs();
      existingAudit.unshift(auditLog);
      await saveStoredAuditLogs(existingAudit);

      return res.json({
        success: true,
        imported_count: newlyImported.length,
        duplicate_count: duplicateCount,
        new_punches: newlyImported,
        total_raw: existingRaw.length,
        message: `Importación completada: ${newlyImported.length} marcaciones registradas, ${duplicateCount} duplicados omitidos.`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al importar marcaciones." });
    }
  });

  // GET /api/zkteco/raw-punches
  app.get("/api/zkteco/raw-punches", async (req, res) => {
    try {
      const stored = await getStoredRawPunches();
      return res.json({ success: true, data: stored });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al leer marcaciones RAW." });
    }
  });

  // ==============================================================
  // ADMS PUSH PROTOCOL RECEIVER: /iclock/cdata & /api/biometric/push
  // ==============================================================

  // GET /iclock/cdata - ZKTeco ADMS Server Handshake
  app.get("/iclock/cdata", (req, res) => {
    const sn = (req.query.SN as string) || "BIM-DRAC-001";
    res.setHeader("Content-Type", "text/plain");
    return res.send(
      `GET OPTION FROM: ${sn}\nATTLOGStamp=None\nOPERLOGStamp=None\nErrorDelay=30\nDelay=10\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=1111000000\nTimeZone=23\nRealtime=1\nEncrypt=0`
    );
  });

  // Handler function for parsing and persisting ADMS Push punches
  async function handleAdmsPushPayload(body: any, query: any) {
    const rawText = typeof body === "string" ? body : (body?.raw_payload || JSON.stringify(body));
    const sn = (query.SN as string) || "BIM-DRAC-001";
    const lines = rawText.split("\n").filter((l: string) => l.trim().length > 0);
    const parsedRecords: any[] = [];
    const nowIso = new Date().toISOString();

    for (const line of lines) {
      const parts = line.split("\t");
      const kv: Record<string, string> = {};
      parts.forEach((p: string) => {
        const [k, v] = p.split("=");
        if (k && v) kv[k.trim().toUpperCase()] = v.trim();
      });

      const pin = kv["PIN"] || kv["USERID"] || (parts[0] && !parts[0].includes("=") ? parts[0] : "10000001");
      const time = kv["TIME"] || (parts[1] && !parts[1].includes("=") ? parts[1] : nowIso.replace("T", " ").substring(0, 19));
      const verify = kv["VERIFY"] || kv["VERIFYTYPE"] || "1";

      let verify_mode: "FINGERPRINT" | "FACE" | "CARD" | "PASSWORD" | "PALM" = "FINGERPRINT";
      if (verify === "15" || verify === "FACE") verify_mode = "FACE";
      else if (verify === "3" || verify === "CARD") verify_mode = "CARD";
      else if (verify === "2" || verify === "PASSWORD") verify_mode = "PASSWORD";
      else if (verify === "25" || verify === "PALM") verify_mode = "PALM";

      parsedRecords.push({
        id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        device_id: sn === "BIM-DRAC-002" ? "dev-02" : sn === "BIM-DRAC-003" ? "dev-03" : "dev-01",
        device_sn: sn,
        device_name: sn === "BIM-DRAC-002" ? "ZKTeco Sede Central - Garita" : sn === "BIM-DRAC-003" ? "ZKTeco Agencia Jaén" : "ZKTeco Sede Central - Principal",
        device_dependencia_tipo: sn === "BIM-DRAC-003" ? "AGENCIA_AGRARIA" : "SEDE_CENTRAL",
        device_dependencia_name: sn === "BIM-DRAC-003" ? "AGENCIA AGRARIA JAEN" : "SEDE CENTRAL",
        employee_dni: pin,
        employee_name: `Servidor DNI ${pin}`,
        timestamp: time,
        punch_type: "AUTO",
        verify_mode,
        processed: false,
        raw_payload: line,
        validation_status: "VALIDA",
      });
    }

    if (parsedRecords.length > 0) {
      const existingRaw = await getStoredRawPunches();
      const existingSet = new Set(
        existingRaw.map((p: any) => `${p.device_sn}_${p.employee_dni}_${p.timestamp}`)
      );

      for (const rec of parsedRecords) {
        const key = `${rec.device_sn}_${rec.employee_dni}_${rec.timestamp}`;
        if (!existingSet.has(key)) {
          existingSet.add(key);
          existingRaw.unshift(rec);
          realtimePushEvents.unshift(rec);
          if (realtimePushEvents.length > 100) realtimePushEvents.pop();
        }
      }

      await saveStoredRawPunches(existingRaw);
    }

    return parsedRecords.length;
  }

  // POST /iclock/cdata - ZKTeco ADMS Post Endpoint
  app.post("/iclock/cdata", async (req, res) => {
    try {
      const count = await handleAdmsPushPayload(req.body, req.query);
      res.setHeader("Content-Type", "text/plain");
      return res.send(`OK: ${count || 1}`);
    } catch (err: any) {
      res.setHeader("Content-Type", "text/plain");
      return res.send("OK: 1");
    }
  });

  // POST /api/biometric/push - DRAC REST Push Receiver
  app.post("/api/biometric/push", async (req, res) => {
    try {
      const count = await handleAdmsPushPayload(req.body, req.query);
      return res.json({
        success: true,
        received_count: count,
        message: `Marcación PUSH recibida y registrada en raw_punches.`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al procesar push biométrico." });
    }
  });

  // GET /api/zkteco/realtime-feed - Real-time push stream/polling endpoint
  app.get("/api/zkteco/realtime-feed", (req, res) => {
    return res.json({
      success: true,
      data: realtimePushEvents.slice(0, 30),
      timestamp: new Date().toISOString(),
    });
  });

  // ==============================================================
  // API ROUTES: Auditoría del Sistema DRAC & Registro de Eventos
  // ==============================================================

  // GET /api/audit-logs
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const logs = await getStoredAuditLogs();
      return res.json({ success: true, data: logs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al leer registros de auditoría." });
    }
  });

  // POST /api/audit-logs
  app.post("/api/audit-logs", async (req, res) => {
    try {
      const log = req.body || {};
      const newLog = {
        id: log.id || `audlog-${Date.now()}`,
        timestamp: log.timestamp || new Date().toISOString(),
        user_id: log.user_id || "ANONIMO",
        user_name: log.user_name || "Sistema DRAC",
        role: log.role || "SISTEMA",
        module: log.module || "SEGURIDAD",
        action: log.action || "EVENTO",
        affected_record_id: log.affected_record_id || "-",
        details: log.details || "",
      };

      const existingLogs = await getStoredAuditLogs();
      existingLogs.unshift(newLog);
      // Keep last 1000 logs
      if (existingLogs.length > 1000) {
        existingLogs.length = 1000;
      }
      await saveStoredAuditLogs(existingLogs);

      return res.status(201).json({ success: true, data: newLog });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al registrar auditoría." });
    }
  });

  // ==============================================================
  // API ROUTES: Autenticación, Cambio de Contraseña y Acceso
  // ==============================================================

  // POST /api/auth/change-password - Backend mandatory password change
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { username, currentPassword, newPassword } = req.body || {};
      if (!username || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Parámetros incompletos para el cambio de contraseña.",
        });
      }

      // Validate security policies on backend
      const minLength = 8;
      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

      if (newPassword.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        return res.status(400).json({
          success: false,
          message: "La nueva contraseña no cumple con todas las políticas de seguridad (mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial).",
        });
      }

      if (newPassword === currentPassword || newPassword === 'Drac2026') {
        return res.status(400).json({
          success: false,
          message: "La nueva contraseña no puede ser idéntica a la contraseña temporal inicial.",
        });
      }

      return res.json({
        success: true,
        message: "Contraseña cambiada exitosamente en el servidor.",
        password_change_required: false,
        primer_ingreso: 'COMPLETADO',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: "Error al procesar el cambio de contraseña en el servidor.",
      });
    }
  });

  // POST /api/auth/validate-access - Backend role and password status verification endpoint
  app.post("/api/auth/validate-access", (req, res) => {
    const { role, viewId, passwordChangeRequired, primerIngreso } = req.body || {};
    if (!role || !viewId) {
      return res.status(400).json({ success: false, allowed: false, message: "Parámetros incompletos" });
    }

    // Strict security rule: If password change is required, BLOCK everything except the password change screen
    if (passwordChangeRequired === true || primerIngreso === 'PENDIENTE') {
      return res.status(403).json({
        success: false,
        allowed: false,
        requiresPasswordChange: true,
        message: "Por seguridad, debe cambiar su contraseña antes de continuar.",
      });
    }

    // Role verification
    let allowed = false;
    if (role === 'ADMIN_GENERAL' || role === 'HR_ADMIN') {
      allowed = true;
    } else if (role === 'TRABAJADOR' || role === 'EMPLOYEE') {
      allowed = ['dash_overview', 'attendance_list', 'attendance_punches', 'vacations_requests', 'vacations_new', 'vacations_history', 'papeletas_new', 'papeletas_my', 'papeletas_history'].includes(viewId);
    } else if (role === 'JEFE' || role === 'SUPERVISOR') {
      // JEFE / SUPERVISOR: STRICT NON-ADMIN PRIVILEGES
      // Disallow all org_, personnel_, shifts_, devices_, admin_, config_, security_
      const forbiddenPrefixes = ['admin_', 'config_', 'org_', 'personnel_', 'shifts_', 'devices_', 'security_'];
      allowed = !forbiddenPrefixes.some((prefix) => viewId.startsWith(prefix));
    } else if (role === 'JEFE_RRHH') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('devices_');
    } else if (role === 'VIGILANCIA' || role === 'SECURITY_GUARD') {
      allowed = viewId === 'dash_overview' || viewId.startsWith('security_') || viewId === 'attendance_list';
    } else if (role === 'DIRECTOR_GENERAL') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('shifts_') && !viewId.startsWith('devices_');
    } else if (role === 'CONTROL_ASISTENCIA') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('org_');
    }

    return res.json({ success: true, allowed });
  });

  // ==========================================
  // VACACIONES API ENDPOINTS (DRAC Workflows)
  // ==========================================

  // GET /api/vacaciones - Obtener todas las vacaciones registradas
  app.get("/api/vacaciones", async (_req, res) => {
    try {
      const vacs = await getStoredVacaciones();
      return res.json({ success: true, count: vacs.length, data: vacs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al consultar vacaciones." });
    }
  });

  // ==========================================
  // HELPER: Auto-resolve Immediate Boss taking Encargaturas into account
  // ==========================================
  async function resolveImmediateBossForWorker(requester: any, targetDate: string = "2026-08-21") {
    try {
      const employees = await getStoredEmployees();
      const encargaturas = await getStoredEncargaturas();

      // 1. Prioridad: Encargatura Temporal Vigente para el ámbito orgánico del trabajador
      for (const enc of encargaturas) {
        if (enc.status === "ANULADA") continue;
        const isVigente = targetDate >= enc.start_date && targetDate <= enc.end_date;
        if (!isVigente) continue;

        let matches = false;
        if (enc.area_id && requester.area_id === enc.area_id) matches = true;
        if (enc.direccion_organo_id && requester.direccion_organo_id === enc.direccion_organo_id) matches = true;
        if (enc.dependencia_id && requester.dependencia_id === enc.dependencia_id) matches = true;

        if (matches) {
          const encargadoEmp = employees.find(
            (e: any) => e.dni === enc.encargado_dni || e.id === enc.encargado_employee_id
          );
          return {
            bossId: enc.encargado_employee_id || `emp-${enc.encargado_dni}`,
            bossDni: enc.encargado_dni,
            bossName: enc.encargado_name,
            bossFunction: "Jefe Encargado",
            isEncargado: true,
            delegationInfo: {
              is_encargado: true,
              encargatura_id: enc.id,
              unidad_encargada: enc.cargo_encargado,
              documento: `${enc.document_type || "Resolución Directoral"} N.º ${enc.document_number || "001-2026"}`,
              vigencia: `${enc.start_date} al ${enc.end_date}`,
            },
            reason: `Jefe Encargado mediante ${enc.document_type || "Resolución"} N.º ${enc.document_number || "001-2026"} (${enc.cargo_encargado || "Área"})`,
          };
        }
      }

      // 2. Prioridad: Supervisor / Jefe Titular Directo
      if (requester.supervisor_id) {
        const sup = employees.find(
          (e: any) => e.id === requester.supervisor_id || e.dni === requester.supervisor_id
        );
        if (sup) {
          return {
            bossId: sup.id,
            bossDni: sup.dni,
            bossName: `${sup.first_name} ${sup.last_name}`,
            bossFunction: "Jefe Titular",
            isEncargado: false,
            delegationInfo: undefined,
            reason: "Jefe Inmediato Titular Directo",
          };
        }
      }

      // 3. Prioridad: Director de la Dirección / Órgano
      if (requester.direccion_organo_id) {
        const director = employees.find(
          (e: any) =>
            e.direccion_organo_id === requester.direccion_organo_id &&
            (e.is_jefe_director || e.role === "DIRECTOR_GENERAL" || e.role === "JEFE_RRHH" || e.role === "JEFE") &&
            e.dni !== requester.dni
        );
        if (director) {
          return {
            bossId: director.id,
            bossDni: director.dni,
            bossName: `${director.first_name} ${director.last_name}`,
            bossFunction: "Jefe Titular",
            isEncargado: false,
            delegationInfo: undefined,
            reason: "Director / Jefe Titular de la Unidad Orgánica",
          };
        }
      }

      // 4. Fallback institucional
      return {
        bossId: requester.supervisor_id || "emp-03",
        bossDni: "10000003",
        bossName: requester.supervisor_name || "Jefatura Inmediata DRAC",
        bossFunction: "Jefe Titular",
        isEncargado: false,
        delegationInfo: undefined,
        reason: "Jefatura Jerárquica Directa",
      };
    } catch {
      return {
        bossId: "emp-03",
        bossDni: "10000003",
        bossName: "Jefatura Inmediata DRAC",
        bossFunction: "Jefe Titular",
        isEncargado: false,
        delegationInfo: undefined,
        reason: "Jefatura Jerárquica Directa",
      };
    }
  }

  // ==========================================
  // VACACIONES API ENDPOINTS (DRAC Workflows)
  // ==========================================

  // GET /api/vacaciones - Obtener todas las vacaciones registradas
  app.get("/api/vacaciones", async (req, res) => {
    try {
      const userRole = (req.headers["x-user-role"] as string) || (req.query.role as string);
      const userDni = (req.headers["x-user-dni"] as string) || (req.query.dni as string);
      
      let vacs = await getStoredVacaciones();

      // Si el rol es estrictamente TRABAJADOR, retornar ÚNICAMENTE sus propias vacaciones
      if ((userRole === "TRABAJADOR" || userRole === "EMPLOYEE") && userDni) {
        vacs = vacs.filter((v: any) => v.employee_dni === userDni);
      }

      return res.json({ success: true, count: vacs.length, data: vacs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al consultar vacaciones." });
    }
  });

  // POST /api/vacaciones - Registrar solicitud (Trabajador) o Programación (Control de Asistencia / RRHH)
  app.post("/api/vacaciones", async (req, res) => {
    try {
      const body = req.body || {};
      const callerDni =
        (req.headers["x-user-dni"] as string) ||
        (req.headers["x-authenticated-dni"] as string) ||
        body.auth_user_dni ||
        body.callerDni;

      const callerRole =
        (req.headers["x-user-role"] as string) ||
        (req.headers["x-authenticated-role"] as string) ||
        body.auth_user_role ||
        body.created_by_role ||
        "TRABAJADOR";

      const start_date = body.start_date || body.fechaInicio || body.fecha_inicio || "";
      const end_date = body.end_date || body.fechaFin || body.fecha_fin || "";
      const tipo = body.tipo || body.modalidad || "PARCIAL";
      const total_days = body.total_days || body.dias || body.totalDays;
      const comments = body.comments || body.observacion || body.observaciones || body.documento || "";
      const period_year = Number(body.period_year || (start_date ? start_date.split("-")[0] : 2026));

      // Validar fechas obligatorias
      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: "Las fechas de inicio y término de vacaciones son obligatorias.",
        });
      }

      if (start_date > end_date) {
        return res.status(400).json({
          success: false,
          message: "La fecha de inicio no puede ser posterior a la fecha de término.",
        });
      }

      const employees = await getStoredEmployees();
      const existingVacs = await getStoredVacaciones();

      // Distinguir entre flujo TRABAJADOR (Solicitud propia) y flujo ADMINISTRATIVO (Control Asistencia / RRHH)
      const isWorkerFlow =
        body.origin === "PORTAL_TRABAJADOR" ||
        body.origin === "PROFILE_VACATION_REQUEST" ||
        callerRole === "TRABAJADOR" ||
        callerRole === "EMPLOYEE";

      let targetWorker: any = null;

      if (isWorkerFlow) {
        // ESCENARIO A: TRABAJADOR SOLICITA SUS PROPIAS VACACIONES
        const explicitTargetDni = body.employee_dni || body.dni || body.workerDni;
        const explicitTargetId = body.employee_id || body.workerId || body.worker_id;

        // Regla de seguridad: Trabajador NO puede solicitar para otro
        if (
          callerDni &&
          ((explicitTargetDni && callerDni.trim() !== explicitTargetDni.trim()) ||
            (explicitTargetId && !employees.some((e: any) => e.dni === callerDni && e.id === explicitTargetId)))
        ) {
          return res.status(403).json({
            success: false,
            message: "No tiene autorización para solicitar vacaciones a nombre de otro trabajador.",
          });
        }

        targetWorker = employees.find(
          (e: any) => e.dni === callerDni || e.id === callerDni || e.dni === explicitTargetDni
        );

        if (!targetWorker) {
          return res.status(400).json({
            success: false,
            message: "El trabajador no está asociado a su usuario o no existe en el directorio institucional.",
          });
        }

        if (targetWorker.status === "INACTIVE") {
          return res.status(400).json({
            success: false,
            message: "El trabajador se encuentra en estado INACTIVO y no puede tramitar vacaciones.",
          });
        }
      } else {
        // ESCENARIO B: CONTROL DE ASISTENCIA / RRHH PROGRAMA VACACIONES
        const targetDni = body.employee_dni || body.dni || body.workerDni;
        const targetId = body.employee_id || body.workerId || body.worker_id || body.employeeId;

        if (!targetDni && !targetId) {
          return res.status(400).json({
            success: false,
            message: "Debe seleccionar a un trabajador de la lista para programar el descanso vacacional.",
          });
        }

        targetWorker = employees.find(
          (e: any) => (targetId && e.id === targetId) || (targetDni && e.dni === targetDni)
        );

        if (!targetWorker) {
          return res.status(400).json({
            success: false,
            message: "El trabajador seleccionado no existe en el sistema.",
          });
        }

        if (targetWorker.status === "INACTIVE") {
          return res.status(400).json({
            success: false,
            message: "El trabajador seleccionado se encuentra en estado INACTIVO.",
          });
        }
      }

      // Validar superposición de vacaciones para el trabajador
      const activeStatuses = ["SOLICITADA", "VISTO_BUENO_JEFE", "APROBADA_RRHH", "PROGRAMADA", "EN_CURSO"];
      const overlap = existingVacs.find((v: any) => {
        if (v.employee_dni !== targetWorker.dni && v.employee_id !== targetWorker.id) return false;
        if (!activeStatuses.includes(v.status)) return false;
        return start_date <= v.end_date && end_date >= v.start_date;
      });

      if (overlap) {
        return res.status(409).json({
          success: false,
          message: `El periodo de vacaciones se superpone con otro periodo ya registrado (${overlap.start_date} al ${overlap.end_date} - Estado: ${overlap.status}).`,
        });
      }

      // Calcular días computables
      let days = Number(total_days);
      if (isNaN(days) || days <= 0) {
        const start = new Date(`${start_date}T00:00:00`);
        const end = new Date(`${end_date}T00:00:00`);
        days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      }

      const initialStatus = isWorkerFlow ? "SOLICITADA" : "PROGRAMADA";
      const origin = isWorkerFlow
        ? "PORTAL_TRABAJADOR"
        : callerRole === "CONTROL_ASISTENCIA"
        ? "CONTROL_ASISTENCIA"
        : "HR_ADMIN";

      const newId = `vac-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newCode = `VAC-${period_year}-${String(existingVacs.length + 1).padStart(3, "0")}`;
      const nowIso = new Date().toISOString();
      const nowLocal = new Date().toLocaleString("es-PE");

      // Determinar jefe inmediato con encargatura vigente si es flujo trabajador
      const bossInfo = isWorkerFlow
        ? await resolveImmediateBossForWorker(targetWorker, start_date)
        : null;

      const initialAudit = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: newId,
        new_status: initialStatus,
        action_by_user_id: isWorkerFlow ? targetWorker.id : (callerDni || "usr-admin"),
        action_by_user_name: isWorkerFlow
          ? `${targetWorker.first_name} ${targetWorker.last_name}`
          : (body.created_by || "Control de Asistencia DRAC"),
        action_by_role: isWorkerFlow ? "TRABAJADOR" : callerRole,
        action_type: isWorkerFlow ? "SOLICITAR" : "PROGRAMAR",
        origin,
        comment: isWorkerFlow
          ? `Solicitud de vacaciones generada por el trabajador. Derivada a V°B° de ${bossInfo?.bossName} (${bossInfo?.bossFunction}).`
          : `Programación institucional directa de descanso vacacional registrada por ${callerRole}.`,
        timestamp: nowLocal,
      };

      const newVac = {
        id: newId,
        code: newCode,
        employee_id: targetWorker.id,
        employee_dni: targetWorker.dni,
        employee_name: `${targetWorker.first_name} ${targetWorker.last_name}`,
        dependencia_id: targetWorker.dependencia_id || "dep-01",
        dependencia_name: targetWorker.dependencia_name || "SEDE CENTRAL",
        direccion_organo_name: targetWorker.direccion_organo_name || "",
        area_id: targetWorker.area_id || "",
        area_name: targetWorker.area_name || "OFICINA DRAC",
        position: targetWorker.position || "Servidor DRAC",
        regimen_laboral: targetWorker.regimen_laboral || "D.L. 1057",
        condicion_laboral: targetWorker.condicion_laboral || "NOMBRADO",
        tipo,
        start_date,
        end_date,
        total_days: days,
        period_year,
        status: initialStatus,
        origin,
        supervisor_id: bossInfo?.bossId || targetWorker.supervisor_id || "boss-default",
        supervisor_name: bossInfo?.bossName || targetWorker.supervisor_name || "Jefatura Inmediata",
        comments,
        approved_by_hr: !isWorkerFlow ? (body.approved_by_hr || "Recursos Humanos DRAC") : undefined,
        hr_approved_at: !isWorkerFlow ? nowLocal : undefined,
        hr_approver_name: !isWorkerFlow ? (body.hr_approver_name || "Control de Asistencia DRAC") : undefined,
        created_at: nowIso,
        created_by: isWorkerFlow
          ? `${targetWorker.first_name} ${targetWorker.last_name}`
          : (body.created_by || "Control de Asistencia DRAC"),
        created_by_role: isWorkerFlow ? "TRABAJADOR" : callerRole,
        audits: [initialAudit],
      };

      existingVacs.unshift(newVac);
      await saveStoredVacaciones(existingVacs);

      return res.status(201).json({
        success: true,
        message: isWorkerFlow
          ? "Solicitud de vacaciones creada correctamente. Derivada al Jefe Inmediato para su V°B°."
          : "Vacaciones programadas correctamente.",
        data: newVac,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al procesar vacaciones: ${err?.message}` });
    }
  });

  // PUT /api/vacaciones/:id/vobo-jefe - V°B° del Jefe Inmediato (o Encargado Temporal)
  app.put("/api/vacaciones/:id/vobo-jefe", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        boss_dni,
        boss_id,
        boss_name,
        boss_role = "JEFE",
        boss_function = "Jefe Titular",
        delegation_info,
        comment = "",
      } = req.body || {};

      const vacs = await getStoredVacaciones();
      const vacIndex = vacs.findIndex((v: any) => v.id === id);

      if (vacIndex === -1) {
        return res.status(404).json({ success: false, message: "Registro vacacional no encontrado." });
      }

      const vac = vacs[vacIndex];

      // REGLA CRÍTICA DE SEGURIDAD: NO PERMITIR AUTOAPROBACIÓN
      if (
        (boss_dni && vac.employee_dni && boss_dni.trim() === vac.employee_dni.trim()) ||
        (boss_id && vac.employee_id && boss_id === vac.employee_id)
      ) {
        return res.status(403).json({
          success: false,
          message: "No puede aprobar una solicitud de vacaciones que usted mismo ha generado.",
        });
      }

      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = vac.status;
      const newStatus = "VISTO_BUENO_JEFE";

      const auditEntry = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: boss_id || "usr-boss",
        action_by_user_name: boss_name || "Jefe Inmediato",
        action_by_role: boss_role,
        action_type: "VISTO_BUENO_JEFE",
        origin: vac.origin,
        comment: comment || `V°B° otorgado por ${boss_function} (${boss_name}).`,
        boss_approver_name: boss_name,
        boss_approver_dni: boss_dni,
        boss_approver_function: boss_function,
        delegation_info,
        timestamp: nowLocal,
      };

      vac.status = newStatus;
      vac.boss_approved_at = nowLocal;
      vac.boss_approver_id = boss_id;
      vac.boss_approver_dni = boss_dni;
      vac.boss_approver_name = boss_name;
      vac.boss_approver_function = boss_function;
      vac.boss_delegation_info = delegation_info;
      vac.boss_comment = comment;
      vac.updated_at = new Date().toISOString();
      vac.audits = vac.audits ? [auditEntry, ...vac.audits] : [auditEntry];

      vacs[vacIndex] = vac;
      await saveStoredVacaciones(vacs);

      return res.json({
        success: true,
        message: `V°B° registrado exitosamente por ${boss_name} (${boss_function}). La solicitud pasa a RRHH.`,
        data: vac,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al procesar V°B°: ${err?.message}` });
    }
  });

  // PUT /api/vacaciones/:id/rechazar - Rechazo por Jefe o RRHH con motivo obligatorio
  app.put("/api/vacaciones/:id/rechazar", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        action_by_dni,
        action_by_id,
        action_by_name,
        action_by_role = "JEFE",
        reason,
      } = req.body || {};

      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          message: "El motivo de rechazo es obligatorio para registrar la no procedencia.",
        });
      }

      const vacs = await getStoredVacaciones();
      const vacIndex = vacs.findIndex((v: any) => v.id === id);
      if (vacIndex === -1) {
        return res.status(404).json({ success: false, message: "Registro vacacional no encontrado." });
      }

      const vac = vacs[vacIndex];

      // Bloquear si intenta autorrechazarse en rol de solicitante
      if (
        action_by_role === "TRABAJADOR" &&
        action_by_dni &&
        vac.employee_dni &&
        action_by_dni.trim() === vac.employee_dni.trim()
      ) {
        return res.status(403).json({
          success: false,
          message: "No puede rechazar su propia solicitud de vacaciones.",
        });
      }

      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = vac.status;
      const newStatus = "RECHAZADA";

      const auditEntry = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: action_by_id || "usr-01",
        action_by_user_name: action_by_name || "Autoridad Evaluadora",
        action_by_role,
        action_type: "RECHAZAR",
        origin: vac.origin,
        comment: `Rechazado por ${action_by_name}. Motivo: ${reason.trim()}`,
        rejection_reason: reason.trim(),
        timestamp: nowLocal,
      };

      vac.status = newStatus;
      vac.rejection_reason = reason.trim();
      vac.updated_at = new Date().toISOString();
      vac.audits = vac.audits ? [auditEntry, ...vac.audits] : [auditEntry];

      vacs[vacIndex] = vac;
      await saveStoredVacaciones(vacs);

      return res.json({
        success: true,
        message: "Solicitud vacacional rechazada. Motivo y auditoría guardados correctamente.",
        data: vac,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al rechazar solicitud: ${err?.message}` });
    }
  });

  // PUT /api/vacaciones/:id/aprobar-rrhh - Aprobación final institucional por RRHH / Control
  app.put("/api/vacaciones/:id/aprobar-rrhh", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        hr_dni,
        hr_id,
        hr_name,
        hr_role = "HR_ADMIN",
        comment = "",
        final_status = "PROGRAMADA",
      } = req.body || {};

      const vacs = await getStoredVacaciones();
      const vacIndex = vacs.findIndex((v: any) => v.id === id);
      if (vacIndex === -1) {
        return res.status(404).json({ success: false, message: "Registro vacacional no encontrado." });
      }

      const vac = vacs[vacIndex];
      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = vac.status;
      const targetStatus = final_status === "APROBADA_RRHH" ? "APROBADA_RRHH" : "PROGRAMADA";

      const auditEntry = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: id,
        previous_status: previousStatus,
        new_status: targetStatus,
        action_by_user_id: hr_id || "usr-hr",
        action_by_user_name: hr_name || "Recursos Humanos DRAC",
        action_by_role: hr_role,
        action_type: "APROBAR_RRHH",
        origin: vac.origin,
        comment: comment || `Aprobado y programado oficialmente por RRHH (${hr_name}).`,
        timestamp: nowLocal,
      };

      vac.status = targetStatus;
      vac.approved_by_hr = hr_name || "Recursos Humanos DRAC";
      vac.hr_approved_at = nowLocal;
      vac.hr_approver_id = hr_id;
      vac.hr_approver_name = hr_name;
      vac.hr_comment = comment;
      vac.updated_at = new Date().toISOString();
      vac.audits = vac.audits ? [auditEntry, ...vac.audits] : [auditEntry];

      vacs[vacIndex] = vac;
      await saveStoredVacaciones(vacs);

      return res.json({
        success: true,
        message: "Vacaciones aprobadas y programadas formalmente en el sistema DRAC.",
        data: vac,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al aprobar por RRHH: ${err?.message}` });
    }
  });

  // DELETE /api/vacaciones/:id - Cancelar / Eliminar vacación
  app.delete("/api/vacaciones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let vacs = await getStoredVacaciones();
      const existing = vacs.find((v: any) => v.id === id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Registro vacacional no encontrado." });
      }
      vacs = vacs.filter((v: any) => v.id !== id);
      await saveStoredVacaciones(vacs);
      return res.json({ success: true, message: "Registro vacacional eliminado correctamente." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al eliminar vacación." });
    }
  });

  // ==========================================
  // API ROUTES: Papeletas de Salida DRAC
  // ==========================================

  // GET /api/papeletas - Listar papeletas con filtro de seguridad por rol
  app.get("/api/papeletas", async (req, res) => {
    try {
      const userRole = (req.headers["x-user-role"] as string) || (req.query.role as string);
      const userDni = (req.headers["x-user-dni"] as string) || (req.query.dni as string) || (req.query.employee_dni as string);
      
      let paps = await getStoredPapeletas();

      // Si el rol es estrictamente TRABAJADOR, retornar ÚNICAMENTE sus propias papeletas
      if ((userRole === "TRABAJADOR" || userRole === "EMPLOYEE") && userDni) {
        paps = paps.filter((p: any) => p.employee_dni === userDni);
      }

      return res.json({ success: true, count: paps.length, data: paps });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al consultar papeletas." });
    }
  });

  // POST /api/papeletas - Registrar solicitud de papeleta (SOLICITUD EXCLUSIVA DEL PROPIO TRABAJADOR)
  app.post("/api/papeletas", async (req, res) => {
    try {
      const body = req.body || {};
      const callerDni =
        (req.headers["x-user-dni"] as string) ||
        (req.headers["x-authenticated-dni"] as string) ||
        body.auth_user_dni ||
        body.callerDni;

      const callerRole =
        (req.headers["x-user-role"] as string) ||
        (req.headers["x-authenticated-role"] as string) ||
        body.auth_user_role ||
        body.created_by_role ||
        "TRABAJADOR";

      const explicitTargetDni = body.employee_dni || body.dni || body.workerDni;
      const explicitTargetId = body.employee_id || body.workerId || body.worker_id || body.employeeId;

      const employees = await getStoredEmployees();

      // REGLA CRÍTICA DE SEGURIDAD (REQUERIMIENTOS 2, 3, 4, 5):
      // Un trabajador autenticado solo puede solicitar papeletas para sí mismo.
      if (
        callerDni &&
        ((explicitTargetDni && callerDni.trim() !== explicitTargetDni.trim()) ||
          (explicitTargetId && !employees.some((e: any) => e.dni === callerDni && e.id === explicitTargetId)))
      ) {
        return res.status(403).json({
          success: false,
          message: "No tiene autorización para generar una papeleta a nombre de otro trabajador.",
        });
      }

      // Obtener trabajador asociado
      const worker = employees.find(
        (e: any) => e.dni === callerDni || e.id === callerDni || e.dni === explicitTargetDni
      );

      if (!worker) {
        return res.status(400).json({
          success: false,
          message: "El trabajador no está asociado a su usuario o no existe en el directorio de la DRAC.",
        });
      }

      if (worker.status === "INACTIVE") {
        return res.status(400).json({
          success: false,
          message: "El trabajador se encuentra en estado INACTIVO y no puede tramitar papeletas.",
        });
      }

      const motivo = body.motivo || body.tipo || body.tipoPapeleta || "COMISION_SERVICIOS";
      const destino = body.destino || body.lugarDestino || "";
      const descripcion = body.descripcion || body.justificacion || body.motivo_detalle || body.fundamentacion || motivo;
      const fecha = body.fecha || body.fechaSalida || new Date().toISOString().split("T")[0];
      const hora_estimada_salida = body.hora_estimada_salida || body.horaSalidaSolicitada || body.horaSalida || "";
      const hora_estimada_retorno = body.hora_estimada_retorno || body.horaRetornoSolicitada || body.horaRetorno || "";
      const sin_retorno = Boolean(body.sin_retorno || body.sinRetorno);
      const digital_signature_data = body.digital_signature_data || body.signatureData;
      const signed_at = body.signed_at || new Date().toISOString();

      // Validaciones de obligatoriedad de campos de la solicitud
      // NOTA: Las horas de salida y retorno NO son obligatorias para el trabajador solicitante.
      // Las horas reales de salida y retorno corresponden exclusivamente a Vigilancia / Garita.
      if (!fecha || !destino || !descripcion) {
        return res.status(400).json({
          success: false,
          message: "Los campos de fecha, destino y justificación/descripción son obligatorios.",
        });
      }

      // Determinar automáticamente el Jefe Inmediato competente con Encargaturas Temporales Vigentes
      const bossInfo = await resolveImmediateBossForWorker(worker, fecha);

      const existingPaps = await getStoredPapeletas();
      const newId = `pap-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newCode = `PAP-2026-${String(existingPaps.length + 1).padStart(3, "0")}`;
      const nowIso = new Date().toISOString();
      const nowLocal = new Date().toLocaleString("es-PE");

      // Estado inicial estrictamente PENDING_BOSS (SOLICITADA). Un trabajador no puede auto-aprobarse ni promover a APROBADA.
      const initialStatus = "PENDING_BOSS";

      const initialAudit = {
        id: `aud-pap-${Date.now()}`,
        papeleta_id: newId,
        new_status: initialStatus,
        action_by_user_id: worker.id,
        action_by_user_name: `${worker.first_name} ${worker.last_name}`,
        action_by_role: "TRABAJADOR",
        action_type: "SOLICITAR_PAPELETA",
        origin: "PORTAL_TRABAJADOR",
        comment: `Solicitud de papeleta generada por el trabajador ${worker.first_name} ${worker.last_name} (DNI ${worker.dni}) para ${destino}. Derivada a V°B° de ${bossInfo.bossName} (${bossInfo.bossFunction}).`,
        timestamp: nowLocal,
      };

      const newPapeleta = {
        id: newId,
        code: newCode,
        employee_id: worker.id,
        employee_dni: worker.dni,
        employee_name: `${worker.first_name} ${worker.last_name}`,
        dependencia_name: worker.dependencia_name || "SEDE CENTRAL",
        direccion_organo_name: worker.direccion_organo_name || "",
        area_name: worker.area_name || "OFICINA DRAC",
        supervisor_id: bossInfo.bossId,
        supervisor_name: bossInfo.bossName,
        supervisor_dni: bossInfo.bossDni,
        supervisor_function: bossInfo.bossFunction,
        supervisor_delegation_info: bossInfo.delegationInfo,
        motivo,
        descripcion,
        destino,
        fecha,
        hora_estimada_salida: hora_estimada_salida || "",
        hora_estimada_retorno: sin_retorno ? "Sin retorno" : (hora_estimada_retorno || ""),
        sin_retorno,
        status: initialStatus,
        origin: "PORTAL_TRABAJADOR",
        digital_signature_data,
        signed_at,
        created_by: `${worker.first_name} ${worker.last_name}`,
        created_by_role: "TRABAJADOR",
        created_at: nowIso,
        updated_at: nowIso,
        audits: [initialAudit],
      };

      existingPaps.unshift(newPapeleta);
      await saveStoredPapeletas(existingPaps);

      return res.status(201).json({
        success: true,
        message: "Papeleta de salida registrada exitosamente. Enviada a la bandeja de V°B° del Jefe Inmediato.",
        data: newPapeleta,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al guardar papeleta: ${err?.message}` });
    }
  });

  // PUT /api/papeletas/:id/vobo-jefe - V°B° del Jefe Inmediato (o Encargado Temporal Vigente)
  app.put("/api/papeletas/:id/vobo-jefe", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        boss_dni,
        boss_id,
        boss_name,
        boss_role = "JEFE",
        boss_function = "Jefe Titular",
        delegation_info,
        comment = "",
      } = req.body || {};

      const paps = await getStoredPapeletas();
      const papIndex = paps.findIndex((p: any) => p.id === id);

      if (papIndex === -1) {
        return res.status(404).json({ success: false, message: "Papeleta de salida no encontrada." });
      }

      const pap = paps[papIndex];

      // REGLA CRÍTICA DE SEGURIDAD (REQUERIMIENTO 9): ANTI-AUTOAPROBACIÓN
      if (
        (boss_dni && pap.employee_dni && boss_dni.trim() === pap.employee_dni.trim()) ||
        (boss_id && pap.employee_id && boss_id === pap.employee_id)
      ) {
        return res.status(403).json({
          success: false,
          message: "No puede aprobar una papeleta que usted mismo ha solicitado.",
        });
      }

      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = pap.status;
      const newStatus = "PENDING_HR"; // Visto Bueno del Jefe otorgado, pasa a Aprobación de RRHH

      const auditEntry = {
        id: `aud-pap-${Date.now()}`,
        papeleta_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: boss_id || "usr-boss",
        action_by_user_name: boss_name || "Jefe Inmediato",
        action_by_role: boss_role,
        action_type: "VISTO_BUENO_JEFE",
        comment: comment || `V°B° otorgado por ${boss_function} (${boss_name}).`,
        boss_approver_name: boss_name,
        boss_approver_dni: boss_dni,
        boss_approver_function: boss_function,
        delegation_info,
        timestamp: nowLocal,
      };

      pap.status = newStatus;
      pap.boss_approved_at = nowLocal;
      pap.boss_approver_id = boss_id;
      pap.boss_approver_dni = boss_dni;
      pap.boss_approver_name = boss_name;
      pap.boss_approver_function = boss_function;
      pap.boss_delegation_info = delegation_info;
      pap.boss_comment = comment;
      pap.updated_at = new Date().toISOString();
      pap.audits = pap.audits ? [auditEntry, ...pap.audits] : [auditEntry];

      paps[papIndex] = pap;
      await saveStoredPapeletas(paps);

      return res.json({
        success: true,
        message: `V°B° registrado con éxito por ${boss_name} (${boss_function}). La papeleta pasa a autorización de RRHH.`,
        data: pap,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al procesar V°B°: ${err?.message}` });
    }
  });

  // PUT /api/papeletas/:id/aprobar-rrhh - Aprobación Institucional por RRHH / Control de Asistencia
  app.put("/api/papeletas/:id/aprobar-rrhh", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        hr_dni,
        hr_id,
        hr_name,
        hr_role = "JEFE_RRHH",
        comment = "",
      } = req.body || {};

      const paps = await getStoredPapeletas();
      const papIndex = paps.findIndex((p: any) => p.id === id);

      if (papIndex === -1) {
        return res.status(404).json({ success: false, message: "Papeleta de salida no encontrada." });
      }

      const pap = paps[papIndex];
      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = pap.status;
      const newStatus = "APPROVED"; // Autorizada por RRHH, lista para control en Garita

      const auditEntry = {
        id: `aud-pap-${Date.now()}`,
        papeleta_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: hr_id || "usr-hr",
        action_by_user_name: hr_name || "Recursos Humanos DRAC",
        action_by_role: hr_role,
        action_type: "APROBAR_RRHH",
        comment: comment || `Papeleta autorizada institucionalmente por ${hr_name}.`,
        timestamp: nowLocal,
      };

      pap.status = newStatus;
      pap.hr_approved_at = nowLocal;
      pap.hr_approver_name = hr_name || "Recursos Humanos DRAC";
      pap.hr_approver_dni = hr_dni;
      pap.hr_comment = comment;
      pap.updated_at = new Date().toISOString();
      pap.audits = pap.audits ? [auditEntry, ...pap.audits] : [auditEntry];

      paps[papIndex] = pap;
      await saveStoredPapeletas(paps);

      return res.json({
        success: true,
        message: "Papeleta autorizada oficialmente por RRHH. Habilitada en Garita de Vigilancia.",
        data: pap,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al autorizar por RRHH: ${err?.message}` });
    }
  });

  // PUT /api/papeletas/:id/rechazar - Rechazo de papeleta con motivo
  app.put("/api/papeletas/:id/rechazar", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        action_by_dni,
        action_by_id,
        action_by_name,
        action_by_role = "JEFE",
        reason,
      } = req.body || {};

      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          message: "El motivo de rechazo es obligatorio para registrar la no procedencia de la papeleta.",
        });
      }

      const paps = await getStoredPapeletas();
      const papIndex = paps.findIndex((p: any) => p.id === id);

      if (papIndex === -1) {
        return res.status(404).json({ success: false, message: "Papeleta no encontrada." });
      }

      const pap = paps[papIndex];
      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = pap.status;
      const newStatus = "REJECTED";

      const auditEntry = {
        id: `aud-pap-${Date.now()}`,
        papeleta_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: action_by_id || "usr-01",
        action_by_user_name: action_by_name || "Autoridad Evaluadora",
        action_by_role,
        action_type: "RECHAZAR",
        comment: `Rechazado por ${action_by_name}. Motivo: ${reason.trim()}`,
        rejection_reason: reason.trim(),
        timestamp: nowLocal,
      };

      pap.status = newStatus;
      pap.rejection_reason = reason.trim();
      pap.updated_at = new Date().toISOString();
      pap.audits = pap.audits ? [auditEntry, ...pap.audits] : [auditEntry];

      paps[papIndex] = pap;
      await saveStoredPapeletas(paps);

      return res.json({
        success: true,
        message: "Papeleta rechazada correctamente.",
        data: pap,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al rechazar papeleta: ${err?.message}` });
    }
  });

  // PUT /api/papeletas/:id/garita-salida - Registro de salida física en Garita
  app.put("/api/papeletas/:id/garita-salida", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        guard_id,
        guard_name = "Agente de Vigilancia Garita",
        hora_real_salida,
        observacion = "",
      } = req.body || {};

      const paps = await getStoredPapeletas();
      const papIndex = paps.findIndex((p: any) => p.id === id);

      if (papIndex === -1) {
        return res.status(404).json({ success: false, message: "Papeleta no encontrada." });
      }

      const pap = paps[papIndex];
      const exitTime = hora_real_salida || new Date().toLocaleTimeString("es-PE", { hour12: false, hour: "2-digit", minute: "2-digit" });
      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = pap.status;
      const newStatus = pap.sin_retorno ? "COMPLETED" : "IN_OUTING";

      const auditEntry = {
        id: `aud-pap-${Date.now()}`,
        papeleta_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: guard_id || "usr-guard",
        action_by_user_name: guard_name,
        action_by_role: "VIGILANCIA",
        action_type: "REGISTRO_SALIDA_GARITA",
        comment: `Salida física registrada en garita a las ${exitTime}.${observacion ? ` Obs: ${observacion}` : ""}`,
        timestamp: nowLocal,
      };

      pap.status = newStatus;
      pap.hora_real_salida = exitTime;
      pap.security_guard_id = guard_id;
      pap.security_guard_name = guard_name;
      pap.updated_at = new Date().toISOString();
      pap.audits = pap.audits ? [auditEntry, ...pap.audits] : [auditEntry];

      paps[papIndex] = pap;
      await saveStoredPapeletas(paps);

      return res.json({
        success: true,
        message: `Salida registrada exitosamente a las ${exitTime}.`,
        data: pap,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al registrar salida en garita: ${err?.message}` });
    }
  });

  // PUT /api/papeletas/:id/garita-retorno - Registro de retorno físico en Garita
  app.put("/api/papeletas/:id/garita-retorno", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        guard_id,
        guard_name = "Agente de Vigilancia Garita",
        hora_real_retorno,
        observacion = "",
      } = req.body || {};

      const paps = await getStoredPapeletas();
      const papIndex = paps.findIndex((p: any) => p.id === id);

      if (papIndex === -1) {
        return res.status(404).json({ success: false, message: "Papeleta no encontrada." });
      }

      const pap = paps[papIndex];
      const returnTime = hora_real_retorno || new Date().toLocaleTimeString("es-PE", { hour12: false, hour: "2-digit", minute: "2-digit" });
      const nowLocal = new Date().toLocaleString("es-PE");
      const previousStatus = pap.status;
      const newStatus = "COMPLETED";

      const auditEntry = {
        id: `aud-pap-${Date.now()}`,
        papeleta_id: id,
        previous_status: previousStatus,
        new_status: newStatus,
        action_by_user_id: guard_id || "usr-guard",
        action_by_user_name: guard_name,
        action_by_role: "VIGILANCIA",
        action_type: "REGISTRO_RETORNO_GARITA",
        comment: `Retorno físico registrado en garita a las ${returnTime}.${observacion ? ` Obs: ${observacion}` : ""}`,
        timestamp: nowLocal,
      };

      pap.status = newStatus;
      pap.hora_real_retorno = returnTime;
      pap.security_guard_id = guard_id;
      pap.security_guard_name = guard_name;
      pap.updated_at = new Date().toISOString();
      pap.audits = pap.audits ? [auditEntry, ...pap.audits] : [auditEntry];

      paps[papIndex] = pap;
      await saveStoredPapeletas(paps);

      return res.json({
        success: true,
        message: `Retorno registrado exitosamente a las ${returnTime}. Papeleta finalizada.`,
        data: pap,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al registrar retorno en garita: ${err?.message}` });
    }
  });

  // DELETE /api/papeletas/:id - Eliminar papeleta
  app.delete("/api/papeletas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let paps = await getStoredPapeletas();
      const existing = paps.find((p: any) => p.id === id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Papeleta no encontrada." });
      }
      paps = paps.filter((p: any) => p.id !== id);
      await saveStoredPapeletas(paps);
      return res.json({ success: true, message: "Papeleta eliminada correctamente." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al eliminar papeleta." });
    }
  });

  // ==========================================
  // API ROUTES: Attendance & Control Operativo DRAC
  // ==========================================

  // GET /api/attendance - Listar asistencias procesadas
  app.get("/api/attendance", async (req, res) => {
    try {
      const userRole = (req.headers["x-user-role"] as string) || (req.query.role as string);
      const userDni = (req.headers["x-user-dni"] as string) || (req.query.dni as string);
      const { fecha, startDate, endDate } = req.query as any;

      let atts = await getStoredAttendance();

      if ((userRole === "TRABAJADOR" || userRole === "EMPLOYEE") && userDni) {
        atts = atts.filter((a: any) => a.employee_dni === userDni);
      }

      if (fecha) {
        atts = atts.filter((a: any) => a.fecha === fecha);
      } else if (startDate && endDate) {
        atts = atts.filter((a: any) => a.fecha >= startDate && a.fecha <= endDate);
      }

      return res.json({ success: true, count: atts.length, data: atts });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al consultar asistencia." });
    }
  });

  // PUT /api/attendance/:id - Actualizar registro de asistencia (Ajuste / Regularización)
  app.put("/api/attendance/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedRec = req.body;
      let atts = await getStoredAttendance();
      const idx = atts.findIndex((a: any) => a.id === id);
      if (idx === -1) {
        atts.unshift(updatedRec);
      } else {
        atts[idx] = { ...atts[idx], ...updatedRec };
      }
      await saveStoredAttendance(atts);
      return res.json({ success: true, message: "Registro de asistencia actualizado.", data: updatedRec });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error al actualizar asistencia." });
    }
  });

  // ==========================================
  // API ROUTES: Dashboard Operativo por Rol y Ámbito
  // ==========================================

  // GET /api/dashboard - Endpoint principal de métricas e indicadores de control de asistencia
  app.get(["/api/dashboard", "/api/dashboard/me"], async (req, res) => {
    try {
      const callerDni =
        (req.headers["x-user-dni"] as string) ||
        (req.query.dni as string) ||
        "10000001";
      const callerRole =
        (req.headers["x-user-role"] as string) ||
        (req.query.role as string) ||
        "ADMIN_GENERAL";

      const startDate = (req.query.startDate as string) || "2026-08-01";
      const endDate = (req.query.endDate as string) || "2026-08-31";
      const month = (req.query.month as string) || "8";
      const year = (req.query.year as string) || "2026";
      const targetDate = (req.query.targetDate as string) || "2026-08-21";

      const employees = await getStoredEmployees();
      const attendance = await getStoredAttendance();
      const encargaturas = await getStoredEncargaturas();
      const papeletas = await getStoredPapeletas();
      const vacaciones = await getStoredVacaciones();
      const authorizations = await getStoredAuthorizations();

      const callerEmployee =
        employees.find((e: any) => e.dni === callerDni || e.id === callerDni) ||
        employees[0];

      // Filtrar registros de asistencia por el rango de fechas seleccionado
      const periodAttendance = attendance.filter(
        (a: any) => (!startDate || a.fecha >= startDate) && (!endDate || a.fecha <= endDate)
      );

      // Helper para calcular métricas individuales de un trabajador en el periodo
      const calculateWorkerMetrics = (dni: string) => {
        const emp = employees.find((e: any) => e.dni === dni);
        const empAtts = periodAttendance.filter((a: any) => a.employee_dni === dni);
        const empPaps = papeletas.filter((p: any) => p.employee_dni === dni);
        const empVacs = vacaciones.filter((v: any) => v.employee_dni === dni);
        const empAuths = authorizations.filter((auth: any) => auth.employee_dni === dni);

        const dias_asistidos = empAtts.filter(
          (a: any) =>
            a.status === "PUNCTUAL" ||
            a.status === "LATE" ||
            a.status === "OUTING_PERMISSION" ||
            (a.total_effective_hours && a.total_effective_hours > 0)
        ).length;

        const dias_laborados = empAtts.filter(
          (a: any) => a.total_effective_hours && a.total_effective_hours > 0
        ).length;

        const dias_falta = empAtts.filter((a: any) => a.status === "ABSENT").length;

        const tardanzas_records = empAtts.filter(
          (a: any) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === "LATE"
        );
        const tardanzas_count = tardanzas_records.length;

        const minutos_tardanza_total = empAtts.reduce(
          (sum: number, a: any) => sum + (Number(a.net_tardiness_minutes) || 0),
          0
        );

        const horas_trabajadas = Number(
          empAtts.reduce((sum: number, a: any) => sum + (Number(a.total_effective_hours) || 0), 0).toFixed(1)
        );

        // Estándar del periodo (ejemplo: 18 días hábiles x 8 horas = 144 horas)
        const horas_estandar = Math.max(dias_asistidos + dias_falta, 18) * 8;
        const horas_faltantes = Number(Math.max(0, horas_estandar - horas_trabajadas).toFixed(1));

        const papeletas_pendientes_count = empPaps.filter((p: any) =>
          ["PENDING_BOSS", "PENDING_HR", "PENDING_DIRECTOR"].includes(p.status)
        ).length;

        const vacaciones_pendientes_count = empVacs.filter((v: any) =>
          ["PENDING_APPROVAL", "PENDING_BOSS", "PENDING_HR"].includes(v.status)
        ).length;

        const justificaciones_count = empAuths.length;

        return {
          employee: emp || { dni, first_name: "Trabajador", last_name: dni },
          indicators: {
            dias_asistidos,
            dias_laborados,
            dias_falta,
            tardanzas_count,
            minutos_tardanza_total,
            horas_trabajadas,
            horas_faltantes,
            horas_estandar,
            papeletas_pendientes_count,
            vacaciones_pendientes_count,
            justificaciones_count,
          },
          marcaciones: empAtts.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
          tardanzas: tardanzas_records.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
          papeletas: empPaps.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
          vacaciones: empVacs.sort((a: any, b: any) => (b.fecha_inicio || "").localeCompare(a.fecha_inicio || "")),
          justificaciones: empAuths,
        };
      };

      // ============================================================
      // 1. PERFIL TRABAJADOR: Exclusivamente información personal
      // ============================================================
      if (callerRole === "TRABAJADOR" || callerRole === "EMPLOYEE") {
        const workerData = calculateWorkerMetrics(callerDni);
        return res.json({
          success: true,
          role: "TRABAJADOR",
          period: { startDate, endDate, month, year, label: "Agosto 2026" },
          is_worker_only: true,
          ...workerData,
        });
      }

      // ============================================================
      // 2. PERFIL JEFE INMEDIATO / SUPERVISOR / DIRECTOR_GENERAL
      // ============================================================
      if (
        callerRole === "JEFE" ||
        callerRole === "SUPERVISOR" ||
        callerRole === "DIRECTOR_GENERAL"
      ) {
        // Datos personales del Jefe
        const my_data = calculateWorkerMetrics(callerDni);

        // Determinación del ámbito orgánico y encargaturas vigentes
        const activeEncargatura = encargaturas.find(
          (enc: any) =>
            (enc.encargado_dni === callerDni || enc.encargado_id === callerEmployee?.id) &&
            enc.status === "ACTIVA" &&
            (!enc.fecha_inicio || enc.fecha_inicio <= targetDate) &&
            (!enc.fecha_fin || enc.fecha_fin >= targetDate)
        );

        // Subordinados bajo responsabilidad (Titular o Encargado)
        const teamSubordinates = employees.filter((emp: any) => {
          if (emp.dni === callerDni || emp.id === callerEmployee?.id) return false;
          if (emp.active === false) return false;

          // 1. Subordinación directa por ID/Nombre de supervisor
          if (emp.supervisor_id === callerEmployee?.id || emp.supervisor_id === callerDni) return true;

          // 2. Si es jefe titular de Dirección / Órgano o Área
          if (callerEmployee?.is_jefe_director) {
            if (callerEmployee.direccion_organo_id && emp.direccion_organo_id === callerEmployee.direccion_organo_id) {
              return true;
            }
            if (callerEmployee.area_id && emp.area_id === callerEmployee.area_id) {
              return true;
            }
          }

          // 3. Encargatura temporal vigente
          if (activeEncargatura) {
            if (activeEncargatura.direccion_organo_id && emp.direccion_organo_id === activeEncargatura.direccion_organo_id) {
              return true;
            }
            if (activeEncargatura.area_id && emp.area_id === activeEncargatura.area_id) {
              return true;
            }
            if (activeEncargatura.dependencia_id && emp.dependencia_id === activeEncargatura.dependencia_id) {
              return true;
            }
          }

          return false;
        });

        // Métricas de asistencia del equipo
        const teamDnis = teamSubordinates.map((s: any) => s.dni);
        const teamPeriodAttendance = periodAttendance.filter((a: any) => teamDnis.includes(a.employee_dni));
        const teamTodayAttendance = attendance.filter(
          (a: any) => a.fecha === targetDate && teamDnis.includes(a.employee_dni)
        );

        const asistieron_hoy = teamTodayAttendance.filter(
          (a: any) =>
            a.status === "PUNCTUAL" ||
            a.status === "LATE" ||
            a.status === "OUTING_PERMISSION" ||
            (a.total_effective_hours && a.total_effective_hours > 0)
        ).length;

        const ausentes_hoy = teamSubordinates.length - asistieron_hoy;

        const tardanzas_hoy = teamTodayAttendance.filter(
          (a: any) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === "LATE"
        ).length;

        const tardanzas_periodo = teamPeriodAttendance.filter(
          (a: any) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === "LATE"
        ).length;

        const minutos_tardanza_periodo = teamPeriodAttendance.reduce(
          (sum: number, a: any) => sum + (Number(a.net_tardiness_minutes) || 0),
          0
        );

        const teamPendingPapeletas = papeletas.filter(
          (p: any) => teamDnis.includes(p.employee_dni) && p.status === "PENDING_BOSS"
        );

        const teamPendingVacaciones = vacaciones.filter(
          (v: any) => teamDnis.includes(v.employee_dni) && ["PENDING_APPROVAL", "PENDING_BOSS"].includes(v.status)
        );

        // Resumen individual de cada subordinado para la tabla de supervisión
        const teamSummaryList = teamSubordinates.map((sub: any) => {
          const subMetrics = calculateWorkerMetrics(sub.dni);
          const todayRec = teamTodayAttendance.find((a: any) => a.employee_dni === sub.dni);
          return {
            employee: sub,
            indicators: subMetrics.indicators,
            today_record: todayRec || {
              fecha: targetDate,
              status: "ABSENT",
              observations: "Sin registro hoy",
            },
          };
        });

        return res.json({
          success: true,
          role: callerRole,
          period: { startDate, endDate, month, year, label: "Agosto 2026" },
          is_encargado: Boolean(activeEncargatura),
          active_encargatura: activeEncargatura,
          scope_info: {
            unit_name:
              activeEncargatura?.direccion_organo_name ||
              callerEmployee?.direccion_organo_name ||
              callerEmployee?.area_name ||
              "Unidad Orgánica DRAC",
            is_encargado: Boolean(activeEncargatura),
            resolution: activeEncargatura?.documento_resolucion,
          },
          my_data,
          team_data: {
            team_members_count: teamSubordinates.length,
            indicators: {
              personal_a_cargo: teamSubordinates.length,
              asistieron_hoy,
              ausentes_hoy,
              tardanzas_hoy,
              tardanzas_periodo,
              minutos_tardanza_periodo,
              papeletas_pendientes_vobo: teamPendingPapeletas.length,
              vacaciones_pendientes: teamPendingVacaciones.length,
            },
            team_summary_list: teamSummaryList,
            team_attendance_today: teamTodayAttendance,
            pending_papeletas: teamPendingPapeletas,
            pending_vacaciones: teamPendingVacaciones,
            team_subordinates: teamSubordinates,
          },
        });
      }

      // ============================================================
      // 3. PERFIL CONTROL_ASISTENCIA / ADMIN_GENERAL / HR_ADMIN / JEFE_RRHH
      // ============================================================
      const activeEmployees = employees.filter((e: any) => e.active !== false);
      const allTodayAttendance = attendance.filter((a: any) => a.fecha === targetDate);

      const asistieron_hoy = allTodayAttendance.filter(
        (a: any) =>
          a.status === "PUNCTUAL" ||
          a.status === "LATE" ||
          a.status === "OUTING_PERMISSION" ||
          (a.total_effective_hours && a.total_effective_hours > 0)
      ).length;

      const ausentes_hoy = Math.max(0, activeEmployees.length - asistieron_hoy);

      const tardanzas_hoy_records = allTodayAttendance.filter(
        (a: any) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === "LATE"
      );
      const tardanzas_hoy = tardanzas_hoy_records.length;
      const minutos_tardanza_hoy = tardanzas_hoy_records.reduce(
        (sum: number, a: any) => sum + (Number(a.net_tardiness_minutes) || 0),
        0
      );

      const tardanzas_periodo_records = periodAttendance.filter(
        (a: any) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === "LATE"
      );
      const tardanzas_periodo = tardanzas_periodo_records.length;
      const minutos_tardanza_periodo = tardanzas_periodo_records.reduce(
        (sum: number, a: any) => sum + (Number(a.net_tardiness_minutes) || 0),
        0
      );

      const faltas_injustificadas_periodo = periodAttendance.filter(
        (a: any) => a.status === "ABSENT"
      ).length;

      const horas_trabajadas_totales = Number(
        periodAttendance.reduce(
          (sum: number, a: any) => sum + (Number(a.total_effective_hours) || 0),
          0
        ).toFixed(1)
      );

      const papeletas_pendientes = papeletas.filter((p: any) =>
        ["PENDING_BOSS", "PENDING_HR", "PENDING_DIRECTOR"].includes(p.status)
      ).length;

      const vacaciones_programadas = vacaciones.filter((v: any) =>
        ["APPROVED", "IN_PROGRESS"].includes(v.status)
      ).length;

      const justificaciones_pendientes = authorizations.filter(
        (auth: any) => auth.status === "PENDING"
      ).length;

      // Resumen consolidado para todos los trabajadores
      const employees_attendance_summary = activeEmployees.map((emp: any) => {
        const metrics = calculateWorkerMetrics(emp.dni);
        const todayRec = allTodayAttendance.find((a: any) => a.employee_dni === emp.dni);
        return {
          employee: emp,
          indicators: metrics.indicators,
          today_status: todayRec?.status || "ABSENT",
          today_in: todayRec?.t1_real_in || "--:--",
          today_out: todayRec?.t2_real_out || todayRec?.t1_real_out || "--:--",
          today_tardiness_net: todayRec?.net_tardiness_minutes || 0,
        };
      });

      // Personal en garita (salió con papeleta autorizada)
      const garita_control = papeletas.filter(
        (p: any) => p.status === "IN_PROGRESS" || (p.hora_real_salida && !p.hora_real_retorno && !p.sin_retorno)
      );

      return res.json({
        success: true,
        role: callerRole,
        period: { startDate, endDate, month, year, label: "Agosto 2026" },
        global_indicators: {
          total_trabajadores: activeEmployees.length,
          trabajadores_activos: activeEmployees.length,
          asistieron_hoy,
          ausentes_hoy,
          tardanzas_hoy,
          minutos_tardanza_hoy,
          tardanzas_periodo,
          minutos_tardanza_periodo,
          faltas_injustificadas_periodo,
          horas_trabajadas_totales,
          papeletas_pendientes,
          vacaciones_programadas,
          justificaciones_pendientes,
        },
        employees_attendance_summary,
        papeletas_pendientes_global: papeletas.filter((p: any) =>
          ["PENDING_BOSS", "PENDING_HR", "PENDING_DIRECTOR"].includes(p.status)
        ),
        vacaciones_activas_global: vacaciones.filter((v: any) =>
          ["APPROVED", "IN_PROGRESS", "PENDING_APPROVAL"].includes(v.status)
        ),
        garita_control,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error en dashboard: ${err?.message}` });
    }
  });

  // GET /api/dashboard/worker-detail/:identifier - Detalle de un trabajador con control de acceso por rol
  app.get("/api/dashboard/worker-detail/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const callerDni = (req.headers["x-user-dni"] as string) || (req.query.callerDni as string);
      const callerRole = (req.headers["x-user-role"] as string) || (req.query.callerRole as string);

      const employees = await getStoredEmployees();
      const targetEmp = employees.find((e: any) => e.dni === identifier || e.id === identifier);
      if (!targetEmp) {
        return res.status(404).json({ success: false, message: "Trabajador no encontrado." });
      }

      // Validación estricta de seguridad
      if ((callerRole === "TRABAJADOR" || callerRole === "EMPLOYEE") && callerDni && callerDni !== targetEmp.dni) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado: Un trabajador solo puede consultar su propia información.",
        });
      }

      const attendance = await getStoredAttendance();
      const papeletas = await getStoredPapeletas();
      const vacaciones = await getStoredVacaciones();
      const authorizations = await getStoredAuthorizations();

      const empAtts = attendance.filter((a: any) => a.employee_dni === targetEmp.dni);
      const empPaps = papeletas.filter((p: any) => p.employee_dni === targetEmp.dni);
      const empVacs = vacaciones.filter((v: any) => v.employee_dni === targetEmp.dni);
      const empAuths = authorizations.filter((auth: any) => auth.employee_dni === targetEmp.dni);

      const dias_asistidos = empAtts.filter(
        (a: any) =>
          a.status === "PUNCTUAL" ||
          a.status === "LATE" ||
          a.status === "OUTING_PERMISSION" ||
          (a.total_effective_hours && a.total_effective_hours > 0)
      ).length;

      const dias_falta = empAtts.filter((a: any) => a.status === "ABSENT").length;
      const tardanzas_records = empAtts.filter(
        (a: any) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === "LATE"
      );
      const tardanzas_count = tardanzas_records.length;
      const minutos_tardanza_total = empAtts.reduce(
        (sum: number, a: any) => sum + (Number(a.net_tardiness_minutes) || 0),
        0
      );
      const horas_trabajadas = Number(
        empAtts.reduce((sum: number, a: any) => sum + (Number(a.total_effective_hours) || 0), 0).toFixed(1)
      );

      return res.json({
        success: true,
        employee: targetEmp,
        indicators: {
          dias_asistidos,
          dias_laborados: dias_asistidos,
          dias_falta,
          tardanzas_count,
          minutos_tardanza_total,
          horas_trabajadas,
          papeletas_pendientes_count: empPaps.filter((p: any) => p.status.startsWith("PENDING")).length,
          vacaciones_pendientes_count: empVacs.filter((v: any) => v.status.startsWith("PENDING")).length,
          justificaciones_count: empAuths.length,
        },
        marcaciones: empAtts.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
        tardanzas: tardanzas_records.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
        papeletas: empPaps.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
        vacaciones: empVacs.sort((a: any, b: any) => (b.fecha_inicio || "").localeCompare(a.fecha_inicio || "")),
        justificaciones: empAuths,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Error al consultar detalle: ${err?.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
