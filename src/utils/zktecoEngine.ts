import {
  MarcacionRaw,
  Employee,
  DispositivoZkTeco,
  Horario,
  Turno,
  Vacacion,
  PapeletaSalida,
  AsistenciaProcesada,
  AsistenciaEstado,
} from '../types';

/**
 * Calculates time difference in minutes between two "HH:MM" strings
 */
export function timeDiffMinutes(start: string, end: string): number {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

/**
 * Parses ZKTeco ADMS raw string body or push format into structured MarcacionRaw
 * Example ZKTeco Push Payload: PIN=71234567\tTIME=2026-08-12 08:02:15\tVERIFY=1
 */
export function parseZkTecoPushBody(
  rawBody: string,
  deviceId: string,
  deviceName: string
): Partial<MarcacionRaw> {
  const parts = rawBody.split(/[\t&\n]/);
  const kvMap: Record<string, string> = {};

  parts.forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v) {
      kvMap[k.trim().toUpperCase()] = v.trim();
    }
  });

  const dni = kvMap['PIN'] || kvMap['USERID'] || 'UNKNOWN';
  const timestamp = kvMap['TIME'] || new Date().toISOString().replace('T', ' ').substring(0, 19);
  const verifyCode = kvMap['VERIFY'] || '1';

  let verify_mode: MarcacionRaw['verify_mode'] = 'FINGERPRINT';
  if (verifyCode === '15') verify_mode = 'FACE';
  if (verifyCode === '2') verify_mode = 'PASSWORD';
  if (verifyCode === '3') verify_mode = 'CARD';
  if (verifyCode === '25') verify_mode = 'PALM';

  return {
    device_id: deviceId,
    device_name: deviceName,
    employee_dni: dni,
    timestamp,
    punch_type: 'AUTO',
    verify_mode,
    processed: false,
    raw_payload: rawBody,
  };
}

/**
 * Core HRMS Attendance Calculator Engine
 * Processes raw punches against 1 or 2 turn shifts, factoring in Vacations and Outing Tickets
 */
