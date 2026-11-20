import {
  BiometricDeviceUser,
  DeviceUserChangeLog,
  DeviceUserLinkStatus,
  DeviceUserSourceMethod,
  DeviceUserSourceScope,
  DeviceUserSyncRun,
  Employee,
} from '../types';
import { normalizePersonName, normalizeText } from './nameUtils';

export interface RawClockUserInput {
  pin: string;
  uid?: number | null;
  clock_name?: string | null;
  clock_employee_code?: string | null;
  card_number?: string | null;
  privilege_code?: number | null;
  privilege_label?: string | null;
  clock_status?: string | null;
  has_password?: boolean | null;
  clock_updated_at?: string | null;
  source_method: DeviceUserSourceMethod;
  source_scope: DeviceUserSourceScope;
  available_fields?: string[];
  raw_attributes?: Record<string, any>;
}

export interface ReconcileParams {
  existingUsers: BiometricDeviceUser[];
  fetchedUsers: RawClockUserInput[];
  employees: Employee[];
  deviceId: string;
  deviceSn: string;
  deviceName: string;
  deviceIp?: string;
  method: DeviceUserSourceMethod;
  sourceScope: DeviceUserSourceScope;
  executedBy: string;
  executedRole?: string;
  message?: string;
}

export interface ReconcileResult {
  mergedUsers: BiometricDeviceUser[];
  newLogs: DeviceUserChangeLog[];
  syncRun: DeviceUserSyncRun;
}

export function buildDeviceUserId(deviceSn: string, pin: string): string {
  return `${String(deviceSn || '').trim().toUpperCase()}__${String(pin || '').trim()}`;
}

export function normalizePrivilegeLabel(code?: number | null, fallback?: string | null): string | null {
  if (fallback && String(fallback).trim()) return String(fallback).trim();
  if (code === undefined || code === null || Number.isNaN(Number(code))) return null;
  const num = Number(code);
  if (num === 0) return 'Usuario';
  if (num === 2) return 'Registrador';
  if (num === 6) return 'Administrador';
  if (num === 14) return 'Super Administrador';
  return `Privilegio ${num}`;
}

export function detectAvailableFields(u: RawClockUserInput): string[] {
  if (Array.isArray(u.available_fields) && u.available_fields.length > 0) {
    return Array.from(new Set(u.available_fields));
  }
  const fields: string[] = ['pin'];
  if (u.uid !== undefined && u.uid !== null) fields.push('uid');
  if (u.clock_name && String(u.clock_name).trim()) fields.push('clock_name');
  if (u.clock_employee_code && String(u.clock_employee_code).trim()) fields.push('clock_employee_code');
  if (u.card_number && String(u.card_number).trim() && String(u.card_number).trim() !== '0') fields.push('card_number');
  if (u.privilege_code !== undefined && u.privilege_code !== null) fields.push('privilege');
  if (u.clock_status && String(u.clock_status).trim()) fields.push('clock_status');
  if (u.clock_updated_at && String(u.clock_updated_at).trim()) fields.push('clock_updated_at');
  if (u.has_password !== undefined && u.has_password !== null) fields.push('has_password');
  return fields;
}

/**
 * Clasifica el estado de vinculación institucional SIN auto-vincular por nombre difuso
 * ni sobrescribir vinculaciones manuales existentes.
 */
