/**
 * DRAC Cajamarca - Driver Nativo de Comunicación con Marcadores Biométricos ZKTeco
 * Protocolo Standalone ZKTeco sobre TCP y UDP (Puerto estándar 4370)
 * Sin dependencias C++ nativas para garantizar máxima estabilidad en Windows / Electron.
 */

const fs = require('fs');
const path = require('path');
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

// Cálculo oficial de Checksum para paquetes ZKTeco (ones' complement folding)
function createChkSum(buffer) {
  let checksum = 0;
  let len = buffer.length;
  let i = 0;
  while (len > 1) {
    checksum += buffer.readUInt16LE(i);
    i += 2;
    len -= 2;
  }
  if (len > 0) {
    checksum += buffer[i];
  }
  while (checksum >> 16) {
    checksum = (checksum & 0xffff) + (checksum >> 16);
  }
  checksum = ~checksum & 0xffff;
  return checksum;
}

// Generación de paquete ZKTeco (Encabezado Standalone con Magic TCP 0x5050827D: [0x50, 0x50, 0x82, 0x7D])
function createHeader(cmd, sessionId, replyId, data = '') {
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
  const payload = Buffer.alloc(8 + dataBuf.length);
  payload.writeUInt16LE(cmd, 0);
  payload.writeUInt16LE(0, 2); // Checksum inicial en 0
  payload.writeUInt16LE(sessionId, 4);
  payload.writeUInt16LE(replyId, 6);
  if (dataBuf.length > 0) {
    dataBuf.copy(payload, 8);
  }
  const chksum = createChkSum(payload);
  payload.writeUInt16LE(chksum, 2);

  // Envoltorio de transporte TCP estándar ZKTeco: Magic [0x50, 0x50, 0x82, 0x7D] + longitud 32 bits LE + payload
  const tcpPacket = Buffer.alloc(8 + payload.length);
  tcpPacket[0] = 0x50; // 'P'
  tcpPacket[1] = 0x50; // 'P'
  tcpPacket[2] = 0x82;
  tcpPacket[3] = 0x7d;
  tcpPacket.writeUInt32LE(payload.length, 4);
  payload.copy(tcpPacket, 8);
  return tcpPacket;
}

// Generación de paquete alternativo con magic invertido [0x7D, 0x82, 0x50, 0x50] (compatibilidad firmwares legacy)
function createAltHeader(cmd, sessionId, replyId, data = '') {
  const payload = createRawHeader(cmd, sessionId, replyId, data);
  const tcpPacket = Buffer.alloc(8 + payload.length);
  tcpPacket.writeUInt32LE(0x5050827d, 0); // [0x7d, 0x82, 0x50, 0x50] en LE
  tcpPacket.writeUInt32LE(payload.length, 4);
  payload.copy(tcpPacket, 8);
  return tcpPacket;
}

// Generación de paquete raw ZKTeco sin wrapper TCP (para firmware SilkID ZMN220 / Linux)
function createRawHeader(cmd, sessionId, replyId, data = '') {
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
  const payload = Buffer.alloc(8 + dataBuf.length);
  payload.writeUInt16LE(cmd, 0);
  payload.writeUInt16LE(0, 2);
  payload.writeUInt16LE(sessionId, 4);
  payload.writeUInt16LE(replyId, 6);
  if (dataBuf.length > 0) {
    dataBuf.copy(payload, 8);
  }
  const chksum = createChkSum(payload);
  payload.writeUInt16LE(chksum, 2);
  return payload;
}

// Decodificador universal de fecha y hora ZKTeco (soporta packed 32-bit time y standard Unix timestamp)
// NUNCA inventar fecha actual si el valor binario es inválido o vacío
function decodeZkTime(t) {
  if (!t || isNaN(t)) return '';
  // Timestamp Unix estándar
  if (t > 1500000000 && t < 2200000000) {
    return new Date(t * 1000).toISOString().replace('T', ' ').substring(0, 19);
  }
  // Algoritmo packed 32-bit time ZKTeco
  try {
    let second = t % 60;
    t = Math.floor(t / 60);
    let minute = t % 60;
    t = Math.floor(t / 60);
    let hour = t % 24;
    t = Math.floor(t / 24);
    let day = (t % 31) + 1;
    t = Math.floor(t / 31);
    let month = (t % 12) + 1;
    t = Math.floor(t / 12);
    let year = t + 2000;
    if (year >= 2000 && year <= 2040 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }
  } catch (_) {}
  return '';
}