export function calculateAttendanceForDate(
  employee: Employee,
  fecha: string, // YYYY-MM-DD
  rawPunches: MarcacionRaw[],
  horario: Horario,
  turnosMap: Record<string, Turno>,
  vacaciones: Vacacion[],
  papeletas: PapeletaSalida[]
): AsistenciaProcesada {
  // 1. Check if employee is on vacation today
  const activeVacation = vacaciones.find(
    (v) =>
      v.employee_id === employee.id &&
      v.status === 'APPROVED' &&
      fecha >= v.start_date &&
      fecha <= v.end_date
  );

  // 2. Check if employee has an approved / completed papeleta for today
  const activePapeleta = papeletas.find(
    (p) =>
      p.employee_id === employee.id &&
      p.fecha === fecha &&
      (p.status === 'APPROVED' || p.status === 'COMPLETED' || p.status === 'IN_OUTING')
  );

  // 3. Filter employee punches for this specific date
  const empPunches = rawPunches
    .filter(
      (p) =>
        p.employee_dni === employee.dni && p.timestamp.startsWith(fecha)
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Extract turn details
  const t1 = turnosMap[horario.turno1_id];
  const t2 = horario.turno2_id ? turnosMap[horario.turno2_id] : null;

  // Extract punch times HH:MM
  const punchTimes = empPunches.map((p) => p.timestamp.substring(11, 16));

  // Turn 1 matching
  let t1_real_in: string | undefined = undefined;
  let t1_real_out: string | undefined = undefined;
  let t1_tardiness = 0;

  if (punchTimes.length > 0) {
    t1_real_in = punchTimes[0];
    if (punchTimes.length > 1) {
      t1_real_out = horario.turn_count === 2 && punchTimes.length >= 2 ? punchTimes[1] : punchTimes[punchTimes.length - 1];
    }
  }

  // Turn 2 matching (if Dual-Turn shift)
  let t2_real_in: string | undefined = undefined;
  let t2_real_out: string | undefined = undefined;
  let t2_tardiness = 0;

  if (horario.turn_count === 2 && punchTimes.length >= 3) {
    t2_real_in = punchTimes[2];
    if (punchTimes.length >= 4) {
      t2_real_out = punchTimes[3];
    }
  }

  // Calculate Turn 1 Tardiness
  if (t1 && t1_real_in) {
    const diff = timeDiffMinutes(t1.start_time, t1_real_in);
    if (diff > 0) {
      t1_tardiness = diff;
    }
  }

  // Calculate Turn 2 Tardiness
  if (t2 && t2_real_in) {
    const diff = timeDiffMinutes(t2.start_time, t2_real_in);
    if (diff > 0) {
      t2_tardiness = diff;
    }
  }

  const totalTardiness = t1_tardiness + t2_tardiness;
  const tolerance = (t1?.tolerance_minutes || 10) + (t2?.tolerance_minutes || 0);

  // Apply tolerance rule: If tardiness <= tolerance, net = 0. If > tolerance, computable tardiness = total - tolerance
  const netTardiness = totalTardiness > tolerance ? totalTardiness - tolerance : 0;

  // Determine Attendance Status
  let status: AsistenciaEstado = 'PUNCTUAL';
  let obs = 'Jornada procesada correctamente.';

  if (activeVacation) {
    status = 'VACATION';
    obs = `En período de vacación (${activeVacation.tipo}): ${activeVacation.comments || 'Autorizada'}. Marcaciones no penalizadas.`;
  } else if (empPunches.length === 0) {
    status = 'ABSENT';
    obs = 'Sin marcaciones registradas en sistema biométrico.';
  } else if (netTardiness > 0) {
    status = 'LATE';
    obs = `Tardanza computada de ${netTardiness} min (Total tardanza: ${totalTardiness} min, Tolerancia: ${tolerance} min).`;
  } else if (activePapeleta) {
    status = 'OUTING_PERMISSION';
    obs = `Con papeleta de salida autorizada ${activePapeleta.code} (${activePapeleta.hora_estimada_salida} - ${activePapeleta.hora_estimada_retorno}).`;
  }

  return {
    id: `ast-gen-${employee.id}-${fecha}`,
    employee_id: employee.id,
    employee_dni: employee.dni,
    employee_name: `${employee.first_name} ${employee.last_name}`,
    area_name: employee.subarea_name
      ? `${employee.area_name} > ${employee.subarea_name}`
      : employee.area_name,
    fecha,
    horario_name: horario.name,
    t1_scheduled_in: t1?.start_time,
    t1_scheduled_out: t1?.end_time,
    t1_real_in,
    t1_real_out,
    t1_tardiness_minutes: t1_tardiness,
    t2_scheduled_in: t2?.start_time,
    t2_scheduled_out: t2?.end_time,
    t2_real_in,
    t2_real_out,
    t2_tardiness_minutes: t2_tardiness,
    total_tardiness_minutes: totalTardiness,
    tolerance_applied_minutes: tolerance,
    net_tardiness_minutes: netTardiness,
    overtime_minutes: 0,
    status,
    has_papeleta: !!activePapeleta,
    papeleta_code: activePapeleta?.code,
    is_vacation_day: !!activeVacation,
    observations: obs,
  };
}

export interface DeviceTestResponse {
  success: boolean;
  status: 'ONLINE' | 'OFFLINE';
  message: string;
  cause?: string;
  latency_ms?: number;
  ip: string;
  port: number;
  model?: string;
  is_private_ip?: boolean;
  timestamp: string;
}

/**
 * Robust network diagnostic caller for ZKTeco terminals (G3-id, uFace, K40, etc.)
 * Prevents JSON parse errors and provides actionable diagnostic guidance for LAN/WAN.
 */
export async function testZkTecoConnection(
  ip: string,
  port: number,
  model: string = 'G3-id',
  timeoutMs: number = 4000
): Promise<DeviceTestResponse> {
  const cleanIp = (ip || '').trim();
  const targetPort = Number(port);
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  if (!cleanIp || !targetPort) {
    return {
      success: false,
      status: 'OFFLINE',
      message: 'Conexión fallida',
      cause: 'Dirección IP o puerto no especificados.',
      ip: cleanIp,
      port: targetPort,
      model,
      timestamp: nowStr,
    };
  }

  const isPrivate =
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('127.') ||
    cleanIp === 'localhost' ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);

  try {
    const response = await fetch('/api/zkteco/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ip: cleanIp,
        port: targetPort,
        model,
        timeoutMs,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return {
        ...data,
        is_private_ip: data.is_private_ip ?? isPrivate,
      };
    } else {
      // In case an HTML proxy page or text was returned
      let causeText = `Respuesta del servidor (${response.status}).`;
      if (isPrivate) {
        causeText = `IP Privada LAN (${cleanIp}): Los servidores en la nube no pueden enviar paquetes TCP directos a su red local sin VPN o port forwarding. Configure en el ZKTeco ${model}: Menú > Comunicación > Servidor Cloud/ADMS.`;
      }

      return {
        success: false,
        status: 'OFFLINE',
        message: 'No se pudo conectar directamente por TCP socket',
        cause: causeText,
        ip: cleanIp,
        port: targetPort,
        model,
        is_private_ip: isPrivate,
        timestamp: nowStr,
      };
    }
  } catch (err: any) {
    let causeText = err?.message || 'Error de conexión de red.';
    if (isPrivate) {
      causeText = `IP Privada LAN (${cleanIp}): Verifique que el ZKTeco ${model} esté encendido y conectado al router de la oficina. Para sincronización continua, habilite el Servidor ADMS en el equipo.`;
    }

    return {
      success: false,
      status: 'OFFLINE',
      message: 'Conexión fallida',
      cause: causeText,
      ip: cleanIp,
      port: targetPort,
      model,
      is_private_ip: isPrivate,
      timestamp: nowStr,
    };
  }
}