export function classifyDeviceUserBinding(
  record: Pick<
    BiometricDeviceUser,
    | 'device_sn'
    | 'pin'
    | 'clock_name'
    | 'clock_employee_code'
    | 'clock_status'
    | 'employee_id'
    | 'link_type'
    | 'unlinked_at'
  >,
  employees: Employee[],
  allDeviceUsers: BiometricDeviceUser[] = []
): {
  link_status: DeviceUserLinkStatus;
  matchedEmployee: Employee | null;
  candidateEmployee: Employee | null;
  candidateReason: string | null;
  conflictReason: string | null;
} {
  const cleanPin = String(record.pin || '').trim();
  const cleanSn = String(record.device_sn || '').trim().toUpperCase();
  const clockStatusUpper = String(record.clock_status || '').trim().toUpperCase();
  const isClockInactive =
    clockStatusUpper === 'INACTIVO' ||
    clockStatusUpper === 'INACTIVE' ||
    clockStatusUpper === 'DISABLED' ||
    clockStatusUpper === '0';

  // 1. Si ya tiene vinculación institucional explícita hacia un trabajador existente
  if (record.employee_id) {
    const linkedEmp = employees.find((e) => e.id === record.employee_id) || null;
    if (!linkedEmp) {
      return {
        link_status: 'REVISAR',
        matchedEmployee: null,
        candidateEmployee: null,
        candidateReason: null,
        conflictReason: `El trabajador vinculado (${record.employee_id}) ya no existe en el padrón institucional.`,
      };
    }

    // Verificar si otro PIN distinto del MISMO reloj apunta al mismo trabajador (duplicidad de huella/PIN)
    const duplicateSameDevice = allDeviceUsers.find(
      (other) =>
        other.device_sn === cleanSn &&
        other.pin !== cleanPin &&
        other.employee_id === linkedEmp.id
    );
    if (duplicateSameDevice) {
      return {
        link_status: 'REVISAR',
        matchedEmployee: linkedEmp,
        candidateEmployee: null,
        candidateReason: null,
        conflictReason: `Trabajador vinculado también al PIN ${duplicateSameDevice.pin} en el mismo reloj (${cleanSn}).`,
      };
    }

    if (isClockInactive) {
      return {
        link_status: 'INACTIVO',
        matchedEmployee: linkedEmp,
        candidateEmployee: null,
        candidateReason: null,
        conflictReason: null,
      };
    }

    return {
      link_status: record.link_type === 'REGISTRADO' ? 'REGISTRADO' : 'VINCULADO',
      matchedEmployee: linkedEmp,
      candidateEmployee: null,
      candidateReason: null,
      conflictReason: null,
    };
  }

  // 2. Si el dispositivo reportó explícitamente estado INACTIVO y no tiene vinculación
  if (isClockInactive) {
    return {
      link_status: 'INACTIVO',
      matchedEmployee: null,
      candidateEmployee: null,
      candidateReason: null,
      conflictReason: null,
    };
  }

  // 3. Buscar posibles coincidencias institucionales SIN vincular automáticamente
  //    (por PIN en trabajador, DNI igual a PIN, código DRAC o coincidencia nominal)
  const pinMatches = employees.filter(
    (e) =>
      String(e.zkteco_pin || '').trim() === cleanPin ||
      String(e.biometric_user_id || '').trim() === cleanPin ||
      String(e.dni || '').trim() === cleanPin ||
      String(e.codigo_trabajador || '').trim() === cleanPin ||
      (record.clock_employee_code &&
        (String(e.codigo_trabajador || '').trim() === String(record.clock_employee_code).trim() ||
          String(e.dni || '').trim() === String(record.clock_employee_code).trim()))
  );

  if (pinMatches.length > 1) {
    return {
      link_status: 'REVISAR',
      matchedEmployee: null,
      candidateEmployee: pinMatches[0],
      candidateReason: `Múltiples trabajadores (${pinMatches.length}) comparten referencia con PIN/código "${cleanPin}".`,
      conflictReason: `Ambigüedad en el padrón: ${pinMatches.map((m) => `${m.dni} (${m.first_name} ${m.last_name})`).join(', ')}.`,
    };
  }

  if (pinMatches.length === 1 && !record.unlinked_at) {
    const cand = pinMatches[0];
    const matchField =
      String(cand.dni || '').trim() === cleanPin
        ? 'DNI coincidente con PIN del reloj'
        : String(cand.zkteco_pin || '').trim() === cleanPin || String(cand.biometric_user_id || '').trim() === cleanPin
        ? 'PIN biométrico ya registrado en ficha de trabajador'
        : 'Código institucional coincidente';
    return {
      link_status: 'POSIBLE_COINCIDENCIA',
      matchedEmployee: null,
      candidateEmployee: cand,
      candidateReason: matchField,
      conflictReason: null,
    };
  }

  // Coincidencia textual de nombre registrado en el reloj contra padrón (solo sugerencia, nunca vinculación automática)
  const normClockName = normalizeText(record.clock_name || '');
  if (normClockName && normClockName.length >= 4 && !/^usuario\s+\d+$/i.test(normClockName) && !record.unlinked_at) {
    const tokens = normClockName.split(/\s+/).filter((t) => t.length >= 3);
    if (tokens.length >= 1) {
      const nameCandidates = employees.filter((e) => {
        const fullNorm = normalizeText(`${e.first_name || ''} ${e.last_name || ''}`);
        const revNorm = normalizeText(`${e.last_name || ''} ${e.first_name || ''}`);
        if (fullNorm === normClockName || revNorm === normClockName) return true;
        return tokens.length >= 2 && tokens.every((tk) => fullNorm.includes(tk));
      });
      if (nameCandidates.length === 1) {
        return {
          link_status: 'POSIBLE_COINCIDENCIA',
          matchedEmployee: null,
          candidateEmployee: nameCandidates[0],
          candidateReason: 'Nombre en reloj similar al padrón institucional (requiere confirmación)',
          conflictReason: null,
        };
      }
      if (nameCandidates.length > 1) {
        return {
          link_status: 'REVISAR',
          matchedEmployee: null,
          candidateEmployee: nameCandidates[0],
          candidateReason: `${nameCandidates.length} posibles homónimos en el padrón para "${record.clock_name}".`,
          conflictReason: `Homónimos o ambigüedad nominal para "${record.clock_name}".`,
        };
      }
    }
  }

  return {
    link_status: 'PENDIENTE_VINCULACION',
    matchedEmployee: null,
    candidateEmployee: null,
    candidateReason: null,
    conflictReason: null,
  };
}

