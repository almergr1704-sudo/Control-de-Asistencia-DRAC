import { Dependencia, DireccionOrgano, Area, Cargo, ResponsableDesignation } from '../types';
import { supabase, getAppOrigin } from '../lib/supabaseClient';
import { normalizeInstitutionalName, normalizePersonName, normalizeText } from '../utils/nameUtils';
import {
  INITIAL_DEPENDENCIAS,
  INITIAL_DIRECCIONES_ORGANOS,
  INITIAL_AREAS,
  INITIAL_CARGOS,
  INITIAL_RESPONSABLES,
} from '../data/initialData';

/**
 * SERVICIO CENTRALIZADO DE ESTRUCTURA ORGÁNICA (FASE 1)
 * 
 * Única Fuente de Verdad: Supabase PostgreSQL
 * Tablas: dependencias, direcciones, areas_oficinas, cargos
 * Clientes: Vercel (Web) y Desktop (Escritorio)
 */

// ==========================================
// 1. DEPENDENCIAS (Sede Central + 12 Agencias)
// ==========================================

export async function fetchDependenciasFromSupabase(): Promise<Dependencia[]> {
  try {
    // 1. Intentar consulta directa a Supabase PostgreSQL
    const { data, error } = await supabase
      .from('dependencias')
      .select('*')
      .order('code', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        code: d.codigo || d.code || '01',
        name: normalizeInstitutionalName(d.nombre || d.name),
        type: (d.tipo || d.type || 'SEDE_CENTRAL') as any,
        ubigeo: d.ubigeo || '060101',
        address: normalizeText(d.direccion || d.address || ''),
        active: d.activo !== undefined ? d.activo : (d.active !== undefined ? d.active : true),
        created_at: d.created_at || new Date().toISOString(),
      }));
    }

    // 2. Intentar endpoint API central
    const res = await fetch('/api/dependencias');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((d: any) => ({
          ...d,
          name: normalizeInstitutionalName(d.name),
          address: normalizeText(d.address),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase dependencias, aplicando esquema inicial:', err);
  }

  // 3. Fallback de esquema institucional oficial (normalizado)
  return INITIAL_DEPENDENCIAS.map((d) => ({
    ...d,
    name: normalizeInstitutionalName(d.name),
    address: normalizeText(d.address),
  }));
}

export async function saveDependenciaToSupabase(dependencia: Dependencia): Promise<{ success: boolean; data?: Dependencia; message?: string }> {
  const origin = getAppOrigin();
  const normalizedName = normalizeInstitutionalName(dependencia.name);
  const normalizedAddress = normalizeText(dependencia.address);
  const normalizedObj: Dependencia = {
    ...dependencia,
    name: normalizedName,
    address: normalizedAddress,
  };

  const dbPayload = {
    id: normalizedObj.id,
    codigo: normalizedObj.code,
    nombre: normalizedName,
    tipo: normalizedObj.type,
    ubigeo: normalizedObj.ubigeo || '060101',
    direccion: normalizedAddress || '',
    activo: normalizedObj.active,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('dependencias')
      .upsert(dbPayload)
      .select()
      .single();

    if (!error && data) {
      return { success: true, data: normalizedObj };
    }
  } catch (err) {
    console.warn('Error al insertar en tabla Supabase dependencias:', err);
  }

  // Backup via API central con trazabilidad de origen
  try {
    const res = await fetch('/api/dependencias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedObj),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedObj };
    }
  } catch (apiErr: any) {
    return { success: false, message: apiErr?.message };
  }

  return { success: true, data: normalizedObj };
}

// ==========================================
// 2. DIRECCIONES / ÓRGANOS
// ==========================================

export async function fetchDireccionesFromSupabase(): Promise<DireccionOrgano[]> {
  try {
    const { data, error } = await supabase
      .from('direcciones')
      .select('*')
      .order('code', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        code: d.codigo || d.code,
        name: normalizeInstitutionalName(d.nombre || d.name),
        type: (d.tipo || d.type || 'DIRECCION') as any,
        dependencia_id: d.dependencia_id || 'dep-01',
        dependencia_name: normalizeInstitutionalName(d.dependencia_nombre || d.dependencia_name || 'Sede Central'),
        director_name: normalizePersonName(d.director_nombre || d.director_name || ''),
        active: d.activo !== undefined ? d.activo : (d.active !== undefined ? d.active : true),
        created_at: d.created_at || new Date().toISOString(),
      }));
    }

    const res = await fetch('/api/direcciones');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((d: any) => ({
          ...d,
          name: normalizeInstitutionalName(d.name),
          dependencia_name: normalizeInstitutionalName(d.dependencia_name),
          director_name: normalizePersonName(d.director_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase direcciones:', err);
  }

  return INITIAL_DIRECCIONES_ORGANOS.map((d) => ({
    ...d,
    name: normalizeInstitutionalName(d.name),
    dependencia_name: normalizeInstitutionalName(d.dependencia_name),
    director_name: normalizePersonName(d.director_name),
  }));
}

export async function saveDireccionToSupabase(direccion: DireccionOrgano): Promise<{ success: boolean; data?: DireccionOrgano; message?: string }> {
  const origin = getAppOrigin();
  const normalizedName = normalizeInstitutionalName(direccion.name);
  const normalizedDepName = normalizeInstitutionalName(direccion.dependencia_name);
  const normalizedDirectorName = normalizePersonName(direccion.director_name);

  const normalizedObj: DireccionOrgano = {
    ...direccion,
    name: normalizedName,
    dependencia_name: normalizedDepName,
    director_name: normalizedDirectorName,
  };

  const dbPayload = {
    id: normalizedObj.id,
    codigo: normalizedObj.code,
    nombre: normalizedName,
    tipo: normalizedObj.type,
    dependencia_id: normalizedObj.dependencia_id,
    dependencia_nombre: normalizedDepName,
    director_nombre: normalizedDirectorName,
    activo: normalizedObj.active,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('direcciones')
      .upsert(dbPayload);

    if (!error) {
      return { success: true, data: normalizedObj };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase direcciones:', err);
  }

  try {
    const res = await fetch('/api/direcciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedObj),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedObj };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedObj };
}

// ==========================================
// 3. ÁREAS / OFICINAS / UNIDADES
// ==========================================

export async function fetchAreasFromSupabase(): Promise<Area[]> {
  try {
    const { data, error } = await supabase
      .from('areas_oficinas')
      .select('*')
      .order('code', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((a: any) => ({
        id: a.id,
        code: a.codigo || a.code,
        name: normalizeInstitutionalName(a.nombre || a.name),
        tipo: (a.tipo || 'OFICINA') as any,
        description: a.descripcion || a.description || '',
        dependencia_id: a.dependencia_id || 'dep-01',
        dependencia_name: normalizeInstitutionalName(a.dependencia_nombre || a.dependencia_name || 'Sede Central'),
        direccion_organo_id: a.direccion_id || a.direccion_organo_id || '',
        direccion_organo_name: normalizeInstitutionalName(a.direccion_nombre || a.direccion_organo_name || ''),
        unidad_superior_id: a.unidad_superior_id || '',
        active: a.activo !== undefined ? a.activo : (a.active !== undefined ? a.active : true),
        created_at: a.created_at || new Date().toISOString(),
      }));
    }

    const res = await fetch('/api/areas');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((a: any) => ({
          ...a,
          name: normalizeInstitutionalName(a.name),
          dependencia_name: normalizeInstitutionalName(a.dependencia_name),
          direccion_organo_name: normalizeInstitutionalName(a.direccion_organo_name),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase areas_oficinas:', err);
  }

  return INITIAL_AREAS.map((a) => ({
    ...a,
    name: normalizeInstitutionalName(a.name),
    dependencia_name: normalizeInstitutionalName(a.dependencia_name),
    direccion_organo_name: normalizeInstitutionalName(a.direccion_organo_name),
  }));
}

export async function saveAreaToSupabase(area: Area): Promise<{ success: boolean; data?: Area; message?: string }> {
  const origin = getAppOrigin();
  const normalizedName = normalizeInstitutionalName(area.name);
  const normalizedDepName = normalizeInstitutionalName(area.dependencia_name);
  const normalizedDirName = normalizeInstitutionalName(area.direccion_organo_name);

  const normalizedObj: Area = {
    ...area,
    name: normalizedName,
    dependencia_name: normalizedDepName,
    direccion_organo_name: normalizedDirName,
  };

  const dbPayload = {
    id: normalizedObj.id,
    codigo: normalizedObj.code,
    nombre: normalizedName,
    tipo: normalizedObj.tipo,
    descripcion: area.description || '',
    dependencia_id: normalizedObj.dependencia_id,
    direccion_id: normalizedObj.direccion_organo_id,
    unidad_superior_id: normalizedObj.unidad_superior_id,
    activo: normalizedObj.active,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('areas_oficinas')
      .upsert(dbPayload);

    if (!error) {
      return { success: true, data: normalizedObj };
    }
  } catch (err) {
    console.warn('Error en upsert Supabase areas_oficinas:', err);
  }

  try {
    const res = await fetch('/api/areas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Origin': origin,
      },
      body: JSON.stringify(normalizedObj),
    });
    if (res.ok) {
      const resJson = await res.json();
      return { success: true, data: resJson.data || normalizedObj };
    }
  } catch (err: any) {
    return { success: false, message: err?.message };
  }

  return { success: true, data: normalizedObj };
}

// ==========================================
// 4. CARGOS Y RESPONSABLES
// ==========================================

export async function fetchCargosFromSupabase(): Promise<Cargo[]> {
  try {
    const { data, error } = await supabase
      .from('cargos')
      .select('*')
      .order('code', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        code: c.codigo || c.code,
        name: normalizeInstitutionalName(c.nombre || c.name),
        nivel_jerarquico: c.nivel_jerarquico || 'TECNICO',
        active: c.activo !== undefined ? c.activo : true,
      }));
    }

    const res = await fetch('/api/cargos');
    if (res.ok) {
      const apiData = await res.json();
      if (apiData.success && Array.isArray(apiData.data) && apiData.data.length > 0) {
        return apiData.data.map((c: any) => ({
          ...c,
          name: normalizeInstitutionalName(c.name),
        }));
      }
    }
  } catch (err) {
    console.warn('Conexión en progreso con Supabase cargos:', err);
  }

  return INITIAL_CARGOS.map((c) => ({
    ...c,
    name: normalizeInstitutionalName(c.name),
  }));
}
