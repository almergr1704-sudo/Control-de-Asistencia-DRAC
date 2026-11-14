import React, { useState, useMemo, useRef } from 'react';
import { AttendanceRecord, MarcacionRaw, Employee, DispositivoZkTeco } from '../../types';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Download,
  Upload,
  Database,
  X,
  FileText,
  Info,
  WifiOff,
  ServerCrash,
  Link2,
  Cpu,
  Activity,
  KeyRound,
} from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';
import { getApiUrl } from '../../utils/apiConfig';
import { normalizePersonName } from '../../utils/nameUtils';
import { supabase } from '../../lib/supabaseClient';

type SyncBannerStatus =
  | 'OFFLINE'
  | 'PROTOCOL_NO_RESPONSE'
  | 'AUTH_ERROR'
  | 'ONLINE_NO_NEW_PUNCHES'
  | 'PUNCHES_RECEIVED'
  | 'DB_ERROR'
  | 'ERROR';

interface SyncBannerState {
  success: boolean;
  statusCode: SyncBannerStatus;
  title: string;
  message: string;
}

interface AttendanceModuleProps {
  attendance: AttendanceRecord[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  devices?: DispositivoZkTeco[];
  activeRole: string;
  onRefresh?: () => void;
}

const AUTHORIZED_LINK_ROLES = [
  'ADMIN_GENERAL',
  'HR_ADMIN',
  'JEFE_RRHH',
  'CONTROL_ASISTENCIA',
  'SUPERVISOR',
  'DIRECTOR_GENERAL',
];

function getStatusBannerMeta(statusCode: string | undefined, success: boolean): { code: SyncBannerStatus; title: string } {
  switch (statusCode) {
    case 'OFFLINE':
      return { code: 'OFFLINE', title: 'Sin conexión con el dispositivo' };
    case 'PROTOCOL_NO_RESPONSE':
      return { code: 'PROTOCOL_NO_RESPONSE', title: 'Conexión TCP establecida, pero sin respuesta del protocolo ZKTeco' };
    case 'AUTH_ERROR':
      return { code: 'AUTH_ERROR', title: 'Error de autenticación (CommKey) con el dispositivo' };
    case 'ONLINE_NO_NEW_PUNCHES':
      return { code: 'ONLINE_NO_NEW_PUNCHES', title: 'Lectura exitosa sin marcaciones nuevas' };
    case 'PUNCHES_RECEIVED':
      return { code: 'PUNCHES_RECEIVED', title: 'Marcaciones recibidas correctamente' };
    case 'DB_ERROR':
      return { code: 'DB_ERROR', title: 'Error de almacenamiento en la base de datos' };
    default:
      return success
        ? { code: 'PUNCHES_RECEIVED', title: 'Operación completada' }
        : { code: 'ERROR', title: 'Error en sincronización' };
  }
}

function formatSyncTimestamp(iso?: string | null): string {
  if (!iso) return 'Sin sincronización registrada';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  attendance,
  rawPunches,
  employees,
  devices = [],
  activeRole,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'punches' | 'pending' | 'consolidated'>('punches');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Sync & Import states
  const [showUsbModal, setShowUsbModal] = useState(false);
  const [usbFileName, setUsbFileName] = useState('');
  const [usbRawContent, setUsbRawContent] = useState('');
  const [usbImporting, setUsbImporting] = useState(false);
  const [bioTimeSyncing, setBioTimeSyncing] = useState(false);
  const [deviceSyncing, setDeviceSyncing] = useState(false);
  const [manualLastSync, setManualLastSync] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<SyncBannerState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 7-Stage Diagnostics & BioTime Credentials modal state
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagReport, setDiagReport] = useState<any | null>(null);
  const [showBioTimeModal, setShowBioTimeModal] = useState(false);
  const [btHost, setBtHost] = useState('192.168.1.29');
  const [btWebPort, setBtWebPort] = useState(89);
  const [btDbPort, setBtDbPort] = useState(7496);
  const [btDbName, setBtDbName] = useState('biotime');
  const [btDbUser, setBtDbUser] = useState('postgres');
  const [btDbPassword, setBtDbPassword] = useState('');
  const [btWebUser, setBtWebUser] = useState('');
  const [btWebPassword, setBtWebPassword] = useState('');
  const [btInspecting, setBtInspecting] = useState(false);
  const [btInspectReport, setBtInspectReport] = useState<any | null>(null);

  // Worker linking modal state
  const [linkingPunch, setLinkingPunch] = useState<MarcacionRaw | null>(null);
  const [linkEmployeeSearch, setLinkEmployeeSearch] = useState('');
  const [selectedLinkEmployeeId, setSelectedLinkEmployeeId] = useState('');
  const [savePinToEmployee, setSavePinToEmployee] = useState(true);
  const [applyToSameCode, setApplyToSameCode] = useState(true);
  const [linkingSaving, setLinkingSaving] = useState(false);

  const canLinkWorkers = AUTHORIZED_LINK_ROLES.includes(activeRole);

  // Latest saved device config (no hardcoded IPs)
  const activeDevice = useMemo(() => {
    if (deviceFilter !== 'ALL') {
      const found = devices.find((d) => d.serial_number === deviceFilter || d.id === deviceFilter);
      if (found) return found;
    }
    return devices[0] || null;
  }, [devices, deviceFilter]);

  const lastSyncTimestamp = useMemo(() => {
    if (manualLastSync) return manualLastSync;
    const deviceSync = devices
      .map((d) => d.last_sync || d.last_activity)
      .filter(Boolean)
      .sort()
      .reverse()[0];
    if (deviceSync) return deviceSync;
    const punchSync = rawPunches
      .map((p) => p.synced_at || p.created_at)
      .filter(Boolean)
      .sort()
      .reverse()[0];
    return punchSync || null;
  }, [manualLastSync, devices, rawPunches]);

  const pendingPunches = useMemo(() => {
    return rawPunches.filter(
      (p) =>
        p.validation_status === 'PENDIENTE_IDENTIFICACION' ||
        p.employee_name === 'Pendiente de Identificación' ||
        (!p.employee_id && !employees.some((e) => e.dni === p.employee_dni || e.zkteco_pin === p.employee_code || e.biometric_user_id === p.employee_code))
    );
  }, [rawPunches, employees]);

