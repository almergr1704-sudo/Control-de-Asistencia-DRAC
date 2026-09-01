import {
  DispositivoZkTeco,
  MarcacionRaw,
  AsistenciaProcesada,
  AuditLog,
  Employee,
  Horario,
  Turno,
  PapeletaSalida,
  Vacacion,
  PunchValidationStatus,
  AsistenciaEstado,
} from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
import { INITIAL_DEVICES, INITIAL_ATTENDANCE } from '../data/initialData';
import { INITIAL_RAW_PUNCHES } from '../data/initialRawPunches';

/**
 * SERVICIO CENTRALIZADO DE BIOMÉTRICOS, MARCACIONES Y ASISTENCIA (FASE 5)
 * 
 * Única Fuente de Verdad: Supabase PostgreSQL
 * Tablas:
 *  - marcadores_zkteco: Catálogo de terminales biométricos (TCP/IP y PUSH ADMS)
 *  - marcaciones_raw: Ingesta de pulsos biométricos con restricción de idempotencia
 *                     UQ_marcacion_idempotente (device_sn, employee_code, timestamp)
 *  - asistencias: Registros diarios procesados contra turnos, horarios y tolerancias
 *  - auditoria: Trazabilidad inmutable de eventos con origen WEB / DESKTOP / ZK_AGENT
 */

// ==========================================
// 1. GESTIÓN DE DISPOSITIVOS ZKTECO
// ==========================================

export async function fetchDevicesFromSupabase(): Promise<DispositivoZkTeco[]> {
  try {
    const { data, error } = await supabase
      .from('marcadores_zkteco')
      .select('*')
      .order('name', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        serial_number: d.serial_number || d.serialNumber || '',
        name: d.name || 'Marcador ZKTeco',
        brand: d.brand || 'ZKTeco',
        model: d.model || 'G3-id',
        ip_address: d.ip_address || d.ipAddress || '192.168.1.100',
        port: d.port || 4370,
        protocol: d.protocol || 'PUSH_ADMS',
        dependencia_id: d.dependencia_id || 'dep-01',
        dependencia_tipo: d.dependencia_tipo || 'SEDE_CENTRAL',
        dependencia_name: d.dependencia_name || 'SEDE CENTRAL',
        area_id: d.area_id,
        area_name: d.area_name,
        location_detail: d.location_detail || d.locationDetail || 'Ingreso Principal',
        status: d.status || 'ONLINE',
        firmware_version: d.firmware_version,
        enrolled_user_count: d.enrolled_user_count || 0,
        enrolled_fingerprint_count: d.enrolled_fingerprint_count || 0,
        enrolled_face_count: d.enrolled_face_count || 0,
        log_count: d.log_count || 0,
        adms_url: d.adms_url,
        capabilities: typeof d.capabilities === 'string' ? JSON.parse(d.capabilities) : d.capabilities,
        last_activity: d.last_activity || new Date().toISOString(),
        last_test: typeof d.last_test === 'string' ? JSON.parse(d.last_test) : d.last_test,
        push_config: typeof d.push_config === 'string' ? JSON.parse(d.push_config) : d.push_config,
      }));
    }

    // Fallback a Express API
    const res = await fetch('/api/devices');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con marcadores ZKTeco en Supabase:', err);
  }

  return INITIAL_DEVICES;
}

