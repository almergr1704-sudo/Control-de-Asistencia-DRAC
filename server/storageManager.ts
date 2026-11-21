import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const CURRENT_SCHEMA_VERSION = '2026.04.01';
export const MAX_RETAINED_BACKUPS = 15;

export interface StorageDirectories {
  baseDir: string;
  dataDir: string;
  databaseDir: string;
  backupsDir: string;
  syncDir: string;
  configDir: string;
  logsDir: string;
}

export interface MigrationRecord {
  id: string;
  version: string;
  description: string;
  checksum: string;
  applied_at: string;
  status: 'APPLIED' | 'FAILED';
  duration_ms: number;
  details?: string;
}

export interface BackupMetadata {
  id: string;
  filename: string;
  file_path: string;
  created_at: string;
  reason: 'PRE_UPDATE' | 'PRE_MIGRATION' | 'STARTUP_CHECK' | 'MANUAL';
  app_version: string;
  previous_app_version: string | null;
  schema_version: string;
  checksum_sha256: string;
  size_bytes: number;
  verified: boolean;
  record_counts: Record<string, number>;
}

export interface VersionState {
  app_version: string;
  previous_app_version: string | null;
  build_date: string;
  schema_version: string;
  last_backup_at: string | null;
  last_backup_file: string | null;
  last_backup_verified: boolean;
  last_migration_status: 'UP_TO_DATE' | 'MIGRATED_OK' | 'HALTED_BACKUP_ERROR' | 'HALTED_MIGRATION_ERROR';
  last_migration_error: string | null;
  last_startup_at: string;
  data_preserved_verified: boolean;
}

export interface StorageStatusReport {
  appVersion: string;
  previousAppVersion: string | null;
  buildDate: string;
  schemaVersion: string;
  migrationStatus: VersionState['last_migration_status'];
  migrationError: string | null;
  baseDir: string;
  paths: {
    database: string;
    data: string;
    backups: string;
    sync: string;
    config: string;
    logs: string;
  };
  lastBackup: BackupMetadata | null;
  backupsCount: number;
  migrationsCount: number;
  appliedMigrations: MigrationRecord[];
  recordCounts: Record<string, number>;
  lastStartupAt: string;
}

const DATA_ENTITY_FILES = [
  'employees.json',
  'raw-punches.json',
  'attendance.json',
  'devices.json',
  'device-users.json',
  'device-user-history.json',
  'device-user-sync-logs.json',
  'turnos.json',
  'horarios.json',
  'asignacion-horarios.json',
  'dependencias.json',
  'direcciones.json',
  'areas.json',
  'cargos.json',
  'responsables.json',
  'papeletas.json',
  'vacaciones.json',
  'encargaturas.json',
  'push-logs.json',
  'audit-logs.json',
  'closed-periods.json',
];

const CONFIG_FILES = [
  'biotime-config.json',
  'supabase-config.json',
  'institutional-config.json',
];

const SYNC_FILES = [
  'sync-outbox.json',
  'sync-state.json',
];

