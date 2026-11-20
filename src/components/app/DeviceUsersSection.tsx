import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Area,
  BiometricDeviceUser,
  Cargo,
  Dependencia,
  DeviceUserChangeLog,
  DeviceUserLinkStatus,
  DeviceUserSyncRun,
  DireccionOrgano,
  DispositivoZkTeco,
  Employee,
  Horario,
  MarcacionRaw,
  ResponsableDesignation,
} from '../../types';
import { getApiUrl } from '../../utils/apiConfig';
import { normalizePersonName } from '../../utils/nameUtils';
import {
  classifyDeviceUserBinding,
  reconcileDeviceUsers,
  RawClockUserInput,
} from '../../utils/deviceUserSync';
import { DataTablePagination } from '../common/DataTablePagination';
import { EmployeeFormModal } from './EmployeeFormModal';
import {
  Users,
  RefreshCw,
  Search,
  Download,
  Link2,
  Unlink,
  History,
  Edit3,
  AlertCircle,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  Eye,
  X,
  SlidersHorizontal,
  Info,
  FileText,
  KeyRound,
  ArrowRightLeft,
  UserPlus,
  UserCheck,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

interface DeviceUsersSectionProps {
  devices: DispositivoZkTeco[];
  employees: Employee[];
  rawPunches: MarcacionRaw[];
  dependencias?: Dependencia[];
  direccionesOrganos?: DireccionOrgano[];
  areas?: Area[];
  cargos?: Cargo[];
  horarios?: Horario[];
  responsables?: ResponsableDesignation[];
  activeRole: string;
  onRefreshAll?: () => void;
  onRecordAudit?: (action: string, details: string, empDni?: string, empName?: string) => void;
}

const LINK_ALLOWED_ROLES = [
  'ADMIN_GENERAL',
  'HR_ADMIN',
  'JEFE_RRHH',
  'CONTROL_ASISTENCIA',
  'SUPERVISOR',
  'DIRECTOR_GENERAL',
];

const CLOCK_WRITE_ADMIN_ROLES = ['ADMIN_GENERAL', 'HR_ADMIN', 'CONTROL_ASISTENCIA'];

const LINK_STATUS_META: Record<
  DeviceUserLinkStatus,
  { label: string; badgeClass: string; desc: string }
> = {
  VINCULADO: {
    label: 'Vinculado',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/70',
    desc: 'Usuario del reloj asociado formalmente a un trabajador existente del directorio institucional.',
  },
  REGISTRADO: {
    label: 'Registrado',
    badgeClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-700/70',
    desc: 'Trabajador nuevo registrado directamente desde este usuario del reloj y vinculado a su PIN.',
  },
  PENDIENTE_VINCULACION: {
    label: 'Pendiente de vinculación',
    badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-700/70',
    desc: 'Usuario real del reloj sin trabajador institucional asignado.',
  },
  POSIBLE_COINCIDENCIA: {
    label: 'Posible coincidencia',
    badgeClass: 'bg-sky-950/70 text-sky-300 border-sky-700/70',
    desc: 'Se detectó un posible trabajador coincidente; requiere confirmación manual.',
  },
  REVISAR: {
    label: 'Revisar',
    badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-700/70',
    desc: 'Inconsistencia o duplicidad detectada entre reloj y padrón.',
  },
  INACTIVO: {
    label: 'Inactivo',
    badgeClass: 'bg-slate-900 text-slate-400 border-slate-700',
    desc: 'El estado reportado por el dispositivo indica usuario deshabilitado/inactivo.',
  },
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScopeLabel(scope?: string, method?: string): { text: string; className: string } {
  if (scope === 'DIRECT_CLOCK') {
    return {
      text: method === 'TCP_RAW_ZK' ? 'Reloj directo (TCP raw)' : 'Reloj directo (node-zklib)',
      className: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    };
  }
  if (scope === 'BIOTIME_DEVICE_SCOPED') {
    return {
      text: method === 'BIOTIME_PG_SQL' ? 'BioTime PG (por terminal)' : 'BioTime API (por terminal)',
      className: 'bg-sky-950/60 text-sky-300 border-sky-800/60',
    };
  }
  return {
    text: 'BioTime servidor global',
    className: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
  };
}

function getEmployeeCargoLabel(emp?: Employee | null): string {
  if (!emp) return '—';
  return emp.position || (emp as any).cargo || emp.cargo_name || '—';
}

export const DeviceUsersSection: React.FC<DeviceUsersSectionProps> = ({
  devices,
  employees,
  rawPunches,
  dependencias = [],
  direccionesOrganos = [],
  areas = [],
  cargos = [],
  horarios = [],
  responsables = [],
  activeRole,
  onRefreshAll,
  onRecordAudit,
}) => {
  const [deviceUsers, setDeviceUsers] = useState<BiometricDeviceUser[]>([]);
  const [historyLogs, setHistoryLogs] = useState<DeviceUserChangeLog[]>([]);
  const [syncRuns, setSyncRuns] = useState<DeviceUserSyncRun[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Three independent views: NEW | PENDING | LINKED
  const [viewTab, setViewTab] = useState<'NEW' | 'PENDING' | 'LINKED'>('PENDING');

  // Query controls
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('ALL');
  const [queryMode, setQueryMode] = useState<'AUTO' | 'TCP_DIRECT' | 'BIOTIME'>('AUTO');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryNotice, setQueryNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    run?: DeviceUserSyncRun | null;
  } | null>(null);

  // BioTime credentials optional collapsible
  const [showBioTimePanel, setShowBioTimePanel] = useState(false);
  const [btHost, setBtHost] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      return s.host || '192.168.1.29';
    } catch {
      return '192.168.1.29';
    }
  });
  const [btWebPort, setBtWebPort] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      return Number(s.webPort) || 8088;
    } catch {
      return 8088;
    }
  });
  const [btDbPort, setBtDbPort] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      return Number(s.dbPort) || 7496;
    } catch {
      return 7496;
    }
  });
  const [btWebUser, setBtWebUser] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      return s.webUser || '';
    } catch {
      return '';
    }
  });
  const [btWebPassword, setBtWebPassword] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      return s.webPassword || '';
    } catch {
      return '';
    }
  });
  const [btDbPassword, setBtDbPassword] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      return s.password || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const applyBt = (cfg: any) => {
      if (!cfg) return;
      if (cfg.host) setBtHost(cfg.host);
      if (cfg.httpPort) setBtWebPort(Number(cfg.httpPort));
      if (cfg.pgPort) setBtDbPort(Number(cfg.pgPort));
      if (cfg.authUser) setBtWebUser(cfg.authUser);
    };
    const loadBt = async () => {
      try {
        const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
        if (electronAPI?.isDesktop && typeof electronAPI.getBioTimeConfig === 'function') {
          const res = await electronAPI.getBioTimeConfig();
          applyBt(res?.config || res);
        } else {
          const res = await fetch(getApiUrl('/api/zkteco/biotime/config'));
          const data = await res.json();
          if (data?.config) applyBt(data.config);
        }
      } catch (_) {}
    };
    loadBt();
    const handler = (e: any) => {
      if (e?.detail) applyBt(e.detail);
      else loadBt();
    };
    window.addEventListener('drac:biotime-config-changed', handler);
    return () => window.removeEventListener('drac:biotime-config-changed', handler);
  }, []);

  // Table Filters & Pagination
  const [filterDeviceSn, setFilterDeviceSn] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPresence, setFilterPresence] = useState<'ALL' | 'PRESENT' | 'MISSING'>('ALL');
  const [filterPin, setFilterPin] = useState<string>('');
  const [filterName, setFilterName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Unified GESTIONAR USUARIO Modal State (Option A: Link Existing | Option B: Register New)
  const [manageUser, setManageUser] = useState<BiometricDeviceUser | null>(null);
  const [manageMode, setManageMode] = useState<'CHOICE' | 'LINK_EXISTING'>('CHOICE');
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  const [workerSearch, setWorkerSearch] = useState<string>('');
  const [workerDepFilter, setWorkerDepFilter] = useState<string>('ALL');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [linkObservation, setLinkObservation] = useState<string>('');
  const [savePinToWorker, setSavePinToWorker] = useState<boolean>(true);
  const [applyRetroactivePunches, setApplyRetroactivePunches] = useState<boolean>(true);
  const [confirmPinChange, setConfirmPinChange] = useState<boolean>(false);
  const [isSavingLink, setIsSavingLink] = useState<boolean>(false);
  const [linkModalError, setLinkModalError] = useState<string | null>(null);

  const [historyUser, setHistoryUser] = useState<BiometricDeviceUser | null>(null);
  const [detailUser, setDetailUser] = useState<BiometricDeviceUser | null>(null);
  const [showSyncRunsModal, setShowSyncRunsModal] = useState<boolean>(false);

  const [clockNameUser, setClockNameUser] = useState<BiometricDeviceUser | null>(null);
  const [clockNameInput, setClockNameInput] = useState<string>('');
  const [isSavingClockName, setIsSavingClockName] = useState<boolean>(false);
  const [clockNameError, setClockNameError] = useState<string | null>(null);

  const canLinkUsers = useMemo(
    () => !activeRole || LINK_ALLOWED_ROLES.includes(String(activeRole).toUpperCase()),
    [activeRole]
  );
  const canEditClockName = useMemo(
    () => CLOCK_WRITE_ADMIN_ROLES.includes(String(activeRole || '').toUpperCase()),
    [activeRole]
  );

  // Re-evaluate live classification against provided/current employee master list without altering clock origin fields
  const reclassifyList = useCallback(
    (list: BiometricDeviceUser[], empMaster: Employee[] = employees): BiometricDeviceUser[] => {
      return list.map((u) => {
        const ev = classifyDeviceUserBinding(u, empMaster, list);
        const emp = ev.matchedEmployee;
        const cand = ev.candidateEmployee;
        return {
          ...u,
          link_status: ev.link_status,
          employee_codigo_drac: emp?.codigo_trabajador || u.employee_codigo_drac || null,
          employee_dni: emp?.dni || u.employee_dni || null,
          employee_full_name: emp ? normalizePersonName(`${emp.first_name} ${emp.last_name}`) : u.employee_full_name || null,
          employee_dependencia_name: emp?.dependencia_name || u.employee_dependencia_name || null,
          employee_area_name: emp?.area_name || u.employee_area_name || null,
          employee_cargo_name: getEmployeeCargoLabel(emp) !== '—' ? getEmployeeCargoLabel(emp) : u.employee_cargo_name || null,
          candidate_employee_id: !emp && cand ? cand.id : null,
          candidate_employee_name: !emp && cand ? normalizePersonName(`${cand.first_name} ${cand.last_name}`) : null,
          candidate_employee_dni: !emp && cand ? cand.dni : null,
          candidate_employee_code: !emp && cand ? cand.codigo_trabajador : null,
          candidate_reason: !emp ? ev.candidateReason : null,
          conflict_reason: ev.conflictReason,
        };
      });
    },
    [employees]
  );

  const loadStore = useCallback(async () => {
    setLoadingStore(true);
    setStoreError(null);
    let loadedUsers: BiometricDeviceUser[] = [];
    let loadedHistory: DeviceUserChangeLog[] = [];
    let loadedSyncs: DeviceUserSyncRun[] = [];
    let gotAny = false;

    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (electronAPI?.isDesktop && typeof electronAPI.getDeviceUsersStore === 'function') {
      try {
        const ipcStore = await electronAPI.getDeviceUsersStore();
        if (ipcStore) {
          loadedUsers = Array.isArray(ipcStore.users) ? ipcStore.users : [];
          loadedHistory = Array.isArray(ipcStore.history) ? ipcStore.history : [];
          loadedSyncs = Array.isArray(ipcStore.syncLogs) ? ipcStore.syncLogs : [];
          gotAny = true;
        }
      } catch (err: any) {
        console.warn('Error leyendo almacén IPC de usuarios de reloj:', err);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/zkteco/device-users'));
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const srvUsers = Array.isArray(data.users) ? data.users : [];
          const srvHistory = Array.isArray(data.history) ? data.history : [];
          const srvSyncs = Array.isArray(data.syncLogs) ? data.syncLogs : [];
          if (!gotAny || srvUsers.length >= loadedUsers.length) {
            loadedUsers = srvUsers;
            loadedHistory = srvHistory.length >= loadedHistory.length ? srvHistory : loadedHistory;
            loadedSyncs = srvSyncs.length >= loadedSyncs.length ? srvSyncs : loadedSyncs;
          }
          gotAny = true;
        }
      }
    } catch (err: any) {
      if (!gotAny) {
        setStoreError(`No se pudo cargar el registro de usuarios de relojes: ${err?.message || 'Sin conexión al servidor local'}`);
      }
    }

    setDeviceUsers(reclassifyList(loadedUsers, employees));
    setHistoryLogs(loadedHistory);
    setSyncRuns(loadedSyncs);
    setLoadingStore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  // Live reclassify when master employee directory refreshes without blinking loading state
  useEffect(() => {
    setDeviceUsers((prev) => (prev.length > 0 ? reclassifyList(prev, employees) : prev));
  }, [employees, reclassifyList]);

  const saveBioTimePrefs = () => {
    try {
      const existing = JSON.parse(localStorage.getItem('drac_biotime_settings') || '{}');
      localStorage.setItem(
        'drac_biotime_settings',
        JSON.stringify({
          ...existing,
          host: btHost.trim(),
          webPort: Number(btWebPort) || 8088,
          dbPort: Number(btDbPort) || 7496,
          webUser: btWebUser.trim(),
          webPassword: btWebPassword,
          password: btDbPassword,
        })
      );
    } catch (_) {}
  };

  // OBTENER USUARIOS DEL RELOJ (Electron Desktop primero, luego Express API)
  const handleQueryClockUsers = async () => {
    setIsQuerying(true);
    setQueryNotice(null);
    saveBioTimePrefs();

    const btConfig = {
      host: btHost.trim() || '192.168.1.29',
      webPort: Number(btWebPort) || 8088,
      dbPort: Number(btDbPort) || 7496,
      dbName: 'biotime',
      dbUser: 'postgres',
      password: btDbPassword || undefined,
      webUser: btWebUser.trim() || undefined,
      webPassword: btWebPassword || undefined,
    };

    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

    // 1. Modo Escritorio Electron
    if (electronAPI?.isDesktop && typeof electronAPI.queryZkDeviceUsers === 'function') {
      const targets =
        selectedDeviceId === 'ALL'
          ? devices
          : devices.filter((d) => d.id === selectedDeviceId || d.serial_number === selectedDeviceId);

      if (targets.length === 0) {
        setQueryNotice({
          type: 'error',
          title: 'Sin dispositivos configurados',
          message: 'Registre o seleccione un reloj biométrico ZKTeco antes de obtener usuarios.',
        });
        setIsQuerying(false);
        return;
      }

      let workingUsers = [...deviceUsers];
      let workingHistory = [...historyLogs];
      let workingSyncLogs = [...syncRuns];
      const runSummaries: DeviceUserSyncRun[] = [];
      let anySuccess = false;
      let totalNewDetected = 0;
      let needsCreds = false;

      for (const dev of targets) {
        const devSn = String(dev.serial_number || dev.id || 'AEH2223460040').trim().toUpperCase();
        try {
          const res = await electronAPI.queryZkDeviceUsers({
            deviceId: dev.id,
            deviceName: dev.name,
            ip: dev.ip_address,
            port: dev.port || 7496,
            timeoutMs: 4500,
            commKey: dev.comm_key ?? 0,
            model: dev.model || 'ZKTeco G3',
            serial: devSn,
            mode: queryMode,
            biotime: btConfig,
          });

          if (res?.success && Array.isArray(res.users)) {
            anySuccess = true;
            const rec = reconcileDeviceUsers({
              existingUsers: workingUsers,
              fetchedUsers: res.users as RawClockUserInput[],
              employees,
              deviceId: dev.id,
              deviceSn: res.serial_number || devSn,
              deviceName: res.device_name || dev.name || devSn,
              deviceIp: dev.ip_address,
              method: res.source_method || 'TCP_NODE_ZKLIB',
              sourceScope: res.source_scope || 'DIRECT_CLOCK',
              executedBy: 'Operador Desktop DRAC',
              executedRole: activeRole,
              message: res.message,
            });
            totalNewDetected += rec.syncRun.new_users;
            workingUsers = rec.mergedUsers;
            workingHistory = [...rec.newLogs, ...workingHistory].slice(0, 1500);
            workingSyncLogs = [rec.syncRun, ...workingSyncLogs].slice(0, 300);
            runSummaries.push(rec.syncRun);
          } else {
            if (res?.needsWebCredentials) needsCreds = true;
            const failRun: DeviceUserSyncRun = {
              id: `du_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              device_id: dev.id,
              device_sn: devSn,
              device_name: dev.name || devSn,
              method: queryMode === 'BIOTIME' ? 'BIOTIME_HTTP_API' : 'TCP_NODE_ZKLIB',
              source_scope: 'DIRECT_CLOCK',
              success: false,
              message: res?.message || `No se pudo leer usuarios desde ${dev.ip_address}:${dev.port}.`,
              error: res?.error || 'QUERY_FAILED',
              total_fetched: 0,
              new_users: 0,
              new_user_ids: [],
              updated_users: 0,
              unchanged_users: 0,
              missing_users: 0,
              reappeared_users: 0,
              linked_count: workingUsers.filter((u) => u.device_sn === devSn && (u.link_status === 'VINCULADO' || u.link_status === 'REGISTRADO')).length,
              pending_count: workingUsers.filter((u) => u.device_sn === devSn && u.link_status === 'PENDIENTE_VINCULACION').length,
              possible_match_count: workingUsers.filter((u) => u.device_sn === devSn && u.link_status === 'POSIBLE_COINCIDENCIA').length,
              review_count: workingUsers.filter((u) => u.device_sn === devSn && u.link_status === 'REVISAR').length,
              executed_by: 'Operador Desktop DRAC',
              created_at: new Date().toISOString(),
            };
            workingSyncLogs = [failRun, ...workingSyncLogs].slice(0, 300);
            runSummaries.push(failRun);
          }
        } catch (err: any) {
          const failRun: DeviceUserSyncRun = {
            id: `du_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            device_id: dev.id,
            device_sn: devSn,
            device_name: dev.name || devSn,
            method: 'AUTO',
            source_scope: 'DIRECT_CLOCK',
            success: false,
            message: err?.message || 'Error inesperado invocando driver nativo de escritorio.',
            error: 'IPC_ERROR',
            total_fetched: 0,
            new_users: 0,
            new_user_ids: [],
            updated_users: 0,
            unchanged_users: 0,
            missing_users: 0,
            reappeared_users: 0,
            linked_count: 0,
            pending_count: 0,
            possible_match_count: 0,
            review_count: 0,
            executed_by: 'Operador Desktop DRAC',
            created_at: new Date().toISOString(),
          };
          workingSyncLogs = [failRun, ...workingSyncLogs].slice(0, 300);
          runSummaries.push(failRun);
        }
      }

      if (typeof electronAPI.saveDeviceUsersStore === 'function') {
        await electronAPI.saveDeviceUsersStore({
          users: workingUsers,
          history: workingHistory,
          syncLogs: workingSyncLogs,
        });
      }

      try {
        await fetch(getApiUrl('/api/zkteco/device-users/sync-store'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users: workingUsers,
            history: workingHistory,
            syncLogs: workingSyncLogs,
          }),
        });
      } catch (_) {}

      setDeviceUsers(workingUsers);
      setHistoryLogs(workingHistory);
      setSyncRuns(workingSyncLogs);
      if (anySuccess && totalNewDetected > 0) setViewTab('NEW');
      if (needsCreds) setShowBioTimePanel(true);

      const lastRun = runSummaries[0] || null;
      setQueryNotice({
        type: anySuccess ? 'success' : 'error',
        title: anySuccess ? 'Consulta de usuarios completada' : 'No se pudo completar la consulta en relojes',
        message: runSummaries.map((r) => r.message).join(' | '),
        run: lastRun,
      });

      if (anySuccess && onRefreshAll) onRefreshAll();
      setIsQuerying(false);
      return;
    }

    // 2. Modo Web / Backend Express
    try {
      const res = await fetch(getApiUrl('/api/zkteco/device-users/query'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole || 'ADMIN_GENERAL',
          'x-user-name': 'Administrador DRAC',
        },
        body: JSON.stringify({
          deviceId: selectedDeviceId === 'ALL' ? undefined : selectedDeviceId,
          mode: queryMode,
          biotime: btConfig,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.users)) setDeviceUsers(reclassifyList(data.users, employees));
      if (Array.isArray(data.history)) setHistoryLogs(data.history);
      if (Array.isArray(data.syncLogs)) setSyncRuns(data.syncLogs);
      if (data.needsWebCredentials) setShowBioTimePanel(true);

      const resultsArr: DeviceUserSyncRun[] = Array.isArray(data.results) ? data.results : [];
      const firstRun: DeviceUserSyncRun | null = resultsArr.length > 0 ? resultsArr[0] : null;
      const totalNew = resultsArr.reduce((acc, r) => acc + (r.success ? Number(r.new_users || 0) : 0), 0);
      if (data.success && totalNew > 0) setViewTab('NEW');

      setQueryNotice({
        type: data.success ? 'success' : 'error',
        title: data.success ? 'Consulta de usuarios completada' : 'Fallo de conectividad al consultar reloj',
        message: data.message || (data.success ? 'Usuarios sincronizados.' : 'El reloj o servidor BioTime no respondió desde esta red.'),
        run: firstRun,
      });
      if (data.success && onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setQueryNotice({
        type: 'error',
        title: 'Error de red consultando servidor local',
        message: `No se pudo ejecutar la consulta: ${err?.message || 'Error de conexión'}`,
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const availableDeviceSns = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((d) => {
      const sn = String(d.serial_number || '').trim().toUpperCase();
      if (sn) map.set(sn, d.name || sn);
    });
    deviceUsers.forEach((u) => {
      if (u.device_sn && !map.has(u.device_sn)) map.set(u.device_sn, u.device_name || u.device_sn);
    });
    return Array.from(map.entries()).map(([sn, name]) => ({ sn, name }));
  }, [devices, deviceUsers]);

  // Latest newly discovered IDs from the most recent successful sync run per device SN (incremental: never repeats prior pending PINs)
  const latestNewUserIdSet = useMemo(() => {
    const latestRunBySn = new Map<string, DeviceUserSyncRun>();
    for (const run of syncRuns) {
      if (!run.success || !run.device_sn) continue;
      if (!latestRunBySn.has(run.device_sn)) {
        latestRunBySn.set(run.device_sn, run);
      }
    }
    const ids = new Set<string>();
    latestRunBySn.forEach((run) => {
      if (filterDeviceSn !== 'ALL' && run.device_sn !== filterDeviceSn) return;
      if (Array.isArray(run.new_user_ids)) {
        run.new_user_ids.forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [syncRuns, filterDeviceSn]);

  // Scoped base by selected device filter
  const deviceScopedUsers = useMemo(
    () => (filterDeviceSn === 'ALL' ? deviceUsers : deviceUsers.filter((u) => u.device_sn === filterDeviceSn)),
    [deviceUsers, filterDeviceSn]
  );

  // Separate counts for the 3 independent views + KPIs
  const viewPools = useMemo(() => {
    const newPool = deviceScopedUsers.filter((u) => latestNewUserIdSet.has(u.id) && !u.employee_id);
    const pendingPool = deviceScopedUsers.filter((u) => !u.employee_id);
    const linkedPool = deviceScopedUsers.filter((u) => Boolean(u.employee_id));
    return { newPool, pendingPool, linkedPool };
  }, [deviceScopedUsers, latestNewUserIdSet]);

  const kpis = useMemo(() => {
    return {
      total: deviceScopedUsers.length,
      newDetected: viewPools.newPool.length,
      pending: viewPools.pendingPool.length,
      linkedAndRegistered: viewPools.linkedPool.length,
      possible: deviceScopedUsers.filter((u) => !u.employee_id && u.link_status === 'POSIBLE_COINCIDENCIA').length,
      missing: deviceScopedUsers.filter((u) => u.present_on_device === false).length,
    };
  }, [deviceScopedUsers, viewPools]);

  const filteredUsers = useMemo(() => {
    const qPin = filterPin.trim().toLowerCase();
    const qName = filterName.trim().toLowerCase();
    const basePool =
      viewTab === 'NEW'
        ? viewPools.newPool
        : viewTab === 'PENDING'
        ? viewPools.pendingPool
        : viewPools.linkedPool;

    return basePool.filter((u) => {
      if (filterStatus !== 'ALL' && u.link_status !== filterStatus) return false;
      if (filterPresence === 'PRESENT' && u.present_on_device === false) return false;
      if (filterPresence === 'MISSING' && u.present_on_device !== false) return false;
      if (qPin) {
        const pinMatch =
          String(u.pin || '').toLowerCase().includes(qPin) ||
          String(u.clock_employee_code || '').toLowerCase().includes(qPin) ||
          String(u.card_number || '').toLowerCase().includes(qPin);
        if (!pinMatch) return false;
      }
      if (qName) {
        const nameMatch =
          String(u.clock_name || '').toLowerCase().includes(qName) ||
          String(u.employee_full_name || '').toLowerCase().includes(qName) ||
          String(u.employee_dni || '').toLowerCase().includes(qName) ||
          String(u.employee_codigo_drac || '').toLowerCase().includes(qName) ||
          String(u.employee_dependencia_name || '').toLowerCase().includes(qName);
        if (!nameMatch) return false;
      }
      return true;
    });
  }, [viewPools, viewTab, filterStatus, filterPresence, filterPin, filterName]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewTab, filterDeviceSn, filterStatus, filterPresence, filterPin, filterName]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const pendingPunchesCountForUser = useCallback(
    (sn: string, pin: string) =>
      rawPunches.filter(
        (p) =>
          String(p.device_sn || '').trim().toUpperCase() === sn &&
          String(p.employee_code || p.employee_dni || '').trim() === pin &&
          (p.validation_status === 'PENDIENTE_IDENTIFICACION' || !p.employee_id)
      ).length,
    [rawPunches]
  );

  // Open GESTIONAR USUARIO modal
  const openManageModal = (u: BiometricDeviceUser, initialMode: 'CHOICE' | 'LINK_EXISTING' = 'CHOICE') => {
    setManageUser(u);
    setManageMode(initialMode);
    setShowRegisterModal(false);
    setWorkerSearch(u.candidate_employee_dni || '');
    setWorkerDepFilter('ALL');
    setSelectedEmpId(u.employee_id || u.candidate_employee_id || '');
    setLinkObservation(u.observations || '');
    setSavePinToWorker(true);
    setApplyRetroactivePunches(true);
    setConfirmPinChange(false);
    setLinkModalError(null);
  };

  const uniqueDependencies = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.dependencia_name) set.add(e.dependencia_name);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Search directory by DNI, Código DRAC, Apellido paterno, Apellido materno, Nombres, Dependencia
  const modalFilteredEmployees = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return employees
      .filter((e) => (workerDepFilter === 'ALL' ? true : e.dependencia_name === workerDepFilter))
      .filter((e) => {
        if (!q) return true;
        const fullName = `${e.first_name || ''} ${e.last_name || ''} ${e.apellido_paterno || ''} ${e.apellido_materno || ''}`.toLowerCase();
        return (
          fullName.includes(q) ||
          String(e.dni || '').toLowerCase().includes(q) ||
          String(e.codigo_trabajador || '').toLowerCase().includes(q) ||
          String(e.dependencia_name || '').toLowerCase().includes(q) ||
          String(e.area_name || '').toLowerCase().includes(q) ||
          String(e.zkteco_pin || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [employees, workerSearch, workerDepFilter]);

  const selectedModalEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) || null,
    [employees, selectedEmpId]
  );

  // Detect live PIN conflict when selecting an existing employee
  const selectedEmployeePinConflict = useMemo(() => {
    if (!manageUser || !selectedModalEmployee) return null;
    if (manageUser.employee_id === selectedModalEmployee.id) return null;

    const existingSameDevice = deviceUsers.find(
      (other) =>
        other.id !== manageUser.id &&
        other.device_sn === manageUser.device_sn &&
        other.employee_id === selectedModalEmployee.id &&
        other.pin !== manageUser.pin
    );
    if (existingSameDevice) {
      return {
        existingPin: existingSameDevice.pin,
        reason: `Este trabajador ya está vinculado al PIN ${existingSameDevice.pin} en el mismo reloj (${manageUser.device_sn}).`,
      };
    }

    const workerPin = String(selectedModalEmployee.zkteco_pin || '').trim();
    if (workerPin && workerPin !== String(manageUser.pin).trim()) {
      return {
        existingPin: workerPin,
        reason: `La ficha institucional del trabajador ya registra el PIN/código biométrico "${workerPin}".`,
      };
    }

    return null;
  }, [manageUser, selectedModalEmployee, deviceUsers]);

  // Reset confirmation checkbox whenever selected employee changes
  useEffect(() => {
    setConfirmPinChange(false);
    setLinkModalError(null);
  }, [selectedEmpId]);

  const executeLinkAction = async (
    action: 'LINK' | 'RELINK' | 'UNLINK' | 'UPDATE_OBSERVATION',
    explicitConfirmPinChange?: boolean
  ) => {
    if (!manageUser) return;
    if ((action === 'LINK' || action === 'RELINK') && !selectedEmpId) {
      setLinkModalError('Seleccione un trabajador del directorio institucional antes de confirmar.');
      return;
    }

    const shouldConfirmPin = explicitConfirmPinChange ?? confirmPinChange;
    if ((action === 'LINK' || action === 'RELINK') && selectedEmployeePinConflict && !shouldConfirmPin) {
      setLinkModalError(
        `Confirme explícitamente que desea asignar/reemplazar el PIN anterior (${selectedEmployeePinConflict.existingPin}) por el PIN ${manageUser.pin}.`
      );
      return;
    }

    setIsSavingLink(true);
    setLinkModalError(null);

    const payload = {
      device_user_id: manageUser.id,
      action,
      employee_id: action === 'UNLINK' ? null : selectedEmpId,
      observations: linkObservation.trim(),
      save_pin_to_employee: savePinToWorker,
      apply_to_historical_punches: applyRetroactivePunches,
      confirm_pin_change: shouldConfirmPin,
      user_role: activeRole || 'ADMIN_GENERAL',
      user_name: 'Administrador DRAC',
    };

    try {
      const res = await fetch(getApiUrl('/api/zkteco/device-users/link'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole || 'ADMIN_GENERAL',
          'x-user-name': 'Administrador DRAC',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLinkModalError(data.message || 'No se pudo completar la operación.');
        setIsSavingLink(false);
        return;
      }

      if (data.record) {
        setDeviceUsers((prev) =>
          reclassifyList(
            prev.map((item) => (item.id === data.record.id ? data.record : item)),
            employees
          )
        );
      }
      if (Array.isArray(data.added_logs) && data.added_logs.length > 0) {
        setHistoryLogs((prev) => [...data.added_logs, ...prev].slice(0, 1500));
      }

      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI?.isDesktop && typeof electronAPI.saveDeviceUsersStore === 'function' && data.record) {
        const nextUsers = reclassifyList(
          deviceUsers.map((item) => (item.id === data.record.id ? data.record : item)),
          employees
        );
        const nextLogs = Array.isArray(data.added_logs) ? [...data.added_logs, ...historyLogs] : historyLogs;
        await electronAPI.saveDeviceUsersStore({ users: nextUsers, history: nextLogs, syncLogs: syncRuns });
      }

      setQueryNotice({
        type: 'success',
        title:
          action === 'UNLINK'
            ? 'Usuario desvinculado'
            : action === 'UPDATE_OBSERVATION'
            ? 'Observación actualizada'
            : 'Vinculación institucional guardada',
        message: data.message,
      });
      if (onRecordAudit) {
        onRecordAudit(
          `USUARIO_RELOJ_${action}`,
          data.message,
          selectedModalEmployee?.dni,
          selectedModalEmployee ? `${selectedModalEmployee.first_name} ${selectedModalEmployee.last_name}` : undefined
        );
      }
      setManageUser(null);
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
      if (electronAPI?.isDesktop && typeof electronAPI.saveDeviceUsersStore === 'function') {
        const nowIso = new Date().toISOString();
        const emp = selectedModalEmployee;
        const empFull = emp ? normalizePersonName(`${emp.first_name} ${emp.last_name}`) : null;
        const updatedRecord: BiometricDeviceUser =
          action === 'UNLINK'
            ? {
                ...manageUser,
                employee_id: null,
                employee_codigo_drac: null,
                employee_dni: null,
                employee_full_name: null,
                employee_dependencia_name: null,
                employee_area_name: null,
                employee_cargo_name: null,
                link_type: null,
                observations: linkObservation.trim() || null,
                unlinked_at: nowIso,
                updated_at: nowIso,
              }
            : action === 'UPDATE_OBSERVATION'
            ? {
                ...manageUser,
                observations: linkObservation.trim() || null,
                updated_at: nowIso,
              }
            : {
                ...manageUser,
                employee_id: emp?.id || null,
                employee_codigo_drac: emp?.codigo_trabajador || null,
                employee_dni: emp?.dni || null,
                employee_full_name: empFull,
                employee_dependencia_name: emp?.dependencia_name || null,
                employee_area_name: emp?.area_name || null,
                employee_cargo_name: getEmployeeCargoLabel(emp) !== '—' ? getEmployeeCargoLabel(emp) : null,
                link_type: 'VINCULADO',
                observations: linkObservation.trim() || null,
                linked_by: 'Administrador Desktop',
                linked_at: nowIso,
                unlinked_at: null,
                updated_at: nowIso,
              };

        const logEntry: DeviceUserChangeLog = {
          id: `du_log_${Date.now()}`,
          device_user_id: manageUser.id,
          device_sn: manageUser.device_sn,
          pin: manageUser.pin,
          event_type:
            action === 'UNLINK'
              ? 'UNLINKED'
              : action === 'UPDATE_OBSERVATION'
              ? 'OBSERVATION_UPDATED'
              : manageUser.employee_id
              ? 'RELINKED'
              : 'LINKED',
          previous_employee_id: manageUser.employee_id || null,
          new_employee_id: updatedRecord.employee_id || null,
          observation: linkObservation.trim() || `Operación ${action} realizada en cliente Desktop.`,
          operator_name: 'Administrador Desktop',
          operator_role: activeRole,
          created_at: nowIso,
        };

        const nextUsers = reclassifyList(
          deviceUsers.map((item) => (item.id === manageUser.id ? updatedRecord : item)),
          employees
        );
        const nextHistory = [logEntry, ...historyLogs].slice(0, 1500);
        await electronAPI.saveDeviceUsersStore({
          users: nextUsers,
          history: nextHistory,
          syncLogs: syncRuns,
        });
        setDeviceUsers(nextUsers);
        setHistoryLogs(nextHistory);
        setQueryNotice({
          type: 'success',
          title: 'Guardado en almacenamiento local de escritorio',
          message: `Operación registrada localmente para PIN ${manageUser.pin}.`,
        });
        setManageUser(null);
      } else {
        setLinkModalError(`Error comunicando con el servidor: ${err?.message || 'Error de red'}`);
      }
    } finally {
      setIsSavingLink(false);
    }
  };

  // Opción B: Registrar nuevo trabajador con el formulario oficial y vincular inmediatamente como REGISTRADO
  const handleRegisterNewEmployeeAndLink = async (
    empData: Omit<Employee, 'id'>
  ): Promise<void | { error?: string; existingEmployee?: Employee }> => {
    if (!manageUser) return { error: 'No hay un usuario de reloj seleccionado.' };

    try {
      const empRes = await fetch(getApiUrl('/api/employees'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole || 'ADMIN_GENERAL',
        },
        body: JSON.stringify({
          ...empData,
          id: `emp-${empData.dni || Date.now()}`,
          biometric_sync_device_id: manageUser.device_id,
          biometric_sync_device_name: manageUser.device_name,
          biometric_sync_status: 'SINCRONIZADO',
          rejectIfDniExists: true,
          rejectIfCodeExists: true,
        }),
      });
      const empJson = await empRes.json();

      if (empRes.status === 409) {
        return {
          error: empJson.message || 'Ya existe un trabajador registrado con ese DNI o Código DRAC.',
          existingEmployee: empJson.existingEmployee,
        };
      }
      if (!empRes.ok || !empJson.success || !empJson.data) {
        return {
          error: empJson.message || 'No se pudo registrar el trabajador en el directorio institucional.',
        };
      }

      const createdEmp: Employee = empJson.data;

      // Vincular inmediatamente el usuario del reloj con el trabajador recién creado (link_type: REGISTRADO)
      const linkRes = await fetch(getApiUrl('/api/zkteco/device-users/link'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole || 'ADMIN_GENERAL',
          'x-user-name': 'Administrador DRAC',
        },
        body: JSON.stringify({
          device_user_id: manageUser.id,
          action: 'REGISTER_LINK',
          employee_id: createdEmp.id,
          observations: `Trabajador registrado desde reloj ${manageUser.device_name} (${manageUser.device_sn}) · PIN ${manageUser.pin}.`,
          save_pin_to_employee: true,
          apply_to_historical_punches: true,
          confirm_pin_change: true,
          user_role: activeRole || 'ADMIN_GENERAL',
          user_name: 'Administrador DRAC',
        }),
      });
      const linkJson = await linkRes.json();

      if (!linkRes.ok || !linkJson.success) {
        return {
          error: linkJson.message || 'El trabajador fue creado, pero falló la vinculación automática del PIN.',
        };
      }

      const nextEmpList = [createdEmp, ...employees.filter((e) => e.id !== createdEmp.id)];
      if (linkJson.record) {
        const nextUsers = reclassifyList(
          deviceUsers.map((item) => (item.id === linkJson.record.id ? linkJson.record : item)),
          nextEmpList
        );
        setDeviceUsers(nextUsers);
        const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
        if (electronAPI?.isDesktop && typeof electronAPI.saveDeviceUsersStore === 'function') {
          const nextLogs = Array.isArray(linkJson.added_logs) ? [...linkJson.added_logs, ...historyLogs] : historyLogs;
          await electronAPI.saveDeviceUsersStore({ users: nextUsers, history: nextLogs, syncLogs: syncRuns });
        }
      }
      if (Array.isArray(linkJson.added_logs) && linkJson.added_logs.length > 0) {
        setHistoryLogs((prev) => [...linkJson.added_logs, ...prev].slice(0, 1500));
      }

      setQueryNotice({
        type: 'success',
        title: 'Nuevo trabajador registrado y vinculado (REGISTRADO)',
        message: `${createdEmp.first_name} ${createdEmp.last_name} (DNI ${createdEmp.dni}, ${createdEmp.codigo_trabajador}) fue incorporado al directorio institucional y vinculado al PIN ${manageUser.pin} (${manageUser.device_sn}).${
          linkJson.retroactive_punches_updated > 0 ? ` ${linkJson.retroactive_punches_updated} marcaciones históricas actualizadas.` : ''
        }`,
      });

      if (onRecordAudit) {
        onRecordAudit(
          'CREAR_Y_VINCULAR_TRABAJADOR_RELOJ',
          `Nuevo trabajador ${createdEmp.first_name} ${createdEmp.last_name} (${createdEmp.codigo_trabajador}) registrado desde PIN ${manageUser.pin} (${manageUser.device_sn})`,
          createdEmp.dni,
          `${createdEmp.first_name} ${createdEmp.last_name}`
        );
      }

      setShowRegisterModal(false);
      setManageUser(null);
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      return {
        error: `Error de red al registrar y vincular trabajador: ${err?.message || 'Sin conexión con servidor'}`,
      };
    }
  };

  // Optional independent admin-only clock name edit
  const handleSaveClockName = async () => {
    if (!clockNameUser) return;
    const trimmed = clockNameInput.trim().slice(0, 24);
    if (!trimmed) {
      setClockNameError('Ingrese un nombre válido (máximo 24 caracteres).');
      return;
    }
    setIsSavingClockName(true);
    setClockNameError(null);

    const dev = devices.find((d) => d.serial_number === clockNameUser.device_sn || d.id === clockNameUser.device_id);
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

    if (electronAPI?.isDesktop && typeof electronAPI.setZkDeviceUserName === 'function' && dev?.ip_address) {
      try {
        const res = await electronAPI.setZkDeviceUserName({
          ip: dev.ip_address,
          port: dev.port || 7496,
          commKey: dev.comm_key ?? 0,
          uid: clockNameUser.uid ?? undefined,
          pin: clockNameUser.pin,
          name: trimmed,
        });
        if (!res.success) {
          setClockNameError(res.message);
          setIsSavingClockName(false);
          return;
        }
        const nowIso = new Date().toISOString();
        const updatedRecord: BiometricDeviceUser = {
          ...clockNameUser,
          clock_name: trimmed,
          last_clock_updated_at: nowIso,
          updated_at: nowIso,
        };
        const logEntry: DeviceUserChangeLog = {
          id: `du_log_${Date.now()}`,
          device_user_id: clockNameUser.id,
          device_sn: clockNameUser.device_sn,
          pin: clockNameUser.pin,
          event_type: 'CLOCK_NAME_UPDATED',
          previous_values: { clock_name: clockNameUser.clock_name || null },
          new_values: { clock_name: trimmed },
          observation: `Nombre en reloj físico actualizado a "${trimmed}". El padrón institucional no fue alterado.`,
          operator_name: 'Administrador Desktop',
          operator_role: activeRole,
          created_at: nowIso,
        };
        const nextUsers = deviceUsers.map((item) => (item.id === updatedRecord.id ? updatedRecord : item));
        const nextHistory = [logEntry, ...historyLogs];
        if (typeof electronAPI.saveDeviceUsersStore === 'function') {
          await electronAPI.saveDeviceUsersStore({ users: nextUsers, history: nextHistory, syncLogs: syncRuns });
        }
        setDeviceUsers(nextUsers);
        setHistoryLogs(nextHistory);
        setQueryNotice({ type: 'success', title: 'Nombre actualizado en reloj físico', message: res.message });
        setClockNameUser(null);
        setIsSavingClockName(false);
        return;
      } catch (err: any) {
        setClockNameError(err?.message || 'Error enviando nombre por driver nativo.');
        setIsSavingClockName(false);
        return;
      }
    }

    try {
      const res = await fetch(getApiUrl(`/api/zkteco/device-users/${encodeURIComponent(clockNameUser.id)}/clock-name`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole || 'ADMIN_GENERAL',
          'x-user-name': 'Administrador DRAC',
        },
        body: JSON.stringify({ clock_name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setClockNameError(data.message || 'El dispositivo rechazó la actualización del nombre.');
        setIsSavingClockName(false);
        return;
      }
      if (data.record) {
        setDeviceUsers((prev) => prev.map((item) => (item.id === data.record.id ? data.record : item)));
      }
      if (data.log) {
        setHistoryLogs((prev) => [data.log, ...prev]);
      }
      setQueryNotice({ type: 'success', title: 'Nombre actualizado en el reloj físico', message: data.message });
      setClockNameUser(null);
    } catch (err: any) {
      setClockNameError(`Error de red: ${err?.message || 'No se pudo conectar al reloj'}`);
    } finally {
      setIsSavingClockName(false);
    }
  };

  // Export current view rows to Excel (.xlsx)
  const handleExportExcel = () => {
    const rows = filteredUsers.map((u, idx) => ({
      'N.º': idx + 1,
      'PIN / Código Biométrico': u.pin,
      'UID Interno': u.uid ?? '—',
      'Nombre en Reloj': u.clock_name || 'Sin nombre en reloj',
      'Código Empleado Reloj': u.clock_employee_code || '—',
      'Tarjeta RFID': u.card_number || '—',
      'Privilegio Reloj': u.privilege_label || '—',
      'Estado Reloj': u.clock_status || 'No proporcionado',
      'Dispositivo Origen': u.device_name,
      'Serial Reloj': u.device_sn,
      'Mecanismo / Alcance': `${u.source_method} (${u.source_scope})`,
      'Presente en Última Lectura': u.present_on_device === false ? 'NO (Histórico)' : 'SÍ',
      'Estado de Vinculación': LINK_STATUS_META[u.link_status]?.label || u.link_status,
      'Código DRAC': u.employee_codigo_drac || '—',
      'DNI': u.employee_dni || '—',
      'Trabajador Institucional': u.employee_full_name || '—',
      'Dependencia': u.employee_dependencia_name || '—',
      'Área / Oficina': u.employee_area_name || '—',
      'Cargo': u.employee_cargo_name || '—',
      'Observaciones': u.observations || '',
      'Última Consulta': formatDateTime(u.last_queried_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios_Relojes_ZK');
    XLSX.writeFile(wb, `DRAC_Usuarios_Relojes_ZKTeco_${viewTab}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const userHistoryForModal = useMemo(() => {
    if (!historyUser) return [];
    return historyLogs.filter(
      (l) => l.device_user_id === historyUser.id || (l.device_sn === historyUser.device_sn && l.pin === historyUser.pin)
    );
  }, [historyUser, historyLogs]);

  return (
    <div className="space-y-5">
      {/* Header Control Bar */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/25 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Usuarios Registrados en Relojes Biométricos ZKTeco
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                Obtenga usuarios reales desde sus relojes ZKTeco o BioTime PRO, gestione vinculaciones con trabajadores existentes o registre nuevos colaboradores directamente en el Directorio Institucional DRAC sin duplicidades.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowBioTimePanel((v) => !v)}
              className="px-3 py-2 bg-[#060709] hover:bg-slate-900 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>BioTime PRO</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSyncRunsModal(true)}
              className="px-3 py-2 bg-[#060709] hover:bg-slate-900 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span>Consultas ({syncRuns.length})</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredUsers.length === 0}
              className="px-3 py-2 bg-[#060709] hover:bg-slate-900 disabled:opacity-40 text-emerald-300 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleQueryClockUsers}
              disabled={isQuerying}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isQuerying ? 'animate-spin' : ''}`} />
              <span>{isQuerying ? 'Consultando reloj...' : 'OBTENER USUARIOS DEL RELOJ'}</span>
            </button>
          </div>
        </div>

        {/* Device Target & Protocol Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Dispositivo Biométrico a Consultar</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los relojes configurados ({devices.length})</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ip_address}:{d.port} · S/N {d.serial_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Mecanismo de Comunicación</label>
            <select
              value={queryMode}
              onChange={(e) => setQueryMode(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="AUTO">Automático (TCP Directo ZKTeco → Respaldo BioTime PRO)</option>
              <option value="TCP_DIRECT">Solo TCP Directo al Reloj (node-zklib / TCP raw)</option>
              <option value="BIOTIME">Solo Servidor BioTime PRO (API HTTP / PostgreSQL)</option>
            </select>
          </div>

          <div className="p-2.5 bg-[#060709] border border-slate-800 rounded-lg flex items-center gap-2.5 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Consulta incremental por <strong className="text-slate-200">(N.º Serie, PIN)</strong>: los usuarios ya detectados antes no vuelven a mostrarse como nuevos y conservan su estado.
            </span>
          </div>
        </div>

        {/* Optional Collapsible BioTime PRO Credentials */}
        {showBioTimePanel && (
          <div className="p-4 bg-[#060709] border border-slate-800 rounded-lg space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Parámetros de Respaldo BioTime PRO (API HTTP / PostgreSQL Solo Lectura)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowBioTimePanel(false)}
                className="text-slate-400 hover:text-white text-[11px]"
              >
                Ocultar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">IP Servidor BioTime</label>
                <input
                  value={btHost}
                  onChange={(e) => setBtHost(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Puerto Web HTTP</label>
                <input
                  type="number"
                  value={btWebPort}
                  onChange={(e) => setBtWebPort(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Puerto PostgreSQL</label>
                <input
                  type="number"
                  value={btDbPort}
                  onChange={(e) => setBtDbPort(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Usuario Web BioTime</label>
                <input
                  value={btWebUser}
                  onChange={(e) => setBtWebUser(e.target.value)}
                  placeholder="admin"
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Clave Web BioTime</label>
                <input
                  type="password"
                  value={btWebPassword}
                  onChange={(e) => setBtWebPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Clave PostgreSQL (opc.)</label>
                <input
                  type="password"
                  value={btDbPassword}
                  onChange={(e) => setBtDbPassword(e.target.value)}
                  placeholder="Solo si difiere"
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-white text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sync Result / Error Notice */}
      {queryNotice && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-2 ${
            queryNotice.type === 'success'
              ? 'bg-emerald-950/35 border-emerald-800/70 text-emerald-100'
              : queryNotice.type === 'warning'
              ? 'bg-amber-950/35 border-amber-800/70 text-amber-100'
              : 'bg-rose-950/35 border-rose-800/70 text-rose-100'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {queryNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-white">{queryNotice.title}</div>
                <p className="mt-0.5 opacity-90">{queryNotice.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQueryNotice(null)}
              className="text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {queryNotice.run && queryNotice.run.success && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10 font-mono tabular-nums text-[11px]">
              <span>Leídos: <strong className="text-white">{queryNotice.run.total_fetched}</strong></span>
              <span>Nuevos detectados: <strong className="text-cyan-300">{queryNotice.run.new_users}</strong></span>
              <span>Actualizados: <strong className="text-sky-300">{queryNotice.run.updated_users}</strong></span>
              <span>Sin cambios: <strong className="text-slate-300">{queryNotice.run.unchanged_users}</strong></span>
              <span>Vinculados/Reg.: <strong className="text-emerald-300">{queryNotice.run.linked_count}</strong></span>
              <span>Pendientes: <strong className="text-amber-300">{queryNotice.run.pending_count}</strong></span>
              <span>Ausentes en reloj: <strong className="text-rose-300">{queryNotice.run.missing_users}</strong></span>
              {queryNotice.run.detected_capabilities && queryNotice.run.detected_capabilities.length > 0 && (
                <span>
                  Campos detectados: <strong className="text-indigo-300">{queryNotice.run.detected_capabilities.join(', ')}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {storeError && (
        <div className="p-3.5 rounded-xl border border-rose-800/70 bg-rose-950/35 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{storeError}</span>
        </div>
      )}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-400 font-medium">Total en Relojes</div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">{kpis.total}</div>
        </div>
        <button
          type="button"
          onClick={() => setViewTab('NEW')}
          className={`text-left bg-[#090A0D] border rounded-xl p-3.5 transition-colors ${
            viewTab === 'NEW' ? 'border-cyan-500/70 bg-cyan-950/20' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-cyan-400 font-medium">Nuevos Detectados</div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">{kpis.newDetected}</div>
        </button>
        <button
          type="button"
          onClick={() => setViewTab('PENDING')}
          className={`text-left bg-[#090A0D] border rounded-xl p-3.5 transition-colors ${
            viewTab === 'PENDING' ? 'border-amber-500/70 bg-amber-950/20' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-amber-400 font-medium">Pendientes de Gestión</div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">{kpis.pending}</div>
        </button>
        <button
          type="button"
          onClick={() => setViewTab('LINKED')}
          className={`text-left bg-[#090A0D] border rounded-xl p-3.5 transition-colors ${
            viewTab === 'LINKED' ? 'border-emerald-500/70 bg-emerald-950/20' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-emerald-400 font-medium">Vinculados / Registrados</div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">{kpis.linkedAndRegistered}</div>
        </button>
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] text-sky-400 font-medium">Posible Coincidencia</div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">{kpis.possible}</div>
        </div>
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-400 font-medium">Ya no figuran en Reloj</div>
          <div className="text-xl font-bold text-slate-200 font-mono tabular-nums mt-1">{kpis.missing}</div>
        </div>
      </div>

      {/* Three Independent Views Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-[#090A0D] border border-slate-800 rounded-xl p-2">
        <button
          type="button"
          onClick={() => setViewTab('NEW')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
            viewTab === 'NEW'
              ? 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>A. NUEVOS USUARIOS DETECTADOS</span>
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono tabular-nums text-[11px]">{viewPools.newPool.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('PENDING')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
            viewTab === 'PENDING'
              ? 'bg-amber-600/20 text-amber-200 border border-amber-500/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>B. PENDIENTES DE VINCULACIÓN O REGISTRO</span>
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono tabular-nums text-[11px]">{viewPools.pendingPool.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('LINKED')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
            viewTab === 'LINKED'
              ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>C. USUARIOS VINCULADOS / REGISTRADOS</span>
          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono tabular-nums text-[11px]">{viewPools.linkedPool.length}</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Dispositivo</label>
            <select
              value={filterDeviceSn}
              onChange={(e) => setFilterDeviceSn(e.target.value)}
              className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los dispositivos</option>
              {availableDeviceSns.map((d) => (
                <option key={d.sn} value={d.sn}>
                  {d.name} ({d.sn})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Estado de Vinculación</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los estados</option>
              <option value="VINCULADO">Vinculado</option>
              <option value="REGISTRADO">Registrado</option>
              <option value="PENDIENTE_VINCULACION">Pendiente de vinculación</option>
              <option value="POSIBLE_COINCIDENCIA">Posible coincidencia</option>
              <option value="REVISAR">Revisar</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Presencia en Reloj</label>
            <select
              value={filterPresence}
              onChange={(e) => setFilterPresence(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos (activos e histórico)</option>
              <option value="PRESENT">Presentes en última lectura</option>
              <option value="MISSING">Ya no aparecen en reloj</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Filtrar por PIN / Tarjeta</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterPin}
                onChange={(e) => setFilterPin(e.target.value)}
                placeholder="Ej. 1001, 4455..."
                className="w-full pl-8 pr-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Buscar por Nombre / DNI / DRAC</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Nombre en reloj, DNI o trabajador..."
                className="w-full pl-8 pr-3 py-2 bg-[#060709] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl overflow-hidden">
        {loadingStore ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
            <div>Cargando registro de usuarios de relojes biométricos...</div>
          </div>
        ) : deviceUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Cpu className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-bold text-white">Aún no se han obtenido usuarios reales de los relojes</div>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Presione <strong className="text-indigo-300">"OBTENER USUARIOS DEL RELOJ"</strong> para leer los usuarios reales registrados en sus equipos ZKTeco (vía TCP directo o BioTime PRO). El sistema nunca genera usuarios ficticios.
            </p>
            <div>
              <button
                type="button"
                onClick={handleQueryClockUsers}
                disabled={isQuerying}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isQuerying ? 'animate-spin' : ''}`} />
                <span>OBTENER USUARIOS DEL RELOJ</span>
              </button>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2.5 text-xs text-slate-400">
            <div className="font-semibold text-white">
              {viewTab === 'NEW'
                ? 'No hay usuarios nuevos sin gestionar en la última consulta'
                : viewTab === 'PENDING'
                ? 'No hay usuarios pendientes de vinculación o registro'
                : 'Aún no hay usuarios vinculados ni registrados desde relojes'}
            </div>
            <p className="text-slate-500 max-w-md mx-auto">
              {viewTab === 'NEW'
                ? 'Si quedaron usuarios pendientes de consultas anteriores, puede gestionarlos en la pestaña B (Pendientes de Vinculación o Registro).'
                : 'Verifique los filtros aplicados o cambie de pestaña.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {(filterDeviceSn !== 'ALL' || filterStatus !== 'ALL' || filterPresence !== 'ALL' || filterPin || filterName) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterDeviceSn('ALL');
                    setFilterStatus('ALL');
                    setFilterPresence('ALL');
                    setFilterPin('');
                    setFilterName('');
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                >
                  Limpiar filtros
                </button>
              )}
              {viewTab === 'NEW' && viewPools.pendingPool.length > 0 && (
                <button
                  type="button"
                  onClick={() => setViewTab('PENDING')}
                  className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold"
                >
                  Ir a Pendientes ({viewPools.pendingPool.length})
                </button>
              )}
            </div>
          </div>
        ) : viewTab === 'LINKED' ? (
          <>
            {/* VIEW C: USUARIOS VINCULADOS / REGISTRADOS */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead className="bg-[#060709] border-b border-slate-800 text-[11px] text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-3 whitespace-nowrap">N.º</th>
                    <th className="py-3 px-3 whitespace-nowrap">PIN</th>
                    <th className="py-3 px-3">Nombre registrado en el reloj</th>
                    <th className="py-3 px-3">Trabajador institucional</th>
                    <th className="py-3 px-3 whitespace-nowrap">DNI</th>
                    <th className="py-3 px-3 whitespace-nowrap">Código DRAC</th>
                    <th className="py-3 px-3">Dependencia</th>
                    <th className="py-3 px-3">Dispositivo</th>
                    <th className="py-3 px-3 whitespace-nowrap">Estado</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedUsers.map((u, idx) => {
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                    const statusMeta = LINK_STATUS_META[u.link_status] || LINK_STATUS_META.VINCULADO;
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/45 transition-colors align-top">
                        <td className="py-3 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">{rowNum}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-indigo-300 text-sm tabular-nums">{u.pin}</div>
                          {u.uid !== undefined && u.uid !== null && (
                            <div className="text-[10px] font-mono text-slate-500 tabular-nums">UID {u.uid}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 min-w-[170px]">
                          <div className="font-semibold text-white">
                            {u.clock_name || <span className="italic text-slate-500">Sin nombre en reloj</span>}
                          </div>
                          {u.privilege_label && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{u.privilege_label}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 min-w-[190px]">
                          <div className="font-semibold text-slate-100">{u.employee_full_name || '—'}</div>
                          {(u.employee_area_name || u.employee_cargo_name) && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {[u.employee_cargo_name, u.employee_area_name].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-200 tabular-nums whitespace-nowrap">
                          {u.employee_dni || '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-300 font-semibold tabular-nums whitespace-nowrap">
                          {u.employee_codigo_drac || '—'}
                        </td>
                        <td className="py-3 px-3 min-w-[160px] text-slate-300">
                          {u.employee_dependencia_name || '—'}
                        </td>
                        <td className="py-3 px-3 min-w-[160px]">
                          <div className="text-slate-200 font-medium">{u.device_name || u.device_sn}</div>
                          <div className="text-[10px] font-mono text-slate-500">{u.device_sn}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            title={statusMeta.desc}
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {canLinkUsers && (
                              <button
                                type="button"
                                onClick={() => openManageModal(u, 'CHOICE')}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>GESTIONAR USUARIO</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setHistoryUser(u)}
                              title="Historial de cambios"
                              className="p-1.5 bg-[#060709] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailUser(u)}
                              title="Ver datos reales recuperados"
                              className="p-1.5 bg-[#060709] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canEditClockName && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClockNameUser(u);
                                  setClockNameInput(u.clock_name || '');
                                  setClockNameError(null);
                                }}
                                title="Editar nombre directamente en el reloj físico (Solo Admin)"
                                className="p-1.5 bg-[#060709] hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-lg"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              currentPage={currentPage}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <>
            {/* VIEW A (NEW) & VIEW B (PENDING) */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-left text-xs">
                <thead className="bg-[#060709] border-b border-slate-800 text-[11px] text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-3.5 whitespace-nowrap">N.º</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">PIN / Código biométrico</th>
                    <th className="py-3 px-3.5">Nombre registrado en el reloj</th>
                    <th className="py-3 px-3.5">Dispositivo de origen</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Estado de vinculación</th>
                    <th className="py-3 px-3.5">Trabajador institucional</th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedUsers.map((u, idx) => {
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                    const statusMeta = LINK_STATUS_META[u.link_status] || LINK_STATUS_META.PENDIENTE_VINCULACION;
                    const scopeMeta = formatScopeLabel(u.source_scope, u.source_method);
                    const pendingPunches = pendingPunchesCountForUser(u.device_sn, u.pin);

                    return (
                      <tr key={u.id} className="hover:bg-slate-900/45 transition-colors align-top">
                        <td className="py-3 px-3.5 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                          {rowNum}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-indigo-300 text-sm tabular-nums">{u.pin}</div>
                          {u.uid !== undefined && u.uid !== null && (
                            <div className="text-[10px] font-mono text-slate-500 tabular-nums">UID {u.uid}</div>
                          )}
                        </td>

                        <td className="py-3 px-3.5 min-w-[210px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">
                              {u.clock_name ? u.clock_name : <span className="italic text-slate-500">Sin nombre en reloj</span>}
                            </span>
                            {latestNewUserIdSet.has(u.id) && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/70 text-[10px] font-semibold">
                                Nuevo
                              </span>
                            )}
                            {u.present_on_device === false && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/70 text-[10px] font-semibold">
                                Ausente en reloj
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] font-mono">
                            {u.clock_employee_code && u.clock_employee_code !== u.pin && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                Cód.Reloj: {u.clock_employee_code}
                              </span>
                            )}
                            {u.card_number && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                Tarjeta: {u.card_number}
                              </span>
                            )}
                            {u.privilege_label && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                {u.privilege_label}
                              </span>
                            )}
                            {u.clock_status && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                Reloj: {u.clock_status}
                              </span>
                            )}
                            {pendingPunches > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 tabular-nums">
                                {pendingPunches} marc. pendientes
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 min-w-[180px]">
                          <div className="font-medium text-slate-200">{u.device_name || u.device_sn}</div>
                          <div className="text-[10px] font-mono text-slate-400">{u.device_sn}</div>
                          <div className="mt-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] ${scopeMeta.className}`}>
                              {scopeMeta.text}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            title={statusMeta.desc}
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                          <div className="text-[10px] font-mono text-slate-500 mt-1 tabular-nums">
                            {formatDateTime(u.last_queried_at)}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 min-w-[220px]">
                          {u.candidate_employee_name ? (
                            <div>
                              <div className="text-sky-300 font-medium">Posible: {u.candidate_employee_name}</div>
                              <div className="text-[10px] text-slate-400">
                                DNI {u.candidate_employee_dni} · {u.candidate_reason}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">Sin trabajador vinculado</span>
                          )}
                          {u.conflict_reason && (
                            <div className="text-[10px] text-rose-300 mt-1">{u.conflict_reason}</div>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {canLinkUsers && (
                              <button
                                type="button"
                                onClick={() => openManageModal(u, 'CHOICE')}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>GESTIONAR USUARIO</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setHistoryUser(u)}
                              title="Historial de cambios"
                              className="p-1.5 bg-[#060709] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDetailUser(u)}
                              title="Ver datos reales recuperados"
                              className="p-1.5 bg-[#060709] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canEditClockName && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClockNameUser(u);
                                  setClockNameInput(u.clock_name || '');
                                  setClockNameError(null);
                                }}
                                title="Editar nombre directamente en el reloj físico (Solo Admin)"
                                className="p-1.5 bg-[#060709] hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-lg"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              currentPage={currentPage}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {/* MODAL UNIFICADO: GESTIONAR USUARIO DEL RELOJ (OPCIÓN A vs OPCIÓN B) */}
      {manageUser && !showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D] shrink-0">
              <div className="flex items-center gap-2.5">
                {manageMode === 'LINK_EXISTING' && (
                  <button
                    type="button"
                    onClick={() => {
                      setManageMode('CHOICE');
                      setLinkModalError(null);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    title="Volver a opciones"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="p-2 bg-indigo-500/15 text-indigo-400 rounded-lg border border-indigo-500/30">
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {manageMode === 'CHOICE'
                      ? 'Gestionar Usuario del Reloj Biométrico'
                      : manageUser.employee_id
                      ? 'Reasignar / Editar Vinculación Institucional'
                      : 'Opción A: Vincular con Trabajador Existente'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    PIN <span className="font-mono font-bold text-indigo-300">{manageUser.pin}</span> ·{' '}
                    {manageUser.clock_name || 'Sin nombre en reloj'} · {manageUser.device_name} ({manageUser.device_sn})
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setManageUser(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {manageMode === 'CHOICE' ? (
              <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
                {linkModalError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{linkModalError}</span>
                  </div>
                )}

                {/* Clock User Summary Card */}
                <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      Datos Obtenidos del Reloj (Origen Inmutable)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                        (LINK_STATUS_META[manageUser.link_status] || LINK_STATUS_META.PENDIENTE_VINCULACION).badgeClass
                      }`}
                    >
                      {(LINK_STATUS_META[manageUser.link_status] || LINK_STATUS_META.PENDIENTE_VINCULACION).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">PIN Biométrico</span>
                      <span className="font-mono font-bold text-indigo-300 text-sm tabular-nums">{manageUser.pin}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Nombre en el Reloj</span>
                      <span className="text-white font-semibold">{manageUser.clock_name || 'Sin nombre'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Dispositivo</span>
                      <span className="text-slate-200">{manageUser.device_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Número de Serie</span>
                      <span className="font-mono text-slate-300">{manageUser.device_sn}</span>
                    </div>
                  </div>
                  {manageUser.employee_id && (
                    <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Actualmente vinculado a: </span>
                        <strong className="text-emerald-300">{manageUser.employee_full_name}</strong>
                        <span className="text-slate-400 font-mono ml-2">
                          (DNI {manageUser.employee_dni} · {manageUser.employee_codigo_drac})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeLinkAction('UNLINK')}
                        disabled={isSavingLink}
                        className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-800 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Desvincular</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Two Distinct Action Alternatives */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setManageMode('LINK_EXISTING')}
                    className="text-left p-5 bg-[#090A0D] hover:bg-indigo-950/25 border border-slate-800 hover:border-indigo-500/60 rounded-xl transition-all space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        <Link2 className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Opción A
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        VINCULAR CON TRABAJADOR EXISTENTE
                      </h4>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        El colaborador ya figura en el Directorio Institucional DRAC. Busque por DNI, Código DRAC, apellidos, nombres o dependencia, compare los datos y confirme la asociación sin duplicar su ficha.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(true)}
                    className="text-left p-5 bg-[#090A0D] hover:bg-cyan-950/25 border border-slate-800 hover:border-cyan-500/60 rounded-xl transition-all space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        Opción B
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        REGISTRAR NUEVO TRABAJADOR
                      </h4>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        La persona aún no existe en el Directorio Institucional. Se abrirá el formulario oficial de Registro de Trabajador prellenado con este PIN y reloj, vinculándolo automáticamente como <strong className="text-cyan-300">Registrado</strong>.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* STEP: OPCIÓN A - VINCULAR CON TRABAJADOR EXISTENTE */}
                <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
                  {linkModalError && (
                    <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{linkModalError}</span>
                    </div>
                  )}

                  {/* Search institutional employees */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div className="md:col-span-2 relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={workerSearch}
                          onChange={(e) => setWorkerSearch(e.target.value)}
                          placeholder="Buscar por DNI, Código DRAC, apellido paterno, materno, nombres o dependencia..."
                          className="w-full pl-8 pr-3 py-2 bg-[#090A0D] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <select
                        value={workerDepFilter}
                        onChange={(e) => setWorkerDepFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-[#090A0D] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">Todas las dependencias ({uniqueDependencies.length})</option>
                        {uniqueDependencies.map((dep) => (
                          <option key={dep} value={dep}>
                            {dep}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800/70 bg-[#090A0D]">
                      {modalFilteredEmployees.map((emp) => {
                        const isSelected = selectedEmpId === emp.id;
                        const isCandidate = manageUser.candidate_employee_id === emp.id;
                        const fullName = normalizePersonName(`${emp.first_name} ${emp.last_name}`);
                        const isActiveWorker = emp.active !== false;
                        return (
                          <button
                            type="button"
                            key={emp.id}
                            onClick={() => setSelectedEmpId(emp.id)}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                              isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-900 text-slate-200'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-semibold flex items-center gap-2 flex-wrap">
                                <span>{fullName}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                    isActiveWorker
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                                      : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                                  }`}
                                >
                                  {isActiveWorker ? 'Activo' : 'Inactivo'}
                                </span>
                                {isCandidate && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-700 text-[10px]">
                                    Coincidencia sugerida
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                DNI: {emp.dni} · Cód: {emp.codigo_trabajador}
                                {emp.zkteco_pin ? ` · PIN actual: ${emp.zkteco_pin}` : ''}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {[emp.dependencia_name, emp.area_name, getEmployeeCargoLabel(emp) !== '—' ? getEmployeeCargoLabel(emp) : '']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                          </button>
                        );
                      })}
                      {modalFilteredEmployees.length === 0 && (
                        <div className="p-4 text-center text-slate-500 space-y-2">
                          <div>No se encontraron trabajadores con los filtros indicados.</div>
                          <button
                            type="button"
                            onClick={() => setShowRegisterModal(true)}
                            className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>¿No existe en el directorio? Registrar Nuevo Trabajador</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Side-by-side comparison before confirmation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center justify-between">
                        <span>INFORMACIÓN OBTENIDA DEL RELOJ</span>
                        <span className="font-mono text-[10px] text-slate-400">{manageUser.device_sn}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-[10px] text-slate-500 block">PIN Biométrico</span>
                          <span className="font-mono font-bold text-indigo-300 text-sm tabular-nums">{manageUser.pin}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Dispositivo</span>
                          <span className="text-slate-200 font-medium">{manageUser.device_name}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Nombre Registrado</span>
                          <span className="text-white font-semibold">{manageUser.clock_name || 'Sin nombre registrado'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Número de Serie</span>
                          <span className="font-mono text-slate-300">{manageUser.device_sn}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        INFORMACIÓN DEL DIRECTORIO INSTITUCIONAL
                      </div>
                      {selectedModalEmployee ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <span className="text-[10px] text-slate-500 block">DNI</span>
                            <span className="font-mono font-bold text-white tabular-nums">{selectedModalEmployee.dni}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Código DRAC</span>
                            <span className="font-mono font-bold text-emerald-300 tabular-nums">
                              {selectedModalEmployee.codigo_trabajador}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-500 block">Nombres y Apellidos</span>
                            <span className="text-white font-semibold">
                              {normalizePersonName(`${selectedModalEmployee.first_name} ${selectedModalEmployee.last_name}`)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Dependencia</span>
                            <span className="text-slate-300">{selectedModalEmployee.dependencia_name || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Área</span>
                            <span className="text-slate-300">{selectedModalEmployee.area_name || '—'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-500 block">Cargo</span>
                            <span className="text-slate-300">{getEmployeeCargoLabel(selectedModalEmployee)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500">
                          Seleccione un trabajador en la lista superior para comparar sus datos antes de confirmar.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Worker PIN Conflict Warning + Confirmation Checkbox */}
                  {selectedEmployeePinConflict && (
                    <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-700/70 space-y-2 text-amber-100">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-amber-200">
                            Advertencia de cambio de PIN biométrico asignado
                          </div>
                          <p className="text-[11px] text-amber-200/90 mt-0.5">
                            {selectedEmployeePinConflict.reason} Si confirma, se actualizará la asociación del trabajador con el PIN <strong className="font-mono">{manageUser.pin}</strong> en {manageUser.device_sn}.
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white pt-1">
                        <input
                          type="checkbox"
                          checked={confirmPinChange}
                          onChange={(e) => setConfirmPinChange(e.target.checked)}
                          className="rounded border-amber-600 bg-slate-900 text-amber-500"
                        />
                        <span>
                          Confirmo reemplazar el PIN anterior ({selectedEmployeePinConflict.existingPin}) por el PIN {manageUser.pin}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Options & Observations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={savePinToWorker}
                          onChange={(e) => setSavePinToWorker(e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-900 text-indigo-500"
                        />
                        <span>Guardar PIN biométrico ({manageUser.pin}) en la ficha del trabajador institucional</span>
                      </label>
                      <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyRetroactivePunches}
                          onChange={(e) => setApplyRetroactivePunches(e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-900 text-indigo-500"
                        />
                        <span>
                          Aplicar automáticamente a marcaciones históricas de este dispositivo ({manageUser.device_sn}) y PIN ({manageUser.pin}) sin alterar fechas/horas
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Observaciones Administrativas</label>
                      <textarea
                        rows={2}
                        value={linkObservation}
                        onChange={(e) => setLinkObservation(e.target.value)}
                        placeholder="Motivo de vinculación, corrección o aclaración..."
                        className="w-full px-3 py-2 bg-[#090A0D] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-slate-800 bg-[#090A0D] flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {manageUser.employee_id && (
                      <button
                        type="button"
                        onClick={() => executeLinkAction('UNLINK')}
                        disabled={isSavingLink}
                        className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-800 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Desvincular</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => executeLinkAction('UPDATE_OBSERVATION')}
                      disabled={isSavingLink}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Guardar Observación</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManageUser(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => executeLinkAction(manageUser.employee_id ? 'RELINK' : 'LINK')}
                      disabled={
                        isSavingLink ||
                        !selectedEmpId ||
                        Boolean(selectedEmployeePinConflict && !confirmPinChange)
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        {isSavingLink
                          ? 'Guardando...'
                          : manageUser.employee_id
                          ? 'CONFIRMAR CAMBIO DE VINCULACIÓN'
                          : 'CONFIRMAR VINCULACIÓN'}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* OPCIÓN B: FORMULARIO OFICIAL DE REGISTRO DE TRABAJADOR REUTILIZADO */}
      {manageUser && showRegisterModal && (
        <EmployeeFormModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          dependencias={dependencias}
          direccionesOrganos={direccionesOrganos}
          areas={areas}
          cargos={cargos}
          horarios={horarios}
          responsables={responsables}
          employees={employees}
          activeRole={activeRole}
          biometricPrefill={{ deviceUser: manageUser }}
          onSaveNewEmployee={handleRegisterNewEmployeeAndLink}
          onSwitchToLinkExisting={(existingEmp) => {
            setShowRegisterModal(false);
            setManageMode('LINK_EXISTING');
            setSelectedEmpId(existingEmp.id);
            setWorkerSearch(existingEmp.dni || '');
            setLinkModalError(null);
          }}
        />
      )}

      {/* MODAL: HISTORIAL DE CAMBIOS DEL USUARIO */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Historial de Cambios — PIN {historyUser.pin} ({historyUser.device_sn})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Trazabilidad de lecturas en reloj, vinculaciones, registros nuevos y observaciones.
                </p>
              </div>
              <button type="button" onClick={() => setHistoryUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2.5 text-xs">
              {userHistoryForModal.length === 0 ? (
                <div className="py-8 text-center text-slate-500">No hay eventos registrados todavía para este usuario.</div>
              ) : (
                userHistoryForModal.map((log) => (
                  <div key={log.id} className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono text-[10px] font-bold">
                        {log.event_type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <div className="text-slate-200">{log.observation || 'Sin observación'}</div>
                    <div className="text-[10px] text-slate-500">
                      Operador: {log.operator_name} ({log.operator_role})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE REAL DE ATRIBUTOS DEL DISPOSITIVO */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Detalle Real Recuperado — PIN {detailUser.pin}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Campos disponibles reportados por {detailUser.device_name} ({detailUser.source_method})
                </p>
              </div>
              <button type="button" onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#090A0D] border border-slate-800 rounded-lg">
                <div>
                  <span className="text-[10px] text-slate-500 block">PIN / User ID</span>
                  <span className="font-mono font-bold text-white">{detailUser.pin}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Nombre en Reloj</span>
                  <span className="text-white">{detailUser.clock_name || 'No proporcionado por el reloj'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">UID Interno</span>
                  <span className="font-mono text-slate-200">{detailUser.uid ?? 'No proporcionado'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Privilegio</span>
                  <span className="text-slate-200">{detailUser.privilege_label || 'No proporcionado'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Número de Tarjeta</span>
                  <span className="font-mono text-slate-200">{detailUser.card_number || 'No proporcionado'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Estado en Dispositivo</span>
                  <span className="text-slate-200">{detailUser.clock_status || 'No proporcionado por modelo/protocolo'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Primera Detección</span>
                  <span className="font-mono text-slate-300">{formatDateTime(detailUser.first_seen_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Última Consulta</span>
                  <span className="font-mono text-slate-300">{formatDateTime(detailUser.last_queried_at)}</span>
                </div>
              </div>

              <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300">Capacidades / Campos Detectados</div>
                <div className="flex flex-wrap gap-1.5">
                  {(detailUser.available_fields || []).map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-indigo-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {detailUser.raw_attributes && Object.keys(detailUser.raw_attributes).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">Atributos Crudos del Protocolo</div>
                  <pre className="p-3 bg-[#060709] border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(detailUser.raw_attributes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDICIÓN OPCIONAL E INDEPENDIENTE DEL NOMBRE EN EL RELOJ FÍSICO (SOLO ADMIN) */}
      {clockNameUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D] shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Actualizar Nombre en Reloj Físico</h3>
              </div>
              <button type="button" onClick={() => setClockNameUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs overflow-y-auto flex-1">
              <div className="p-3 bg-amber-950/35 border border-amber-800/60 rounded-lg text-amber-200 leading-relaxed">
                Operación independiente y exclusiva de administrador: envía el nombre al reloj ZKTeco ({clockNameUser.device_sn}) para el PIN <strong className="font-mono">{clockNameUser.pin}</strong>. <strong>No modifica el nombre del trabajador en el padrón institucional.</strong>
              </div>
              {clockNameError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 rounded text-rose-200">
                  {clockNameError}
                </div>
              )}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nombre actual en reloj</label>
                <div className="px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded text-slate-300">
                  {clockNameUser.clock_name || 'Sin nombre'}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Nuevo nombre en pantalla del reloj (máx. 24 caracteres)</label>
                <input
                  type="text"
                  maxLength={24}
                  value={clockNameInput}
                  onChange={(e) => setClockNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#090A0D] border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#090A0D] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setClockNameUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveClockName}
                disabled={isSavingClockName}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                {isSavingClockName ? 'Enviando al reloj...' : 'Enviar al Reloj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE CONSULTAS REALIZADAS */}
      {showSyncRunsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div>
                <h3 className="text-sm font-bold text-white">Bitácora de Consultas a Relojes Biométricos</h3>
                <p className="text-[11px] text-slate-400">Resumen incremental por dispositivo ejecutado.</p>
              </div>
              <button type="button" onClick={() => setShowSyncRunsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2.5 text-xs">
              {syncRuns.length === 0 ? (
                <div className="py-8 text-center text-slate-500">No se han ejecutado consultas todavía.</div>
              ) : (
                syncRuns.map((run) => (
                  <div key={run.id} className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                            run.success
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                              : 'bg-rose-950/70 text-rose-300 border-rose-700'
                          }`}
                        >
                          {run.success ? 'EXITOSA' : 'FALLIDA'}
                        </span>
                        <span className="font-bold text-white">{run.device_name}</span>
                        <span className="font-mono text-[11px] text-slate-400">{run.device_sn}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {formatDateTime(run.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-300">{run.message}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] font-mono tabular-nums text-slate-400">
                      <span>Método: {run.method}</span>
                      <span>Alcance: {run.source_scope}</span>
                      <span>Leídos: {run.total_fetched}</span>
                      <span>Nuevos: {run.new_users}</span>
                      <span>Actualizados: {run.updated_users}</span>
                      <span>Ausentes: {run.missing_users}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
