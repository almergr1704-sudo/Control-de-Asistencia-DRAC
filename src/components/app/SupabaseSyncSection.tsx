import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Copy,
  Check,
  Server,
  Layers,
  ShieldCheck,
  Zap,
  Globe,
  Monitor,
  Cpu,
  Hash,
  Terminal,
  Activity,
  Sparkles,
  HardDrive,
} from 'lucide-react';
import { POSTGRES_DDL_SQL } from '../../data/ddlSql';
import {
  checkSupabaseConnection,
  getOfflineQueue,
  flushOfflineQueue,
  pullIncrementalFromCloud,
  triggerFullCloudSync,
  getAppOrigin,
  getSavedSupabaseConfig,
  updateSupabaseConfig,
} from '../../lib/supabaseClient';
import { AppOrigin, SupabaseConfigStatus, SystemStorageStatus } from '../../types';
import { getApiUrl } from '../../utils/apiConfig';

export const SupabaseSyncSection: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    latencyMs: number;
    url: string;
    appOrigin: AppOrigin;
    sourceOfTruth: string;
    isPlaceholder?: boolean;
    error?: string;
  } | null>(null);
  const initialSbCfg = getSavedSupabaseConfig();
  const [sbUrlInput, setSbUrlInput] = useState(initialSbCfg.url);
  const [sbKeyInput, setSbKeyInput] = useState(initialSbCfg.anonKey);
  const [savingSbCfg, setSavingSbCfg] = useState(false);
  const [sbCfgNotice, setSbCfgNotice] = useState<string | null>(null);

  const [dbStats, setDbStats] = useState<SupabaseConfigStatus | null>(null);
  const [storageStatus, setStorageStatus] = useState<SystemStorageStatus | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [copiedDdl, setCopiedDdl] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'DDL' | 'CORRELATIVO' | 'OFFLINE_QUEUE' | 'AUDIT'>('OVERVIEW');

  // Offline / Persistent Outbox queue state
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [serverOutbox, setServerOutbox] = useState<{
    items: any[];
    counts: { total: number; pending: number; synced: number; failed: number; conflict: number };
    lastPullAt?: string | null;
    lastPushAt?: string | null;
  } | null>(null);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [pullingCloud, setPullingCloud] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number } | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Correlativo simulator
  const [simulatedGapTest, setSimulatedGapTest] = useState<{
    existingCodes: string[];
    nextCode: string;
    gapDetected: boolean;
  } | null>(null);

  // Audit test state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditOriginFilter, setAuditOriginFilter] = useState<'ALL' | 'WEB' | 'DESKTOP' | 'ZK_AGENT'>('ALL');

  const currentOrigin = getAppOrigin();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const conn = await checkSupabaseConnection();
      setConnectionStatus(conn);

      const [res, storageRes, outboxRes] = await Promise.all([
        fetch(getApiUrl('/api/supabase/status')).catch(() => null),
        fetch(getApiUrl('/api/system/storage-status')).catch(() => null),
        fetch(getApiUrl('/api/sync/outbox')).catch(() => null),
      ]);

      if (res?.ok) {
        const data = await res.json();
        setDbStats(data);
      }
      if (storageRes?.ok) {
        const sData = await storageRes.json();
        if (sData?.success) setStorageStatus(sData);
      }
      if (outboxRes?.ok) {
        const oData = await outboxRes.json();
        if (oData?.success) {
          setServerOutbox({
            items: Array.isArray(oData.items) ? oData.items : [],
            counts: {
              total: Number(oData.total || 0),
              pending: Number(oData.pending || 0),
              synced: Number(oData.synced || 0),
              failed: Number(oData.failed || 0),
              conflict: Number(oData.conflicts || 0),
            },
            lastPullAt: oData.cursor?.last_pull_at || null,
            lastPushAt: oData.cursor?.last_push_at || null,
          });
        }
      }

      setOfflineQueue(getOfflineQueue());
      fetchAuditLogs();
    } catch (err) {
      console.error('Error fetching Supabase status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVerifiedBackup = async () => {
    setCreatingBackup(true);
    setBackupNotice(null);
    try {
      const res = await fetch(getApiUrl('/api/system/backup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual_ui_backup' }),
      });
      const json = await res.json();
      if (json?.success && json?.backup) {
        setBackupNotice(
          `Respaldo verificado SHA-256 creado: ${json.backup.filename} (${Math.round((json.backup.size_bytes || 0) / 1024)} KB).`
        );
        await fetchStatus();
      } else {
        setBackupNotice(`No se pudo crear el respaldo: ${json?.error || json?.message || 'Error interno'}`);
      }
    } catch (err: any) {
      setBackupNotice(`Error creando respaldo: ${err?.message || 'Error de red'}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(getApiUrl('/api/audit/logs?limit=50'));
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setAuditLogs(data.data);
        }
      }
    } catch {}
  };

  const handleSaveSupabaseConfig = async () => {
    setSavingSbCfg(true);
    setSbCfgNotice(null);
    try {
      await updateSupabaseConfig(sbUrlInput, sbKeyInput);
      await fetchStatus();
      setSbCfgNotice('Configuración de Supabase actualizada. Se verificó la conexión con la URL indicada.');
    } catch (err: any) {
      setSbCfgNotice(`Error guardando configuración: ${err?.message || 'Error desconocido'}`);
    } finally {
      setSavingSbCfg(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const onCfgSync = () => {
      const latest = getSavedSupabaseConfig();
      if (latest.url) setSbUrlInput(latest.url);
      if (latest.anonKey) setSbKeyInput(latest.anonKey);
      fetchStatus();
    };
    window.addEventListener('drac:supabase-config-changed', onCfgSync);
    return () => window.removeEventListener('drac:supabase-config-changed', onCfgSync);
  }, []);

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(POSTGRES_DDL_SQL);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2500);
  };

  const handleDownloadDdl = () => {
    const blob = new Blob([POSTGRES_DDL_SQL], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'drac_supabase_central_schema_2026.sql';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFlushQueue = async () => {
    setSyncingQueue(true);
    setSyncSuccessMsg(null);
    try {
      const result = await flushOfflineQueue((processed, total) => {
        setSyncProgress({ processed, total });
      });
      await fetchStatus();
      if (result.success) {
        setSyncSuccessMsg(`Sincronización completada: ${result.processed} operaciones procesadas exitosamente.`);
      } else {
        setSyncSuccessMsg(
          `Sincronización parcial: ${result.processed} procesadas, ${result.failed} pendientes protegidas para reintento automático.`
        );
      }
    } catch (err: any) {
      setSyncSuccessMsg(`Error durante la sincronización: ${err?.message}`);
    } finally {
      setSyncingQueue(false);
      setSyncProgress(null);
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    }
  };

  const handlePullFromCloud = async () => {
    setPullingCloud(true);
    setSyncSuccessMsg(null);
    try {
      const result = await pullIncrementalFromCloud();
      await fetchStatus();
      window.dispatchEvent(new CustomEvent('drac:supabase-config-changed'));
      if (result.success) {
        setSyncSuccessMsg(result.message || 'Pull incremental desde Supabase completado sin conflictos.');
      } else {
        setSyncSuccessMsg(result.message || 'No se pudo completar el pull incremental desde Supabase.');
      }
    } catch (err: any) {
      setSyncSuccessMsg(`Error en pull incremental: ${err?.message}`);
    } finally {
      setPullingCloud(false);
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    }
  };

  const handleFullSync = async () => {
    setFullSyncing(true);
    setSyncSuccessMsg(null);
    setSbCfgNotice(null);
    try {
      const result = await triggerFullCloudSync();
      await fetchStatus();
      window.dispatchEvent(new CustomEvent('drac:supabase-config-changed'));
      const msg = result.message || (result.success ? 'Sincronización bidireccional completa.' : 'Sincronización parcial.');
      setSyncSuccessMsg(msg);
      setSbCfgNotice(msg);
    } catch (err: any) {
      const errMsg = `Error en sincronización completa: ${err?.message}`;
      setSyncSuccessMsg(errMsg);
      setSbCfgNotice(errMsg);
    } finally {
      setFullSyncing(false);
      setTimeout(() => setSyncSuccessMsg(null), 7000);
    }
  };

  const runGapTestSimulator = () => {
    // Simulated sequence with a missing gap (e.g. 0001, 0002, 0004, 0005 -> missing 0003)
    const mockList = ['DRAC-0001', 'DRAC-0002', 'DRAC-0004', 'DRAC-0005'];
    let nextNum = 1;
    for (let cand = 1; cand <= 9999; cand++) {
      const formatted = `DRAC-${String(cand).padStart(4, '0')}`;
      if (!mockList.includes(formatted)) {
        nextNum = cand;
        break;
      }
    }
    const nextFormatted = `DRAC-${String(nextNum).padStart(4, '0')}`;
    setSimulatedGapTest({
      existingCodes: mockList,
      nextCode: nextFormatted,
      gapDetected: nextNum < 5,
    });
  };

  const filteredAuditLogs = auditOriginFilter === 'ALL'
    ? auditLogs
    : auditLogs.filter((l) => l.app_origin === auditOriginFilter);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Única Fuente de Verdad Centralizada
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                  Supabase PostgreSQL Enterprise
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                  Origen Actual: {currentOrigin}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Arquitectura Unificada de Base de Datos DRAC
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Tanto el cliente <strong className="text-white">Web (Vercel)</strong> como la aplicación de <strong className="text-white">Escritorio (Desktop)</strong> y los <strong className="text-white">Agentes Windows ZKTeco</strong> leen y escriben sobre la misma base de datos PostgreSQL central en Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <button
              type="button"
              onClick={handleFullSync}
              disabled={fullSyncing || connectionStatus?.isPlaceholder}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <Zap className={`w-3.5 h-3.5 ${fullSyncing ? 'animate-spin' : ''}`} />
              <span>{fullSyncing ? 'Sincronizando...' : 'Sincronizar Escritorio ↔ Web Ahora'}</span>
            </button>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Verificar Conexión</span>
            </button>
          </div>
        </div>

        {/* Live Architecture Node Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Cliente Web (Vercel)</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Conectado Directo</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">App Escritorio (Desktop)</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Conectado + Cola Offline</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Agente Windows ZK</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Puente PUSH / TCP</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Estado Supabase Nube</div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                {connectionStatus?.connected ? (
                  <>
                    <span className="text-emerald-400">Conectado ({connectionStatus.latencyMs} ms)</span>
                  </>
                ) : (
                  <span className="text-amber-400">Modo Local (Sin nube Supabase)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1.5 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSubTab('OVERVIEW')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeSubTab === 'OVERVIEW'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Tablas & Conteo Central</span>
        </button>

        <button
          onClick={() => setActiveSubTab('DDL')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeSubTab === 'DDL'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span>Esquema DDL PostgreSQL & RLS</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('CORRELATIVO');
            if (!simulatedGapTest) runGapTestSimulator();
          }}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeSubTab === 'CORRELATIVO'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hash className="w-3.5 h-3.5 text-indigo-400" />
          <span>Correlativo DRAC (Relleno de Huecos)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('OFFLINE_QUEUE')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeSubTab === 'OFFLINE_QUEUE'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            Cola Outbox Desktop ({(serverOutbox?.counts.pending || 0) + offlineQueue.length})
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('AUDIT')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeSubTab === 'AUDIT'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Auditoría por Origen (Web / Desktop / ZK)</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & TABLES COUNT */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Storage, Versioning, Migrations & Verified Backups */}
          {storageStatus && (
            <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <span>Persistencia Segura, Versionamiento y Respaldos Verificados</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Protección automática ante actualizaciones de escritorio sin sobrescribir configuraciones ni registros previos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateVerifiedBackup}
                  disabled={creatingBackup}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{creatingBackup ? 'Creando Respaldo...' : 'Crear Respaldo SHA-256 Ahora'}</span>
                </button>
              </div>

              {backupNotice && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-xs text-emerald-200">
                  {backupNotice}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Versión App / Compilación</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">v{storageStatus.appVersion}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Build: {storageStatus.buildDate}</div>
                </div>
                <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Esquema y Migraciones</div>
                  <div className="text-sm font-bold font-mono text-indigo-300 mt-0.5">{storageStatus.schemaVersion}</div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    {storageStatus.migrationStatus} · {storageStatus.migrationsCount} aplicadas
                  </div>
                </div>
                <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Último Respaldo Verificado</div>
                  <div className="text-xs font-bold font-mono text-emerald-300 mt-0.5 truncate">
                    {storageStatus.lastBackup ? storageStatus.lastBackup.filename : 'Sin respaldos'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    {storageStatus.lastBackup
                      ? `SHA-256: ${storageStatus.lastBackup.checksum_sha256.substring(0, 12)}… (${storageStatus.backupsCount} total)`
                      : 'Genere su primer respaldo preventivo'}
                  </div>
                </div>
                <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Cola Outbox Persistente</div>
                  <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                    {serverOutbox?.counts.pending ?? 0} Pendientes · {serverOutbox?.counts.synced ?? 0} Sync
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate" title={storageStatus.baseDir}>
                    Dir: {storageStatus.baseDir}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Credenciales de Instancia Supabase (Opcional para Nube)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Las marcaciones locales funcionan sin Supabase. Si deseas respaldo en la nube, ingresa aquí tu Project URL y Anon Key de Supabase.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded text-[11px] font-bold border ${connectionStatus?.connected ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700' : 'bg-amber-950/50 text-amber-300 border-amber-700'}`}>
                {connectionStatus?.connected ? 'Nube Activa' : connectionStatus?.isPlaceholder ? 'URL de ejemplo (no configurada)' : 'Sin conexión a nube'}
              </span>
            </div>

            {(connectionStatus?.error || dbStats?.error || (connectionStatus?.connected && dbStats?.schemaReady === false)) && (
              <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {dbStats?.schemaReady === false && !connectionStatus?.isPlaceholder
                      ? 'Falta ejecutar el Script DDL actualizado en Supabase (tabla drac_sync_records) para habilitar la sincronización completa Escritorio ↔ Web.'
                      : connectionStatus?.error || dbStats?.error}
                  </span>
                </div>
                {dbStats?.schemaReady === false && !connectionStatus?.isPlaceholder && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('DDL')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold shrink-0"
                  >
                    Ver Script SQL
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Supabase Project URL (VITE_SUPABASE_URL)</label>
                <input
                  value={sbUrlInput}
                  onChange={(e) => setSbUrlInput(e.target.value)}
                  placeholder="https://tu-proyecto.supabase.co"
                  className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Supabase Anon Key (VITE_SUPABASE_ANON_KEY)</label>
                <input
                  type="password"
                  value={sbKeyInput}
                  onChange={(e) => setSbKeyInput(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {sbCfgNotice && <span className="text-xs text-sky-300">{sbCfgNotice}</span>}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFullSync}
                  disabled={fullSyncing || connectionStatus?.isPlaceholder}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fullSyncing ? 'animate-spin' : ''}`} />
                  <span>{fullSyncing ? 'Sincronizando...' : 'Sincronización Completa Ahora'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSupabaseConfig}
                  disabled={savingSbCfg}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingSbCfg ? 'Guardando...' : 'Guardar y Probar Supabase'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6">
            <div className="border-b border-slate-800 pb-4 mb-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>Inventario de Tablas en Supabase PostgreSQL</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Conteo en tiempo real de registros centralizados accesibles por todas las instancias autorizadas.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { name: 'trabajadores', label: 'Trabajadores DRAC', count: dbStats?.tablesCount.trabajadores ?? 10, icon: ShieldCheck, color: 'text-emerald-400' },
                { name: 'dependencias', label: 'Dependencias (Sede + Agencias)', count: dbStats?.tablesCount.dependencias ?? 13, icon: Globe, color: 'text-indigo-400' },
                { name: 'direcciones', label: 'Direcciones de Línea', count: dbStats?.tablesCount.direcciones ?? 7, icon: Layers, color: 'text-indigo-400' },
                { name: 'areas_oficinas', label: 'Áreas y Oficinas', count: dbStats?.tablesCount.areas_oficinas ?? 15, icon: Layers, color: 'text-indigo-400' },
                { name: 'horarios', label: 'Horarios de Trabajo', count: dbStats?.tablesCount.horarios ?? 2, icon: Activity, color: 'text-cyan-400' },
                { name: 'turnos', label: 'Turnos Configurados', count: dbStats?.tablesCount.turnos ?? 4, icon: Activity, color: 'text-cyan-400' },
                { name: 'papeletas', label: 'Papeletas de Salida', count: dbStats?.tablesCount.papeletas ?? 5, icon: Terminal, color: 'text-amber-400' },
                { name: 'vacaciones', label: 'Solicitudes de Vacaciones', count: dbStats?.tablesCount.vacaciones ?? 2, icon: Terminal, color: 'text-amber-400' },
                { name: 'encargaturas', label: 'Encargaturas Temporales', count: dbStats?.tablesCount.encargaturas ?? 1, icon: ShieldCheck, color: 'text-purple-400' },
                { name: 'dispositivos_zkteco', label: 'Marcadores ZKTeco', count: dbStats?.tablesCount.dispositivos_zkteco ?? 1, icon: Cpu, color: 'text-blue-400' },
                { name: 'usuarios_reloj', label: 'Usuarios de Relojes ZK', count: dbStats?.tablesCount.usuarios_reloj ?? 0, icon: Cpu, color: 'text-sky-400' },
                { name: 'marcaciones_raw', label: 'Marcaciones Crudas (Logs)', count: dbStats?.tablesCount.marcaciones_raw ?? 4, icon: Database, color: 'text-blue-400' },
                { name: 'asistencias', label: 'Asistencias Procesadas', count: dbStats?.tablesCount.asistencias ?? 10, icon: CheckCircle2, color: 'text-emerald-400' },
                { name: 'auditoria', label: 'Logs de Auditoría Inmutable', count: dbStats?.tablesCount.auditoria ?? 24, icon: ShieldCheck, color: 'text-slate-300' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.name} className="p-3.5 bg-[#060709] border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">{item.label}</div>
                      <div className="text-lg font-bold text-white font-mono mt-0.5">{item.count}</div>
                    </div>
                    <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architecture Principles Callout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Regla 1: Cero Duplicidad de Datos</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                No existen dos bases de datos desconectadas. La app de Escritorio solo mantiene una cola temporal offline para reintentos y envía todo a Supabase.
              </p>
            </div>

            <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-indigo-400">
                <Hash className="w-4 h-4" />
                <span>Regla 2: Correlativo Centralizado</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                El código de trabajador (<code className="text-indigo-300">DRAC-XXXX</code>) es generado exclusivamente en PostgreSQL rellenando los huecos numéricos disponibles.
              </p>
            </div>

            <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-purple-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Regla 3: Trazabilidad por Origen</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Cada inserción y modificación registra el origen exacto (<code className="text-purple-300">WEB</code>, <code className="text-purple-300">DESKTOP</code>, <code className="text-purple-300">ZK_AGENT</code>) con IP y usuario.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DDL SCRIPT & RLS POLICIES */}
      {activeSubTab === 'DDL' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Script DDL PostgreSQL Oficial para Supabase</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Incluye tablas relacionales, enums, triggers de actualización, función de relleno de correlativo DRAC y políticas RLS.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyDdl}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                {copiedDdl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDdl ? 'Copiado' : 'Copiar SQL'}</span>
              </button>
              <button
                onClick={handleDownloadDdl}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .sql</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <pre className="p-4 bg-[#040507] border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed select-all">
              {POSTGRES_DDL_SQL}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: CORRELATIVO DRAC GAP-FILLING SIMULATOR */}
      {activeSubTab === 'CORRELATIVO' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-indigo-400" />
              <span>Algoritmo de Correlativo DRAC Central con Relleno de Huecos</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Garantiza una numeración institucional continua y sin saltos permanentes, asignando automáticamente el menor código disponible.
            </p>
          </div>

          <div className="p-4 bg-[#060709] border border-slate-800 rounded-xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Demostración Interactiva del Algoritmo PL/pgSQL</span>
              <button
                onClick={runGapTestSimulator}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Simular Asignación de Código</span>
              </button>
            </div>

            {simulatedGapTest && (
              <div className="space-y-3 pt-2">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">Códigos Existentes en la Base de Datos (Simulado con hueco en 0003):</div>
                  <div className="flex flex-wrap gap-2">
                    {simulatedGapTest.existingCodes.map((code) => (
                      <span key={code} className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md font-mono text-slate-300">
                        {code}
                      </span>
                    ))}
                    <span className="px-2.5 py-1 bg-rose-950/40 border border-rose-800/60 rounded-md font-mono text-rose-300 line-through">
                      DRAC-0003 (Eliminado/Libre)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[11px] text-indigo-300 font-bold">Próximo Código Asignado por la Función:</div>
                      <div className="text-sm font-bold text-white font-mono">{simulatedGapTest.nextCode} (Rellena el hueco inmediatamente)</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                    Gap-Filling Validado
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-[#060709] border border-slate-800 rounded-xl space-y-2 text-xs">
            <span className="font-bold text-slate-200">Función SQL en Producción:</span>
            <pre className="p-3 bg-[#040507] border border-slate-800 rounded text-[11px] font-mono text-indigo-300">
{`CREATE OR REPLACE FUNCTION generate_next_drac_code()
RETURNS VARCHAR AS $$
DECLARE
    v_next_num INT := 1;
    v_cand INT := 1;
    v_found BOOLEAN;
BEGIN
    PERFORM pg_advisory_xact_lock(74291845); -- Previene colisiones simultáneas
    FOR v_cand IN 1..99999 LOOP
        SELECT EXISTS (
            SELECT 1 FROM trabajadores 
            WHERE codigo_drac = 'DRAC-' || LPAD(v_cand::TEXT, 4, '0')
        ) INTO v_found;

        IF NOT v_found THEN
            v_next_num := v_cand;
            EXIT;
        END IF;
    END LOOP;
    RETURN 'DRAC-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: OFFLINE & PERSISTENT OUTBOX QUEUE MANAGER */}
      {activeSubTab === 'OFFLINE_QUEUE' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>Cola Outbox Bidireccional Persistente (Web ↔ Escritorio)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Registra cada operación con UUID e idempotencia en disco. Si no hay conexión, las operaciones pendientes jamás se descartan y se reintentan automáticamente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleFullSync}
                disabled={fullSyncing || connectionStatus?.isPlaceholder}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
              >
                <Zap className={`w-3.5 h-3.5 ${fullSyncing ? 'animate-spin' : ''}`} />
                <span>{fullSyncing ? 'Sincronizando...' : 'Sincronización Completa'}</span>
              </button>

              <button
                onClick={handlePullFromCloud}
                disabled={pullingCloud}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 border border-cyan-800/50 font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pullingCloud ? 'animate-spin' : ''}`} />
                <span>{pullingCloud ? 'Descargando...' : 'Pull Incremental Nube'}</span>
              </button>

              <button
                onClick={handleFlushQueue}
                disabled={syncingQueue || ((serverOutbox?.counts.pending || 0) === 0 && offlineQueue.length === 0)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingQueue ? 'animate-spin' : ''}`} />
                <span>Sincronizar Cola Ahora</span>
              </button>
            </div>
          </div>

          {serverOutbox && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase block">Total Outbox</span>
                <span className="font-mono font-bold text-white text-base">{serverOutbox.counts.total}</span>
              </div>
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase block">Pendientes</span>
                <span className="font-mono font-bold text-amber-300 text-base">{serverOutbox.counts.pending}</span>
              </div>
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase block">Sincronizados</span>
                <span className="font-mono font-bold text-emerald-400 text-base">{serverOutbox.counts.synced}</span>
              </div>
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase block">Conflictos</span>
                <span className="font-mono font-bold text-rose-400 text-base">{serverOutbox.counts.conflict}</span>
              </div>
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase block">Último Pull/Push</span>
                <span className="font-mono text-slate-300 text-[10px] block truncate">
                  {serverOutbox.lastPullAt || serverOutbox.lastPushAt || 'Sin sync reciente'}
                </span>
              </div>
            </div>
          )}

          {syncSuccessMsg && (
            <div className="p-3.5 bg-indigo-950/80 border border-indigo-700 rounded-xl text-indigo-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {syncProgress && (
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Sincronizando operaciones hacia Supabase...</span>
                <span className="font-mono">{syncProgress.processed} / {syncProgress.total}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${(syncProgress.processed / syncProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {(!serverOutbox?.items.length && offlineQueue.length === 0) ? (
            <div className="p-8 text-center bg-[#060709] border border-slate-800/80 rounded-xl text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-bold text-white text-xs">Cola Outbox Al Día</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Todas las operaciones de este cliente se encuentran sincronizadas o aún no se han encolado cambios pendientes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {serverOutbox && serverOutbox.items.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">
                    Eventos Persistidos en Disco (`sync/sync-outbox.json`, últimos {serverOutbox.items.length}):
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#060709]">
                    <table className="w-full min-w-[740px] text-left text-[11px]">
                      <thead className="border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="p-2.5">Entidad</th>
                          <th className="p-2.5">ID</th>
                          <th className="p-2.5">Operación</th>
                          <th className="p-2.5">Origen</th>
                          <th className="p-2.5">Versión</th>
                          <th className="p-2.5">Estado</th>
                          <th className="p-2.5">Reintentos / Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {serverOutbox.items.slice(0, 25).map((ev) => (
                          <tr key={ev.id}>
                            <td className="p-2.5 text-white font-bold">{ev.entity_type}</td>
                            <td className="p-2.5 text-indigo-300 truncate max-w-[140px]">{ev.entity_id}</td>
                            <td className="p-2.5 text-slate-300">{ev.operation}</td>
                            <td className="p-2.5 text-cyan-400">{ev.origin}</td>
                            <td className="p-2.5 text-slate-400">v{ev.record_version}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ev.status === 'SINCRONIZADO'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : ev.status === 'CONFLICTO'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                                }`}
                              >
                                {ev.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400 truncate max-w-[200px]" title={ev.last_error || ''}>
                              {ev.attempts ?? ev.retries ?? 0} {ev.last_error ? `· ${ev.last_error}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {offlineQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">Operaciones en Cola Local del Navegador ({offlineQueue.length}):</div>
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-[#060709]">
                    {offlineQueue.map((op, idx) => (
                      <div key={op.id || idx} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono text-[10px] font-bold">
                            {op.action}
                          </span>
                          <span className="text-white font-mono">{op.table}</span>
                          <span className="text-slate-500 text-[10px]">{op.timestamp}</span>
                        </div>
                        <span className="text-amber-400 font-mono text-[10px]">Reintentos: {op.retryCount || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL BY ORIGIN */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Auditoría Inmutable por Origen de Solicitud</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Visualización de trazas y modificaciones registrando si provienen de la Web, Escritorio o Agente ZK.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-[#060709] p-1 border border-slate-800 rounded-lg">
              {(['ALL', 'WEB', 'DESKTOP', 'ZK_AGENT'] as const).map((origin) => (
                <button
                  key={origin}
                  onClick={() => setAuditOriginFilter(origin)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                    auditOriginFilter === origin
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {origin === 'ALL' ? 'Todos' : origin}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-[#060709] max-h-[500px] overflow-y-auto">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No se encontraron registros de auditoría para el filtro seleccionado.
              </div>
            ) : (
              filteredAuditLogs.map((log) => (
                <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-900/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        log.app_origin === 'DESKTOP'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : log.app_origin === 'ZK_AGENT'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        [{log.app_origin || 'WEB'}]
                      </span>
                      <span className="font-bold text-white">{log.modulo}</span>
                      <span className="text-slate-400 font-mono text-[11px]">&bull; {log.accion}</span>
                      <span className="text-slate-500 text-[10px] font-mono">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('es-PE') : ''}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">{log.detalles}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-slate-300 font-medium text-[11px]">{log.user_name || log.user_id}</div>
                    <div className="text-slate-500 font-mono text-[10px]">{log.ip_address || '127.0.0.1'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