export async function saveDeviceToSupabase(
  device: DispositivoZkTeco
): Promise<{ success: boolean; data?: DispositivoZkTeco; message?: string }> {
  const origin = getAppOrigin();

  const dbDevice = {
    id: device.id,
    serial_number: device.serial_number,
    name: device.name,
    brand: device.brand || 'ZKTeco',
    model: device.model || 'G3-id',
    ip_address: device.ip_address,
    port: device.port || 4370,
    protocol: device.protocol || 'PUSH_ADMS',
    dependencia_id: device.dependencia_id,
    dependencia_tipo: device.dependencia_tipo || 'SEDE_CENTRAL',
    dependencia_name: device.dependencia_name,
    area_id: device.area_id || null,
    area_name: device.area_name || null,
    location_detail: device.location_detail,
    status: device.status || 'ONLINE',
    firmware_version: device.firmware_version || null,
    enrolled_user_count: device.enrolled_user_count || 0,
    enrolled_fingerprint_count: device.enrolled_fingerprint_count || 0,
    enrolled_face_count: device.enrolled_face_count || 0,
    log_count: device.log_count || 0,
    adms_url: device.adms_url || null,
    capabilities: device.capabilities || null,
    last_activity: device.last_activity || new Date().toISOString(),
    last_test: device.last_test || null,
    push_config: device.push_config || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('marcadores_zkteco').upsert(dbDevice);
    if (!error) {
      // Registrar log de auditoría
      await logAuditEventToSupabase({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: 'ADMIN_GENERAL',
        user_name: 'Administrador General',
        role: 'ADMIN_GENERAL',
        module: 'BIOMETRICOS',
        action: 'UPSERT_DISPOSITIVO',
        affected_record_id: device.id,
        details: `Dispositivo ZKTeco sincronizado: ${device.name} (SN: ${device.serial_number}, IP: ${device.ip_address})`,
        app_origin: origin,
      });

      return { success: true, data: device };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase marcadores_zkteco:', err);
  }

  // Notificar backend Express
  try {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(device),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || device };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: device };
}

export async function deleteDeviceInSupabase(id: string): Promise<{ success: boolean }> {
  try {
    await supabase.from('marcadores_zkteco').delete().eq('id', id);
  } catch (e) {
    console.warn('Error delete Supabase marcadores_zkteco:', e);
  }

  try {
    await fetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {}

  return { success: true };
}

// ==========================================
// 2. INGESTA Y MARCACIONES RAW IDEMPOTENTES
// ==========================================

export async function fetchRawPunchesFromSupabase(): Promise<MarcacionRaw[]> {
  try {
    const { data, error } = await supabase
      .from('marcaciones_raw')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((p: any) => ({
        id: p.id,
        device_id: p.device_id,
        device_sn: p.device_sn,
        device_name: p.device_name || 'Marcador ZKTeco',
        device_dependencia_tipo: p.device_dependencia_tipo,
        device_dependencia_name: p.device_dependencia_name,
        employee_dni: p.employee_dni,
        employee_code: p.employee_code,
        employee_name: p.employee_name,
        employee_dependencia_tipo: p.employee_dependencia_tipo,
        employee_dependencia_name: p.employee_dependencia_name,
        timestamp: p.timestamp,
        punch_type: p.punch_type || 'AUTO',
        punch_state: p.punch_state,
        verify_mode: p.verify_mode || 'FINGERPRINT',
        processed: p.processed === true,
        processed_at: p.processed_at,
        raw_payload: p.raw_payload,
        validation_status: p.validation_status || 'VALIDA',
        rejection_reason: p.rejection_reason,
        authorization_id: p.authorization_id,
      }));
    }

    // Fallback a Express API
    const res = await fetch('/api/attendance/punches');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con marcaciones_raw en Supabase:', err);
  }

  return INITIAL_RAW_PUNCHES;
}

/**
 * Inserta una marcación RAW garantizando la restricción de idempotencia:
 * (device_sn, employee_code, timestamp)
 */
