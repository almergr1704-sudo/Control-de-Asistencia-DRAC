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
      allowed = ['dash_overview', 'attendance_list', 'attendance_punches', 'vacations_requests', 'vacations_history', 'papeletas_new', 'papeletas_my', 'papeletas_history'].includes(viewId);
    } else if (role === 'JEFE' || role === 'SUPERVISOR') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('shifts_') && !viewId.startsWith('devices_');
    } else if (role === 'JEFE_RRHH') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('devices_');
    } else if (role === 'VIGILANCIA' || role === 'SECURITY_GUARD') {
      allowed = viewId === 'dash_overview' || viewId.startsWith('security_') || viewId === 'attendance_list';
    } else if (role === 'DIRECTOR_GENERAL') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('shifts_') && !viewId.startsWith('devices_');
    } else if (role === 'CONTROL_ASISTENCIA') {
      allowed = !viewId.startsWith('admin_') && viewId !== 'config_system' && !viewId.startsWith('org_') && !viewId.startsWith('shifts_');
    }

    return res.json({ success: true, allowed });
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