export function resolveSafeChildPath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, ...segments);
  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Ruta fuera del directorio persistente autorizado: ${target}`);
  }
  return target;
}

export function ensureStorageDirectories(baseDir: string): StorageDirectories {
  const resolvedBase = path.resolve(baseDir);
  const dirs: StorageDirectories = {
    baseDir: resolvedBase,
    dataDir: resolveSafeChildPath(resolvedBase, 'data'),
    databaseDir: resolveSafeChildPath(resolvedBase, 'database'),
    backupsDir: resolveSafeChildPath(resolvedBase, 'backups'),
    syncDir: resolveSafeChildPath(resolvedBase, 'sync'),
    configDir: resolveSafeChildPath(resolvedBase, 'config'),
    logsDir: resolveSafeChildPath(resolvedBase, 'logs'),
  };

  for (const dir of Object.values(dirs)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  return dirs;
}

export function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeWriteJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const serialized = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, serialized, 'utf-8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch {
    fs.writeFileSync(filePath, serialized, 'utf-8');
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
  }
}

function appendStorageLog(logsDir: string, filename: string, message: string): void {
  try {
    const logPath = resolveSafeChildPath(logsDir, filename);
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch {}
}

/**
 * Copia archivos semilla desde el paquete SOLO cuando el archivo destino NO existe todavía.
 * Nunca sobrescribe ni elimina datos existentes del usuario o de la entidad.
 */
export function seedBundledDataNonDestructively(
  dirs: StorageDirectories,
  bundledDataDir: string
): void {
  if (path.resolve(dirs.dataDir) === path.resolve(bundledDataDir)) return;
  if (!fs.existsSync(bundledDataDir)) return;

  try {
    for (const file of fs.readdirSync(bundledDataDir)) {
      if (!file.endsWith('.json')) continue;
      const src = path.join(bundledDataDir, file);
      const dest = resolveSafeChildPath(dirs.dataDir, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        appendStorageLog(dirs.logsDir, 'app-storage.log', `Seed inicial no destructivo: ${file}`);
      }
    }
  } catch (err: any) {
    appendStorageLog(dirs.logsDir, 'app-storage.log', `Aviso seed inicial: ${err?.message || err}`);
  }
}

/**
 * Consolida configuraciones persistentes desde data/ hacia config/ sin borrar las existentes,
 * manteniendo compatibilidad bidireccional entre versiones anteriores y nuevas.
 */
export function reconcileLegacyConfigFiles(dirs: StorageDirectories): void {
  for (const cfgFile of CONFIG_FILES) {
    const legacyPath = resolveSafeChildPath(dirs.dataDir, cfgFile);
    const structuredPath = resolveSafeChildPath(dirs.configDir, cfgFile);
    if (fs.existsSync(legacyPath) && !fs.existsSync(structuredPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
        safeWriteJsonAtomic(structuredPath, parsed);
        appendStorageLog(
          dirs.logsDir,
          'app-storage.log',
          `Configuración ${cfgFile} copiada a config/ preservando origen en data/.`
        );
      } catch {}
    } else if (fs.existsSync(structuredPath) && !fs.existsSync(legacyPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(structuredPath, 'utf-8'));
        safeWriteJsonAtomic(legacyPath, parsed);
      } catch {}
    }
  }
}

export function resolveConfigFilePath(dirs: StorageDirectories, filename: string): string {
  const structuredPath = resolveSafeChildPath(dirs.configDir, filename);
  const legacyPath = resolveSafeChildPath(dirs.dataDir, filename);
  if (fs.existsSync(structuredPath)) return structuredPath;
  if (fs.existsSync(legacyPath)) return legacyPath;
  return structuredPath;
}

export function computeRecordCounts(dirs: StorageDirectories): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of DATA_ENTITY_FILES) {
    const fp = resolveSafeChildPath(dirs.dataDir, file);
    if (!fs.existsSync(fp)) {
      counts[file.replace('.json', '')] = 0;
      continue;
    }
    const parsed = safeReadJson<any>(fp, []);
    counts[file.replace('.json', '')] = Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === 'object' ? 1 : 0;
  }
  const outboxPath = resolveSafeChildPath(dirs.syncDir, 'sync-outbox.json');
  const outbox = safeReadJson<any[]>(outboxPath, []);
  counts['sync_outbox_total'] = Array.isArray(outbox) ? outbox.length : 0;
  counts['sync_outbox_pending'] = Array.isArray(outbox)
    ? outbox.filter((x) => x && x.status !== 'SINCRONIZADO').length
    : 0;
  return counts;
}

export function verifyJsonIntegrity(dirs: StorageDirectories): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const file of DATA_ENTITY_FILES) {
    const fp = resolveSafeChildPath(dirs.dataDir, file);
    if (!fs.existsSync(fp)) continue;
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      if (raw.trim().length > 0) JSON.parse(raw);
    } catch (err: any) {
      errors.push(`data/${file}: ${err?.message || 'JSON inválido'}`);
    }
  }
  for (const file of CONFIG_FILES) {
    const fp = resolveConfigFilePath(dirs, file);
    if (!fs.existsSync(fp)) continue;
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      if (raw.trim().length > 0) JSON.parse(raw);
    } catch (err: any) {
      errors.push(`config/${file}: ${err?.message || 'JSON inválido'}`);
    }
  }
  for (const file of SYNC_FILES) {
    const fp = resolveSafeChildPath(dirs.syncDir, file);
    if (!fs.existsSync(fp)) continue;
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      if (raw.trim().length > 0) JSON.parse(raw);
    } catch (err: any) {
      errors.push(`sync/${file}: ${err?.message || 'JSON inválido'}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function createVerifiedBackup(
  dirs: StorageDirectories,
  options: {
    reason: BackupMetadata['reason'];
    appVersion: string;
    previousAppVersion?: string | null;
    schemaVersion: string;
  }
): { success: boolean; backup?: BackupMetadata; error?: string } {
  try {
    const createdAt = new Date().toISOString();
    const safeStamp = createdAt.replace(/[:.]/g, '-');
    const backupId = `bkp-${options.appVersion}-${safeStamp}`;
    const filename = `${backupId}.json`;
    const backupPath = resolveSafeChildPath(dirs.backupsDir, filename);

    const dataSnapshot: Record<string, any> = {};
    for (const file of DATA_ENTITY_FILES) {
      const fp = resolveSafeChildPath(dirs.dataDir, file);
      if (fs.existsSync(fp)) {
        dataSnapshot[file] = safeReadJson(fp, []);
      }
    }

    const configSnapshot: Record<string, any> = {};
    for (const file of CONFIG_FILES) {
      const fp = resolveConfigFilePath(dirs, file);
      if (fs.existsSync(fp)) {
        configSnapshot[file] = safeReadJson(fp, null);
      }
    }

    const syncSnapshot: Record<string, any> = {};
    for (const file of SYNC_FILES) {
      const fp = resolveSafeChildPath(dirs.syncDir, file);
      if (fs.existsSync(fp)) {
        syncSnapshot[file] = safeReadJson(fp, file.endsWith('outbox.json') ? [] : {});
      }
    }

    const migrationsPath = resolveSafeChildPath(dirs.databaseDir, 'schema_migrations.json');
    const migrations = safeReadJson<MigrationRecord[]>(migrationsPath, []);
    const counts = computeRecordCounts(dirs);

    const payloadBody = {
      data: dataSnapshot,
      config: configSnapshot,
      sync: syncSnapshot,
      migrations,
    };
    const bodyChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(payloadBody))
      .digest('hex');

    const bundle = {
      backup_id: backupId,
      created_at: createdAt,
      reason: options.reason,
      app_version: options.appVersion,
      previous_app_version: options.previousAppVersion ?? null,
      schema_version: options.schemaVersion,
      checksum_sha256: bodyChecksum,
      record_counts: counts,
      payload: payloadBody,
    };

    safeWriteJsonAtomic(backupPath, bundle);

    // Verificación estricta de lectura y checksum antes de darlo por válido
    const verifyRaw = fs.readFileSync(backupPath, 'utf-8');
    const verifiedParsed = JSON.parse(verifyRaw);
    const recomputed = crypto
      .createHash('sha256')
      .update(JSON.stringify(verifiedParsed.payload))
      .digest('hex');

    if (recomputed !== bodyChecksum) {
      return { success: false, error: 'Fallo en la verificación SHA-256 del archivo de respaldo.' };
    }

    const stat = fs.statSync(backupPath);
    const meta: BackupMetadata = {
      id: backupId,
      filename,
      file_path: backupPath,
      created_at: createdAt,
      reason: options.reason,
      app_version: options.appVersion,
      previous_app_version: options.previousAppVersion ?? null,
      schema_version: options.schemaVersion,
      checksum_sha256: bodyChecksum,
      size_bytes: stat.size,
      verified: true,
      record_counts: counts,
    };

    // Actualizar índice de backups y rotar conservando las últimas MAX_RETAINED_BACKUPS generaciones
    const indexPath = resolveSafeChildPath(dirs.backupsDir, 'backups-index.json');
    const existingIndex = safeReadJson<BackupMetadata[]>(indexPath, []);
    const updatedIndex = [meta, ...existingIndex.filter((b) => b.filename !== filename)];
    while (updatedIndex.length > MAX_RETAINED_BACKUPS) {
      const oldest = updatedIndex.pop();
      if (oldest?.filename) {
        try {
          const oldPath = resolveSafeChildPath(dirs.backupsDir, oldest.filename);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch {}
      }
    }
    safeWriteJsonAtomic(indexPath, updatedIndex);

    appendStorageLog(
      dirs.logsDir,
      'app-storage.log',
      `Respaldo verificado (${options.reason}): ${filename} (${stat.size} bytes, SHA256=${bodyChecksum.slice(0, 12)}...)`
    );

    return { success: true, backup: meta };
  } catch (err: any) {
    appendStorageLog(dirs.logsDir, 'app-storage.log', `ERROR creando respaldo: ${err?.message || err}`);
    return { success: false, error: err?.message || 'Error generando respaldo previo' };
  }
}

