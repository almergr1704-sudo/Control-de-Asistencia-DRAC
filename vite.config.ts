import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'node:net';
import { defineConfig, Plugin } from 'vite';

function zktecoApiPlugin(): Plugin {
  return {
    name: 'zkteco-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/zkteco/test-connection', (req, res) => {
        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            let parsedBody: any = {};
            try {
              parsedBody = JSON.parse(bodyStr || '{}');
            } catch {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  success: false,
                  status: 'OFFLINE',
                  message: 'Conexión fallida',
                  cause: 'Cuerpo de solicitud no es un JSON válido.',
                  timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                })
              );
            }

            const { ip, port, timeoutMs = 4000 } = parsedBody;

            if (!ip || !port) {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  success: false,
                  status: 'OFFLINE',
                  message: 'Conexión fallida',
                  cause: 'Dirección IP o puerto no especificados.',
                  timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                })
              );
            }

            const targetPort = Number(port);
            if (isNaN(targetPort) || targetPort <= 0 || targetPort > 65535) {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  success: false,
                  status: 'OFFLINE',
                  message: 'Conexión fallida',
                  cause: 'Puerto incorrecto o fuera de rango (1-65535).',
                  timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                })
              );
            }

            const cleanIp = String(ip).trim();
            const isLocalOrPrivate =
              cleanIp.startsWith('192.168.') ||
              cleanIp.startsWith('10.') ||
              cleanIp.startsWith('127.') ||
              cleanIp === 'localhost' ||
              /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);

            const startTime = Date.now();
            const socket = new net.Socket();
            let handled = false;

            socket.setTimeout(timeoutMs);

            socket.on('connect', () => {
              if (handled) return;
              handled = true;
              const latency = Date.now() - startTime;
              socket.destroy();

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  status: 'ONLINE',
                  message: `Conexión exitosa. El marcador ZKTeco responde correctamente en ${cleanIp}:${targetPort}.`,
                  latency_ms: latency,
                  ip: cleanIp,
                  port: targetPort,
                  timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                })
              );
            });

            socket.on('timeout', () => {
              if (handled) return;
              handled = true;
              socket.destroy();

              res.statusCode = 200;
              let cause = `Tiempo de espera agotado (${timeoutMs}ms). El dispositivo no responde o está apagado.`;
              if (isLocalOrPrivate) {
                cause += ` Nota: La IP ${cleanIp} es privada (LAN). En entornos en la nube, configure el marcador en modo ADMS Cloud Push hacia este servidor o utilice VPN/túnel de red.`;
              }
              return res.end(
                JSON.stringify({
                  success: false,
                  status: 'OFFLINE',
                  message: 'Conexión fallida por tiempo de espera',
                  cause,
                  ip: cleanIp,
                  port: targetPort,
                  is_private_ip: isLocalOrPrivate,
                  timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                })
              );
            });

            socket.on('error', (err: any) => {
              if (handled) return;
              handled = true;
              socket.destroy();

              res.statusCode = 200;
              let cause = 'Error de comunicación de red.';
              if (err.code === 'ECONNREFUSED') {
                cause = `Conexión rechazada. La IP ${cleanIp} responde pero el puerto ${targetPort} no está abierto o el servicio ZKTeco está detenido.`;
              } else if (err.code === 'ENETUNREACH' || err.code === 'EHOSTUNREACH') {
                cause = `Dispositivo no alcanzable en la red. Verifique la IP ${cleanIp}, la subred física o conexión del cable de red.`;
                if (isLocalOrPrivate) {
                  cause += ` Para marcadores en red local (LAN), configure en el equipo: Menú > Comunicación > Servidor Cloud/ADMS.`;
                }
              } else if (err.message) {
                cause = err.message;
              }

              return res.end(
                JSON.stringify({
                  success: false,
                  status: 'OFFLINE',
                  message: 'Conexión fallida',
                  cause,
                  ip: cleanIp,
                  port: targetPort,
                  is_private_ip: isLocalOrPrivate,
                  timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                })
              );
            });

            try {
              socket.connect(targetPort, cleanIp);
            } catch (e: any) {
              if (!handled) {
                handled = true;
                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: false,
                    status: 'OFFLINE',
                    message: 'Error al inicializar socket',
                    cause: e.message || 'No se pudo conectar el socket TCP.',
                    ip: cleanIp,
                    port: targetPort,
                    timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                  })
                );
              }
            }
          });
        } else {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), zktecoApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
