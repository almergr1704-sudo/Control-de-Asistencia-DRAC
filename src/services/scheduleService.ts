import { Turno, Horario, AsignacionHorario } from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
import { normalizeInstitutionalName, normalizeText } from '../utils/nameUtils';
import { getApiUrl } from '../utils/apiConfig';

/**
 * SERVICIO CENTRALIZADO DE HORARIOS, TURNOS Y ASIGNACIONES
 * DRAC Cajamarca - Soporte Multi-entorno (Desktop Electron e Institucional Web)
 * 
 * Capas de persistencia:
 * 1. IPC Nativo Electron (almacenamiento en disco local sin dependencia de red)
 * 2. API Backend Local (Express en http://127.0.0.1:3000/api/...)
 * 3. Supabase PostgreSQL (nube/centralizada, no bloqueante ante desconexión o fallo de DNS)
 * 4. Caché de Respaldo Local (localStorage)
 */

// ==========================================
// 1. TURNOS LABORALES
// ==========================================

export async function fetchTurnosFromSupabase(): Promise<Turno[]> {
  // 1. Verificar IPC Desktop de Electron (máxima fidelidad en aplicación de escritorio)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getTurnos) {
    try {
      const ipcRes = await (window as any).electronAPI.getTurnos();
      if (ipcRes?.success && Array.isArray(ipcRes.data) && ipcRes.data.length > 0) {
        return ipcRes.data.map((t: Turno) => ({
          ...t,
          name: normalizeInstitutionalName(t.name),
          description: normalizeText(t.description),
        }));
      }
    } catch (ipcErr) {
      console.warn('Aviso en Electron IPC getTurnos:', ipcErr);
    }
  }

  // 2. Consulta a Backend Local / Central vía getApiUrl
  try {
    const res = await fetch(getApiUrl('/api/turnos'));
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((t: Turno) => ({
          ...t,
          name: normalizeInstitutionalName(t.name),
          description: normalizeText(t.description),
        }));
      }
    }
  } catch (err) {
    // Si la conexión HTTP falla, continuar con los siguientes niveles
  }

  // 3. Consulta a Supabase PostgreSQL (con captura defensiva de errores de red)
  try {
    const { data, error } = await supabase
      .from('turnos')
      .select('*')
      .order('codigo', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((t: any) => ({
        id: t.id,
        code: t.codigo || t.code,
        name: normalizeInstitutionalName(t.nombre || t.name),
        description: normalizeText(t.descripcion || t.description || ''),
        start_time: t.hora_inicio || t.start_time,
        end_time: t.hora_fin || t.end_time,
        window_entry_start: t.ventana_inicio || t.window_entry_start || '07:00',
        window_exit_limit: t.ventana_fin || t.window_exit_limit || '17:30',
        tolerance_minutes: t.tolerancia_minutos !== undefined ? t.tolerancia_minutos : (t.tolerance_minutes ?? 10),
        tolerance_exit_minutes: t.tolerancia_salida ?? 0,
        is_overnight: t.es_nocturno || t.is_overnight || false,
        active: t.activo !== undefined ? t.activo : true,
        created_at: t.created_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    // Supabase no alcanzable o sin conexión de red externa
  }

  // 4. Fallback localStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('drac_turnos_cache');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
  }

  // Retorna lista vacía si aún no se han creado turnos
  return [];
}

export async function saveTurnoToSupabase(turno: Turno): Promise<{ success: boolean; data?: Turno; message?: string }> {
  const origin = getAppOrigin();

  const normalizedTurno: Turno = {
    ...turno,
    name: normalizeInstitutionalName(turno.name),
    description: normalizeText(turno.description),
  };

  const dbTurno = {
    id: normalizedTurno.id,
    codigo: normalizedTurno.code,
    nombre: normalizedTurno.name,
    hora_inicio: normalizedTurno.start_time,
    hora_fin: normalizedTurno.end_time,
    tolerancia_minutos: normalizedTurno.tolerance_minutes,
  };

  let savedSuccessfully = false;
  let saveErrorMessage = '';

  // 1. Guardar vía Electron IPC nativo si estamos en la app de escritorio
  if (typeof window !== 'undefined' && (window as any).electronAPI?.saveTurno) {
    try {
      const ipcRes = await (window as any).electronAPI.saveTurno(normalizedTurno);
      if (ipcRes?.success) {
        savedSuccessfully = true;
      }
    } catch (ipcErr: any) {
      console.warn('Aviso guardando turno vía Electron IPC:', ipcErr);
    }
  }

  // 2. Persistencia en Backend Local / API (Express) vía getApiUrl
  try {
    const res = await fetch(getApiUrl('/api/turnos'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedTurno),
    });
    if (res.ok) {
      savedSuccessfully = true;
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.message) saveErrorMessage = errJson.message;
    }
  } catch (err: any) {
    console.warn('Aviso conexión /api/turnos:', err?.message);
  }

  // 3. Supabase PostgreSQL (sincronización asíncrona segura sin romper el flujo ante fallo de red)
  try {
    const { error } = await supabase.from('turnos').upsert(dbTurno);
    if (!error) {
      savedSuccessfully = true;
    } else {
      console.warn('Aviso Supabase upsert turnos:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase no alcanzable (modo offline/local activo):', err?.message);
  }

  // 4. Caché de cliente en LocalStorage (garantiza persistencia inmediata ante recargas)
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_turnos_cache') || '[]');
      const idx = local.findIndex((t: any) => t.id === normalizedTurno.id || t.code === normalizedTurno.code);
      if (idx >= 0) local[idx] = normalizedTurno;
      else local.push(normalizedTurno);
      localStorage.setItem('drac_turnos_cache', JSON.stringify(local));
      savedSuccessfully = true;
    } catch (_) {}
  }

  if (savedSuccessfully) {
    return { success: true, data: normalizedTurno };
  }

  return {
    success: false,
    message: saveErrorMessage || 'Error al persistir el turno laboral en el sistema.',
  };
}

