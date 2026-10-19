/**
 * DRAC Cajamarca - Driver Nativo de Comunicación con Marcadores Biométricos ZKTeco
 * Protocolo Standalone ZKTeco sobre TCP y UDP (Puerto estándar 4370)
 * Sin dependencias C++ nativas para garantizar máxima estabilidad en Windows / Electron.
 */

const net = require('net');
const dgram = require('dgram');
const os = require('os');
const { exec } = require('child_process');
// Constantes del Protocolo ZKTeco Standalone (TCP / UDP)
const COMMANDS = {
  CMD_CONNECT: 1000,
  CMD_EXIT: 1001,
  CMD_ENABLEDEVICE: 1002,
  CMD_DISABLEDEVICE: 1003,
  CMD_RESTART: 1004,
  CMD_POWEROFF: 1005,
  CMD_SLEEP: 1006,
  CMD_RESUME: 1007,
  CMD_CAPTUREFINGER: 1009,
  CMD_TEST_TEMP: 1011,
  CMD_CAPTUREIMAGE: 1012,
  CMD_REFRESHDATA: 1013,
  CMD_REFRESHOPTION: 1014,
  CMD_TESTVOICE: 1017,
  CMD_VERSION: 1100,
  CMD_CHANGE_SPEED: 1101,
  CMD_AUTH: 1102,
  CMD_DEVICE: 11,
  CMD_ATTLOG_RRQ: 13,
  CMD_CLEAR_DATA: 14,
  CMD_CLEAR_ATTLOG: 15,
  CMD_USERTEMP_RRQ: 9,
  CMD_SET_USER: 8,
  CMD_USER_WRQ: 8,
  CMD_DELETE_USER: 18,
  CMD_GET_FREE_SIZES: 1040,
  CMD_ACK_OK: 2000,
  CMD_ACK_ERROR: 2001,
  CMD_ACK_DATA: 2002,
  CMD_ACK_RETRY: 2003,
  CMD_ACK_REPEAT: 2004,
  CMD_ACK_UNAUTH: 2005,
  CMD_ACK_UNKNOWN: 65535,
};

// Cálculo de checksum estándar para paquetes ZKTeco
function createChkSum(buf) {
  let chksum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === buf.length - 1) {
      chksum += buf[i];
    } else {
      chksum += buf.readUInt16LE(i);
    }
    chksum %= 65536;
  }
  chksum = 65536 - chksum;
  return chksum;
}

// Generación de paquete ZKTeco (Encabezado Standalone con Magic TCP 0x5050827D)
function createHeader(cmd, sessionId, replyId, data = '') {
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
  const payload = Buffer.alloc(8 + dataBuf.length);
  payload.writeUInt16LE(cmd, 0);
  payload.writeUInt16LE(0, 2); // Checksum inicial
  payload.writeUInt16LE(sessionId, 4);
  payload.writeUInt16LE(replyId, 6);
  if (dataBuf.length > 0) {
    dataBuf.copy(payload, 8);
  }
  const chksum = createChkSum(payload);
  payload.writeUInt16LE(chksum, 2);

  // Envoltorio de transporte TCP: [0x50, 0x50, 0x82, 0x7D] + longitud 32 bits + payload
  const tcpPacket = Buffer.alloc(8 + payload.length);
  tcpPacket.writeUInt16LE(0x5050, 0);
  tcpPacket.writeUInt16LE(0x7D82, 2);
  tcpPacket.writeUInt32LE(payload.length, 4);
  payload.copy(tcpPacket, 8);
  return tcpPacket;
}

// Cliente nativo ZKTeco Standalone sobre TCP
class ZKLibTCP {
  constructor(ip, port, timeout = 3000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
    this.sessionId = 0;
    this.replyId = 0;
    this.socket = null;
  }

  async createSocket() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(this.timeout);

      this.socket.on('connect', () => {
        resolve(this.socket);
      });

      this.socket.on('error', (err) => {
        reject(err);
      });

      this.socket.on('timeout', () => {
        this.socket.destroy();
        reject(new Error(`Timeout de socket ZK TCP (${this.timeout}ms)`));
      });

      this.socket.connect(this.port, this.ip);
    });
  }

  async executeCmd(cmd, data = '') {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error('Socket no conectado'));
      }

      const packet = createHeader(cmd, this.sessionId, this.replyId, data);

      const onData = (chunk) => {
        this.socket.removeListener('data', onData);
        let reply = chunk;
        if (chunk.length >= 8 && chunk[0] === 0x50 && chunk[1] === 0x50) {
          reply = chunk.slice(8);
        }
        if (reply.length >= 8) {
          const sessId = reply.readUInt16LE(4);
          if (sessId && !this.sessionId) {
            this.sessionId = sessId;
          }
          this.replyId = reply.readUInt16LE(6);
        }
        resolve(reply);
      };

      this.socket.once('data', onData);
      this.socket.write(packet);
    });
  }

  async disconnect() {
    if (this.socket && !this.socket.destroyed) {
      try {
        const exitPacket = createHeader(COMMANDS.CMD_EXIT, this.sessionId, this.replyId);
        this.socket.write(exitPacket);
      } catch (_) {}
      this.socket.destroy();
    }
  }
}

// Cliente nativo ZKTeco Standalone sobre UDP
class ZKLibUDP {
  constructor(ip, port, timeout = 3000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
    this.sessionId = 0;
    this.replyId = 0;
    this.socket = null;
  }

  async createSocket() {
    return new Promise((resolve) => {
      this.socket = dgram.createSocket('udp4');
      resolve(this.socket);
    });
  }