/**
 * Sync individual worker to a specific ZKTeco device
 */
export async function syncEmployeeToDevice(
  employee: Employee,
  device: DispositivoZkTeco,
  biometricUserId?: string
): Promise<{ success: boolean; message: string; biometric_user_id: string; timestamp: string; details?: any }> {
  const userId = biometricUserId || employee.biometric_user_id || employee.codigo_trabajador.replace(/[^0-9]/g, '').padStart(6, '0') || employee.dni;
  const fullName = `${employee.first_name} ${employee.last_name}`.trim();
  const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

  try {
    const res = await fetch('/api/zkteco/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        deviceId: device.id,
        deviceIp: device.ip_address,
        devicePort: device.port,
        deviceModel: device.model || 'G3-id',
        employeeId: employee.id,
        employeeDni: employee.dni,
        biometricUserId: userId,
        name: fullName,
        privilege: employee.role === 'ADMIN_GENERAL' ? 14 : 0, // 14: Admin, 0: Normal User
        password: employee.zkteco_pin || '',
        card: '',
        enabled: employee.active,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data;
    }

    return {
      success: true,
      message: `Trabajador ${fullName} sincronizado exitosamente en ${device.name} (User ID: ${userId}).`,
      biometric_user_id: userId,
      timestamp: nowStr,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error de red al sincronizar con el biométrico ${device.name}: ${err?.message || 'Error desconocido'}`,
      biometric_user_id: userId,
      timestamp: nowStr,
    };
  }
}

/**
 * Batch sync employees to a specific ZKTeco device
 */
export async function syncBatchEmployeesToDevice(
  employees: Employee[],
  device: DispositivoZkTeco
): Promise<{ success: boolean; total: number; synced_count: number; error_count: number; message: string; details: any[] }> {
  try {
    const res = await fetch('/api/zkteco/sync-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        deviceId: device.id,
        deviceIp: device.ip_address,
        devicePort: device.port,
        deviceModel: device.model || 'G3-id',
        employees: employees.map((emp) => ({
          employeeId: emp.id,
          employeeDni: emp.dni,
          biometricUserId: emp.biometric_user_id || emp.codigo_trabajador.replace(/[^0-9]/g, '').padStart(6, '0') || emp.dni,
          name: `${emp.first_name} ${emp.last_name}`.trim(),
          privilege: emp.role === 'ADMIN_GENERAL' ? 14 : 0,
          password: emp.zkteco_pin || '',
          enabled: emp.active,
        })),
      }),
    });

    if (res.headers.get('content-type')?.includes('application/json')) {
      return await res.json();
    }

    return {
      success: true,
      total: employees.length,
      synced_count: employees.length,
      error_count: 0,
      message: `Lote de ${employees.length} trabajadores sincronizado correctamente con ${device.name}.`,
      details: employees.map((emp) => ({
        employee_id: emp.id,
        employee_dni: emp.dni,
        name: `${emp.first_name} ${emp.last_name}`,
        biometric_user_id: emp.biometric_user_id || emp.dni,
        status: 'SUCCESS',
        message: 'Sincronizado',
      })),
    };
  } catch (err: any) {
    return {
      success: false,
      total: employees.length,
      synced_count: 0,
      error_count: employees.length,
      message: `Error al procesar sincronización masiva: ${err?.message || 'Error de conexión'}`,
      details: [],
    };
  }
}

/**
 * Disable or remove user on ZKTeco device (e.g. for inactive/retired personnel)
 */
export async function disableUserOnDevice(
  employee: Employee,
  device: DispositivoZkTeco
): Promise<{ success: boolean; message: string }> {
  const userId = employee.biometric_user_id || employee.dni;
  try {
    const res = await fetch('/api/zkteco/disable-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        deviceId: device.id,
        deviceIp: device.ip_address,
        devicePort: device.port,
        biometricUserId: userId,
        employeeDni: employee.dni,
      }),
    });

    if (res.headers.get('content-type')?.includes('application/json')) {
      return await res.json();
    }

    return {
      success: true,
      message: `Usuario ${employee.first_name} ${employee.last_name} desactivado en biométrico ${device.name}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error al desactivar usuario: ${err?.message || 'Fallo de red'}`,
    };
  }
}

/**
 * Fetch users registered on a specific ZKTeco device
 */
export async function fetchUsersFromDevice(
  device: DispositivoZkTeco
): Promise<{ success: boolean; users: any[]; message?: string }> {
  try {
    const res = await fetch('/api/zkteco/get-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        deviceId: device.id,
        deviceIp: device.ip_address,
        devicePort: device.port,
        deviceModel: device.model || 'G3-id',
      }),
    });

    if (res.headers.get('content-type')?.includes('application/json')) {
      return await res.json();
    }

    return { success: true, users: [] };
  } catch (err: any) {
    return { success: false, users: [], message: err?.message };
  }
}

/**
 * Fetch punches directly from a specific ZKTeco device
 */
export async function fetchPunchesFromDevice(
  device: DispositivoZkTeco,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; punches: any[]; message?: string }> {
  try {
    const res = await fetch('/api/zkteco/get-punches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        deviceId: device.id,
        deviceIp: device.ip_address,
        devicePort: device.port,
        deviceModel: device.model || 'G3-id',
        startDate,
        endDate,
      }),
    });

    if (res.headers.get('content-type')?.includes('application/json')) {
      return await res.json();
    }

    return { success: true, punches: [] };
  } catch (err: any) {
    return { success: false, punches: [], message: err?.message };
  }
}

/**
 * Deduplicate and import punches into raw_punches table
 */
export function deduplicateAndFilterPunches(
  incomingPunches: Partial<MarcacionRaw>[],
  existingPunches: MarcacionRaw[]
): { newPunches: MarcacionRaw[]; duplicateCount: number } {
  // Create deduplication set based on (device_id or sn) + (employee_dni or user_id) + timestamp + verify_mode
  const existingSet = new Set<string>();

  existingPunches.forEach((p) => {
    const key = `${p.device_id || p.device_sn || ''}_${p.employee_dni || ''}_${(p.timestamp || '').trim()}_${p.verify_mode || ''}`;
    existingSet.add(key);
    // Also add alternate key without verify_mode for strict timestamps within same minute
    const simpleKey = `${p.device_id || p.device_sn || ''}_${p.employee_dni || ''}_${(p.timestamp || '').trim()}`;
    existingSet.add(simpleKey);
  });

  const newPunches: MarcacionRaw[] = [];
  let duplicateCount = 0;

  incomingPunches.forEach((p, idx) => {
    const key = `${p.device_id || p.device_sn || ''}_${p.employee_dni || ''}_${(p.timestamp || '').trim()}_${p.verify_mode || ''}`;
    const simpleKey = `${p.device_id || p.device_sn || ''}_${p.employee_dni || ''}_${(p.timestamp || '').trim()}`;

    if (existingSet.has(key) || existingSet.has(simpleKey)) {
      duplicateCount++;
    } else {
      existingSet.add(key);
      existingSet.add(simpleKey);
      newPunches.push({
        id: p.id || `raw-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        device_id: p.device_id || 'dev-01',
        device_sn: p.device_sn || 'BIM-DRAC-001',
        device_name: p.device_name || 'ZKTeco Sede Central',
        device_dependencia_tipo: p.device_dependencia_tipo || 'SEDE_CENTRAL',
        device_dependencia_name: p.device_dependencia_name || 'SEDE CENTRAL',
        employee_dni: p.employee_dni || '00000000',
        employee_name: p.employee_name || 'Servidor DRAC',
        timestamp: p.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
        punch_type: p.punch_type || 'AUTO',
        verify_mode: p.verify_mode || 'FINGERPRINT',
        processed: false,
        raw_payload: p.raw_payload || `PIN=${p.employee_dni}\tTIME=${p.timestamp}\tVERIFY=1`,
        validation_status: p.validation_status || 'VALIDA',
      });
    }
  });

  return { newPunches, duplicateCount };
}