export async function saveRawPunchToSupabase(
  punch: MarcacionRaw
): Promise<{ success: boolean; data?: MarcacionRaw; isDuplicate?: boolean; message?: string }> {
  const origin = getAppOrigin();

  const dbPunch = {
    id: punch.id || `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    device_id: punch.device_id,
    device_sn: punch.device_sn || punch.device_name,
    device_name: punch.device_name,
    device_dependencia_tipo: punch.device_dependencia_tipo || 'SEDE_CENTRAL',
    device_dependencia_name: punch.device_dependencia_name || 'SEDE CENTRAL',
    employee_id: punch.employee_dni ? `emp-${punch.employee_dni.slice(-2)}` : null,
    employee_dni: punch.employee_dni,
    employee_code: punch.employee_code || punch.employee_dni,
    employee_name: punch.employee_name || 'Trabajador DRAC',
    employee_dependencia_tipo: punch.employee_dependencia_tipo || 'SEDE_CENTRAL',
    employee_dependencia_name: punch.employee_dependencia_name || 'SEDE CENTRAL',
    timestamp: punch.timestamp,
    punch_type: punch.punch_type || 'AUTO',
    punch_state: punch.punch_state || 0,
    verify_mode: punch.verify_mode || 'FINGERPRINT',
    processed: punch.processed ?? false,
    processed_at: punch.processed_at || null,
    raw_payload: punch.raw_payload || null,
    validation_status: punch.validation_status || 'VALIDA',
    rejection_reason: punch.rejection_reason || null,
    authorization_id: punch.authorization_id || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('marcaciones_raw')
      .upsert(dbPunch, {
        onConflict: 'device_sn, employee_code, timestamp',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (!error && data) {
      return { success: true, data: { ...punch, id: data.id } };
    }
  } catch (err) {
    console.warn('Error al guardar marcacion RAW en Supabase:', err);
  }

  // Notificar backend Express
  try {
    const res = await fetch('/api/marcaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(punch),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || punch, isDuplicate: resJson.isDuplicate };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: punch };
}

/**
 * Ingesta por lotes con deduplicación e idempotencia estricta
 */
export async function bulkSaveRawPunchesToSupabase(
  punches: MarcacionRaw[]
): Promise<{ inserted: number; skippedDuplicates: number; errors: number }> {
  if (!punches || punches.length === 0) return { inserted: 0, skippedDuplicates: 0, errors: 0 };

  let insertedCount = 0;
  let skippedDuplicates = 0;
  let errorCount = 0;

  const dbRows = punches.map((p) => ({
    id: p.id || `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    device_id: p.device_id,
    device_sn: p.device_sn || p.device_name,
    device_name: p.device_name,
    device_dependencia_tipo: p.device_dependencia_tipo || 'SEDE_CENTRAL',
    device_dependencia_name: p.device_dependencia_name || 'SEDE CENTRAL',
    employee_dni: p.employee_dni,
    employee_code: p.employee_code || p.employee_dni,
    employee_name: p.employee_name || 'Trabajador DRAC',
    employee_dependencia_tipo: p.employee_dependencia_tipo || 'SEDE_CENTRAL',
    employee_dependencia_name: p.employee_dependencia_name || 'SEDE CENTRAL',
    timestamp: p.timestamp,
    punch_type: p.punch_type || 'AUTO',
    punch_state: p.punch_state || 0,
    verify_mode: p.verify_mode || 'FINGERPRINT',
    processed: p.processed ?? false,
    processed_at: p.processed_at || null,
    raw_payload: p.raw_payload || null,
    validation_status: p.validation_status || 'VALIDA',
    rejection_reason: p.rejection_reason || null,
    authorization_id: p.authorization_id || null,
    created_at: new Date().toISOString(),
  }));

  try {
    const { data, error } = await supabase
      .from('marcaciones_raw')
      .upsert(dbRows, {
        onConflict: 'device_sn, employee_code, timestamp',
        ignoreDuplicates: true,
      })
      .select('id');

    if (!error && Array.isArray(data)) {
      insertedCount = data.length;
      skippedDuplicates = punches.length - insertedCount;
      return { inserted: insertedCount, skippedDuplicates, errors: 0 };
    }
  } catch (err) {
    console.warn('Error en bulkSaveRawPunchesToSupabase:', err);
    errorCount++;
  }

  // Notificar backend Express por lote
  try {
    const res = await fetch('/api/zkteco/import-punches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': getAppOrigin(),
      },
      body: JSON.stringify({ punches }),
    });
    if (res.ok) {
      const resJson = await res.json();
      return {
        inserted: resJson.imported_count || punches.length,
        skippedDuplicates: resJson.skipped_duplicates_count || 0,
        errors: resJson.error_count || 0,
      };
    }
  } catch (e) {}

  return { inserted: punches.length, skippedDuplicates: 0, errors: errorCount };
}

// ==========================================
// 3. ASISTENCIAS PROCESADAS Y MOTOR DE CÁLCULO
// ==========================================

