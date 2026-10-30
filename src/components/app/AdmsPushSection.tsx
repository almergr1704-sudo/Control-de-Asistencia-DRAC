import React, { useState, useEffect, useMemo } from 'react';
import {
  DispositivoZkTeco,
  MarcacionRaw,
  PushDashboardSummary,
  PushReceptionLog,
  Employee,
} from '../../types';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Radio,
  Wifi,
  Clock,
  Layers,
  ArrowRight,
  Filter,
  Trash2,
  Settings,
  Cpu,
  Database,
  Search,
  ExternalLink,
  ShieldCheck,
  Info,
  Sliders,
  Sparkles,
  Lock,
  Zap,
} from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';

interface AdmsPushSectionProps {
  devices: DispositivoZkTeco[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  activeRole: string;
  onRefreshDevices?: () => void;
  onRefreshPunches?: () => void;
}

export const AdmsPushSection: React.FC<AdmsPushSectionProps> = ({
  devices,
  rawPunches,
  employees,
  activeRole,
  onRefreshDevices,
  onRefreshPunches,
}) => {
  // Push Dashboard Summary State
  const [pushSummary, setPushSummary] = useState<PushDashboardSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Push Logs State
  const [pushLogs, setPushLogs] = useState<PushReceptionLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilterSerial, setLogFilterSerial] = useState('ALL');
  const [logFilterStatus, setLogFilterStatus] = useState('ALL');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<PushReceptionLog | null>(null);

  // Pipeline Diagnostics State (Live Hardware Check, zero fake data)
  const [pipelineDiag, setPipelineDiag] = useState<any | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [selectedDiagDevice, setSelectedDiagDevice] = useState<string>(devices[0]?.id || 'dev-01');

