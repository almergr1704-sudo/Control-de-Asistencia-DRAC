import React, { useState, useEffect, useCallback } from 'react';
import {
  BioTimeAuthMethod,
  BioTimeConnectionStatus,
  BioTimeDeviceSummary,
  BioTimeDownloadResult,
  BioTimePortProbeResult,
  BioTimeProtocol,
  BioTimePublicConfig,
  BioTimeTestReport,
} from '../../types';
import { getApiUrl } from '../../utils/apiConfig';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Lock,
  Radar,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';

interface BioTimeProPanelProps {
  activeRole?: string;
  onRefreshDevices?: () => void;
  onRefreshPunches?: () => void;
  onNavigateToUsers?: () => void;
  onConfigSaved?: (cfg: BioTimePublicConfig) => void;
}

const PORT_PRESETS = [8088, 89, 8000, 8080];

const STATUS_META: Record<
  BioTimeConnectionStatus,
  { label: string; badgeClass: string; desc: string }
> = {
  CONECTADO: {
    label: 'CONECTADO',
    badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/70',
    desc: 'Autenticación BioTime PRO verificada y API REST de solo lectura operativa.',
  },
  NO_CONECTADO: {
    label: 'NO_CONECTADO',
    badgeClass: 'bg-slate-900 text-slate-300 border-slate-700',
    desc: 'Sin enlace verificado con el servidor BioTime PRO.',
  },
  PUERTO_INACCESIBLE: {
    label: 'PUERTO_INACCESIBLE',
    badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-700/70',
    desc: 'El puerto TCP configurado está cerrado, rechazado o bloqueado por firewall.',
  },
  ERROR_AUTENTICACION: {
    label: 'ERROR_AUTENTICACION',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-700/70',
    desc: 'El puerto Web respondió, pero las credenciales o el método de autenticación fueron rechazados.',
  },
  API_NO_DISPONIBLE: {
    label: 'API_NO_DISPONIBLE',
    badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-700/70',
    desc: 'Se alcanzó el servidor pero no expone los endpoints REST esperados de BioTime PRO.',
  },
  TIMEOUT: {
    label: 'TIMEOUT',
    badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-700/70',
    desc: 'Tiempo de espera agotado al intentar contactar el servidor BioTime PRO.',
  },
  CONFIGURACION_INCOMPLETA: {
    label: 'CONFIGURACION_INCOMPLETA',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-700/70',
    desc: 'Faltan parámetros obligatorios (IP, puerto HTTP válido o credenciales de acceso).',
  },
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const getDaysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const BioTimeProPanel: React.FC<BioTimeProPanelProps> = ({
  onRefreshDevices,
  onRefreshPunches,
  onNavigateToUsers,
  onConfigSaved,
}) => {
  const [host, setHost] = useState('192.168.1.29');
  const [httpPortInput, setHttpPortInput] = useState('8088');
  const [protocol, setProtocol] = useState<BioTimeProtocol>('http');
  const [authMethod, setAuthMethod] = useState<BioTimeAuthMethod>('AUTO');
  const [authUser, setAuthUser] = useState('admin');
  const [authPassword, setAuthPassword] = useState('');
  const [hasStoredAuthPassword, setHasStoredAuthPassword] = useState(false);
  const [clearAuthPassword, setClearAuthPassword] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  const [pgPortInput, setPgPortInput] = useState('7496');
  const [pgDbName, setPgDbName] = useState('biotime');
  const [pgUser, setPgUser] = useState('postgres');
  const [pgPassword, setPgPassword] = useState('');
  const [hasStoredPgPassword, setHasStoredPgPassword] = useState(false);
  const [clearPgPassword, setClearPgPassword] = useState(false);
  const [showPgPassword, setShowPgPassword] = useState(false);

  const [timeoutMsInput, setTimeoutMsInput] = useState('8000');
  const [storageMode, setStorageMode] = useState<string>('');
  const [updatedAt, setUpdatedAt] = useState<string>('');

  const [status, setStatus] = useState<BioTimeConnectionStatus>('NO_CONECTADO');
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    text: string;
  } | null>(null);

  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingPorts, setIsDetectingPorts] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isQueryingDevices, setIsQueryingDevices] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [portProbeResults, setPortProbeResults] = useState<BioTimePortProbeResult[]>([]);
  const [recommendedPort, setRecommendedPort] = useState<number | null>(null);
  const [testReport, setTestReport] = useState<BioTimeTestReport | null>(null);

  const [bioTimeDevices, setBioTimeDevices] = useState<BioTimeDeviceSummary[]>([]);
  const [startDate, setStartDate] = useState(getDaysAgoIso(7));
  const [endDate, setEndDate] = useState(getTodayIso());
  const [selectedSerial, setSelectedSerial] = useState('');
  const [downloadResult, setDownloadResult] = useState<BioTimeDownloadResult | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);

  const parsedHttpPort = Number(httpPortInput);
  const parsedPgPort = Number(pgPortInput);
  const parsedTimeout = Number(timeoutMsInput);

  const applyLoadedConfig = useCallback((cfg: BioTimePublicConfig) => {
    if (!cfg) return;
    setHost(cfg.host || '192.168.1.29');
    setHttpPortInput(String(cfg.httpPort || 8088));
    setProtocol(cfg.protocol === 'https' ? 'https' : 'http');
    setAuthMethod(cfg.authMethod || 'AUTO');
    setAuthUser(cfg.authUser ?? '');
    setHasStoredAuthPassword(Boolean(cfg.has_auth_password));
    setAuthPassword('');
    setClearAuthPassword(false);

    setPgPortInput(String(cfg.pgPort || 7496));
    setPgDbName(cfg.pgDbName || 'biotime');
    setPgUser(cfg.pgUser || 'postgres');
    setHasStoredPgPassword(Boolean(cfg.has_pg_password));
    setPgPassword('');
    setClearPgPassword(false);

    setTimeoutMsInput(String(cfg.timeoutMs || 8000));
    setStorageMode(cfg.storage_mode || '');
    setUpdatedAt(cfg.updated_at || '');
    if (cfg.lastStatus) {
      setStatus(cfg.lastStatus);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI?.isDesktop && typeof electronAPI.getBioTimeConfig === 'function') {
        const res = await electronAPI.getBioTimeConfig();
        const cfg = (res as any)?.config ? (res as any).config : (res as BioTimePublicConfig);
        applyLoadedConfig(cfg);
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/biotime/config'));
        const data = await res.json();
        if (data?.config) applyLoadedConfig(data.config);
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'warning',
        title: 'No se pudo cargar configuración previa',
        text: err?.message || 'Se mantienen valores predeterminados editables.',
      });
    } finally {
      setIsLoadingConfig(false);
    }
  }, [applyLoadedConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const validateFields = (requireCredentials = false): string | null => {
    const cleanHost = host.trim();
    if (!cleanHost) return 'Debe ingresar la dirección IP o hostname del servidor BioTime PRO.';
    if (!Number.isInteger(parsedHttpPort) || parsedHttpPort < 1 || parsedHttpPort > 65535) {
      return 'El Puerto Web HTTP/HTTPS debe ser un número entero entre 1 y 65535.';
    }
    if (!Number.isInteger(parsedPgPort) || parsedPgPort < 1 || parsedPgPort > 65535) {
      return 'El Puerto PostgreSQL debe ser un número entero entre 1 y 65535.';
    }
    if (requireCredentials && !authUser.trim()) {
      return 'Ingrese el Usuario Web de BioTime PRO para autenticar la API.';
    }
    if (requireCredentials && !authPassword && !hasStoredAuthPassword) {
      return 'Ingrese la Contraseña Web de BioTime PRO (o verifique si ya se encuentra almacenada).';
    }
    return null;
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {
      host: host.trim(),
      httpPort: parsedHttpPort,
      protocol,
      authMethod,
      authUser: authUser.trim(),
      pgPort: parsedPgPort,
      pgDbName: pgDbName.trim() || 'biotime',
      pgUser: pgUser.trim() || 'postgres',
      timeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout >= 1000 ? parsedTimeout : 8000,
    };
    if (authPassword.length > 0) {
      payload.authPassword = authPassword;
    } else if (clearAuthPassword) {
      payload.clear_auth_password = true;
    }
    if (pgPassword.length > 0) {
      payload.pgPassword = pgPassword;
    } else if (clearPgPassword) {
      payload.clear_pg_password = true;
    }
    return payload;
  };

  const handleSaveConfig = async () => {
    const err = validateFields(false);
    if (err) {
      setValidationError(err);
      setStatus('CONFIGURACION_INCOMPLETA');
      return;
    }
    setValidationError(null);
    setIsSaving(true);
    setBannerMessage(null);
    try {
      const payload = buildPayload();
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      let res: any;
      if (electronAPI?.isDesktop && typeof electronAPI.saveBioTimeConfig === 'function') {
        res = await electronAPI.saveBioTimeConfig(payload);
      } else {
        const httpRes = await fetch(getApiUrl('/api/zkteco/biotime/config'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        res = await httpRes.json();
      }
      if (res?.success && res?.config) {
        applyLoadedConfig(res.config);
        onConfigSaved?.(res.config);
        try {
          localStorage.setItem(
            'drac_biotime_settings',
            JSON.stringify({
              host: res.config.host,
              webPort: res.config.httpPort,
              dbPort: res.config.pgPort,
              dbName: res.config.pgDbName,
              dbUser: res.config.pgUser,
              webUser: res.config.authUser,
            })
          );
          window.dispatchEvent(new CustomEvent('drac:biotime-config-changed', { detail: res.config }));
        } catch (_) {}
        setBannerMessage({
          type: 'success',
          title: 'Configuración guardada',
          text: res.message || `Guardado para ${res.config.protocol.toUpperCase()}://${res.config.host}:${res.config.httpPort}.`,
        });
      } else {
        setBannerMessage({
          type: 'error',
          title: 'Error al guardar configuración',
          text: res?.message || 'No se pudo persistir la configuración.',
        });
      }
    } catch (e: any) {
      setBannerMessage({
        type: 'error',
        title: 'Fallo de guardado',
        text: e?.message || 'Error inesperado de red o IPC.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDetectPorts = async () => {
    if (!host.trim()) {
      setValidationError('Ingrese la IP o host de BioTime PRO antes de escanear puertos.');
      return;
    }
    setValidationError(null);
    setIsDetectingPorts(true);
    setBannerMessage(null);
    setPortProbeResults([]);
    try {
      const candidates = Array.from(
        new Set([
          ...(Number.isInteger(parsedHttpPort) && parsedHttpPort >= 1 && parsedHttpPort <= 65535
            ? [parsedHttpPort]
            : []),
          8088,
          89,
          8000,
          8080,
          80,
          443,
          8090,
          8888,
        ])
      );
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      let data: any;
      if (electronAPI?.isDesktop && typeof electronAPI.detectBioTimePorts === 'function') {
        data = await electronAPI.detectBioTimePorts({
          host: host.trim(),
          protocol,
          configuredPort: Number.isInteger(parsedHttpPort) ? parsedHttpPort : 8088,
          ports: candidates,
          timeoutMs: 3000,
        });
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/biotime/detect-ports'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: host.trim(),
            protocol,
            httpPort: Number.isInteger(parsedHttpPort) ? parsedHttpPort : 8088,
            ports: candidates,
            timeoutMs: 3000,
          }),
        });
        data = await res.json();
      }
      const list: BioTimePortProbeResult[] = data?.results || data?.ports || [];
      const rec = data?.recommendedPort ?? data?.recommended_port ?? null;
      setPortProbeResults(list);
      setRecommendedPort(rec);
      setBannerMessage({
        type: rec ? 'success' : 'warning',
        title: rec ? `Puerto recomendado: ${rec}` : 'Sin respuesta HTTP de BioTime',
        text: data?.message || 'Escaneo de puertos completado.',
      });
    } catch (e: any) {
      setBannerMessage({
        type: 'error',
        title: 'Error detectando puertos',
        text: e?.message || 'No se pudo completar el sondeo TCP/HTTP.',
      });
    } finally {
      setIsDetectingPorts(false);
    }
  };

  const handleTestConnection = async () => {
    const err = validateFields(false);
    if (err) {
      setValidationError(err);
      setStatus('CONFIGURACION_INCOMPLETA');
      return;
    }
    setValidationError(null);
    setIsTesting(true);
    setBannerMessage(null);
    try {
      const payload = buildPayload();
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      let report: BioTimeTestReport;
      if (electronAPI?.isDesktop && typeof electronAPI.testBioTimeConnection === 'function') {
        report = await electronAPI.testBioTimeConnection(payload);
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/biotime/test-connection'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        report = await res.json();
      }
      setTestReport(report);
      setStatus(report.status || (report.success ? 'CONECTADO' : 'NO_CONECTADO'));
      setBannerMessage({
        type: report.success ? 'success' : report.status === 'ERROR_AUTENTICACION' ? 'warning' : 'error',
        title: `Estado: ${report.status}`,
        text: report.message,
      });
    } catch (e: any) {
      setStatus('NO_CONECTADO');
      setBannerMessage({
        type: 'error',
        title: 'Error al probar conexión',
        text: e?.message || 'Fallo de red ejecutando el diagnóstico.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleQueryDevices = async () => {
    const err = validateFields(true);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setIsQueryingDevices(true);
    setBannerMessage(null);
    try {
      const payload = buildPayload();
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      let data: any;
      if (electronAPI?.isDesktop && typeof electronAPI.queryBioTimeDevices === 'function') {
        data = await electronAPI.queryBioTimeDevices(payload);
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/biotime/devices'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
      }
      if (data?.status) setStatus(data.status);
      if (data?.success) {
        const list = Array.isArray(data.devices) ? data.devices : [];
        setBioTimeDevices(list);
        setStatus('CONECTADO');
        setBannerMessage({
          type: 'success',
          title: `Terminales consultados (${list.length})`,
          text: data.message || 'Listado real recuperado en modo solo lectura desde BioTime PRO.',
        });
        onRefreshDevices?.();
      } else {
        setBannerMessage({
          type: 'error',
          title: 'No se pudieron consultar terminales',
          text: data?.message || 'BioTime PRO no devolvió dispositivos.',
        });
      }
    } catch (e: any) {
      setBannerMessage({
        type: 'error',
        title: 'Error consultando BioTime',
        text: e?.message || 'Error inesperado de comunicación.',
      });
    } finally {
      setIsQueryingDevices(false);
    }
  };

  const handleDownloadPunches = async () => {
    const err = validateFields(true);
    if (err) {
      setValidationError(err);
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setValidationError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    setValidationError(null);
    setIsDownloading(true);
    setBannerMessage(null);
    try {
      const payload = {
        ...buildPayload(),
        startDate,
        endDate,
        serial: selectedSerial.trim().toUpperCase(),
      };
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      let data: BioTimeDownloadResult;
      if (electronAPI?.isDesktop && typeof electronAPI.downloadBioTimePunches === 'function') {
        data = await electronAPI.downloadBioTimePunches(payload);
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/biotime/download-punches'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
      }
      setDownloadResult(data);
      if (data?.status) setStatus(data.status);
      if (data?.success) {
        setStatus('CONECTADO');
        setBannerMessage({
          type: 'success',
          title: 'Descarga de marcaciones completada',
          text: data.message,
        });
        onRefreshPunches?.();
      } else {
        setBannerMessage({
          type: 'error',
          title: 'Descarga detenida',
          text: data?.message || 'No se pudieron descargar marcaciones de BioTime PRO.',
        });
      }
    } catch (e: any) {
      setBannerMessage({
        type: 'error',
        title: 'Error en descarga',
        text: e?.message || 'Fallo de red descargando transacciones.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const statusMeta = STATUS_META[status] || STATUS_META.NO_CONECTADO;

  return (
    <div className="space-y-6">
      {/* 1. HEADER & DESCRIPTION */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Conexión y Sincronización con BioTime PRO
                </h3>
                <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Configure manualmente el puerto HTTP/HTTPS donde atiende su instalación de BioTime PRO (ej. 8088, 89, 8000, 8080 o personalizado), independiente del puerto interno PostgreSQL (ej. 7496). Todas las consultas operan en modo estricto de <strong>solo lectura</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={loadConfig}
              disabled={isLoadingConfig}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingConfig ? 'animate-spin' : ''}`} />
              <span>Recargar Config.</span>
            </button>
            {onNavigateToUsers && (
              <button
                type="button"
                onClick={onNavigateToUsers}
                className="px-3.5 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Consultar Usuarios BioTime</span>
              </button>
            )}
          </div>
        </div>

        {/* TELEMETRY SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Endpoint Web API</span>
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-sm font-mono font-bold text-white truncate">
              {protocol}://{host || '—'}:{httpPortInput || '—'}
            </div>
            <div className="text-[11px] text-slate-400">Método: {authMethod}</div>
          </div>

          <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>PostgreSQL BioTime</span>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-mono font-bold text-emerald-300 truncate">
              {host || '—'}:{pgPortInput || '7496'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              BD: {pgDbName || 'biotime'} ({pgUser || 'postgres'})
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Diagnóstico Verificado</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {testReport ? `${testReport.latency_ms} ms` : 'Sin probar'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{statusMeta.desc}</div>
          </div>

          <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Almacenamiento Seguro</span>
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xs font-mono font-bold text-cyan-300 truncate">
              {storageMode || 'Cifrado Local'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {updatedAt
                ? `Act: ${new Date(updatedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
                : 'Listo para configurar'}
            </div>
          </div>
        </div>
      </div>

      {/* VALIDATION OR STATUS BANNER */}
      {(validationError || bannerMessage) && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            validationError || bannerMessage?.type === 'error'
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              : bannerMessage?.type === 'warning'
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              : bannerMessage?.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {validationError || bannerMessage?.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : bannerMessage?.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-bold text-white">
                {validationError ? 'Validación de parámetros' : bannerMessage?.title}
              </div>
              <div className="leading-relaxed">{validationError || bannerMessage?.text}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setValidationError(null);
              setBannerMessage(null);
            }}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. CONFIGURATION FORM & PRIMARY ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card A: HTTP/HTTPS BioTime PRO */}
        <div className="lg:col-span-7 bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>1. Parámetros Web & Autenticación BioTime PRO</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400">API REST /iclock/api/</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">
                IP o Host del Servidor BioTime <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.29"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-[11px] font-bold text-slate-300">
                  Puerto Web (Manual 1–65535) <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {PORT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHttpPortInput(String(preset))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        Number(httpPortInput) === preset
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={65535}
                value={httpPortInput}
                onChange={(e) => setHttpPortInput(e.target.value)}
                placeholder="89 o 8088"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">Protocolo</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value === 'https' ? 'https' : 'http')}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="http">HTTP (Estándar LAN BioTime)</option>
                <option value="https">HTTPS (TLS/SSL)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">Método de Autenticación</label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as BioTimeAuthMethod)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="AUTO">AUTO (JWT → Token DRF → Sesión Web)</option>
                <option value="JWT">JWT (/jwt-api-token-auth/)</option>
                <option value="DRF_TOKEN">DRF Token (/api-token-auth/)</option>
                <option value="DJANGO_SESSION">Sesión Web Django (/login/)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">Usuario BioTime PRO</label>
              <input
                type="text"
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-[11px] font-bold text-slate-300">Contraseña BioTime PRO</label>
                {hasStoredAuthPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setClearAuthPassword((prev) => !prev);
                      setAuthPassword('');
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      clearAuthPassword
                        ? 'bg-rose-900/60 text-rose-300'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {clearAuthPassword ? 'Se limpiará al guardar' : 'Guardada cifrada (Limpiar)'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    if (e.target.value) setClearAuthPassword(false);
                  }}
                  placeholder={hasStoredAuthPassword ? '•••••••• (dejar vacío para conservar)' : 'Ingrese contraseña de BioTime'}
                  className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: PostgreSQL Independiente & Timeout */}
        <div className="lg:col-span-5 bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>2. PostgreSQL BioTime (Independiente)</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Solo lectura</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">Puerto PostgreSQL</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={pgPortInput}
                  onChange={(e) => setPgPortInput(e.target.value)}
                  placeholder="7496"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">Timeout de Red (ms)</label>
                <input
                  type="number"
                  min={1500}
                  max={30000}
                  step={500}
                  value={timeoutMsInput}
                  onChange={(e) => setTimeoutMsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">Base de Datos PG</label>
                <input
                  type="text"
                  value={pgDbName}
                  onChange={(e) => setPgDbName(e.target.value)}
                  placeholder="biotime"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">Usuario PG</label>
                <input
                  type="text"
                  value={pgUser}
                  onChange={(e) => setPgUser(e.target.value)}
                  placeholder="postgres"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-[11px] font-bold text-slate-300">Contraseña PostgreSQL (Opcional)</label>
                {hasStoredPgPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setClearPgPassword((prev) => !prev);
                      setPgPassword('');
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      clearPgPassword
                        ? 'bg-rose-900/60 text-rose-300'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {clearPgPassword ? 'Se limpiará al guardar' : 'Guardada cifrada (Limpiar)'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPgPassword ? 'text' : 'password'}
                  value={pgPassword}
                  onChange={(e) => {
                    setPgPassword(e.target.value);
                    if (e.target.value) setClearPgPassword(false);
                  }}
                  placeholder={hasStoredPgPassword ? '•••••••• (dejar vacío para conservar)' : 'Contraseña PostgreSQL'}
                  className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPgPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPgPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              En <strong>BioTime Platform Service Console</strong>, la pestaña <em>SERVICE</em> muestra el puerto Web (ej. 89 u 8088), mientras que <em>DATABASE</em> muestra PostgreSQL (ej. 7496). Ambos se configuran por separado aquí.
            </span>
          </div>
        </div>
      </div>

      {/* PRIMARY ACTION BUTTON BAR */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDetectPorts}
            disabled={isDetectingPorts}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Radar className={`w-4 h-4 text-cyan-400 ${isDetectingPorts ? 'animate-spin' : ''}`} />
            <span>{isDetectingPorts ? 'Detectando puertos...' : 'Detectar puertos disponibles'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Activity className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Probando 7 etapas...' : 'Probar conexión'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar configuración'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleQueryDevices}
          disabled={isQueryingDevices}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
        >
          <HardDrive className={`w-4 h-4 ${isQueryingDevices ? 'animate-spin' : ''}`} />
          <span>{isQueryingDevices ? 'Consultando terminales...' : 'Consultar Dispositivos BioTime'}</span>
        </button>
      </div>

      {/* 3. PORT DETECTION RESULTS TABLE */}
      {portProbeResults.length > 0 && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Radar className="w-4 h-4 text-cyan-400" />
              <span>Puertos Evaluados en {host}</span>
            </h4>
            {recommendedPort && (
              <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 px-2.5 py-0.5 rounded">
                Recomendado: Puerto {recommendedPort}
              </span>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-x-auto bg-[#060709]">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Puerto</th>
                  <th className="px-3 py-2.5">TCP</th>
                  <th className="px-3 py-2.5">Respuesta HTTP</th>
                  <th className="px-3 py-2.5">BioTime PRO</th>
                  <th className="px-3 py-2.5">Latencia</th>
                  <th className="px-3 py-2.5">Diagnóstico</th>
                  <th className="px-3 py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {portProbeResults.map((p) => {
                  const isHttpOk = Boolean(p.http_responded ?? p.http_responds);
                  const isBt = Boolean(p.biotime_detected ?? p.is_biotime);
                  const httpCode = p.status_code ?? p.http_status;
                  return (
                    <tr key={p.port} className="hover:bg-slate-900/40">
                      <td className="px-3 py-2.5 font-mono font-bold text-white">{p.port}</td>
                      <td className="px-3 py-2.5 font-mono">
                        <span className={p.tcp_open ? 'text-emerald-400' : 'text-rose-400'}>
                          {p.tcp_open ? 'ABIERTO' : 'CERRADO'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {isHttpOk ? `HTTP ${httpCode ?? 'OK'}` : 'Sin respuesta'}
                      </td>
                      <td className="px-3 py-2.5">
                        {isBt ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            DETECTADO
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No confirmado</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {p.latency_ms != null ? `${p.latency_ms} ms` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{p.detail}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setHttpPortInput(String(p.port));
                            if (p.port === 443) setProtocol('https');
                          }}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap"
                        >
                          Usar puerto
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 7-STAGE DIAGNOSTIC CHECKLIST */}
      {testReport && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                {testReport.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
                <span>Resultado del Diagnóstico en 7 Etapas — {testReport.status}</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">{testReport.message}</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 shrink-0">
              {testReport.authMethodUsed && <span>Auth: {testReport.authMethodUsed}</span>}
              {testReport.total_terminals !== undefined && (
                <span>Terminales: {testReport.total_terminals}</span>
              )}
              {testReport.total_transactions !== undefined && (
                <span>Marcaciones: {testReport.total_transactions}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {testReport.stages.map((st) => (
              <div
                key={st.stage}
                className="p-3 rounded-xl bg-[#0F1117] border border-slate-800 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {st.status === 'PASSED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : st.status === 'WARNING' ? (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : st.status === 'SKIPPED' ? (
                    <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">
                      {st.stage}. {st.name}
                    </div>
                    <div className="text-[11px] text-slate-400 break-words mt-0.5">{st.message}</div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                    st.status === 'PASSED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : st.status === 'WARNING'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : st.status === 'SKIPPED'
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {st.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. DISPOSITIVOS EN BIOTIME PRO */}
      {bioTimeDevices.length > 0 && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Dispositivos Reportados por BioTime PRO ({bioTimeDevices.length})</span>
            </h4>
            <span className="text-[11px] text-slate-400">Lectura directa de /iclock/api/terminals/</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-x-auto bg-[#060709]">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Número de Serie</th>
                  <th className="px-3 py-2.5">Alias / Nombre</th>
                  <th className="px-3 py-2.5">IP Reloj</th>
                  <th className="px-3 py-2.5">Área BioTime</th>
                  <th className="px-3 py-2.5 text-right">Usuarios</th>
                  <th className="px-3 py-2.5 text-right">Marcaciones</th>
                  <th className="px-3 py-2.5">Última Actividad</th>
                  <th className="px-3 py-2.5 text-right">Filtro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {bioTimeDevices.map((dev) => (
                  <tr key={String(dev.sn || dev.id)} className="hover:bg-slate-900/40">
                    <td className="px-3 py-2.5 font-mono font-bold text-indigo-300">{dev.sn}</td>
                    <td className="px-3 py-2.5 text-white font-semibold">{dev.alias || 'Sin alias'}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{dev.ip_address || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-300">{dev.area_name || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-cyan-300">
                      {dev.user_count ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-300">
                      {dev.transaction_count ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400 text-[11px]">
                      {dev.last_activity || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSerial(dev.sn || '')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap"
                      >
                        Usar S/N
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. READ-ONLY PUNCH DOWNLOAD BY DATE RANGE */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Descarga Paginada de Marcaciones Reales (Solo Lectura)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Lee transacciones reales desde BioTime PRO por rango de fechas, evita duplicados y vincula automáticamente cada PIN con el padrón institucional DRAC. No modifica ni borra registros en BioTime.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300">Fecha Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300">Fecha Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300">S/N Dispositivo (Opcional)</label>
            <input
              type="text"
              value={selectedSerial}
              onChange={(e) => setSelectedSerial(e.target.value)}
              placeholder="Todos los relojes (o ej. AEH2223460040)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleDownloadPunches}
              disabled={isDownloading}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-spin' : ''}`} />
              <span>{isDownloading ? 'Descargando páginas...' : 'Descargar Marcaciones Reales'}</span>
            </button>
          </div>
        </div>

        {downloadResult && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Leídas BioTime</div>
              <div className="text-base font-mono font-bold text-white mt-0.5">{downloadResult.read_count}</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-700/40">
              <div className="text-[10px] font-bold uppercase text-emerald-300">Nuevas Guardadas</div>
              <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">{downloadResult.new_count}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Duplicadas Omitidas</div>
              <div className="text-base font-mono font-bold text-slate-300 mt-0.5">
                {downloadResult.duplicates_skipped ?? downloadResult.duplicate_count ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-700/40">
              <div className="text-[10px] font-bold uppercase text-amber-300">Pendientes Vincular</div>
              <div className="text-base font-mono font-bold text-amber-400 mt-0.5">
                {downloadResult.unidentified_count ?? downloadResult.pending_count ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0F1117] border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Páginas API</div>
              <div className="text-base font-mono font-bold text-cyan-300 mt-0.5">
                {downloadResult.pages_fetched ?? 1}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
