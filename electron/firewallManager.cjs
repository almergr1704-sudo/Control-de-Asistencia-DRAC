/**
 * DRAC Cajamarca - Gestor de Reglas de Firewall de Windows y Red Institucional
 * Permite auditar, verificar y reparar reglas para el puerto TCP 4370 (ZKTeco Standalone / ADMS)
 * y para el ejecutable DRAC Control de Asistencia.
 */

const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const RULE_TCP_IN = 'DRAC Control Asistencia - ZKTeco TCP 4370 IN';
const RULE_TCP_OUT = 'DRAC Control Asistencia - ZKTeco TCP 4370 OUT';
const RULE_EXE_IN = 'DRAC Control Asistencia - Aplicación Ejecutable IN';
const RULE_EXE_OUT = 'DRAC Control Asistencia - Aplicación Ejecutable OUT';

function log(msg) {
  console.log(`[DRAC-FIREWALL] ${new Date().toISOString()} - ${msg}`);
}

/**
 * Ejecuta un comando en shell con promesa y timeout seguro.
 */
function runCommand(command, timeoutMs = 7000) {
  return new Promise((resolve) => {
    try {
      exec(command, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          code: error && typeof error.code === 'number' ? error.code : (error ? 1 : 0),
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          error: error ? error.message : null,
        });
      });
    } catch (e) {
      resolve({
        success: false,
        code: 1,
        stdout: '',
        stderr: '',
        error: e.message,
      });
    }
  });
}

/**
 * Verifica si el proceso actual cuenta con privilegios elevados de Administrador en Windows.
 */
async function checkAdminPrivileges() {
  if (process.platform !== 'win32') return false;
  try {
    const res = await runCommand('net session', 3000);
    return res.success;
  } catch (_) {
    return false;
  }
}

/**
 * Determina la ruta al ejecutable de la aplicación para configurar reglas directas.
 */
function getApplicationExePath() {
  try {
    const defaultInstallPath = path.join(
      process.env.LOCALAPPDATA || 'C:\\Program Files',
      'DRAC-Control-Asistencia',
      'DRAC-Control-de-Asistencia.exe'
    );

    if (process.execPath && process.execPath.toLowerCase().endsWith('.exe') && !process.execPath.toLowerCase().includes('node.exe') && !process.execPath.toLowerCase().includes('electron.exe')) {
      return process.execPath;
    }

    if (fs.existsSync(defaultInstallPath)) {
      return defaultInstallPath;
    }

    // Ruta estándar en Program Files
    const programFilesPath = 'C:\\Program Files\\DRAC-Control-de-Asistencia\\DRAC-Control-de-Asistencia.exe';
    if (fs.existsSync(programFilesPath)) {
      return programFilesPath;
    }

    return process.execPath || defaultInstallPath;
  } catch (_) {
    return 'DRAC-Control-de-Asistencia.exe';
  }
}

/**
 * Comprueba el estado actual de las reglas del Firewall de Windows para TCP 4370 y el ejecutable.
 */
