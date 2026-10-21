/**
 * DRAC Cajamarca - Gestor de Reglas de Firewall de Windows y Configuración de Red
 * Administra la apertura y verificación de puertos TCP 4370 (ZKTeco) y 7496 / 89 (BioTime)
 */

const { exec } = require('child_process');
const os = require('os');
const path = require('path');

const RULE_NAME_IN = 'DRAC Control Asistencia - ZKTeco TCP 4370 IN';
const RULE_NAME_OUT = 'DRAC Control Asistencia - ZKTeco TCP 4370 OUT';
const RULE_NAME_BT_DB = 'DRAC Control Asistencia - BioTime TCP 7496 IN';
const RULE_NAME_BT_OUT = 'DRAC Control Asistencia - BioTime TCP 7496 OUT';
const RULE_NAME_BT_WEB = 'DRAC Control Asistencia - BioTime Web 89 OUT';
const RULE_NAME_EXE_IN = 'DRAC Control Asistencia - Aplicación Ejecutable IN';
const RULE_NAME_EXE_OUT = 'DRAC Control Asistencia - Aplicación Ejecutable OUT';

/**
 * Ejecuta comandos de consola en Windows de forma segura
 */
function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, timeout: 10000 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        code: error ? error.code : 0,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim(),
      });
    });
  });
}

/**
 * Consulta el estado de las reglas en el Firewall de Windows
 */
async function checkFirewallStatus() {
  const isWindows = process.platform === 'win32';
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  if (!isWindows) {
    return {
      isWindows: false,
      configured: true,
      status: 'NO_APLICA',
      statusText: 'Firewall Windows: No aplica en este entorno (Linux / macOS)',
      details: 'El sistema de verificación de Firewall de Windows solo se ejecuta en entornos Windows 10/11 o Windows Server.',
      rules: [],
      timestamp: nowStr,
    };
  }

  try {
    const res = await runCommand(`netsh advfirewall firewall show rule name="${RULE_NAME_IN}"`);
    const isConfigured = res.success && res.stdout.includes(RULE_NAME_IN);

    if (isConfigured) {
      return {
        isWindows: true,
        configured: true,
        status: 'CONFIGURADO',
        statusText: 'Firewall Windows: REGLAS ACTIVAS (TCP 4370 / 7496)',
        details: 'Las reglas institucionales DRAC para comunicación con terminales ZKTeco y servidor BioTime están activas y permitidas.',
        rules: [RULE_NAME_IN, RULE_NAME_OUT, RULE_NAME_BT_DB, RULE_NAME_BT_OUT],
        timestamp: nowStr,
      };
    }

    return {
      isWindows: true,
      configured: false,
      status: 'REQUIERE CONFIGURACIÓN',
      statusText: 'Firewall Windows: REQUIERE CONFIGURACIÓN',
      details: 'No se encontraron las reglas para los puertos de comunicación ZKTeco (4370) o BioTime (7496 / 89). Haga clic en "Reparar Configuración de Red" o ejecute Reparar-Firewall-DRAC.bat como Administrador.',
      rules: [],
      timestamp: nowStr,
    };
  } catch (err) {
    return {
      isWindows: true,
      configured: false,
      status: 'ERROR',
      statusText: `Firewall Windows: Error al consultar (${err.message})`,
      details: err.message,
      rules: [],
      timestamp: nowStr,
    };
  }
}

/**
 * Acción de reparación automática: Crea y habilita las reglas de Firewall
 */
