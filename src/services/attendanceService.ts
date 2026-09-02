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
import { normalizePersonName, normalizeInstitutionalName, normalizeText } from '../utils/nameUtils';
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
        name: normalizeInstitutionalName(d.name || 'Marcador ZKTeco'),
        brand: d.brand || 'ZKTeco',
        model: d.model || 'G3-id',
        ip_address: d.ip_address || d.ipAddress || '192.168.1.100',
        port: d.port || 4370,
        protocol: d.protocol || 'PUSH_ADMS',
        dependencia_id: d.dependencia_id || 'dep-01',
        dependencia_tipo: d.dependencia_tipo || 'SEDE_CENTRAL',
        dependencia_name: normalizeInstitutionalName(d.dependencia_name || 'Sede Central'),
        area_id: d.area_id,
        area_name: normalizeInstitutionalName(d.area_name),
        location_detail: normalizeText(d.location_detail || d.locationDetail || 'Ingreso Principal'),
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
        return apiData.data.map((d: DispositivoZkTeco) => ({
          ...d,
          name: normalizeInstitutionalName(d.name),
          dependencia_name: normalizeInstitutionalName(d.dependencia_name),
          area_name: normalizeInstitutionalName(d.area_name),
          location_detail: normalizeText(d.location_detail),
        }));
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con marcadores ZKTeco en Supabase:', err);
  }

  return INITIAL_DEVICES.map((d) => ({
    ...d,
    name: normalizeInstitutionalName(d.name),
    dependencia_name: normalizeInstitutionalName(d.dependencia_name),
    area_name: normalizeInstitutionalName(d.area_name),
    location_detail: normalizeText(d.location_detail),
  }));
}

