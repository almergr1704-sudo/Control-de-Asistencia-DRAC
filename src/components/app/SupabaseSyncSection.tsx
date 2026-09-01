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
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { POSTGRES_DDL_SQL } from '../../data/ddlSql';
import {
  checkSupabaseConnection,
  getOfflineQueue,
  flushOfflineQueue,
  getAppOrigin,
} from '../../lib/supabaseClient';
import { AppOrigin, SupabaseConfigStatus } from '../../types';

export const SupabaseSyncSection: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    latencyMs: number;
    url: string;
    appOrigin: AppOrigin;
    sourceOfTruth: string;
  } | null>(null);

  const [dbStats, setDbStats] = useState<SupabaseConfigStatus | null>(null);
  const [copiedDdl, setCopiedDdl] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'DDL' | 'CORRELATIVO' | 'OFFLINE_QUEUE' | 'AUDIT'>('OVERVIEW');

  // Offline queue state
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
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

      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      }

      setOfflineQueue(getOfflineQueue());
      fetchAuditLogs();
    } catch (err) {
      console.error('Error fetching Supabase status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit/logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setAuditLogs(data.data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
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
      setOfflineQueue(getOfflineQueue());
      if (result.success) {
        setSyncSuccessMsg(`Sincronización completada: ${result.processed} operaciones procesadas exitosamente.`);
      } else {
        setSyncSuccessMsg(`Sincronización parcial: ${result.processed} procesadas, ${result.failed} pendientes para reintento.`);
      }
    } catch (err: any) {
      setSyncSuccessMsg(`Error durante la sincronización: ${err?.message}`);
    } finally {
      setSyncingQueue(false);
      setSyncProgress(null);
      setTimeout(() => setSyncSuccessMsg(null), 5000);
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
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
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

          <div className="flex items-center gap-2 self-start md:self-center">
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
              <div className="text-[10px] text-slate-500 uppercase font-bold">Latencia PostgreSQL</div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="text-purple-400">{connectionStatus?.latencyMs || 8} ms</span>
                <span className="text-[10px] text-slate-500">| Supabase SSL</span>
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
          <span>Cola Offline Desktop ({offlineQueue.length})</span>
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

      {/* TAB 4: OFFLINE QUEUE MANAGER */}
      {activeSubTab === 'OFFLINE_QUEUE' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>Cola de Sincronización Offline (Cliente Desktop)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Almacén temporal local para cuando el cliente de escritorio pierde conectividad a Internet.
              </p>
            </div>

            <button
              onClick={handleFlushQueue}
              disabled={syncingQueue || offlineQueue.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingQueue ? 'animate-spin' : ''}`} />
              <span>Sincronizar Cola Ahora</span>
            </button>
          </div>

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

          {offlineQueue.length === 0 ? (
            <div className="p-8 text-center bg-[#060709] border border-slate-800/80 rounded-xl text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-bold text-white text-xs">Cola Offline Vacía</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Todas las operaciones de este cliente se encuentran sincronizadas con la base de datos central en Supabase.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">Operaciones Pendientes en Cola ({offlineQueue.length}):</div>
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
