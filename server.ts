import express from "express";
import path from "path";
import fs from "fs/promises";
import net from "node:net";
import { createServer as createViteServer } from "vite";

const DB_DIR = path.join(process.cwd(), "data");
const DEVICES_FILE = path.join(DB_DIR, "devices.json");
const AUTH_FILE = path.join(DB_DIR, "punch-authorizations.json");

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