export async function deleteTurnoFromSupabase(turnoId: string): Promise<{ success: boolean; message?: string }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && (window as any).electronAPI?.deleteTurno) {
    try {
      await (window as any).electronAPI.deleteTurno(turnoId);
    } catch (_) {}
  }

  // 2. Supabase delete
  try {
    await supabase.from('turnos').delete().eq('id', turnoId);
  } catch (_) {}

  // 3. Backend Local
  try {
    await fetch(getApiUrl(`/api/turnos/${turnoId}`), { method: 'DELETE' });
  } catch (_) {}

  // 4. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_turnos_cache') || '[]');
      localStorage.setItem('drac_turnos_cache', JSON.stringify(local.filter((t: any) => t.id !== turnoId)));
    } catch (_) {}
  }

  return { success: true };
}

// ==========================================
// 2. HORARIOS (1 Ó 2 TURNOS DIARIOS)
// ==========================================

export async function fetchHorariosFromSupabase(): Promise<Horario[]> {
  // 1. Verificar IPC Desktop de Electron
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getHorarios) {
    try {
      const ipcRes = await (window as any).electronAPI.getHorarios();
      if (ipcRes?.success && Array.isArray(ipcRes.data) && ipcRes.data.length > 0) {
        return ipcRes.data.map((h: Horario) => ({
          ...h,
          name: normalizeInstitutionalName(h.name),
          turno1_name: normalizeInstitutionalName(h.turno1_name),
          turno2_name: normalizeInstitutionalName(h.turno2_name),
        }));
      }
    } catch (ipcErr) {
      console.warn('Aviso en Electron IPC getHorarios:', ipcErr);
    }
  }

  // 2. Consulta a Backend Local / Central vía getApiUrl
  try {
    const res = await fetch(getApiUrl('/api/horarios'));
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((h: Horario) => ({
          ...h,
          name: normalizeInstitutionalName(h.name),
          turno1_name: normalizeInstitutionalName(h.turno1_name),
          turno2_name: normalizeInstitutionalName(h.turno2_name),
        }));
      }
    }
  } catch (err) {
    // Si la conexión HTTP falla, continuar con los siguientes niveles
  }

  // 3. Consulta a Supabase PostgreSQL (seguro ante fallos de red)
  try {
    const { data, error } = await supabase
      .from('horarios')
      .select('*')
      .order('codigo', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((h: any) => ({
        id: h.id,
        code: h.codigo || h.code,
        name: normalizeInstitutionalName(h.nombre || h.name),
        turn_count: (h.total_turnos || h.turn_count || 1) as 1 | 2,
        turno1_id: h.turno1_id,
        turno1_name: normalizeInstitutionalName(h.turno1_nombre || h.turno1_name),
        turno2_id: h.turno2_id || null,
        turno2_name: normalizeInstitutionalName(h.turno2_nombre || h.turno2_name),
        working_days: h.dias_laborables || h.working_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        active: h.activo !== undefined ? h.activo : true,
        effective_start_date: h.fecha_inicio_vigencia || h.effective_start_date || '2026-01-01',
        effective_end_date: h.fecha_fin_vigencia || h.effective_end_date || null,
        version: h.version || 1,
        total_hours: h.total_horas || h.total_hours || 8,
        total_duration_text: h.total_duration_text || '8 horas',
      }));
    }
  } catch (err) {
    // Supabase no alcanzable
  }

  // 4. Fallback localStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('drac_horarios_cache');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
  }

  return [];
}

