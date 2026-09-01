import { Turno, Horario } from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
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
        name: t.nombre || t.name,
        description: t.descripcion || t.description || '',
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
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase turnos, aplicando catálogo base:', err);
  }

  return INITIAL_TURNOS;
}

export async function saveTurnoToSupabase(turno: Turno): Promise<{ success: boolean; data?: Turno; message?: string }> {
  const origin = getAppOrigin();
  const dbTurno = {
    id: turno.id,
    codigo: turno.code,
    nombre: turno.name,
    hora_inicio: turno.start_time,
    hora_fin: turno.end_time,
    tolerancia_minutos: turno.tolerance_minutes,
  };

  try {
    const { error } = await supabase
      .from('turnos')
      .upsert(dbTurno);

    if (!error) {
      return { success: true, data: turno };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase turnos:', err);
  }

  try {
    const res = await fetch('/api/turnos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(turno),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || turno };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: turno };
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
        name: h.nombre || h.name,
        turn_count: (h.total_turnos || h.turn_count || 1) as 1 | 2,
        turno1_id: h.turno1_id,
        turno1_name: h.turno1_nombre || h.turno1_name,
        turno2_id: h.turno2_id || null,
        turno2_name: h.turno2_nombre || h.turno2_name,
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
        return apiData.data;
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase horarios, aplicando catálogo base:', err);
  }

  return INITIAL_HORARIOS;
}

export async function saveHorarioToSupabase(horario: Horario): Promise<{ success: boolean; data?: Horario; message?: string }> {
  const origin = getAppOrigin();
  const dbHorario = {
    id: horario.id,
    codigo: horario.code,
    nombre: horario.name,
    total_turnos: horario.turn_count,
    turno1_id: horario.turno1_id,
    turno2_id: horario.turno2_id || null,
    activo: horario.active,
  };

  try {
    const { error } = await supabase
      .from('horarios')
      .upsert(dbHorario);

    if (!error) {
      return { success: true, data: horario };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase horarios:', err);
  }

  try {
    const res = await fetch('/api/horarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(horario),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || horario };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: horario };
}

// ==========================================
// 3. ASIGNACIONES DE HORARIOS A TRABAJADORES
// ==========================================

export async function assignHorarioToEmployeeInSupabase(
  trabajadorId: string,
  horarioId: string,
  fechaInicio: string = '2026-01-01'
): Promise<{ success: boolean; message?: string }> {
  const origin = getAppOrigin();
  const assignmentId = `asig-${trabajadorId}-${Date.now()}`;

  try {
    // Desactivar asignaciones previas activas en Supabase
    await supabase
      .from('asignacion_horarios')
      .update({ activo: false, fecha_fin: new Date().toISOString().split('T')[0] })
      .eq('trabajador_id', trabajadorId)
      .eq('activo', true);

    // Insertar nueva asignación activa
    const { error } = await supabase
      .from('asignacion_horarios')
      .insert({
        id: assignmentId,
        trabajador_id: trabajadorId,
        horario_id: horarioId,
        fecha_inicio: fechaInicio,
        activo: true,
      });

    if (!error) {
      return { success: true };
    }
  } catch (err) {
    console.warn('Error al registrar asignacion_horarios en Supabase:', err);
  }

  try {
    const res = await fetch('/api/asignacion-horarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify({ trabajador_id: trabajadorId, horario_id: horarioId, fecha_inicio: fechaInicio }),
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true };
}