export function listVerifiedBackups(dirs: StorageDirectories): BackupMetadata[] {
  const indexPath = resolveSafeChildPath(dirs.backupsDir, 'backups-index.json');
  const indexed = safeReadJson<BackupMetadata[]>(indexPath, []);
  if (indexed.length > 0) {
    return indexed.filter((b) => {
      try {
        return fs.existsSync(resolveSafeChildPath(dirs.backupsDir, b.filename));
      } catch {
        return false;
      }
    });
  }
  return [];
}

interface MigrationDefinition {
  id: string;
  version: string;
  description: string;
  run: (dirs: StorageDirectories) => string;
}

const INCREMENTAL_MIGRATIONS: MigrationDefinition[] = [
  {
    id: '001_baseline_schema_v1',
    version: '2026.01.01',
    description: 'Inicialización no destructiva del registro de migraciones y verificación de datasets base.',
    run: (dirs) => {
      const closedPath = resolveSafeChildPath(dirs.dataDir, 'closed-periods.json');
      if (!fs.existsSync(closedPath)) safeWriteJsonAtomic(closedPath, []);
      return 'Esquema base verificado sin alterar datos existentes.';
    },
  },
  {
    id: '002_biometric_enrichment_fields',
    version: '2026.03.01',
    description: 'Incorpora campos de trazabilidad y versión de registro sin sobrescribir datos originales de marcaciones ni empleados.',
    run: (dirs) => {
      const empPath = resolveSafeChildPath(dirs.dataDir, 'employees.json');
      if (fs.existsSync(empPath)) {
        const emps = safeReadJson<any[]>(empPath, []);
        let touched = 0;
        const nowIso = new Date().toISOString();
        const next = emps.map((e) => {
          if (e && (e.record_version === undefined || e.updated_at === undefined)) {
            touched++;
            return {
              ...e,
              record_version: Number(e.record_version) || 1,
              updated_at: e.updated_at || nowIso,
            };
          }
          return e;
        });
        if (touched > 0) safeWriteJsonAtomic(empPath, next);
      }
      return 'Metadatos de trazabilidad aplicados de forma incremental en trabajadores.';
    },
  },
  {
    id: '003_sync_outbox_and_versioning',
    version: '2026.04.01',
    description: 'Inicializa cola Outbox persistente (sync/), cursor incremental y versionamiento optimista en entidades sincronizables.',
    run: (dirs) => {
      const outboxPath = resolveSafeChildPath(dirs.syncDir, 'sync-outbox.json');
      if (!fs.existsSync(outboxPath)) safeWriteJsonAtomic(outboxPath, []);

      const syncStatePath = resolveSafeChildPath(dirs.syncDir, 'sync-state.json');
      if (!fs.existsSync(syncStatePath)) {
        safeWriteJsonAtomic(syncStatePath, {
          last_push_at: null,
          last_pull_at: null,
          last_pull_counts: {},
          desktop_node_id: `drac-node-${crypto.randomBytes(4).toString('hex')}`,
        });
      }

      const versionedFiles = [
        'devices.json',
        'horarios.json',
        'turnos.json',
        'papeletas.json',
        'vacaciones.json',
        'device-users.json',
      ];
      const nowIso = new Date().toISOString();
      for (const file of versionedFiles) {
        const fp = resolveSafeChildPath(dirs.dataDir, file);
        if (!fs.existsSync(fp)) continue;
        const rows = safeReadJson<any[]>(fp, []);
        if (!Array.isArray(rows)) continue;
        let changed = false;
        const next = rows.map((row) => {
          if (row && typeof row === 'object' && row.record_version === undefined) {
            changed = true;
            return {
              ...row,
              record_version: 1,
              updated_at: row.updated_at || row.created_at || nowIso,
            };
          }
          return row;
        });
        if (changed) safeWriteJsonAtomic(fp, next);
      }

      const closedPath = resolveSafeChildPath(dirs.dataDir, 'closed-periods.json');
      if (!fs.existsSync(closedPath)) safeWriteJsonAtomic(closedPath, []);

      return 'Subsistema Outbox, control de versiones y períodos cerrados inicializados.';
    },
  },
  {
    id: '004_reconcile_config_directory',
    version: '2026.04.01',
    description: 'Consolida archivos de configuración (BioTime, Supabase) en config/ manteniendo compatibilidad con rutas previas.',
    run: (dirs) => {
      reconcileLegacyConfigFiles(dirs);
      return 'Configuraciones consolidadas de manera segura.';
    },
  },
];