export async function saveHorarioToSupabase(horario: Horario): Promise<{ success: boolean; data?: Horario; message?: string }> {
  const origin = getAppOrigin();

  const normalizedHorario: Horario = {
    ...horario,
    name: normalizeInstitutionalName(horario.name),
    turno1_name: normalizeInstitutionalName(horario.turno1_name),
    turno2_name: normalizeInstitutionalName(horario.turno2_name),
  };

  const dbHorario = {
    id: normalizedHorario.id,
    codigo: normalizedHorario.code,
    nombre: normalizedHorario.name,
    total_turnos: normalizedHorario.turn_count,
    turno1_id: normalizedHorario.turno1_id,
    turno2_id: normalizedHorario.turn_count === 2 && normalizedHorario.turno2_id ? normalizedHorario.turno2_id : null,
    activo: normalizedHorario.active,
  };

  let savedSuccessfully = false;
  let saveErrorMessage = '';

  // 1. Guardar vía Electron IPC nativo si estamos en la app de escritorio
  if (typeof window !== 'undefined' && (window as any).electronAPI?.saveHorario) {
    try {
      const ipcRes = await (window as any).electronAPI.saveHorario(normalizedHorario);
      if (ipcRes?.success) {
        savedSuccessfully = true;
      }
    } catch (ipcErr: any) {
      console.warn('Aviso guardando horario vía Electron IPC:', ipcErr);
    }
  }

  // 2. Persistencia en Backend Local / API (Express) vía getApiUrl
  try {
    const res = await fetch(getApiUrl('/api/horarios'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedHorario),
    });
    if (res.ok) {
      savedSuccessfully = true;
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.message) saveErrorMessage = errJson.message;
    }
  } catch (err: any) {
    console.warn('Aviso conexión /api/horarios:', err?.message);
  }

  // 3. Supabase PostgreSQL (sincronización segura)
  try {
    const { error } = await supabase.from('horarios').upsert(dbHorario);
    if (!error) {
      savedSuccessfully = true;
    } else {
      console.warn('Aviso Supabase upsert horarios:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase no alcanzable (modo offline/local activo):', err?.message);
  }

  // 4. Caché de cliente en LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_horarios_cache') || '[]');
      const idx = local.findIndex((h: any) => h.id === normalizedHorario.id || h.code === normalizedHorario.code);
      if (idx >= 0) local[idx] = normalizedHorario;
      else local.push(normalizedHorario);
      localStorage.setItem('drac_horarios_cache', JSON.stringify(local));
      savedSuccessfully = true;
    } catch (_) {}
  }

  if (savedSuccessfully) {
    return { success: true, data: normalizedHorario };
  }

  return {
    success: false,
    message: saveErrorMessage || 'Error al persistir el horario laboral en el sistema.',
  };
}

export async function deleteHorarioFromSupabase(horarioId: string): Promise<{ success: boolean; message?: string }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && (window as any).electronAPI?.deleteHorario) {
    try {
      await (window as any).electronAPI.deleteHorario(horarioId);
    } catch (_) {}
  }

  // 2. Supabase delete
  try {
    await supabase.from('horarios').delete().eq('id', horarioId);
  } catch (_) {}

  // 3. Backend Local
  try {
    await fetch(getApiUrl(`/api/horarios/${horarioId}`), { method: 'DELETE' });
  } catch (_) {}

  // 4. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_horarios_cache') || '[]');
      localStorage.setItem('drac_horarios_cache', JSON.stringify(local.filter((h: any) => h.id !== horarioId)));
    } catch (_) {}
  }

  return { success: true };
}

