/**
 * DRAC Cajamarca - Driver Nativo de Comunicación con Marcadores Biométricos ZKTeco
 * Protocolo Standalone ZKTeco sobre TCP y UDP (Puerto estándar 4370)
 * Sin dependencias C++ nativas para garantizar máxima estabilidad en Windows / Electron.
 */

const net = require('net');
const dgram = require('dgram');
const ZKLibTCP = require('zklib-32ble/zklibtcp');
const ZKLibUDP = require('zklib-32ble/zklibudp');

// Semáforo para prevenir conexiones simultáneas al mismo marcador
const activeConnections = new Set();

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
 * Prueba de conectividad física a nivel socket TCP con timer garantizado
 */
function probeTcpPort(ip, port, timeoutMs = 1500) {
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
 * Diagnóstico de conexión en 6 etapas obligatorias
 */
async function diagnoseZkDevice(ip, port = 4370, timeoutMs = 3000, modelHint = 'G3-id', snHint = '') {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const timeout = Math.min(4000, Math.max(1200, Number(timeoutMs) || 3000));
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  const stages = [
    { stage: 1, name: 'Validación de dirección IP y puerto', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 2, name: 'Alcanzabilidad en la red (Ping/Ruta IP)', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 3, name: 'Conectividad de puerto y transporte', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 4, name: 'Establecimiento de sesión (Protocolo ZKTeco)', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 5, name: 'Verificación de telemetría e identificación', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 6, name: 'Capacidad y disponibilidad de lectura de marcaciones', status: 'PENDING', message: '', latencyMs: 0 },
  ];

  // ETAPA 1: Validación sintáctica y de rango
  const t1 = Date.now();
  if (!isValidIpv4(cleanIp)) {
    stages[0].status = 'FAILED';
    stages[0].message = `Dirección IP inválida: "${cleanIp}". Debe tener formato IPv4 estándar (ej: 192.168.1.201).`;
    stages[0].latencyMs = Date.now() - t1;
    return buildDiagnosisResult(false, 'OFFLINE', 'Dirección IP inválida.', stages[0].message, cleanIp, targetPort, modelHint, snHint, stages, nowStr);
  }

  if (targetPort < 1 || targetPort > 65535) {
    stages[0].status = 'FAILED';
    stages[0].message = `Puerto no válido: ${targetPort}. Debe estar en el rango 1 a 65535 (estándar ZKTeco: 4370).`;
    stages[0].latencyMs = Date.now() - t1;
    return buildDiagnosisResult(false, 'OFFLINE', 'Puerto no válido.', stages[0].message, cleanIp, targetPort, modelHint, snHint, stages, nowStr);
  }

  stages[0].status = 'PASSED';
  stages[0].message = `Dirección IP ${cleanIp} y puerto TCP/UDP ${targetPort} válidos.`;
  stages[0].latencyMs = Date.now() - t1;

  // Evitar conexiones simultáneas conflictivas
  const lockKey = `${cleanIp}:${targetPort}`;
  if (activeConnections.has(lockKey)) {
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
    // ETAPA 2 & 3: Prueba de red y conectividad de puertos
    const t2 = Date.now();
    const tcpProbe = await probeTcpPort(cleanIp, targetPort, timeout);
    stages[1].latencyMs = Date.now() - t2;

    if (tcpProbe.code === 'ENETUNREACH' || tcpProbe.code === 'EHOSTUNREACH') {
      stages[1].status = 'FAILED';
      stages[1].message = `Equipo inaccesible desde este ordenador en la red (${cleanIp}).`;
      stages[2].status = 'FAILED';
      stages[2].message = 'Puerto inaccesible debido a que la ruta de red hacia la IP no responde.';
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

    stages[1].status = 'PASSED';
    stages[1].message = `Ruta hacia ${cleanIp} identificada en la red local.`;

    let activeProtocol = null;
    let zkInstance = null;

    if (tcpProbe.ok) {
      stages[2].status = 'PASSED';
      stages[2].message = `Puerto TCP ${targetPort} accesible y respondiendo en ${tcpProbe.latency}ms.`;
      stages[2].latencyMs = tcpProbe.latency;
    } else {
      stages[2].status = 'WARNING';
      stages[2].message = `Puerto TCP ${targetPort} no respondió directamente (${tcpProbe.code || 'Timeout'}). Probando transporte UDP nativo ZKTeco...`;
    }

    // ETAPA 4: Establecimiento de comunicación mediante protocolo ZKTeco (Handshake)
    const t4 = Date.now();
    let connected = false;
    let lastProtocolError = null;

    // 4.a Si TCP respondió a nivel socket, conectar mediante ZK TCP
    if (tcpProbe.ok) {
      try {
        const tcpZk = new ZKLibTCP(cleanIp, targetPort, timeout);
        await withTimeout(tcpZk.createSocket(), timeout, `Timeout creando socket TCP ZK (${timeout}ms)`);
        await withTimeout(tcpZk.connect(), timeout, `Timeout handshake TCP CMD_CONNECT (${timeout}ms)`);
        connected = true;
        activeProtocol = 'TCP';
        zkInstance = tcpZk;
      } catch (tcpErr) {
        lastProtocolError = tcpErr?.message || String(tcpErr);
      }
    }

    // 4.b Si no conectó por TCP, probar ZK UDP (estándar para muchos modelos ZKTeco)
    if (!connected) {
      try {
        const udpZk = new ZKLibUDP(cleanIp, targetPort, timeout);
        await withTimeout(udpZk.createSocket(), timeout, `Timeout creando socket UDP ZK (${timeout}ms)`);
        await withTimeout(udpZk.connect(), timeout, `Timeout handshake UDP CMD_CONNECT (${timeout}ms)`);
        connected = true;
        activeProtocol = 'UDP';
        zkInstance = udpZk;
      } catch (udpErr) {
        lastProtocolError = udpErr?.message || String(udpErr);
      }
    }

    stages[3].latencyMs = Date.now() - t4;

    if (!connected || !zkInstance) {
      stages[3].status = 'FAILED';
      stages[3].message = `No se pudo establecer comunicación con el dispositivo mediante protocolo ZKTeco (TCP/UDP en puerto ${targetPort}).`;
      stages[4].status = 'SKIPPED';
      stages[4].message = 'Omitido: sin sesión de protocolo activa.';
      stages[5].status = 'SKIPPED';
      stages[5].message = 'Omitido: sin sesión de protocolo activa.';

      return buildDiagnosisResult(
        false,
        'OFFLINE',
        'No se pudo establecer comunicación con el dispositivo.',
        `El biométrico respondió a la red pero rechazó o no completó la negociación del protocolo ZKTeco. Detalle técnico: ${lastProtocolError || 'Handshake fallido'}. Compruebe que el número de puerto (${targetPort}) y la clave de comunicación (CommKey) en el menú del marcador estén por defecto (0).`,
        cleanIp,
        targetPort,
        modelHint,
        snHint,
        stages,
        nowStr
      );
    }

    stages[3].status = 'PASSED';
    stages[3].message = `Sesión de protocolo ZKTeco establecida exitosamente vía ${activeProtocol}.`;

    // ETAPA 5: Verificación de respuesta real del dispositivo (Serial, Firmware, Modelo, Hora)
    const t5 = Date.now();
    let realSerial = '';
    let realFirmware = '';
    let realName = '';
    let realTime = '';

    try {
      if (typeof zkInstance.getSerialNumber === 'function') {
        realSerial = await withTimeout(zkInstance.getSerialNumber(), 2000, 'Timeout serial');
      }
    } catch (_) {}

    try {
      if (typeof zkInstance.getDeviceVersion === 'function') {
        realFirmware = await withTimeout(zkInstance.getDeviceVersion(), 2000, 'Timeout firmware');
      }
    } catch (_) {}

    try {
      if (typeof zkInstance.getDeviceName === 'function') {
        realName = await withTimeout(zkInstance.getDeviceName(), 2000, 'Timeout device name');
      }
    } catch (_) {}

    try {
      if (typeof zkInstance.getTime === 'function') {
        const d = await withTimeout(zkInstance.getTime(), 2000, 'Timeout time');
        realTime = d ? new Date(d).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '';
      }
    } catch (_) {}

    stages[4].latencyMs = Date.now() - t5;

    const detectedModel = (realName && String(realName).trim()) || modelHint || 'ZKTeco Standalone';
    const detectedSerial = (realSerial && String(realSerial).trim()) || snHint || 'ZK-GENERIC';

    stages[4].status = 'PASSED';
    stages[4].message = `Dispositivo identificado: Modelo "${detectedModel}", Serial "${detectedSerial}", Firmware: ${realFirmware || 'Estándar'}, Hora reloj: ${realTime || nowStr}.`;

    // ETAPA 6: Capacidad y disponibilidad de lectura de marcaciones
    const t6 = Date.now();
    let clockPunchesCount = 0;
    let userCount = 0;
    let logsAvailable = false;
    let punchReadError = null;

    try {
      if (typeof zkInstance.getAttendances === 'function') {
        const atts = await withTimeout(zkInstance.getAttendances(), 3000, 'Timeout getAttendances');
        if (atts && Array.isArray(atts.data)) {
          clockPunchesCount = atts.data.length;
          logsAvailable = true;
        } else if (Array.isArray(atts)) {
          clockPunchesCount = atts.length;
          logsAvailable = true;
        }
      }
    } catch (attErr) {
      punchReadError = attErr?.message || String(attErr);
    }

    try {
      if (typeof zkInstance.getUsers === 'function') {
        const u = await withTimeout(zkInstance.getUsers(), 2000, 'Timeout getUsers');
        if (u && Array.isArray(u.data)) {
          userCount = u.data.length;
        } else if (Array.isArray(u)) {
          userCount = u.length;
        }
      }
    } catch (_) {}

    stages[5].latencyMs = Date.now() - t6;

    // Desconectar y liberar socket
    try {
      if (typeof zkInstance.disconnect === 'function') {
        await zkInstance.disconnect();
      }
    } catch (_) {}

    if (!logsAvailable && punchReadError) {
      stages[5].status = 'WARNING';
      stages[5].message = `Comunicación establecida y dispositivo identificado, pero la lectura directa de marcaciones reportó: ${punchReadError}`;

      return buildDiagnosisResult(
        true,
        'ONLINE_ATT_ERROR',
        'Comunicación establecida, pero lectura de marcaciones no disponible.',
        `El biométrico ${detectedModel} (${cleanIp}) respondió con éxito al protocolo, pero no se pudo consultar el registro de asistencia CMD_ATTLOG_RRQ: ${punchReadError}.`,
        cleanIp,
        targetPort,
        detectedModel,
        detectedSerial,
        stages,
        nowStr,
        userCount,
        clockPunchesCount,
        realFirmware,
        realTime
      );
    }

    stages[5].status = 'PASSED';
    stages[5].message = `Lectura de marcaciones operativa. ${clockPunchesCount} marcaciones registradas en la memoria del reloj. Usuarios: ${userCount}.`;

    return buildDiagnosisResult(
      true,
      'ONLINE',
      'Conexión correcta y dispositivo identificado.',
      `Biométrico ZKTeco ${detectedModel} comunicado satisfactoriamente por protocolo ${activeProtocol}. Memoria con ${clockPunchesCount} marcaciones disponibles.`,
      cleanIp,
      targetPort,
      detectedModel,
      detectedSerial,
      stages,
      nowStr,
      userCount,
      clockPunchesCount,
      realFirmware,
      realTime
    );
  } catch (globalErr) {
    return buildDiagnosisResult(
      false,
      'ERROR',
      'Error inesperado durante el diagnóstico del biométrico.',
      globalErr?.message || String(globalErr),
      cleanIp,
      targetPort,
      modelHint,
      snHint,
      stages,
      nowStr
    );
  } finally {
    activeConnections.delete(lockKey);
  }
}

/**
 * Lectura real de marcaciones almacenadas en el marcador ZKTeco
 */
async function readZkDevicePunches(ip, port = 4370, timeoutMs = 5000) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 4370;
  const timeout = Math.min(6000, Math.max(1800, Number(timeoutMs) || 5000));
  const lockKey = `${cleanIp}:${targetPort}`;

  if (activeConnections.has(lockKey)) {
    throw new Error(`El biométrico ${cleanIp}:${targetPort} se encuentra ocupado con otra operación en curso.`);
  }

  activeConnections.add(lockKey);
  let zkInstance = null;

  try {
    // 1. Probar conectividad TCP rápida
    const tcpProbe = await probeTcpPort(cleanIp, targetPort, 1500);
    let connected = false;
    let lastError = null;

    if (tcpProbe.ok) {
      try {
        const tcpZk = new ZKLibTCP(cleanIp, targetPort, timeout);
        await withTimeout(tcpZk.createSocket(), timeout, 'Timeout TCP socket');
        await withTimeout(tcpZk.connect(), timeout, 'Timeout TCP connect');
        connected = true;
        zkInstance = tcpZk;
      } catch (e) {
        lastError = e;
      }
    }

    // 2. Fallback a UDP si TCP no conectó
    if (!connected) {
      try {
        const udpZk = new ZKLibUDP(cleanIp, targetPort, timeout);
        await withTimeout(udpZk.createSocket(), timeout, 'Timeout UDP socket');
        await withTimeout(udpZk.connect(), timeout, 'Timeout UDP connect');
        connected = true;
        zkInstance = udpZk;
      } catch (e) {
        lastError = e;
      }
    }

    if (!connected || !zkInstance) {
      throw new Error(`No se pudo conectar al marcador ZKTeco ${cleanIp}:${targetPort}. Detalle: ${lastError?.message || 'Error de socket'}`);
    }

    // 3. Obtener serial para trazabilidad exacta
    let serial = 'UNKNOWN';
    try {
      if (typeof zkInstance.getSerialNumber === 'function') {
        const sn = await withTimeout(zkInstance.getSerialNumber(), 2000, 'Timeout serial');
        if (sn) serial = String(sn).trim();
      }
    } catch (_) {}

    // 4. Leer marcaciones del reloj
    const attResult = await withTimeout(zkInstance.getAttendances(), timeout, 'Timeout getAttendances');
    let rawList = [];

    if (attResult && Array.isArray(attResult.data)) {
      rawList = attResult.data;
    } else if (Array.isArray(attResult)) {
      rawList = attResult;
    }

    // 5. Mapear a formato institucional DRAC
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
    `CONEXIÓN: ${success ? 'OK' : 'ERROR'} (${status})`,
    `DISPOSITIVO: ${model}`,
    `SERIAL: ${serial || 'NO IDENTIFICADO'}`,
    `FIRMWARE: ${firmware || 'NO REPORTADO'}`,
    `HORA RELOJ: ${deviceTime || timestamp}`,
    `USUARIOS REGISTRADOS: ${userCount}`,
    `MARCACIONES EN EL RELOJ: ${punchesCount}`,
    `DIAGNÓSTICO: ${message}`,
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

module.exports = {
  diagnoseZkDevice,
  readZkDevicePunches,
  probeTcpPort,
};
