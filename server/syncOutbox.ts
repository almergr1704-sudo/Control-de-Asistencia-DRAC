import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  StorageDirectories,
  resolveSafeChildPath,
  safeReadJson,
  safeWriteJsonAtomic,
} from './storageManager';
import { isPeriodClosed, type ClosedPeriodEntry } from './employeeProfileEnricher';

export type SyncEntityType =
  | 'trabajadores'
  | 'usuarios_reloj'
  | 'vinculaciones_usuario_reloj'
  | 'marcaciones_raw'
  | 'asistencias'
  | 'dispositivos_zkteco'
  | 'papeletas_salida'
  | 'vacaciones'
  | 'horarios'
  | 'turnos'
  | 'asignacion_horarios'
  | 'dependencias'
  | 'direcciones'
  | 'areas'
  | 'cargos'
  | 'responsables'
  | 'encargaturas'
  | 'closed_periods';

export type OutboxItemStatus = 'PENDIENTE' | 'SINCRONIZADO' | 'CONFLICTO';

export interface OutboxQueueItem {
  id: string;
  idempotency_key: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: 'UPSERT' | 'DELETE';
  payload: Record<string, any>;
  record_version: number;
  origin: 'DESKTOP' | 'WEB' | 'ZK_AGENT';
  status: OutboxItemStatus;
  attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface SyncStateCursor {
  last_push_at: string | null;
  last_pull_at: string | null;
  last_pull_counts: Record<string, number>;
  desktop_node_id: string;
  last_sync_error?: string | null;
  initial_push_done?: boolean;
}

export const ENTITY_FILE_MAP: Record<Exclude<SyncEntityType, 'vinculaciones_usuario_reloj'>, string> = {
  trabajadores: 'employees.json',
  usuarios_reloj: 'device-users.json',
  marcaciones_raw: 'raw-punches.json',
  asistencias: 'attendance.json',
  dispositivos_zkteco: 'devices.json',
  papeletas_salida: 'papeletas.json',
  vacaciones: 'vacaciones.json',
  horarios: 'horarios.json',
  turnos: 'turnos.json',
  asignacion_horarios: 'asignacion-horarios.json',
  dependencias: 'dependencias.json',
  direcciones: 'direcciones.json',
  areas: 'areas.json',
  cargos: 'cargos.json',
  responsables: 'responsables.json',
  encargaturas: 'encargaturas.json',
  closed_periods: 'closed-periods.json',
};

export function isPlaceholderSupabaseUrlServer(url: string): boolean {
  const clean = String(url || '').trim();
  return (
    !clean ||
    clean.includes('rfqgmoremevypexrrsyf.supabase.co') ||
    clean.includes('your-project-ref.supabase.co')
  );
}

export function getOutboxFilePath(dirs: StorageDirectories): string {
  return resolveSafeChildPath(dirs.syncDir, 'sync-outbox.json');
}

export function getSyncStateFilePath(dirs: StorageDirectories): string {
  return resolveSafeChildPath(dirs.syncDir, 'sync-state.json');
}

export function readOutboxQueue(dirs: StorageDirectories): OutboxQueueItem[] {
  return safeReadJson<OutboxQueueItem[]>(getOutboxFilePath(dirs), []);
}

export function readSyncState(dirs: StorageDirectories): SyncStateCursor {
  return safeReadJson<SyncStateCursor>(getSyncStateFilePath(dirs), {
    last_push_at: null,
    last_pull_at: null,
    last_pull_counts: {},
    desktop_node_id: 'drac-node-default',
    last_sync_error: null,
    initial_push_done: false,
  });
}

function defaultOrigin(): 'DESKTOP' | 'WEB' {
  return process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB';
}

export function enqueueOutboxEvent(
  dirs: StorageDirectories,
  input: {
    entity_type: SyncEntityType;
    entity_id: string;
    operation: 'UPSERT' | 'DELETE';
    payload: Record<string, any>;
    record_version?: number;
    origin?: 'DESKTOP' | 'WEB' | 'ZK_AGENT';
  }
): OutboxQueueItem {
  const outbox = readOutboxQueue(dirs);
  const nowIso = new Date().toISOString();
  const uuid = crypto.randomUUID();
  const nextVersion = Number(input.record_version ?? input.payload?.record_version) || 1;

  // Deduplicación idempotente cuando ya existe un evento PENDIENTE para la misma entidad/operación
  const pendingIdx = outbox.findIndex(
    (item) =>
      item.status === 'PENDIENTE' &&
      item.entity_type === input.entity_type &&
      item.entity_id === input.entity_id &&
      item.operation === input.operation
  );

  const item: OutboxQueueItem = {
    id: uuid,
    idempotency_key: `${input.entity_type}:${input.entity_id}:${input.operation}:${uuid}`,
    entity_type: input.entity_type,
    entity_id: String(input.entity_id),
    operation: input.operation,
    payload: {
      ...input.payload,
      record_version: nextVersion,
      updated_at: input.payload?.updated_at || nowIso,
    },
    record_version: nextVersion,
    origin: input.origin || defaultOrigin(),
    status: 'PENDIENTE',
    attempts: pendingIdx >= 0 ? outbox[pendingIdx].attempts : 0,
    last_attempt_at: null,
    last_error: null,
    created_at: pendingIdx >= 0 ? outbox[pendingIdx].created_at : nowIso,
    synced_at: null,
  };

  if (pendingIdx >= 0) {
    outbox[pendingIdx] = item;
  } else {
    outbox.push(item);
  }

  // Nunca descarta ítems pendientes; solo poda historial ya SINCRONIZADO antiguo (> 500)
  const pendingItems = outbox.filter((x) => x.status !== 'SINCRONIZADO');
  const syncedItems = outbox.filter((x) => x.status === 'SINCRONIZADO').slice(-500);
  safeWriteJsonAtomic(getOutboxFilePath(dirs), [...syncedItems, ...pendingItems]);
  return item;
}

/**
 * Encola de forma segura todos los registros locales existentes para sincronización inicial/completa
 * hacia Supabase sin sobrescribir cambios pendientes ni duplicar entradas ya pendientes.
 */
export function enqueueAllLocalEntitiesToOutbox(
  dirs: StorageDirectories,
  options?: { forceAll?: boolean; origin?: 'DESKTOP' | 'WEB' | 'ZK_AGENT' }
): number {
  const origin = options?.origin || defaultOrigin();
  const outbox = readOutboxQueue(dirs);
  const existingKeys = new Set(
    options?.forceAll
      ? outbox.filter((x) => x.status === 'PENDIENTE').map((x) => `${x.entity_type}::${x.entity_id}`)
      : outbox.map((x) => `${x.entity_type}::${x.entity_id}`)
  );

  let enqueued = 0;
  const nowIso = new Date().toISOString();

  (Object.entries(ENTITY_FILE_MAP) as Array<[Exclude<SyncEntityType, 'vinculaciones_usuario_reloj'>, string]>).forEach(
    ([entityType, filename]) => {
      const fp = resolveSafeChildPath(dirs.dataDir, filename);
      const rows = safeReadJson<any[]>(fp, []);
      if (!Array.isArray(rows) || rows.length === 0) return;

      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const entityId = String(row.id || row.period || '').trim();
        if (!entityId) continue;
        const key = `${entityType}::${entityId}`;
        if (existingKeys.has(key)) continue;

        existingKeys.add(key);
        outbox.push({
          id: crypto.randomUUID(),
          idempotency_key: `${entityType}:${entityId}:UPSERT:snapshot-${Date.now()}-${enqueued}`,
          entity_type: entityType,
          entity_id: entityId,
          operation: 'UPSERT',
          payload: {
            ...row,
            record_version: Number(row.record_version) || 1,
            updated_at: row.updated_at || row.created_at || nowIso,
          },
          record_version: Number(row.record_version) || 1,
          origin,
          status: 'PENDIENTE',
          attempts: 0,
          last_attempt_at: null,
          last_error: null,
          created_at: nowIso,
          synced_at: null,
        });
        enqueued++;
      }
    }
  );

