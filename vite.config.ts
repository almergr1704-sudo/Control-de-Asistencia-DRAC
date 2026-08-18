import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'node:net';
import fs from 'node:fs/promises';
import { defineConfig, Plugin } from 'vite';

const DB_DIR = path.join(process.cwd(), 'data');
const DEVICES_FILE = path.join(DB_DIR, 'devices.json');
const AUTH_FILE = path.join(DB_DIR, 'punch-authorizations.json');

async function getStoredDevices(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(DEVICES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveStoredDevices(devices: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf-8');
}

async function getStoredAuthorizations(): Promise<any[]> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(AUTH_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveStoredAuthorizations(auths: any[]): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(AUTH_FILE, JSON.stringify(auths, null, 2), 'utf-8');
}

function zktecoApiPlugin(): Plugin {
  return {
    name: 'zkteco-api-plugin',
    configureServer(server) {
      // 1. ZKTeco TCP Socket Connection Test
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

      // 2. /api/devices API Route (GET, POST, PUT, DELETE)
      server.middlewares.use('/api/devices', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const url = req.url || '/';

        try {
          if (req.method === 'GET') {
            const devices = await getStoredDevices();
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, data: devices }));
          }

          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', async () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const {
                  name,
                  serial_number,
                  brand = 'ZKTeco',
                  model = 'G3-id',
                  ip_address,
                  port = 4370,
                  protocol = 'PUSH_ADMS',
                  dependencia_id,
                  dependencia_name,
                  dependencia_tipo,
                  location_detail,
                  status = 'CONFIGURED',
                  firmware_version = 'Ver 8.0.4.3-2026',
                  last_test,
                } = body;

                if (!name || !String(name).trim()) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, message: 'El nombre o identificador del marcador es obligatorio.' }));
                }

                if (!serial_number || !String(serial_number).trim()) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, message: 'El número de serie (S/N) del marcador es obligatorio.' }));
                }

                const cleanDepTipo = dependencia_tipo || (dependencia_id === 'dep-02' || String(dependencia_name).toUpperCase().includes('AGENCIA') ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL');
                const cleanDepName = cleanDepTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';
                const cleanDepId = cleanDepTipo === 'AGENCIA_AGRARIA' ? (dependencia_id || 'dep-02') : (dependencia_id || 'dep-01');

                if (!dependencia_id && !dependencia_name && !dependencia_tipo) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, message: "La dependencia del marcador es obligatoria. Seleccione 'SEDE CENTRAL' o 'AGENCIA AGRARIA'." }));
                }

                if (!ip_address || !String(ip_address).trim()) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, message: 'La dirección IP del marcador es obligatoria.' }));
                }

                const cleanPort = Number(port);
                if (isNaN(cleanPort) || cleanPort <= 0 || cleanPort > 65535) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, message: 'El puerto de comunicación debe ser un número válido entre 1 y 65535.' }));
                }

                if (!location_detail || !String(location_detail).trim()) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, message: 'La ubicación física del marcador es obligatoria.' }));
                }

                const cleanSn = String(serial_number).trim().toUpperCase();
                const cleanName = String(name).trim();
                const cleanIp = String(ip_address).trim();

                const existingDevices = await getStoredDevices();

                const dupSn = existingDevices.find((d: any) => d.serial_number && d.serial_number.toUpperCase() === cleanSn);
                if (dupSn) {
                  res.statusCode = 409;
                  return res.end(JSON.stringify({ success: false, message: `Ya existe un marcador registrado con el número de serie '${cleanSn}'.` }));
                }

                const dupName = existingDevices.find((d: any) => d.name && d.name.toLowerCase() === cleanName.toLowerCase());
                if (dupName) {
                  res.statusCode = 409;
                  return res.end(JSON.stringify({ success: false, message: `Ya existe un marcador con el nombre '${cleanName}'.` }));
                }

                const dupIp = existingDevices.find((d: any) => d.ip_address === cleanIp && Number(d.port) === cleanPort);
                if (dupIp) {
                  res.statusCode = 409;
                  return res.end(JSON.stringify({ success: false, message: `La dirección IP '${cleanIp}' con puerto ${cleanPort} ya está asignada al marcador '${dupIp.name}'.` }));
                }

                const newDevice = {
                  id: `dev-${Date.now()}`,
                  serial_number: cleanSn,
                  name: cleanName,
                  brand: String(brand).trim(),
                  model: String(model).trim(),
                  ip_address: cleanIp,
                  port: cleanPort,
                  protocol: protocol || 'PUSH_ADMS',
                  dependencia_tipo: cleanDepTipo,
                  dependencia_id: cleanDepId,
                  dependencia_name: cleanDepName,
                  location_detail: String(location_detail).trim(),
                  last_activity: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                  status: status || 'CONFIGURED',
                  firmware_version: firmware_version || 'Ver 8.0.4.3-2026',
                  last_test: last_test || undefined,
                };

                existingDevices.push(newDevice);
                await saveStoredDevices(existingDevices);

                res.statusCode = 201;
                return res.end(JSON.stringify({ success: true, message: 'Marcador registrado correctamente.', data: newDevice }));
              } catch (e: any) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, message: 'Error interno al procesar registro de marcador.', error: e.message }));
              }
            });
            return;
          }

          if (req.method === 'PUT') {
            const id = url.replace(/^\//, '');
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', async () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const existingDevices = await getStoredDevices();
                const idx = existingDevices.findIndex((d: any) => d.id === id || (body.id && d.id === body.id));
                if (idx !== -1) {
                  existingDevices[idx] = { ...existingDevices[idx], ...body };
                } else {
                  existingDevices.push({ ...body, id: id || body.id || `dev-${Date.now()}` });
                }
                await saveStoredDevices(existingDevices);
                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, message: 'Marcador actualizado correctamente.', data: existingDevices[idx] || body }));
              } catch (e: any) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, message: 'Error al actualizar marcador.' }));
              }
            });
            return;
          }

          if (req.method === 'DELETE') {
            const id = url.replace(/^\//, '');
            const existingDevices = await getStoredDevices();
            const filtered = existingDevices.filter((d: any) => d.id !== id);
            await saveStoredDevices(filtered);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, message: 'Marcador eliminado correctamente.' }));
          }

          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, message: 'Error en servidor de biométricos.', error: err.message }));
        }
      });

      // 3. /api/punch-authorizations API Route
      server.middlewares.use('/api/punch-authorizations', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const url = req.url || '/';

        try {
          if (req.method === 'GET') {
            const auths = await getStoredAuthorizations();
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, data: auths }));
          }

          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', async () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const newAuth = {
                  id: `auth-${Date.now()}`,
                  employee_id: body.employee_id,
                  employee_dni: body.employee_dni,
                  employee_name: body.employee_name,
                  employee_cargo: body.employee_cargo,
                  dependencia_origen_tipo: body.dependencia_origen_tipo || 'SEDE_CENTRAL',
                  dependencia_origen_name: body.dependencia_origen_name || 'SEDE CENTRAL',
                  dependencia_autorizada_tipo: body.dependencia_autorizada_tipo || 'AGENCIA_AGRARIA',
                  dependencia_autorizada_name: body.dependencia_autorizada_name || 'AGENCIA AGRARIA',
                  device_id: body.device_id || undefined,
                  device_name: body.device_name || undefined,
                  device_sn: body.device_sn || undefined,
                  start_date: body.start_date,
                  end_date: body.end_date,
                  motivo: body.motivo,
                  documento_autorizacion: body.documento_autorizacion,
                  status: 'ACTIVA',
                  created_at: new Date().toISOString(),
                  created_by: body.created_by || 'Jefe de Recursos Humanos',
                };
                const auths = await getStoredAuthorizations();
                auths.unshift(newAuth);
                await saveStoredAuthorizations(auths);
                res.statusCode = 201;
                return res.end(JSON.stringify({ success: true, message: 'Autorización registrada.', data: newAuth }));
              } catch (e: any) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, message: 'Error al registrar autorización.' }));
              }
            });
            return;
          }

          if (req.method === 'PUT' && url.includes('/revoke')) {
            const id = url.replace('/revoke', '').replace(/^\//, '');
            const auths = await getStoredAuthorizations();
            const idx = auths.findIndex((a: any) => a.id === id);
            if (idx !== -1) {
              auths[idx].status = 'REVOCADA';
              auths[idx].revoked_at = new Date().toISOString();
              await saveStoredAuthorizations(auths);
            }
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, message: 'Autorización revocada.' }));
          }

          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, message: 'Error en servidor de autorizaciones.', error: err.message }));
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