export function initializePersistentStorage(options: {
  baseDir: string;
  bundledDataDir: string;
  appVersion: string;
  buildDate: string;
}): {
  dirs: StorageDirectories;
  versionState: VersionState;
  migrations: MigrationRecord[];
  latestBackup: BackupMetadata | null;
} {
  const dirs = ensureStorageDirectories(options.baseDir);
  seedBundledDataNonDestructively(dirs, options.bundledDataDir);
  reconcileLegacyConfigFiles(dirs);

  const migrationsPath = resolveSafeChildPath(dirs.databaseDir, 'schema_migrations.json');
  const versionStatePath = resolveSafeChildPath(dirs.databaseDir, 'version-state.json');

  const appliedMigrations = safeReadJson<MigrationRecord[]>(migrationsPath, []);
  const appliedSet = new Set(appliedMigrations.filter((m) => m.status === 'APPLIED').map((m) => m.id));
  const pendingMigrations = INCREMENTAL_MIGRATIONS.filter((m) => !appliedSet.has(m.id));

  const prevState = safeReadJson<VersionState | null>(versionStatePath, null);
  const prevAppVersion = prevState?.app_version || null;
  const isAppUpgrade = Boolean(prevAppVersion && prevAppVersion !== options.appVersion);
  const existingBackups = listVerifiedBackups(dirs);
  const needsBackup = isAppUpgrade || pendingMigrations.length > 0 || existingBackups.length === 0;

  const nowIso = new Date().toISOString();
  const integrityBefore = verifyJsonIntegrity(dirs);
  if (!integrityBefore.ok) {
    appendStorageLog(
      dirs.logsDir,
      'migration.log',
      `ADVERTENCIA integridad previa detectada: ${integrityBefore.errors.join(' | ')}`
    );
  }

  let latestBackup: BackupMetadata | null = existingBackups[0] || null;

  if (needsBackup) {
    const reason: BackupMetadata['reason'] = isAppUpgrade
      ? 'PRE_UPDATE'
      : pendingMigrations.length > 0
      ? 'PRE_MIGRATION'
      : 'STARTUP_CHECK';
    const bkpRes = createVerifiedBackup(dirs, {
      reason,
      appVersion: options.appVersion,
      previousAppVersion: prevAppVersion,
      schemaVersion: prevState?.schema_version || CURRENT_SCHEMA_VERSION,
    });

    if (!bkpRes.success || !bkpRes.backup?.verified) {
      const haltedState: VersionState = {
        app_version: options.appVersion,
        previous_app_version: prevAppVersion,
        build_date: options.buildDate,
        schema_version: prevState?.schema_version || '0.0.0',
        last_backup_at: prevState?.last_backup_at || null,
        last_backup_file: prevState?.last_backup_file || null,
        last_backup_verified: false,
        last_migration_status: 'HALTED_BACKUP_ERROR',
        last_migration_error: bkpRes.error || 'No se pudo verificar el respaldo previo a la migración.',
        last_startup_at: nowIso,
        data_preserved_verified: integrityBefore.ok,
      };
      safeWriteJsonAtomic(versionStatePath, haltedState);
      return { dirs, versionState: haltedState, migrations: appliedMigrations, latestBackup };
    }

    latestBackup = bkpRes.backup;
  }

  let migrationStatus: VersionState['last_migration_status'] =
    pendingMigrations.length > 0 ? 'MIGRATED_OK' : 'UP_TO_DATE';
  let migrationError: string | null = null;
  const nextMigrations = [...appliedMigrations];

  for (const mig of pendingMigrations) {
    const t0 = Date.now();
    try {
      const details = mig.run(dirs);
      const checksum = crypto
        .createHash('sha256')
        .update(`${mig.id}:${mig.version}:${mig.description}`)
        .digest('hex');
      const record: MigrationRecord = {
        id: mig.id,
        version: mig.version,
        description: mig.description,
        checksum,
        applied_at: new Date().toISOString(),
        status: 'APPLIED',
        duration_ms: Date.now() - t0,
        details,
      };
      nextMigrations.push(record);
      safeWriteJsonAtomic(migrationsPath, nextMigrations);
      appendStorageLog(dirs.logsDir, 'migration.log', `Migración aplicada OK: ${mig.id} (${details})`);
    } catch (err: any) {
      migrationStatus = 'HALTED_MIGRATION_ERROR';
      migrationError = err?.message || `Error ejecutando migración ${mig.id}`;
      nextMigrations.push({
        id: mig.id,
        version: mig.version,
        description: mig.description,
        checksum: '',
        applied_at: new Date().toISOString(),
        status: 'FAILED',
        duration_ms: Date.now() - t0,
        details: migrationError || undefined,
      });
      safeWriteJsonAtomic(migrationsPath, nextMigrations);
      appendStorageLog(dirs.logsDir, 'migration.log', `ERROR migración ${mig.id}: ${migrationError}`);
      break;
    }
  }

  const integrityAfter = verifyJsonIntegrity(dirs);
  const nextState: VersionState = {
    app_version: options.appVersion,
    previous_app_version: isAppUpgrade ? prevAppVersion : prevState?.previous_app_version || null,
    build_date: options.buildDate,
    schema_version: migrationStatus === 'HALTED_MIGRATION_ERROR'
      ? (prevState?.schema_version || '2026.01.01')
      : CURRENT_SCHEMA_VERSION,
    last_backup_at: latestBackup?.created_at || prevState?.last_backup_at || null,
    last_backup_file: latestBackup?.filename || prevState?.last_backup_file || null,
    last_backup_verified: Boolean(latestBackup?.verified ?? prevState?.last_backup_verified),
    last_migration_status: migrationStatus,
    last_migration_error: migrationError || (!integrityAfter.ok ? integrityAfter.errors.join(' | ') : null),
    last_startup_at: nowIso,
    data_preserved_verified: integrityAfter.ok,
  };
  safeWriteJsonAtomic(versionStatePath, nextState);

  return {
    dirs,
    versionState: nextState,
    migrations: nextMigrations,
    latestBackup,
  };
}

