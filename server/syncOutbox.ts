import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  StorageDirectories,
  resolveSafeChildPath,
  safeReadJson,
  safeWriteJsonAtomic,
} from './storageManager';

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
  | 'encargaturas';

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
}

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
  });
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
    origin: input.origin || (process.env.DRAC_DATA_DIR ? 'DESKTOP' : 'WEB'),
    status: 'PENDIENTE',
    attempts: pendingIdx >= 0 ? outbox[pendingIdx].attempts : 0,
    last_attempt_at: null,
    last_error: null,
    created_at: pendingIdx >= 0 ? outbox[pendingIdx].created_at : nowIso,
    synced_at: null,
  };

  if (pendingIdx >= 0) {
    // Reemplaza la carga pendiente previa manteniendo trazabilidad y sin duplicar cola
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

function mapOutboxToRemoteTable(entityType: SyncEntityType): string {
  switch (entityType) {
    case 'areas':
      return 'areas_oficinas';
    case 'papeletas_salida':
      return 'papeletas_salida';
    default:
      return entityType;
  }
}

function buildRemotePayloadForEntity(item: OutboxQueueItem): Record<string, any> {
  const p = item.payload || {};
  switch (item.entity_type) {
    case 'trabajadores':
      return {
        id: p.id,
        codigo_drac: p.codigo_trabajador || p.codigo_drac,
        dni: p.dni,
        nombres: p.first_name || p.nombres,
        apellido_paterno: p.apellido_paterno || '',
        apellido_materno: p.apellido_materno || '',
        email: p.email || null,
        telefono: p.phone || p.telefono || null,
        dependencia_id: p.dependencia_id || 'dep-01',
        area_id: p.area_id || null,
        cargo_id: p.cargo_id || 'crg-05',
        regimen_id: p.regimen_laboral || p.regimen_id || 'D.L. 276',
        es_jefe: Boolean(p.is_jefe_director),
        estado: p.active === false ? 'INACTIVO' : 'ACTIVO',
        fecha_ingreso: p.hire_date || p.fecha_ingreso || '2026-01-01',
        updated_at: p.updated_at || new Date().toISOString(),
      };
    case 'asistencias':
      return {
        id: p.id,
        trabajador_id: p.employee_id,
        dni: p.employee_dni,
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
        updated_at: p.updated_at || new Date().toISOString(),
      };
    default:
      return p;
  }
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
  const { dirs, supabaseServer, supabaseUrl } = options;
  const outbox = readOutboxQueue(dirs);
  const pending = outbox.filter((x) => x.status === 'PENDIENTE');

  if (pending.length === 0) {
    return {
      success: true,
      cloudConfigured: !isPlaceholderSupabaseUrlServer(supabaseUrl),
      processed: 0,
      synced: 0,
      failed: 0,
      pendingRemaining: 0,
      conflicts: outbox.filter((x) => x.status === 'CONFLICTO').length,
      errors: [],
    };
  }

  if (isPlaceholderSupabaseUrlServer(supabaseUrl)) {
    // NUNCA limpia o descarta la cola cuando no hay instancia Supabase real
    const nowIso = new Date().toISOString();
    const touched = outbox.map((item) =>
      item.status === 'PENDIENTE'
        ? {
            ...item,
            attempts: item.attempts + 1,
            last_attempt_at: nowIso,
            last_error: 'Instancia Supabase central no configurada aún; registro retenido de forma segura en Outbox local.',
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
      pendingRemaining: pending.length,
      conflicts: touched.filter((x) => x.status === 'CONFLICTO').length,
      errors: ['Instancia Supabase central no configurada (cola Outbox preservada intacta).'],
    };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  const timeoutMs = options.timeoutMs ?? 4500;

  for (let i = 0; i < outbox.length; i++) {
    const item = outbox[i];
    if (item.status !== 'PENDIENTE') continue;

    const nowIso = new Date().toISOString();
    const remoteTable = mapOutboxToRemoteTable(item.entity_type);

    try {
      const execPromise =
        item.operation === 'DELETE'
          ? Promise.resolve(supabaseServer.from(remoteTable).delete().eq('id', item.entity_id))
          : Promise.resolve(
              supabaseServer
                .from(remoteTable)
                .upsert(buildRemotePayloadForEntity(item), { onConflict: 'id' })
            );

      const res: any = await Promise.race([
        execPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout sincronizando ${remoteTable}`)), timeoutMs)),
      ]);

      if (!res?.error) {
        outbox[i] = {
          ...item,
          status: 'SINCRONIZADO',
          attempts: item.attempts + 1,
          last_attempt_at: nowIso,
          last_error: null,
          synced_at: nowIso,
        };
        synced++;
      } else {
        outbox[i] = {
          ...item,
          status: 'PENDIENTE',
          attempts: item.attempts + 1,
          last_attempt_at: nowIso,
          last_error: String(res.error.message || 'Error SQL Supabase'),
        };
        failed++;
        errors.push(`${item.entity_type}/${item.entity_id}: ${outbox[i].last_error}`);
      }
    } catch (err: any) {
      outbox[i] = {
        ...item,
        status: 'PENDIENTE',
        attempts: item.attempts + 1,
        last_attempt_at: nowIso,
        last_error: err?.message || 'Sin conectividad de red',
      };
      failed++;
      errors.push(`${item.entity_type}/${item.entity_id}: ${outbox[i].last_error}`);
    }
  }

  safeWriteJsonAtomic(getOutboxFilePath(dirs), outbox);

  const cursor = readSyncState(dirs);
  if (synced > 0) {
    cursor.last_push_at = new Date().toISOString();
  }
  cursor.last_sync_error = errors.length > 0 ? errors[0] : null;
  safeWriteJsonAtomic(getSyncStateFilePath(dirs), cursor);

  return {
    success: failed === 0,
    cloudConfigured: true,
    processed: pending.length,
    synced,
    failed,
    pendingRemaining: outbox.filter((x) => x.status === 'PENDIENTE').length,
    conflicts: outbox.filter((x) => x.status === 'CONFLICTO').length,
    errors,
  };
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
    if (options.pendingEntityIds.has(rid)) {
      const localTs = Date.parse(local.updated_at || local.created_at || '1970-01-01');
      const remoteTs = Date.parse(remote.updated_at || remote.created_at || '1970-01-01');
      const localVer = Number(local.record_version) || 1;
      const remoteVer = Number(remote.record_version) || 1;
      if (localVer >= remoteVer || localTs >= remoteTs) {
        skippedDueToNewerLocalCount++;
        continue;
      }
    }

    const localTs = Date.parse(local.updated_at || local.created_at || '1970-01-01');
    const remoteTs = Date.parse(remote.updated_at || remote.created_at || '1970-01-01');
    const localVer = Number(local.record_version) || 1;
    const remoteVer = Number(remote.record_version) || 1;

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