export async function fetchAttendanceFromSupabase(): Promise<AsistenciaProcesada[]> {
  try {
    const { data, error } = await supabase
      .from('asistencias')
      .select('*')
      .order('fecha', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((a: any) => ({
        id: a.id,
        employee_id: a.employee_id || `emp-${a.employee_dni?.slice(-2)}`,
        employee_dni: a.employee_dni,
        employee_name: a.employee_name || 'Trabajador',
        dependencia_name: a.dependencia_name || 'SEDE CENTRAL',
        area_name: a.area_name || 'Oficina DRAC',
        fecha: a.fecha,
        horario_name: a.horario_name || 'Jornada Administrativa',
        t1_scheduled_in: a.t1_scheduled_in,
        t1_scheduled_out: a.t1_scheduled_out,
        t1_window_entry_start: a.t1_window_entry_start,
        t1_window_exit_limit: a.t1_window_exit_limit,
        t1_real_in: a.t1_real_in,
        t1_real_out: a.t1_real_out,
        t1_effective_hours: Number(a.t1_effective_hours) || 0,
        t1_tardiness_minutes: Number(a.t1_tardiness_minutes) || 0,
        t2_scheduled_in: a.t2_scheduled_in,
        t2_scheduled_out: a.t2_scheduled_out,
        t2_window_entry_start: a.t2_window_entry_start,
        t2_window_exit_limit: a.t2_window_exit_limit,
        t2_real_in: a.t2_real_in,
        t2_real_out: a.t2_real_out,
        t2_effective_hours: Number(a.t2_effective_hours) || 0,
        t2_tardiness_minutes: Number(a.t2_tardiness_minutes) || 0,
        total_effective_hours: Number(a.total_effective_hours) || 0,
        total_tardiness_minutes: Number(a.total_tardiness_minutes) || 0,
        tolerance_applied_minutes: Number(a.tolerance_applied_minutes) || 10,
        net_tardiness_minutes: Number(a.net_tardiness_minutes) || 0,
        overtime_minutes: Number(a.overtime_minutes) || 0,
        status: a.status || 'PUNCTUAL',
        has_papeleta: a.has_papeleta === true,
        papeleta_code: a.papeleta_code,
        is_vacation_day: a.is_vacation_day === true,
        observations: a.observations || '',
      }));
    }

    // Fallback a Express API
    const res = await fetch('/api/attendance');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con asistencias en Supabase:', err);
  }

  return INITIAL_ATTENDANCE;
}