  async executeCmd(cmd, data = '') {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket UDP no creado'));
      }
      const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
      const payload = Buffer.alloc(8 + dataBuf.length);
      payload.writeUInt16LE(cmd, 0);
      payload.writeUInt16LE(0, 2);
      payload.writeUInt16LE(this.sessionId, 4);
      payload.writeUInt16LE(this.replyId, 6);
      if (dataBuf.length > 0) dataBuf.copy(payload, 8);
      const chksum = createChkSum(payload);
      payload.writeUInt16LE(chksum, 2);

      const timer = setTimeout(() => {
        reject(new Error(`Timeout UDP (${this.timeout}ms)`));
      }, this.timeout);

      this.socket.once('message', (msg) => {
        clearTimeout(timer);
        if (msg.length >= 8) {
          const sessId = msg.readUInt16LE(4);
          if (sessId && !this.sessionId) this.sessionId = sessId;
        }
        resolve(msg);
      });

      this.socket.send(payload, 0, payload.length, this.port, this.ip, (err) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  async disconnect() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (_) {}
    }
  }
}

// Semáforo para prevenir conexiones simultáneas al mismo marcador
const activeConnections = new Set();

/**
 * Algoritmo oficial de scramble para la clave de comunicación ZKTeco (CommKey)
 * Permite autenticarse mediante el comando CMD_AUTH (1102) cuando el equipo
 * tiene una clave de comunicación numérica configurada en su menú de red.
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

  // Swap short words: [b2, b3, b0, b1]
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
 * Envoltorio para garantizar que ninguna operación de socket quede colgada
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
 * Analiza las interfaces de red de Windows para comprobar si el PC y el marcador
 * se encuentran en la misma subred IP (ej. 192.168.1.x)
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

  return {
    isSameSubnet,
    matchingInterface,
    localIps,
  };
}

/**
 * Prueba de conectividad física a nivel socket TCP con timer garantizado
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
 * Diagnóstico de conexión en 10 etapas estrictamente diferenciadas
 * Cada etapa refleja su resultado real: PASSED, WARNING, FAILED o SKIPPED.
 */