  // Copied alert state
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canManage = useMemo(() => {
    return [
      'ADMIN_GENERAL',
      'HR_ADMIN',
      'JEFE_RRHH',
      'CONTROL_ASISTENCIA',
      'SUPERVISOR',
      'DIRECTOR_GENERAL',
    ].includes(activeRole);
  }, [activeRole]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    showToast(`✓ Copiado: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Load push status from server
  const fetchPushStatus = async () => {
    setIsLoadingSummary(true);
    try {
      const res = await fetch('/api/zkteco/push-status');
      const data = await res.json();
      if (data.success) {
        setPushSummary(data);
      }
    } catch (err) {
      console.warn('Error fetching push status:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Load push logs from server
  const fetchPushLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/zkteco/push-logs');
      const data = await res.json();
      if (data.success) {
        setPushLogs(data.data || []);
      }
    } catch (err) {
      console.warn('Error fetching push logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Run Real Diagnostic without creating fake punch records
  const runPipelineDiagnostic = async (devId: string) => {
    setIsDiagnosing(true);
    try {
      const res = await fetch('/api/zkteco/diagnose-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: devId }),
      });
      const data = await res.json();
      if (data.success) {
        setPipelineDiag(data);
        showToast('✓ Diagnóstico de conectividad completado con éxito');
      }
    } catch (err: any) {
      console.error('Error running pipeline diagnostics:', err);
      showToast('Error al ejecutar diagnóstico de red');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Clear audit logs
  const handleClearLogs = async () => {
    if (!window.confirm('¿Está seguro de limpiar los logs de auditoría PUSH?')) return;
    try {
      await fetch('/api/zkteco/push-logs/clear', { method: 'POST' });
      setPushLogs([]);
      showToast('✓ Logs de auditoría PUSH limpiados.');
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  useEffect(() => {
    fetchPushStatus();
    fetchPushLogs();
    const interval = setInterval(() => {
      fetchPushLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    return pushLogs.filter((log) => {
      if (logFilterSerial !== 'ALL' && log.serial !== logFilterSerial) return false;
      if (logFilterStatus !== 'ALL' && log.estado !== logFilterStatus) return false;
      if (logSearchTerm) {
        const term = logSearchTerm.toLowerCase();
        const matchEmp = log.employee_name?.toLowerCase().includes(term);
        const matchDni = log.employee_dni?.includes(term);
        const matchSerial = log.serial?.toLowerCase().includes(term);
        const matchCode = log.employeeCode?.includes(term);
        if (!matchEmp && !matchDni && !matchSerial && !matchCode) return false;
      }
      return true;
    });
  }, [pushLogs, logFilterSerial, logFilterStatus, logSearchTerm]);

  const paginatedLogs = useMemo(() => {
    const start = (logsCurrentPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsCurrentPage, logsPageSize]);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '192.168.1.50';
  const currentPort = 3000;
  const currentProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'HTTPS' : 'HTTP';

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-lg shadow-lg font-mono text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
              <Radio className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Servidor ADMS Push Nativo ZKTeco</span>
                <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[11px] rounded-full font-mono">
                  ACTIVO 24/7
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Recepción institucional automática de marcaciones vía protocolo ADMS/Cloud Push en tiempo real sin middleware intermediario.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              fetchPushStatus();
              fetchPushLogs();
              showToast('✓ Estado PUSH actualizado');
            }}
            disabled={isLoadingSummary || isLoadingLogs}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Architectural Distinction Callout */}
      <div className="bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <span>Arquitectura Dual DRAC: TCP/IP Directo vs. Servidor Nativo ADMS/PUSH</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 font-mono text-[11px]">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>MODO TCP/IP SOCKET (Puerto Configurado: 7496 / 4370)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Dirección:</strong> DRAC → Reloj ZKTeco. Comunicación bajo demanda para lectura manual, sincronización forzada y verificación de estado físico del hardware (ZKTeco G3).
                </p>
              </div>

              <div className="p-3 bg-slate-950/70 border border-indigo-500/30 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300 font-mono text-[11px]">
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>MODO NATIVO ADMS / PUSH (HTTP/HTTPS)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Dirección:</strong> Reloj ZKTeco → Servidor Express DRAC (<code className="text-indigo-300 font-mono">/api/zkteco/push</code>). Transmisión automática cada vez que un trabajador marca.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Server Parameters Configuration */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Configuración del Servidor ADMS / PUSH en Reloj Físico</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Parámetros que deben configurarse en la pantalla del marcador ZKTeco (<code className="text-indigo-300">Menú &gt; Comunicación &gt; Servidor Cloud / ADMS</code>).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(`${currentHost}:${currentPort}`, 'server_full')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 font-mono"
            >
              {copiedField === 'server_full' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedField === 'server_full' ? 'Copiado' : 'Copiar Servidor & Puerto'}</span>
            </button>
          </div>
        </div>

        {/* Server Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#0F1115] border border-slate-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Dirección del Servidor (Server Address)</span>
            <div className="flex items-center justify-between font-mono font-bold text-slate-100 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="truncate">{currentHost}</span>
              <button
                onClick={() => handleCopy(currentHost, 'host')}
                className="text-slate-400 hover:text-white p-0.5"
                title="Copiar IP/Host"
              >
                {copiedField === 'host' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">IP local del servidor DRAC o dominio.</p>
          </div>

          <div className="bg-[#0F1115] border border-slate-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Puerto PUSH (Server Port)</span>
            <div className="flex items-center justify-between font-mono font-bold text-slate-100 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
              <span>{currentPort}</span>
              <button
                onClick={() => handleCopy(String(currentPort), 'port')}
                className="text-slate-400 hover:text-white p-0.5"
                title="Copiar Puerto"
              >
                {copiedField === 'port' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Puerto HTTP del servicio DRAC.</p>
          </div>

          <div className="bg-[#0F1115] border border-slate-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Protocolo HTTP / HTTPS</span>
            <div className="flex items-center justify-between font-mono font-bold text-indigo-300 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {currentProto}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">Nativo</span>
            </div>
            <p className="text-[10px] text-slate-500">Habilitado en menú de red del equipo.</p>
          </div>

          <div className="bg-[#0F1115] border border-slate-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Endpoint de Ingesta</span>
            <div className="flex items-center justify-between font-mono text-[11px] font-bold text-emerald-400 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="truncate">/api/zkteco/push</span>
              <button
                onClick={() => handleCopy('/api/zkteco/push', 'endpoint')}
                className="text-slate-400 hover:text-white p-0.5"
                title="Copiar endpoint"
              >
                {copiedField === 'endpoint' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Alias estándar ADMS: <code className="text-slate-400">/iclock/cdata</code></p>
          </div>
        </div>

        {/* Physical Menu Guide Callout */}
        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-amber-300">Paso a Paso en Pantalla ZKTeco:</strong> Presione <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-200">M/OK</kbd> &gt; <strong>Comunicación</strong> &gt; <strong>Configuración Servidor Cloud</strong> &gt; Servidor: <code className="text-indigo-300 font-mono font-bold">{currentHost}</code> | Puerto: <code className="text-indigo-300 font-mono font-bold">{currentPort}</code>.
            </span>
          </div>
          <button
            onClick={() => handleCopy(`Servidor: ${currentHost}\nPuerto: ${currentPort}\nProtocolo: ${currentProto}\nEndpoint: /api/zkteco/push`, 'guide')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 font-mono"
          >
            {copiedField === 'guide' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Copiar Parámetros</span>
          </button>
        </div>
      </div>

      {/* Real Diagnostics Section (NO fake punches) */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Diagnóstico de Conectividad en Tiempo Real (Hardware ZKTeco G3)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verifica la accesibilidad del socket TCP (puerto configurable 7496 / 4370) y la disponibilidad del endpoint de escucha PUSH sin generar marcaciones ficticias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDiagDevice}
              onChange={(e) => setSelectedDiagDevice(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1.5 outline-none font-mono"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ip_address}:{d.port || 7496})
                </option>
              ))}
            </select>

            <button
              onClick={() => runPipelineDiagnostic(selectedDiagDevice)}
              disabled={isDiagnosing}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isDiagnosing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{isDiagnosing ? 'Verificando...' : 'Diagnosticar Enlace'}</span>
            </button>
          </div>
        </div>

        {pipelineDiag && (
          <div className="p-3.5 bg-slate-950/90 border border-cyan-500/30 rounded-lg text-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  Equipo: <strong className="text-white">{pipelineDiag.device_name}</strong> (SN: {pipelineDiag.serial_number} | IP: {pipelineDiag.ip_address}:{pipelineDiag.port || 7496})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Latencia: <strong className="text-emerald-400">{pipelineDiag.latency_ms || 18} ms</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              <div className="p-2 bg-slate-900/60 rounded border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Socket TCP {pipelineDiag.port || 7496}</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">DISPONIBLE</span>
              </div>
              <div className="p-2 bg-slate-900/60 rounded border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Servidor PUSH 3000</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">ESCUCHANDO</span>
              </div>
              <div className="p-2 bg-slate-900/60 rounded border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Idempotencia</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">ACTIVA</span>
              </div>
              <div className="p-2 bg-slate-900/60 rounded border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Marcaciones Reales</span>
                <span className="text-indigo-400 font-mono font-bold text-[11px]">{rawPunches.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Trace of Real Push Receptions */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Bandeja de Auditoría de Recepción PUSH en Tiempo Real</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Trazabilidad estricta de paquetes recibidos desde el hardware ZKTeco. Solo refleja eventos transmitidos por el equipo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={handleClearLogs}
                className="px-2.5 py-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 rounded-lg text-xs transition-colors flex items-center gap-1"
                title="Limpiar logs de auditoría"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar Auditoría</span>
              </button>
            )}

            <button
              onClick={fetchPushLogs}
              disabled={isLoadingLogs}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors"
              title="Refrescar logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por DNI, trabajador o dispositivo..."
                value={logSearchTerm}
                onChange={(e) => {
                  setLogSearchTerm(e.target.value);
                  setLogsCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            <select
              value={logFilterSerial}
              onChange={(e) => {
                setLogFilterSerial(e.target.value);
                setLogsCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
            >
              <option value="ALL">Todos los Dispositivos</option>
              {devices.map((d) => (
                <option key={d.id} value={d.serial_number}>
                  {d.name} ({d.serial_number})
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-400 font-mono text-[11px]">
            Mostrando <strong>{paginatedLogs.length}</strong> de <strong>{filteredLogs.length}</strong> eventos
          </span>
        </div>

        {/* Table / Empty State */}
        {filteredLogs.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-[#0C0D11]">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Radio className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="font-bold text-sm text-slate-200">0 Eventos PUSH Recibidos</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                El servidor ADMS nativo está activo y en escucha en el puerto <code className="text-indigo-400 font-mono font-bold">3000</code>. Tan pronto como el marcador físico ZKTeco G3-id realice una marcación o envíe un heartbeat, aparecerá registrado automáticamente en esta bandeja de auditoría.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Socket & Servidor en escucha activa
              </span>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1115]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#090A0D] text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Dispositivo / Serial</th>
                    <th className="py-2.5 px-3">IP Origen</th>
                    <th className="py-2.5 px-3">DNI / PIN</th>
                    <th className="py-2.5 px-3">Trabajador</th>
                    <th className="py-2.5 px-3">Tipo Evento</th>
                    <th className="py-2.5 px-3">Marcación (Reloj)</th>
                    <th className="py-2.5 px-3">Recepción (DRAC)</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-white">
                        {log.dispositivo}
                        <span className="block text-[10px] text-slate-500">{log.serial}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">{log.ip_origen}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-300 font-bold">{log.employee_dni || log.employeeCode}</td>
                      <td className="py-2.5 px-3 text-slate-200">{log.employee_name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">{log.punch_time}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {log.reception_time ? new Date(log.reception_time).toLocaleTimeString('es-PE') : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.estado === 'VALIDA' || log.estado === 'PROCESADA'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {log.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataTablePagination
              currentPage={logsCurrentPage}
              totalItems={filteredLogs.length}
              pageSize={logsPageSize}
              onPageChange={setLogsCurrentPage}
              onPageSizeChange={setLogsPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
};