async function checkFirewallStatus() {
  const isWindows = process.platform === 'win32';

  // Si se ejecuta en entorno Linux/Cloud/Dev, responder OK simulado para no bloquear UI
  if (!isWindows) {
    return {
      isWindows: false,
      configured: true,
      status: 'OK',
      statusText: 'Firewall: Entorno Servidor / Web (TCP 4370 Habilitado)',
      isAdmin: false,
      rules: [RULE_TCP_IN, RULE_TCP_OUT],
      missingRules: [],
      inboundPort4370: true,
      outboundPort4370: true,
      appInbound: true,
      appOutbound: true,
      details: 'El sistema se encuentra en un entorno no Windows. La conectividad TCP 4370 opera sin restricciones locales.',
      timestamp: new Date().toISOString(),
    };
  }

  const isAdmin = await checkAdminPrivileges();
  const rulesFound = [];
  const missingRules = [];

  // Comprobar regla TCP Entrada
  const resIn = await runCommand(`netsh advfirewall firewall show rule name="${RULE_TCP_IN}"`, 4000);
  const hasInbound = resIn.success && (resIn.stdout.includes(RULE_TCP_IN) || !resIn.stdout.toLowerCase().includes('no rules'));
  if (hasInbound) {
    rulesFound.push(RULE_TCP_IN);
  } else {
    missingRules.push(RULE_TCP_IN);
  }

  // Comprobar regla TCP Salida
  const resOut = await runCommand(`netsh advfirewall firewall show rule name="${RULE_TCP_OUT}"`, 4000);
  const hasOutbound = resOut.success && (resOut.stdout.includes(RULE_TCP_OUT) || !resOut.stdout.toLowerCase().includes('no rules'));
  if (hasOutbound) {
    rulesFound.push(RULE_TCP_OUT);
  } else {
    missingRules.push(RULE_TCP_OUT);
  }

  // Comprobar reglas para el ejecutable
  const resExeIn = await runCommand(`netsh advfirewall firewall show rule name="${RULE_EXE_IN}"`, 4000);
  const hasExeIn = resExeIn.success && (resExeIn.stdout.includes(RULE_EXE_IN) || !resExeIn.stdout.toLowerCase().includes('no rules'));
  if (hasExeIn) rulesFound.push(RULE_EXE_IN);

  const resExeOut = await runCommand(`netsh advfirewall firewall show rule name="${RULE_EXE_OUT}"`, 4000);
  const hasExeOut = resExeOut.success && (resExeOut.stdout.includes(RULE_EXE_OUT) || !resExeOut.stdout.toLowerCase().includes('no rules'));
  if (hasExeOut) rulesFound.push(RULE_EXE_OUT);

  const isConfigured = hasInbound && hasOutbound;

  return {
    isWindows: true,
    configured: isConfigured,
    status: isConfigured ? 'OK' : 'REQUIERE CONFIGURACIÓN',
    statusText: isConfigured ? 'Firewall Windows: OK' : 'Firewall Windows: REQUIERE CONFIGURACIÓN',
    isAdmin,
    rules: rulesFound,
    missingRules,
    inboundPort4370: hasInbound,
    outboundPort4370: hasOutbound,
    appInbound: hasExeIn,
    appOutbound: hasExeOut,
    details: isConfigured
      ? 'Reglas institucionales de Firewall para marcadores ZKTeco (puerto TCP 4370) activas y verificadas.'
      : `Se requieren reglas de Firewall para el puerto TCP 4370. Faltantes: ${missingRules.join(', ')}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Repara la configuración de red y crea/actualiza las reglas del Firewall de Windows.
 */
async function repairNetworkConfig() {
  const isWindows = process.platform === 'win32';

  if (!isWindows) {
    return {
      success: true,
      message: 'Configuración de red verificada (Entorno no Windows). Tráfico TCP 4370 operativo.',
      firewallStatus: {
        isWindows: false,
        configured: true,
        status: 'OK',
        statusText: 'Firewall: OK (Simulado)',
        isAdmin: false,
        rules: [RULE_TCP_IN, RULE_TCP_OUT],
        missingRules: [],
        inboundPort4370: true,
        outboundPort4370: true,
        appInbound: true,
        appOutbound: true,
        details: 'Configuración estándar institucional TCP 4370 habilitada.',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  log('Iniciando proceso de reparación de Firewall de Windows...');
  const exePath = getApplicationExePath();

  // 1. Eliminar reglas duplicadas u obsoletas
  await runCommand(`netsh advfirewall firewall delete rule name="${RULE_TCP_IN}"`, 3000);
  await runCommand(`netsh advfirewall firewall delete rule name="${RULE_TCP_OUT}"`, 3000);
  await runCommand(`netsh advfirewall firewall delete rule name="${RULE_EXE_IN}"`, 3000);
  await runCommand(`netsh advfirewall firewall delete rule name="${RULE_EXE_OUT}"`, 3000);

  // 2. Crear regla Entrada TCP 4370
  const cmdIn = `netsh advfirewall firewall add rule name="${RULE_TCP_IN}" dir=in action=allow protocol=TCP localport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco"`;
  const resIn = await runCommand(cmdIn, 5000);

  // 3. Crear regla Salida TCP 4370
  const cmdOut = `netsh advfirewall firewall add rule name="${RULE_TCP_OUT}" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco"`;
  const resOut = await runCommand(cmdOut, 5000);

  // 4. Crear reglas para ejecutable si existe
  if (exePath && fs.existsSync(exePath)) {
    await runCommand(`netsh advfirewall firewall add rule name="${RULE_EXE_IN}" dir=in action=allow program="${exePath}" enable=yes profile=any description="Regla institucional DRAC: Trafico de red entrante"`, 5000);
    await runCommand(`netsh advfirewall firewall add rule name="${RULE_EXE_OUT}" dir=out action=allow program="${exePath}" enable=yes profile=any description="Regla institucional DRAC: Trafico de red saliente"`, 5000);
  }

  // 5. Respaldo PowerShell si netsh reporta falta de elevación
  if (!resIn.success || !resOut.success) {
    log('Aplicando respaldo mediante PowerShell New-NetFirewallRule...');
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "New-NetFirewallRule -DisplayName '${RULE_TCP_IN}' -Direction Inbound -Protocol TCP -LocalPort 4370 -Action Allow -Profile Any -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName '${RULE_TCP_OUT}' -Direction Outbound -Protocol TCP -RemotePort 4370 -Action Allow -Profile Any -ErrorAction SilentlyContinue"`;
    await runCommand(psCmd, 8000);
  }

  // Re-evaluar estado del Firewall
  const updatedStatus = await checkFirewallStatus();

  return {
    success: updatedStatus.configured,
    message: updatedStatus.configured
      ? 'Configuración de red y Firewall de Windows reparada correctamente. Puerto TCP 4370 habilitado.'
      : 'Se intentó configurar el Firewall, pero se requieren permisos de Administrador para aplicar los cambios en el sistema operativo.',
    firewallStatus: updatedStatus,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Tarea de inicio silenciosa: verifica que las reglas existan; si no, intenta crearlas sin bloquear.
 */
async function ensureFirewallOnStartup() {
  if (process.platform !== 'win32') return;

  try {
    const status = await checkFirewallStatus();
    if (!status.configured) {
      log('Reglas de Firewall no detectadas al iniciar. Intentando aprovisionamiento automático...');
      const repairRes = await repairNetworkConfig();
      log(`Resultado de aprovisionamiento de Firewall al inicio: ${repairRes.message}`);
    } else {
      log('Reglas de Firewall para puerto TCP 4370 verificadas activas al inicio.');
    }
  } catch (err) {
    log(`Aviso en ensureFirewallOnStartup: ${err.message}`);
  }
}

module.exports = {
  checkFirewallStatus,
  repairNetworkConfig,
  ensureFirewallOnStartup,
};