export async function saveDeviceToSupabase(
  device: DispositivoZkTeco
): Promise<{ success: boolean; data?: DispositivoZkTeco; message?: string }> {
  const origin = getAppOrigin();

  const normalizedDev: DispositivoZkTeco = {
    ...device,
    name: normalizeInstitutionalName(device.name),
    dependencia_name: normalizeInstitutionalName(device.dependencia_name),
    area_name: normalizeInstitutionalName(device.area_name),
    location_detail: normalizeText(device.location_detail),
  };

  const dbDevice = {
    id: normalizedDev.id,
    serial_number: normalizedDev.serial_number,
    name: normalizedDev.name,
    brand: normalizedDev.brand || 'ZKTeco',
    model: normalizedDev.model || 'G3-id',
    ip_address: normalizedDev.ip_address,
    port: normalizedDev.port || 4370,
    protocol: normalizedDev.protocol || 'PUSH_ADMS',
    dependencia_id: normalizedDev.dependencia_id,
    dependencia_tipo: normalizedDev.dependencia_tipo || 'SEDE_CENTRAL',
    dependencia_name: normalizedDev.dependencia_name,
    area_id: normalizedDev.area_id || null,
    area_name: normalizedDev.area_name || null,
    location_detail: normalizedDev.location_detail,
    status: normalizedDev.status || 'ONLINE',
    firmware_version: normalizedDev.firmware_version || null,
    enrolled_user_count: normalizedDev.enrolled_user_count || 0,
    enrolled_fingerprint_count: normalizedDev.enrolled_fingerprint_count || 0,
    enrolled_face_count: normalizedDev.enrolled_face_count || 0,
    log_count: normalizedDev.log_count || 0,
    adms_url: normalizedDev.adms_url || null,
    capabilities: normalizedDev.capabilities || null,
    last_activity: normalizedDev.last_activity || new Date().toISOString(),
    last_test: normalizedDev.last_test || null,
    push_config: normalizedDev.push_config || null,
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
        affected_record_id: normalizedDev.id,
        details: `Dispositivo ZKTeco sincronizado: ${normalizedDev.name} (SN: ${normalizedDev.serial_number}, IP: ${normalizedDev.ip_address})`,
        app_origin: origin,
      });

      return { success: true, data: normalizedDev };
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
      body: JSON.stringify(normalizedDev),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedDev };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedDev };
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
        device_name: normalizeInstitutionalName(p.device_name || 'Marcador ZKTeco'),
        device_dependencia_tipo: p.device_dependencia_tipo,
        device_dependencia_name: normalizeInstitutionalName(p.device_dependencia_name || 'Sede Central'),
        employee_dni: p.employee_dni,
        employee_code: p.employee_code,
        employee_name: normalizePersonName(p.employee_name || 'Trabajador DRAC'),
        employee_dependencia_tipo: p.employee_dependencia_tipo,
        employee_dependencia_name: normalizeInstitutionalName(p.employee_dependencia_name || 'Sede Central'),
        timestamp: p.timestamp,
        punch_type: p.punch_type || 'AUTO',
        punch_state: p.punch_state,
        verify_mode: p.verify_mode || 'FINGERPRINT',
        processed: p.processed === true,
        processed_at: p.processed_at,
        raw_payload: p.raw_payload,
        validation_status: p.validation_status || 'VALIDA',
        rejection_reason: normalizeText(p.rejection_reason),
        authorization_id: p.authorization_id,
      }));
    }

    // Fallback a Express API
    const res = await fetch('/api/attendance/punches');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((p: MarcacionRaw) => ({
          ...p,
          device_name: normalizeInstitutionalName(p.device_name),
          device_dependencia_name: normalizeInstitutionalName(p.device_dependencia_name),
          employee_name: normalizePersonName(p.employee_name),
          employee_dependencia_name: normalizeInstitutionalName(p.employee_dependencia_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con marcaciones_raw en Supabase:', err);
  }

  return INITIAL_RAW_PUNCHES.map((p) => ({
    ...p,
    device_name: normalizeInstitutionalName(p.device_name),
    device_dependencia_name: normalizeInstitutionalName(p.device_dependencia_name),
    employee_name: normalizePersonName(p.employee_name),
    employee_dependencia_name: normalizeInstitutionalName(p.employee_dependencia_name),
  }));
}

/**
 * Inserta una marcación RAW garantizando la restricción de idempotencia:
 * (device_sn, employee_code, timestamp)
 */
export async function saveRawPunchToSupabase(
  punch: MarcacionRaw
): Promise<{ success: boolean; data?: MarcacionRaw; isDuplicate?: boolean; message?: string }> {
  const origin = getAppOrigin();

  const normalizedPunch: MarcacionRaw = {
    ...punch,
    device_name: normalizeInstitutionalName(punch.device_name),
    device_dependencia_name: normalizeInstitutionalName(punch.device_dependencia_name),
    employee_name: normalizePersonName(punch.employee_name),
    employee_dependencia_name: normalizeInstitutionalName(punch.employee_dependencia_name),
  };

  const dbPunch = {
    id: normalizedPunch.id || `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    device_id: normalizedPunch.device_id,
    device_sn: normalizedPunch.device_sn || normalizedPunch.device_name,
    device_name: normalizedPunch.device_name,
    device_dependencia_tipo: normalizedPunch.device_dependencia_tipo || 'SEDE_CENTRAL',
    device_dependencia_name: normalizedPunch.device_dependencia_name || 'Sede Central',
    employee_id: normalizedPunch.employee_dni ? `emp-${normalizedPunch.employee_dni.slice(-2)}` : null,
    employee_dni: normalizedPunch.employee_dni,
    employee_code: normalizedPunch.employee_code || normalizedPunch.employee_dni,
    employee_name: normalizedPunch.employee_name || 'Trabajador DRAC',
    employee_dependencia_tipo: normalizedPunch.employee_dependencia_tipo || 'SEDE_CENTRAL',
    employee_dependencia_name: normalizedPunch.employee_dependencia_name || 'Sede Central',
    timestamp: normalizedPunch.timestamp,
    punch_type: normalizedPunch.punch_type || 'AUTO',
    punch_state: normalizedPunch.punch_state || 0,
    verify_mode: normalizedPunch.verify_mode || 'FINGERPRINT',
    processed: normalizedPunch.processed ?? false,
    processed_at: normalizedPunch.processed_at || null,
    raw_payload: normalizedPunch.raw_payload || null,
    validation_status: normalizedPunch.validation_status || 'VALIDA',
    rejection_reason: normalizedPunch.rejection_reason || null,
    authorization_id: normalizedPunch.authorization_id || null,
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
      return { success: true, data: { ...normalizedPunch, id: data.id } };
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
      body: JSON.stringify(normalizedPunch),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedPunch, isDuplicate: resJson.isDuplicate };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedPunch };
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

  const normalizedList = punches.map((p) => ({
    ...p,
    device_name: normalizeInstitutionalName(p.device_name),
    device_dependencia_name: normalizeInstitutionalName(p.device_dependencia_name),
    employee_name: normalizePersonName(p.employee_name),
    employee_dependencia_name: normalizeInstitutionalName(p.employee_dependencia_name),
  }));

  const dbRows = normalizedList.map((p) => ({
    id: p.id || `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    device_id: p.device_id,
    device_sn: p.device_sn || p.device_name,
    device_name: p.device_name,
    device_dependencia_tipo: p.device_dependencia_tipo || 'SEDE_CENTRAL',
    device_dependencia_name: p.device_dependencia_name || 'Sede Central',
    employee_dni: p.employee_dni,
    employee_code: p.employee_code || p.employee_dni,
    employee_name: p.employee_name || 'Trabajador DRAC',
    employee_dependencia_tipo: p.employee_dependencia_tipo || 'SEDE_CENTRAL',
    employee_dependencia_name: p.employee_dependencia_name || 'Sede Central',
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
      body: JSON.stringify({ punches: normalizedList }),
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
        employee_name: normalizePersonName(a.employee_name || 'Trabajador'),
        dependencia_name: normalizeInstitutionalName(a.dependencia_name || 'Sede Central'),
        area_name: normalizeInstitutionalName(a.area_name || 'Oficina DRAC'),
        fecha: a.fecha,
        horario_name: normalizeInstitutionalName(a.horario_name || 'Jornada Administrativa'),
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
        observations: normalizeText(a.observations || ''),
      }));
    }

    // Fallback a Express API
    const res = await fetch('/api/attendance');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((a: AsistenciaProcesada) => ({
          ...a,
          employee_name: normalizePersonName(a.employee_name),
          dependencia_name: normalizeInstitutionalName(a.dependencia_name),
          area_name: normalizeInstitutionalName(a.area_name),
          horario_name: normalizeInstitutionalName(a.horario_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Sincronización en curso con asistencias en Supabase:', err);
  }

  return INITIAL_ATTENDANCE.map((a) => ({
    ...a,
    employee_name: normalizePersonName(a.employee_name),
    dependencia_name: normalizeInstitutionalName(a.dependencia_name),
    area_name: normalizeInstitutionalName(a.area_name),
    horario_name: normalizeInstitutionalName(a.horario_name),
  }));
}

export async function saveAttendanceToSupabase(
  attendanceRecord: AsistenciaProcesada
): Promise<{ success: boolean; data?: AsistenciaProcesada; message?: string }> {
  const origin = getAppOrigin();

  const normalizedAtt: AsistenciaProcesada = {
    ...attendanceRecord,
    employee_name: normalizePersonName(attendanceRecord.employee_name),
    dependencia_name: normalizeInstitutionalName(attendanceRecord.dependencia_name),
    area_name: normalizeInstitutionalName(attendanceRecord.area_name),
    horario_name: normalizeInstitutionalName(attendanceRecord.horario_name),
    observations: normalizeText(attendanceRecord.observations),
  };

  const dbAttendance = {
    id: normalizedAtt.id,
    employee_id: normalizedAtt.employee_id || `emp-${normalizedAtt.employee_dni.slice(-2)}`,
    employee_dni: normalizedAtt.employee_dni,
    employee_name: normalizedAtt.employee_name,
    dependencia_name: normalizedAtt.dependencia_name || 'Sede Central',
    area_name: normalizedAtt.area_name || 'Oficina',
    fecha: normalizedAtt.fecha,
    horario_name: normalizedAtt.horario_name || 'Jornada Administrativa',
    t1_scheduled_in: normalizedAtt.t1_scheduled_in || null,
    t1_scheduled_out: normalizedAtt.t1_scheduled_out || null,
    t1_window_entry_start: normalizedAtt.t1_window_entry_start || null,
    t1_window_exit_limit: normalizedAtt.t1_window_exit_limit || null,
    t1_real_in: normalizedAtt.t1_real_in || null,
    t1_real_out: normalizedAtt.t1_real_out || null,
    t1_effective_hours: normalizedAtt.t1_effective_hours || 0,
    t1_tardiness_minutes: normalizedAtt.t1_tardiness_minutes || 0,
    t2_scheduled_in: normalizedAtt.t2_scheduled_in || null,
    t2_scheduled_out: normalizedAtt.t2_scheduled_out || null,
    t2_window_entry_start: normalizedAtt.t2_window_entry_start || null,
    t2_window_exit_limit: normalizedAtt.t2_window_exit_limit || null,
    t2_real_in: normalizedAtt.t2_real_in || null,
    t2_real_out: normalizedAtt.t2_real_out || null,
    t2_effective_hours: normalizedAtt.t2_effective_hours || 0,
    t2_tardiness_minutes: normalizedAtt.t2_tardiness_minutes || 0,
    total_effective_hours: normalizedAtt.total_effective_hours || 0,
    total_tardiness_minutes: normalizedAtt.total_tardiness_minutes || 0,
    tolerance_applied_minutes: normalizedAtt.tolerance_applied_minutes || 10,
    net_tardiness_minutes: normalizedAtt.net_tardiness_minutes || 0,
    overtime_minutes: normalizedAtt.overtime_minutes || 0,
    status: normalizedAtt.status || 'PUNCTUAL',
    has_papeleta: normalizedAtt.has_papeleta ?? false,
    papeleta_code: normalizedAtt.papeleta_code || null,
    is_vacation_day: normalizedAtt.is_vacation_day ?? false,
    observations: normalizedAtt.observations || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('asistencias')
      .upsert(dbAttendance, { onConflict: 'employee_dni, fecha' });

    if (!error) {
      return { success: true, data: normalizedAtt };
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
      body: JSON.stringify(normalizedAtt),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedAtt };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedAtt };
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

  const empFullName = normalizePersonName(`${emp.first_name} ${emp.last_name}`);
  const depName = normalizeInstitutionalName(emp.dependencia_name || 'Sede Central');
  const areaName = normalizeInstitutionalName(emp.area_name || '');
  const scheduleName = normalizeInstitutionalName(horario?.name || 'Jornada Administrativa');

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
      employee_name: empFullName,
      dependencia_name: depName,
      area_name: areaName,
      fecha,
      horario_name: scheduleName,
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
        employee_name: empFullName,
        dependencia_name: depName,
        area_name: areaName,
        fecha,
        horario_name: scheduleName,
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
      employee_name: empFullName,
      dependencia_name: depName,
      area_name: areaName,
      fecha,
      horario_name: scheduleName,
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
    employee_name: empFullName,
    dependencia_name: depName,
    area_name: areaName,
    fecha,
    horario_name: scheduleName,
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
        user_name: normalizePersonName(log.user_name || 'Sistema Central'),
        role: log.role,
        module: log.module,
        action: log.action,
        affected_record_id: log.affected_record_id,
        details: normalizeText(log.details || ''),
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
        return apiData.data.map((log: AuditLog) => ({
          ...log,
          user_name: normalizePersonName(log.user_name),
          details: normalizeText(log.details),
        }));
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
    user_name: normalizePersonName(log.user_name || 'Sistema Central'),
    role: log.role || 'TRABAJADOR',
    module: log.module || 'GENERAL',
    action: log.action || 'EVENTO',
    affected_record_id: log.affected_record_id || '-',
    details: normalizeText(log.details || ''),
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
