import express from "express";
import path from "path";
import net from "node:net";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS & JSON middleware for API
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
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