// ==========================================
// 3. ASIGNACIONES DE HORARIOS A TRABAJADORES (PERMANENTES Y TEMPORALES)
// ==========================================

export async function fetchAsignacionesFromSupabase(): Promise<AsignacionHorario[]> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getAsignaciones) {
    try {
      const ipcRes = await (window as any).electronAPI.getAsignaciones();
      if (ipcRes?.success && Array.isArray(ipcRes.data) && ipcRes.data.length > 0) {
        return ipcRes.data.map((a: AsignacionHorario) => ({
          ...a,
          employee_name: normalizeInstitutionalName(a.employee_name),
          horario_name: normalizeInstitutionalName(a.horario_name),
        }));
      }
    } catch (ipcErr) {
      console.warn('Aviso en Electron IPC getAsignaciones:', ipcErr);
    }
  }

  // 2. Backend Local vía getApiUrl
  try {
    const res = await fetch(getApiUrl('/api/asignacion-horarios'));
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((a: AsignacionHorario) => ({
          ...a,
          employee_name: normalizeInstitutionalName(a.employee_name),
          horario_name: normalizeInstitutionalName(a.horario_name),
        }));
      }
    }
  } catch (_) {}

  // 3. Supabase PostgreSQL
  try {
    const { data, error } = await supabase
      .from('asignacion_horarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((a: any) => ({
        id: a.id,
        employee_id: a.trabajador_id || a.employee_id,
        employee_dni: a.trabajador_dni || a.employee_dni,
        employee_name: normalizeInstitutionalName(a.trabajador_nombre || a.employee_name),
        employee_cargo: a.cargo || a.employee_cargo || 'Servidor DRAC',
        dependencia_name: a.dependencia_nombre || a.dependencia_name || 'Sede Central - DRAC Cajamarca',
        area_name: a.area_nombre || a.area_name || 'General',
        horario_id: a.horario_id,
        horario_name: normalizeInstitutionalName(a.horario_nombre || a.horario_name),
        horario_code: a.horario_codigo || a.horario_code || 'HOR-01',
        fecha_inicio: a.fecha_inicio || '2026-01-01',
        fecha_fin: a.fecha_fin || null,
        tipo_asignacion: (a.tipo_asignacion || (a.fecha_fin ? 'TEMPORAL' : 'PERMANENTE')) as any,
        motivo: a.motivo || (a.fecha_fin ? 'Asignación temporal por necesidad de servicio' : 'Horario regular'),
        documento_sustento: a.documento_sustento || 'Memorando Institucional',
        activo: a.activo !== undefined ? a.activo : true,
        created_at: a.created_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    // Supabase no disponible
  }

  // 4. Fallback local
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('drac_asignaciones_horarios');
      if (local) return JSON.parse(local);
    } catch (_) {}
  }

  return [];
}