  if (enqueued > 0) {
    const pendingItems = outbox.filter((x) => x.status !== 'SINCRONIZADO');
    const syncedItems = outbox.filter((x) => x.status === 'SINCRONIZADO').slice(-500);
    safeWriteJsonAtomic(getOutboxFilePath(dirs), [...syncedItems, ...pendingItems]);
  }
  return enqueued;
}

function mapOutboxToRelationalTable(entityType: SyncEntityType): string | null {
  switch (entityType) {
    case 'trabajadores':
      return 'trabajadores';
    case 'marcaciones_raw':
      return 'marcaciones_raw';
    case 'asistencias':
      return 'asistencias';
    case 'dispositivos_zkteco':
      return 'dispositivos_zkteco';
    case 'usuarios_reloj':
      return 'usuarios_reloj';
    case 'vinculaciones_usuario_reloj':
      return 'vinculaciones_usuario_reloj';
    case 'papeletas_salida':
      return 'papeletas';
    case 'vacaciones':
      return 'vacaciones';
    case 'closed_periods':
      return 'closed_periods';
    default:
      return null;
  }
}

function buildRelationalPayload(item: OutboxQueueItem): Record<string, any> | null {
  const p = item.payload || {};
  const nowIso = new Date().toISOString();
  switch (item.entity_type) {
    case 'trabajadores':
      return {
        id: p.id,
        codigo_drac: p.codigo_trabajador || p.codigo_drac || `DRAC-${p.dni || p.id}`,
        dni: p.dni,
        nombres: p.first_name || p.nombres || 'Trabajador',
        apellido_paterno: p.apellido_paterno || '',
        apellido_materno: p.apellido_materno || '',
        email: p.email || null,
        telefono: p.phone || p.telefono || null,
        dependencia_id: p.dependencia_id || 'dep-01',
        area_id: p.area_id || null,
        cargo_id: p.cargo_id || null,
        regimen_id: null,
        es_jefe: Boolean(p.is_jefe_director),
        estado: p.active === false ? 'INACTIVO' : 'ACTIVO',
        fecha_ingreso: p.hire_date || p.fecha_ingreso || '2026-01-01',
        zkteco_pin: p.zkteco_pin || null,
        biometric_user_id: p.biometric_user_id || p.zkteco_pin || null,
        record_version: Number(p.record_version) || 1,
        updated_by_origin: item.origin,
        updated_at: p.updated_at || nowIso,
      };
    case 'marcaciones_raw':
      return {
        id: p.id,
        device_id: p.device_id || 'dev-01',
        device_sn: p.device_sn || 'AEH2223460040',
        device_name: p.device_name || 'ZKTeco G3 Sede Central',
        employee_id: p.employee_id || null,
        employee_dni: p.employee_dni || p.employee_code || '',
        employee_codigo_drac: p.employee_codigo_drac || null,
        employee_code: p.employee_code || p.employee_dni || '',
        employee_name: p.employee_name || 'Pendiente de Identificación',
        timestamp: p.timestamp,
        punch_type: p.punch_type || 'AUTO',
        punch_state: Number(p.punch_state ?? 0),
        verify_mode: p.verify_mode || 'FINGERPRINT',
        processed: Boolean(p.processed),
        validation_status: p.validation_status || 'VALIDA',
        source: p.source || 'DIRECT_READ',
        raw_payload: p.raw_payload || null,
        record_version: Number(p.record_version) || 1,
        updated_at: p.updated_at || nowIso,
      };
    case 'asistencias':
      return {
        id: p.id,
        trabajador_id: p.employee_id || p.trabajador_id,
        dni: p.employee_dni || p.dni || '',
        fecha: p.fecha,
        horario_id: p.horario_id || null,
        t1_ingreso: p.t1_real_in || null,
        t1_salida: p.t1_real_out || null,
        t2_ingreso: p.t2_real_in || null,
        t2_salida: p.t2_real_out || null,
        minutos_tardanza: Number(p.tardiness_minutes ?? p.total_tardiness_minutes ?? 0),
        minutos_tardanza_neto: Number(p.net_tardiness_minutes ?? 0),
        horas_efectivas: Number(p.total_effective_hours ?? 0),
        estado: p.status || 'PUNCTUAL',
        tiene_papeleta: Boolean(p.has_papeleta),
        es_dia_vacaciones: Boolean(p.is_vacation_day),
        observaciones: p.observations || null,
        record_version: Number(p.record_version) || 1,
        updated_by_origin: item.origin,
        updated_at: p.updated_at || nowIso,
      };
    case 'dispositivos_zkteco':
      return {
        id: p.id,
        serial_number: p.serial_number,
        name: p.name,
        ip_address: p.ip_address,
        port: Number(p.port) || 4370,
        netmask: p.netmask || null,
        gateway: p.gateway || null,
        dns: p.dns || null,
        mac_address: p.mac_address || null,
        comm_key: p.comm_key !== undefined ? String(p.comm_key) : '0',
        device_id_num: Number(p.device_id_num) || 1,
        model: p.model || null,
        protocol: p.protocol || 'TCP',
        status: p.status || 'ONLINE',
        location_detail: p.location_detail || null,
        last_modified_by: p.last_modified_by || null,
        last_modified_at: p.last_modified_at || null,
        record_version: Number(p.record_version) || 1,
        updated_by_origin: item.origin,
        updated_at: p.updated_at || nowIso,
      };
    case 'usuarios_reloj':
      return {
        id: p.id,
        device_id: p.device_id,
        device_sn: p.device_sn,
        device_name: p.device_name,
        pin: p.pin,
        uid: p.uid ?? null,
        clock_name: p.clock_name ?? null,
        clock_employee_code: p.clock_employee_code ?? null,
        card_number: p.card_number ?? null,
        privilege_code: p.privilege_code ?? null,
        privilege_label: p.privilege_label ?? null,
        clock_status: p.clock_status ?? null,
        source_method: p.source_method || null,
        source_scope: p.source_scope || null,
        available_fields: p.available_fields || [],
        raw_attributes: p.raw_attributes || {},
        present_on_device: Boolean(p.present_on_device),
        first_seen_at: p.first_seen_at || null,
        last_queried_at: p.last_queried_at || null,
        last_clock_updated_at: p.last_clock_updated_at || null,
        missing_since_at: p.missing_since_at || null,
        record_version: Number(p.record_version) || 1,
        updated_at: p.updated_at || nowIso,
      };
    case 'vinculaciones_usuario_reloj':
      return {
        id: p.id,
        device_user_id: p.device_user_id,
        device_sn: p.device_sn,
        pin: p.pin,
        trabajador_id: p.trabajador_id || p.employee_id || null,
        codigo_drac: p.codigo_drac || null,
        dni: p.dni || null,
        nombre_institucional: p.nombre_institucional || null,
        dependencia_name: p.dependencia_name || null,
        area_name: p.area_name || null,
        cargo_name: p.cargo_name || null,
        estado_vinculacion: p.estado_vinculacion || 'VINCULADO',
        observaciones: p.observaciones || null,
        vinculado_por: p.vinculado_por || null,
        vinculado_en: p.vinculado_en || null,
        record_version: Number(p.record_version) || 1,
        updated_by_origin: item.origin,
        updated_at: p.updated_at || nowIso,
      };
    case 'closed_periods':
      return {
        period: p.period || item.entity_id,
        closed_at: p.closed_at || nowIso,
        closed_by: p.closed_by || 'ADMIN_GENERAL',
        reason: p.reason || null,
      };
    default:
      return null;
  }
}

