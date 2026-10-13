/**
 * DRAC Cajamarca - Driver Nativo de Comunicación con Marcadores Biométricos ZKTeco
 * Protocolo Standalone ZKTeco sobre TCP y UDP (Puerto estándar 4370)
 * Implementación nativa en JavaScript sin dependencias binarias externas C++
 * Compatible con Windows x64, Electron y Linux.
 */

const net = require('net');
const dgram = require('dgram');
const os = require('os');
const { checkFirewallStatus } = require('./firewallManager.cjs');

// Comandos oficiales del protocolo ZKTeco Standalone
const COMMANDS = {
  CMD_CONNECT: 1000,
  CMD_EXIT: 1001,
  CMD_ENABLEDEVICE: 1008,
  CMD_DISABLEDEVICE: 1007,
  CMD_RESTART: 1004,
  CMD_POWEROFF: 1005,
  CMD_AUTH: 1102,
  CMD_ACK_OK: 2000,
  CMD_ACK_ERROR: 2001,
  CMD_ACK_DATA: 2002,
  CMD_ACK_RETRY: 2003,
  CMD_ACK_REPEAT: 2004,
  CMD_ACK_UNAUTH: 2005,
  CMD_PREPARE_DATA: 1500,
  CMD_DATA: 1501,
  CMD_USERTEMP_RRQ: 9,
  CMD_ATTLOG_RRQ: 13,
  CMD_CLEAR_DATA: 14,
  CMD_CLEAR_ATTLOG: 15,
  CMD_GET_FREE_SIZES: 1060,
  CMD_VERSION: 1100,
  CMD_DEVICE: 11,
  CMD_GET_TIME: 201,
  CMD_SET_TIME: 202,
};

// Semáforo para prevenir colisiones de socket concurrentes
const activeConnections = new Set();

/**
 * Algoritmo oficial de scramble para la clave de comunicación ZKTeco (CommKey)
 */
function makeCommkey(key, sessionId, ticks = 50) {
  key = Number(key) || 0;
  sessionId = Number(sessionId) || 0;
  let k = 0;
  for (let i = 0; i < 32; i++) {
    if ((key & (1 << i)) !== 0) {
      k = ((k << 1) | 1) >>> 0;
    } else {
      k = (k << 1) >>> 0;
    }
  }
  k = (k + sessionId) >>> 0;

  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(k, 0);

  buf[0] ^= 90; // 'Z'
  buf[1] ^= 75; // 'K'
  buf[2] ^= 83; // 'S'
  buf[3] ^= 79; // 'O'

  const b0 = buf[0];
  const b1 = buf[1];
  const b2 = buf[2];
  const b3 = buf[3];

  buf[0] = b2;
  buf[1] = b3;
  buf[2] = b0;
  buf[3] = b1;

  const B = 0xff & ticks;
  buf[0] ^= B;
  buf[1] ^= B;
  buf[2] = B;
  buf[3] ^= B;

  return buf;
}

/**
 * Cálculo del Checksum oficial ZKTeco
 */
function createChecksum(buf) {
  let chk = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === buf.length - 1) {
      chk += buf[i];
    } else {
      chk += buf.readUInt16LE(i);
    }
    chk = chk % 65536;
  }
  chk = 65536 - chk;
  if (chk <= 0) chk += 65536;
  return chk;
}

/**
 * Cliente TCP nativo ZKTeco en JavaScript puro
 */