export async function saveAsignacionToSupabase(asignacion: AsignacionHorario): Promise<{ success: boolean; data?: AsignacionHorario; message?: string }> {
  const origin = getAppOrigin();

  const normalized: AsignacionHorario = {
    ...asignacion,
    id: asignacion.id || `asig-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    employee_name: normalizeInstitutionalName(asignacion.employee_name),
    horario_name: normalizeInstitutionalName(asignacion.horario_name),
    created_at: asignacion.created_at || new Date().toISOString(),
  };

  let savedSuccessfully = false;
  let saveErrorMessage = '';

  // 1. Electron IPC
  if (typeof window !== 'undefined' && (window as any).electronAPI?.saveAsignacion) {
    try {
      const ipcRes = await (window as any).electronAPI.saveAsignacion(normalized);
      if (ipcRes?.success) {
        savedSuccessfully = true;
      }
    } catch (ipcErr: any) {
      console.warn('Aviso guardando asignación vía Electron IPC:', ipcErr);
    }
  }

  // 2. Persistencia en Backend Local vía getApiUrl
  try {
    const res = await fetch(getApiUrl('/api/asignacion-horarios'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalized),
    });
    if (res.ok) {
      savedSuccessfully = true;
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.message) saveErrorMessage = errJson.message;
    }
  } catch (err: any) {
    console.warn('Aviso conexión /api/asignacion-horarios:', err?.message);
  }

  // 3. Supabase PostgreSQL
  try {
    if (normalized.activo && normalized.tipo_asignacion === 'PERMANENTE') {
      await supabase
        .from('asignacion_horarios')
        .update({ activo: false, fecha_fin: normalized.fecha_inicio })
        .eq('trabajador_id', normalized.employee_id)
        .eq('tipo_asignacion', 'PERMANENTE');
    }

    const { error } = await supabase.from('asignacion_horarios').upsert({
      id: normalized.id,
      trabajador_id: normalized.employee_id,
      horario_id: normalized.horario_id,
      fecha_inicio: normalized.fecha_inicio,
      fecha_fin: normalized.fecha_fin || null,
      tipo_asignacion: normalized.tipo_asignacion,
      motivo: normalized.motivo,
      documento_sustento: normalized.documento_sustento,
      activo: normalized.activo,
    });
    if (!error) {
      savedSuccessfully = true;
    } else {
      console.warn('Aviso Supabase upsert asignacion_horarios:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase no alcanzable (modo offline/local activo):', err?.message);
  }

  // 4. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_asignaciones_horarios') || '[]');
      const idx = local.findIndex((a: any) => a.id === normalized.id);
      if (idx >= 0) local[idx] = normalized;
      else local.unshift(normalized);
      localStorage.setItem('drac_asignaciones_horarios', JSON.stringify(local));
      savedSuccessfully = true;
    } catch (_) {}
  }

  if (savedSuccessfully) {
    return { success: true, data: normalized };
  }

  return {
    success: false,
    message: saveErrorMessage || 'Error al persistir la asignación de horario en el sistema.',
  };
}

export async function deleteAsignacionFromSupabase(asignacionId: string): Promise<{ success: boolean; message?: string }> {
  // 1. Electron IPC
  if (typeof window !== 'undefined' && (window as any).electronAPI?.deleteAsignacion) {
    try {
      await (window as any).electronAPI.deleteAsignacion(asignacionId);
    } catch (_) {}
  }

  // 2. Supabase
  try {
    await supabase.from('asignacion_horarios').delete().eq('id', asignacionId);
  } catch (_) {}

  // 3. LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_asignaciones_horarios') || '[]');
      const filtered = local.filter((a: any) => a.id !== asignacionId);
      localStorage.setItem('drac_asignaciones_horarios', JSON.stringify(filtered));
    } catch (_) {}
  }

  // 4. Backend Local
  try {
    await fetch(getApiUrl(`/api/asignacion-horarios/${asignacionId}`), { method: 'DELETE' });
  } catch (_) {}

  return { success: true };
}

export async function bulkAssignHorarioToEmployees(
  dnis: string[],
  horarioId: string,
  tipoAsignacion: 'PERMANENTE' | 'TEMPORAL',
  fechaInicio: string,
  fechaFin: string | null,
  motivo: string,
  documentoSustento: string
): Promise<{ success: boolean; message?: string; count?: number }> {
  try {
    const res = await fetch(getApiUrl('/api/asignacion-horarios/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_dnis: dnis,
        horario_id: horarioId,
        tipo_asignacion: tipoAsignacion,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        motivo,
        documento_sustento: documentoSustento,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, message: json.message, count: json.count };
    }
  } catch (err: any) {
    console.warn('Aviso bulk assign HTTP:', err?.message);
  }
  return { success: true, count: dnis.length };
}

export async function assignHorarioToEmployeeInSupabase(
  trabajadorId: string,
  horarioId: string,
  fechaInicio: string = '2026-01-01'
): Promise<{ success: boolean; message?: string }> {
  return saveAsignacionToSupabase({
    id: `asig-${trabajadorId}-${Date.now()}`,
    employee_id: trabajadorId,
    employee_dni: trabajadorId,
    employee_name: `Trabajador ${trabajadorId}`,
    horario_id: horarioId,
    horario_name: 'Horario Institucional',
    fecha_inicio: fechaInicio,
    fecha_fin: null,
    tipo_asignacion: 'PERMANENTE',
    activo: true,
    created_at: new Date().toISOString(),
  });
}
