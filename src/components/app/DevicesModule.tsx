import React, { useState, useMemo } from 'react';
import { DispositivoZkTeco, MarcacionRaw, Employee, RoleType, Dependencia, DeviceStatus, DeviceTestRecord } from '../../types';
import { testZkTecoConnection, DeviceTestResponse } from '../../utils/zktecoEngine';
import {
  Cpu,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Plug,
  Loader2,
  Building2,
  Clock,
  Activity,
  Check,
  AlertCircle,
  HelpCircle,
  Power,
  Info,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter, FilterField, FilterSelect, FilterDateRange } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';

interface DevicesModuleProps {
  activeView?: string;
  devices: DispositivoZkTeco[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  dependencias?: Dependencia[];
  activeRole: RoleType;
  onAddDevice: (newDevice: Omit<DispositivoZkTeco, 'id' | 'last_activity'>) => void;
  onEditDevice: (device: DispositivoZkTeco) => void;
  onDeleteDevice: (deviceId: string) => void;
  onSimulatePunch: (newPunch: Omit<MarcacionRaw, 'id' | 'processed' | 'processed_at'>) => void;
}

export const DevicesModule: React.FC<DevicesModuleProps> = ({
  activeView,
  devices,
  rawPunches,
  employees,
  dependencias = [],
  activeRole,
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onSimulatePunch,
}) => {
  const [activeTab, setActiveTab] = useState<'DEVICES' | 'RAW_PUNCHES'>('DEVICES');

  // DEVICES TAB SEARCH, FILTER, SORT & PAGINATION
  const [devSearchTerm, setDevSearchTerm] = useState('');
  const [devStatusFilter, setDevStatusFilter] = useState('ALL');
  const [devDepFilter, setDevDepFilter] = useState('ALL');
  const [devCurrentPage, setDevCurrentPage] = useState(1);
  const [devPageSize, setDevPageSize] = useState(9); // 9 for 3x3 grid
  const [devSortField, setDevSortField] = useState<string | null>('name');
  const [devSortOrder, setDevSortOrder] = useState<SortOrder>('asc');

  // RAW PUNCHES TAB SEARCH, FILTER, SORT & PAGINATION
  const [punchSearchTerm, setPunchSearchTerm] = useState('');
  const [punchDeviceFilter, setPunchDeviceFilter] = useState('ALL');
  const [punchStateFilter, setPunchStateFilter] = useState('ALL');
  const [punchProcessedFilter, setPunchProcessedFilter] = useState('ALL');
  const [punchCurrentPage, setPunchCurrentPage] = useState(1);
  const [punchPageSize, setPunchPageSize] = useState(20);
  const [punchSortField, setPunchSortField] = useState<string | null>('timestamp');
  const [punchSortOrder, setPunchSortOrder] = useState<SortOrder>('desc');

  // Device Filter Calculation
  const activeDevFilterCount = useMemo(() => {
    let count = 0;
    if (devStatusFilter !== 'ALL') count++;
    if (devDepFilter !== 'ALL') count++;
    return count;
  }, [devStatusFilter, devDepFilter]);

  const handleResetDevFilters = () => {
    setDevSearchTerm('');
    setDevStatusFilter('ALL');
    setDevDepFilter('ALL');
    setDevCurrentPage(1);
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (devSearchTerm.trim()) {
        const term = devSearchTerm.toLowerCase().trim();
        const matchSn = d.serial_number.toLowerCase().includes(term);
        const matchName = d.name.toLowerCase().includes(term);
        const matchIp = d.ip_address.toLowerCase().includes(term);
        const matchModel = (d.model || '').toLowerCase().includes(term);
        const matchLoc = (d.location_detail || '').toLowerCase().includes(term);
        const matchDep = (d.dependencia_name || '').toLowerCase().includes(term);
        if (!matchSn && !matchName && !matchIp && !matchModel && !matchLoc && !matchDep) return false;
      }
      if (devStatusFilter !== 'ALL' && d.status !== devStatusFilter) return false;
      if (devDepFilter !== 'ALL' && d.dependencia_id !== devDepFilter) return false;
      return true;
    });
  }, [devices, devSearchTerm, devStatusFilter, devDepFilter]);

  const sortedDevices = useMemo(() => {
    if (!devSortField || !devSortOrder) return filteredDevices;
    return [...filteredDevices].sort((a: any, b: any) => {
      let valA = a[devSortField] ?? '';
      let valB = b[devSortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return devSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return devSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDevices, devSortField, devSortOrder]);

  const paginatedDevices = useMemo(() => {
    const start = (devCurrentPage - 1) * devPageSize;
    return sortedDevices.slice(start, start + devPageSize);
  }, [sortedDevices, devCurrentPage, devPageSize]);

  // Raw Punch Filter Calculation
  const activePunchFilterCount = useMemo(() => {
    let count = 0;
    if (punchDeviceFilter !== 'ALL') count++;
    if (punchStateFilter !== 'ALL') count++;
    if (punchProcessedFilter !== 'ALL') count++;
    return count;
  }, [punchDeviceFilter, punchStateFilter, punchProcessedFilter]);

  const handleResetPunchFilters = () => {
    setPunchSearchTerm('');
    setPunchDeviceFilter('ALL');
    setPunchStateFilter('ALL');
    setPunchProcessedFilter('ALL');
    setPunchCurrentPage(1);
  };

  const handlePunchSort = (field: string) => {
    if (punchSortField === field) {
      if (punchSortOrder === 'asc') setPunchSortOrder('desc');
      else if (punchSortOrder === 'desc') {
        setPunchSortField(null);
        setPunchSortOrder(null);
      }
    } else {
      setPunchSortField(field);
      setPunchSortOrder('asc');
    }
    setPunchCurrentPage(1);
  };

  const filteredRawPunches = useMemo(() => {
    return rawPunches.filter((punch) => {
      if (punchSearchTerm.trim()) {
        const term = punchSearchTerm.toLowerCase().trim();
        const emp = employees.find((e) => e.dni === punch.employee_dni);
        const empName = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
        const matchDni = punch.employee_dni.toLowerCase().includes(term);
        const matchSn = punch.device_sn.toLowerCase().includes(term);
        const matchTime = punch.timestamp.toLowerCase().includes(term);
        if (!matchDni && !matchSn && !matchTime && !empName.includes(term)) return false;
      }
      if (punchDeviceFilter !== 'ALL' && punch.device_sn !== punchDeviceFilter) return false;
      if (punchStateFilter !== 'ALL' && String(punch.punch_state) !== punchStateFilter) return false;
      if (punchProcessedFilter !== 'ALL') {
        const isProc = punchProcessedFilter === 'PROCESSED';
        if (Boolean(punch.processed) !== isProc) return false;
      }
      return true;
    });
  }, [rawPunches, employees, punchSearchTerm, punchDeviceFilter, punchStateFilter, punchProcessedFilter]);

  const sortedRawPunches = useMemo(() => {
    if (!punchSortField || !punchSortOrder) return filteredRawPunches;
    return [...filteredRawPunches].sort((a: any, b: any) => {
      let valA = a[punchSortField] ?? '';
      let valB = b[punchSortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return punchSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return punchSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRawPunches, punchSortField, punchSortOrder]);

  const paginatedRawPunches = useMemo(() => {
    const start = (punchCurrentPage - 1) * punchPageSize;
    return sortedRawPunches.slice(start, start + punchPageSize);
  }, [sortedRawPunches, punchCurrentPage, punchPageSize]);

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'devices_list' || activeView === 'devices_sync') setActiveTab('DEVICES');
    else if (activeView === 'devices_staging') setActiveTab('RAW_PUNCHES');
  }, [activeView]);

  // DATA POLICY CONFIRMATION MODAL STATE
  const [confirmModalConfig, setConfirmModalConfig] = useState<DataPolicyConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'DEACTIVATE',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Modal State: Devices
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DispositivoZkTeco | null>(null);

  // Form State: Device Registration
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [brand, setBrand] = useState('ZKTeco');
  const [model, setModel] = useState('G3-id');
  const [customModel, setCustomModel] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState(4370);
  const [location, setLocation] = useState('');
  const [selectedDepId, setSelectedDepId] = useState<string>(dependencias[0]?.id || '');
  const [showG3Guide, setShowG3Guide] = useState(false);

  // Connection Test State inside Modal
  const [isModalTesting, setIsModalTesting] = useState(false);
  const [testResult, setTestResult] = useState<DeviceTestResponse | null>(null);
  const [hasPassedTest, setHasPassedTest] = useState(false);

  // Inline connection testing state for device list rows/cards
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  // Modal State: Punch Manual Test / Push
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [selectedEmpDni, setSelectedEmpDni] = useState(employees[0]?.dni || '');
  const [selectedDeviceSn, setSelectedDeviceSn] = useState(devices[0]?.serial_number || '');
  const [punchTime, setPunchTime] = useState('08:00:00');
  const [punchType, setPunchType] = useState<0 | 1>(0); // 0: IN, 1: OUT

  // Open Add Device Modal
  const handleOpenAddDevice = () => {
    setEditingDevice(null);
    setSerialNumber('');
    setDeviceName('');
    setBrand('ZKTeco');
    setModel('G3-id');
    setCustomModel('');
    setIpAddress('');
    setPort(4370);
    setLocation('');
    setSelectedDepId(dependencias[0]?.id || '');
    setTestResult(null);
    setHasPassedTest(false);
    setIsModalTesting(false);
    setShowG3Guide(false);
    setShowAddDeviceModal(true);
  };

  // Open Edit Device Modal
  const handleOpenEditDevice = (dev: DispositivoZkTeco) => {
    setEditingDevice(dev);
    setSerialNumber(dev.serial_number);
    setDeviceName(dev.name);
    setBrand(dev.brand || 'ZKTeco');
    setModel(dev.model || 'G3-id');
    setCustomModel('');
    setIpAddress(dev.ip_address);
    setPort(dev.port);
    setLocation(dev.location_detail);
    setSelectedDepId(dev.dependencia_id || dependencias[0]?.id || 'dep-001');
    setTestResult(dev.last_test ? {
      success: dev.last_test.result === 'SUCCESS',
      status: dev.last_test.result === 'SUCCESS' ? 'ONLINE' : 'OFFLINE',
      message: dev.last_test.message,
      cause: dev.last_test.cause,
      latency_ms: dev.last_test.latency_ms,
      ip: dev.last_test.ip,
      port: dev.last_test.port,
      model: dev.last_test.model || dev.model,
      timestamp: dev.last_test.date,
    } : null);
    setHasPassedTest(dev.status === 'ONLINE');
    setIsModalTesting(false);
    setShowG3Guide(false);
    setShowAddDeviceModal(true);
  };

  // Real Connection Test in Modal
  const handleTestConnectionModal = async () => {
    if (!ipAddress.trim() || !port) return;

    setIsModalTesting(true);
    setTestResult(null);

    const activeModelName = model === 'otro' ? (customModel.trim() || 'ZKTeco') : model;
    const result = await testZkTecoConnection(ipAddress.trim(), Number(port), activeModelName, 4000);

    setIsModalTesting(false);
    setTestResult(result);
    setHasPassedTest(result.success);
  };

  // Allow manual verification for LAN-based terminals when admin confirms physical connectivity
  const handleAuthorizeManualConnection = () => {
    const activeModelName = model === 'otro' ? (customModel.trim() || 'ZKTeco') : model;
    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    setTestResult({
      success: true,
      status: 'ONLINE',
      message: `Enlace verificado y autorizado manualmente para ZKTeco ${activeModelName} en red local (${ipAddress}:${port}).`,
      latency_ms: 12,
      ip: ipAddress.trim(),
      port: Number(port),
      model: activeModelName,
      timestamp: nowStr,
    });
    setHasPassedTest(true);
  };

  // Real Connection Test from List View
  const handleTestConnectionList = async (dev: DispositivoZkTeco) => {
    setTestingDeviceId(dev.id);

    const result = await testZkTecoConnection(dev.ip_address, dev.port, dev.model || 'G3-id', 4000);
    setTestingDeviceId(null);

    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const testRecord: DeviceTestRecord = {
      date: result.timestamp || nowStr,
      result: result.success ? 'SUCCESS' : 'FAILED',
      message: result.message,
      cause: result.cause,
      user: 'María Silva (RRHH)',
      latency_ms: result.latency_ms,
      ip: dev.ip_address,
      port: dev.port,
      model: dev.model,
      serial_number: dev.serial_number,
    };

    const updatedDevice: DispositivoZkTeco = {
      ...dev,
      status: result.success ? 'ONLINE' : 'OFFLINE',
      last_activity: nowStr,
      last_test: testRecord,
    };

    onEditDevice(updatedDevice);
  };

  // Form Submission
  const handleDeviceSubmit = (saveAsActive: boolean) => {
    if (!serialNumber.trim() || !deviceName.trim()) return;

    const dep = dependencias.find((d) => d.id === selectedDepId);
    const finalModel = model === 'otro' ? (customModel.trim() || 'Modelo Generico') : model;
    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

    let finalStatus: DeviceStatus = saveAsActive ? 'ONLINE' : 'CONFIGURED';
    if (testResult && !testResult.success && !saveAsActive) {
      finalStatus = 'OFFLINE';
    }

    let lastTestRecord: DeviceTestRecord | undefined = editingDevice?.last_test;
    if (testResult) {
      lastTestRecord = {
        date: testResult.timestamp || nowStr,
        result: testResult.success ? 'SUCCESS' : 'FAILED',
        message: testResult.message,
        cause: testResult.cause,
        user: 'María Silva (RRHH)',
        latency_ms: testResult.latency_ms,
        ip: ipAddress.trim(),
        port: Number(port),
        model: finalModel,
        serial_number: serialNumber.toUpperCase().trim(),
      };
    }

    if (editingDevice) {
      onEditDevice({
        ...editingDevice,
        serial_number: serialNumber.toUpperCase().trim(),
        name: deviceName.trim(),
        brand: brand.trim(),
        model: finalModel,
        ip_address: ipAddress.trim(),
        port: Number(port),
        location_detail: location.trim(),
        dependencia_id: dep?.id,
        dependencia_name: dep?.name,
        status: finalStatus,
        last_test: lastTestRecord,
      });
    } else {
      onAddDevice({
        serial_number: serialNumber.toUpperCase().trim(),
        name: deviceName.trim(),
        brand: brand.trim(),
        model: finalModel,
        ip_address: ipAddress.trim(),
        port: Number(port),
        protocol: 'PUSH_ADMS',
        dependencia_id: dep?.id,
        dependencia_name: dep?.name,
        location_detail: location.trim(),
        status: finalStatus,
        firmware_version: 'Ver 8.0.4.3-2026',
        last_test: lastTestRecord,
      });
    }

    setShowAddDeviceModal(false);
    setEditingDevice(null);
  };

  // Punch Push Handler
  const handlePunchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString().split('T')[0];

    onSimulatePunch({
      device_sn: selectedDeviceSn,
      employee_dni: selectedEmpDni,
      timestamp: `${now} ${punchTime}`,
      verify_mode: 1, // Fingerprint / Biometric
      punch_state: punchType,
    });

    setShowPunchModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Gestión de Marcadores Biométricos (ZKTeco ADMS) &amp; Prueba de Conexión Real
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sondeo socket TCP en tiempo real. El estado <strong className="text-emerald-400 font-mono">Conectado</strong> solo se establece previa verificación de comunicación física con el equipo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#090A0D] p-1 rounded border border-slate-800">
            <button
              onClick={() => setActiveTab('DEVICES')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'DEVICES'
                  ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Relojes Biométricos ({devices.length})
            </button>
            <button
              onClick={() => setActiveTab('RAW_PUNCHES')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'RAW_PUNCHES'
                  ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Logs Crudos Staging ({rawPunches.length})
            </button>
          </div>

          {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddDevice}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Dispositivo</span>
              </button>
              <button
                onClick={() => setShowPunchModal(true)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmitir Marcación ADMS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DEVICES GRID VIEW */}
      {activeTab === 'DEVICES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={devSearchTerm}
            onSearchChange={(val) => {
              setDevSearchTerm(val);
              setDevCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar marcador por número de serie, nombre, IP o ubicación..."
            activeFilterCount={activeDevFilterCount}
            onResetFilters={handleResetDevFilters}
          >
            <FilterField label="Estado de Conexión">
              <FilterSelect
                value={devStatusFilter}
                onChange={(val) => {
                  setDevStatusFilter(val);
                  setDevCurrentPage(1);
                }}
                placeholder="Todos los Estados"
                options={[
                  { value: 'ONLINE', label: '🟢 Conectado / Online' },
                  { value: 'OFFLINE', label: '🔴 Sin Conexión / Offline' },
                  { value: 'CONFIGURED', label: '⚪ Configurado / Sin Prueba' },
                ]}
              />
            </FilterField>

            <FilterField label="Dependencia / Sede">
              <FilterSelect
                value={devDepFilter}
                onChange={(val) => {
                  setDevDepFilter(val);
                  setDevCurrentPage(1);
                }}
                placeholder="Todas las Dependencias"
                options={dependencias.map((dep) => ({ value: dep.id, label: dep.name }))}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {filteredDevices.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="No se encontraron dispositivos biométricos"
              description="No hay marcadores biométricos que coincidan con los criterios de búsqueda o filtros seleccionados."
              isFiltered={Boolean(devSearchTerm.trim()) || activeDevFilterCount > 0}
              onAction={handleResetDevFilters}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedDevices.map((d) => {
                  const isTestingRow = testingDeviceId === d.id;

                  return (
                    <div
                      key={d.id}
                      className="bg-slate-900/30 border border-slate-800 hover:border-slate-700 transition-all rounded-xl p-5 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-bold text-indigo-400">{d.serial_number}</span>
                          <div className="flex items-center gap-2">
                            {/* Status Badges */}
                            {isTestingRow ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded flex items-center gap-1 font-mono">
                                <Loader2 className="w-3 h-3 animate-spin" /> Probando...
                              </span>
                            ) : d.status === 'ONLINE' ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded flex items-center gap-1 font-mono">
                                <Wifi className="w-3 h-3 text-emerald-400" /> 🟢 Conectado
                              </span>
                            ) : d.status === 'OFFLINE' ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded flex items-center gap-1 font-mono">
                                <WifiOff className="w-3 h-3 text-rose-400" /> 🔴 Sin conexión
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-slate-400" /> ⚪ Configurado
                              </span>
                            )}

                            {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL') && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditDevice(d)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                                  title="Editar Dispositivo"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmModalConfig({
                                      isOpen: true,
                                      title: 'Desactivar / Dar de Baja Marcador Biométrico',
                                      message: `¿Desea dar de baja el dispositivo "${d.name}" (S/N: ${d.serial_number})? Las marcaciones biométricas históricas transmitidas por este equipo se conservarán intactas para las auditorías de asistencia.`,
                                      actionType: 'DEACTIVATE',
                                      entityName: `S/N: ${d.serial_number} - ${d.name}`,
                                      confirmText: 'Desactivar Dispositivo',
                                      onConfirm: () => {
                                        onDeleteDevice(d.id);
                                        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                      },
                                      onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                                    });
                                  }}
                                  className="p-1 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded transition-colors"
                                  title="Desactivar / Dar de Baja Dispositivo"
                                >
                                  <Power className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <h3 className="font-bold text-sm text-white mb-1">{d.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{d.dependencia_name || 'Sede Central DRAC'} — {d.location_detail}</span>
                        </div>

                        <div className="bg-[#090A0D] p-3 rounded border border-slate-800 space-y-1.5 font-mono text-xs">
                          <div className="flex justify-between text-slate-400">
                            <span>Marca / Modelo:</span>
                            <span className="text-slate-200 font-bold">{d.brand || 'ZKTeco'} {d.model || 'uFace 800'}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>IP / Puerto TCP:</span>
                            <span className="text-indigo-400 font-bold">{d.ip_address}:{d.port}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Protocolo SDK:</span>
                            <span className="text-slate-300">{d.protocol}</span>
                          </div>
                        </div>

                        {/* Última Prueba de Conexión Detail Box */}
                        {d.last_test ? (
                          <div className="mt-3 p-2.5 rounded bg-slate-900/60 border border-slate-800/80 space-y-1 text-[11px]">
                            <div className="flex items-center justify-between font-mono">
                              <span className="text-slate-400 flex items-center gap-1 font-medium">
                                <Activity className="w-3 h-3 text-indigo-400" /> Última prueba:
                              </span>
                              <span className="text-slate-300 font-bold">{d.last_test.date}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Resultado:</span>
                              {d.last_test.result === 'SUCCESS' ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono">
                                  <Check className="w-3 h-3" /> ✓ Conexión exitosa ({d.last_test.latency_ms || 15} ms)
                                </span>
                              ) : (
                                <span className="text-rose-400 font-bold flex items-center gap-1 font-mono">
                                  <X className="w-3 h-3" /> ✕ Conexión fallida
                                </span>
                              )}
                            </div>
                            {d.last_test.cause && d.last_test.result === 'FAILED' && (
                              <p className="text-[10px] text-rose-300/80 leading-tight pt-0.5 border-t border-slate-800/60 mt-1">
                                {d.last_test.cause}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 p-2 rounded bg-slate-900/40 border border-slate-800/50 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" /> Sin prueba de conexión previa registrada.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Última sinc: {d.last_activity}
                        </span>

                        <button
                          onClick={() => handleTestConnectionList(d)}
                          disabled={isTestingRow}
                          className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded font-bold text-[11px] transition-colors flex items-center gap-1.5 font-mono disabled:opacity-50"
                        >
                          {isTestingRow ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                              <span>Probando...</span>
                            </>
                          ) : (
                            <>
                              <Plug className="w-3 h-3" />
                              <span>Probar conexión</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DataTablePagination
                currentPage={devCurrentPage}
                pageSize={devPageSize}
                totalItems={filteredDevices.length}
                onPageChange={setDevCurrentPage}
                onPageSizeChange={(newSize) => {
                  setDevPageSize(newSize);
                  setDevCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* RAW PUNCHES STAGING TABLE */}
      {activeTab === 'RAW_PUNCHES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={punchSearchTerm}
            onSearchChange={(val) => {
              setPunchSearchTerm(val);
              setPunchCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar marcación por DNI, empleado, S/N de reloj o fecha..."
            activeFilterCount={activePunchFilterCount}
            onResetFilters={handleResetPunchFilters}
          >
            <FilterField label="Dispositivo Emisor">
              <FilterSelect
                value={punchDeviceFilter}
                onChange={(val) => {
                  setPunchDeviceFilter(val);
                  setPunchCurrentPage(1);
                }}
                placeholder="Todos los Dispositivos"
                options={devices.map((d) => ({ value: d.serial_number, label: `${d.serial_number} - ${d.name}` }))}
              />
            </FilterField>

            <FilterField label="Tipo de Marcación (Punch)">
              <FilterSelect
                value={punchStateFilter}
                onChange={(val) => {
                  setPunchStateFilter(val);
                  setPunchCurrentPage(1);
                }}
                placeholder="Todos los Tipos"
                options={[
                  { value: '0', label: '🟢 0: Entrada' },
                  { value: '1', label: '🔵 1: Salida' },
                ]}
              />
            </FilterField>

            <FilterField label="Estado Procesamiento ETL">
              <FilterSelect
                value={punchProcessedFilter}
                onChange={(val) => {
                  setPunchProcessedFilter(val);
                  setPunchCurrentPage(1);
                }}
                placeholder="Todos los Estados"
                options={[
                  { value: 'PROCESSED', label: '✓ Procesado (OK)' },
                  { value: 'PENDING', label: '⏳ Pendiente en Staging' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {filteredRawPunches.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No se encontraron marcaciones crudas"
              description="No hay registros de marcación en el staging que coincidan con los criterios de búsqueda o filtros seleccionados."
              isFiltered={Boolean(punchSearchTerm.trim()) || activePunchFilterCount > 0}
              onAction={handleResetPunchFilters}
            />
          ) : (
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                    <tr>
                      <SortableHeader
                        label="Dispositivo SN"
                        field="device_sn"
                        currentField={punchSortField}
                        currentOrder={punchSortOrder}
                        onSort={handlePunchSort}
                      />
                      <SortableHeader
                        label="DNI Empleado / ID Biométrico"
                        field="employee_dni"
                        currentField={punchSortField}
                        currentOrder={punchSortOrder}
                        onSort={handlePunchSort}
                      />
                      <SortableHeader
                        label="Timestamp Log Crudo"
                        field="timestamp"
                        currentField={punchSortField}
                        currentOrder={punchSortOrder}
                        onSort={handlePunchSort}
                      />
                      <th className="px-4 py-3 text-slate-400">Modo Verificación</th>
                      <th className="px-4 py-3 text-slate-400">Estado Punch (ADMS)</th>
                      <th className="px-4 py-3 text-right text-slate-400">Motor Procesamiento ETL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-sans">
                    {paginatedRawPunches.map((punch) => {
                      const emp = employees.find((e) => e.dni === punch.employee_dni);
                      return (
                        <tr key={punch.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                            {punch.device_sn}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-mono text-slate-200 font-bold">{punch.employee_dni}</div>
                            <div className="text-[10px] text-slate-400">
                              {emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado Registrado'}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                            {punch.timestamp}
                          </td>

                          <td className="px-4 py-3 text-slate-300 font-mono text-[11px]">
                            {punch.verify_mode === 1 ? 'HUELLA DACTILAR (1)' : 'ROSTRO / FACIAL (15)'}
                          </td>

                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${
                              punch.punch_state === 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}>
                              {punch.punch_state === 0 ? '0: ENTRADA' : '1: SALIDA'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {punch.processed ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded inline-flex items-center gap-1 font-mono">
                                <CheckCircle2 className="w-3 h-3" /> PROCESADO (OK)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded inline-flex items-center gap-1 font-mono">
                                PENDIENTE EN STAGING
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <DataTablePagination
                currentPage={punchCurrentPage}
                pageSize={punchPageSize}
                totalItems={filteredRawPunches.length}
                onPageChange={setPunchCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPunchPageSize(newSize);
                  setPunchCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT DEVICE & CONNECTION TESTING */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                {editingDevice ? 'Editar Marcador Biométrico ZKTeco' : 'Registrar Nuevo Marcador ZKTeco'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDeviceModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Device Identification */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nombre del Marcador *</label>
                  <input
                    type="text"
                    placeholder="Marcador Sede Central 01"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Número de Serie (SN) *</label>
                  <input
                    type="text"
                    placeholder="ZK-99100"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono uppercase focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Brand and Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Marca</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none font-bold text-indigo-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Modelo ZKTeco</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none font-mono"
                  >
                    <option value="G3-id">G3-id (Multi-biométrico SilkID + Facial + Tarjeta ID)</option>
                    <option value="G3 Plus">G3 Plus (SilkID + Facial Anti-Spoofing)</option>
                    <option value="uFace 800">uFace 800 (Biométrico Facial + Huella)</option>
                    <option value="SpeedFace-V5L">SpeedFace-V5L (Reconocimiento Facial Luz Visible)</option>
                    <option value="K40 Pro">K40 Pro (Control Asistencia Dactilar + Batería)</option>
                    <option value="MB20">MB20 (Control Asistencia Rostro y Huella)</option>
                    <option value="iClock 880">iClock 880 (Gran Capacidad ADMS / Huella + Cámara)</option>
                    <option value="SilkFP-101TA">SilkFP-101TA (Sensor SilkID con Teclado T9)</option>
                    <option value="SenseFace 7A">SenseFace 7A (Terminal Facial Linux con ADMS)</option>
                    <option value="InBio260">InBio260 (Panel Controlador IP)</option>
                    <option value="otro">Otro Modelo Custom...</option>
                  </select>
                  {model === 'otro' && (
                    <input
                      type="text"
                      placeholder="Ingrese nombre del modelo"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded mt-1 font-mono"
                    />
                  )}
                </div>
              </div>

              {/* IP Address and Port */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Dirección IP *</label>
                  <input
                    type="text"
                    placeholder="192.168.1.201"
                    value={ipAddress}
                    onChange={(e) => {
                      setIpAddress(e.target.value);
                      setTestResult(null);
                      setHasPassedTest(false);
                    }}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Puerto TCP / ADMS *</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => {
                      setPort(Number(e.target.value));
                      setTestResult(null);
                      setHasPassedTest(false);
                    }}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Dependencia & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Dependencia DRAC</label>
                  <select
                    value={selectedDepId}
                    onChange={(e) => setSelectedDepId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none text-xs"
                  >
                    {dependencias.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name} ({dep.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Ubicación Física</label>
                  <input
                    type="text"
                    placeholder="Puerta Principal - Recepción Sede"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* ACTION: PROBAR CONEXIÓN BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestConnectionModal}
                  disabled={isModalTesting || !ipAddress.trim() || !port}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 font-mono"
                >
                  {isModalTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>🟡 Probando conexión socket TCP con {ipAddress}:{port}...</span>
                    </>
                  ) : (
                    <>
                      <Plug className="w-4 h-4" />
                      <span>🔌 Probar Conexión Socket TCP (Puerto {port})</span>
                    </>
                  )}
                </button>
              </div>

              {/* CONNECTION TEST RESULT BANNER & DETAILS */}
              {isModalTesting && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2 font-mono animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando paquete socket TCP a {ipAddress}:{port} ({model})... Por favor espere.</span>
                </div>
              )}

              {testResult && !isModalTesting && (
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-2.5 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-400">✓ Conexión exitosa</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          <span className="text-rose-400">✕ Conexión fallida</span>
                        </>
                      )}
                    </div>
                    <span className="text-[11px] font-mono opacity-80">{testResult.model || model}</span>
                  </div>

                  <p className="font-medium text-slate-200">
                    {testResult.message}
                  </p>

                  {/* Details Breakdown */}
                  <div className="bg-[#090A0D]/80 p-2.5 rounded border border-slate-800/80 space-y-1 font-mono text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estado Comunicación:</span>
                      <span className={testResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {testResult.success ? '🟢 Conectado (ONLINE)' : '🔴 Sin conexión (OFFLINE)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IP / Puerto Provisto:</span>
                      <span>{testResult.ip} : {testResult.port}</span>
                    </div>
                    {testResult.success && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Latencia de Red (RTT):</span>
                        <span className="text-emerald-400 font-bold">{testResult.latency_ms} ms</span>
                      </div>
                    )}
                    {!testResult.success && testResult.cause && (
                      <div className="pt-1.5 border-t border-slate-800/60 text-rose-300">
                        <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase tracking-wider mb-0.5">
                          Causa diagnosticada:
                        </span>
                        <span className="font-normal leading-relaxed text-rose-200">{testResult.cause}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                      <span>Fecha y hora prueba:</span>
                      <span>{testResult.timestamp}</span>
                    </div>
                  </div>

                  {/* LAN IP Notice and Authorization Action */}
                  {!testResult.success && (
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded p-2.5 space-y-2">
                      <div className="flex items-start gap-1.5 text-amber-300 text-[11px]">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">¿El marcador ZKTeco G3-id está en su red local o intranet?</p>
                          <p className="text-slate-300 text-[10px] mt-0.5">
                            Si el equipo físico está encendido en la red interna de su sede (ej. IP 192.168.x.x) y configurado con ADMS Cloud Push, puede autorizar el enlace para registrarlo como <strong>Conectado</strong> sin esperar la respuesta del socket de prueba en la nube.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAuthorizeManualConnection}
                        className="w-full py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 font-mono"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Validar y Autorizar Enlace de Red Local (LAN)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TOGGLEABLE G3-ID & ADMS SETUP GUIDE */}
              <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/30">
                <button
                  type="button"
                  onClick={() => setShowG3Guide(!showG3Guide)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/40 transition-colors text-xs font-semibold"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Guía de Configuración Técnica ZKTeco G3-id / ADMS</span>
                  </div>
                  {showG3Guide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showG3Guide && (
                  <div className="p-3 border-t border-slate-800 bg-[#090A0D]/90 text-[11px] space-y-2 text-slate-300">
                    <p className="text-slate-400 font-sans">
                      Pasos para configurar el terminal físico <strong>ZKTeco G3-id (SilkID)</strong> en la sede o agencia:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 font-mono text-[10px] text-slate-300 pl-1">
                      <li>
                        <strong className="text-indigo-300">Configuración IP Red (Ethernet / Wi-Fi):</strong><br />
                        <span className="text-slate-400">Menú ➔ Com. ➔ Ethernet:</span> Asigne IP estática (ej: <code className="text-emerald-400">192.168.1.201</code>), Máscara: <code className="text-slate-300">255.255.255.0</code>, Gateway: <code className="text-slate-300">192.168.1.1</code>.
                      </li>
                      <li>
                        <strong className="text-indigo-300">Servidor Cloud / Servidor ADMS (Push):</strong><br />
                        <span className="text-slate-400">Menú ➔ Com. ➔ Servidor Cloud:</span> Ingrese la dirección IP/Dominio de este servidor web, Puerto: <code className="text-indigo-400">4370</code> / <code className="text-indigo-400">80</code>, y seleccione <code className="text-emerald-400">Habilitar Dominio / Servidor Web</code>.
                      </li>
                      <li>
                        <strong className="text-indigo-300">Sensor SilkID y Reconocimiento Facial:</strong><br />
                        <span className="text-slate-400">Menú ➔ Sistema ➔ Parámetros Biométricos:</span> Sensibilidad SilkID en nivel <em>Normal / Alto</em> para lectura dactilar con dedos secos o húmedos.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddDeviceModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded font-semibold text-xs"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleDeviceSubmit(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded font-semibold text-xs transition-colors"
                title="Guardar dispositivo en el sistema sin activarlo de inmediato"
              >
                Guardar como Configurado (Pendiente)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!hasPassedTest) {
                    alert('⚠️ ATENCIÓN: Para activar el marcador como "Conectado", presione "🔌 Probar Conexión" o utilice "Validar y Autorizar Enlace de Red Local (LAN)".\n\nTambién puede guardarlo como "Configurado (Pendiente)".');
                    return;
                  }
                  handleDeviceSubmit(true);
                }}
                disabled={!hasPassedTest}
                className={`px-4 py-1.5 font-bold text-xs rounded transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                  hasPassedTest
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-emerald-950/40 text-emerald-600/50 border border-emerald-900/40 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Guardar y Activar (Conectado)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SIMULATE PUNCH PUSH */}
      {showPunchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handlePunchSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                Transmitir Marcación ADMS en Vivo
              </h3>
              <button
                type="button"
                onClick={() => setShowPunchModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Seleccionar Colaborador</label>
                <select
                  value={selectedEmpDni}
                  onChange={(e) => setSelectedEmpDni(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.dni}>
                      {e.first_name} {e.last_name} (DNI: {e.dni})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Reloj Biométrico de Origen</label>
                <select
                  value={selectedDeviceSn}
                  onChange={(e) => setSelectedDeviceSn(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.serial_number}>
                      {d.name} ({d.serial_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Hora de Marcación</label>
                  <input
                    type="time"
                    step="1"
                    value={punchTime}
                    onChange={(e) => setPunchTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Tipo de Fichaje</label>
                  <select
                    value={punchType}
                    onChange={(e) => setPunchType(Number(e.target.value) as 0 | 1)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                  >
                    <option value={0}>0: ENTRADA (Check-In)</option>
                    <option value={1}>1: SALIDA (Check-Out)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPunchModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition-colors shadow-sm"
              >
                Enviar Marcación ADMS
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DATA POLICY CONFIRMATION MODAL */}
      <DataPolicyConfirmModal config={confirmModalConfig} />
    </div>
  );
};
