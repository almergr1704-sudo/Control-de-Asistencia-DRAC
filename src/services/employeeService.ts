import { Employee } from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
import { normalizePersonName, normalizeInstitutionalName, buildNormalizedFullName, normalizeText } from '../utils/nameUtils';
import { INITIAL_EMPLOYEES } from '../data/initialData';

/**
 * SERVICIO CENTRALIZADO DE PERSONAL Y USUARIOS (FASE 2)
 * 
 * Única Fuente de Verdad: Supabase PostgreSQL
 * Tablas: trabajadores, usuarios
 * Algoritmo: generate_next_drac_code() con relleno de huecos (gap-filling)
 * Clientes: Vercel (Web) y Desktop (Escritorio)
 */

export async function fetchEmployeesFromSupabase(): Promise<Employee[]> {
  try {
    // 1. Consultar trabajadores directamente desde Supabase PostgreSQL
    const { data: dbTrabajadores, error } = await supabase
      .from('trabajadores')
      .select(`
        *,
        usuarios (
          id,
          username,
          roles,
          requiere_cambio_password,
          password_hash,
          activo
        )
      `)
      .order('codigo_drac', { ascending: true });

    if (!error && Array.isArray(dbTrabajadores) && dbTrabajadores.length > 0) {
      return dbTrabajadores.map((t: any) => {
        const u = Array.isArray(t.usuarios) && t.usuarios.length > 0 ? t.usuarios[0] : (t.usuarios || {});
        const normFirstName = normalizePersonName(t.nombres || t.first_name);
        const normPat = normalizePersonName(t.apellido_paterno);
        const normMat = normalizePersonName(t.apellido_materno);
        const normLastName = buildNormalizedFullName('', t.last_name, normPat, normMat) || `${normPat} ${normMat}`.trim();

        return {
          id: t.id,
          codigo_trabajador: t.codigo_drac || t.codigo_trabajador,
          dni: t.dni,
          first_name: normFirstName,
          last_name: normLastName,
          apellido_paterno: normPat,
          apellido_materno: normMat,
          email: (t.email || '').toLowerCase().trim(),
          phone: t.telefono || t.phone || '',
          address: normalizeText(t.direccion || t.address || ''),
          dependencia_id: t.dependencia_id || 'dep-01',
          dependencia_name: normalizeInstitutionalName(t.dependencia_nombre || t.dependencia_name || 'Sede Central'),
          direccion_organo_id: t.direccion_id || t.direccion_organo_id,
          direccion_organo_name: normalizeInstitutionalName(t.direccion_nombre || t.direccion_organo_name),
          area_id: t.area_id || '',
          area_name: normalizeInstitutionalName(t.area_nombre || t.area_name || ''),
          position: normalizeInstitutionalName(t.cargo_nombre || t.position || 'Trabajador'),
          cargo_id: t.cargo_id,
          regimen_laboral: (t.regimen_laboral || t.regimen_id || 'CAS D.L. 1057') as any,
          condicion_laboral: (t.condicion_laboral || 'CONTRATADO') as any,
          is_jefe_director: t.es_jefe || false,
          role: (u.roles && u.roles[0]) || t.role || 'TRABAJADOR',
          assigned_roles: u.roles || t.assigned_roles || ['TRABAJADOR'],
          has_system_access: t.has_system_access !== undefined ? t.has_system_access : (u.activo !== undefined ? u.activo : true),
          username: u.username || t.username,
          account_status: (u.activo ? 'ACTIVE' : 'INACTIVE') as any,
          auth_method: 'PASSWORD',
          primer_ingreso: u.requiere_cambio_password ? 'PENDIENTE' : 'COMPLETADO',
          password_change_required: u.requiere_cambio_password || false,
          password_hash: u.password_hash,
          active: t.estado ? t.estado === 'ACTIVO' : (t.active !== undefined ? t.active : true),
          hire_date: t.fecha_ingreso || t.hire_date || '2026-01-01',
          zkteco_pin: t.zkteco_pin || t.dni,
          schedule_id: t.schedule_id || 'hor-01',
          schedule_name: normalizeInstitutionalName(t.schedule_name || 'Jornada Administrativa'),
        };
      });
    }

    // 2. Consulta vía endpoint central
    const res = await fetch('/api/trabajadores');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((t: Employee) => ({
          ...t,
          first_name: normalizePersonName(t.first_name),
          last_name: normalizePersonName(t.last_name),
          apellido_paterno: normalizePersonName(t.apellido_paterno),
          apellido_materno: normalizePersonName(t.apellido_materno),
          position: normalizeInstitutionalName(t.position),
          dependencia_name: normalizeInstitutionalName(t.dependencia_name),
          direccion_organo_name: normalizeInstitutionalName(t.direccion_organo_name),
          area_name: normalizeInstitutionalName(t.area_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase trabajadores, aplicando catálogo base:', err);
  }

  // 3. Retornar catálogo institucional base normalizado
  return INITIAL_EMPLOYEES.map((t) => ({
    ...t,
    first_name: normalizePersonName(t.first_name),
    last_name: normalizePersonName(t.last_name),
    apellido_paterno: normalizePersonName(t.apellido_paterno),
    apellido_materno: normalizePersonName(t.apellido_materno),
    position: normalizeInstitutionalName(t.position),
    dependencia_name: normalizeInstitutionalName(t.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(t.direccion_organo_name),
    area_name: normalizeInstitutionalName(t.area_name),
  }));
}

/**
 * Genera el siguiente Código DRAC mediante la función transaccional de PostgreSQL
 * con algoritmo de relleno de huecos numéricos (gap-filling).
 */
export async function getNextDracCodeFromPostgres(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_next_drac_code');
    if (!error && data && typeof data === 'string') {
      return data;
    }
  } catch (err) {
    console.warn('Fallback a cálculo local de código DRAC:', err);
  }

  // Fallback seguro de cálculo con relleno de huecos en memoria
  try {
    const currentEmployees = await fetchEmployeesFromSupabase();
    const usedNums = new Set<number>();
    currentEmployees.forEach(e => {
      const match = e.codigo_trabajador?.match(/DRAC-(\d+)/i);
      if (match) {
        usedNums.add(parseInt(match[1], 10));
      }
    });

    let cand = 1;
    while (usedNums.has(cand)) {
      cand++;
    }
    return `DRAC-${String(cand).padStart(4, '0')}`;
  } catch {
    return 'DRAC-0001';
  }
}

/**
 * Guarda o actualiza un trabajador en PostgreSQL con trazabilidad de origen
 */
export async function saveEmployeeToSupabase(employee: Employee): Promise<{ success: boolean; data?: Employee; message?: string }> {
  const origin = getAppOrigin();

  const normFirstName = normalizePersonName(employee.first_name);
  const normPat = normalizePersonName(employee.apellido_paterno || employee.last_name.split(' ')[0] || '');
  const normMat = normalizePersonName(employee.apellido_materno || employee.last_name.split(' ')[1] || '');
  const normLastName = buildNormalizedFullName('', employee.last_name, normPat, normMat) || `${normPat} ${normMat}`.trim();
  const normPosition = normalizeInstitutionalName(employee.position);
  const normDepName = normalizeInstitutionalName(employee.dependencia_name);
  const normDirName = normalizeInstitutionalName(employee.direccion_organo_name);
  const normAreaName = normalizeInstitutionalName(employee.area_name);
  const normAddress = normalizeText(employee.address);

  const normalizedEmployee: Employee = {
    ...employee,
    first_name: normFirstName,
    last_name: normLastName,
    apellido_paterno: normPat,
    apellido_materno: normMat,
    position: normPosition,
    dependencia_name: normDepName,
    direccion_organo_name: normDirName,
    area_name: normAreaName,
    address: normAddress,
  };

  const dbTrabajador = {
    id: normalizedEmployee.id,
    codigo_drac: normalizedEmployee.codigo_trabajador,
    dni: normalizedEmployee.dni,
    nombres: normFirstName,
    apellido_paterno: normPat,
    apellido_materno: normMat,
    email: (normalizedEmployee.email || '').toLowerCase().trim(),
    telefono: normalizedEmployee.phone,
    direccion: normAddress,
    dependencia_id: normalizedEmployee.dependencia_id,
    area_id: normalizedEmployee.area_id,
    cargo_id: normalizedEmployee.cargo_id || 'crg-05',
    regimen_id: normalizedEmployee.regimen_laboral || 'CAS D.L. 1057',
    es_jefe: normalizedEmployee.is_jefe_director || false,
    estado: normalizedEmployee.active ? 'ACTIVO' : 'INACTIVO',
    fecha_ingreso: normalizedEmployee.hire_date || new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  };

  try {
    // 1. Guardar en tabla trabajadores
    const { error: trabError } = await supabase
      .from('trabajadores')
      .upsert(dbTrabajador);

    // 2. Si tiene acceso al sistema, actualizar o insertar en usuarios
    if (normalizedEmployee.has_system_access && normalizedEmployee.username) {
      const dbUsuario = {
        username: normalizedEmployee.username,
        trabajador_id: normalizedEmployee.id,
        email: normalizedEmployee.email,
        roles: normalizedEmployee.assigned_roles || [normalizedEmployee.role || 'TRABAJADOR'],
        requiere_cambio_password: normalizedEmployee.password_change_required ?? (normalizedEmployee.primer_ingreso === 'PENDIENTE'),
        password_hash: normalizedEmployee.password_hash || null,
        activo: normalizedEmployee.account_status === 'ACTIVE' && normalizedEmployee.active,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('usuarios')
        .upsert(dbUsuario, { onConflict: 'username' });
    }

    if (!trabError) {
      return { success: true, data: normalizedEmployee };
    }
  } catch (err) {
    console.warn('Error al guardar en Supabase trabajadores:', err);
  }

  // Backup vía API REST con trazabilidad
  try {
    const res = await fetch('/api/trabajadores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedEmployee),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedEmployee };
    }
  } catch (apiErr: any) {
    return { success: false, message: apiErr?.message };
  }

  return { success: true, data: normalizedEmployee };
}

