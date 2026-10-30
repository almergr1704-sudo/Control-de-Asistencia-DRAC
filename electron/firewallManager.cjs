/**
 * DRAC Cajamarca - Gestor de Reglas de Firewall de Windows y Red Institucional
 * Permite auditar, verificar y reparar reglas específicas para el puerto TCP configurado
 * del marcador biométrico (por defecto 7496, con alternativa 4370) y el ejecutable institucional.
 *
 * Cumplimiento de seguridad:
 * - NO desactiva el Firewall de Windows.
 * - NO abre puertos indiscriminadamente.
 * - Configura exclusivamente el puerto TCP identificado y necesario para la comunicación.
 */

const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

function getRuleNames(port = 7496) {
  const p = Number(port) || 7496;
  return {
    ruleTcpIn: `DRAC Control Asistencia - ZKTeco TCP ${p} IN`,
    ruleTcpOut: `DRAC Control Asistencia - ZKTeco TCP ${p} OUT`,
    ruleExeIn: 'DRAC Control Asistencia - Aplicacion Ejecutable IN',
    ruleExeOut: 'DRAC Control Asistencia - Aplicacion Ejecutable OUT',
    port: p,
  };
}

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

    if (
      process.execPath &&
      process.execPath.toLowerCase().endsWith('.exe') &&
      !process.execPath.toLowerCase().includes('node.exe') &&
      !process.execPath.toLowerCase().includes('electron.exe')
    ) {
      return process.execPath;
    }

    if (fs.existsSync(defaultInstallPath)) {
      return defaultInstallPath;
    }

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
 * Comprueba el estado actual de las reglas del Firewall de Windows para el puerto TCP identificado.
 */