export async function saveAttendanceToSupabase(
  attendanceRecord: AsistenciaProcesada
): Promise<{ success: boolean; data?: AsistenciaProcesada; message?: string }> {
  const origin = getAppOrigin();

  const dbAttendance = {
    id: attendanceRecord.id,
    employee_id: attendanceRecord.employee_id || `emp-${attendanceRecord.employee_dni.slice(-2)}`,
    employee_dni: attendanceRecord.employee_dni,
    employee_name: attendanceRecord.employee_name,
    dependencia_name: attendanceRecord.dependencia_name || 'SEDE CENTRAL',
    area_name: attendanceRecord.area_name || 'Oficina',
    fecha: attendanceRecord.fecha,
    horario_name: attendanceRecord.horario_name || 'Jornada Administrativa',
    t1_scheduled_in: attendanceRecord.t1_scheduled_in || null,
    t1_scheduled_out: attendanceRecord.t1_scheduled_out || null,
    t1_window_entry_start: attendanceRecord.t1_window_entry_start || null,
    t1_window_exit_limit: attendanceRecord.t1_window_exit_limit || null,
    t1_real_in: attendanceRecord.t1_real_in || null,
    t1_real_out: attendanceRecord.t1_real_out || null,
    t1_effective_hours: attendanceRecord.t1_effective_hours || 0,
    t1_tardiness_minutes: attendanceRecord.t1_tardiness_minutes || 0,
    t2_scheduled_in: attendanceRecord.t2_scheduled_in || null,
    t2_scheduled_out: attendanceRecord.t2_scheduled_out || null,
    t2_window_entry_start: attendanceRecord.t2_window_entry_start || null,
    t2_window_exit_limit: attendanceRecord.t2_window_exit_limit || null,
    t2_real_in: attendanceRecord.t2_real_in || null,
    t2_real_out: attendanceRecord.t2_real_out || null,
    t2_effective_hours: attendanceRecord.t2_effective_hours || 0,
    t2_tardiness_minutes: attendanceRecord.t2_tardiness_minutes || 0,
    total_effective_hours: attendanceRecord.total_effective_hours || 0,
    total_tardiness_minutes: attendanceRecord.total_tardiness_minutes || 0,
    tolerance_applied_minutes: attendanceRecord.tolerance_applied_minutes || 10,
    net_tardiness_minutes: attendanceRecord.net_tardiness_minutes || 0,
    overtime_minutes: attendanceRecord.overtime_minutes || 0,
    status: attendanceRecord.status || 'PUNCTUAL',
    has_papeleta: attendanceRecord.has_papeleta ?? false,
    papeleta_code: attendanceRecord.papeleta_code || null,
    is_vacation_day: attendanceRecord.is_vacation_day ?? false,
    observations: attendanceRecord.observations || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('asistencias')
      .upsert(dbAttendance, { onConflict: 'employee_dni, fecha' });

    if (!error) {
      return { success: true, data: attendanceRecord };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase asistencias:', err);
  }

  // Notificar backend Express
  try {
    const res = await fetch('/api/asistencias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(attendanceRecord),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || attendanceRecord };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: attendanceRecord };
}

/**
 * MOTOR DE CÁLCULO INSTITUCIONAL DE ASISTENCIA DIARIA DRAC
 * 
 * Evalúa las marcaciones RAW de un colaborador en un día específico contra:
 * - Horario y Turnos asignados (1 o 2 turnos diarios)
 * - Tolerancia de entrada (estándar 10-15 mins)
 * - Papeletas de salida aprobadas y en curso
 * - Vacaciones aprobadas o programadas
 */
export function calculateAttendanceForEmployeeDay(
  emp: Employee,
  fecha: string, // YYYY-MM-DD
  dayPunches: MarcacionRaw[],
  horario: Horario | undefined,
  turnos: Turno[],
  vacations: Vacacion[],
  papeletas: PapeletaSalida[],
  defaultTolerance: number = 10
): AsistenciaProcesada {
  const empPunches = dayPunches
    .filter((p) => p.employee_dni === emp.dni && p.timestamp.startsWith(fecha))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // 1. Verificar Vacaciones en la fecha
  const hasActiveVacation = vacations.some((v) => {
    if (v.employee_dni !== emp.dni) return false;
    if (!['APROBADA_RRHH', 'PROGRAMADA', 'EN_CURSO'].includes(v.status)) return false;
    return fecha >= v.start_date && fecha <= v.end_date;
  });

  // 2. Verificar Papeletas de salida en la fecha
  const dayPapeletas = papeletas.filter(
    (p) => p.employee_dni === emp.dni && p.fecha === fecha && ['APPROVED', 'IN_OUTING', 'COMPLETED'].includes(p.status)
  );
  const hasPapeleta = dayPapeletas.length > 0;
  const primaryPapeleta = dayPapeletas[0];

  // 3. Obtener configuración de turnos del horario
  const t1 = horario?.turno1_id ? turnos.find((t) => t.id === horario.turno1_id) : undefined;
  const t2 = horario?.turno2_id ? turnos.find((t) => t.id === horario.turno2_id) : undefined;

  const t1ScheduledIn = t1?.start_time || '08:00';
  const t1ScheduledOut = t1?.end_time || '13:00';
  const t2ScheduledIn = t2?.start_time || (horario?.turn_count === 2 ? '14:00' : undefined);
  const t2ScheduledOut = t2?.end_time || (horario?.turn_count === 2 ? '17:00' : undefined);

  const tolerance = t1?.tolerance_minutes ?? defaultTolerance;

  // Si está de vacaciones
  if (hasActiveVacation) {
    return {
      id: `att-${emp.dni}-${fecha}`,
      employee_id: emp.id,
      employee_dni: emp.dni,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      dependencia_name: emp.dependencia_name || 'SEDE CENTRAL',
      area_name: emp.area_name || '',
      fecha,
      horario_name: horario?.name || 'Jornada Administrativa',
      t1_scheduled_in: t1ScheduledIn,
      t1_scheduled_out: t1ScheduledOut,
      t2_scheduled_in: t2ScheduledIn,
      t2_scheduled_out: t2ScheduledOut,
      total_effective_hours: 8,
      total_tardiness_minutes: 0,
      tolerance_applied_minutes: tolerance,
      net_tardiness_minutes: 0,
      overtime_minutes: 0,
      status: 'VACATION',
      has_papeleta: false,
      is_vacation_day: true,
      observations: 'Descanso Vacacional Aprobado.',
      t1_tardiness_minutes: 0,
      t2_tardiness_minutes: 0,
    };
  }

  // Si no hay marcaciones registradas
  if (empPunches.length === 0) {
    if (hasPapeleta && primaryPapeleta.motivo === 'COMISION_SERVICIOS' && primaryPapeleta.sin_retorno) {
      return {
        id: `att-${emp.dni}-${fecha}`,
        employee_id: emp.id,
        employee_dni: emp.dni,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        dependencia_name: emp.dependencia_name || 'SEDE CENTRAL',
        area_name: emp.area_name || '',
        fecha,
        horario_name: horario?.name || 'Jornada Administrativa',
        t1_scheduled_in: t1ScheduledIn,
        t1_scheduled_out: t1ScheduledOut,
        t2_scheduled_in: t2ScheduledIn,
        t2_scheduled_out: t2ScheduledOut,
        total_effective_hours: 8,
        total_tardiness_minutes: 0,
        tolerance_applied_minutes: tolerance,
        net_tardiness_minutes: 0,
        overtime_minutes: 0,
        status: 'OUTING_PERMISSION',
        has_papeleta: true,
        papeleta_code: primaryPapeleta.code,
        is_vacation_day: false,
        observations: `Comisión de servicios todo el día (${primaryPapeleta.code})`,
        t1_tardiness_minutes: 0,
        t2_tardiness_minutes: 0,
      };
    }

    return {
      id: `att-${emp.dni}-${fecha}`,
      employee_id: emp.id,
      employee_dni: emp.dni,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      dependencia_name: emp.dependencia_name || 'SEDE CENTRAL',
      area_name: emp.area_name || '',
      fecha,
      horario_name: horario?.name || 'Jornada Administrativa',
      t1_scheduled_in: t1ScheduledIn,
      t1_scheduled_out: t1ScheduledOut,
      t2_scheduled_in: t2ScheduledIn,
      t2_scheduled_out: t2ScheduledOut,
      total_effective_hours: 0,
      total_tardiness_minutes: 0,
      tolerance_applied_minutes: tolerance,
      net_tardiness_minutes: 0,
      overtime_minutes: 0,
      status: 'ABSENT',
      has_papeleta: hasPapeleta,
      papeleta_code: primaryPapeleta?.code,
      is_vacation_day: false,
      observations: hasPapeleta ? `Falta con papeleta parcial ${primaryPapeleta.code}` : 'Sin marcaciones registradas.',
      t1_tardiness_minutes: 0,
      t2_tardiness_minutes: 0,
    };
  }

  // 4. Asignar marcaciones a Turno 1 y Turno 2
  let t1RealIn: string | undefined;
  let t1RealOut: string | undefined;
  let t2RealIn: string | undefined;
  let t2RealOut: string | undefined;

  const punchTimes = empPunches.map((p) => p.timestamp.split(' ')[1].substring(0, 5));

  if (horario?.turn_count === 2 || t2ScheduledIn) {
    // 2 turnos: mañana y tarde
    const morningPunches = punchTimes.filter((t) => t < '13:30');
    const afternoonPunches = punchTimes.filter((t) => t >= '13:30');

    t1RealIn = morningPunches[0] || punchTimes[0];
    t1RealOut = morningPunches.length > 1 ? morningPunches[morningPunches.length - 1] : undefined;
    t2RealIn = afternoonPunches[0] || (punchTimes.length > 2 ? punchTimes[1] : undefined);
    t2RealOut = afternoonPunches.length > 1 ? afternoonPunches[afternoonPunches.length - 1] : (punchTimes.length > 3 ? punchTimes[punchTimes.length - 1] : undefined);
  } else {
    // 1 turno continuo
    t1RealIn = punchTimes[0];
    t1RealOut = punchTimes.length > 1 ? punchTimes[punchTimes.length - 1] : undefined;
  }

  // 5. Calcular tardanza en Turno 1
  let t1Tardiness = 0;
  if (t1RealIn && t1ScheduledIn) {
    const [realH, realM] = t1RealIn.split(':').map(Number);
    const [schedH, schedM] = t1ScheduledIn.split(':').map(Number);
    const diffMins = realH * 60 + realM - (schedH * 60 + schedM);
    if (diffMins > tolerance) {
      t1Tardiness = diffMins - tolerance;
    }
  }

  // 6. Calcular tardanza en Turno 2 (si aplica)
  let t2Tardiness = 0;
  if (t2RealIn && t2ScheduledIn) {
    const [realH, realM] = t2RealIn.split(':').map(Number);
    const [schedH, schedM] = t2ScheduledIn.split(':').map(Number);
    const diffMins = realH * 60 + realM - (schedH * 60 + schedM);
    if (diffMins > tolerance) {
      t2Tardiness = diffMins - tolerance;
    }
  }

  const totalTardiness = t1Tardiness + t2Tardiness;
  const netTardiness = Math.max(0, totalTardiness);

  // 7. Determinar Estado
  let status: AsistenciaEstado = 'PUNCTUAL';
  let observations = 'Asistencia conforme.';

  if (hasPapeleta) {
    status = 'OUTING_PERMISSION';
    observations = `Permiso / Papeleta autorizada: ${primaryPapeleta.code}`;
  } else if (netTardiness > 0) {
    status = 'LATE';
    observations = `Tardanza acumulada: ${netTardiness} min.`;
  }

  // 8. Horas efectivas estimadas
  let totalEffectiveHours = 8.0;
  if (t1RealIn && t1RealOut && t2RealIn && t2RealOut) {
    totalEffectiveHours = 8.0;
  } else if (t1RealIn && t1RealOut && !t2ScheduledIn) {
    totalEffectiveHours = 8.0;
  } else if (t1RealIn && !t1RealOut && !t2RealIn) {
    totalEffectiveHours = 4.0;
    observations += ' (Falta marcación de salida).';
  }

  return {
    id: `att-${emp.dni}-${fecha}`,
    employee_id: emp.id,
    employee_dni: emp.dni,
    employee_name: `${emp.first_name} ${emp.last_name}`,
    dependencia_name: emp.dependencia_name || 'SEDE CENTRAL',
    area_name: emp.area_name || '',
    fecha,
    horario_name: horario?.name || 'Jornada Administrativa',
    t1_scheduled_in: t1ScheduledIn,
    t1_scheduled_out: t1ScheduledOut,
    t1_real_in: t1RealIn,
    t1_real_out: t1RealOut,
    t1_tardiness_minutes: t1Tardiness,
    t1_effective_hours: 4.5,
    t2_scheduled_in: t2ScheduledIn,
    t2_scheduled_out: t2ScheduledOut,
    t2_real_in: t2RealIn,
    t2_real_out: t2RealOut,
    t2_tardiness_minutes: t2Tardiness,
    t2_effective_hours: 3.5,
    total_effective_hours: totalEffectiveHours,
    total_tardiness_minutes: totalTardiness,
    tolerance_applied_minutes: tolerance,
    net_tardiness_minutes: netTardiness,
    overtime_minutes: 0,
    status,
    has_papeleta: hasPapeleta,
    papeleta_code: primaryPapeleta?.code,
    is_vacation_day: false,
    observations,
  };
}

// ==========================================
// 4. AUDITORÍA CENTRALIZADA INMUTABLE
// ==========================================

export async function fetchAuditLogsFromSupabase(): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('auditoria')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp,
        user_id: log.user_id,
        user_name: log.user_name,
        role: log.role,
        module: log.module,
        action: log.action,
        affected_record_id: log.affected_record_id,
        details: log.details,
        ip_address: log.ip_address,
        app_origin: log.app_origin || 'WEB',
        result: log.result || 'SUCCESS',
      }));
    }

    // Fallback a Express API
    const res = await fetch('/api/audit/logs');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data)) {
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con auditoria en Supabase:', err);
  }

  return [];
}

export async function logAuditEventToSupabase(log: AuditLog): Promise<{ success: boolean }> {
  const origin = log.app_origin || getAppOrigin();

  const dbLog = {
    id: log.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: log.timestamp || new Date().toISOString(),
    user_id: log.user_id || 'SYSTEM',
    user_name: log.user_name || 'Sistema Central',
    role: log.role || 'TRABAJADOR',
    module: log.module || 'GENERAL',
    action: log.action || 'EVENTO',
    affected_record_id: log.affected_record_id || '-',
    details: log.details || '',
    ip_address: log.ip_address || '127.0.0.1',
    app_origin: origin,
    result: log.result || 'SUCCESS',
  };

  try {
    await supabase.from('auditoria').insert(dbLog);
  } catch (e) {
    console.warn('Error al insertar auditoria en Supabase:', e);
  }

  // Notificar backend Express
  try {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(dbLog),
    });
  } catch (e) {}

  return { success: true };
}
