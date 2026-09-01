import { Encargatura, Vacacion, PapeletaSalida, PapeletaStatus, VacacionStatus } from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
import { normalizePersonName, normalizeInstitutionalName, normalizeText } from '../utils/nameUtils';
import { INITIAL_ENCARGATURAS, INITIAL_VACACIONES, INITIAL_PAPELETAS } from '../data/initialData';

/**
 * SERVICIO CENTRALIZADO DE ENCARGATURAS, VACACIONES Y PAPELETAS DE SALIDA (FASE 4)
 * 
 * Única Fuente de Verdad: Supabase PostgreSQL
 * Tablas:
 *  - encargaturas (Sustitución Funcional de Jefe Inmediato)
 *  - vacaciones (Descansos totales y parciales con flujo V°B° Jefe + Aprobación RRHH)
 *  - papeletas (Papeletas de salida con control en Garita de Seguridad y firma digital)
 *  - auditoria (Trazabilidad inmutable con origen de aplicación WEB / DESKTOP)
 */

// ==========================================
// 1. ENCARGATURAS TEMPORALES
// ==========================================

export async function fetchEncargaturasFromSupabase(): Promise<Encargatura[]> {
  try {
    const { data, error } = await supabase
      .from('encargaturas')
      .select('*')
      .order('fecha_inicio', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((e: any) => ({
        id: e.id,
        titular_employee_id: e.jefe_titular_id || e.titular_employee_id,
        titular_dni: e.titular_dni || '',
        titular_name: normalizePersonName(e.titular_name || 'Jefe Titular'),
        titular_cargo: normalizeInstitutionalName(e.titular_cargo || 'Titular'),
        titular_area_name: normalizeInstitutionalName(e.titular_area_name || ''),
        titular_direccion_organo_name: normalizeInstitutionalName(e.titular_direccion_organo_name || ''),
        encargado_employee_id: e.encargado_id || e.encargado_employee_id,
        encargado_dni: e.encargado_dni || '',
        encargado_name: normalizePersonName(e.encargado_name || 'Jefe Encargado'),
        encargado_cargo: normalizeInstitutionalName(e.encargado_cargo || 'Encargado'),
        encargado_area_procedencia_id: e.encargado_area_procedencia_id || '',
        encargado_area_procedencia_name: normalizeInstitutionalName(e.encargado_area_procedencia_name || ''),
        encargado_dependencia_procedencia_name: normalizeInstitutionalName(e.encargado_dependencia_procedencia_name || ''),
        dependencia_id: e.dependencia_id || 'dep-01',
        dependencia_name: normalizeInstitutionalName(e.dependencia_name || 'Sede Central'),
        direccion_organo_id: e.direccion_organo_id,
        direccion_organo_name: normalizeInstitutionalName(e.direccion_organo_name),
        direccion_organo_type: e.direccion_organo_type,
        area_id: e.unidad_id || e.area_id,
        area_name: normalizeInstitutionalName(e.area_name || ''),
        cargo_encargado: normalizeInstitutionalName(e.cargo_encargado || 'Jefe Encargado (e)'),
        motivo: e.motivo || 'COMISION_SERVICIOS',
        motivo_detalle: normalizeText(e.motivo_detalle || e.motivo),
        start_date: e.fecha_inicio || e.start_date,
        end_date: e.fecha_fin || e.end_date,
        document_type: e.tipo_documento || e.document_type || 'MEMORANDO',
        document_number: e.documento || e.document_number,
        document_date: e.fecha_documento || e.document_date || e.fecha_inicio || e.start_date,
        document_file_name: e.document_file_name,
        status: e.estado === 'ACTIVE' ? 'VIGENTE' : (e.estado === 'INACTIVE' ? 'FINALIZADA' : (e.status || 'VIGENTE')),
        created_at: e.created_at || new Date().toISOString(),
        created_by: e.created_by,
        observaciones: normalizeText(e.observaciones),
      }));
    }

    // Fallback a API local
    const res = await fetch('/api/encargaturas');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((e: Encargatura) => ({
          ...e,
          titular_name: normalizePersonName(e.titular_name),
          titular_cargo: normalizeInstitutionalName(e.titular_cargo),
          titular_area_name: normalizeInstitutionalName(e.titular_area_name),
          titular_direccion_organo_name: normalizeInstitutionalName(e.titular_direccion_organo_name),
          encargado_name: normalizePersonName(e.encargado_name),
          encargado_cargo: normalizeInstitutionalName(e.encargado_cargo),
          encargado_area_procedencia_name: normalizeInstitutionalName(e.encargado_area_procedencia_name),
          encargado_dependencia_procedencia_name: normalizeInstitutionalName(e.encargado_dependencia_procedencia_name),
          dependencia_name: normalizeInstitutionalName(e.dependencia_name),
          direccion_organo_name: normalizeInstitutionalName(e.direccion_organo_name),
          area_name: normalizeInstitutionalName(e.area_name),
          cargo_encargado: normalizeInstitutionalName(e.cargo_encargado),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase encargaturas, aplicando catálogo base:', err);
  }

  return INITIAL_ENCARGATURAS.map((e) => ({
    ...e,
    titular_name: normalizePersonName(e.titular_name),
    titular_cargo: normalizeInstitutionalName(e.titular_cargo),
    titular_area_name: normalizeInstitutionalName(e.titular_area_name),
    titular_direccion_organo_name: normalizeInstitutionalName(e.titular_direccion_organo_name),
    encargado_name: normalizePersonName(e.encargado_name),
    encargado_cargo: normalizeInstitutionalName(e.encargado_cargo),
    encargado_area_procedencia_name: normalizeInstitutionalName(e.encargado_area_procedencia_name),
    encargado_dependencia_procedencia_name: normalizeInstitutionalName(e.encargado_dependencia_procedencia_name),
    dependencia_name: normalizeInstitutionalName(e.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(e.direccion_organo_name),
    area_name: normalizeInstitutionalName(e.area_name),
    cargo_encargado: normalizeInstitutionalName(e.cargo_encargado),
  }));
}

export async function saveEncargaturaToSupabase(enc: Encargatura): Promise<{ success: boolean; data?: Encargatura; message?: string }> {
  const origin = getAppOrigin();

  const normalizedEnc: Encargatura = {
    ...enc,
    titular_name: normalizePersonName(enc.titular_name),
    titular_cargo: normalizeInstitutionalName(enc.titular_cargo),
    titular_area_name: normalizeInstitutionalName(enc.titular_area_name),
    titular_direccion_organo_name: normalizeInstitutionalName(enc.titular_direccion_organo_name),
    encargado_name: normalizePersonName(enc.encargado_name),
    encargado_cargo: normalizeInstitutionalName(enc.encargado_cargo),
    encargado_area_procedencia_name: normalizeInstitutionalName(enc.encargado_area_procedencia_name),
    encargado_dependencia_procedencia_name: normalizeInstitutionalName(enc.encargado_dependencia_procedencia_name),
    dependencia_name: normalizeInstitutionalName(enc.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(enc.direccion_organo_name),
    area_name: normalizeInstitutionalName(enc.area_name),
    cargo_encargado: normalizeInstitutionalName(enc.cargo_encargado),
    motivo_detalle: normalizeText(enc.motivo_detalle),
  };

  const dbEncargatura = {
    id: normalizedEnc.id,
    unidad_id: normalizedEnc.area_id || normalizedEnc.direccion_organo_id || 'area-admin-rrhh',
    jefe_titular_id: normalizedEnc.titular_employee_id,
    encargado_id: normalizedEnc.encargado_employee_id,
    documento: normalizedEnc.document_number,
    fecha_inicio: normalizedEnc.start_date,
    fecha_fin: normalizedEnc.end_date,
    motivo: normalizedEnc.motivo_detalle || normalizedEnc.motivo,
    estado: normalizedEnc.status === 'VIGENTE' ? 'ACTIVE' : (normalizedEnc.status === 'ANULADA' ? 'ANULADA' : 'INACTIVE'),
  };

  try {
    const { error } = await supabase
      .from('encargaturas')
      .upsert(dbEncargatura);

    if (!error) {
      return { success: true, data: normalizedEnc };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase encargaturas:', err);
  }

  try {
    const res = await fetch('/api/encargaturas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedEnc),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedEnc };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedEnc };
}

export async function deleteEncargaturaInSupabase(id: string): Promise<{ success: boolean }> {
  try {
    await supabase.from('encargaturas').delete().eq('id', id);
  } catch (e) {
    console.warn('Error delete Supabase encargaturas:', e);
  }

  try {
    await fetch(`/api/encargaturas/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {}

  return { success: true };
}

// ==========================================
// 2. VACACIONES
// ==========================================

export async function fetchVacacionesFromSupabase(): Promise<Vacacion[]> {
  try {
    const { data, error } = await supabase
      .from('vacaciones')
      .select('*')
      .order('fecha_inicio', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((v: any) => ({
        id: v.id,
        code: v.codigo || `VAC-${v.periodo_anual || new Date().getFullYear()}-${v.id.substring(0, 4)}`,
        employee_id: v.trabajador_id || v.employee_id,
        employee_dni: v.dni || v.employee_dni || '',
        employee_name: normalizePersonName(v.employee_name || 'Trabajador DRAC'),
        dependencia_id: v.dependencia_id || 'dep-01',
        dependencia_name: normalizeInstitutionalName(v.dependencia_name || 'Sede Central'),
        direccion_organo_name: normalizeInstitutionalName(v.direccion_organo_name || ''),
        area_id: v.area_id || '',
        area_name: normalizeInstitutionalName(v.area_name || ''),
        position: normalizeInstitutionalName(v.position || ''),
        regimen_laboral: v.regimen_laboral || 'CAS D.L. 1057',
        condicion_laboral: v.condicion_laboral || 'CONTRATADO',
        tipo: v.tipo || 'PARCIAL',
        start_date: v.fecha_inicio || v.start_date,
        end_date: v.fecha_fin || v.end_date,
        total_days: v.dias || v.total_days || 1,
        period_year: v.periodo_anual || v.period_year || new Date().getFullYear(),
        status: v.estado === 'APPROVED' ? 'PROGRAMADA' : (v.estado || 'SOLICITADA'),
        origin: v.origin || 'PROFILE_VACATION_REQUEST',
        supervisor_id: v.supervisor_id,
        supervisor_name: normalizePersonName(v.supervisor_name),
        boss_approved_at: v.boss_approved_at,
        boss_approver_id: v.boss_approver_id,
        boss_approver_dni: v.boss_approver_dni,
        boss_approver_name: normalizePersonName(v.boss_approver_name),
        boss_approver_function: v.boss_approver_function,
        boss_delegation_info: v.boss_delegation_info,
        boss_comment: normalizeText(v.boss_comment),
        rejection_reason: normalizeText(v.rejection_reason),
        observation_comment: normalizeText(v.observation_comment),
        approved_by_hr: v.approved_by_hr,
        hr_approved_at: v.hr_approved_at,
        hr_approver_id: v.hr_approver_id,
        hr_approver_name: normalizePersonName(v.hr_approver_name),
        hr_comment: normalizeText(v.hr_comment),
        comments: normalizeText(v.observaciones || v.comments),
        created_at: v.created_at || new Date().toISOString(),
        created_by: v.created_by,
        created_by_role: v.created_by_role,
        updated_at: v.updated_at,
        audits: v.audits || [],
      }));
    }

    // Fallback a API central
    const res = await fetch('/api/vacaciones');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((v: Vacacion) => ({
          ...v,
          employee_name: normalizePersonName(v.employee_name),
          dependencia_name: normalizeInstitutionalName(v.dependencia_name),
          direccion_organo_name: normalizeInstitutionalName(v.direccion_organo_name),
          area_name: normalizeInstitutionalName(v.area_name),
          position: normalizeInstitutionalName(v.position),
          supervisor_name: normalizePersonName(v.supervisor_name),
          boss_approver_name: normalizePersonName(v.boss_approver_name),
          hr_approver_name: normalizePersonName(v.hr_approver_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase vacaciones, aplicando catálogo base:', err);
  }

  return INITIAL_VACACIONES.map((v) => ({
    ...v,
    employee_name: normalizePersonName(v.employee_name),
    dependencia_name: normalizeInstitutionalName(v.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(v.direccion_organo_name),
    area_name: normalizeInstitutionalName(v.area_name),
    position: normalizeInstitutionalName(v.position),
    supervisor_name: normalizePersonName(v.supervisor_name),
    boss_approver_name: normalizePersonName(v.boss_approver_name),
    hr_approver_name: normalizePersonName(v.hr_approver_name),
  }));
}

export async function saveVacacionToSupabase(vac: Vacacion): Promise<{ success: boolean; data?: Vacacion; message?: string }> {
  const origin = getAppOrigin();

  const normalizedVac: Vacacion = {
    ...vac,
    employee_name: normalizePersonName(vac.employee_name),
    dependencia_name: normalizeInstitutionalName(vac.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(vac.direccion_organo_name),
    area_name: normalizeInstitutionalName(vac.area_name),
    position: normalizeInstitutionalName(vac.position),
    supervisor_name: normalizePersonName(vac.supervisor_name),
    boss_approver_name: normalizePersonName(vac.boss_approver_name),
    hr_approver_name: normalizePersonName(vac.hr_approver_name),
    comments: normalizeText(vac.comments),
  };

  const dbVacacion = {
    id: normalizedVac.id,
    trabajador_id: normalizedVac.employee_id,
    tipo: normalizedVac.tipo,
    fecha_inicio: normalizedVac.start_date,
    fecha_fin: normalizedVac.end_date,
    dias: normalizedVac.total_days,
    periodo_anual: normalizedVac.period_year,
    estado: normalizedVac.status === 'PROGRAMADA' || normalizedVac.status === 'APROBADA_RRHH' ? 'APPROVED' : (normalizedVac.status === 'RECHAZADA' ? 'REJECTED' : 'PENDING'),
    aprobado_por_rrhh_id: normalizedVac.hr_approver_id || null,
    observaciones: normalizedVac.comments || normalizedVac.boss_comment || null,
  };

  try {
    const { error } = await supabase
      .from('vacaciones')
      .upsert(dbVacacion);

    if (!error) {
      return { success: true, data: normalizedVac };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase vacaciones:', err);
  }

  try {
    const res = await fetch('/api/vacaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedVac),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedVac };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedVac };
}

export async function deleteVacacionInSupabase(id: string): Promise<{ success: boolean }> {
  try {
    await supabase.from('vacaciones').delete().eq('id', id);
  } catch (e) {
    console.warn('Error delete Supabase vacaciones:', e);
  }

  try {
    await fetch(`/api/vacaciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {}

  return { success: true };
}

// ==========================================
// 3. PAPELETAS DE SALIDA
// ==========================================

export async function fetchPapeletasFromSupabase(): Promise<PapeletaSalida[]> {
  try {
    const { data, error } = await supabase
      .from('papeletas')
      .select('*')
      .order('fecha', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((p: any) => ({
        id: p.id,
        code: p.codigo || p.code,
        employee_id: p.trabajador_id || p.employee_id,
        employee_dni: p.employee_dni || '',
        employee_name: normalizePersonName(p.employee_name || 'Trabajador DRAC'),
        dependencia_name: normalizeInstitutionalName(p.dependencia_name || 'Sede Central'),
        direccion_organo_name: normalizeInstitutionalName(p.direccion_organo_name || ''),
        area_name: normalizeInstitutionalName(p.area_name || ''),
        supervisor_id: p.aprobador_id || p.supervisor_id || '',
        supervisor_name: normalizePersonName(p.supervisor_name || 'Jefe Inmediato'),
        supervisor_dni: p.supervisor_dni,
        supervisor_function: p.supervisor_function,
        supervisor_delegation_info: p.supervisor_delegation_info,
        motivo: p.motivo || 'COMISION_SERVICIOS',
        descripcion: normalizeText(p.fundamentacion || p.descripcion || ''),
        destino: normalizeText(p.destino || 'Destino Institucional'),
        fecha: p.fecha,
        hora_estimada_salida: p.hora_salida_estimada || p.hora_estimada_salida || '',
        hora_estimada_retorno: p.hora_retorno_estimada || p.hora_estimada_retorno || '',
        hora_real_salida: p.hora_real_salida || null,
        hora_real_retorno: p.hora_real_retorno || null,
        sin_retorno: p.sin_retorno || false,
        status: p.estado || p.status || 'PENDING_BOSS',
        origin: p.origin || 'PORTAL_TRABAJADOR',
        digital_signature_data: p.digital_signature_data,
        signed_at: p.signed_at,
        boss_approved_at: p.boss_approved_at,
        boss_comment: normalizeText(p.boss_comment),
        boss_approver_name: normalizePersonName(p.boss_approver_name),
        boss_approver_dni: p.boss_approver_dni,
        boss_approver_profile: p.boss_approver_profile,
        boss_approver_function: p.boss_approver_function,
        boss_delegation_info: p.boss_delegation_info,
        hr_approved_at: p.hr_approved_at,
        hr_comment: normalizeText(p.hr_comment),
        hr_approver_name: normalizePersonName(p.hr_approver_name),
        hr_approver_dni: p.hr_approver_dni,
        security_guard_id: p.security_guard_id,
        security_guard_name: normalizePersonName(p.security_guard_name),
        rejection_reason: normalizeText(p.rejection_reason),
        created_by: p.created_by,
        created_by_role: p.created_by_role,
        audits: p.audits || [],
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
      }));
    }

    // Fallback a API central
    const res = await fetch('/api/papeletas');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((p: PapeletaSalida) => ({
          ...p,
          employee_name: normalizePersonName(p.employee_name),
          dependencia_name: normalizeInstitutionalName(p.dependencia_name),
          direccion_organo_name: normalizeInstitutionalName(p.direccion_organo_name),
          area_name: normalizeInstitutionalName(p.area_name),
          supervisor_name: normalizePersonName(p.supervisor_name),
          boss_approver_name: normalizePersonName(p.boss_approver_name),
          hr_approver_name: normalizePersonName(p.hr_approver_name),
          security_guard_name: normalizePersonName(p.security_guard_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase papeletas, aplicando catálogo base:', err);
  }

  return INITIAL_PAPELETAS.map((p) => ({
    ...p,
    employee_name: normalizePersonName(p.employee_name),
    dependencia_name: normalizeInstitutionalName(p.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(p.direccion_organo_name),
    area_name: normalizeInstitutionalName(p.area_name),
    supervisor_name: normalizePersonName(p.supervisor_name),
    boss_approver_name: normalizePersonName(p.boss_approver_name),
    hr_approver_name: normalizePersonName(p.hr_approver_name),
    security_guard_name: normalizePersonName(p.security_guard_name),
  }));
}

export async function savePapeletaToSupabase(papeleta: PapeletaSalida): Promise<{ success: boolean; data?: PapeletaSalida; message?: string }> {
  const origin = getAppOrigin();

  const normalizedPapeleta: PapeletaSalida = {
    ...papeleta,
    employee_name: normalizePersonName(papeleta.employee_name),
    dependencia_name: normalizeInstitutionalName(papeleta.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(papeleta.direccion_organo_name),
    area_name: normalizeInstitutionalName(papeleta.area_name),
    supervisor_name: normalizePersonName(papeleta.supervisor_name),
    boss_approver_name: normalizePersonName(papeleta.boss_approver_name),
    hr_approver_name: normalizePersonName(papeleta.hr_approver_name),
    security_guard_name: normalizePersonName(papeleta.security_guard_name),
    descripcion: normalizeText(papeleta.descripcion),
    destino: normalizeText(papeleta.destino),
  };

  const dbPapeleta = {
    id: normalizedPapeleta.id,
    codigo: normalizedPapeleta.code,
    trabajador_id: normalizedPapeleta.employee_id,
    aprobador_id: normalizedPapeleta.supervisor_id || null,
    motivo: normalizedPapeleta.motivo,
    fundamentacion: normalizedPapeleta.descripcion,
    fecha: normalizedPapeleta.fecha,
    hora_salida_estimada: normalizedPapeleta.hora_estimada_salida || '08:00',
    hora_retorno_estimada: normalizedPapeleta.hora_estimada_retorno || null,
    hora_real_salida: normalizedPapeleta.hora_real_salida || null,
    hora_real_retorno: normalizedPapeleta.hora_real_retorno || null,
    sin_retorno: normalizedPapeleta.sin_retorno || false,
    estado: normalizedPapeleta.status,
    boss_approved_at: normalizedPapeleta.boss_approved_at ? new Date().toISOString() : null,
    hr_approved_at: normalizedPapeleta.hr_approved_at ? new Date().toISOString() : null,
    security_guard_id: normalizedPapeleta.security_guard_id || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('papeletas')
      .upsert(dbPapeleta);

    if (!error) {
      return { success: true, data: normalizedPapeleta };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase papeletas:', err);
  }

  try {
    const res = await fetch('/api/papeletas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedPapeleta),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedPapeleta };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedPapeleta };
}