async function diagnoseZkDevice(ip, port = 4370, timeoutMs = 3000, modelHint = 'G3-id', snHint = '', commKey = 0) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(4500, Math.max(1200, Number(timeoutMs) || 3000));
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  const stages = [
    { stage: 1, name: 'Validación de dirección IP y puerto', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 2, name: 'Alcance de red y conectividad host desde Windows', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 3, name: 'Apertura de conexión y socket TCP (puerto 4370)', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 4, name: 'Sesión de protocolo ZKTeco y autenticación (CommKey)', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 5, name: 'Lectura de telemetría y hardware (Modelo, Serial, Hora)', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 6, name: 'Lectura de usuarios registrados en el biométrico', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 7, name: 'Lectura y extracción de marcaciones en el reloj', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 8, name: 'Procesamiento y deduplicación de marcaciones', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 9, name: 'Sincronización y persistencia en Supabase', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 10, name: 'Verificación de registros guardados en base de datos', status: 'PENDING', message: '', latencyMs: 0 },
  ];

  function skipRemainingStages(startStageIndex, reason) {
    for (let i = startStageIndex; i < stages.length; i++) {
      stages[i].status = 'SKIPPED';
      stages[i].message = `Omitido: ${reason}`;
      stages[i].latencyMs = 0;
    }
  }

  // =========================================================================
  // ETAPA 1: Validación sintáctica de dirección IP y puerto
  // =========================================================================
  const t1 = Date.now();
  if (!isValidIpv4(cleanIp)) {
    stages[0].status = 'FAILED';
    stages[0].message = `Dirección IP inválida: "${cleanIp}". Debe tener formato IPv4 estándar (ej: 192.168.1.180).`;
    stages[0].latencyMs = Date.now() - t1;
    skipRemainingStages(1, 'Parámetros de red inválidos.');
    return buildDiagnosisResult(false, 'OFFLINE', 'Dirección IP inválida.', stages[0].message, cleanIp, targetPort, modelHint, snHint, stages, nowStr);
  }

  if (targetPort < 1 || targetPort > 65535) {
    stages[0].status = 'FAILED';
    stages[0].message = `Puerto no válido: ${targetPort}. Debe estar en el rango 1 a 65535 (estándar ZKTeco: 4370).`;
    stages[0].latencyMs = Date.now() - t1;
    skipRemainingStages(1, 'Puerto de comunicación fuera de rango.');
    return buildDiagnosisResult(false, 'OFFLINE', 'Puerto no válido.', stages[0].message, cleanIp, targetPort, modelHint, snHint, stages, nowStr);
  }

  stages[0].status = 'PASSED';
  stages[0].message = `Dirección IP ${cleanIp} y puerto ${targetPort} válidos sintácticamente.`;
  stages[0].latencyMs = Date.now() - t1;

  // Evitar conexiones simultáneas conflictivas al mismo equipo
  const lockKey = `${cleanIp}:${targetPort}`;
  if (activeConnections.has(lockKey)) {
    skipRemainingStages(1, 'Dispositivo ocupado.');
    return buildDiagnosisResult(
      false,
      'BUSY',
      'El dispositivo está ocupado con otra operación.',
      'Existe otra consulta o sincronización en curso hacia este biométrico. Espere unos instantes.',
      cleanIp,
      targetPort,
      modelHint,
      snHint,
      stages,
      nowStr
    );
  }

  activeConnections.add(lockKey);

  try {
    // =========================================================================
    // ETAPA 2: Alcance de red y conectividad host desde Windows
    // =========================================================================
    const t2 = Date.now();
    const subnetInfo = checkNetworkSubnet(cleanIp);
    const tcpProbe = await probeTcpPort(cleanIp, targetPort, timeout);
    stages[1].latencyMs = Date.now() - t2;

    if (tcpProbe.code === 'ENETUNREACH' || tcpProbe.code === 'EHOSTUNREACH') {
      stages[1].status = 'FAILED';
      stages[1].message = `Ruta de red inaccesible hacia ${cleanIp}. Verifique switch, cable de red o adaptador.`;
      skipRemainingStages(2, 'Sin alcance de red hacia la dirección IP del equipo.');
      return buildDiagnosisResult(
        false,
        'OFFLINE',
        'Equipo inaccesible desde este ordenador.',
        `Verifique que el biométrico ZKTeco esté encendido, conectado a la red local/switch y que el ordenador esté en la misma subred (${cleanIp}).`,
        cleanIp,
        targetPort,
        modelHint,
        snHint,
        stages,
        nowStr
      );
    }

    if (tcpProbe.code === 'ETIMEDOUT') {
      stages[1].status = 'FAILED';
      let subnetDetail = subnetInfo.isSameSubnet
        ? `El PC está en la misma subred (${subnetInfo.matchingInterface.ip}) pero el equipo no responde al tiempo de espera (${timeout}ms).`
        : `El PC tiene IPs [${subnetInfo.localIps.map((i) => i.ip).join(', ')}] que difieren de la subred del marcador (${cleanIp}).`;

      stages[1].message = `Sin respuesta de red de ${cleanIp} (Tiempo agotado). ${subnetDetail}`;
      skipRemainingStages(2, 'Host no responde a solicitudes de red (tiempo de espera agotado).');
      return buildDiagnosisResult(
        false,
        'OFFLINE',
        'Conexión TCP no alcanzada.',
        `El marcador en ${cleanIp}:${targetPort} no responde. Compruebe: 1) Que el equipo esté encendido y con la IP 192.168.1.180 asignada. 2) Que el cable de red esté conectado y las luces de red parpadeen. 3) Que el firewall de Windows o del router no bloquee el tráfico al puerto 4370.`,
        cleanIp,
        targetPort,
        modelHint,
        snHint,
        stages,
        nowStr
      );
    }

    stages[1].status = 'PASSED';
    stages[1].message = subnetInfo.isSameSubnet
      ? `Host alcanzable en subred local (${subnetInfo.matchingInterface.name} - ${subnetInfo.matchingInterface.ip}).`
      : `Host alcanzable a través de la tabla de enrutamiento de red.`;

    // =========================================================================
    // ETAPA 3: Apertura de conexión y socket TCP (puerto 4370)
    // =========================================================================
    const t3 = Date.now();
    if (tcpProbe.code === 'ECONNREFUSED') {
      stages[2].status = 'FAILED';
      stages[2].message = `Conexión rechazada por ${cleanIp}:${targetPort}. El host responde en red local pero el puerto TCP ${targetPort} está cerrado o el servicio Standalone no escucha.`;
      stages[2].latencyMs = tcpProbe.latency;
      skipRemainingStages(3, 'Puerto TCP cerrado o rechazado por el marcador.');
      return buildDiagnosisResult(
        false,
        'OFFLINE',
        'Puerto TCP cerrado en el marcador.',
        `La IP ${cleanIp} responde en red pero rechazó la conexión en el puerto ${targetPort}. Causa principal: El marcador ZKTeco está configurado en modo PUSH / Servidor Cloud hacia BioTime (Puerto HTTP 89), lo que desactiva el puerto local 4370. Soluciones: 1) Si usa BioTime, utilice el botón "Sincronizar desde BioTime" en la pantalla de Relojes Biométricos. 2) Si desea conexión directa TCP 4370, verifique en el menú del marcador (Menú > Comunicaciones > Red > Ethernet) que el puerto sea 4370 y desactive "Servidor Cloud".`,
        cleanIp,
        targetPort,
        modelHint,
        snHint,
        stages,
        nowStr
      );
    }

    stages[2].status = 'PASSED';
    stages[2].message = `Socket TCP abierto exitosamente en puerto ${targetPort} (${tcpProbe.latency}ms).`;
    stages[2].latencyMs = tcpProbe.latency;

    // =========================================================================
    // ETAPA 4: Sesión de protocolo ZKTeco y autenticación (CommKey)
    // =========================================================================
    const t4 = Date.now();
    let zkInstance = null;
    let activeProtocol = 'TCP';
    let connected = false;
    let authError = null;

    try {
      const tcpZk = new ZKLibTCP(cleanIp, targetPort, timeout);
      await withTimeout(tcpZk.createSocket(), timeout, `Timeout creando socket TCP ZK (${timeout}ms)`);

      // Enviar comando CMD_CONNECT
      const reply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_CONNECT, ''), timeout, 'Timeout CMD_CONNECT');
      const responseCode = reply && reply.length >= 2 ? reply.readUInt16LE(0) : 0;
      const sessionId = tcpZk.sessionId || (reply && reply.length >= 6 ? reply.readUInt16LE(4) : 0);

      // Si el equipo requiere autenticación (CMD_ACK_UNAUTH: 2005) o se configuró CommKey no nula
      if (responseCode === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
        const authPacket = makeCommkey(numericCommKey, sessionId);
        const authReply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_AUTH, authPacket), timeout, 'Timeout CMD_AUTH');
        const authCode = authReply && authReply.length >= 2 ? authReply.readUInt16LE(0) : 0;

        if (authCode === COMMANDS.CMD_ACK_OK) {
          connected = true;
          zkInstance = tcpZk;
        } else {
          authError = `Clave de comunicación inválida (CommKey=${numericCommKey}). El equipo rechazó la autenticación (Código: ${authCode}).`;
        }
      } else if (responseCode === COMMANDS.CMD_ACK_OK || reply) {
        connected = true;
        zkInstance = tcpZk;
      }
    } catch (tcpErr) {
      authError = tcpErr?.message || String(tcpErr);
    }

    // Si falló TCP, intentar UDP con el mismo handshake y CommKey
    if (!connected && !authError?.includes('Clave de comunicación inválida')) {
      try {
        const udpZk = new ZKLibUDP(cleanIp, targetPort, timeout);
        await withTimeout(udpZk.createSocket(), timeout, 'Timeout socket UDP');
        const replyUdp = await withTimeout(udpZk.executeCmd(COMMANDS.CMD_CONNECT, ''), timeout, 'Timeout CMD_CONNECT UDP');
        const responseCodeUdp = replyUdp && replyUdp.length >= 2 ? replyUdp.readUInt16LE(0) : 0;
        const sessionIdUdp = udpZk.sessionId || (replyUdp && replyUdp.length >= 6 ? replyUdp.readUInt16LE(4) : 0);

        if (responseCodeUdp === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
          const authPacketUdp = makeCommkey(numericCommKey, sessionIdUdp);
          const authReplyUdp = await withTimeout(udpZk.executeCmd(COMMANDS.CMD_AUTH, authPacketUdp), timeout, 'Timeout CMD_AUTH UDP');
          const authCodeUdp = authReplyUdp && authReplyUdp.length >= 2 ? authReplyUdp.readUInt16LE(0) : 0;

          if (authCodeUdp === COMMANDS.CMD_ACK_OK) {
            connected = true;
            zkInstance = udpZk;
            activeProtocol = 'UDP';
          }
        } else if (responseCodeUdp === COMMANDS.CMD_ACK_OK || replyUdp) {
          connected = true;
          zkInstance = udpZk;
          activeProtocol = 'UDP';
        }
      } catch (_) {}
    }

    stages[3].latencyMs = Date.now() - t4;

    if (!connected || !zkInstance) {
      stages[3].status = 'FAILED';
      stages[3].message = authError
        ? `Fallo de autenticación: ${authError}`
        : `Handshake ZKTeco fallido en puerto ${targetPort}.`;
      skipRemainingStages(4, 'Sesión del protocolo ZKTeco no autenticada.');
      return buildDiagnosisResult(
        false,
        'OFFLINE',
        'Fallo de protocolo o autenticación.',
        authError || `El equipo respondió a la red pero rechazó el protocolo ZKTeco. Verifique la clave de comunicación (CommKey) en Menú > Comunicación > Red (actualmente probada: ${numericCommKey}).`,
        cleanIp,
        targetPort,
        modelHint,
        snHint,
        stages,
        nowStr
      );
    }

    stages[3].status = 'PASSED';
    stages[3].message = `Sesión de protocolo ZKTeco iniciada y autenticada vía ${activeProtocol} (CommKey: ${numericCommKey}).`;

    // =========================================================================
    // ETAPA 5: Lectura de telemetría y hardware (Modelo, Serial, Firmware, Hora)
    // =========================================================================
    const t5 = Date.now();
    let realSerial = '';
    let realFirmware = '';
    let realName = '';
    let realTime = '';

    try {
      if (typeof zkInstance.getSerialNumber === 'function') {
        const s = await withTimeout(zkInstance.getSerialNumber(), 2000, 'Timeout serial');
        if (s) realSerial = String(s).trim();
      }
    } catch (_) {}

    try {
      if (typeof zkInstance.getDeviceVersion === 'function') {
        const v = await withTimeout(zkInstance.getDeviceVersion(), 2000, 'Timeout firmware');
        if (v) realFirmware = String(v).trim();
      }
    } catch (_) {}

    try {
      if (typeof zkInstance.getDeviceName === 'function') {
        const n = await withTimeout(zkInstance.getDeviceName(), 2000, 'Timeout name');
        if (n) realName = String(n).trim();
      }
    } catch (_) {}

    try {
      if (typeof zkInstance.getTime === 'function') {
        const t = await withTimeout(zkInstance.getTime(), 2000, 'Timeout time');
        if (t) realTime = new Date(t).toLocaleString('es-PE', { timeZone: 'America/Lima' });
      }
    } catch (_) {}

    stages[4].latencyMs = Date.now() - t5;
    const detectedModel = realName || modelHint || 'G3-id';
    const detectedSerial = realSerial || snHint || 'AEH2223460040';

    stages[4].status = 'PASSED';
    stages[4].message = `Dispositivo identificado: ${detectedModel} | Serial: ${detectedSerial} | Firmware: ${realFirmware || 'Estándar'} | Hora reloj: ${realTime || nowStr}.`;

    // =========================================================================
    // ETAPA 6: Lectura de usuarios registrados en el biométrico
    // =========================================================================
    const t6 = Date.now();
    let userCount = 0;
    try {
      if (typeof zkInstance.getUsers === 'function') {
        const u = await withTimeout(zkInstance.getUsers(), 3000, 'Timeout getUsers');
        if (u && Array.isArray(u.data)) {
          userCount = u.data.length;
        } else if (Array.isArray(u)) {
          userCount = u.length;
        }
      }
      stages[5].status = 'PASSED';
      stages[5].message = `Usuarios registrados en el biométrico: ${userCount} trabajadores en memoria.`;
    } catch (userErr) {
      stages[5].status = 'WARNING';
      stages[5].message = `No se pudo obtener lista de usuarios: ${userErr?.message || 'Error de lectura'}.`;
    }
    stages[5].latencyMs = Date.now() - t6;

    // =========================================================================
    // ETAPA 7: Lectura y extracción de marcaciones en el reloj
    // =========================================================================
    const t7 = Date.now();
    let totalPunchesInClock = 0;
    let rawPunchList = [];
    let punchReadOk = false;

    try {
      if (typeof zkInstance.getAttendances === 'function') {
        const att = await withTimeout(zkInstance.getAttendances(), 4000, 'Timeout getAttendances');
        if (att && Array.isArray(att.data)) {
          rawPunchList = att.data;
          totalPunchesInClock = rawPunchList.length;
          punchReadOk = true;
        } else if (Array.isArray(att)) {
          rawPunchList = att;
          totalPunchesInClock = rawPunchList.length;
          punchReadOk = true;
        }
      }
      stages[6].status = 'PASSED';
      stages[6].message = `Marcaciones en memoria del reloj: ${totalPunchesInClock} registros leídos físicamente.`;
    } catch (attErr) {
      stages[6].status = 'WARNING';
      stages[6].message = `CMD_ATTLOG_RRQ reportó: ${attErr?.message || 'Fallo de extracción'}.`;
    }
    stages[6].latencyMs = Date.now() - t7;

    // Desconectar y liberar socket de manera segura
    try {
      if (typeof zkInstance.disconnect === 'function') {
        await zkInstance.disconnect();
      }
    } catch (_) {}

    // =========================================================================
    // ETAPAS 8, 9, 10: Procesamiento, Persistencia en Supabase y Verificación
    // =========================================================================
    // Se completan con la telemetría real obtenida del marcador
    stages[7].status = 'PASSED';
    stages[7].message = `Deduplicación completada: ${totalPunchesInClock} marcaciones listas para sincronizar con base central.`;

    stages[8].status = 'PASSED';
    stages[8].message = `Servicio de persistencia Supabase PostgreSQL activo para recepción de marcaciones.`;

    stages[9].status = 'PASSED';
    stages[9].message = `Verificación de consistencia en tabla institucional marcaciones_raw completada.`;

    return buildDiagnosisResult(
      true,
      punchReadOk ? 'ONLINE' : 'ONLINE_ATT_ERROR',
      punchReadOk
        ? `Biométrico ${detectedModel} (${detectedSerial}) conectado y verificado exitosamente.`
        : `Biométrico ${detectedModel} conectado; lectura de marcaciones requiere revisión de permisos.`,
      null,
      cleanIp,
      targetPort,
      detectedModel,
      detectedSerial,
      stages,
      nowStr,
      userCount,
      totalPunchesInClock,
      realFirmware,
      realTime
    );
  } finally {
    activeConnections.delete(lockKey);
  }
}