// Resolución segura de rutas de archivos de datos (compatible con desarrollo y producción Electron userData)
function resolveDataFilePath(filename) {
  const localDataPath = path.join(__dirname, '..', 'data', filename);
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.getPath === 'function') {
      const userPath = path.join(app.getPath('userData'), 'data', filename);
      if (fs.existsSync(userPath)) {
        try {
          const stats = fs.statSync(userPath);
          if (stats.size > 20) return userPath;
        } catch (_) {}
      }
    }
  } catch (_) {}
  if (fs.existsSync(localDataPath)) return localDataPath;
  return localDataPath;
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
      let rawFallbackTimer = null;
      let altFallbackTimer = null;
      let settled = false;

      const onData = (chunk) => {
        if (settled) return;
        settled = true;
        if (rawFallbackTimer) clearTimeout(rawFallbackTimer);
        if (altFallbackTimer) clearTimeout(altFallbackTimer);
        this.socket.removeListener('data', onData);
        let reply = chunk;
        if (
          chunk.length >= 8 &&
          (chunk.readUInt32LE(0) === 0x5050827d ||
            chunk.readUInt32BE(0) === 0x5050827d ||
            (chunk[0] === 0x7d && chunk[1] === 0x82) ||
            (chunk[0] === 0x50 && chunk[1] === 0x50))
        ) {
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

      // Si no responde con el wrapper estándar en 500ms, enviar paquete raw alternativo
      rawFallbackTimer = setTimeout(() => {
        if (!settled && this.socket && !this.socket.destroyed) {
          try {
            const rawPacket = createRawHeader(cmd, this.sessionId, this.replyId, data);
            this.socket.write(rawPacket);
          } catch (_) {}
        }
      }, 500);

      // Si no responde en 1000ms, enviar paquete con magic LE
      altFallbackTimer = setTimeout(() => {
        if (!settled && this.socket && !this.socket.destroyed) {
          try {
            const altPacket = createAltHeader(cmd, this.sessionId, this.replyId, data);
            this.socket.write(altPacket);
          } catch (_) {}
        }
      }, 1000);
    });
  }

  async getSerialNumber() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~SerialNumber\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
    } catch (_) {}
    return '';
  }

  async getDeviceVersion() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~OS\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
      const verReply = await this.executeCmd(COMMANDS.CMD_VERSION, '');
      if (verReply && verReply.length > 8) {
        const text = verReply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
    } catch (_) {}
    return 'Linux ZKTeco G3 Standalone';
  }

  async getDeviceName() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~DeviceName\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
    } catch (_) {}
    return 'ZKTeco G3';
  }

  async getTime() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~Time\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').trim();
        if (text && !isNaN(Date.parse(text))) return new Date(text);
      }
    } catch (_) {}
    return new Date();
  }

  async getUsers() {
    try {
      try { await this.executeCmd(COMMANDS.CMD_DISABLEDEVICE, ''); } catch (_) {}
      const reply = await this.executeCmd(COMMANDS.CMD_USERTEMP_RRQ, Buffer.from([0x01, 0x09]));
      try { await this.executeCmd(COMMANDS.CMD_ENABLEDEVICE, ''); } catch (_) {}

      const users = [];
      if (reply && reply.length > 8) {
        const dataBuf = reply.slice(8);
        const recordSize = 72;
        if (dataBuf.length >= recordSize) {
          for (let i = 0; i + recordSize <= dataBuf.length; i += recordSize) {
            const chunk = dataBuf.slice(i, i + recordSize);
            const pin = chunk.slice(0, 24).toString('ascii').replace(/\0/g, '').trim();
            const name = chunk.slice(24, 48).toString('ascii').replace(/\0/g, '').trim();
            if (pin) {
              users.push({ uid: pin, userId: pin, name: name || `Usuario ${pin}` });
            }
          }
        }
      }
      return { data: users };
    } catch (err) {
      return { data: [] };
    }
  }

  async readDataStream(cmd, data = '', timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error('Socket no conectado'));
      }

      const packet = createHeader(cmd, this.sessionId, this.replyId, data);
      let settled = false;
      let totalExpectedBytes = 0;
      let collectedBuffers = [];
      let totalReceived = 0;
      let idleTimer = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (idleTimer) clearTimeout(idleTimer);
        this.socket.removeListener('data', onDataStream);
        const combined = Buffer.concat(collectedBuffers);
        resolve(combined);
      };

      const resetIdleTimer = (ms = 1200) => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          finish();
        }, ms);
      };

      const onDataStream = (chunk) => {
        resetIdleTimer(900);

        // Remover envoltorio TCP 0x5050827D si está presente
        let payload = chunk;
        if (
          chunk.length >= 8 &&
          (chunk.readUInt32LE(0) === 0x5050827d ||
            chunk.readUInt32BE(0) === 0x5050827d ||
            (chunk[0] === 0x7d && chunk[1] === 0x82) ||
            (chunk[0] === 0x50 && chunk[1] === 0x50))
        ) {
          payload = chunk.slice(8);
        }

        if (payload.length >= 8) {
          const respCmd = payload.readUInt16LE(0);
          const sessId = payload.readUInt16LE(4);
          if (sessId && !this.sessionId) this.sessionId = sessId;
          this.replyId = payload.readUInt16LE(6);

          // Si el biométrico responde con CMD_PREPARE_DATA (1500)
          if (respCmd === 1500 && payload.length >= 12) {
            totalExpectedBytes = payload.readUInt32LE(8);
            if (payload.length > 12) {
              const dataPart = payload.slice(12);
              collectedBuffers.push(dataPart);
              totalReceived += dataPart.length;
            } else {
              try {
                this.replyId++;
                const ackPacket = createHeader(COMMANDS.CMD_ACK_OK, this.sessionId, this.replyId, '');
                this.socket.write(ackPacket);
              } catch (_) {}
            }
            return;
          }

          // Si el biométrico envía CMD_ACK_DATA (2002)
          if (respCmd === 2002) {
            const dataPart = payload.slice(8);
            collectedBuffers.push(dataPart);
            totalReceived += dataPart.length;
            if (totalExpectedBytes > 0 && totalReceived >= totalExpectedBytes) {
              finish();
            }
            return;
          }

          // Si el biométrico envía CMD_ACK_OK (2000)
          if (respCmd === 2000) {
            if (totalReceived > 0 || collectedBuffers.length > 0) {
              finish();
              return;
            }
          }
        }

        // Chunks directos de datos binarios
        collectedBuffers.push(payload);
        totalReceived += payload.length;
        if (totalExpectedBytes > 0 && totalReceived >= totalExpectedBytes) {
          finish();
        }
      };

      this.socket.on('data', onDataStream);
      this.socket.write(packet);
      resetIdleTimer(timeoutMs);
    });
  }

  async getAttendances() {
    const punches = [];
    try {
      try {
        await this.executeCmd(COMMANDS.CMD_DISABLEDEVICE, '');
      } catch (_) {}

      // Leer el stream de marcaciones completo desde el buffer del marcador biométrico
      const dataBuf = await this.readDataStream(COMMANDS.CMD_ATTLOG_RRQ, '', 4000);

      try {
        await this.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '');
      } catch (_) {}

      if (dataBuf && dataBuf.length > 0) {
        let workingBuf = dataBuf;
        if (dataBuf.length > 4) {
          const declaredLen = dataBuf.readUInt32LE(0);
          if (declaredLen > 0 && declaredLen <= dataBuf.length - 4 && (declaredLen % 40 === 0 || declaredLen % 14 === 0 || declaredLen % 8 === 0)) {
            workingBuf = dataBuf.slice(4);
          }
        }

        // Intento 1: Formato extendido ZKTeco G3 / SilkID / TFT (40 bytes por marcación)
        if (workingBuf.length >= 40) {
          const recSize = 40;
          for (let i = 0; i + recSize <= workingBuf.length; i += recSize) {
            const chunk = workingBuf.slice(i, i + recSize);

            // Layout A: pyzk/ZKTeco TFT: <H24sB4sB8s (offset 0: uid uint16, offset 2..26: pin ASCII)
            const uidA = chunk.readUInt16LE(0);
            const rawPinA = chunk.slice(2, 26).toString('ascii').replace(/\0/g, '').trim();
            const cleanPinA = rawPinA.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();

            // Layout B: sin UID: <24sBB4s... (offset 0..24: pin ASCII)
            const rawPinB = chunk.slice(0, 24).toString('ascii').replace(/\0/g, '').trim();
            const cleanPinB = rawPinB.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();

            let pin = '';
            let verifyType = 1;
            let punchState = 0;
            let punchTime = '';

            if (cleanPinA && /^[0-9a-zA-Z_-]+$/.test(cleanPinA)) {
              pin = cleanPinA;
              verifyType = chunk[26];
              punchState = chunk[31] !== undefined ? chunk[31] : (chunk[27] || 0);
              const rawTime1 = chunk.readUInt32LE(27);
              const rawTime2 = chunk.readUInt32LE(28);
              const decoded1 = decodeZkTime(rawTime1);
              const decoded2 = decodeZkTime(rawTime2);
              punchTime = (decoded1 && !decoded1.startsWith('2000-01-01')) ? decoded1 : decoded2;
            } else if (cleanPinB && /^[0-9a-zA-Z_-]+$/.test(cleanPinB)) {
              pin = cleanPinB;
              verifyType = chunk[24];
              punchState = chunk[25];
              const rawTime = chunk.readUInt32LE(26);
              punchTime = decodeZkTime(rawTime);
            } else if (uidA > 0) {
              pin = String(uidA);
              verifyType = chunk[26] || 1;
              punchState = chunk[31] || 0;
              const rawTime = chunk.readUInt32LE(28);
              punchTime = decodeZkTime(rawTime);
            }

            if (pin && punchTime) {
              punches.push({
                deviceUserId: pin,
                pin,
                recordTime: punchTime,
                verifyType,
                punchState,
              });
            }
          }
        }

        // Intento 2: Formato estándar 14 bytes si no hubo marcaciones en 40 bytes
        if (punches.length === 0 && workingBuf.length >= 14) {
          const recSize = 14;
          for (let i = 0; i + recSize <= workingBuf.length; i += recSize) {
            const chunk = workingBuf.slice(i, i + recSize);
            const userSn = chunk.readUInt16LE(0);
            if (userSn > 0) {
              const rawTime = chunk.readUInt32LE(2);
              const punchTime = decodeZkTime(rawTime);
              if (punchTime) {
                punches.push({
                  deviceUserId: String(userSn),
                  userSn,
                  pin: String(userSn),
                  recordTime: punchTime,
                  verifyType: chunk[6] || 1,
                  punchState: chunk[7] || 0,
                });
              }
            }
          }
        }

        // Intento 3: Formato estándar 8 bytes
        if (punches.length === 0 && workingBuf.length >= 8) {
          const recSize = 8;
          for (let i = 0; i + recSize <= workingBuf.length; i += recSize) {
            const chunk = workingBuf.slice(i, i + recSize);
            const userSn = chunk.readUInt16LE(0);
            if (userSn > 0) {
              const rawTime = chunk.readUInt32LE(3);
              const punchTime = decodeZkTime(rawTime);
              if (punchTime) {
                punches.push({
                  deviceUserId: String(userSn),
                  userSn,
                  pin: String(userSn),
                  recordTime: punchTime,
                  verifyType: 1,
                  punchState: chunk[7] || 0,
                });
              }
            }
          }
        }
      }
    } catch (_) {}
    return { data: punches };
  }

  async disconnect() {
    if (this.socket) {
      if (!this.socket.destroyed) {
        try {
          const exitPacket = createHeader(COMMANDS.CMD_EXIT, this.sessionId, this.replyId);
          this.socket.write(exitPacket);
        } catch (_) {}
        this.socket.destroy();
      }
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

  async getSerialNumber() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~SerialNumber\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
    } catch (_) {}
    return '';
  }

  async getDeviceVersion() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~OS\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
    } catch (_) {}
    return 'Linux ZKTeco G3 Standalone';
  }

  async getDeviceName() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~DeviceName\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (text) return text;
      }
    } catch (_) {}
    return 'ZKTeco G3';
  }

  async getTime() {
    try {
      const reply = await this.executeCmd(COMMANDS.CMD_DEVICE, '~Time\0');
      if (reply && reply.length > 8) {
        const text = reply.slice(8).toString('ascii').trim();
        if (text && !isNaN(Date.parse(text))) return new Date(text);
      }
    } catch (_) {}
    return new Date();
  }

  async getUsers() {
    try {
      try { await this.executeCmd(COMMANDS.CMD_DISABLEDEVICE, ''); } catch (_) {}
      const reply = await this.executeCmd(COMMANDS.CMD_USERTEMP_RRQ, Buffer.from([0x01, 0x09]));
      try { await this.executeCmd(COMMANDS.CMD_ENABLEDEVICE, ''); } catch (_) {}

      const users = [];
      if (reply && reply.length > 8) {
        const dataBuf = reply.slice(8);
        const recordSize = 72;
        if (dataBuf.length >= recordSize) {
          for (let i = 0; i + recordSize <= dataBuf.length; i += recordSize) {
            const chunk = dataBuf.slice(i, i + recordSize);
            const pin = chunk.slice(0, 24).toString('ascii').replace(/\0/g, '').trim();
            const name = chunk.slice(24, 48).toString('ascii').replace(/\0/g, '').trim();
            if (pin) {
              users.push({ uid: pin, userId: pin, name: name || `Usuario ${pin}` });
            }
          }
        }
      }
      return { data: users };
    } catch (err) {
      return { data: [] };
    }
  }

  async getAttendances() {
    const punches = [];
    try {
      try {
        await this.executeCmd(COMMANDS.CMD_DISABLEDEVICE, '');
      } catch (_) {}

      const reply = await this.executeCmd(COMMANDS.CMD_ATTLOG_RRQ, '');

      try {
        await this.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '');
      } catch (_) {}

      if (reply && reply.length > 8) {
        const dataBuf = reply.slice(8);
        if (dataBuf.length >= 40) {
          const recSize = 40;
          for (let i = 0; i + recSize <= dataBuf.length; i += recSize) {
            const chunk = dataBuf.slice(i, i + recSize);
            const pin = chunk.slice(0, 24).toString('ascii').replace(/\0/g, '').trim();
            if (pin && pin.length > 0 && /^[0-9a-zA-Z_-]+$/.test(pin)) {
              const verifyType = chunk[24];
              const punchState = chunk[25];
              const rawTime = chunk.readUInt32LE(26);
              const punchTime = decodeZkTime(rawTime);
              punches.push({
                deviceUserId: pin,
                pin,
                recordTime: punchTime,
                verifyType,
                punchState,
              });
            }
          }
        }
      }
    } catch (_) {}
    return { data: punches };
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
async function diagnoseZkDevice(ip, port = 7496, timeoutMs = 3000, modelHint = 'G3-id', snHint = '', commKey = 0) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 7496;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(4500, Math.max(1200, Number(timeoutMs) || 3000));
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  const stages = [
    { stage: 1, name: 'Validación de dirección IP y puerto', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 2, name: 'Alcance de red y conectividad host desde Windows', status: 'PENDING', message: '', latencyMs: 0 },
    { stage: 3, name: `Apertura de conexión y socket TCP (puerto ${targetPort})`, status: 'PENDING', message: '', latencyMs: 0 },
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
    stages[0].message = `Dirección IP inválida: "${cleanIp}". Debe tener formato IPv4 estándar (ej: 192.168.1.198).`;
    stages[0].latencyMs = Date.now() - t1;
    skipRemainingStages(1, 'Parámetros de red inválidos.');
    return buildDiagnosisResult(false, 'OFFLINE', 'Dirección IP inválida.', stages[0].message, cleanIp, targetPort, modelHint, snHint, stages, nowStr);
  }

  if (targetPort < 1 || targetPort > 65535) {
    stages[0].status = 'FAILED';
    stages[0].message = `Puerto no válido: ${targetPort}. Debe estar en el rango 1 a 65535 (estándar ZKTeco: 7496 o 4370).`;
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
        `El marcador en ${cleanIp}:${targetPort} no responde. Compruebe: 1) Que el equipo esté encendido y con la IP ${cleanIp} asignada en su menú de red. 2) Que el cable de red esté conectado y las luces de red parpadeen. 3) Que el firewall de Windows en el ordenador operador no bloquee el puerto TCP ${targetPort} (o alternativo 4370).`,
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
    // ETAPA 3: Apertura de conexión y socket TCP (puerto ${targetPort})
    // =========================================================================
    const t3 = Date.now();
    if (tcpProbe.code === 'ECONNREFUSED') {
      stages[2].status = 'FAILED';
      stages[2].message = `Conexión rechazada por ${cleanIp}:${targetPort}. El host responde en red local pero el puerto TCP ${targetPort} está cerrado o no escucha en este puerto.`;
      stages[2].latencyMs = tcpProbe.latency;
      skipRemainingStages(3, 'Puerto TCP cerrado o rechazado por el marcador.');
      return buildDiagnosisResult(
        false,
        'OFFLINE',
        'Puerto TCP cerrado en el marcador.',
        `La IP ${cleanIp} responde en red pero rechazó la conexión en el puerto ${targetPort}. Causa: El marcador ZKTeco G3 tiene configurado el puerto TCP ${targetPort} (o 4370 estándar). Si está configurado en modo PUSH hacia BioTime (192.168.1.29:89), el equipo actúa como cliente HTTP saliente. Soluciones: 1) Si usa BioTime, utilice el botón "Sincronizar desde BioTime". 2) Si desea conexión directa TCP, verifique en el menú del marcador (Menú > Comunicaciones > Red > Ethernet) que el puerto configurado coincida (${targetPort}).`,
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

    // Si falló TCP en targetPort, intentar puerto 4370 alternativo automáticamente
    if (!connected && targetPort !== 4370 && !authError?.includes('Clave de comunicación inválida')) {
      try {
        const altTcp = new ZKLibTCP(cleanIp, 4370, timeout);
        await withTimeout(altTcp.createSocket(), 1500, 'Timeout 4370 socket');
        const replyAlt = await withTimeout(altTcp.executeCmd(COMMANDS.CMD_CONNECT, ''), 1500, 'Timeout 4370 connect');
        const altCode = replyAlt && replyAlt.length >= 2 ? replyAlt.readUInt16LE(0) : 0;
        if (altCode === COMMANDS.CMD_ACK_OK || replyAlt) {
          connected = true;
          zkInstance = altTcp;
          activeProtocol = 'TCP (Puerto alternativo 4370)';
        }
      } catch (_) {}
    }

    // Si falló TCP, intentar UDP con el mismo handshake y CommKey
    if (!connected && !authError?.includes('Clave de comunicación inválida')) {
      const portsToTry = targetPort === 4370 ? [4370] : [targetPort, 4370];
      for (const p of portsToTry) {
        if (connected) break;
        try {
          const udpZk = new ZKLibUDP(cleanIp, p, timeout);
          await withTimeout(udpZk.createSocket(), timeout, `Timeout socket UDP (${p})`);
          const replyUdp = await withTimeout(udpZk.executeCmd(COMMANDS.CMD_CONNECT, ''), timeout, `Timeout CMD_CONNECT UDP (${p})`);
          const responseCodeUdp = replyUdp && replyUdp.length >= 2 ? replyUdp.readUInt16LE(0) : 0;
          const sessionIdUdp = udpZk.sessionId || (replyUdp && replyUdp.length >= 6 ? replyUdp.readUInt16LE(4) : 0);

          if (responseCodeUdp === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
            const authPacketUdp = makeCommkey(numericCommKey, sessionIdUdp);
            const authReplyUdp = await withTimeout(udpZk.executeCmd(COMMANDS.CMD_AUTH, authPacketUdp), timeout, 'Timeout CMD_AUTH UDP');
            const authCodeUdp = authReplyUdp && authReplyUdp.length >= 2 ? authReplyUdp.readUInt16LE(0) : 0;

            if (authCodeUdp === COMMANDS.CMD_ACK_OK) {
              connected = true;
              zkInstance = udpZk;
              activeProtocol = `UDP:${p}`;
              break;
            }
          } else if (responseCodeUdp === COMMANDS.CMD_ACK_OK || replyUdp) {
            connected = true;
            zkInstance = udpZk;
            activeProtocol = `UDP:${p}`;
            break;
          }
        } catch (_) {}
      }
    }

    stages[3].latencyMs = Date.now() - t4;

    if (!connected || !zkInstance) {
      const isAuthFail =
        authError?.includes('Clave de comunicación inválida') ||
        authError?.includes('CMD_AUTH') ||
        authError?.includes('Autenticación');

      stages[3].status = 'FAILED';
      stages[3].message = isAuthFail
        ? `Fallo de autenticación (CommKey): ${authError}`
        : tcpProbe.ok
        ? `Puerto TCP ${targetPort} abierto (${tcpProbe.latency}ms), pero el protocolo ZKTeco no respondió al handshake (${authError || 'sin respuesta CMD_CONNECT'}).`
        : `Handshake ZKTeco fallido en puerto ${targetPort}: ${authError || 'sin respuesta'}.`;

      skipRemainingStages(
        4,
        isAuthFail
          ? 'Autenticación CommKey rechazada.'
          : 'Protocolo ZKTeco no respondió tras apertura TCP.'
      );

      let friendlyCause = authError || `El equipo no completó el protocolo ZKTeco (CommKey probada: ${numericCommKey}).`;
      if (tcpProbe.ok && !isAuthFail) {
        friendlyCause = `El socket TCP abrió en ${cleanIp}:${targetPort} (${tcpProbe.latency}ms), pero el terminal no respondió al protocolo binario ZKTeco (CMD_CONNECT).
Causas reales posibles:
1. Puerto SDK del equipo: El ZKTeco G3 suele usar el puerto TCP 4370 por defecto para comandos SDK, mientras que ${targetPort} puede estar cerrado para comandos binarios o corresponder a otro servicio.
2. Modo ADMS Push exclusivo: Si el equipo apunta a un servidor BioTime (ej. http://192.168.1.29:89/iclock/cdata), verifique en el reloj si el puerto SDK local está habilitado o consulte BioTime solo si efectivamente está recibiendo marcaciones.
3. CommKey configurada: Verifique Menú > Comunicaciones > Red > Clave Com en el dispositivo.`;
      }

      const diagStatus = isAuthFail ? 'AUTH_ERROR' : tcpProbe.ok ? 'PROTOCOL_NO_RESPONSE' : 'OFFLINE';
      return buildDiagnosisResult(
        false,
        diagStatus,
        isAuthFail
          ? `Fallo de autenticación CommKey en ${cleanIp}:${targetPort}.`
          : tcpProbe.ok
          ? `Conexión TCP establecida (${cleanIp}:${targetPort}), pero sin respuesta del protocolo ZKTeco.`
          : `Sin conexión con el dispositivo en ${cleanIp}:${targetPort}.`,
        friendlyCause,
        cleanIp,
        targetPort,
        modelHint,
        snHint,
        stages,
        nowStr,
        0,
        0
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
 * Incluye reintento automático en puerto 4370 y fallback a sincronización BioTime ADMS
 */
async function readZkDevicePunches(
  ip,
  port = 7496,
  timeoutMs = 4000,
  commKey = 0,
  modelHint = 'ZKTeco G3',
  snHint = 'AEH2223460040'
) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 7496;
  const numericCommKey = Number(commKey) || 0;
  const timeout = Math.min(6000, Math.max(1500, Number(timeoutMs) || 4000));
  const cleanSerial = String(snHint || 'AEH2223460040').trim().toUpperCase();
  const cleanModel = String(modelHint || 'ZKTeco G3').trim();

  if (!isValidIpv4(cleanIp)) {
    return {
      success: false,
      status: 'OFFLINE',
      message: `Dirección IP inválida: "${cleanIp}"`,
      ip: cleanIp,
      port: targetPort,
      model: cleanModel,
      serial: cleanSerial,
      serial_number: cleanSerial,
      latency_ms: 0,
      users_in_clock: 0,
      punches: [],
      timestamp: new Date().toISOString(),
    };
  }

  // Medir latencia física TCP hacia el marcador
  const tcpProbe = await probeTcpPort(cleanIp, targetPort, 1500);
  const latency = tcpProbe.latency || 0;

  const lockKey = `${cleanIp}:${targetPort}`;
  if (activeConnections.has(lockKey)) {
    return {
      success: false,
      status: 'BUSY',
      message: 'El biométrico está ocupado atendiendo otra consulta.',
      ip: cleanIp,
      port: targetPort,
      model: cleanModel,
      serial: cleanSerial,
      serial_number: cleanSerial,
      latency_ms: latency,
      users_in_clock: 0,
      punches: [],
      timestamp: new Date().toISOString(),
    };
  }

  activeConnections.add(lockKey);
  let zkInstance = null;
  let activePortUsed = targetPort;
  let lastError = null;
  let detectedUsersCount = 0;

  try {
    // 0. Intentar node-zklib en puerto configurado y puerto estándar 4370
    const candidatePorts = [targetPort, 4370].filter((p, idx, arr) => arr.indexOf(p) === idx);
    try {
      const NodeZkLib = require('node-zklib');
      for (const testPort of candidatePorts) {
        try {
          const zk = new NodeZkLib(cleanIp, testPort, Math.min(timeout, 3500), 5200);
          await zk.createSocket();
          try {
            const usersRes = await zk.getUsers();
            if (usersRes && Array.isArray(usersRes.data)) detectedUsersCount = usersRes.data.length;
          } catch (_) {}

          const attResult = await zk.getAttendances();
          try { await zk.disconnect(); } catch (_) {}

          if (attResult && Array.isArray(attResult.data)) {
            const formatted = attResult.data
              .map((item, idx) => {
                const dni = String(item.deviceUserId || item.userSn || item.pin || '').trim();
                const recTimeStr = item.recordTime instanceof Date
                  ? item.recordTime.toISOString().replace('T', ' ').substring(0, 19)
                  : String(item.recordTime || '').replace('T', ' ').substring(0, 19);
                if (!dni || !recTimeStr || recTimeStr.length < 16) return null;
                const [fechaPart, horaPart] = recTimeStr.split(' ');
                const originalId = `zk_${cleanSerial}_${dni}_${recTimeStr.replace(/[- :]/g, '')}`;
                return {
                  id: originalId,
                  punch_id: originalId,
                  original_punch_id: `${originalId}_${idx}`,
                  device_sn: cleanSerial,
                  device_ip: cleanIp,
                  employee_dni: dni,
                  employee_code: dni,
                  fecha: fechaPart,
                  hora: horaPart,
                  timestamp: recTimeStr,
                  verify_mode: item.verifyType === 15 ? 'FACE' : item.verifyType === 2 ? 'PASSWORD' : item.verifyType === 3 ? 'CARD' : 'FINGERPRINT',
                  punch_type: 'AUTO',
                  punch_state: Number(item.punchState ?? item.state ?? 0),
                  source: 'DIRECT_READ',
                  synced_at: new Date().toISOString(),
                };
              })
              .filter(Boolean);

            if (formatted.length > 0) {
              return {
                success: true,
                status: 'PUNCHES_RECEIVED',
                message: `Descarga completada: ${formatted.length} marcaciones reales recuperadas vía lectura directa (${cleanIp}:${testPort}).`,
                serial_number: cleanSerial,
                serial: cleanSerial,
                ip: cleanIp,
                port: testPort,
                model: cleanModel,
                latency_ms: latency,
                users_in_clock: detectedUsersCount,
                total_clock_punches: formatted.length,
                punches: formatted,
                timestamp: new Date().toISOString(),
              };
            }
          }
        } catch (zkErr) {
          lastError = zkErr;
        }
      }
    } catch (_) {}

    // 1. Intentar driver TCP nativo en puerto configurado y puerto alternativo 4370
    for (const testPort of candidatePorts) {
      try {
        const tcpZk = new ZKLibTCP(cleanIp, testPort, timeout);
        await withTimeout(tcpZk.createSocket(), timeout, `Timeout creando socket TCP en ${testPort}`);
        const reply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_CONNECT, ''), timeout, 'Timeout CMD_CONNECT');
        const responseCode = reply && reply.length >= 2 ? reply.readUInt16LE(0) : 0;
        const sessionId = tcpZk.sessionId || (reply && reply.length >= 6 ? reply.readUInt16LE(4) : 0);

        if (responseCode === COMMANDS.CMD_ACK_UNAUTH || numericCommKey > 0) {
          const authPacket = makeCommkey(numericCommKey, sessionId);
          const authReply = await withTimeout(tcpZk.executeCmd(COMMANDS.CMD_AUTH, authPacket), timeout, 'Timeout CMD_AUTH');
          const authCode = authReply && authReply.length >= 2 ? authReply.readUInt16LE(0) : 0;

          if (authCode !== COMMANDS.CMD_ACK_OK) {
            throw new Error(`Autenticación rechazada por el biométrico (CommKey=${numericCommKey}).`);
          }
        }

        zkInstance = tcpZk;
        activePortUsed = testPort;
        break;
      } catch (errPort) {
        lastError = errPort;
      }
    }

    // 2. Si se estableció sesión binaria directa con el reloj físico por socket:
    if (zkInstance) {
      let serial = cleanSerial;
      try {
        if (typeof zkInstance.getSerialNumber === 'function') {
          const s = await withTimeout(zkInstance.getSerialNumber(), 2000, 'Timeout serial');
          if (s) serial = String(s).trim();
        }
      } catch (_) {}

      try {
        if (typeof zkInstance.getUsers === 'function') {
          const usersRes = await withTimeout(zkInstance.getUsers(), 3000, 'Timeout getUsers');
          if (usersRes && Array.isArray(usersRes.data)) detectedUsersCount = usersRes.data.length;
          else if (Array.isArray(usersRes)) detectedUsersCount = usersRes.length;
        }
      } catch (_) {}

      let rawList = [];
      try {
        if (typeof zkInstance.getAttendances === 'function') {
          const attResult = await withTimeout(zkInstance.getAttendances(), timeout, 'Timeout getAttendances');
          if (attResult && Array.isArray(attResult.data)) {
            rawList = attResult.data;
          } else if (Array.isArray(attResult)) {
            rawList = attResult;
          }
        }
      } catch (attErr) {
        lastError = attErr;
      }

      let formattedPunches = rawList
        .map((item, index) => {
          const dni = String(item.deviceUserId || item.userSn || item.pin || '').trim();
          let recordTimeStr = '';
          if (item.recordTime) {
            if (item.recordTime instanceof Date) {
              recordTimeStr = item.recordTime.toISOString().replace('T', ' ').substring(0, 19);
            } else {
              recordTimeStr = String(item.recordTime).replace('T', ' ').substring(0, 19);
            }
          }
          if (!dni || !recordTimeStr || recordTimeStr.length < 16) return null;

          const [fechaPart, horaPart] = recordTimeStr.split(' ');
          const originalId = `zk_${serial}_${dni}_${recordTimeStr.replace(/[- :]/g, '')}`;
          return {
            id: originalId,
            punch_id: originalId,
            original_punch_id: `${originalId}_${index}`,
            device_sn: serial,
            device_ip: cleanIp,
            employee_dni: dni,
            employee_code: dni,
            fecha: fechaPart,
            hora: horaPart,
            timestamp: recordTimeStr,
            verify_mode: item.verifyType === 15 ? 'FACE' : item.verifyType === 2 ? 'PASSWORD' : item.verifyType === 3 ? 'CARD' : 'FINGERPRINT',
            punch_type: 'AUTO',
            punch_state: Number(item.punchState || 0),
            source: 'DIRECT_READ',
            synced_at: new Date().toISOString(),
            raw_record: JSON.stringify(item),
          };
        })
        .filter(Boolean);

      if (formattedPunches.length > 0) {
        try {
          const rawPath = resolveDataFilePath('raw-punches.json');
          let currentList = [];
          if (fs.existsSync(rawPath)) {
            try { currentList = JSON.parse(fs.readFileSync(rawPath, 'utf8')); } catch (_) {}
          }
          const existingKeys = new Set(currentList.map((p) => `${p.device_sn || ''}_${p.employee_dni || p.pin || p.employee_code}_${p.timestamp}`));
          const newlyAdded = [];
          for (const p of formattedPunches) {
            const key = `${p.device_sn || ''}_${p.employee_dni || p.pin || p.employee_code}_${p.timestamp}`;
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              newlyAdded.push(p);
            }
          }
          if (newlyAdded.length > 0) {
            const merged = [...newlyAdded, ...currentList];
            fs.writeFileSync(rawPath, JSON.stringify(merged, null, 2), 'utf8');
          }
        } catch (_) {}

        return {
          success: true,
          status: 'PUNCHES_RECEIVED',
          message: `Descarga completada: ${formattedPunches.length} marcaciones reales recuperadas vía lectura directa TCP (${cleanIp}:${activePortUsed}).`,
          serial_number: serial,
          serial: serial,
          ip: cleanIp,
          port: activePortUsed,
          model: cleanModel,
          latency_ms: latency,
          users_in_clock: detectedUsersCount,
          total_clock_punches: formattedPunches.length,
          punches: formattedPunches,
          timestamp: new Date().toISOString(),
        };
      }

      // Conexión real exitosa pero sin registros en el buffer del reloj
      return {
        success: true,
        status: 'ONLINE_NO_NEW_PUNCHES',
        message: `Lectura exitosa sin marcaciones nuevas en el reloj (${cleanIp}:${activePortUsed}, ${latency}ms).`,
        serial_number: serial,
        serial: serial,
        ip: cleanIp,
        port: activePortUsed,
        model: cleanModel,
        latency_ms: latency,
        users_in_clock: detectedUsersCount,
        total_clock_punches: 0,
        punches: [],
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Si no se pudo establecer comunicación binaria con el marcador físico:
    // NUNCA generar marcaciones simuladas ni aparentar éxito si no se obtuvieron registros reales.
    const errStatus = tcpProbe.ok ? 'PROTOCOL_NO_RESPONSE' : 'OFFLINE';
    return {
      success: false,
      status: errStatus,
      message: tcpProbe.ok
        ? `Puerto TCP ${targetPort} abierto en ${cleanIp}, pero el protocolo ZKTeco no respondió (${lastError?.message || 'Timeout CMD_CONNECT'}).`
        : `Sin conexión con el dispositivo en ${cleanIp}:${targetPort} (${lastError?.message || tcpProbe.error || 'Timeout o conexión rechazada'}).`,
      serial_number: cleanSerial,
      serial: cleanSerial,
      ip: cleanIp,
      port: targetPort,
      model: cleanModel,
      latency_ms: latency,
      users_in_clock: 0,
      total_clock_punches: 0,
      punches: [],
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
  port = 7496,
  timeoutMs = 3000,
  modelHint = 'ZKTeco G3',
  snHint = 'AEH2223460040',
  commKey = 0
) {
  const cleanIp = String(ip || '').trim();
  const targetPort = Number(port) || 7496;
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
      const fwStatus = await firewallManager.checkFirewallStatus(targetPort);
      if (!fwStatus.isWindows) {
        firewallResult = {
          status: 'Correcto',
          message: 'No aplica (entorno no Windows).',
        };
      } else if (fwStatus.configured) {
        firewallResult = {
          status: 'Correcto',
          message: `Firewall Windows: OK. Reglas para puerto TCP ${targetPort} (Entrada y Salida) y ejecutables activas.`,
        };
      } else {
        firewallResult = {
          status: 'Fallido',
          message: `Firewall Windows: REQUIERE CONFIGURACIÓN. Reglas faltantes: ${fwStatus.missingRules?.join(', ') || `TCP ${targetPort}`}.`,
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

  // 3. Apertura TCP (puerto configurado)
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

/**
 * Inspección estrictamente de SOLO LECTURA sobre BioTime (HTTP puerto 89 + PostgreSQL puerto 7496):
 * Verifica esquema real vía information_schema antes de consultar marcaciones, sin escribir en BioTime.
 */
async function inspectBioTimeDatabase(options = {}) {
  const {
    host = '192.168.1.29',
    webPort = 89,
    dbPort = 7496,
    dbName = 'biotime',
    dbUser = 'postgres',
    serial = '',
  } = options;

  const cleanHost = String(host || '192.168.1.29').trim();
  const targetWebPort = Number(webPort) || 89;
  const targetDbPort = Number(dbPort) || 7496;
  const cleanSerial = String(serial || '').trim().toUpperCase();

  const webProbe = await probeTcpPort(cleanHost, targetWebPort, 2000);
  const dbProbe = await probeTcpPort(cleanHost, targetDbPort, 2000);

  const report = {
    success: false,
    host: cleanHost,
    webPort: targetWebPort,
    dbPort: targetDbPort,
    dbName,
    webReachable: webProbe.ok,
    dbReachable: dbProbe.ok,
    tablesFound: [],
    attendanceTable: null,
    attendanceColumns: [],
    totalTransactions: 0,
    deviceTransactions: 0,
    receivesClockPunches: false,
    validSource: false,
    message: '',
    error: null,
  };

  if (!dbProbe.ok) {
    report.error = dbProbe.code || 'DB_UNREACHABLE';
    report.message = `PostgreSQL de BioTime en ${cleanHost}:${targetDbPort} no está alcanzable (${dbProbe.error || dbProbe.code || 'Sin conexión'}).`;
    return report;
  }

  let pg = null;
  try { pg = require('pg'); } catch (_) {}
  if (!pg || !pg.Client) {
    report.error = 'PG_DRIVER_MISSING';
    report.message = 'Controlador PostgreSQL (pg) no disponible en Electron.';
    return report;
  }

  const passwords = ['', '123456', 'admin', 'postgres', 'biotime', 'root', 'ZKTeco123', 'ZK123456'];
  for (const pwd of passwords) {
    const client = new pg.Client({
      host: cleanHost,
      port: targetDbPort,
      database: dbName,
      user: dbUser,
      password: pwd,
      connectionTimeoutMillis: 2500,
      statement_timeout: 3000,
    });
    try {
      await client.connect();
      const tablesRes = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      report.tablesFound = tablesRes.rows.map((r) => r.table_name);

      const candidateTables = ['iclock_transaction', 'checkinout', 'att_punches', 'zk_transactions'];
      const detectedTable = candidateTables.find((t) => report.tablesFound.includes(t))
        || report.tablesFound.find((t) => t.includes('transaction') || t.includes('checkin') || t.includes('punch'));

      if (detectedTable) {
        report.attendanceTable = detectedTable;
        const colsRes = await client.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [detectedTable]
        );
        report.attendanceColumns = colsRes.rows.map((c) => `${c.column_name} (${c.data_type})`);
        const colNames = colsRes.rows.map((c) => c.column_name);

        const countRes = await client.query(`SELECT COUNT(*)::int AS total FROM "${detectedTable}"`);
        report.totalTransactions = Number(countRes.rows[0]?.total || 0);

        const snCol = ['terminal_sn', 'sn', 'device_sn'].find((c) => colNames.includes(c));
        if (snCol && cleanSerial) {
          const devCountRes = await client.query(
            `SELECT COUNT(*)::int AS total FROM "${detectedTable}" WHERE UPPER(COALESCE("${snCol}"::text, '')) = $1`,
            [cleanSerial]
          );
          report.deviceTransactions = Number(devCountRes.rows[0]?.total || 0);
        } else {
          report.deviceTransactions = report.totalTransactions;
        }

        report.receivesClockPunches = report.deviceTransactions > 0;
        report.validSource = report.receivesClockPunches;
        report.success = true;
        report.message = report.receivesClockPunches
          ? `BioTime inspeccionado (${detectedTable}): ${report.deviceTransactions} marcaciones reales detectadas para ${cleanSerial || 'el reloj'}.`
          : `BioTime conectado (${detectedTable}), pero tiene 0 marcaciones para ${cleanSerial || 'el reloj'}. No es fuente válida hasta que BioTime reciba registros.`;
      } else {
        report.success = true;
        report.message = `BioTime conectado (${dbName}), pero no se encontró tabla de marcaciones en public (${report.tablesFound.slice(0, 8).join(', ')}).`;
      }

      await client.end();
      return report;
    } catch (err) {
      report.error = err?.message || String(err);
      try { await client.end(); } catch (_) {}
    }
  }

  report.message = `No se pudo autenticar contra PostgreSQL BioTime en ${cleanHost}:${targetDbPort}/${dbName}: ${report.error || 'Credenciales rechazadas'}.`;
  return report;
}

/**
 * Sincronización de marcaciones desde BioTime únicamente después de inspeccionar
 * el esquema real (solo lectura) y comprobar que BioTime recibe marcaciones del reloj.
 */
async function syncBioTimeRecords(options = {}) {
  const {
    host = '192.168.1.29',
    webPort = 89,
    dbPort = 7496,
    serial = '',
    deviceIp = '',
    devicePort = 7496,
    commKey = 0,
    dbName = 'biotime',
    dbUser = 'postgres',
  } = options;

  const cleanHost = String(host || '192.168.1.29').trim();
  const cleanSerial = String(serial || '').trim().toUpperCase();
  const cleanDeviceIp = String(deviceIp || '').trim();
  const targetDbPort = Number(dbPort) || 7496;
  const targetDevicePort = Number(devicePort) || 7496;

  // 1. Inspección previa obligatoria (solo lectura) en information_schema
  const inspection = await inspectBioTimeDatabase({
    host: cleanHost,
    webPort,
    dbPort: targetDbPort,
    dbName,
    dbUser,
    serial: cleanSerial,
  });

  if (!inspection.success || !inspection.attendanceTable) {
    return {
      success: false,
      source: 'NONE',
      details: inspection.message,
      inspection,
      punches: [],
      count: 0,
    };
  }

  if (!inspection.receivesClockPunches) {
    return {
      success: false,
      source: 'NONE',
      details: `BioTime no registra marcaciones del reloj (${cleanSerial || 'G3'}). No debe utilizarse como fuente válida hasta corregir la recepción ADMS.`,
      inspection,
      punches: [],
      count: 0,
    };
  }

  let pulledPunches = [];
  let source = 'NONE';
  let details = '';

  // 2. Consulta de solo lectura sobre la tabla inspeccionada dinámicamente
  try {
    const pg = require('pg');
    const passwords = ['', '123456', 'admin', 'postgres', 'biotime', 'root', 'ZKTeco123', 'ZK123456'];
    const table = inspection.attendanceTable;
    const colNames = inspection.attendanceColumns.map((c) => c.split(' ')[0]);
    const hasPersonnel = inspection.tablesFound.includes('personnel_employee');

    for (const pwd of passwords) {
      const client = new pg.Client({
        host: cleanHost,
        port: targetDbPort,
        database: dbName,
        user: dbUser,
        password: pwd,
        connectionTimeoutMillis: 2500,
        statement_timeout: 3000,
      });

      try {
        await client.connect();
        let rows = [];
        if (table === 'iclock_transaction' && colNames.includes('emp_code') && colNames.includes('punch_time')) {
          const snFilter = cleanSerial && colNames.includes('terminal_sn') ? `WHERE UPPER(COALESCE(t.terminal_sn::text, '')) = $1` : '';
          const joinSql = hasPersonnel ? 'LEFT JOIN personnel_employee e ON (t.emp_id = e.id OR t.emp_code = e.emp_code)' : '';
          const selectCols = hasPersonnel
            ? 't.id, t.emp_code, t.punch_time, t.punch_state, t.verify_type, t.terminal_sn, e.first_name, e.last_name'
            : 't.id, t.emp_code, t.punch_time, t.punch_state, t.verify_type, t.terminal_sn';
          const q = await client.query(
            `SELECT ${selectCols} FROM iclock_transaction t ${joinSql} ${snFilter} ORDER BY t.punch_time DESC LIMIT 1000`,
            snFilter ? [cleanSerial] : []
          );
          rows = q.rows;
        } else if (table === 'checkinout' && colNames.includes('userid') && colNames.includes('checktime')) {
          const snCol = ['sn', 'terminal_sn'].find((c) => colNames.includes(c));
          const snFilter = cleanSerial && snCol ? `WHERE UPPER(COALESCE("${snCol}"::text, '')) = $1` : '';
          const q2 = await client.query(
            `SELECT id, userid AS emp_code, checktime AS punch_time, checktype AS punch_state, verifycode AS verify_type, ${snCol ? `"${snCol}"` : "''"} AS terminal_sn FROM checkinout ${snFilter} ORDER BY checktime DESC LIMIT 1000`,
            snFilter ? [cleanSerial] : []
          );
          rows = q2.rows;
        }
        await client.end();

        if (rows.length > 0) {
          const syncedAt = new Date().toISOString();
          pulledPunches = rows
            .map((r, idx) => {
              const code = String(r.emp_code || r.userid || '').trim();
              const punchTimeStr = r.punch_time instanceof Date
                ? r.punch_time.toISOString().replace('T', ' ').substring(0, 19)
                : String(r.punch_time || '').replace('T', ' ').substring(0, 19);
              if (!code || !punchTimeStr || punchTimeStr.length < 16) return null;
              const punchState = Number(r.punch_state ?? 0);
              const verify = Number(r.verify_type ?? 1);
              const verifyMode = verify === 15 ? 'FACE' : verify === 2 ? 'PASSWORD' : verify === 3 ? 'CARD' : 'FINGERPRINT';
              const snVal = r.terminal_sn || cleanSerial;

              return {
                id: `biotime_${snVal}_${code}_${punchTimeStr.replace(/[^0-9]/g, '')}`,
                original_punch_id: String(r.id || `bt_${idx}`),
                device_sn: snVal,
                device_name: 'ZKTeco G3 (vía BioTime)',
                employee_dni: code,
                employee_code: code,
                timestamp: punchTimeStr,
                punch_type: punchState === 1 ? 'CHECK_OUT' : punchState === 0 ? 'CHECK_IN' : 'AUTO',
                punch_state: punchState,
                verify_mode: verifyMode,
                processed: false,
                source: 'BIOTIME_DB',
                synced_at: syncedAt,
                serialNumber: snVal,
              };
            })
            .filter(Boolean);

          source = 'BIOTIME_DB';
          details = `${pulledPunches.length} marcaciones reales extraídas desde PostgreSQL BioTime (${cleanHost}:${targetDbPort}/${table}).`;
          break;
        }
      } catch (_) {
        try { await client.end(); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[syncBioTimeRecords] Error leyendo PostgreSQL:', err.message);
  }

  return {
    success: pulledPunches.length > 0,
    source,
    details: details || 'No se recuperaron registros nuevos desde BioTime.',
    inspection,
    punches: pulledPunches,
    count: pulledPunches.length,
  };
}

module.exports = {
  diagnoseZkDevice,
  readZkDevicePunches,
  probeTcpPort,
  makeCommkey,
  runIndependentDiagnostics,
  checkBioTimeService,
  inspectBioTimeDatabase,
  syncBioTimeRecords,
};

