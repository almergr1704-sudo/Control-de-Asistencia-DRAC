import {
  MarcacionRaw,
  Employee,
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

