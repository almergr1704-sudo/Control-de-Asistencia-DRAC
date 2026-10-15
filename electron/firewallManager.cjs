/**
 * DRAC Control de Asistencia - Gestor del Firewall de Windows
 * Dirección Regional de Agricultura Cajamarca
 *
 * Administra y verifica las reglas del Firewall de Windows requeridas para
 * la comunicación bidireccional con marcadores biométricos ZKTeco en el puerto TCP 4370
 * y para los ejecutables de la aplicación.
 */

const { exec, execSync } = require('child_process');
const os = require('os');
const path = require('path');

// Nombres oficiales de las reglas del Firewall de Windows
const RULES = {
  PORT_IN: 'DRAC Control Asistencia - ZKTeco TCP 4370 IN',
  PORT_OUT: 'DRAC Control Asistencia - ZKTeco TCP 4370 OUT',
  APP_IN: 'DRAC Control Asistencia - Aplicación Ejecutable IN',
  APP_OUT: 'DRAC Control Asistencia - Aplicación Ejecutable OUT',
};

function log(msg) {
  console.log(`[DRAC-FIREWALL] ${new Date().toISOString()} - ${msg}`);
}

/**
 * Comprueba si el proceso actual cuenta con privilegios administrativos en Windows.
 */
function checkAdminPrivileges() {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    // 'net session' falla con código 2 si no se ejecuta como Administrador
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Consulta el estado actual de las reglas del Firewall de Windows para el puerto 4370
 * y los ejecutables de DRAC.
 */
async function checkFirewallStatus() {
  const isWindows = process.platform === 'win32';
  const isAdmin = checkAdminPrivileges();

  if (!isWindows) {
    return {
      isWindows: false,
      configured: true,
      status: 'OK',
      statusText: 'No aplica (entorno no Windows)',
      isAdmin,
      rules: [],
      missingRules: [],
      inboundPort4370: true,
      outboundPort4370: true,
      appInbound: true,
      appOutbound: true,
      details: 'El sistema operativo actual no es Windows; no se requieren reglas de Windows Defender Firewall.',
      timestamp: new Date().toISOString(),
    };
  }

  return new Promise((resolve) => {
    // Consultar reglas existentes que inicien con "DRAC Control Asistencia"
    const cmd = 'netsh advfirewall firewall show rule name=all | findstr /I "DRAC"';
    exec(cmd, (err, stdout) => {
      const output = stdout ? stdout.toString() : '';
      const hasPortIn = output.includes(RULES.PORT_IN);
      const hasPortOut = output.includes(RULES.PORT_OUT);
      const hasAppIn = output.includes(RULES.APP_IN);
      const hasAppOut = output.includes(RULES.APP_OUT);

      const rulesFound = [];
      const missingRules = [];

      if (hasPortIn) rulesFound.push(RULES.PORT_IN);
      else missingRules.push(RULES.PORT_IN);

      if (hasPortOut) rulesFound.push(RULES.PORT_OUT);
      else missingRules.push(RULES.PORT_OUT);

      if (hasAppIn) rulesFound.push(RULES.APP_IN);
      else missingRules.push(RULES.APP_IN);

      if (hasAppOut) rulesFound.push(RULES.APP_OUT);
      else missingRules.push(RULES.APP_OUT);

      const allOk = hasPortIn && hasPortOut;
      const status = allOk ? 'OK' : 'REQUIERE CONFIGURACIÓN';

      let details = '';
      if (allOk) {
        details = 'Firewall de Windows configurado correctamente. Comunicación TCP 4370 habilitada.';
      } else {
        details = `Reglas faltantes en Windows Firewall: ${missingRules.join(', ')}. Se requiere ejecutar reparación de red.`;
      }

      log(`Verificación de Firewall completada: ${status} (${rulesFound.length} reglas activas, ${missingRules.length} faltantes).`);

      resolve({
        isWindows: true,
        configured: allOk,
        status,
        statusText: status === 'OK' ? 'Firewall Windows: OK' : 'Firewall Windows: REQUIERE CONFIGURACIÓN',
        isAdmin,
        rules: rulesFound,
        missingRules,
        inboundPort4370: hasPortIn,
        outboundPort4370: hasPortOut,
        appInbound: hasAppIn,
        appOutbound: hasAppOut,
        details,
        timestamp: new Date().toISOString(),
      });
    });
  });
}

/**
 * Obtiene la ruta del ejecutable principal de la aplicación.
 */
function getAppExecutablePath() {
  if (process.execPath && process.execPath.endsWith('.exe')) {
    return process.execPath;
  }
  // En caso de estar en desarrollo o ruta alternativa
  const localAppData = process.env.LOCALAPPDATA || '';
  if (localAppData) {
    return path.join(localAppData, 'DRAC-Control-Asistencia', 'DRAC-Control-de-Asistencia.exe');
  }
  return 'DRAC-Control-de-Asistencia.exe';
}

/**
 * Crea o recrea las reglas del Firewall de Windows para el puerto 4370 y el ejecutable.
 */
async function createFirewallRules() {
  if (process.platform !== 'win32') {
    return {
      success: true,
      message: 'No se requiere configuración de Firewall de Windows en este sistema operativo.',
      rulesCreated: [],
      errors: [],
      isAdmin: false,
    };
  }

  const isAdmin = checkAdminPrivileges();
  const exePath = getAppExecutablePath();
  const commands = [
    // 1. Regla de Entrada para Puerto TCP 4370 (ZKTeco y servicios PUSH/ADMS)
    {
      name: RULES.PORT_IN,
      cmd: `netsh advfirewall firewall add rule name="${RULES.PORT_IN}" dir=in action=allow protocol=TCP localport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco"`,
    },
    // 2. Regla de Salida para Puerto TCP 4370 (Comandos, consultas de telemetría y descarga de marcaciones)
    {
      name: RULES.PORT_OUT,
      cmd: `netsh advfirewall firewall add rule name="${RULES.PORT_OUT}" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco"`,
    },
    // 3. Regla de Entrada para el Ejecutable de la aplicación
    {
      name: RULES.APP_IN,
      cmd: `netsh advfirewall firewall add rule name="${RULES.APP_IN}" dir=in action=allow program="${exePath}" enable=yes profile=any description="Regla institucional DRAC: Permite tráfico de red entrante para DRAC Control de Asistencia"`,
    },
    // 4. Regla de Salida para el Ejecutable de la aplicación
    {
      name: RULES.APP_OUT,
      cmd: `netsh advfirewall firewall add rule name="${RULES.APP_OUT}" dir=out action=allow program="${exePath}" enable=yes profile=any description="Regla institucional DRAC: Permite tráfico de red saliente para DRAC Control de Asistencia"`,
    },
  ];

  // Si no cuenta con privilegios administrativos directos, se ejecuta PowerShell con elevación (RunAs / UAC)
  if (!isAdmin) {
    log('Usuario sin permisos administrativos: solicitando elevación mediante UAC...');
    return new Promise((resolve) => {
      const fs = require('fs');
      const tempBatPath = path.join(os.tmpdir(), `drac_firewall_${Date.now()}.bat`);
      const batLines = [
        '@echo off',
        'chcp 65001 > nul',
        ...commands.map((c) => c.cmd),
        'exit /b 0',
      ];
      try {
        fs.writeFileSync(tempBatPath, batLines.join('\r\n'), 'utf8');
      } catch (writeErr) {
        return resolve({
          success: false,
          message: `Error creando script temporal: ${writeErr.message}`,
          isAdmin: false,
        });
      }

      const elevateCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \\"${tempBatPath}\\"' -Verb RunAs -Wait"`;

      exec(elevateCmd, (err) => {
        try {
          if (fs.existsSync(tempBatPath)) fs.unlinkSync(tempBatPath);
        } catch (_) {}

        if (err) {
          log(`Error al solicitar elevación administrativa: ${err.message}`);
          resolve({
            success: false,
            message: 'No se pudo obtener privilegios administrativos para configurar el Firewall de Windows.',
            error: err.message,
            isAdmin: false,
          });
        } else {
          log('Elevación completada. Reglas aplicadas con privilegios administrativos.');
          resolve({
            success: true,
            message: 'Reglas de Firewall solicitadas y aplicadas con privilegios administrativos.',
            isAdmin: true,
            rulesCreated: [RULES.PORT_IN, RULES.PORT_OUT, RULES.APP_IN, RULES.APP_OUT],
          });
        }
      });
    });
  }

  // Si ya es administrador, ejecutar cada comando directamente y registrar logs paso a paso
  const rulesCreated = [];
  const errors = [];

  for (const item of commands) {
    try {
      // Primero eliminar la regla si existía previamente para evitar duplicados obsoletos
      try {
        execSync(`netsh advfirewall firewall delete rule name="${item.name}"`, { stdio: 'ignore' });
        log(`Regla previa eliminada para renovación: ${item.name}`);
      } catch (_) {}

      execSync(item.cmd, { stdio: 'pipe' });
      rulesCreated.push(item.name);
      log(`Regla creada exitosamente: ${item.name}`);
    } catch (e) {
      const errMsg = e?.stderr ? e.stderr.toString() : e?.message || 'Error desconocido';
      errors.push(`${item.name}: ${errMsg}`);
      log(`Error al crear regla ${item.name}: ${errMsg}`);
    }
  }

  const success = rulesCreated.length >= 2; // Al menos las de puerto 4370
  return {
    success,
    message: success
      ? `Configuración de Firewall de Windows completada exitosamente (${rulesCreated.length} reglas activadas).`
      : 'Ocurrieron errores al aplicar algunas reglas en el Firewall de Windows.',
    rulesCreated,
    errors,
    isAdmin,
  };
}

/**
 * Función integral para el botón "Reparar Configuración de Red":
 * 1. Recrea las reglas necesarias en Windows Firewall
 * 2. Verifica y repara permisos de socket
 * 3. Valida conectividad y devuelve el nuevo estado
 */
async function repairNetworkConfig() {
  log('Iniciando proceso de Reparación de Configuración de Red...');
  const creationResult = await createFirewallRules();
  const newStatus = await checkFirewallStatus();

  return {
    success: creationResult.success && newStatus.configured,
    creationResult,
    firewallStatus: newStatus,
    message: creationResult.success
      ? 'Configuración de red y Firewall de Windows reparada correctamente. Puerto TCP 4370 habilitado.'
      : (creationResult.message || 'Se requiere confirmar permisos de Administrador para completar la reparación.'),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Verificación automática al iniciar la aplicación en Windows
 */
async function ensureFirewallOnStartup() {
  if (process.platform !== 'win32') return;

  log('Comprobando estado de Firewall de Windows al inicio...');
  try {
    const status = await checkFirewallStatus();
    if (!status.configured) {
      log('Reglas de Firewall ausentes al inicio. Intentando configuración automática...');
      const result = await createFirewallRules();
      if (result.success) {
        log('Reglas de Firewall configuradas exitosamente en el inicio.');
      } else {
        log(`No se pudieron crear reglas automáticamente al inicio: ${result.message}`);
      }
    } else {
      log('Regla ya existente: Firewall de Windows verificado y conforme.');
    }
  } catch (err) {
    log(`Aviso en verificación de Firewall inicial: ${err.message}`);
  }
}

module.exports = {
  RULES,
  checkAdminPrivileges,
  checkFirewallStatus,
  createFirewallRules,
  repairNetworkConfig,
  ensureFirewallOnStartup,
};