/**
 * Reconciliación idempotente de usuarios obtenidos desde reloj o BioTime PRO
 * contra el almacén persistido:
 *   - No genera duplicados por (device_sn, pin)
 *   - No sobrescribe vinculaciones institucionales existentes
 *   - No modifica nombres institucionales
 *   - Marca present_on_device=false sin borrar historial cuando ya no figura en el reloj
 */
export function reconcileDeviceUsers(params: ReconcileParams): ReconcileResult {
  const {
    existingUsers,
    fetchedUsers,
    employees,
    deviceId,
    deviceSn,
    deviceName,
    deviceIp,
    method,
    sourceScope,
    executedBy,
    executedRole = 'ADMIN_GENERAL',
    message = 'Consulta completada.',
  } = params;

  const cleanSn = String(deviceSn || 'AEH2223460040').trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const map = new Map<string, BiometricDeviceUser>();

  for (const u of existingUsers) {
    if (!u || !u.pin) continue;
    const key = buildDeviceUserId(u.device_sn || cleanSn, u.pin);
    map.set(key, { ...u, id: u.id || key });
  }

  const fetchedKeys = new Set<string>();
  const newLogs: DeviceUserChangeLog[] = [];
  const capabilitiesSet = new Set<string>();
  const newUserIds: string[] = [];

  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let missingCount = 0;
  let reappearedCount = 0;

  for (const raw of fetchedUsers) {
    const cleanPin = String(raw.pin || '').trim();
    if (!cleanPin) continue;

    const id = buildDeviceUserId(cleanSn, cleanPin);
    if (fetchedKeys.has(id)) continue; // Evitar duplicados dentro del mismo lote
    fetchedKeys.add(id);

    const availableFields = detectAvailableFields(raw);
    availableFields.forEach((f) => capabilitiesSet.add(f));

    const prev = map.get(id);
    const privLabel = normalizePrivilegeLabel(raw.privilege_code, raw.privilege_label);
    const incomingClockName = raw.clock_name !== undefined && raw.clock_name !== null ? String(raw.clock_name).trim() || null : null;
    const incomingEmpCode = raw.clock_employee_code ? String(raw.clock_employee_code).trim() : null;
    const incomingCard = raw.card_number && String(raw.card_number).trim() !== '0' ? String(raw.card_number).trim() : null;
    const incomingStatus = raw.clock_status ? String(raw.clock_status).trim() : null;

    if (!prev) {
      newCount++;
      newUserIds.push(id);
      const draft: BiometricDeviceUser = {
        id,
        device_id: deviceId || 'dev-01',
        device_sn: cleanSn,
        device_name: deviceName || cleanSn,
        device_ip: deviceIp || undefined,
        pin: cleanPin,
        uid: raw.uid ?? null,
        clock_name: incomingClockName,
        clock_employee_code: incomingEmpCode,
        card_number: incomingCard,
        privilege_code: raw.privilege_code ?? null,
        privilege_label: privLabel,
        clock_status: incomingStatus,
        has_password: raw.has_password ?? null,
        clock_updated_at: raw.clock_updated_at || null,
        source_method: raw.source_method || method,
        source_scope: raw.source_scope || sourceScope,
        available_fields: availableFields,
        raw_attributes: raw.raw_attributes || {},
        present_on_device: true,
        first_seen_at: nowIso,
        last_queried_at: nowIso,
        last_clock_updated_at: nowIso,
        missing_since_at: null,
        link_status: 'PENDIENTE_VINCULACION',
        employee_id: null,
        updated_at: nowIso,
      };
      map.set(id, draft);
      newLogs.push({
        id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        device_user_id: id,
        device_sn: cleanSn,
        pin: cleanPin,
        event_type: 'DISCOVERED',
        new_values: {
          clock_name: draft.clock_name,
          uid: draft.uid,
          card_number: draft.card_number,
          privilege_label: draft.privilege_label,
          source_method: draft.source_method,
          source_scope: draft.source_scope,
        },
        observation: `Usuario detectado por primera vez vía ${draft.source_method} (${draft.source_scope}).`,
        operator_name: executedBy,
        operator_role: executedRole,
        created_at: nowIso,
      });
    } else {
      const clockChangedFields: Record<string, { before: any; after: any }> = {};
      if ((prev.clock_name || null) !== incomingClockName) {
        clockChangedFields.clock_name = { before: prev.clock_name || null, after: incomingClockName };
      }
      if ((prev.uid ?? null) !== (raw.uid ?? null)) {
        clockChangedFields.uid = { before: prev.uid ?? null, after: raw.uid ?? null };
      }
      if ((prev.card_number || null) !== incomingCard) {
        clockChangedFields.card_number = { before: prev.card_number || null, after: incomingCard };
      }
      if ((prev.privilege_code ?? null) !== (raw.privilege_code ?? null)) {
        clockChangedFields.privilege_code = { before: prev.privilege_code ?? null, after: raw.privilege_code ?? null };
      }
      if ((prev.clock_status || null) !== incomingStatus) {
        clockChangedFields.clock_status = { before: prev.clock_status || null, after: incomingStatus };
      }
      if ((prev.clock_employee_code || null) !== incomingEmpCode) {
        clockChangedFields.clock_employee_code = { before: prev.clock_employee_code || null, after: incomingEmpCode };
      }

      const wasMissing = prev.present_on_device === false;
      const hasChanges = Object.keys(clockChangedFields).length > 0;

      if (wasMissing) {
        reappearedCount++;
        newLogs.push({
          id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          device_user_id: id,
          device_sn: cleanSn,
          pin: cleanPin,
          event_type: 'REAPPEARED',
          observation: `Usuario volvió a aparecer en la lectura del reloj (${cleanSn}).`,
          operator_name: executedBy,
          operator_role: executedRole,
          created_at: nowIso,
        });
      }

      if (hasChanges) {
        updatedCount++;
        newLogs.push({
          id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          device_user_id: id,
          device_sn: cleanSn,
          pin: cleanPin,
          event_type: 'CLOCK_DATA_UPDATED',
          previous_values: Object.fromEntries(Object.entries(clockChangedFields).map(([k, v]) => [k, v.before])),
          new_values: Object.fromEntries(Object.entries(clockChangedFields).map(([k, v]) => [k, v.after])),
          observation: `Cambios detectados en datos originales del reloj: ${Object.keys(clockChangedFields).join(', ')}.`,
          operator_name: executedBy,
          operator_role: executedRole,
          created_at: nowIso,
        });
      } else if (!wasMissing) {
        unchangedCount++;
      }

      // Actualizar SOLO datos de origen del reloj, manteniendo intacta la vinculación institucional
      map.set(id, {
        ...prev,
        device_id: deviceId || prev.device_id,
        device_name: deviceName || prev.device_name,
        device_ip: deviceIp || prev.device_ip,
        uid: raw.uid ?? prev.uid ?? null,
        clock_name: incomingClockName,
        clock_employee_code: incomingEmpCode,
        card_number: incomingCard,
        privilege_code: raw.privilege_code ?? prev.privilege_code ?? null,
        privilege_label: privLabel,
        clock_status: incomingStatus,
        has_password: raw.has_password ?? prev.has_password ?? null,
        clock_updated_at: raw.clock_updated_at || prev.clock_updated_at || null,
        source_method: raw.source_method || method,
        source_scope: raw.source_scope || sourceScope,
        available_fields: availableFields,
        raw_attributes: raw.raw_attributes || prev.raw_attributes || {},
        present_on_device: true,
        last_queried_at: nowIso,
        last_clock_updated_at: hasChanges ? nowIso : prev.last_clock_updated_at || prev.last_queried_at,
        missing_since_at: null,
        updated_at: nowIso,
      });
    }
  }

  // Identificar usuarios que pertenecían a este dispositivo (SN) y ya no aparecieron en esta consulta real
  // NUNCA eliminarlos del historial ni borrar su vinculación
  if (fetchedUsers.length > 0 || sourceScope === 'DIRECT_CLOCK') {
    for (const [key, u] of map.entries()) {
      if (u.device_sn === cleanSn && !fetchedKeys.has(key)) {
        if (u.present_on_device) {
          missingCount++;
          map.set(key, {
            ...u,
            present_on_device: false,
            missing_since_at: nowIso,
            last_queried_at: nowIso,
            updated_at: nowIso,
          });
          newLogs.push({
            id: `du_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            device_user_id: u.id,
            device_sn: cleanSn,
            pin: u.pin,
            event_type: 'MARKED_MISSING',
            observation: `El PIN ${u.pin} ya no figura en la lectura actual del dispositivo ${cleanSn}; se conserva en el historial.`,
            operator_name: executedBy,
            operator_role: executedRole,
            created_at: nowIso,
          });
        }
      }
    }
  }

  // Re-evaluar estados de vinculación (VINCULADO / PENDIENTE / POSIBLE_COINCIDENCIA / REVISAR / INACTIVO)
  const snapshotList = Array.from(map.values());
  const finalUsers = snapshotList.map((u) => {
    const evalRes = classifyDeviceUserBinding(u, employees, snapshotList);
    const emp = evalRes.matchedEmployee;
    const cand = evalRes.candidateEmployee;
    return {
      ...u,
      link_status: evalRes.link_status,
      employee_codigo_drac: emp?.codigo_trabajador || u.employee_codigo_drac || null,
      employee_dni: emp?.dni || u.employee_dni || null,
      employee_full_name: emp ? normalizePersonName(`${emp.first_name} ${emp.last_name}`) : u.employee_full_name || null,
      employee_dependencia_name: emp?.dependencia_name || u.employee_dependencia_name || null,
      employee_area_name: emp?.area_name || u.employee_area_name || null,
      employee_cargo_name: emp?.position || (emp as any)?.cargo || (emp as any)?.cargo_name || u.employee_cargo_name || null,
      candidate_employee_id: !emp && cand ? cand.id : null,
      candidate_employee_name: !emp && cand ? normalizePersonName(`${cand.first_name} ${cand.last_name}`) : null,
      candidate_employee_dni: !emp && cand ? cand.dni : null,
      candidate_employee_code: !emp && cand ? cand.codigo_trabajador : null,
      candidate_reason: !emp ? evalRes.candidateReason : null,
      conflict_reason: evalRes.conflictReason,
    };
  });

  const deviceScoped = finalUsers.filter((u) => u.device_sn === cleanSn);
  const syncRun: DeviceUserSyncRun = {
    id: `du_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    device_id: deviceId || 'dev-01',
    device_sn: cleanSn,
    device_name: deviceName || cleanSn,
    method,
    source_scope: sourceScope,
    success: true,
    message,
    total_fetched: fetchedKeys.size,
    new_users: newCount,
    new_user_ids: newUserIds,
    updated_users: updatedCount,
    unchanged_users: unchangedCount,
    missing_users: missingCount,
    reappeared_users: reappearedCount,
    linked_count: deviceScoped.filter((u) => u.link_status === 'VINCULADO' || u.link_status === 'REGISTRADO').length,
    pending_count: deviceScoped.filter((u) => u.link_status === 'PENDIENTE_VINCULACION').length,
    possible_match_count: deviceScoped.filter((u) => u.link_status === 'POSIBLE_COINCIDENCIA').length,
    review_count: deviceScoped.filter((u) => u.link_status === 'REVISAR').length,
    detected_capabilities: Array.from(capabilitiesSet),
    executed_by: executedBy,
    created_at: nowIso,
  };

  finalUsers.sort((a, b) => {
    const snCmp = a.device_sn.localeCompare(b.device_sn);
    if (snCmp !== 0) return snCmp;
    const nA = Number(a.pin);
    const nB = Number(b.pin);
    if (!Number.isNaN(nA) && !Number.isNaN(nB)) return nA - nB;
    return a.pin.localeCompare(b.pin);
  });

  return { mergedUsers: finalUsers, newLogs, syncRun };
}

/**
 * Resuelve trabajador institucional para una marcación real usando:
 *  1) Vinculación explícita (device_sn, pin) en Usuarios Registrados en Relojes
 *  2) Fallback estricto en employees únicamente cuando hay coincidencia inequívoca (1 solo trabajador)
 */
export function resolveEmployeeForDevicePin(
  employees: Employee[],
  deviceUsers: BiometricDeviceUser[],
  deviceSn: string,
  pin: string
): { employee: Employee | null; ambiguous: boolean; reason?: string } {
  const cleanSn = String(deviceSn || '').trim().toUpperCase();
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) return { employee: null, ambiguous: false };

  // 1. Buscar primero relación específica (device_sn, pin)
  const deviceBinding = deviceUsers.find(
    (u) => String(u.device_sn || '').trim().toUpperCase() === cleanSn && String(u.pin || '').trim() === cleanPin
  );

  if (deviceBinding) {
    if (deviceBinding.employee_id) {
      const boundEmp = employees.find((e) => e.id === deviceBinding.employee_id) || null;
      if (boundEmp) return { employee: boundEmp, ambiguous: false };
    }
    // Si fue explícitamente desvinculado o marcado para revisión, NO auto-asociar por heurística
    if (deviceBinding.unlinked_at || deviceBinding.link_status === 'REVISAR') {
      return {
        employee: null,
        ambiguous: deviceBinding.link_status === 'REVISAR',
        reason: deviceBinding.conflict_reason || 'Usuario desvinculado o pendiente de revisión.',
      };
    }
  }

  // 2. Fallback estricto solo cuando un único trabajador activo coincide por PIN/DNI/Código
  const matches = employees.filter(
    (e) =>
      String(e.zkteco_pin || '').trim() === cleanPin ||
      String(e.biometric_user_id || '').trim() === cleanPin ||
      String(e.dni || '').trim() === cleanPin ||
      String(e.codigo_trabajador || '').trim() === cleanPin
  );

  if (matches.length === 1) {
    return { employee: matches[0], ambiguous: false };
  }

  if (matches.length > 1) {
    return {
      employee: null,
      ambiguous: true,
      reason: `Múltiples trabajadores (${matches.length}) coinciden con el código ${cleanPin}. Vincule por dispositivo.`,
    };
  }

  return { employee: null, ambiguous: false };
}