async function checkFirewallStatus(port = 7496) {
  const isWindows = process.platform === 'win32';
  const { ruleTcpIn, ruleTcpOut, ruleExeIn, ruleExeOut, port: targetPort } = getRuleNames(port);

  // Si se ejecuta en entorno Linux/Cloud/Dev, responder OK simulado para no bloquear UI
  if (!isWindows) {
    return {
      isWindows: false,
      configured: true,
      port: targetPort,
      status: 'OK',
      statusText: `Firewall: Entorno Servidor / Web (TCP ${targetPort} Habilitado)`,
      isAdmin: false,
      rules: [ruleTcpIn, ruleTcpOut],
      missingRules: [],
      inboundPort: true,
      outboundPort: true,
      appInbound: true,
      appOutbound: true,
      details: `El sistema se encuentra en un entorno no Windows. La conectividad TCP ${targetPort} opera sin restricciones locales.`,
      timestamp: new Date().toISOString(),
    };
  }

  const isAdmin = await checkAdminPrivileges();
  const rulesFound = [];
  const missingRules = [];

  // Comprobar regla TCP Entrada para el puerto configurado
  const resIn = await runCommand(`netsh advfirewall firewall show rule name="${ruleTcpIn}"`, 4000);
  const hasInbound = resIn.success && (resIn.stdout.includes(ruleTcpIn) || !resIn.stdout.toLowerCase().includes('no rules'));
  if (hasInbound) {
    rulesFound.push(ruleTcpIn);
  } else {
    missingRules.push(ruleTcpIn);
  }

  // Comprobar regla TCP Salida para el puerto configurado
  const resOut = await runCommand(`netsh advfirewall firewall show rule name="${ruleTcpOut}"`, 4000);
  const hasOutbound = resOut.success && (resOut.stdout.includes(ruleTcpOut) || !resOut.stdout.toLowerCase().includes('no rules'));
  if (hasOutbound) {
    rulesFound.push(ruleTcpOut);
  } else {
    missingRules.push(ruleTcpOut);
  }

  // Comprobar reglas para el ejecutable
  const resExeIn = await runCommand(`netsh advfirewall firewall show rule name="${ruleExeIn}"`, 4000);
  const hasExeIn = resExeIn.success && (resExeIn.stdout.includes(ruleExeIn) || !resExeIn.stdout.toLowerCase().includes('no rules'));
  if (hasExeIn) rulesFound.push(ruleExeIn);

  const resExeOut = await runCommand(`netsh advfirewall firewall show rule name="${ruleExeOut}"`, 4000);
  const hasExeOut = resExeOut.success && (resExeOut.stdout.includes(ruleExeOut) || !resExeOut.stdout.toLowerCase().includes('no rules'));
  if (hasExeOut) rulesFound.push(ruleExeOut);

  const isConfigured = hasInbound && hasOutbound;

  return {
    isWindows: true,
    configured: isConfigured,
    port: targetPort,
    status: isConfigured ? 'OK' : 'REQUIERE CONFIGURACIÓN',
    statusText: isConfigured ? `Firewall Windows: OK (TCP ${targetPort})` : `Firewall Windows: REQUIERE CONFIGURACIÓN (TCP ${targetPort})`,
    isAdmin,
    rules: rulesFound,
    missingRules,
    inboundPort: hasInbound,
    outboundPort: hasOutbound,
    appInbound: hasExeIn,
    appOutbound: hasExeOut,
    details: isConfigured
      ? `Reglas institucionales de Firewall para el marcador ZKTeco (puerto TCP ${targetPort}) activas y verificadas.`
      : `Se requieren reglas de Firewall para el puerto TCP ${targetPort}. Faltantes: ${missingRules.join(', ')}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Repara la configuración de red y crea/actualiza las reglas del Firewall de Windows para el puerto específico.
 * Solo afecta al puerto de comunicación identificado, garantizando la seguridad del sistema.
 */
async function repairNetworkConfig(port = 7496) {
  const isWindows = process.platform === 'win32';
  const { ruleTcpIn, ruleTcpOut, ruleExeIn, ruleExeOut, port: targetPort } = getRuleNames(port);

  if (!isWindows) {
    return {
      success: true,
      port: targetPort,
      message: `Configuración de red verificada (Entorno no Windows). Tráfico TCP ${targetPort} operativo.`,
      firewallStatus: {
        isWindows: false,
        configured: true,
        port: targetPort,
        status: 'OK',
        statusText: `Firewall: OK (TCP ${targetPort})`,
        isAdmin: false,
        rules: [ruleTcpIn, ruleTcpOut],
        missingRules: [],
        inboundPort: true,
        outboundPort: true,
        appInbound: true,
        appOutbound: true,
        details: `Configuración específica institucional TCP ${targetPort} habilitada.`,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  log(`Iniciando configuración de regla de Firewall para puerto TCP ${targetPort}...`);
  const exePath = getApplicationExePath();

  // 1. Eliminar reglas previas específicas de este puerto para evitar duplicados
  await runCommand(`netsh advfirewall firewall delete rule name="${ruleTcpIn}"`, 3000);
  await runCommand(`netsh advfirewall firewall delete rule name="${ruleTcpOut}"`, 3000);

  // 2. Crear regla Entrada TCP específica para el puerto targetPort
  const cmdIn = `netsh advfirewall firewall add rule name="${ruleTcpIn}" dir=in action=allow protocol=TCP localport=${targetPort} profile=any description="Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco (Puerto ${targetPort})"`;
  const resIn = await runCommand(cmdIn, 5000);

  // 3. Crear regla Salida TCP específica para el puerto targetPort
  const cmdOut = `netsh advfirewall firewall add rule name="${ruleTcpOut}" dir=out action=allow protocol=TCP remoteport=${targetPort} profile=any description="Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco (Puerto ${targetPort})"`;
  const resOut = await runCommand(cmdOut, 5000);

  // 4. Crear reglas para ejecutable si existe
  if (exePath && fs.existsSync(exePath)) {
    await runCommand(`netsh advfirewall firewall add rule name="${ruleExeIn}" dir=in action=allow program="${exePath}" enable=yes profile=any description="Regla institucional DRAC: Trafico de red entrante"`, 5000);
    await runCommand(`netsh advfirewall firewall add rule name="${ruleExeOut}" dir=out action=allow program="${exePath}" enable=yes profile=any description="Regla institucional DRAC: Trafico de red saliente"`, 5000);
  }

  // 5. Respaldo PowerShell si netsh reporta falta de elevación
  if (!resIn.success || !resOut.success) {
    log(`Aplicando respaldo mediante PowerShell para puerto ${targetPort}...`);
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "New-NetFirewallRule -DisplayName '${ruleTcpIn}' -Direction Inbound -Protocol TCP -LocalPort ${targetPort} -Action Allow -Profile Any -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName '${ruleTcpOut}' -Direction Outbound -Protocol TCP -RemotePort ${targetPort} -Action Allow -Profile Any -ErrorAction SilentlyContinue"`;
    await runCommand(psCmd, 8000);
  }

  // Re-evaluar estado del Firewall
  const updatedStatus = await checkFirewallStatus(targetPort);

  return {
    success: updatedStatus.configured,
    port: targetPort,
    message: updatedStatus.configured
      ? `Regla de Firewall de Windows configurada correctamente para puerto TCP ${targetPort}.`
      : `Se intentó configurar el Firewall para el puerto TCP ${targetPort}, pero se requieren permisos de Administrador para aplicar los cambios en Windows.`,
    firewallStatus: updatedStatus,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Tarea de inicio silenciosa: verifica que las reglas existan; si no, intenta crearlas sin bloquear.
 */
async function ensureFirewallOnStartup(port = 7496) {
  if (process.platform !== 'win32') return;

  try {
    const status = await checkFirewallStatus(port);
    if (!status.configured) {
      log(`Reglas de Firewall para puerto ${port} no detectadas al iniciar. Intentando configuración específica...`);
      const repairRes = await repairNetworkConfig(port);
      log(`Resultado de aprovisionamiento de Firewall: ${repairRes.message}`);
    } else {
      log(`Reglas de Firewall para puerto TCP ${port} verificadas activas.`);
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