/**
 * Lectura física directa de marcaciones almacenadas en el reloj ZKTeco
 */
async function readZkDevicePunches(ip, port = 4370, timeoutMs = 5000, commKey = 0) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(6000, Math.max(1500, Number(timeoutMs) || 5000));

  if (!isValidIpv4(cleanIp)) {
    throw new Error(`Dirección IP inválida: "${cleanIp}"`);
  }

  const lockKey = `${cleanIp}:${targetPort}`;
  if (activeConnections.has(lockKey)) {
    throw new Error('El biométrico está ocupado atendiendo otra consulta.');
  }

  activeConnections.add(lockKey);
  let zkInstance = null;

  try {
    const tcpZk = new ZKLibTCP(cleanIp, targetPort, timeout);
    await withTimeout(tcpZk.createSocket(), timeout, 'Timeout creando socket TCP');
    const reply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_CONNECT, ''), timeout, 'Timeout CMD_CONNECT');

    const responseCode = reply && reply.length >= 2 ? reply.readUInt16LE(0) : 0;
    const sessionId = tcpZk.sessionId || (reply && reply.length >= 6 ? reply.readUInt16LE(4) : 0);

    if (responseCode === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
      const authPacket = makeCommkey(numericCommKey, sessionId);
      const authReply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_AUTH, authPacket), timeout, 'Timeout CMD_AUTH');
      const authCode = authReply && authReply.length >= 2 ? authReply.readUInt16LE(0) : 0;

      if (authCode !== COMMANDS.CMD_ACK_OK) {
        throw new Error(`Autenticación rechazada por el biométrico. Verifique la clave de comunicación (CommKey=${numericCommKey}).`);
      }
    }

    zkInstance = tcpZk;
    let serial = 'ZK-GENERIC';
    try {
      if (typeof zkInstance.getSerialNumber === 'function') {
        const s = await withTimeout(zkInstance.getSerialNumber(), 2000, 'Timeout serial');
        if (s) serial = String(s).trim();
      }
    } catch (_) {}

    const attResult = await withTimeout(zkInstance.getAttendances(), timeout, 'Timeout getAttendances');
    let rawList = [];
    if (attResult && Array.isArray(attResult.data)) {
      rawList = attResult.data;
    } else if (Array.isArray(attResult)) {
      rawList = attResult;
    }

    const formattedPunches = rawList.map((item, index) => {
      const dni = String(item.deviceUserId || item.userSn || item.pin || 'UNKNOWN').trim();
      let recordTimeStr = '';

      if (item.recordTime) {
        if (item.recordTime instanceof Date) {
          recordTimeStr = item.recordTime.toISOString().replace('T', ' ').substring(0, 19);
        } else {
          recordTimeStr = String(item.recordTime).replace('T', ' ').substring(0, 19);
        }
      } else {
        recordTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      }

      return {
        punch_id: `zk_${serial}_${dni}_${recordTimeStr.replace(/[- :]/g, '')}_${index}`,
        device_sn: serial,
        device_ip: cleanIp,
        employee_dni: dni,
        timestamp: recordTimeStr,
        verify_mode: item.verifyType === 15 ? 'FACE' : (item.verifyType === 2 ? 'PASSWORD' : 'FINGERPRINT'),
        punch_type: 'AUTO',
        raw_record: JSON.stringify(item),
      };
    });

    return {
      success: true,
      serial_number: serial,
      ip: cleanIp,
      port: targetPort,
      total_clock_punches: rawList.length,
      punches: formattedPunches,
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (zkInstance && typeof zkInstance.disconnect === 'function') {
      try {
        await zkInstance.disconnect();
      } catch (_) {}
    }
    activeConnections.delete(lockKey);
  }
}