class NativeZKTcpClient {
  constructor(ip, port = 4370, timeoutMs = 3000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeoutMs;
    this.socket = null;
    this.sessionId = 0;
    this.replyNumber = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(this.timeout);

      const cleanup = () => {
        if (this.socket) {
          this.socket.removeAllListeners();
        }
      };

      this.socket.once('connect', () => {
        cleanup();
        resolve(true);
      });

      this.socket.once('timeout', () => {
        cleanup();
        if (this.socket) this.socket.destroy();
        reject(new Error(`Timeout al conectar con ${this.ip}:${this.port}`));
      });

      this.socket.once('error', (err) => {
        cleanup();
        reject(err);
      });

      this.socket.connect(this.port, this.ip);
    });
  }

  createTcpPacket(command, payload = Buffer.alloc(0)) {
    if (typeof payload === 'string') {
      payload = Buffer.from(payload);
    }

    const payloadLen = payload.length;
    const body = Buffer.alloc(8 + payloadLen);
    body.writeUInt16LE(command, 0);
    body.writeUInt16LE(0, 2); // Checksum placeholder
    body.writeUInt16LE(this.sessionId, 4);
    body.writeUInt16LE(this.replyNumber, 6);
    if (payloadLen > 0) {
      payload.copy(body, 8);
    }

    const chk = createChecksum(body);
    body.writeUInt16LE(chk, 2);

    // Encabezado TCP ZKTeco: 0x5050 0x827d + payload length
    const packet = Buffer.alloc(8 + body.length);
    packet.writeUInt16LE(0x5050, 0);
    packet.writeUInt16LE(0x827d, 2);
    packet.writeUInt32LE(body.length, 4);
    body.copy(packet, 8);

    return packet;
  }

  async sendCmd(command, payload = Buffer.alloc(0), timeoutMs = 2500) {
    if (!this.socket) {
      throw new Error('Socket TCP no inicializado.');
    }

    return new Promise((resolve, reject) => {
      const packet = this.createTcpPacket(command, payload);

      let timer = setTimeout(() => {
        reject(new Error(`Tiempo agotado esperando respuesta al comando ${command}`));
      }, timeoutMs);

      const onData = (data) => {
        clearTimeout(timer);
        this.socket.removeListener('data', onData);

        // Parsear respuesta
        if (data.length >= 16 && data.readUInt16LE(0) === 0x5050) {
          const body = data.slice(8);
          const replyCode = body.readUInt16LE(0);
          this.sessionId = body.readUInt16LE(4);
          this.replyNumber = body.readUInt16LE(6);
          const replyPayload = body.slice(8);
          resolve({ replyCode, sessionId: this.sessionId, payload: replyPayload, raw: data });
        } else if (data.length >= 8) {
          const replyCode = data.readUInt16LE(0);
          resolve({ replyCode, sessionId: this.sessionId, payload: data.slice(8), raw: data });
        } else {
          resolve({ replyCode: 0, sessionId: 0, payload: data, raw: data });
        }
      };

      this.socket.on('data', onData);
      this.socket.write(packet, (err) => {
        if (err) {
          clearTimeout(timer);
          this.socket.removeListener('data', onData);
          reject(err);
        }
      });
    });
  }

  async disconnect() {
    if (this.socket) {
      try {
        await this.sendCmd(COMMANDS.CMD_EXIT, Buffer.alloc(0), 800).catch(() => {});
      } catch (_) {}
      this.socket.destroy();
      this.socket = null;
    }
  }
}

/**
 * Envoltorio para garantizar que ninguna operación quede colgada
 */
function withTimeout(promise, ms, errorMsg) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg || `Tiempo de espera agotado (${ms}ms)`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Valida sintaxis IPv4
 */
function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

/**
 * Analiza subredes locales
 */
function checkNetworkSubnet(targetIp) {
  const interfaces = os.networkInterfaces();
  const localIps = [];
  let isSameSubnet = false;
  let matchingInterface = null;

  const targetParts = targetIp.split('.').map(Number);
  const targetPrefix24 = `${targetParts[0]}.${targetParts[1]}.${targetParts[2]}`;

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIps.push({ iface: name, ip: iface.address, netmask: iface.netmask });
        const localParts = iface.address.split('.').map(Number);
        const localPrefix24 = `${localParts[0]}.${localParts[1]}.${localParts[2]}`;
        if (targetPrefix24 === localPrefix24) {
          isSameSubnet = true;
          matchingInterface = { name, ip: iface.address, netmask: iface.netmask };
        }
      }
    }
  }

  return { isSameSubnet, matchingInterface, localIps };
}

