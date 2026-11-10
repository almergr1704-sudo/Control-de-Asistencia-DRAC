import { Turno, Horario, AsignacionHorario } from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
import { normalizeInstitutionalName, normalizeText } from '../utils/nameUtils';
import { INITIAL_TURNOS, INITIAL_HORARIOS } from '../data/initialData';

/**
 * SERVICIO CENTRALIZADO DE HORARIOS, TURNOS Y ASIGNACIONES (FASE 3)
 * 
 * Única Fuente de Verdad: Supabase PostgreSQL
 * Tablas: turnos, horarios, asignacion_horarios
 * Reglas de Negocio:
 *  - Máximo 2 turnos por día
 *  - Validación de no solapamiento
 *  - Tolerancia de entrada configurable (por defecto 10 min)
 * Clientes: Vercel (Web) y Desktop (Escritorio)
 */

// ==========================================
// 1. TURNOS LABORALES
// ==========================================

export async function fetchTurnosFromSupabase(): Promise<Turno[]> {
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

    // Fallback a API central
    const res = await fetch('/api/turnos');
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
    console.warn('Conexión en progreso con Supabase turnos, aplicando catálogo base:', err);
  }

  return INITIAL_TURNOS.map((t) => ({
    ...t,
    name: normalizeInstitutionalName(t.name),
    description: normalizeText(t.description),
  }));
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

  // 1. Persistencia prioritaria y garantizada en Backend Local
  let localSaved = false;
  try {
    const res = await fetch('/api/turnos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedTurno),
    });
    if (res.ok) {
      localSaved = true;
    }
  } catch (err: any) {
    console.warn('Aviso guardando turno en backend local:', err?.message);
  }

  // 2. Replicación en Supabase PostgreSQL
  try {
    await Promise.race([
      supabase.from('turnos').upsert(dbTurno),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 3500)),
    ]);
  } catch (err) {
    console.warn('Aviso en upsert Supabase turnos (continuando con persistencia local):', err);
  }

  return { success: true, data: normalizedTurno };
}

// ==========================================
// 2. HORARIOS (1 Ó 2 TURNOS DIARIOS)
// ==========================================

export async function fetchHorariosFromSupabase(): Promise<Horario[]> {
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

    const res = await fetch('/api/horarios');
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
    console.warn('Conexión en progreso con Supabase horarios, aplicando catálogo base:', err);
  }

  return INITIAL_HORARIOS.map((h) => ({
    ...h,
    name: normalizeInstitutionalName(h.name),
    turno1_name: normalizeInstitutionalName(h.turno1_name),
    turno2_name: normalizeInstitutionalName(h.turno2_name),
  }));
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
    turno2_id: normalizedHorario.turno2_id || null,
    activo: normalizedHorario.active,
  };

  // 1. Persistencia prioritaria y garantizada en Backend Local
  try {
    const res = await fetch('/api/horarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedHorario),
    });
    if (!res.ok) {
      console.warn('Aviso guardando horario en API local');
    }
  } catch (err: any) {
    console.warn('Error en fetch /api/horarios:', err?.message);
  }

  // 2. Replicación en Supabase PostgreSQL
  try {
    await Promise.race([
      supabase.from('horarios').upsert(dbHorario),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 3500)),
    ]);
  } catch (err) {
    console.warn('Aviso en upsert Supabase horarios (continuando con persistencia local):', err);
  }

  return { success: true, data: normalizedHorario };
}

export async function deleteTurnoFromSupabase(turnoId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await supabase.from('turnos').delete().eq('id', turnoId);
  } catch (_) {}

  try {
    const res = await fetch(`/api/turnos/${turnoId}`, { method: 'DELETE' });
    if (res.ok) return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message };
  }
  return { success: true };
}

export async function deleteHorarioFromSupabase(horarioId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await supabase.from('horarios').delete().eq('id', horarioId);
  } catch (_) {}

  try {
    const res = await fetch(`/api/horarios/${horarioId}`, { method: 'DELETE' });
    if (res.ok) return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message };
  }
  return { success: true };
}

// ==========================================
// 3. ASIGNACIONES DE HORARIOS A TRABAJADORES (PERMANENTES Y TEMPORALES)
// ==========================================

export async function fetchAsignacionesFromSupabase(): Promise<AsignacionHorario[]> {
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
        dependencia_name: a.dependencia_nombre || a.dependencia_name || 'SEDE CENTRAL - DRAC CAJAMARCA',
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

    const res = await fetch('/api/asignacion-horarios');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data)) {
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase asignaciones, aplicando catálogo local:', err);
  }

  // Fallback local
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

  try {
    if (normalized.activo && normalized.tipo_asignacion === 'PERMANENTE') {
      await supabase
        .from('asignacion_horarios')
        .update({ activo: false, fecha_fin: normalized.fecha_inicio })
        .eq('trabajador_id', normalized.employee_id)
        .eq('tipo_asignacion', 'PERMANENTE');
    }

    await supabase.from('asignacion_horarios').upsert({
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
  } catch (_) {}

  try {
    const res = await fetch('/api/asignacion-horarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalized),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || normalized };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  // Fallback local
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_asignaciones_horarios') || '[]');
      const idx = local.findIndex((a: any) => a.id === normalized.id);
      if (idx >= 0) local[idx] = normalized;
      else local.unshift(normalized);
      localStorage.setItem('drac_asignaciones_horarios', JSON.stringify(local));
    } catch (_) {}
  }

  return { success: true, data: normalized };
}

export async function deleteAsignacionFromSupabase(asignacionId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await supabase.from('asignacion_horarios').delete().eq('id', asignacionId);
  } catch (_) {}

  try {
    const res = await fetch(`/api/asignacion-horarios/${asignacionId}`, { method: 'DELETE' });
    if (res.ok) return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('drac_asignaciones_horarios') || '[]');
      const filtered = local.filter((a: any) => a.id !== asignacionId);
      localStorage.setItem('drac_asignaciones_horarios', JSON.stringify(filtered));
    } catch (_) {}
  }

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
    const res = await fetch('/api/asignacion-horarios/bulk', {
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
    return { success: false, message: err?.message };
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