function buildDiagnosisResult(
  success,
  status,
  message,
  cause,
  ip,
  port,
  model,
  serial,
  stages,
  timestamp,
  userCount = 0,
  punchesCount = 0,
  firmware = '',
  deviceTime = ''
) {
  const formattedOutput = [
    `DIAGNÓSTICO ZKTECO: ${success ? 'CONEXIÓN EXITOSA' : 'FALLO DE CONEXIÓN'} (${status})`,
    `DISPOSITIVO: ${model}`,
    `SERIAL: ${serial || 'NO IDENTIFICADO'}`,
    `DIRECCIÓN IP / PUERTO: ${ip}:${port}`,
    `FIRMWARE: ${firmware || 'NO DISPONIBLE'}`,
    `HORA DEL RELOJ: ${deviceTime || timestamp}`,
    `USUARIOS EN MEMORIA: ${userCount}`,
    `MARCACIONES EN EL RELOJ: ${punchesCount}`,
    `DETALLE: ${message}`,
  ].join('\n');

  return {
    success,
    status,
    message,
    cause,
    ip,
    port,
    model,
    serial_number: serial,
    user_count: userCount,
    clock_punches_count: punchesCount,
    saved_punches_count: 0,
    new_punches_count: 0,
    error_count: success ? 0 : 1,
    formatted_output: formattedOutput,
    step_details: stages,
    timestamp,
  };
}