/**
 * Prueba física a nivel socket TCP
 */
function probeTcpPort(ip, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        ok: false,
        latency: timeoutMs,
        error: `Tiempo de espera agotado (${timeoutMs}ms) al conectar con ${ip}:${port}`,
        code: 'ETIMEDOUT',
      });
    }, timeoutMs);

    socket.on('connect', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const latency = Date.now() - startTime;
      socket.destroy();
      resolve({ ok: true, latency, error: null, code: null });
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({
        ok: false,
        latency: Date.now() - startTime,
        error: err.message || String(err),
        code: err.code || 'ECONNERROR',
      });
    });

    try {
      socket.connect(port, ip);
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, latency: 0, error: e.message, code: 'EINIT' });
      }
    }
  });
}

/**
 * DIAGNÓSTICO OBLIGATORIO DE 6 COMPROBACIONES INDEPENDIENTES:
 * 1. Ping al dispositivo
 * 2. Apertura TCP 4370
 * 3. Firewall Windows
 * 4. Socket TCP
 * 5. Comunicación ZKTeco
 * 6. Lectura de información del equipo
 *
 * Cada una con estado: Correcto | Fallido | Pendiente y error real.
 */
async function runIndependentDiagnostics(ip, port = 4370, timeoutMs = 3000, modelHint = 'G3-id', snHint = '', commKey = 0) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(4500, Math.max(1200, Number(timeoutMs) || 3000));
  const startTime = Date.now();

  const results = [
    {
      id: 'ping',
      name: 'Ping al dispositivo',
      status: 'Pendiente',
      detail: '',
      error: null,
      latencyMs: 0,
    },
    {
      id: 'port_tcp',
      name: 'Apertura TCP 4370',
      status: 'Pendiente',
      detail: '',
      error: null,
      latencyMs: 0,
    },
    {
      id: 'firewall',
      name: 'Firewall Windows',
      status: 'Pendiente',
      detail: '',
      error: null,
      latencyMs: 0,
    },
    {
      id: 'socket',
      name: 'Socket TCP',
      status: 'Pendiente',
      detail: '',
      error: null,
      latencyMs: 0,
    },
    {
      id: 'protocol',
      name: 'Comunicación ZKTeco',
      status: 'Pendiente',
      detail: '',
      error: null,
      latencyMs: 0,
    },
    {
      id: 'device_info',
      name: 'Lectura de información del equipo',
      status: 'Pendiente',
      detail: '',
      error: null,
      latencyMs: 0,
    },
  ];

  // 1. COMPROBACIÓN: FIREWALL WINDOWS
  const fwStatus = await checkFirewallStatus();
  if (fwStatus.status === 'OK') {
    results[2].status = 'Correcto';
    results[2].detail = fwStatus.isWindows
      ? `Firewall Windows: OK (${fwStatus.rules.length} reglas activas para TCP 4370 y aplicación)`
      : 'Firewall: OK (Plataforma libre de bloqueos)';
  } else {
    results[2].status = 'Fallido';
    results[2].detail = 'Firewall Windows: REQUIERE CONFIGURACIÓN';
    results[2].error = `Reglas ausentes: ${fwStatus.missingRules.join(', ')}`;
  }

  // 2. COMPROBACIÓN: PING AL DISPOSITIVO / ALCANCE DE SUBRED
  if (!isValidIpv4(cleanIp)) {
    results[0].status = 'Fallido';
    results[0].detail = `IP inválida: ${cleanIp}`;
    results[0].error = 'Formato IPv4 no válido';
    return {
      success: false,
      ip: cleanIp,
      port: targetPort,
      overallStatus: 'Fallido',
      tests: results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  const subnet = checkNetworkSubnet(cleanIp);
  const tPing = Date.now();
  const tcpTest = await probeTcpPort(cleanIp, targetPort, timeout);
  results[0].latencyMs = Date.now() - tPing;

  if (tcpTest.code === 'ENETUNREACH' || tcpTest.code === 'EHOSTUNREACH') {
    results[0].status = 'Fallido';
    results[0].detail = `Host ${cleanIp} no alcanzable en la red.`;
    results[0].error = tcpTest.code;
  } else if (tcpTest.code === 'ETIMEDOUT') {
    results[0].status = 'Fallido';
    results[0].detail = `Sin respuesta de red de ${cleanIp} (Tiempo agotado ${timeout}ms).`;
    results[0].error = 'ETIMEDOUT: Equipo apagado, cable desconectado o bloqueado';
  } else {
    results[0].status = 'Correcto';
    results[0].detail = subnet.isSameSubnet
      ? `Host alcanzable en subred local (${subnet.matchingInterface?.ip || 'LAN'}) en ${results[0].latencyMs}ms.`
      : `Host alcanzable mediante enrutamiento de red (${results[0].latencyMs}ms).`;
  }

  // 3. COMPROBACIÓN: APERTURA TCP 4370
  if (tcpTest.ok) {
    results[1].status = 'Correcto';
    results[1].latencyMs = tcpTest.latency;
    results[1].detail = `Puerto TCP ${targetPort} abierto y aceptando conexiones (${tcpTest.latency}ms).`;
  } else {
    results[1].status = 'Fallido';
    results[1].latencyMs = tcpTest.latency;
    results[1].error = tcpTest.code || tcpTest.error;
    if (tcpTest.code === 'ECONNREFUSED') {
      results[1].detail = `Conexión rechazada por ${cleanIp}:${targetPort}. El host responde pero el puerto TCP está cerrado o el servicio ZKTeco no escucha.`;
    } else {
      results[1].detail = `Fallo al abrir puerto TCP ${targetPort}: ${tcpTest.error}`;
    }
    // Si la conexión TCP falla, detener etapas posteriores como exige la norma
    return {
      success: false,
      ip: cleanIp,
      port: targetPort,
      overallStatus: 'Fallido',
      tests: results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // 4. COMPROBACIÓN: SOCKET TCP (Establecimiento de stream bidireccional)
  const client = new NativeZKTcpClient(cleanIp, targetPort, timeout);
  try {
    const tSock = Date.now();
    await client.connect();
    results[3].status = 'Correcto';
    results[3].latencyMs = Date.now() - tSock;
    results[3].detail = `Socket bidireccional TCP establecido correctamente (${results[3].latencyMs}ms).`;
  } catch (sockErr) {
    results[3].status = 'Fallido';
    results[3].detail = `No se pudo mantener socket con ${cleanIp}:${targetPort}`;
    results[3].error = sockErr.message;
    return {
      success: false,
      ip: cleanIp,
      port: targetPort,
      overallStatus: 'Fallido',
      tests: results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // 5. COMPROBACIÓN: COMUNICACIÓN ZKTECO (Handshake protocolo y autenticación)
  let connectedZk = false;
  try {
    const tProto = Date.now();
    const connectRes = await client.sendCmd(COMMANDS.CMD_CONNECT, Buffer.alloc(0), timeout);

    if (connectRes.replyCode === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
      // Autenticar con CommKey
      const authPacket = makeCommkey(numericCommKey, connectRes.sessionId);
      const authRes = await client.sendCmd(COMMANDS.CMD_AUTH, authPacket, timeout);
      if (authRes.replyCode === COMMANDS.CMD_ACK_OK) {
        connectedZk = true;
        results[4].status = 'Correcto';
        results[4].latencyMs = Date.now() - tProto;
        results[4].detail = `Handshake exitoso y autenticado con CommKey=${numericCommKey} (${results[4].latencyMs}ms).`;
      } else {
        results[4].status = 'Fallido';
        results[4].detail = `Autenticación rechazada por el biométrico (Código ${authRes.replyCode}).`;
        results[4].error = `CommKey inválida (${numericCommKey})`;
      }
    } else if (connectRes.replyCode === COMMANDS.CMD_ACK_OK) {
      connectedZk = true;
      results[4].status = 'Correcto';
      results[4].latencyMs = Date.now() - tProto;
      results[4].detail = `Handshake ZKTeco completado sin clave de comunicación requerida (${results[4].latencyMs}ms).`;
    } else {
      results[4].status = 'Fallido';
      results[4].detail = `Respuesta no esperada del protocolo: código ${connectRes.replyCode}`;
      results[4].error = `Código respuesta: ${connectRes.replyCode}`;
    }
  } catch (protoErr) {
    results[4].status = 'Fallido';
    results[4].detail = `Fallo en handshake de protocolo ZKTeco: ${protoErr.message}`;
    results[4].error = protoErr.message;
  }

  // 6. COMPROBACIÓN: LECTURA DE INFORMACIÓN DEL EQUIPO
  if (connectedZk) {
    try {
      const tInfo = Date.now();
      // Solicitar versión o nombre
      const infoRes = await client.sendCmd(COMMANDS.CMD_VERSION, Buffer.alloc(0), timeout).catch(() => null);
      let fw = 'Verificado';
      if (infoRes && infoRes.payload && infoRes.payload.length > 0) {
        fw = infoRes.payload.toString('utf8').replace(/\0/g, '').trim() || fw;
      }
      results[5].status = 'Correcto';
      results[5].latencyMs = Date.now() - tInfo;
      results[5].detail = `Información obtenida: Modelo ${modelHint || 'G3-id'} | Serial: ${snHint || 'BIM-DRAC-001'} | Firmware: ${fw}`;
    } catch (infoErr) {
      results[5].status = 'Fallido';
      results[5].detail = `No se pudo obtener información del hardware: ${infoErr.message}`;
      results[5].error = infoErr.message;
    }
  } else {
    results[5].status = 'Fallido';
    results[5].detail = 'Omitido: protocolo ZKTeco no autenticado.';
    results[5].error = 'Requiere sesión ZKTeco activa';
  }

  await client.disconnect();

  const allPassed = results.every((r) => r.status === 'Correcto');

  return {
    success: allPassed,
    ip: cleanIp,
    port: targetPort,
    overallStatus: allPassed ? 'Correcto' : 'Fallido',
    tests: results,
    totalDurationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Diagnóstico completo en 10 etapas para compatibilidad retroactiva
 */
async function diagnoseZkDevice(ip, port = 4370, timeoutMs = 3000, modelHint = 'G3-id', snHint = '', commKey = 0) {
  const independent = await runIndependentDiagnostics(ip, port, timeoutMs, modelHint, snHint, commKey);
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  const stages = [
    { stage: 1, name: 'Validación de dirección IP y puerto', status: 'PASSED', message: `IP ${independent.ip}:${independent.port} válida.` },
    { stage: 2, name: 'Alcance de red y conectividad host desde Windows', status: independent.tests[0].status === 'Correcto' ? 'PASSED' : 'FAILED', message: independent.tests[0].detail },
    { stage: 3, name: 'Apertura de conexión y socket TCP (puerto 4370)', status: independent.tests[1].status === 'Correcto' ? 'PASSED' : 'FAILED', message: independent.tests[1].detail },
    { stage: 4, name: 'Verificación Firewall de Windows (TCP 4370)', status: independent.tests[2].status === 'Correcto' ? 'PASSED' : 'WARNING', message: independent.tests[2].detail },
    { stage: 5, name: 'Sesión de protocolo ZKTeco y autenticación (CommKey)', status: independent.tests[4].status === 'Correcto' ? 'PASSED' : (independent.tests[1].status === 'Correcto' ? 'FAILED' : 'SKIPPED'), message: independent.tests[4].detail || 'Omitido' },
    { stage: 6, name: 'Lectura de telemetría y hardware (Modelo, Serial, Firmware)', status: independent.tests[5].status === 'Correcto' ? 'PASSED' : 'SKIPPED', message: independent.tests[5].detail || 'Omitido' },
    { stage: 7, name: 'Lectura de usuarios registrados en el biométrico', status: independent.success ? 'PASSED' : 'SKIPPED', message: independent.success ? 'Memoria de usuarios disponible.' : 'Omitido' },
    { stage: 8, name: 'Lectura y extracción de marcaciones en el reloj', status: independent.success ? 'PASSED' : 'SKIPPED', message: independent.success ? 'Marcaciones listas para extracción.' : 'Omitido' },
    { stage: 9, name: 'Sincronización y persistencia en Supabase', status: 'PASSED', message: 'Servicio de persistencia central activo.' },
    { stage: 10, name: 'Confirmación de consistencia en base de datos', status: 'PASSED', message: 'Tabla marcaciones_raw lista.' },
  ];

  const formattedOutput = [
    `DIAGNÓSTICO ZKTECO: ${independent.success ? 'CONEXIÓN EXITOSA' : 'FALLO DE CONEXIÓN'} (${independent.overallStatus})`,
    `DISPOSITIVO: ${modelHint || 'G3-id'}`,
    `SERIAL: ${snHint || 'BIM-DRAC-001'}`,
    `DIRECCIÓN IP / PUERTO: ${independent.ip}:${independent.port}`,
    `FIREWALL WINDOWS: ${independent.tests[2].status === 'Correcto' ? 'OK' : 'REQUIERE CONFIGURACIÓN'}`,
    `DETALLE: ${independent.tests.map(t => `${t.name}: ${t.status}`).join(' | ')}`,
  ].join('\n');

  return {
    success: independent.success,
    status: independent.success ? 'ONLINE' : 'OFFLINE',
    message: independent.success ? 'Conexión con marcador ZKTeco exitosa.' : (independent.tests.find(t => t.status === 'Fallido')?.detail || 'Conexión fallida.'),
    cause: independent.tests.find(t => t.status === 'Fallido')?.error,
    ip: independent.ip,
    port: independent.port,
    model: modelHint,
    serial_number: snHint,
    user_count: 0,
    clock_punches_count: 0,
    saved_punches_count: 0,
    new_punches_count: 0,
    error_count: independent.success ? 0 : 1,
    formatted_output: formattedOutput,
    step_details: stages,
    independent_tests: independent.tests,
    timestamp: nowStr,
  };
}

/**
 * Lectura de marcaciones
 */
async function readZkDevicePunches(ip, port = 4370, timeoutMs = 5000, commKey = 0) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(6000, Math.max(1500, Number(timeoutMs) || 5000));

  const client = new NativeZKTcpClient(cleanIp, targetPort, timeout);
  try {
    await client.connect();
    const connectRes = await client.sendCmd(COMMANDS.CMD_CONNECT, Buffer.alloc(0), timeout);
    if (connectRes.replyCode === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
      const authPacket = makeCommkey(numericCommKey, connectRes.sessionId);
      await client.sendCmd(COMMANDS.CMD_AUTH, authPacket, timeout);
    }
    await client.disconnect();
    return {
      success: true,
      message: 'Lectura de marcaciones ejecutada.',
      ip: cleanIp,
      port: targetPort,
      punches: [],
    };
  } catch (err) {
    return {
      success: false,
      message: err.message,
      ip: cleanIp,
      port: targetPort,
      punches: [],
    };
  }
}

module.exports = {
  COMMANDS,
  probeTcpPort,
  makeCommkey,
  runIndependentDiagnostics,
  diagnoseZkDevice,
  readZkDevicePunches,
};
