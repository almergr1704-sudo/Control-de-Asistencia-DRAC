import express from "express";
import path from "path";
import net from "node:net";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTE: ZKTeco Real TCP Socket Connection Test
  app.post("/api/zkteco/test-connection", (req, res) => {
    const { ip, port, timeoutMs = 4000 } = req.body || {};

    if (!ip || !port) {
      return res.status(400).json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: "Dirección IP o puerto no especificados.",
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
      });
    }

    const targetPort = Number(port);
    if (isNaN(targetPort) || targetPort <= 0 || targetPort > 65535) {
      return res.status(400).json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: "Puerto incorrecto o fuera de rango (1-65535).",
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
      });
    }

    // IP Format Validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip.trim())) {
      return res.json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: `Dirección IP '${ip}' con formato sintáctico incorrecto.`,
        ip,
        port: targetPort,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
      });
    }

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
        message: "Conexión exitosa. El marcador ZKTeco responde correctamente y se encuentra disponible.",
        latency_ms: latency,
        ip: ip.trim(),
        port: targetPort,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
      });
    });

    socket.on("timeout", () => {
      if (handled) return;
      handled = true;
      socket.destroy();

      return res.json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause: `Tiempo de espera agotado (${timeoutMs}ms). El dispositivo no responde en la red o está apagado.`,
        ip: ip.trim(),
        port: targetPort,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
      });
    });

    socket.on("error", (err: any) => {
      if (handled) return;
      handled = true;
      socket.destroy();

      let cause = "Error de comunicación de red.";
      if (err.code === "ECONNREFUSED") {
        cause = `Conexión rechazada. La IP ${ip} responde pero el puerto ${targetPort} no está abierto o el servicio ZK está detenido.`;
      } else if (err.code === "ENETUNREACH" || err.code === "EHOSTUNREACH") {
        cause = `Dispositivo no disponible en la red. Verifique la IP ${ip}, la subred o la conexión física.`;
      } else if (err.code === "EINVAL") {
        cause = "Dirección IP o puerto con parámetros inválidos.";
      } else if (err.message) {
        cause = err.message;
      }

      return res.json({
        success: false,
        status: "OFFLINE",
        message: "Conexión fallida",
        cause,
        ip: ip.trim(),
        port: targetPort,
        timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
      });
    });

    try {
      socket.connect(targetPort, ip.trim());
    } catch (e: any) {
      if (!handled) {
        handled = true;
        return res.json({
          success: false,
          status: "OFFLINE",
          message: "Conexión fallida",
          cause: e.message || "Error al inicializar el socket TCP.",
          ip: ip.trim(),
          port: targetPort,
          timestamp: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