async function repairNetworkConfig() {
  const isWindows = process.platform === 'win32';
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  if (!isWindows) {
    return {
      success: true,
      message: 'Configuración simulada: No se requiere ajuste de Firewall en Linux/macOS.',
      timestamp: nowStr,
    };
  }

  try {
    const commands = [
      // 1. Limpieza preventiva
      `netsh advfirewall firewall delete rule name="${RULE_NAME_IN}"`,
      `netsh advfirewall firewall delete rule name="${RULE_NAME_OUT}"`,
      `netsh advfirewall firewall delete rule name="${RULE_NAME_BT_DB}"`,
      `netsh advfirewall firewall delete rule name="${RULE_NAME_BT_OUT}"`,
      `netsh advfirewall firewall delete rule name="${RULE_NAME_BT_WEB}"`,
      // 2. Reglas ZKTeco TCP 4370
      `netsh advfirewall firewall add rule name="${RULE_NAME_IN}" dir=in action=allow protocol=TCP localport=4370 profile=any description="DRAC: Comunicacion biometricos ZKTeco IN"`,
      `netsh advfirewall firewall add rule name="${RULE_NAME_OUT}" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="DRAC: Comunicacion biometricos ZKTeco OUT"`,
      // 3. Reglas BioTime Console TCP 7496 (PostgreSQL) y 89 (Apache HTTP)
      `netsh advfirewall firewall add rule name="${RULE_NAME_BT_DB}" dir=in action=allow protocol=TCP localport=7496 profile=any description="DRAC: Base de datos PostgreSQL BioTime IN"`,
      `netsh advfirewall firewall add rule name="${RULE_NAME_BT_OUT}" dir=out action=allow protocol=TCP remoteport=7496 profile=any description="DRAC: Base de datos PostgreSQL BioTime OUT"`,
      `netsh advfirewall firewall add rule name="${RULE_NAME_BT_WEB}" dir=out action=allow protocol=TCP remoteport=89 profile=any description="DRAC: Servicio Web Apache BioTime OUT"`,
    ];

    // 4. Si el ejecutable de la app existe, agregar regla por programa
    const exePath = process.execPath;
    if (exePath && exePath.toLowerCase().endsWith('.exe')) {
      commands.push(
        `netsh advfirewall firewall delete rule name="${RULE_NAME_EXE_IN}"`,
        `netsh advfirewall firewall delete rule name="${RULE_NAME_EXE_OUT}"`,
        `netsh advfirewall firewall add rule name="${RULE_NAME_EXE_IN}" dir=in action=allow program="${exePath}" enable=yes profile=any`,
        `netsh advfirewall firewall add rule name="${RULE_NAME_EXE_OUT}" dir=out action=allow program="${exePath}" enable=yes profile=any`
      );
    }

    let allSuccess = true;
    let combinedOutput = '';

    for (const cmd of commands) {
      const res = await runCommand(cmd);
      if (res.stdout) combinedOutput += res.stdout + '\n';
      // Las eliminaciones pueden fallar si no existía la regla previamente, eso es normal
      if (!cmd.includes('delete') && !res.success) {
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      message: allSuccess
        ? 'Reglas de Firewall configuradas y habilitadas exitosamente para ZKTeco (4370) y BioTime (7496, 89).'
        : 'Las reglas de Firewall fueron aplicadas parcialmente. Si se requiere elevación UAC, ejecute Reparar-Firewall-DRAC.bat como Administrador.',
      output: combinedOutput,
      timestamp: nowStr,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error al configurar reglas de Firewall: ${err.message}`,
      error: err.message,
      timestamp: nowStr,
    };
  }
}

/**
 * Verificación silenciosa en el inicio de la aplicación
 */
async function ensureFirewallOnStartup() {
  if (process.platform !== 'win32') return;
  try {
    const status = await checkFirewallStatus();
    if (!status.configured) {
      console.log('[firewallManager] Reglas no detectadas al inicio. Intentando configuración automática...');
      await repairNetworkConfig();
    } else {
      console.log('[firewallManager] Reglas de Firewall verificadas activas al inicio.');
    }
  } catch (err) {
    console.warn('[firewallManager] Advertencia en ensureFirewallOnStartup:', err.message);
  }
}

module.exports = {
  checkFirewallStatus,
  repairNetworkConfig,
  ensureFirewallOnStartup,
};