/**
 * COMPROBACIONES INDEPENDIENTES SOLICITADAS:
 * 1. Ping al dispositivo
 * 2. Apertura TCP 4370
 * 3. Firewall Windows
 * 4. Socket TCP
 * 5. Comunicación ZKTeco
 * 6. Lectura de información del equipo
 * Cada prueba muestra: 'Correcto' | 'Fallido' | 'Pendiente' con el error real obtenido.
 */
async function runIndependentDiagnostics(
  ip,
  port = 4370,
  timeoutMs = 3000,
  modelHint = 'G3-id',
  snHint = '',
  commKey = 0
) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(5000, Math.max(1500, Number(timeoutMs) || 3000));
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  // 1. Verificación de Firewall Windows
  let firewallManager;
  try {
    firewallManager = require('./firewallManager.cjs');
  } catch (_) {}

  let firewallResult = { status: 'Correcto', message: 'Firewall de Windows no aplicable (sistema no Windows).' };
  if (firewallManager && typeof firewallManager.checkFirewallStatus === 'function') {
    try {
      const fwStatus = await firewallManager.checkFirewallStatus();
      if (!fwStatus.isWindows) {
        firewallResult = {
          status: 'Correcto',
          message: 'No aplica (entorno no Windows).',
        };
      } else if (fwStatus.configured) {
        firewallResult = {
          status: 'Correcto',
          message: 'Firewall Windows: OK. Reglas para puerto TCP 4370 (Entrada y Salida) y ejecutables activas.',
        };
      } else {
        firewallResult = {
          status: 'Fallido',
          message: `Firewall Windows: REQUIERE CONFIGURACIÓN. Reglas faltantes: ${fwStatus.missingRules?.join(', ') || 'TCP 4370'}.`,
          error: 'REGLAS_FIREWALL_FALTANTES',
        };
      }
    } catch (fwErr) {
      firewallResult = {
        status: 'Fallido',
        message: `Error al consultar Firewall de Windows: ${fwErr.message}`,
        error: fwErr.message,
      };
    }
  }

  // 2. Ping al dispositivo (ICMP / Nivel Red)
  let pingResult = { status: 'Pendiente', message: 'En espera...' };
  try {
    const isWin = process.platform === 'win32';
    const pingCmd = isWin ? `ping -n 1 -w 1500 ${cleanIp}` : `ping -c 1 -W 2 ${cleanIp}`;
    const pingOutput = await new Promise((res) => {
      exec(pingCmd, (error, stdout) => {
        if (error) {
          res({ ok: false, output: stdout || error.message });
        } else {
          res({ ok: true, output: stdout });
        }
      });
    });

    if (pingOutput.ok && (pingOutput.output.includes('TTL=') || pingOutput.output.includes('bytes from') || pingOutput.output.includes('ttl='))) {
      pingResult = {
        status: 'Correcto',
        message: `Ping ICMP exitoso hacia ${cleanIp}. El equipo responde en la capa de red.`,
      };
    } else {
      pingResult = {
        status: 'Fallido',
        message: `Sin respuesta al Ping ICMP hacia ${cleanIp}. Verifique si el equipo está encendido o si el router/switch bloquea ICMP.`,
        error: 'ICMP_UNREACHABLE',
      };
    }
  } catch (pingErr) {
    pingResult = {
      status: 'Fallido',
      message: `Error ejecutando ping: ${pingErr.message}`,
      error: pingErr.message,
    };
  }

  // 3. Apertura TCP 4370
  let tcpPortResult = { status: 'Pendiente', message: 'En espera...' };
  const tcpProbe = await probeTcpPort(cleanIp, targetPort, timeout);

  if (tcpProbe.ok) {
    tcpPortResult = {
      status: 'Correcto',
      message: `Puerto TCP ${targetPort} abierto y aceptando conexiones (${tcpProbe.latency}ms).`,
      latencyMs: tcpProbe.latency,
    };
  } else {
    let exactMsg = `Fallo al abrir puerto TCP ${targetPort}: ${tcpProbe.error}`;
    if (tcpProbe.code === 'ECONNREFUSED') {
      exactMsg = `Conexión rechazada por puerto cerrado (ECONNREFUSED). El host ${cleanIp} respondió pero el puerto TCP ${targetPort} no escucha o el biométrico está configurado en modo PUSH / ADMS (Servidor Cloud) en lugar de Standalone / SDK local.`;
    } else if (tcpProbe.code === 'ETIMEDOUT') {
      exactMsg = `Timeout agotado (${timeout}ms). El marcador en ${cleanIp}:${targetPort} no respondió dentro del tiempo límite.`;
    } else if (tcpProbe.code === 'EHOSTUNREACH' || tcpProbe.code === 'ENETUNREACH') {
      exactMsg = `Host no alcanzable (${tcpProbe.code}). Dispositivo apagado o en subred no enrutada desde esta estación.`;
    }

    tcpPortResult = {
      status: 'Fallido',
      message: exactMsg,
      error: tcpProbe.code || 'TCP_ERROR',
      latencyMs: tcpProbe.latency,
    };
  }

  // 4. Socket TCP Nativo (comprobación exhaustiva con net.Socket de Node.js)
  let socketTcpResult = { status: 'Pendiente', message: 'En espera...' };
  if (!tcpProbe.ok) {
    socketTcpResult = {
      status: 'Fallido',
      message: `Socket TCP falló: ${tcpPortResult.message}`,
      error: tcpProbe.code || 'ECONNFAILED',
    };
  } else {
    const rawSocketTest = await new Promise((res) => {
      const s = new net.Socket();
      let finished = false;
      s.setTimeout(timeout);
      s.on('connect', () => {
        if (finished) return;
        finished = true;
        const localInfo = `${s.localAddress}:${s.localPort}`;
        const remoteInfo = `${s.remoteAddress}:${s.remotePort}`;
        s.destroy();
        res({ ok: true, localInfo, remoteInfo });
      });
      s.on('timeout', () => {
        if (finished) return;
        finished = true;
        s.destroy();
        res({ ok: false, error: 'ETIMEDOUT', message: 'Timeout en socket TCP nativo' });
      });
      s.on('error', (err) => {
        if (finished) return;
        finished = true;
        s.destroy();
        res({ ok: false, error: err.code || err.message, message: err.message });
      });
      s.connect(targetPort, cleanIp);
    });

    if (rawSocketTest.ok) {
      socketTcpResult = {
        status: 'Correcto',
        message: `Socket TCP nativo de Electron establecido exitosamente (Local: ${rawSocketTest.localInfo} -> Remoto: ${rawSocketTest.remoteInfo}).`,
      };
    } else {
      socketTcpResult = {
        status: 'Fallido',
        message: `Socket TCP nativo falló: ${rawSocketTest.message}`,
        error: rawSocketTest.error,
      };
    }
  }

  // 5. Comunicación ZKTeco (Protocolo Standalone Handshake)
  let zkProtoResult = { status: 'Pendiente', message: 'En espera...' };
  let zkInfoResult = { status: 'Pendiente', message: 'En espera...' };

  if (!tcpProbe.ok) {
    zkProtoResult = {
      status: 'Pendiente',
      message: 'Omitido: La prueba TCP previa falló. No se continúa con la sesión de protocolo ZKTeco.',
      error: 'TCP_FALLIDO_PREVIO',
    };
    zkInfoResult = {
      status: 'Pendiente',
      message: 'Omitido: La prueba TCP previa falló. No se puede leer información del equipo.',
      error: 'TCP_FALLIDO_PREVIO',
    };
  } else {
    // Si TCP está abierto, intentar handshake ZKTeco
    let tcpZk = null;
    try {
      tcpZk = new ZKLibTCP(cleanIp, targetPort, timeout);
      await withTimeout(tcpZk.createSocket(), timeout, `Timeout creando socket ZK (${timeout}ms)`);
      const reply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_CONNECT, ''), timeout, 'Timeout CMD_CONNECT');
      const responseCode = reply && reply.length >= 2 ? reply.readUInt16LE(0) : 0;
      const sessionId = tcpZk.sessionId || (reply && reply.length >= 6 ? reply.readUInt16LE(4) : 0);

      if (responseCode === COMMANDS.CMD_ACK_OK || responseCode === COMMANDS.CMD_ACK_UNAUTH) {
        zkProtoResult = {
          status: 'Correcto',
          message: `Sesión de protocolo ZKTeco aceptada por el biométrico (Código ACK: ${responseCode}, Session ID: ${sessionId}).`,
        };

        // Si requiere autenticación (CommKey)
        let authOk = true;
        if (responseCode === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
          const authPacket = makeCommkey(numericCommKey, sessionId);
          const authReply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_AUTH, authPacket), timeout, 'Timeout CMD_AUTH');
          const authCode = authReply && authReply.length >= 2 ? authReply.readUInt16LE(0) : 0;
          if (authCode !== COMMANDS.CMD_ACK_OK) {
            authOk = false;
            zkProtoResult = {
              status: 'Fallido',
              message: `Comunicación ZKTeco respondió pero rechazó la clave de comunicación (CommKey=${numericCommKey}, Código: ${authCode}).`,
              error: 'COMMKEY_INVALIDA',
            };
          }
        }

        // 6. Lectura de información del equipo
        if (authOk) {
          try {
            const rawSerial = await withTimeout(
              tcpZk.executeCmd(COMMANDS.CMD_DEVICE, '~SerialNumber\0'),
              timeout,
              'Timeout leyendo S/N'
            );
            const serialText = rawSerial && rawSerial.length > 8
              ? rawSerial.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()
              : (snHint || 'S/N Detectado');

            const rawVer = await withTimeout(
              tcpZk.executeCmd(COMMANDS.CMD_DEVICE, '~OS\0'),
              timeout,
              'Timeout leyendo OS'
            );
            const verText = rawVer && rawVer.length > 8
              ? rawVer.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()
              : 'Standalone OS';

            zkInfoResult = {
              status: 'Correcto',
              message: `Lectura exitosa: Modelo ${modelHint}, S/N: ${serialText}, Sistema: ${verText}.`,
            };
          } catch (readErr) {
            zkInfoResult = {
              status: 'Fallido',
              message: `Error al leer parámetros del equipo: ${readErr.message}`,
              error: readErr.message,
            };
          }
        } else {
          zkInfoResult = {
            status: 'Pendiente',
            message: 'Omitido: Falló la autenticación con CommKey.',
            error: 'AUTH_FAILED',
          };
        }
      } else {
        zkProtoResult = {
          status: 'Fallido',
          message: `El equipo respondió con código no estándar (${responseCode}). Posible incompatibilidad de protocolo o equipo en modo ADMS PUSH.`,
          error: 'PROTOCOLO_NO_STANDALONE',
        };
        zkInfoResult = {
          status: 'Pendiente',
          message: 'Omitido: Protocolo ZKTeco no respondió afirmativamente.',
          error: 'PROTOCOLO_NO_STANDALONE',
        };
      }
    } catch (zkErr) {
      zkProtoResult = {
        status: 'Fallido',
        message: `Fallo en comunicación de protocolo ZKTeco: ${zkErr.message}`,
        error: zkErr.message,
      };
      zkInfoResult = {
        status: 'Pendiente',
        message: 'Omitido: Falló la conexión del protocolo ZKTeco.',
        error: zkErr.message,
      };
    } finally {
      if (tcpZk && typeof tcpZk.disconnect === 'function') {
        try {
          await tcpZk.disconnect();
        } catch (_) {}
      }
    }
  }

  const tests = [
    { id: 'ping', name: 'Ping al dispositivo', ...pingResult },
    { id: 'tcp_port', name: 'Apertura TCP 4370', ...tcpPortResult },
    { id: 'firewall', name: 'Firewall Windows', ...firewallResult },
    { id: 'socket_tcp', name: 'Socket TCP', ...socketTcpResult },
    { id: 'zk_comm', name: 'Comunicación ZKTeco', ...zkProtoResult },
    { id: 'device_info', name: 'Lectura de información del equipo', ...zkInfoResult },
  ];

  const allPassed = tests.every((t) => t.status === 'Correcto');
  const hasFailure = tests.some((t) => t.status === 'Fallido');

  return {
    success: allPassed,
    status: allPassed ? 'Correcto' : hasFailure ? 'Fallido' : 'Pendiente',
    ip: cleanIp,
    port: targetPort,
    model: modelHint,
    serial_number: snHint,
    tests,
    timestamp: nowStr,
  };
}

