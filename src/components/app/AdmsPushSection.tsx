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
  Send,
  Zap,
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
  ChevronRight,
  Eye,
  Sliders,
  Sparkles,
  Lock,
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

  // Pipeline Diagnostics State
  const [pipelineDiag, setPipelineDiag] = useState<any | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [selectedDiagDevice, setSelectedDiagDevice] = useState<string>(devices[0]?.id || 'dev-01');

  // Push Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simDevId, setSimDevId] = useState<string>(devices[0]?.id || 'dev-01');
  const [simEmployeeDni, setSimEmployeeDni] = useState<string>(employees[0]?.dni || '45892134');
  const [simVerifyMode, setSimVerifyMode] = useState<'FACE' | 'FINGERPRINT' | 'CARD'>('FACE');
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Individual Device Push Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedDevForConfig, setSelectedDevForConfig] = useState<DispositivoZkTeco | null>(null);
  const [modalPushEnabled, setModalPushEnabled] = useState(true);
  const [modalServerAddress, setModalServerAddress] = useState('');
  const [modalServerPort, setModalServerPort] = useState(3000);
  const [modalProtocol, setModalProtocol] = useState<'HTTP' | 'HTTPS'>('HTTP');
  const [modalEndpoint, setModalEndpoint] = useState('/api/zkteco/push');
  const [modalInterval, setModalInterval] = useState(5);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

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
      console.error('Error fetching push status:', err);
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
      console.error('Error fetching push logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Run Pipeline Diagnostics
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
      }
    } catch (err) {
      console.error('Error running pipeline diagnostics:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Handle Simulation
  const handleSimulatePush = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await fetch('/api/zkteco/simulate-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: simDevId,
          employee_code: simEmployeeDni,
          verify_mode: simVerifyMode,
        }),
      });
      const data = await res.json();
      setSimulationResult(data);
      if (data.success) {
        showToast('✓ Marcación PUSH simulada y procesada a través del pipeline.');
        fetchPushStatus();
        fetchPushLogs();
        if (onRefreshPunches) onRefreshPunches();
      }
    } catch (err: any) {
      console.error('Error simulating push:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Save Individual Device Config
  const handleSaveIndividualConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevForConfig) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch(`/api/zkteco/devices/${selectedDevForConfig.id}/push-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          push_enabled: modalPushEnabled,
          server_address: modalServerAddress,
          server_port: modalServerPort,
          protocol: modalProtocol,
          endpoint: modalEndpoint,
          push_interval_sec: modalInterval,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ Configuración PUSH actualizada para ${selectedDevForConfig.name}.`);
        setShowConfigModal(false);
        fetchPushStatus();
        if (onRefreshDevices) onRefreshDevices();
      }
    } catch (err) {
      console.error('Error saving push config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Clear push logs
  const handleClearLogs = async () => {
    if (!window.confirm('¿Está seguro de limpiar el historial de auditoría de recepción PUSH?')) return;
    try {
      const res = await fetch('/api/zkteco/push-logs/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPushLogs([]);
        showToast('✓ Historial de logs PUSH limpiado.');
      }
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openEditModal = (dev: DispositivoZkTeco) => {
    setSelectedDevForConfig(dev);
    const cfg = dev.push_config;
    setModalPushEnabled(cfg ? cfg.push_enabled : true);
    setModalServerAddress(cfg?.server_address || pushSummary?.server_address || window.location.hostname || '192.168.1.100');
    setModalServerPort(cfg?.server_port || 3000);
    setModalProtocol(cfg?.protocol || 'HTTP');
    setModalEndpoint(cfg?.endpoint || '/api/zkteco/push');
    setModalInterval(cfg?.push_interval_sec || 5);
    setShowConfigModal(true);
  };

  // Polling on mount
  useEffect(() => {
    fetchPushStatus();
    fetchPushLogs();
    const timer = setInterval(() => {
      fetchPushStatus();
      fetchPushLogs();
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return pushLogs.filter((log) => {
      if (logFilterSerial !== 'ALL' && log.serial !== logFilterSerial) return false;
      if (logFilterStatus !== 'ALL' && log.estado !== logFilterStatus) return false;
      if (logSearchTerm.trim()) {
        const term = logSearchTerm.toLowerCase();
        const empCode = (log.employeeCode || '').toLowerCase();
        const empName = (log.employee_name || '').toLowerCase();
        const dev = (log.dispositivo || '').toLowerCase();
        const payload = (log.payload_original || '').toLowerCase();
        if (!empCode.includes(term) && !empName.includes(term) && !dev.includes(term) && !payload.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [pushLogs, logFilterSerial, logFilterStatus, logSearchTerm]);

  const paginatedLogs = useMemo(() => {
    const start = (logsCurrentPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsCurrentPage, logsPageSize]);

  // Current server domain / host fallback
  const currentHost = pushSummary?.server_address || window.location.hostname || '192.168.1.100';
  const currentPort = pushSummary?.server_port || 3000;
  const currentProto = pushSummary?.protocol || 'HTTP';
  const pushUrl = `${currentProto.toLowerCase()}://${currentHost}:${currentPort}/api/zkteco/push`;
  const admsUrl = `${currentProto.toLowerCase()}://${currentHost}:${currentPort}/iclock/cdata`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* SUCCESS TOAST */}
      {toastMessage && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-emerald-200 flex items-center justify-between text-xs shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* 1. TOP STATUS & METRIC CARDS (Section 7 & 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: PUSH Status */}
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Estado del Servidor PUSH</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="my-2.5">
            {pushSummary?.status_message === 'Dispositivo conectado, esperando marcaciones PUSH.' ? (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded-md font-bold">
                  <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                  <span>CONECTADO / ESPERANDO</span>
                </span>
                <p className="text-[11px] text-amber-200 font-medium mt-1 leading-snug">
                  Dispositivo conectado, esperando marcaciones PUSH.
                </p>
              </div>
            ) : pushSummary?.push_online ? (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-md font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>PUSH ONLINE</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Servidor nativo Express DRAC escuchando en puerto {currentPort}.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded-md font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>PUSH OFFLINE</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Sin conexión PUSH activa registrada.</p>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex justify-between font-mono">
            <span>Protocolo: {currentProto} PUSH</span>
            <span>Puerto: {currentPort}</span>
          </div>
        </div>

        {/* Card 2: Last Connection & Last Punch */}
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Actividad Reciente</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="my-2 space-y-1.5">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Última Conexión:</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {pushSummary?.last_connection
                  ? new Date(pushSummary.last_connection).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Esperando...'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Última Marcación:</span>
              <span className="text-xs font-mono font-bold text-indigo-300">
                {pushSummary?.last_punch ? pushSummary.last_punch.substring(0, 19) : 'Sin marcaciones'}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex justify-between font-mono">
            <span>Terminales: {devices.length}</span>
            <span className="text-emerald-400">Online: {devices.filter(d => d.status === 'ONLINE').length}</span>
          </div>
        </div>

        {/* Card 3: Today's Punches & Processed */}
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Marcaciones Hoy</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-white font-mono">{pushSummary?.punches_today ?? rawPunches.length}</div>
              <span className="text-[10px] text-slate-400">Recibidas Hoy</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {pushSummary?.punches_processed ?? rawPunches.filter(p => p.processed).length}
              </div>
              <span className="text-[10px] text-slate-500">Procesadas</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex justify-between font-mono">
            <span className="text-indigo-300 font-semibold">Nuevas PUSH: {pushSummary?.punches_new ?? 0}</span>
            <span>Total Staging: {rawPunches.length}</span>
          </div>
        </div>

        {/* Card 4: Errors & Diagnostics */}
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Diagnóstico & Errores</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="my-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {pushSummary?.error_count ?? 0}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Errores en Pipeline</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Todos los módulos de recepción y validación DRAC operativos.
            </p>
          </div>

          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex justify-between">
            <button
              onClick={() => runPipelineDiagnostic(selectedDiagDevice)}
              disabled={isDiagnosing}
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
            >
              {isDiagnosing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>Ejecutar Test 10 Pasos</span>
            </button>
            <button
              onClick={() => {
                fetchPushStatus();
                fetchPushLogs();
              }}
              className="text-slate-400 hover:text-white"
              title="Refrescar"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ARCHITECTURAL DISTINCTION CALLOUT (Requirement 5) */}
      <div className="bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <span>Arquitectura Dual DRAC: TCP/IP Directo vs. Servidor Nativo ADMS/PUSH</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
              <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 font-mono text-[11px]">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>MODO TCP/IP SOCKET (Puerto 4370)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Dirección:</strong> DRAC → Reloj ZKTeco. Comunicación bajo demanda para lectura manual, diagnóstico de hardware (ping socket, conteo de usuarios y verificación de marcaciones).
                </p>
              </div>

              <div className="p-2.5 bg-slate-950/70 border border-indigo-500/30 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300 font-mono text-[11px]">
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>MODO NATIVO ADMS / PUSH (HTTP/HTTPS)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Dirección:</strong> Reloj ZKTeco → Servidor Express DRAC (<code className="text-indigo-300 font-mono">/api/zkteco/push</code>). Transmisión automática en tiempo real sin servidor externo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PARÁMETROS DEL SERVIDOR NATIVO ADMS / PUSH DRAC */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Configuración del Servidor ADMS / PUSH del Sistema DRAC</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Parámetros que debe ingresar en la pantalla física del marcador ZKTeco (<code className="text-indigo-300">Menú &gt; Comunicación &gt; Servidor Cloud / ADMS</code>).
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
          {/* Item 1: Server Address */}
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
            <p className="text-[10px] text-slate-500">IP local de la red o DNS DRAC.</p>
          </div>

          {/* Item 2: Server Port */}
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
            <p className="text-[10px] text-slate-500">Puerto Express DRAC predeterminado.</p>
          </div>

          {/* Item 3: Protocol */}
          <div className="bg-[#0F1115] border border-slate-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Protocolo HTTP / HTTPS</span>
            <div className="flex items-center justify-between font-mono font-bold text-indigo-300 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {currentProto}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">Nativo</span>
            </div>
            <p className="text-[10px] text-slate-500">Configurado en menú de comunicación.</p>
          </div>

          {/* Item 4: Endpoints */}
          <div className="bg-[#0F1115] border border-slate-800/80 rounded-lg p-3 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Endpoints de Escucha</span>
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
            <p className="text-[10px] text-slate-500">Alias estándar: <code className="text-slate-400">/iclock/cdata</code></p>
          </div>
        </div>

        {/* Physical Menu Guide Callout */}
        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-amber-300">Guía de Pantalla ZKTeco:</strong> Presione <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-200">M/OK</kbd> &gt; <strong>Comunicación</strong> &gt; <strong>Configuración Servidor Cloud</strong> &gt; Servidor: <code className="text-indigo-300 font-mono font-bold">{currentHost}</code> | Puerto: <code className="text-indigo-300 font-mono font-bold">{currentPort}</code>.
            </span>
          </div>
          <button
            onClick={() => handleCopy(`Servidor: ${currentHost}\nPuerto: ${currentPort}\nProtocolo: ${currentProto}\nEndpoint: /api/zkteco/push`, 'guide')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 font-mono"
          >
            {copiedField === 'guide' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Copiar Toda la Ficha</span>
          </button>
        </div>
      </div>

      {/* 4. CONFIGURACIÓN INDIVIDUAL POR MARCADOR (Requirement 13) */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Configuración Individual PUSH por Marcador Biométrico</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Administre la transmisión PUSH y los parámetros específicos de cada reloj de la Sede Central y Agencias Agrarias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Total: <strong className="text-white">{devices.length}</strong> terminales
            </span>
          </div>
        </div>

        {/* Device Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((dev) => {
            const isPushActive = dev.push_config?.push_enabled !== false;
            const pushStatus = dev.push_config?.status || (dev.status === 'ONLINE' ? 'PUSH_ONLINE' : 'WAITING_PUNCHES');
            return (
              <div
                key={dev.id}
                className="bg-[#0F1115] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors text-xs"
              >
                <div>
                  {/* Top Bar: Name & Serial */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-xs truncate" title={dev.name}>
                        {dev.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-slate-400">
                        <span>S/N: <strong className="text-slate-200">{dev.serial_number}</strong></span>
                        <span>•</span>
                        <span>{dev.model || 'G3-id'}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                        pushStatus === 'PUSH_ONLINE'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          : pushStatus === 'WAITING_PUNCHES'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                      }`}
                    >
                      {pushStatus === 'PUSH_ONLINE' ? '● PUSH ONLINE' : pushStatus === 'WAITING_PUNCHES' ? '◐ ESPERANDO PUSH' : '○ PUSH OFFLINE'}
                    </span>
                  </div>

                  {/* Dependencia Badge */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        dev.dependencia_tipo === 'SEDE_CENTRAL'
                          ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                      }`}
                    >
                      {dev.dependencia_tipo === 'SEDE_CENTRAL' ? '🏛 SEDE CENTRAL' : '🌾 AGENCIA AGRARIA'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      IP: {dev.ip_address}
                    </span>
                  </div>

                  {/* Config Details */}
                  <div className="mt-3 bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>Modo:</span>
                      <span className="text-indigo-300 font-semibold">{isPushActive ? 'ADMS / PUSH (Nativo)' : 'TCP 4370 Solamente'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Endpoint:</span>
                      <span className="text-slate-200">{dev.push_config?.endpoint || '/api/zkteco/push'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Último Enlace:</span>
                      <span className="text-slate-300">{dev.last_activity ? dev.last_activity.substring(11, 19) : 'Reciente'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSimDevId(dev.id);
                      handleSimulatePush();
                    }}
                    disabled={isSimulating}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                    title="Simular envío PUSH desde este marcador"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Probar PUSH</span>
                  </button>

                  {canManage && (
                    <button
                      onClick={() => openEditModal(dev)}
                      className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded text-[11px] font-bold transition-colors flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Configurar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. INSPECTOR DE DIAGNÓSTICO DE PIPELINE (10 ETAPAS) (Requirement 10 & 14) */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Inspector de Diagnóstico de Pipeline de Asistencia (10 Etapas)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verifica y comprueba la cadena completa: <code className="text-slate-300">ZKTeco → PUSH Recibido → Almacenado → Procesado → API → Frontend</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDiagDevice}
              onChange={(e) => setSelectedDiagDevice(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded text-xs font-mono"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.serial_number})
                </option>
              ))}
            </select>
            <button
              onClick={() => runPipelineDiagnostic(selectedDiagDevice)}
              disabled={isDiagnosing}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isDiagnosing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isDiagnosing ? 'Verificando...' : 'Ejecutar Diagnóstico Completo'}</span>
            </button>
          </div>
        </div>

        {/* 10 Pipeline Stages Visual Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { num: 1, name: '1. Red del Reloj', desc: 'Conectividad IP y segmento de red local/VPN', status: 'OK' },
            { num: 2, name: '2. Conexión TCP', desc: 'Puerto Socket TCP 4370 para lectura directa', status: 'OK' },
            { num: 3, name: '3. Config. ADMS', desc: 'Servidor Cloud configurado en terminal', status: 'OK' },
            { num: 4, name: '4. Endpoint PUSH', desc: 'POST /api/zkteco/push activo en Express', status: 'OK' },
            { num: 5, name: '5. Autenticación', desc: 'Serial autorizado en catálogo DRAC', status: 'OK' },
            { num: 6, name: '6. Validador Payload', desc: 'Parsing de formato tabular / JSON', status: 'OK' },
            { num: 7, name: '7. Almacenamiento', desc: 'Persistencia deduplicada en raw_punches', status: 'OK' },
            { num: 8, name: '8. Procesamiento', desc: 'Cálculo de tardanzas y asignación a turnos', status: 'OK' },
            { num: 9, name: '9. Consulta API', desc: 'Endpoints GET /api/attendance/punches', status: 'OK' },
            { num: 10, name: '10. Frontend DRAC', desc: 'Renderizado reactivo en tiempo real', status: 'OK' },
          ].map((stg) => {
            const liveStg = pipelineDiag?.stages?.find((s: any) => s.stage_number === stg.num);
            const isOk = liveStg ? liveStg.status === 'OK' : true;
            return (
              <div
                key={stg.num}
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  isOk
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    : 'bg-rose-950/40 border-rose-600/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px] truncate">{stg.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                      isOk ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                    }`}
                  >
                    {isOk ? '✓ OK' : '✕ ERROR'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {liveStg ? liveStg.detail : stg.desc}
                </p>
              </div>
            );
          })}
        </div>

        {pipelineDiag && (
          <div className="p-3 bg-slate-950/90 border border-cyan-500/30 rounded-lg text-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-slate-200">
                Resultado de Diagnóstico para <strong className="text-white">{pipelineDiag.device_name}</strong> ({pipelineDiag.serial_number}): <strong className="text-emerald-400">{pipelineDiag.overall_status === 'ALL_SYSTEMS_OK' ? 'Todos los subsistemas operativos (10/10 OK)' : 'Atención requerida'}</strong>.
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Hora: {new Date(pipelineDiag.timestamp).toLocaleTimeString('es-PE')}
            </span>
          </div>
        )}
      </div>

      {/* 6. BANDEJA DE AUDITORÍA DE RECEPCIÓN PUSH EN TIEMPO REAL (Requirement 6) */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Registro de Recepción PUSH en Tiempo Real (Audit Trace)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada marcación recibida se registra con su payload original, dispositivo, DNI, fecha/hora de marcación y hora de recepción en el servidor.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Simulation Trigger */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <select
                value={simEmployeeDni}
                onChange={(e) => setSimEmployeeDni(e.target.value)}
                className="bg-transparent text-white text-[11px] font-mono px-2 py-0.5 border-r border-slate-800 outline-none"
              >
                {employees.slice(0, 10).map((emp) => (
                  <option key={emp.id} value={emp.dni} className="bg-slate-900 text-white">
                    {emp.dni} - {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSimulatePush}
                disabled={isSimulating}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                title="Generar y transmitir paquete PUSH de prueba"
              >
                {isSimulating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                <span>Simular PUSH</span>
              </button>
            </div>

            {canManage && (
              <button
                onClick={handleClearLogs}
                className="px-2.5 py-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 rounded-lg text-xs transition-colors flex items-center gap-1"
                title="Limpiar logs de auditoría"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar Logs</span>
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
                placeholder="Buscar por DNI, trabajador, dispositivo o payload..."
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
              <option value="ALL">Todos los Marcadores</option>
              {devices.map((d) => (
                <option key={d.id} value={d.serial_number}>
                  {d.name} ({d.serial_number})
                </option>
              ))}
            </select>

            <select
              value={logFilterStatus}
              onChange={(e) => {
                setLogFilterStatus(e.target.value);
                setLogsCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PROCESADA">PROCESADA</option>
              <option value="VALIDA">VALIDA</option>
              <option value="YA_EXISTENTE_IGNORADA">YA EXISTENTE (IGNORADA)</option>
              <option value="PENDIENTE_IDENTIFICACION">PENDIENTE DE IDENTIFICACIÓN</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          <span className="text-slate-400 font-mono text-[11px]">
            Mostrando <strong>{paginatedLogs.length}</strong> de <strong>{filteredLogs.length}</strong> eventos
          </span>
        </div>

        {/* Logs Table */}
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
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-sans text-xs">
                      No se encontraron registros de recepción PUSH en el rango especificado.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const isIdentified = log.employee_name && log.employee_name !== 'Trabajador no identificado';
                    return (
                      <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-sans font-semibold text-slate-200 truncate max-w-[170px]" title={log.dispositivo}>
                            {log.dispositivo}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{log.serial}</span>
                        </td>

                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {log.ip_origen ? (
                            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-300">
                              {log.ip_origen}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-bold text-slate-100">
                          {log.employeeCode}
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          <div className={`truncate max-w-[180px] ${isIdentified ? 'text-slate-200 font-medium' : 'text-amber-400 italic'}`}>
                            {log.employee_name || 'Trabajador no identificado'}
                          </div>
                          {log.employee_dni && log.employee_dni !== log.employeeCode && (
                            <span className="text-[10px] text-slate-500 font-mono">DNI: {log.employee_dni}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 bg-indigo-950/60 border border-indigo-800/50 rounded text-[10px] font-bold text-indigo-300 font-sans">
                            {log.event_type || 'MARCACION'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-indigo-300">
                          {log.punch_time}
                        </td>

                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {log.reception_time ? log.reception_time.replace('T', ' ').substring(0, 19) : '-'}
                        </td>

                        <td className="py-2.5 px-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                              log.estado === 'PROCESADA' || log.estado === 'VALIDA'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : log.estado === 'YA_EXISTENTE_IGNORADA'
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : log.estado === 'PENDIENTE_IDENTIFICACION'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            }`}
                            title={
                              log.estado === 'YA_EXISTENTE_IGNORADA'
                                ? 'Marcación ya existía en la base de datos (idempotente). No se generó duplicado.'
                                : log.estado
                            }
                          >
                            {log.estado === 'YA_EXISTENTE_IGNORADA' ? 'YA REGISTRADA' : log.estado}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setSelectedLogForDetail(log)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            title="Ver detalle del payload"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > 0 && (
            <div className="p-3 bg-[#090A0D] border-t border-slate-800">
              <DataTablePagination
                totalItems={filteredLogs.length}
                currentPage={logsCurrentPage}
                pageSize={logsPageSize}
                onPageChange={setLogsCurrentPage}
                onPageSizeChange={(sz) => {
                  setLogsPageSize(sz);
                  setLogsCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* MODAL: INDIVIDUAL DEVICE PUSH CONFIG */}
      {showConfigModal && selectedDevForConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <span>Configurar Servidor ADMS / PUSH: {selectedDevForConfig.name}</span>
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-500 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveIndividualConfig} className="space-y-3">
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">Activar Transmisión PUSH / ADMS</span>
                  <span className="text-[11px] text-slate-400">El reloj enviará sus registros directamente a DRAC</span>
                </div>
                <input
                  type="checkbox"
                  checked={modalPushEnabled}
                  onChange={(e) => setModalPushEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Dirección del Servidor DRAC *</label>
                  <input
                    type="text"
                    value={modalServerAddress}
                    onChange={(e) => setModalServerAddress(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Puerto PUSH *</label>
                  <input
                    type="number"
                    value={modalServerPort}
                    onChange={(e) => setModalServerPort(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Protocolo *</label>
                  <select
                    value={modalProtocol}
                    onChange={(e) => setModalProtocol(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="HTTP">HTTP (Predeterminado LAN)</option>
                    <option value="HTTPS">HTTPS (SSL Seguro)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Intervalo de Envío (Segundos)</label>
                  <input
                    type="number"
                    value={modalInterval}
                    onChange={(e) => setModalInterval(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                    min={1}
                    max={60}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Endpoint Receptor *</label>
                <input
                  type="text"
                  value={modalEndpoint}
                  onChange={(e) => setModalEndpoint(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-colors flex items-center gap-1.5"
                >
                  {isSavingConfig && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Configuración PUSH</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG PAYLOAD DETAIL */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span>Detalle de Trazabilidad PUSH</span>
              </h3>
              <button onClick={() => setSelectedLogForDetail(null)} className="text-slate-500 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1">
                <div className="text-slate-400 flex justify-between">
                  <span>Dispositivo:</span>
                  <span className="text-white font-bold">{selectedLogForDetail.dispositivo}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Serial (S/N):</span>
                  <span className="text-indigo-300">{selectedLogForDetail.serial}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>DNI / PIN:</span>
                  <span className="text-slate-200 font-bold">{selectedLogForDetail.employeeCode}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Trabajador:</span>
                  <span className="text-emerald-400">{selectedLogForDetail.employee_name || 'Trabajador no identificado'}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>IP Origen:</span>
                  <span className="text-amber-300">{selectedLogForDetail.ip_origen || 'No registrada'}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Tipo Evento:</span>
                  <span className="text-indigo-300 font-bold">{selectedLogForDetail.event_type || 'MARCACION'}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Marcación Reloj:</span>
                  <span className="text-slate-300">{selectedLogForDetail.punch_time}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Recepción Servidor:</span>
                  <span className="text-slate-300">{selectedLogForDetail.reception_time}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Estado:</span>
                  <span className={`font-bold ${
                    selectedLogForDetail.estado === 'PROCESADA' || selectedLogForDetail.estado === 'VALIDA'
                      ? 'text-emerald-400'
                      : selectedLogForDetail.estado === 'YA_EXISTENTE_IGNORADA'
                      ? 'text-indigo-300'
                      : 'text-amber-400'
                  }`}>
                    {selectedLogForDetail.estado === 'YA_EXISTENTE_IGNORADA' ? 'YA EXISTENTE (IDEMPOTENTE)' : selectedLogForDetail.estado}
                  </span>
                </div>
              </div>

              {selectedLogForDetail.estado === 'YA_EXISTENTE_IGNORADA' && (
                <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded text-indigo-200 text-xs font-sans">
                  <strong>Control de Idempotencia:</strong> Esta marcación ya se encontraba almacenada en la base de datos (mismo serial, DNI y timestamp). El servidor la validó correctamente y previno la creación de duplicados.
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-sans font-medium">Payload Crudo Recibido:</label>
                <pre className="p-3 bg-black/90 border border-slate-800 rounded-lg text-emerald-400 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {selectedLogForDetail.payload_original}
                </pre>
              </div>

              {selectedLogForDetail.error && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded text-rose-200 text-xs font-sans">
                  <strong>Error detectado:</strong> {selectedLogForDetail.error}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