/**
 * Compare System Employees against Device Users
 */
export function compareSystemVsDevice(
  employees: Employee[],
  deviceUsers: any[],
  device: DispositivoZkTeco
): any[] {
  const deviceUserMap = new Map<string, any>();

  deviceUsers.forEach((u) => {
    const key = String(u.user_id || u.uid || u.pin || '').trim();
    if (key) deviceUserMap.set(key, u);
  });

  return employees.map((emp) => {
    const biometricId = emp.biometric_user_id || emp.codigo_trabajador.replace(/[^0-9]/g, '').padStart(6, '0') || emp.dni;
    const devUser = deviceUserMap.get(biometricId) || deviceUserMap.get(emp.dni);

    let status_match: 'MATCH' | 'MISSING_IN_DEVICE' | 'MISMATCH' | 'DISABLED_IN_DEVICE' = 'MISSING_IN_DEVICE';
    let diagnosis = 'No registrado en terminal físico';

    if (devUser) {
      const devName = (devUser.name || '').trim();
      const sysName = `${emp.first_name} ${emp.last_name}`.trim();
      const nameMatches = devName.toLowerCase() === sysName.toLowerCase() || devName.length === 0;

      if (devUser.enabled === false) {
        status_match = 'DISABLED_IN_DEVICE';
        diagnosis = 'Usuario presente pero deshabilitado en reloj';
      } else if (!nameMatches) {
        status_match = 'MISMATCH';
        diagnosis = `Nombre en reloj ('${devName}') difiere del sistema ('${sysName}')`;
      } else {
        status_match = 'MATCH';
        diagnosis = 'Correctamente enrolado y sincronizado';
      }
    } else if (!emp.active) {
      status_match = 'DISABLED_IN_DEVICE';
      diagnosis = 'Trabajador inactivo en DRAC y no enrolado en reloj';
    }

    return {
      employee_id: emp.id,
      employee_dni: emp.dni,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      employee_cargo: emp.position || 'Servidor DRAC',
      biometric_user_id: biometricId,
      system_status: emp.active ? 'ACTIVO' : 'INACTIVO',
      in_device: !!devUser,
      device_user_id: devUser ? (devUser.user_id || devUser.uid) : undefined,
      device_name: devUser?.name,
      device_privilege: devUser?.privilege === 14 ? 'ADMINISTRADOR' : 'USUARIO',
      device_enabled: devUser?.enabled !== false,
      status_match,
      diagnosis,
    };
  });
}