function isMissingRelationError(errMsg: string, code?: string): boolean {
  const m = String(errMsg || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    m.includes('could not find the table') ||
    (m.includes('relation') && m.includes('does not exist'))
  );
}

let flushInFlight: Promise<any> | null = null;
let flushNeedsAnotherPass = false;

async function executeSingleFlushPass(options: {
  dirs: StorageDirectories;
  supabaseServer: SupabaseClient;
  supabaseUrl: string;
  timeoutMs?: number;
}) {
  const { dirs, supabaseServer, supabaseUrl } = options;
  const outboxSnapshot = readOutboxQueue(dirs);
  const pending = outboxSnapshot.filter((x) => x.status === 'PENDIENTE');

  if (pending.length === 0) {
    return {
      success: true,
      cloudConfigured: !isPlaceholderSupabaseUrlServer(supabaseUrl),
      processed: 0,
      synced: 0,
      failed: 0,
      pendingRemaining: 0,
      conflicts: outboxSnapshot.filter((x) => x.status === 'CONFLICTO').length,
      errors: [] as string[],
    };
  }

  if (isPlaceholderSupabaseUrlServer(supabaseUrl)) {
    const nowIso = new Date().toISOString();
    const pendingSet = new Set(pending.map((p) => p.id));
    const latest = readOutboxQueue(dirs);
    const touched = latest.map((item) =>
      item.status === 'PENDIENTE' && pendingSet.has(item.id)
        ? {
            ...item,
            attempts: item.attempts + 1,
            last_attempt_at: nowIso,
            last_error:
              'Instancia Supabase central no configurada aún; registro retenido de forma segura en Outbox local.',
          }
        : item
    );
    safeWriteJsonAtomic(getOutboxFilePath(dirs), touched);
    return {
      success: false,
      cloudConfigured: false,
      processed: pending.length,
      synced: 0,
      failed: pending.length,
      pendingRemaining: touched.filter((x) => x.status === 'PENDIENTE').length,
      conflicts: touched.filter((x) => x.status === 'CONFLICTO').length,
      errors: ['Instancia Supabase central no configurada (cola Outbox preservada intacta).'],
    };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 5000;
  let canonicalTableMissing = false;
  const processedOutcomes = new Map<string, OutboxQueueItem>();

  for (const item of pending) {
    const nowIso = new Date().toISOString();

    try {
      let canonicalOk = false;
      let lastErrMsg = '';

      if (!canonicalTableMissing) {
        const canonicalRow = {
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          payload: item.payload || {},
          record_version: Number(item.record_version) || 1,
          origin: item.origin || 'DESKTOP',
          deleted: item.operation === 'DELETE',
          updated_at: item.payload?.updated_at || nowIso,
        };

        const canRes: any = await Promise.race([
          Promise.resolve(
            supabaseServer
              .from('drac_sync_records')
              .upsert(canonicalRow, { onConflict: 'entity_type,entity_id' })
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout sincronizando drac_sync_records`)), timeoutMs)
          ),
        ]);

        if (!canRes?.error) {
          canonicalOk = true;
        } else {
          lastErrMsg = String(canRes.error.message || 'Error SQL en drac_sync_records');
          if (isMissingRelationError(lastErrMsg, canRes.error.code)) {
            canonicalTableMissing = true;
          }
        }
      }

      // Espejo relacional best-effort (o fallback si drac_sync_records aún no fue creada en Supabase)
      const relTable = mapOutboxToRelationalTable(item.entity_type);
      let relOk = false;
      if (relTable) {
        try {
          if (item.operation === 'DELETE') {
            const pkCol = relTable === 'closed_periods' ? 'period' : 'id';
            const rDel: any = await Promise.race([
              Promise.resolve(supabaseServer.from(relTable).delete().eq(pkCol, item.entity_id)),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
            ]);
            if (!rDel?.error) relOk = true;
          } else {
            const relPayload = buildRelationalPayload(item);
            if (relPayload) {
              const pkCol = relTable === 'closed_periods' ? 'period' : 'id';
              const rUp: any = await Promise.race([
                Promise.resolve(supabaseServer.from(relTable).upsert(relPayload, { onConflict: pkCol })),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
              ]);
              if (!rUp?.error) relOk = true;
              else if (!canonicalOk && !lastErrMsg) lastErrMsg = String(rUp.error.message || '');
            }
          }
        } catch {}
      }

      if (canonicalOk) {
        Promise.resolve(
          supabaseServer.from('sync_outbox_audit').upsert(
            {
              id: item.id,
              idempotency_key: item.idempotency_key,
              entity_type: item.entity_type,
              entity_id: item.entity_id,
              operation: item.operation,
              record_version: item.record_version,
              origin: item.origin,
              payload: item.payload,
              status: 'SINCRONIZADO',
              synced_at: nowIso,
            },
            { onConflict: 'idempotency_key' }
          )
        ).catch(() => {});
      }

      if (canonicalOk || relOk) {
        processedOutcomes.set(item.id, {
          ...item,
          status: 'SINCRONIZADO',
          attempts: item.attempts + 1,
          last_attempt_at: nowIso,
          last_error: null,
          synced_at: nowIso,
        });
        synced++;
      } else {
        const msg = canonicalTableMissing
          ? `Falta ejecutar el script DDL actualizado en Supabase (tabla drac_sync_records). ${lastErrMsg}`.trim()
          : lastErrMsg || 'Error SQL sincronizando con Supabase';
        processedOutcomes.set(item.id, {
          ...item,
          status: 'PENDIENTE',
          attempts: item.attempts + 1,
          last_attempt_at: nowIso,
          last_error: msg,
        });
        failed++;
        errors.push(`${item.entity_type}/${item.entity_id}: ${msg}`);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Sin conectividad de red';
      processedOutcomes.set(item.id, {
        ...item,
        status: 'PENDIENTE',
        attempts: item.attempts + 1,
        last_attempt_at: nowIso,
        last_error: errMsg,
      });
      failed++;
      errors.push(`${item.entity_type}/${item.entity_id}: ${errMsg}`);
    }
  }

  // Re-leer la cola actual en disco para NO perder nuevos eventos encolados mientras se ejecutaba la red
  const latestOutbox = readOutboxQueue(dirs);
  const mergedOutbox = latestOutbox.map((curr) => {
    const outcome = processedOutcomes.get(curr.id);
    if (!outcome) return curr;
    // Si el ítem fue actualizado a una versión más reciente mientras viajaba por red, conservarlo PENDIENTE
    if (Number(curr.record_version) > Number(outcome.record_version)) {
      return curr;
    }
    if (curr.idempotency_key !== outcome.idempotency_key) {
      return curr;
    }
    return outcome;
  });

  const pendingItems = mergedOutbox.filter((x) => x.status !== 'SINCRONIZADO');
  const syncedItems = mergedOutbox.filter((x) => x.status === 'SINCRONIZADO').slice(-500);
  safeWriteJsonAtomic(getOutboxFilePath(dirs), [...syncedItems, ...pendingItems]);

  const cursor = readSyncState(dirs);
  if (synced > 0) {
    cursor.last_push_at = new Date().toISOString();
    cursor.initial_push_done = true;
  }
  cursor.last_sync_error = errors.length > 0 ? errors[0] : null;
  safeWriteJsonAtomic(getSyncStateFilePath(dirs), cursor);

  return {
    success: failed === 0,
    cloudConfigured: true,
    processed: pending.length,
    synced,
    failed,
    pendingRemaining: pendingItems.filter((x) => x.status === 'PENDIENTE').length,
    conflicts: mergedOutbox.filter((x) => x.status === 'CONFLICTO').length,
    errors,
  };
}

export async function flushServerOutbox(options: {
  dirs: StorageDirectories;
  supabaseServer: SupabaseClient;
  supabaseUrl: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  cloudConfigured: boolean;
  processed: number;
  synced: number;
  failed: number;
  pendingRemaining: number;
  conflicts: number;
  errors: string[];
}> {
  if (flushInFlight) {
    flushNeedsAnotherPass = true;
    await flushInFlight.catch(() => {});
  }

  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = (async () => {
    let aggregate = await executeSingleFlushPass(options);
    // Si llegaron nuevos ítems mientras corría la pasada (y no hubo error fatal de red), vaciar el remanente
    let safetyPasses = 0;
    while (
      safetyPasses < 3 &&
      (flushNeedsAnotherPass || aggregate.pendingRemaining > 0) &&
      aggregate.failed === 0
    ) {
      flushNeedsAnotherPass = false;
      const pendingNow = readOutboxQueue(options.dirs).filter((x) => x.status === 'PENDIENTE').length;
      if (pendingNow === 0) break;
      const nextRes = await executeSingleFlushPass(options);
      aggregate = {
        success: aggregate.success && nextRes.success,
        cloudConfigured: nextRes.cloudConfigured,
        processed: aggregate.processed + nextRes.processed,
        synced: aggregate.synced + nextRes.synced,
        failed: aggregate.failed + nextRes.failed,
        pendingRemaining: nextRes.pendingRemaining,
        conflicts: nextRes.conflicts,
        errors: [...aggregate.errors, ...nextRes.errors],
      };
      safetyPasses++;
    }
    flushNeedsAnotherPass = false;
    return aggregate;
  })();

  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

/**
 * Reconciliación incremental segura (Web <-> Desktop) con control de versiones:
 * Nunca sobrescribe un registro local si existe una mutación local PENDIENTE más reciente
 * o si la versión local es mayor a la remota.
 */
export function mergeVersionedRecords<T extends Record<string, any>>(options: {
  localRecords: T[];
  remoteRecords: T[];
  pendingEntityIds: Set<string>;
  idKey?: string;
}): {
  merged: T[];
  insertedCount: number;
  updatedCount: number;
  skippedDueToNewerLocalCount: number;
} {
  const idKey = options.idKey || 'id';
  const result = [...options.localRecords];
  const indexById = new Map<string, number>();
  result.forEach((rec, idx) => {
    const k = String(rec[idKey] || '');
    if (k) indexById.set(k, idx);
  });

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedDueToNewerLocalCount = 0;

  for (const remote of options.remoteRecords) {
    const rid = String(remote[idKey] || '');
    if (!rid) continue;
    const localIdx = indexById.get(rid);
    if (localIdx === undefined) {
      result.push(remote);
      indexById.set(rid, result.length - 1);
      insertedCount++;
      continue;
    }

    const local = result[localIdx];
    const localTs = Date.parse(local.updated_at || local.created_at || '1970-01-01');
    const remoteTs = Date.parse(remote.updated_at || remote.created_at || '1970-01-01');
    const localVer = Number(local.record_version) || 1;
    const remoteVer = Number(remote.record_version) || 1;

    if (options.pendingEntityIds.has(rid)) {
      if (localVer >= remoteVer || localTs >= remoteTs) {
        skippedDueToNewerLocalCount++;
        continue;
      }
    }

    if (remoteVer > localVer || remoteTs > localTs) {
      result[localIdx] = {
        ...local,
        ...remote,
        record_version: Math.max(localVer, remoteVer),
      };
      updatedCount++;
    } else {
      skippedDueToNewerLocalCount++;
    }
  }

  return {
    merged: result,
    insertedCount,
    updatedCount,
    skippedDueToNewerLocalCount,
  };
}

let pullInFlight: Promise<any> | null = null;

/**
 * Descarga incremental (o completa en primer arranque) desde drac_sync_records en Supabase
 * hacia todas las entidades locales del nodo actual (Web o Desktop), respetando:
 * - Mutaciones pendientes locales en Outbox
 * - Versionado optimista (record_version + updated_at)
 * - Períodos históricos cerrados (closed-periods.json)
 */
export async function pullAllEntitiesFromSupabase(options: {
  dirs: StorageDirectories;
  supabaseServer: SupabaseClient;
  supabaseUrl: string;
  forceFull?: boolean;
}): Promise<{
  success: boolean;
  cloudConfigured: boolean;
  pullSummary: Record<string, { inserted: number; updated: number; deleted: number; preservedLocal: number }>;
  totalChanges: number;
  cursor: SyncStateCursor;
  error?: string;
}> {
  if (pullInFlight) return pullInFlight;

  pullInFlight = (async () => {
    const { dirs, supabaseServer, supabaseUrl, forceFull } = options;
    const cursor = readSyncState(dirs);

    if (isPlaceholderSupabaseUrlServer(supabaseUrl)) {
      return {
        success: false,
        cloudConfigured: false,
        pullSummary: {},
        totalChanges: 0,
        cursor,
        error: 'Instancia Supabase central no configurada.',
      };
    }

    const outbox = readOutboxQueue(dirs);
    const pendingByEntity = new Map<string, Set<string>>();
    for (const item of outbox) {
      if (item.status !== 'PENDIENTE') continue;
      if (!pendingByEntity.has(item.entity_type)) {
        pendingByEntity.set(item.entity_type, new Set());
      }
      pendingByEntity.get(item.entity_type)!.add(item.entity_id);
    }

    const pullSummary: Record<string, { inserted: number; updated: number; deleted: number; preservedLocal: number }> = {};
    let totalChanges = 0;

    try {
      // Ventana incremental con traslape de 5 min para tolerar desfase horario entre nodos
      let sinceIso: string | null = null;
      if (!forceFull && cursor.last_pull_at) {
        const parsed = Date.parse(cursor.last_pull_at);
        if (!Number.isNaN(parsed)) {
          sinceIso = new Date(parsed - 5 * 60 * 1000).toISOString();
        }
      }

      const allRemoteRows: any[] = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      let canonicalAvailable = true;

      while (page < 10) {
        let query = supabaseServer
          .from('drac_sync_records')
          .select('*')
          .order('updated_at', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (sinceIso) {
          query = query.gte('updated_at', sinceIso);
        }

        const res: any = await Promise.race([
          Promise.resolve(query),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout pull drac_sync_records')), 5000)),
        ]);

        if (res?.error) {
          if (isMissingRelationError(String(res.error.message || ''), res.error.code)) {
            canonicalAvailable = false;
            break;
          }
          throw new Error(res.error.message || 'Error consultando drac_sync_records');
        }

        const rows = Array.isArray(res?.data) ? res.data : [];
        allRemoteRows.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        page++;
      }

      // Agrupar por entity_type
      const grouped = new Map<string, { upserts: any[]; deletes: Map<string, number> }>();
      for (const row of allRemoteRows) {
        const et = String(row.entity_type || '').trim();
        const eid = String(row.entity_id || '').trim();
        if (!et || !eid) continue;
        if (!grouped.has(et)) {
          grouped.set(et, { upserts: [], deletes: new Map() });
        }
        const grp = grouped.get(et)!;
        if (row.deleted) {
          grp.deletes.set(eid, Number(row.record_version) || 1);
        } else if (row.payload && typeof row.payload === 'object') {
          grp.upserts.push({
            ...row.payload,
            id: row.payload.id || (et === 'closed_periods' ? undefined : eid),
            record_version: Math.max(Number(row.record_version) || 1, Number(row.payload.record_version) || 1),
            updated_at: row.updated_at || row.payload.updated_at || new Date().toISOString(),
          });
        }
      }

      const closedPath = resolveSafeChildPath(dirs.dataDir, 'closed-periods.json');
      const closedPeriods = safeReadJson<ClosedPeriodEntry[]>(closedPath, []);

      for (const [entityType, grp] of grouped.entries()) {
        if (entityType === 'vinculaciones_usuario_reloj') continue;
        const filename = (ENTITY_FILE_MAP as Record<string, string>)[entityType];
        if (!filename) continue;

        const fp = resolveSafeChildPath(dirs.dataDir, filename);
        const localRows = safeReadJson<any[]>(fp, []);
        const pendingIds = pendingByEntity.get(entityType) || new Set<string>();
        const idKey = entityType === 'closed_periods' ? 'period' : 'id';

        let upserts = grp.upserts;
        // Respetar períodos cerrados oficiales al fusionar asistencias
        if (entityType === 'asistencias' && closedPeriods.length > 0) {
          const existingKeys = new Set(localRows.map((a) => `${a.employee_id || a.employee_dni}_${a.fecha}`));
          upserts = upserts.filter((u) => {
            if (!isPeriodClosed(u.fecha, closedPeriods)) return true;
            // Si el período está cerrado y ya existe consolidado local, preservar intacto
            return !existingKeys.has(`${u.employee_id || u.employee_dni}_${u.fecha}`);
          });
        }

        const mergeRes = mergeVersionedRecords({
          localRecords: Array.isArray(localRows) ? localRows : [],
          remoteRecords: upserts,
          pendingEntityIds: pendingIds,
          idKey,
        });

        let finalRows = mergeRes.merged;
        let deletedCount = 0;
        if (grp.deletes.size > 0 && entityType !== 'closed_periods') {
          finalRows = finalRows.filter((row) => {
            const rid = String(row?.[idKey] || '');
            const delVer = grp.deletes.get(rid);
            if (delVer === undefined) return true;
            if (pendingIds.has(rid)) return true;
            const localVer = Number(row.record_version) || 1;
            if (delVer >= localVer) {
              deletedCount++;
              return false;
            }
            return true;
          });
        }

        if (mergeRes.insertedCount > 0 || mergeRes.updatedCount > 0 || deletedCount > 0) {
          safeWriteJsonAtomic(fp, finalRows);
          totalChanges += mergeRes.insertedCount + mergeRes.updatedCount + deletedCount;
        }

        pullSummary[entityType] = {
          inserted: mergeRes.insertedCount,
          updated: mergeRes.updatedCount,
          deleted: deletedCount,
          preservedLocal: mergeRes.skippedDueToNewerLocalCount,
        };
      }

      // Compatibilidad inversa con tablas relacionales si drac_sync_records aún no existe o tiene registros directos
      if (!canonicalAvailable || (!grouped.has('trabajadores') && !grouped.has('marcaciones_raw'))) {
        try {
          const empRes: any = await Promise.race([
            Promise.resolve(supabaseServer.from('trabajadores').select('*').limit(1000)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
          ]);
          if (!empRes?.error && Array.isArray(empRes.data) && empRes.data.length > 0) {
            const empFp = resolveSafeChildPath(dirs.dataDir, 'employees.json');
            const localEmps = safeReadJson<any[]>(empFp, []);
            const mapped = empRes.data.map((t: any) => ({
              id: t.id,
              codigo_trabajador: t.codigo_drac || t.codigo_trabajador,
              dni: t.dni,
              first_name: t.nombres || t.first_name || '',
              last_name: `${t.apellido_paterno || ''} ${t.apellido_materno || ''}`.trim() || t.last_name || '',
              apellido_paterno: t.apellido_paterno || '',
              apellido_materno: t.apellido_materno || '',
              email: t.email || '',
              phone: t.telefono || t.phone || '',
              dependencia_id: t.dependencia_id || 'dep-01',
              area_id: t.area_id || '',
              cargo_id: t.cargo_id || '',
              regimen_laboral: t.regimen_id || 'D.L. 276',
              is_jefe_director: Boolean(t.es_jefe),
              active: t.estado ? t.estado === 'ACTIVO' : true,
              hire_date: t.fecha_ingreso || '2026-01-01',
              zkteco_pin: t.zkteco_pin || t.dni,
              record_version: Number(t.record_version) || 1,
              updated_at: t.updated_at || new Date().toISOString(),
            }));
            const m = mergeVersionedRecords({
              localRecords: localEmps,
              remoteRecords: mapped,
              pendingEntityIds: pendingByEntity.get('trabajadores') || new Set(),
            });
            if (m.insertedCount > 0 || m.updatedCount > 0) {
              safeWriteJsonAtomic(empFp, m.merged);
              totalChanges += m.insertedCount + m.updatedCount;
              pullSummary.trabajadores = {
                inserted: m.insertedCount,
                updated: m.updatedCount,
                deleted: 0,
                preservedLocal: m.skippedDueToNewerLocalCount,
              };
            }
          }
        } catch {}

        try {
          const punchRes: any = await Promise.race([
            Promise.resolve(
              supabaseServer.from('marcaciones_raw').select('*').order('timestamp', { ascending: false }).limit(2000)
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3500)),
          ]);
          if (!punchRes?.error && Array.isArray(punchRes.data) && punchRes.data.length > 0) {
            const pFp = resolveSafeChildPath(dirs.dataDir, 'raw-punches.json');
            const localPunches = safeReadJson<any[]>(pFp, []);
            const m = mergeVersionedRecords({
              localRecords: localPunches,
              remoteRecords: punchRes.data,
              pendingEntityIds: pendingByEntity.get('marcaciones_raw') || new Set(),
            });
            if (m.insertedCount > 0 || m.updatedCount > 0) {
              safeWriteJsonAtomic(pFp, m.merged);
              totalChanges += m.insertedCount + m.updatedCount;
              pullSummary.marcaciones_raw = {
                inserted: m.insertedCount,
                updated: m.updatedCount,
                deleted: 0,
                preservedLocal: m.skippedDueToNewerLocalCount,
              };
            }
          }
        } catch {}
      }

      const nextCursor: SyncStateCursor = {
        ...cursor,
        last_pull_at: new Date().toISOString(),
        last_pull_counts: Object.fromEntries(
          Object.entries(pullSummary).map(([k, v]) => [k, v.inserted + v.updated + v.deleted])
        ),
        last_sync_error: canonicalAvailable
          ? null
          : 'Falta ejecutar el script SQL actualizado en Supabase (tabla drac_sync_records).',
      };
      safeWriteJsonAtomic(getSyncStateFilePath(dirs), nextCursor);

      return {
        success: canonicalAvailable,
        cloudConfigured: true,
        pullSummary,
        totalChanges,
        cursor: nextCursor,
        error: canonicalAvailable
          ? undefined
          : 'Falta ejecutar el script SQL actualizado en Supabase (tabla drac_sync_records).',
      };
    } catch (err: any) {
      return {
        success: false,
        cloudConfigured: true,
        pullSummary,
        totalChanges,
        cursor,
        error: err?.message || 'Error en sincronización incremental desde Supabase.',
      };
    }
  })();

  try {
    return await pullInFlight;
  } finally {
    pullInFlight = null;
  }
}

export function getOutboxSummary(dirs: StorageDirectories) {
  const queue = readOutboxQueue(dirs);
  const cursor = readSyncState(dirs);
  return {
    total: queue.length,
    pending: queue.filter((x) => x.status === 'PENDIENTE').length,
    synced: queue.filter((x) => x.status === 'SINCRONIZADO').length,
    conflicts: queue.filter((x) => x.status === 'CONFLICTO').length,
    cursor,
    items: queue.slice(-100).reverse(),
  };
}