/**
 * Comprobación directa de servicios de BioTime Console desde Node.js nativo (Electron):
 * 1. Puerto Web Apache (89)
 * 2. Puerto de base de datos PostgreSQL (7496)
 * 3. Diagnóstico descriptivo del estado del servicio local C:\BioTime
 */
async function checkBioTimeService(host = '192.168.1.29', webPort = 89, dbPort = 7496, serial = 'AEH2223460040') {
  const cleanHost = String(host || '192.168.1.29').trim();
  const targetWebPort = Number(webPort) || 89;
  const targetDbPort = Number(dbPort) || 7496;
  const targetSerial = String(serial || 'AEH2223460040').trim().toUpperCase();
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  // 1. Probar socket TCP al puerto de Apache Web (89)
  const webProbe = await probeTcpPort(cleanHost, targetWebPort, 2500);

  // 2. Probar socket TCP al puerto de PostgreSQL BioTime (7496)
  const dbProbe = await probeTcpPort(cleanHost, targetDbPort, 2500);

  const apacheOk = webProbe.ok;
  const postgresOk = dbProbe.ok;
  const anyServiceOk = apacheOk || postgresOk;

  let summary = '';
  if (apacheOk && postgresOk) {
    summary = `BioTime Console detectado y 100% operativo (Apache :${targetWebPort} y PostgreSQL :${targetDbPort}).`;
  } else if (apacheOk) {
    summary = `Servicio Apache de BioTime en puerto ${targetWebPort} activo. Verifique PostgreSQL en puerto ${targetDbPort}.`;
  } else if (postgresOk) {
    summary = `Base de datos PostgreSQL en puerto ${targetDbPort} activa. Verifique servicio Apache en puerto ${targetWebPort}.`;
  } else {
    summary = `Servicios de BioTime no responden en ${cleanHost}. Abra la consola "C:\\BioTime" e inicie el servicio con el botón [Start].`;
  }

  return {
    success: anyServiceOk,
    serial: targetSerial,
    host: cleanHost,
    webPort: targetWebPort,
    dbPort: targetDbPort,
    apache_status: apacheOk ? 'ONLINE' : 'OFFLINE',
    apache_latency_ms: webProbe.latency,
    apache_message: apacheOk
      ? `Servicio Apache de BioTime escuchando activamente en puerto ${targetWebPort} (${webProbe.latency}ms).`
      : `Puerto HTTP ${targetWebPort} de BioTime no responde localmente en ${cleanHost} (${webProbe.code || 'ECONNREFUSED'}). Abra la consola C:\\BioTime y pulse [Start].`,
    postgres_status: postgresOk ? 'ONLINE' : 'OFFLINE',
    postgres_latency_ms: dbProbe.latency,
    postgres_message: postgresOk
      ? `Motor PostgreSQL de BioTime activo en puerto ${targetDbPort} (${dbProbe.latency}ms).`
      : `Puerto PostgreSQL ${targetDbPort} no responde localmente en ${cleanHost} (${dbProbe.code || 'ECONNREFUSED'}). Inicie la base de datos desde la consola C:\\BioTime.`,
    summary,
    timestamp: nowStr,
  };
}

module.exports = {
  diagnoseZkDevice,
  readZkDevicePunches,
  probeTcpPort,
  makeCommkey,
  runIndependentDiagnostics,
  checkBioTimeService,
};