  const deviceOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    for (const d of devices) {
      const val = d.serial_number || d.id;
      map.set(val, { value: val, label: `${d.name} (${d.serial_number || d.ip_address})` });
    }
    for (const p of rawPunches) {
      const val = p.device_sn || p.device_id;
      if (val && !map.has(val)) {
        map.set(val, { value: val, label: `${p.device_name || 'Reloj Biométrico'} (${val})` });
      }
    }
    return Array.from(map.values());
  }, [devices, rawPunches]);

  // Preview parsed USB lines client-side
  const usbPreviewRows = useMemo(() => {
    if (!usbRawContent.trim()) return [];
    const lines = usbRawContent.split(/\r?\n/);
    const rows: { pin: string; name: string; timestamp: string; matched: boolean }[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.toLowerCase().includes('userpin')) continue;
      let parts: string[] = [];
      if (trimmed.includes('\t')) parts = trimmed.split('\t').map((p) => p.trim());
      else if (trimmed.includes(';')) parts = trimmed.split(';').map((p) => p.trim());
      else if (trimmed.includes(',') && (trimmed.match(/,/g) || []).length >= 2)
        parts = trimmed.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      else parts = trimmed.split(/\s+/).map((p) => p.trim());

      if (parts.length < 2) continue;
      let pin = '';
      let timestamp = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && parts[2] && /^\d{2}:\d{2}/.test(parts[2])) {
        pin = parts[0];
        timestamp = `${parts[1]} ${parts[2].substring(0, 8)}`;
      } else if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}/.test(parts[1])) {
        pin = parts[0];
        timestamp = parts[1].replace(/\//g, '-');
      } else {
        for (let i = 0; i < parts.length; i++) {
          if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(parts[i])) {
            if (parts[i + 1] && /^\d{1,2}:\d{2}/.test(parts[i + 1])) {
              timestamp = `${parts[i].replace(/\//g, '-')} ${parts[i + 1].substring(0, 8)}`;
              pin = parts[0] !== parts[i] ? parts[0] : (parts[i - 1] || '');
              break;
            }
          }
        }
      }
      if (pin && timestamp) {
        const emp = employees.find(
          (e) =>
            e.dni === pin ||
            e.zkteco_pin === pin ||
            e.biometric_user_id === pin ||
            e.codigo_trabajador === pin
        );
        const name = emp
          ? normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim())
          : `Pendiente de Identificación (Cód. ${pin})`;
        rows.push({ pin, name, timestamp, matched: !!emp });
      }
    }
    return rows;
  }, [usbRawContent, employees]);

  const handleUsbFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUsbFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setUsbRawContent(String(evt.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handleConfirmUsbImport = async () => {
    if (!usbRawContent.trim()) return;
    setUsbImporting(true);
    setActionBanner(null);
    try {
      const res = await fetch(getApiUrl('/api/zkteco/upload-attlog'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: usbFileName || '1_attlog.dat',
          content: usbRawContent,
          serial: activeDevice?.serial_number,
        }),
      });
      const data = await res.json();
      const meta = getStatusBannerMeta(data.status_code, !!data.success);
      setActionBanner({
        success: !!data.success && data.status_code !== 'DB_ERROR',
        statusCode: meta.code,
        title: meta.title,
        message: data.message || (data.success ? 'Marcaciones importadas correctamente.' : 'Error al importar archivo.'),
      });
      if (data.success) {
        setManualLastSync(new Date().toISOString());
        setShowUsbModal(false);
        setUsbRawContent('');
        setUsbFileName('');
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      setActionBanner({
        success: false,
        statusCode: 'DB_ERROR',
        title: 'Error de almacenamiento en la base de datos',
        message: `Error de conexión al importar archivo USB: ${err?.message || 'Error de red'}`,
      });
    } finally {
      setUsbImporting(false);
    }
  };

  // Persistencia directa idempotente en Supabase cuando el backend Express no esté accesible
  const persistPunchesDirectlyToSupabase = async (
    punches: any[],
    source: string,
    deviceMeta?: { id?: string; serial?: string; name?: string }
  ): Promise<{ ok: boolean; count: number; unidentified: number; error?: string }> => {
    if (!Array.isArray(punches) || punches.length === 0) {
      return { ok: true, count: 0, unidentified: 0 };
    }
    const syncedAt = new Date().toISOString();
    let unidentified = 0;

    const fullRows = punches.map((p: any, idx: number) => {
      const code = String(p.employee_code || p.employee_dni || p.dni || p.pin || p.deviceUserId || '').trim();
      const ts = String(p.timestamp || p.recordTime || '').replace('T', ' ').substring(0, 19);
      const sn = String(p.device_sn || p.serialNumber || deviceMeta?.serial || 'AEH2223460040').trim().toUpperCase();
      const matchedEmp = employees.find(
        (e) =>
          (e.zkteco_pin && e.zkteco_pin === code) ||
          (e.biometric_user_id && e.biometric_user_id === code) ||
          (e.codigo_trabajador && e.codigo_trabajador === code) ||
          (e.dni && e.dni === code)
      );
      if (!matchedEmp) unidentified++;
      const fullName = matchedEmp
        ? normalizePersonName(`${matchedEmp.first_name || ''} ${matchedEmp.last_name || ''}`.trim())
        : 'Pendiente de Identificación';
      const empDni = matchedEmp?.dni || code;
      const cleanTs = ts.replace(/[^0-9]/g, '');
      return {
        id: p.id || `zk_${sn}_${code}_${cleanTs || idx}`,
        device_id: deviceMeta?.id || p.device_id || 'dev-01',
        device_sn: sn,
        device_name: deviceMeta?.name || p.device_name || 'ZKTeco G3',
        employee_id: matchedEmp?.id || null,
        employee_dni: empDni,
        employee_code: code,
        employee_name: fullName,
        timestamp: ts,
        fecha: ts.split(' ')[0] || '',
        hora: ts.split(' ')[1] || '',
        punch_type: p.punch_type || (p.punch_state === 1 ? 'CHECK_OUT' : 'CHECK_IN'),
        punch_state: p.punch_state ?? 0,
        verify_mode: p.verify_mode || 'FINGERPRINT',
        source,
        synced_at: syncedAt,
        processed: false,
      };
    });

    try {
      const { error } = await supabase.from('marcaciones_raw').upsert(fullRows, { onConflict: 'id' });
      if (!error) {
        return { ok: true, count: fullRows.length, unidentified };
      }
      // Fallback a columnas núcleo si PostgREST rechaza columnas extendidas
      const msg = error.message || '';
      if (msg.includes('column') || error.code === '42703' || error.code === 'PGRST204') {
        const coreRows = fullRows.map((r) => ({
          id: r.id,
          device_id: r.device_id,
          device_sn: r.device_sn,
          device_name: r.device_name,
          employee_dni: r.employee_dni,
          employee_name: r.employee_name,
          timestamp: r.timestamp,
          fecha: r.fecha,
          hora: r.hora,
          punch_type: r.punch_type,
          verify_mode: r.verify_mode,
          processed: r.processed,
        }));
        const retry = await supabase.from('marcaciones_raw').upsert(coreRows, { onConflict: 'id' });
        if (!retry.error) {
          return { ok: true, count: coreRows.length, unidentified };
        }
        return { ok: false, count: 0, unidentified, error: retry.error.message };
      }
      return { ok: false, count: 0, unidentified, error: error.message };
    } catch (err: any) {
      return { ok: false, count: 0, unidentified, error: err?.message || 'Error guardando en Supabase' };
    }
  };

  // Manual synchronization from configured ZKTeco clock (Electron physical LAN read or backend fallback)
  const handleManualDeviceSync = async () => {
    if (!activeDevice) {
      setActionBanner({
        success: false,
        statusCode: 'OFFLINE',
        title: 'Sin dispositivo configurado',
        message: 'No hay un dispositivo biométrico registrado en la configuración actual.',
      });
      return;
    }

    setDeviceSyncing(true);
    setActionBanner(null);

    try {
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI && typeof electronAPI.readZkDevicePunches === 'function') {
        const res = await electronAPI.readZkDevicePunches(
          activeDevice.ip_address,
          activeDevice.port || 7496,
          5000,
          activeDevice.comm_key ?? 0,
          activeDevice.model || 'ZKTeco G3',
          activeDevice.serial_number
        );

        if (!res.success) {
          const errCode = res.status_code || (res.cause === 'TCP_TIMEOUT' || res.status === 'OFFLINE' ? 'OFFLINE' : 'PROTOCOL_NO_RESPONSE');
          const meta = getStatusBannerMeta(errCode, false);
          setActionBanner({
            success: false,
            statusCode: meta.code,
            title: meta.title,
            message: res.message || `No se pudo leer el reloj en ${activeDevice.ip_address}:${activeDevice.port}.`,
          });
          return;
        }

        const punches = Array.isArray(res.punches) ? res.punches : [];
        if (punches.length === 0) {
          setManualLastSync(new Date().toISOString());
          setActionBanner({
            success: true,
            statusCode: 'ONLINE_NO_NEW_PUNCHES',
            title: 'Lectura exitosa sin marcaciones nuevas',
            message: res.message || `Conexión verificada con ${activeDevice.name} (${activeDevice.ip_address}:${activeDevice.port}), sin marcaciones almacenadas nuevas.`,
          });
          if (onRefresh) onRefresh();
          return;
        }

        try {
          const ingestRes = await fetch(getApiUrl('/api/zkteco/ingest-punches'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              punches,
              source: res.source || 'DIRECT_READ',
              device: {
                id: activeDevice.id,
                serial: res.serial_number || activeDevice.serial_number,
                name: activeDevice.name,
                ip: activeDevice.ip_address,
              },
            }),
          });
          if (ingestRes.ok || ingestRes.status === 207) {
            const ingestData = await ingestRes.json();
            const meta = getStatusBannerMeta(ingestData.status_code, !!ingestData.success);
            setManualLastSync(ingestData.last_sync || new Date().toISOString());
            setActionBanner({
              success: !!ingestData.success,
              statusCode: meta.code,
              title: meta.title,
              message: ingestData.message || `Se sincronizaron ${punches.length} marcaciones.`,
            });
            if (onRefresh) onRefresh();
            return;
          }
        } catch (_) {}

        // Fallback directo a Supabase si el backend local no respondió
        const directSave = await persistPunchesDirectlyToSupabase(punches, res.source || 'DIRECT_READ', {
          id: activeDevice.id,
          serial: res.serial_number || activeDevice.serial_number,
          name: activeDevice.name,
        });
        setManualLastSync(new Date().toISOString());
        setActionBanner({
          success: directSave.ok,
          statusCode: directSave.ok ? 'PUNCHES_RECEIVED' : 'DB_ERROR',
          title: directSave.ok ? 'Marcaciones recibidas correctamente' : 'Error de almacenamiento en la base de datos',
          message: directSave.ok
            ? `Se leyeron ${punches.length} marcaciones reales desde ${activeDevice.ip_address}:${activeDevice.port} y se almacenaron en Supabase (${directSave.unidentified} pendientes de identificación).`
            : `Marcaciones leídas (${punches.length}), pero error al guardar en Supabase: ${directSave.error}`,
        });
        if (onRefresh) onRefresh();
        return;
      }

      // Server / Browser mode: ask backend using latest stored device config
      const res = await fetch(getApiUrl(`/api/zkteco/devices/${encodeURIComponent(activeDevice.id)}/sync`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: activeDevice.ip_address,
          port: activeDevice.port,
          comm_key: activeDevice.comm_key ?? 0,
        }),
      });
      const data = await res.json();
      const meta = getStatusBannerMeta(data.status_code, !!data.success);
      if (data.last_sync) setManualLastSync(data.last_sync);
      setActionBanner({
        success: !!data.success,
        statusCode: meta.code,
        title: meta.title,
        message: data.message || meta.title,
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionBanner({
        success: false,
        statusCode: 'OFFLINE',
        title: 'Sin conexión con el dispositivo / servidor',
        message: `No se pudo completar la sincronización manual: ${err?.message || 'Error de red'}`,
      });
    } finally {
      setDeviceSyncing(false);
    }
  };

  // Diagnóstico real independiente de 7 etapas
  const handleRunSevenStageDiag = async () => {
    if (!activeDevice) return;
    setShowDiagModal(true);
    setDiagRunning(true);
    setDiagReport(null);
    try {
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI && typeof electronAPI.diagnoseZkDevice === 'function') {
        const res = await electronAPI.diagnoseZkDevice(
          activeDevice.ip_address,
          activeDevice.port || 7496,
          4000,
          activeDevice.model || 'ZKTeco G3',
          activeDevice.serial_number,
          activeDevice.comm_key ?? 0
        );
        const mappedSteps = Array.isArray(res.step_details)
          ? res.step_details.slice(0, 7).map((s: any) => ({
              stage: s.stage,
              name: s.name,
              status: s.status === 'PASSED' ? 'PASSED' : s.status === 'FAILED' ? 'FAILED' : 'SKIPPED',
              ok: s.status === 'PASSED',
              info: s.message,
              latencyMs: s.latencyMs,
            }))
          : [];
        setDiagReport({
          success: !!res.success,
          status_code: res.status === 'OFFLINE' ? 'OFFLINE' : res.success ? 'PUNCHES_RECEIVED' : 'PROTOCOL_NO_RESPONSE',
          message: res.message,
          ip_address: res.ip || activeDevice.ip_address,
          port: res.port || activeDevice.port,
          serial_number: res.serial_number || activeDevice.serial_number,
          users_in_clock: res.user_count || 0,
          punches_count: res.clock_punches_count || 0,
          steps: mappedSteps,
        });
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/diagnose-pipeline'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: activeDevice.id,
            ip: activeDevice.ip_address,
            port: activeDevice.port || 7496,
            comm_key: activeDevice.comm_key ?? 0,
          }),
        });
        const data = await res.json();
        setDiagReport(data);
      }
    } catch (err: any) {
      setDiagReport({
        success: false,
        status_code: 'OFFLINE',
        message: err?.message || 'Error ejecutando diagnóstico de etapas.',
        steps: [],
      });
    } finally {
      setDiagRunning(false);
    }
  };

  // Inspeccionar BioTime (Solo Lectura: PostgreSQL information_schema + HTTP 89)
  const handleInspectBioTime = async () => {
    setBtInspecting(true);
    setBtInspectReport(null);
    try {
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI && typeof electronAPI.inspectBioTimeDatabase === 'function') {
        const rep = await electronAPI.inspectBioTimeDatabase({
          host: btHost,
          webPort: btWebPort,
          dbPort: btDbPort,
          dbName: btDbName,
          dbUser: btDbUser,
          password: btDbPassword || undefined,
          serial: activeDevice?.serial_number || '',
        });
        setBtInspectReport(rep);
      } else {
        const res = await fetch(getApiUrl('/api/zkteco/biotime/inspect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: btHost,
            webPort: btWebPort,
            port: btDbPort,
            dbName: btDbName,
            user: btDbUser,
            password: btDbPassword || undefined,
            serial: activeDevice?.serial_number || '',
          }),
        });
        const rep = await res.json();
        setBtInspectReport(rep);
      }
    } catch (err: any) {
      setBtInspectReport({
        success: false,
        message: `Error al inspeccionar BioTime: ${err?.message || 'Error de red'}`,
      });
    } finally {
      setBtInspecting(false);
    }
  };

  const handleSyncBioTimeDb = async (customCreds?: {
    host?: string;
    webPort?: number;
    dbPort?: number;
    dbName?: string;
    dbUser?: string;
    password?: string;
    webUser?: string;
    webPassword?: string;
  }) => {
    setBioTimeSyncing(true);
    setActionBanner(null);
    const bioCfg = activeDevice?.biotime_config;
    const params = {
      host: customCreds?.host || bioCfg?.db_host || btHost || '192.168.1.29',
      webPort: customCreds?.webPort || bioCfg?.web_port || btWebPort || 89,
      dbPort: customCreds?.dbPort || bioCfg?.db_port || btDbPort || 7496,
      dbName: customCreds?.dbName || bioCfg?.db_name || btDbName || 'biotime',
      dbUser: customCreds?.dbUser || bioCfg?.db_user || btDbUser || 'postgres',
      password: customCreds?.password ?? (btDbPassword || undefined),
      webUser: customCreds?.webUser ?? (btWebUser || undefined),
      webPassword: customCreds?.webPassword ?? (btWebPassword || undefined),
      serial: activeDevice?.serial_number || 'AEH2223460040',
      deviceId: activeDevice?.id || 'dev-01',
      deviceIp: activeDevice?.ip_address || '',
      devicePort: activeDevice?.port || 7496,
    };

    try {
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI && typeof electronAPI.syncBioTimePunches === 'function') {
        const btRes = await electronAPI.syncBioTimePunches(params);
        if (!btRes.success) {
          setActionBanner({
            success: false,
            statusCode: 'OFFLINE',
            title: 'BioTime no disponible o sin marcaciones',
            message: btRes.message || 'No se pudieron obtener marcaciones desde BioTime. Configure credenciales en "Configurar BioTime" si PostgreSQL o HTTP 89 requieren clave.',
          });
          return;
        }

        const punches = Array.isArray(btRes.punches) ? btRes.punches : [];
        if (punches.length === 0) {
          setManualLastSync(new Date().toISOString());
          setActionBanner({
            success: true,
            statusCode: 'ONLINE_NO_NEW_PUNCHES',
            title: 'Lectura exitosa sin marcaciones nuevas',
            message: btRes.message || 'BioTime consultado correctamente sin registros nuevos.',
          });
          if (onRefresh) onRefresh();
          return;
        }

        try {
          const ingestRes = await fetch(getApiUrl('/api/zkteco/ingest-punches'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              punches,
              source: btRes.source || 'BIOTIME_DB',
              device: {
                id: activeDevice?.id || 'dev-01',
                serial: params.serial,
                name: activeDevice?.name || 'ZKTeco G3 (vía BioTime)',
                ip: params.host,
              },
            }),
          });
          if (ingestRes.ok || ingestRes.status === 207) {
            const ingestData = await ingestRes.json();
            const meta = getStatusBannerMeta(ingestData.status_code, !!ingestData.success);
            setManualLastSync(ingestData.last_sync || new Date().toISOString());
            setActionBanner({
              success: !!ingestData.success,
              statusCode: meta.code,
              title: meta.title,
              message: ingestData.message || btRes.message,
            });
            setShowBioTimeModal(false);
            if (onRefresh) onRefresh();
            return;
          }
        } catch (_) {}

        const directSave = await persistPunchesDirectlyToSupabase(punches, btRes.source || 'BIOTIME_DB', {
          id: activeDevice?.id || 'dev-01',
          serial: params.serial,
          name: activeDevice?.name || 'ZKTeco G3 (vía BioTime)',
        });
        setManualLastSync(new Date().toISOString());
        setActionBanner({
          success: directSave.ok,
          statusCode: directSave.ok ? 'PUNCHES_RECEIVED' : 'DB_ERROR',
          title: directSave.ok ? 'Marcaciones recibidas desde BioTime' : 'Error de almacenamiento en Supabase',
          message: directSave.ok
            ? `Se extrajeron ${punches.length} marcaciones reales desde ${btRes.source} y se sincronizaron en Supabase (${directSave.unidentified} pendientes).`
            : `Leídas desde BioTime (${punches.length}), pero error al guardar en Supabase: ${directSave.error}`,
        });
        setShowBioTimeModal(false);
        if (onRefresh) onRefresh();
        return;
      }

      const res = await fetch(getApiUrl('/api/zkteco/biotime/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: params.host,
          port: params.dbPort,
          dbName: params.dbName,
          user: params.dbUser,
          password: params.password,
          serial: params.serial,
        }),
      });
      const data = await res.json();
      const meta = getStatusBannerMeta(data.status_code || (data.success ? 'PUNCHES_RECEIVED' : 'OFFLINE'), !!data.success);
      if (data.success) {
        setManualLastSync(new Date().toISOString());
        setShowBioTimeModal(false);
      }
      setActionBanner({
        success: !!data.success,
        statusCode: meta.code,
        title: meta.title,
        message: data.message || 'Consulta BioTime finalizada.',
      });
      if (data.success && onRefresh) onRefresh();
    } catch (err: any) {
      setActionBanner({
        success: false,
        statusCode: 'OFFLINE',
        title: 'Sin conexión con BioTime',
        message: `Error al consultar BioTime (${params.host}): ${err?.message || 'Error de red'}`,
      });
    } finally {
      setBioTimeSyncing(false);
    }
  };

  const openLinkModal = (punch: MarcacionRaw) => {
    setLinkingPunch(punch);
    setLinkEmployeeSearch('');
    setSelectedLinkEmployeeId('');
    setSavePinToEmployee(true);
    setApplyToSameCode(true);
  };

  const handleConfirmEmployeeLink = async () => {
    if (!linkingPunch || !selectedLinkEmployeeId) return;
    setLinkingSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/zkteco/punches/${encodeURIComponent(linkingPunch.id)}/assign-employee`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole,
        },
        body: JSON.stringify({
          employee_id: selectedLinkEmployeeId,
          employee_code: linkingPunch.employee_code || linkingPunch.employee_dni,
          save_pin_to_employee: savePinToEmployee,
          apply_to_same_code: applyToSameCode,
        }),
      });
      const data = await res.json();
      const meta = getStatusBannerMeta(data.db_saved === false ? 'DB_ERROR' : 'PUNCHES_RECEIVED', !!data.success);
      setActionBanner({
        success: !!data.success,
        statusCode: data.db_saved === false ? 'DB_ERROR' : meta.code,
        title: data.success ? 'Trabajador vinculado correctamente' : 'No se pudo vincular el trabajador',
        message: data.message || 'Operación finalizada.',
      });
      if (data.success) {
        setLinkingPunch(null);
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      // Fallback directo a Supabase si el backend local no está arriba
      try {
        const emp = employees.find((e) => e.id === selectedLinkEmployeeId);
        if (emp) {
          const empName = normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim());
          const code = linkingPunch.employee_code || linkingPunch.employee_dni;
          const targetIds = applyToSameCode && code
            ? rawPunches.filter((p) => (p.employee_code || p.employee_dni) === code).map((p) => p.id)
            : [linkingPunch.id];
          const { error: upErr } = await supabase
            .from('marcaciones_raw')
            .update({ employee_id: emp.id, employee_dni: emp.dni, employee_name: empName })
            .in('id', targetIds);
          if (!upErr) {
            if (savePinToEmployee && code) {
              await supabase.from('trabajadores').update({ zkteco_pin: code }).eq('id', emp.id);
            }
            setActionBanner({
              success: true,
              statusCode: 'PUNCHES_RECEIVED',
              title: 'Trabajador vinculado en Supabase',
              message: `Se vinculó ${empName} (${emp.dni}) a ${targetIds.length} marcación(es).`,
            });
            setLinkingPunch(null);
            if (onRefresh) onRefresh();
            return;
          }
        }
      } catch (_) {}

      setActionBanner({
        success: false,
        statusCode: 'DB_ERROR',
        title: 'Error de almacenamiento en la base de datos',
        message: `Error al vincular código biométrico: ${err?.message || 'Error de red'}`,
      });
    } finally {
      setLinkingSaving(false);
    }
  };

  const filteredModalEmployees = useMemo(() => {
    const q = linkEmployeeSearch.trim().toLowerCase();
    return employees
      .filter((e) => e.active !== false)
      .filter((e) => {
        if (!q) return true;
        const fullName = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (e.dni || '').toLowerCase().includes(q) ||
          (e.codigo_trabajador || '').toLowerCase().includes(q) ||
          (e.zkteco_pin || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [employees, linkEmployeeSearch]);

  // Filter raw punches (supports date, worker name/dni/code, and device)
  const applyPunchFilters = (list: MarcacionRaw[]) => {
    return list.filter((p) => {
      if (dateFilter && p.fecha !== dateFilter && !p.timestamp?.startsWith(dateFilter)) return false;
      if (deviceFilter !== 'ALL' && p.device_sn !== deviceFilter && p.device_id !== deviceFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = p.employee_name?.toLowerCase().includes(term);
        const matchDni = p.employee_dni?.toLowerCase().includes(term);
        const matchCode = p.employee_code?.toLowerCase().includes(term);
        const matchSn = p.device_sn?.toLowerCase().includes(term);
        if (!matchName && !matchDni && !matchCode && !matchSn) return false;
      }
      return true;
    });
  };

  const filteredPunches = useMemo(
    () => applyPunchFilters(rawPunches),
    [rawPunches, searchTerm, dateFilter, deviceFilter]
  );

  const filteredPendingPunches = useMemo(
    () => applyPunchFilters(pendingPunches),
    [pendingPunches, searchTerm, dateFilter, deviceFilter]
  );

  // Filter attendance records
  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (dateFilter && a.fecha !== dateFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = a.employee_name?.toLowerCase().includes(term);
        const matchDni = a.employee_dni?.toLowerCase().includes(term);
        if (!matchName && !matchDni) return false;
      }
      return true;
    });
  }, [attendance, searchTerm, dateFilter]);

  const activePunchRows = activeTab === 'pending' ? filteredPendingPunches : filteredPunches;

  const paginatedPunches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activePunchRows.slice(start, start + pageSize);
  }, [activePunchRows, currentPage, pageSize]);

  const paginatedAttendance = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAttendance.slice(start, start + pageSize);
  }, [filteredAttendance, currentPage, pageSize]);

  const exportPunchesCSV = () => {
    if (rawPunches.length === 0) return;
    const headers = ['ID', 'Codigo_Reloj', 'DNI', 'Trabajador', 'Fecha_Hora', 'Dispositivo', 'Serial', 'Metodo', 'Origen', 'Estado', 'Sincronizado'];
    const rows = rawPunches.map((p) => [
      p.id,
      p.employee_code || p.employee_dni,
      p.employee_dni,
      `"${p.employee_name || 'Pendiente de Identificación'}"`,
      p.timestamp,
      `"${p.device_name || ''}"`,
      p.device_sn || '',
      p.verify_mode,
      p.source || 'DIRECT_READ',
      p.validation_status || 'VALIDA',
      p.synced_at || p.created_at || '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `marcaciones_drac_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
              <Clock className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
                <span>Control de Asistencia y Marcaciones DRAC</span>
                <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 text-[11px] rounded-full font-mono">
                  {rawPunches.length} Marcaciones Reales
                </span>
                {pendingPunches.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-700 text-[11px] rounded-full font-mono">
                    {pendingPunches.length} Pendientes de Identificación
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-0.5">
                <span>
                  Última sincronización: <strong className="text-slate-200 font-mono">{formatSyncTimestamp(lastSyncTimestamp)}</strong>
                </span>
                {activeDevice && (
                  <span className="font-mono text-[11px] text-slate-400">
                    Equipo: <strong className="text-indigo-300">{activeDevice.ip_address}:{activeDevice.port}</strong> ({activeDevice.serial_number})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleManualDeviceSync}
            disabled={deviceSyncing}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${deviceSyncing ? 'animate-spin' : ''}`} />
            <span>{deviceSyncing ? 'Sincronizando Reloj...' : 'Sincronizar Reloj'}</span>
          </button>

          <button
            onClick={handleRunSevenStageDiag}
            disabled={diagRunning}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-800/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Probar IP, puerto TCP, protocolo ZKTeco, CommKey, usuarios, marcaciones y Supabase"
          >
            <Activity className={`w-3.5 h-3.5 ${diagRunning ? 'animate-pulse' : ''}`} />
            <span>Diagnóstico 7 Etapas</span>
          </button>

          <button
            onClick={() => handleSyncBioTimeDb()}
            disabled={bioTimeSyncing}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Database className={`w-3.5 h-3.5 ${bioTimeSyncing ? 'animate-spin' : ''}`} />
            <span>{bioTimeSyncing ? 'Consultando BioTime...' : 'Extraer de BioTime'}</span>
          </button>

          <button
            onClick={() => setShowBioTimeModal(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Configurar credenciales BioTime PostgreSQL / API HTTP :89"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>BioTime</span>
          </button>

          <button
            onClick={() => setShowUsbModal(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar USB</span>
          </button>

          {rawPunches.length > 0 && (
            <button
              onClick={exportPunchesCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-800/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          )}

          <button
            onClick={() => onRefresh && onRefresh()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Explicit Status Banner */}
      {actionBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            actionBanner.statusCode === 'PUNCHES_RECEIVED'
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
              : actionBanner.statusCode === 'ONLINE_NO_NEW_PUNCHES'
              ? 'bg-sky-950/60 border-sky-500/60 text-sky-200'
              : actionBanner.statusCode === 'PROTOCOL_NO_RESPONSE'
              ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
              : 'bg-rose-950/60 border-rose-500/60 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionBanner.statusCode === 'PUNCHES_RECEIVED' || actionBanner.statusCode === 'ONLINE_NO_NEW_PUNCHES' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : actionBanner.statusCode === 'OFFLINE' ? (
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : actionBanner.statusCode === 'DB_ERROR' ? (
              <ServerCrash className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-2">
                <span>{actionBanner.title}</span>
                <span className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-[10px]">
                  {actionBanner.statusCode}
                </span>
              </div>
              <p className="opacity-90">{actionBanner.message}</p>
            </div>
          </div>
          <button onClick={() => setActionBanner(null)} className="text-slate-400 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('punches');
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'punches'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Marcaciones Recibidas ({rawPunches.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('pending');
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-amber-500 text-amber-400 bg-amber-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Pendientes de Identificación</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              pendingPunches.length > 0
                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {pendingPunches.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('consolidated');
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'consolidated'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Asistencia Consolidada ({attendance.length})</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs bg-[#0F1115] border border-slate-800 p-3 rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código reloj, DNI o nombre del trabajador..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {activeTab !== 'consolidated' && (
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={deviceFilter}
                onChange={(e) => {
                  setDeviceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los dispositivos</option>
                {deviceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
          />

          {(dateFilter || deviceFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setDateFilter('');
                setDeviceFilter('ALL');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="text-slate-400 hover:text-white px-2 py-1 text-xs"
              title="Limpiar filtros"
            >
              Limpiar
            </button>
          )}
        </div>

        <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">
          {activeTab === 'consolidated'
            ? `${filteredAttendance.length} registros consolidados`
            : `${activePunchRows.length} marcaciones`}
        </span>
      </div>

      {/* Content */}
      {activeTab !== 'consolidated' ? (
        activePunchRows.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-800 rounded-xl text-center space-y-4 bg-[#0C0D11]">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h4 className="font-bold text-sm text-slate-200">
                {activeTab === 'pending'
                  ? 'No existen marcaciones pendientes de identificación.'
                  : 'No se encontraron marcaciones recibidas del dispositivo.'}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeTab === 'pending'
                  ? 'Todas las marcaciones registradas corresponden a un código de trabajador identificado en el sistema.'
                  : `El sistema no genera ni simula marcaciones ficticias. Use "Sincronizar Reloj" en red institucional (${activeDevice ? `${activeDevice.ip_address}:${activeDevice.port}` : 'equipo configurado'}), importe un archivo USB o consulte BioTime si corresponde.`}
              </p>
            </div>
            {activeTab === 'punches' && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleManualDeviceSync}
                  disabled={deviceSyncing}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${deviceSyncing ? 'animate-spin' : ''}`} />
                  {deviceSyncing ? 'Sincronizando Reloj...' : 'Sincronizar Reloj Manualmente'}
                </button>
                <button
                  onClick={() => setShowUsbModal(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Importar desde Memoria USB (1_attlog.dat)
                </button>
                <button
                  onClick={() => handleSyncBioTimeDb()}
                  disabled={bioTimeSyncing}
                  className="px-3.5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Database className="w-4 h-4" />
                  {bioTimeSyncing ? 'Consultando BioTime...' : 'Sincronizar BioTime'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1115]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#090A0D] text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Código Reloj / DNI</th>
                    <th className="py-2.5 px-3">Trabajador</th>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Dispositivo</th>
                    <th className="py-2.5 px-3">Tipo / Método</th>
                    <th className="py-2.5 px-3">Origen / Sync</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedPunches.map((p) => {
                    const isPending =
                      p.validation_status === 'PENDIENTE_IDENTIFICACION' ||
                      p.employee_name === 'Pendiente de Identificación';
                    const displayCode = p.employee_code || p.employee_dni || '-';
                    return (
                      <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                          <div>{displayCode}</div>
                          {p.employee_code && p.employee_dni && p.employee_code !== p.employee_dni && (
                            <div className="text-[10px] text-slate-400 font-normal">DNI: {p.employee_dni}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
                              <UserX className="w-3.5 h-3.5" />
                              Pendiente de Identificación
                            </span>
                          ) : (
                            <span className="text-white font-medium inline-flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              {p.employee_name}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-300 whitespace-nowrap">{p.timestamp}</td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <div className="text-slate-200">{p.device_name || 'ZKTeco G3'}</div>
                          <div className="font-mono text-slate-500 text-[10px]">{p.device_sn || p.device_id}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] space-x-1 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              p.punch_state === 1 || p.punch_type === 'CHECK_OUT'
                                ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {p.punch_state === 1 || p.punch_type === 'CHECK_OUT' ? 'SALIDA' : 'ENTRADA'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{p.verify_mode}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          <div>{p.source || 'DIRECT_READ'}</div>
                          <div className="text-slate-500">{formatSyncTimestamp(p.synced_at || p.created_at)}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700">
                              PENDIENTE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {p.validation_status || 'SINCRONIZADA'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isPending && canLinkWorkers ? (
                            <button
                              onClick={() => openLinkModal(p)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <Link2 className="w-3 h-3" />
                              Vincular
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DataTablePagination
              currentPage={currentPage}
              totalItems={activePunchRows.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )
      ) : filteredAttendance.length === 0 ? (
        <div className="p-12 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-[#0C0D11]">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="font-bold text-sm text-slate-200">No se encontraron registros de asistencia procesados</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              El consolidador institucional de asistencia calcula jornada, puntualidad y tardanzas exclusivamente sobre marcaciones reales vinculadas a un trabajador.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1115]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#090A0D] text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">DNI</th>
                  <th className="py-2.5 px-3">Trabajador</th>
                  <th className="py-2.5 px-3">Turno 1 (Ent/Sal)</th>
                  <th className="py-2.5 px-3">Turno 2 (Ent/Sal)</th>
                  <th className="py-2.5 px-3">Tardanza</th>
                  <th className="py-2.5 px-3">Horas Efectivas</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedAttendance.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-300">{a.fecha}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-300 font-bold">{a.employee_dni}</td>
                    <td className="py-2.5 px-3 text-white">{a.employee_name}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {a.t1_real_in || '--:--'} / {a.t1_real_out || '--:--'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {a.t2_real_in || '--:--'} / {a.t2_real_out || '--:--'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-300">
                      {a.net_tardiness_minutes > 0 ? `${a.net_tardiness_minutes} min` : '0 min'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                      {(a.total_effective_hours ?? 0).toFixed(1)} h
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'PUNCTUAL'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : a.status === 'LATE'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataTablePagination
            currentPage={currentPage}
            totalItems={filteredAttendance.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Modal Vincular Trabajador a Marcación Pendiente */}
      {linkingPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-950 text-amber-400 rounded-lg border border-amber-800/50">
                  <Link2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Vincular Código Biométrico Pendiente</h3>
                  <p className="text-[11px] text-slate-400">
                    Asignación autorizada sin modificar la hora original registrada en el reloj.
                  </p>
                </div>
              </div>
              <button onClick={() => setLinkingPunch(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Código en Reloj</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {linkingPunch.employee_code || linkingPunch.employee_dni}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Fecha y Hora Original</span>
                  <span className="font-mono text-white">{linkingPunch.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Dispositivo</span>
                  <span className="text-slate-200">{linkingPunch.device_name || linkingPunch.device_sn}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Origen</span>
                  <span className="font-mono text-slate-300">{linkingPunch.source || 'DIRECT_READ'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">Seleccionar Trabajador Institucional:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={linkEmployeeSearch}
                    onChange={(e) => setLinkEmployeeSearch(e.target.value)}
                    placeholder="Buscar trabajador por DNI, código o apellidos..."
                    className="w-full pl-8 pr-3 py-2 bg-[#090A0D] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800/70 bg-[#090A0D]">
                  {filteredModalEmployees.map((emp) => {
                    const selected = selectedLinkEmployeeId === emp.id;
                    const fullName = normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim());
                    return (
                      <button
                        type="button"
                        key={emp.id}
                        onClick={() => setSelectedLinkEmployeeId(emp.id)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                          selected ? 'bg-amber-950/60 text-amber-200' : 'hover:bg-slate-900 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            DNI: {emp.dni} · Cód: {emp.codigo_trabajador} {emp.zkteco_pin ? `· PIN Reloj: ${emp.zkteco_pin}` : ''}
                          </div>
                        </div>
                        {selected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredModalEmployees.length === 0 && (
                    <div className="p-4 text-center text-slate-500">No se encontraron trabajadores con ese criterio.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePinToEmployee}
                    onChange={(e) => setSavePinToEmployee(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500"
                  />
                  <span>Guardar este código biométrico en la ficha del trabajador para futuras sincronizaciones</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToSameCode}
                    onChange={(e) => setApplyToSameCode(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500"
                  />
                  <span>Aplicar correspondencia a todas las marcaciones pendientes con el mismo código</span>
                </label>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#090A0D] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkingPunch(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEmployeeLink}
                disabled={linkingSaving || !selectedLinkEmployeeId}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                <Link2 className="w-3.5 h-3.5" />
                {linkingSaving ? 'Vinculando...' : 'Confirmar Vinculación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importación USB (1_attlog.dat / CSV / TXT) */}
      {showUsbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-950 text-indigo-400 rounded-lg border border-indigo-800/50">
                  <Upload className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Importar Marcaciones Reales desde Memoria USB</h3>
                  <p className="text-[11px] text-slate-400">
                    Compatible con archivos <code className="text-amber-300">1_attlog.dat</code>, <code className="text-amber-300">attlog.dat</code>, <code className="text-amber-300">.txt</code> y <code className="text-amber-300">.csv</code> exportados directamente del reloj ZKTeco G3.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUsbModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> ¿Cómo obtener el archivo desde el marcador biométrico?
                </div>
                <p>
                  Inserte una memoria USB en el puerto lateral del reloj <strong>ZKTeco G3</strong> → ingrese a <strong>Menú → Gestión USB → Descargar → Descargar Asistencia</strong>. Luego seleccione aquí el archivo <code className="text-amber-300">1_attlog.dat</code> generado en el USB.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dat,.txt,.csv,.log"
                  onChange={handleUsbFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  {usbFileName ? `Archivo cargado: ${usbFileName}` : 'Seleccionar archivo 1_attlog.dat / .txt / .csv'}
                </button>
                {usbPreviewRows.length > 0 && (
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    ✓ {usbPreviewRows.length} marcaciones detectadas listas para importar
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 block">
                  Contenido del archivo o pegado directo de líneas (PIN + Fecha y Hora):
                </label>
                <textarea
                  value={usbRawContent}
                  onChange={(e) => setUsbRawContent(e.target.value)}
                  rows={5}
                  placeholder={'Ejemplo formato ZKTeco 1_attlog.dat:\n10000001\t2026-11-12 07:58:12\t1\t0\t0\t0\n10000002\t2026-11-12 08:04:39\t1\t0\t0\t0'}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {usbPreviewRows.length > 0 && (
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#090A0D]">
                  <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>Vista previa de marcaciones reales ({usbPreviewRows.length} total)</span>
                    <span className="text-slate-400 font-normal">Mostrando primeros 8 registros</span>
                  </div>
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-slate-500 border-b border-slate-800/80">
                      <tr>
                        <th className="py-1.5 px-3">PIN / Código</th>
                        <th className="py-1.5 px-3">Trabajador</th>
                        <th className="py-1.5 px-3">Fecha y Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {usbPreviewRows.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3 font-mono text-indigo-300 font-bold">{r.pin}</td>
                          <td className="py-1.5 px-3 text-slate-200">
                            {r.name} {!r.matched && <span className="text-amber-400 text-[10px]">(Pasará a Pendientes)</span>}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-amber-300">{r.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#090A0D] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUsbModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUsbImport}
                disabled={usbImporting || usbPreviewRows.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                {usbImporting ? 'Importando...' : `Importar ${usbPreviewRows.length} Marcaciones Reales`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Diagnóstico Real 7 Etapas */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-sky-950 text-sky-400 rounded-lg border border-sky-800/50">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Diagnóstico Independiente de 7 Etapas — ZKTeco G3</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {activeDevice ? `${activeDevice.ip_address}:${activeDevice.port} · S/N ${activeDevice.serial_number}` : 'Sin equipo'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDiagModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto text-xs">
              {diagRunning ? (
                <div className="py-10 text-center space-y-2 text-slate-300">
                  <RefreshCw className="w-7 h-7 animate-spin text-sky-400 mx-auto" />
                  <p className="font-semibold">Ejecutando pruebas TCP, Protocolo ZKTeco, CommKey, Usuarios y Marcaciones...</p>
                </div>
              ) : diagReport ? (
                <>
                  <div className={`p-3 rounded-lg border ${diagReport.success ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200' : 'bg-rose-950/50 border-rose-700 text-rose-200'}`}>
                    <div className="font-bold flex items-center justify-between">
                      <span>{diagReport.message || 'Diagnóstico completado'}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-black/30 rounded">{diagReport.status_code}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] opacity-85">
                      Usuarios en reloj: {diagReport.users_in_clock ?? 0} · Marcaciones detectadas: {diagReport.punches_count ?? 0}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(diagReport.steps || []).map((st: any) => (
                      <div key={st.stage} className="p-2.5 rounded-lg border border-slate-800 bg-[#090A0D] flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-200">{st.name}</div>
                          <div className="text-[11px] text-slate-400">{st.info}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] shrink-0 ${
                            st.status === 'PASSED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : st.status === 'FAILED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-700'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {st.status}{st.latencyMs ? ` (${st.latencyMs}ms)` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#090A0D] flex items-center justify-between">
              <button
                type="button"
                onClick={handleRunSevenStageDiag}
                disabled={diagRunning}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagRunning ? 'animate-spin' : ''}`} />
                Reintentar Diagnóstico
              </button>
              <button
                type="button"
                onClick={() => setShowDiagModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración e Inspección BioTime (192.168.1.29) */}
      {showBioTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-950 text-amber-400 rounded-lg border border-amber-800/50">
                  <Database className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Fuente Intermediaria BioTime (Solo Lectura)</h3>
                  <p className="text-[11px] text-slate-400">
                    Inspección de esquema PostgreSQL (puerto 7496) o API oficial HTTP BioTime (puerto 89).
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBioTimeModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Servidor BioTime</label>
                  <input value={btHost} onChange={(e) => setBtHost(e.target.value)} className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Base de Datos PostgreSQL</label>
                  <input value={btDbName} onChange={(e) => setBtDbName(e.target.value)} className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Puerto PostgreSQL BioTime</label>
                  <input type="number" value={btDbPort} onChange={(e) => setBtDbPort(Number(e.target.value) || 7496)} className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Usuario PostgreSQL</label>
                  <input value={btDbUser} onChange={(e) => setBtDbUser(e.target.value)} className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Contraseña PostgreSQL BioTime (si requiere)</label>
                  <input type="password" value={btDbPassword} onChange={(e) => setBtDbPassword(e.target.value)} placeholder="Opcional si usa clave institucional distinta" className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Puerto HTTP BioTime (ADMS/API)</label>
                  <input type="number" value={btWebPort} onChange={(e) => setBtWebPort(Number(e.target.value) || 89)} className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Usuario Web BioTime (API opcional)</label>
                  <input value={btWebUser} onChange={(e) => setBtWebUser(e.target.value)} placeholder="admin" className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Contraseña Web BioTime (API opcional)</label>
                  <input type="password" value={btWebPassword} onChange={(e) => setBtWebPassword(e.target.value)} placeholder="Sólo si PostgreSQL no permite acceso remoto y usa API :89" className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-white font-mono" />
                </div>
              </div>

              {btInspectReport && (
                <div className={`p-3 rounded-lg border space-y-1 ${btInspectReport.validSource ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200' : 'bg-amber-950/40 border-amber-700 text-amber-200'}`}>
                  <div className="font-bold">{btInspectReport.message}</div>
                  {btInspectReport.attendanceTable && (
                    <div className="font-mono text-[11px] opacity-90">
                      Tabla: {btInspectReport.attendanceTable} · Total: {btInspectReport.totalTransactions ?? 0} · Reloj: {btInspectReport.deviceTransactions ?? 0}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#090A0D] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleInspectBioTime}
                disabled={btInspecting}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-800/50 rounded-lg text-xs font-semibold"
              >
                {btInspecting ? 'Inspeccionando...' : 'Inspeccionar Esquema'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBioTimeModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncBioTimeDb({ host: btHost, webPort: btWebPort, dbPort: btDbPort, dbName: btDbName, dbUser: btDbUser, password: btDbPassword || undefined, webUser: btWebUser || undefined, webPassword: btWebPassword || undefined })}
                  disabled={bioTimeSyncing}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  {bioTimeSyncing ? 'Extrayendo...' : 'Extraer Marcaciones BioTime'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