export function getStorageStatusReport(
  dirs: StorageDirectories,
  fallbackAppVersion: string,
  fallbackBuildDate: string
): StorageStatusReport {
  const versionStatePath = resolveSafeChildPath(dirs.databaseDir, 'version-state.json');
  const migrationsPath = resolveSafeChildPath(dirs.databaseDir, 'schema_migrations.json');
  const versionState = safeReadJson<VersionState>(versionStatePath, {
    app_version: fallbackAppVersion,
    previous_app_version: null,
    build_date: fallbackBuildDate,
    schema_version: CURRENT_SCHEMA_VERSION,
    last_backup_at: null,
    last_backup_file: null,
    last_backup_verified: false,
    last_migration_status: 'UP_TO_DATE',
    last_migration_error: null,
    last_startup_at: new Date().toISOString(),
    data_preserved_verified: true,
  });
  const migrations = safeReadJson<MigrationRecord[]>(migrationsPath, []);
  const backups = listVerifiedBackups(dirs);
  const counts = computeRecordCounts(dirs);

  return {
    appVersion: versionState.app_version || fallbackAppVersion,
    previousAppVersion: versionState.previous_app_version,
    buildDate: versionState.build_date || fallbackBuildDate,
    schemaVersion: versionState.schema_version || CURRENT_SCHEMA_VERSION,
    migrationStatus: versionState.last_migration_status,
    migrationError: versionState.last_migration_error,
    baseDir: dirs.baseDir,
    paths: {
      database: dirs.databaseDir,
      data: dirs.dataDir,
      backups: dirs.backupsDir,
      sync: dirs.syncDir,
      config: dirs.configDir,
      logs: dirs.logsDir,
    },
    lastBackup: backups[0] || null,
    backupsCount: backups.length,
    migrationsCount: migrations.filter((m) => m.status === 'APPLIED').length,
    appliedMigrations: migrations,
    recordCounts: counts,
    lastStartupAt: versionState.last_startup_at,
  };
}
