import React, { useState, useMemo } from 'react';
import {
  DispositivoZkTeco,
  MarcacionRaw,
  Employee,
  RoleType,
  Dependencia,
  DeviceStatus,
  DeviceTestRecord,
  AutorizacionMarcacionTemporal,
  PunchValidationStatus,
} from '../../types';
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
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Calendar,
  User,
  MapPin,
  FileCheck2,
  Ban,
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter, FilterField, FilterSelect } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';

interface DevicesModuleProps {
  activeView?: string;
  devices: DispositivoZkTeco[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  dependencias?: Dependencia[];
  punchAuthorizations?: AutorizacionMarcacionTemporal[];
  activeRole: RoleType;
  onAddDevice: (newDevice: Omit<DispositivoZkTeco, 'id' | 'last_activity'>) => Promise<any> | void;
  onEditDevice: (device: DispositivoZkTeco) => Promise<any> | void;
  onDeleteDevice: (deviceId: string) => Promise<any> | void;
  onSimulatePunch: (newPunch: Omit<MarcacionRaw, 'id' | 'processed' | 'processed_at'>) => MarcacionRaw | void;
  onAddPunchAuthorization?: (auth: Omit<AutorizacionMarcacionTemporal, 'id' | 'created_at' | 'status'>) => Promise<any> | void;
  onRevokePunchAuthorization?: (authId: string, reason?: string) => Promise<any> | void;
  onDeletePunchAuthorization?: (authId: string) => Promise<any> | void;
}

export const DevicesModule: React.FC<DevicesModuleProps> = ({
  activeView,
  devices,
  rawPunches,
  employees,
  dependencias = [],
  punchAuthorizations = [],
  activeRole,
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onSimulatePunch,
  onAddPunchAuthorization,
  onRevokePunchAuthorization,
  onDeletePunchAuthorization,
}) => {
  const [activeTab, setActiveTab] = useState<'DEVICES' | 'RAW_PUNCHES' | 'AUTHORIZATIONS'>('DEVICES');

  // Success Notification Toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Auto-dismiss success toast after 4.5s
  React.useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => {
        setSuccessToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

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
  const [punchValidationFilter, setPunchValidationFilter] = useState('ALL');
  const [punchStateFilter, setPunchStateFilter] = useState('ALL');
  const [punchCurrentPage, setPunchCurrentPage] = useState(1);
  const [punchPageSize, setPunchPageSize] = useState(20);
  const [punchSortField, setPunchSortField] = useState<string | null>('timestamp');
  const [punchSortOrder, setPunchSortOrder] = useState<SortOrder>('desc');

  // AUTHORIZATIONS TAB SEARCH, FILTER, SORT & PAGINATION
  const [authSearchTerm, setAuthSearchTerm] = useState('');
  const [authStatusFilter, setAuthStatusFilter] = useState('ALL');
  const [authDepFilter, setAuthDepFilter] = useState('ALL');
  const [authCurrentPage, setAuthCurrentPage] = useState(1);
  const [authPageSize, setAuthPageSize] = useState(10);

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
        const matchSn = (d.serial_number || '').toLowerCase().includes(term);
        const matchName = (d.name || '').toLowerCase().includes(term);
        const matchIp = (d.ip_address || '').toLowerCase().includes(term);
        const matchModel = (d.model || '').toLowerCase().includes(term);
        const matchLoc = (d.location_detail || '').toLowerCase().includes(term);
        const matchDep = (d.dependencia_name || '').toLowerCase().includes(term);
        if (!matchSn && !matchName && !matchIp && !matchModel && !matchLoc && !matchDep) return false;
      }
      if (devStatusFilter !== 'ALL' && d.status !== devStatusFilter) return false;
      if (devDepFilter !== 'ALL') {
        const depTipo = d.dependencia_tipo || (d.dependencia_name?.toUpperCase().includes('AGENCIA') ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL');
        if (depTipo !== devDepFilter && d.dependencia_id !== devDepFilter) return false;
      }
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
    if (punchValidationFilter !== 'ALL') count++;
    if (punchStateFilter !== 'ALL') count++;
    return count;
  }, [punchDeviceFilter, punchValidationFilter, punchStateFilter]);

  const handleResetPunchFilters = () => {
    setPunchSearchTerm('');
    setPunchDeviceFilter('ALL');
    setPunchValidationFilter('ALL');
    setPunchStateFilter('ALL');
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
        const empName = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : (punch.employee_name || '').toLowerCase();
        const matchDni = (punch.employee_dni || '').toLowerCase().includes(term);
        const matchSn = (punch.device_sn || '').toLowerCase().includes(term);
        const matchDevName = (punch.device_name || '').toLowerCase().includes(term);
        const matchTime = (punch.timestamp || '').toLowerCase().includes(term);
        const matchReason = (punch.rejection_reason || '').toLowerCase().includes(term);
        if (!matchDni && !matchSn && !matchTime && !empName.includes(term) && !matchDevName.includes(term) && !matchReason.includes(term)) {
          return false;
        }
      }
      if (punchDeviceFilter !== 'ALL' && punch.device_sn !== punchDeviceFilter) return false;
      if (punchValidationFilter !== 'ALL') {
        const status = punch.validation_status || (punch.processed ? 'VALIDA' : 'VALIDA');
        if (status !== punchValidationFilter) return false;
      }
      if (punchStateFilter !== 'ALL' && String(punch.punch_state) !== punchStateFilter) return false;
      return true;
    });
  }, [rawPunches, employees, punchSearchTerm, punchDeviceFilter, punchValidationFilter, punchStateFilter]);

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

  // Authorizations Filtering
  const filteredAuthorizations = useMemo(() => {
    return punchAuthorizations.filter((auth) => {
      if (authSearchTerm.trim()) {
        const term = authSearchTerm.toLowerCase().trim();
        const matchDni = auth.employee_dni.toLowerCase().includes(term);
        const matchName = (auth.employee_name || '').toLowerCase().includes(term);
        const matchDoc = (auth.documento_autorizacion || '').toLowerCase().includes(term);
        const matchMotivo = (auth.motivo || '').toLowerCase().includes(term);
        if (!matchDni && !matchName && !matchDoc && !matchMotivo) return false;
      }
      if (authStatusFilter !== 'ALL' && auth.status !== authStatusFilter) return false;
      if (authDepFilter !== 'ALL' && auth.dependencia_autorizada_tipo !== authDepFilter) return false;
      return true;
    });
  }, [punchAuthorizations, authSearchTerm, authStatusFilter, authDepFilter]);

  const paginatedAuthorizations = useMemo(() => {
    const start = (authCurrentPage - 1) * authPageSize;
    return filteredAuthorizations.slice(start, start + authPageSize);
  }, [filteredAuthorizations, authCurrentPage, authPageSize]);

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'devices_list' || activeView === 'devices_sync') setActiveTab('DEVICES');
    else if (activeView === 'devices_staging') setActiveTab('RAW_PUNCHES');
    else if (activeView === 'devices_authorizations') setActiveTab('AUTHORIZATIONS');
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State: Device Registration
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [brand, setBrand] = useState('ZKTeco');
  const [model, setModel] = useState('G3-id');
  const [customModel, setCustomModel] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState(4370);
  const [location, setLocation] = useState('');
  const [selectedDepId, setSelectedDepId] = useState<string>(''); // Must start empty to force user selection
  const [showG3Guide, setShowG3Guide] = useState(false);

  // Connection Test State inside Modal (Independent and optional)
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
  const [punchResultAlert, setPunchResultAlert] = useState<{
    status: PunchValidationStatus;
    message: string;
    details?: string;
  } | null>(null);

  // Modal State: New Punch Authorization
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmpDni, setAuthEmpDni] = useState('');
  const [authDepAutorizada, setAuthDepAutorizada] = useState<'SEDE_CENTRAL' | 'AGENCIA_AGRARIA'>('AGENCIA_AGRARIA');
  const [authDeviceId, setAuthDeviceId] = useState('');
  const [authStartDate, setAuthStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [authEndDate, setAuthEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [authMotivo, setAuthMotivo] = useState('Comisión de servicios en agencia');
  const [authDocumento, setAuthDocumento] = useState('Memorando N° 142-2026-GR.CAJ/DRA-RRHH');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

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
    setSelectedDepId(''); // Requires user to choose [Seleccionar dependencia ▼]
    setTestResult(null);
    setHasPassedTest(false);
    setFormError(null);
    setShowAddDeviceModal(true);
  };

  // Open Edit Device Modal
  const handleOpenEditDevice = (device: DispositivoZkTeco) => {
    setEditingDevice(device);
    setSerialNumber(device.serial_number);
    setDeviceName(device.name);
    setBrand(device.brand || 'ZKTeco');

    const standardModels = [
      'G3-id',
      'G3 Plus',
      'uFace 800',
      'SpeedFace-V5L',
      'K40 Pro',
      'MB20',
      'iClock 880',
      'SilkFP-101TA',
      'SenseFace 7A',
      'InBio260',
    ];
    if (standardModels.includes(device.model)) {
      setModel(device.model);
      setCustomModel('');
    } else {
      setModel('otro');
      setCustomModel(device.model);
    }

    setIpAddress(device.ip_address);
    setPort(device.port);
    setLocation(device.location_detail);

    // Map dependencia
    if (device.dependencia_tipo === 'AGENCIA_AGRARIA' || device.dependencia_id === 'dep-02' || device.dependencia_name?.toUpperCase().includes('AGENCIA')) {
      setSelectedDepId('dep-02');
    } else {
      setSelectedDepId('dep-01');
    }

    setTestResult(
      device.last_test
        ? {
            success: device.last_test.result === 'SUCCESS',
            status: device.last_test.result === 'SUCCESS' ? 'ONLINE' : 'OFFLINE',
            message: device.last_test.message || 'Última prueba registrada.',
            cause: device.last_test.cause,
            latency_ms: device.last_test.latency_ms,
            ip: device.last_test.ip,
            port: device.last_test.port,
            model: device.last_test.model,
            timestamp: device.last_test.date,
          }
        : null
    );
    setHasPassedTest(device.last_test ? device.last_test.result === 'SUCCESS' : false);
    setFormError(null);
    setShowAddDeviceModal(true);
  };

  // Handle Delete Confirmation
  const handleDeleteClick = (dev: DispositivoZkTeco) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Eliminar Marcador ZKTeco',
      message: `¿Está seguro de eliminar el marcador biométrico "${dev.name}" (S/N: ${dev.serial_number})? Esta acción se registrará en la auditoría de seguridad del sistema.`,
      actionType: 'DELETE',
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        await onDeleteDevice(dev.id);
        setSuccessToast(`Marcador "${dev.name}" eliminado correctamente.`);
      },
      onCancel: () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Connection Test inside Modal (Independent test)
  const handleTestConnectionModal = async () => {
    if (!ipAddress.trim() || !port) {
      setFormError('Debe ingresar la dirección IP y el puerto TCP para probar la conexión física.');
      return;
    }

    setIsModalTesting(true);
    setFormError(null);
    const finalModel = model === 'otro' ? customModel.trim() || 'Modelo Custom' : model;

    try {
      const result = await testZkTecoConnection(ipAddress.trim(), port, finalModel);
      setTestResult(result);
      setHasPassedTest(result.success);
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 'OFFLINE',
        message: 'Error inesperado al probar conexión',
        cause: err?.message || 'Fallo de red.',
        ip: ipAddress,
        port,
        model: finalModel,
        timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      });
      setHasPassedTest(false);
    } finally {
      setIsModalTesting(false);
    }
  };

  // Allow manual override for LAN
  const handleAuthorizeManualConnection = () => {
    const finalModel = model === 'otro' ? customModel.trim() || 'Modelo Custom' : model;
    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    setTestResult({
      success: true,
      status: 'ONLINE',
      message: 'Conexión validada manualmente por el administrador para entorno local (LAN).',
      ip: ipAddress,
      port,
      model: finalModel,
      latency_ms: 5,
      timestamp: nowStr,
    });
    setHasPassedTest(true);
  };

  // Inline connection testing from device cards
  const handleTestConnectionList = async (dev: DispositivoZkTeco) => {
    setTestingDeviceId(dev.id);
    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const result = await testZkTecoConnection(dev.ip_address, dev.port, dev.model);
    setTestingDeviceId(null);

    const testRecord: DeviceTestRecord = {
      date: result.timestamp || nowStr,
      result: result.success ? 'SUCCESS' : 'FAILED',
      message: result.message,
      cause: result.cause,
      user: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador DRAC',
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

    await onEditDevice(updatedDevice);
  };

  // Robust Form Submission with Strict Dependencia & Uniqueness Validations
  const handleDeviceSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setFormError(null);

    // 1. Mandatory Field Validations
    const cleanName = deviceName.trim();
    if (!cleanName) {
      setFormError('El nombre o identificador del marcador es obligatorio.');
      return;
    }

    const cleanSn = serialNumber.trim().toUpperCase();
    if (!cleanSn) {
      setFormError('El número de serie (S/N) del marcador es obligatorio.');
      return;
    }

    const cleanBrand = brand.trim() || 'ZKTeco';
    const finalModel = model === 'otro' ? customModel.trim() || 'Modelo Genérico' : model;
    if (!finalModel) {
      setFormError('El modelo del marcador es obligatorio.');
      return;
    }

    const cleanIp = ipAddress.trim();
    if (!cleanIp) {
      setFormError('La dirección IP del marcador es obligatoria.');
      return;
    }

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(cleanIp)) {
      setFormError(`La dirección IP '${cleanIp}' no es válida. Debe ser un formato IPv4 estándar (ejemplo: 192.168.1.201).`);
      return;
    }

    const cleanPort = Number(port);
    if (isNaN(cleanPort) || cleanPort <= 0 || cleanPort > 65535) {
      setFormError('El puerto TCP debe ser un número válido entre 1 y 65535 (por defecto: 4370).');
      return;
    }

    // STRICT DEPENDENCIA VALIDATION: SEDE CENTRAL or AGENCIA AGRARIA
    if (!selectedDepId || (selectedDepId !== 'dep-01' && selectedDepId !== 'dep-02')) {
      setFormError('Debe seleccionar obligatoriamente una Dependencia para el marcador: "SEDE CENTRAL" o "AGENCIA AGRARIA".');
      return;
    }

    const depTipo: 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA' = selectedDepId === 'dep-02' ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL';
    const depName = depTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';

    const cleanLocation = location.trim();
    if (!cleanLocation) {
      setFormError('La ubicación física del marcador es obligatoria.');
      return;
    }

    // 2. Uniqueness Validations (Client-side pre-check)
    const duplicateSn = devices.find(
      (d) => (!editingDevice || d.id !== editingDevice.id) && d.serial_number && d.serial_number.toUpperCase() === cleanSn
    );
    if (duplicateSn) {
      const msg = `Ya existe un marcador registrado con el número de serie '${cleanSn}'.`;
      setFormError(msg);
      console.error('Error de validación al guardar marcador: SN duplicado', cleanSn);
      return;
    }

    const duplicateName = devices.find(
      (d) => (!editingDevice || d.id !== editingDevice.id) && d.name && d.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicateName) {
      const msg = `Ya existe un marcador registrado con el nombre '${cleanName}'. Por favor ingrese un nombre distinto.`;
      setFormError(msg);
      console.error('Error de validación al guardar marcador: nombre duplicado', cleanName);
      return;
    }

    const duplicateIp = devices.find(
      (d) => (!editingDevice || d.id !== editingDevice.id) && d.ip_address === cleanIp && Number(d.port) === cleanPort
    );
    if (duplicateIp) {
      const msg = `La dirección IP '${cleanIp}' con puerto ${cleanPort} ya está asignada al marcador '${duplicateIp.name}'.`;
      setFormError(msg);
      console.error('Error de validación al guardar marcador: IP y puerto duplicados', cleanIp, cleanPort);
      return;
    }

    // 3. Status determination
    let finalStatus: DeviceStatus = 'CONFIGURED';
    if (testResult) {
      finalStatus = testResult.success ? 'ONLINE' : 'OFFLINE';
    } else if (editingDevice) {
      finalStatus = editingDevice.status;
    }

    const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    let lastTestRecord: DeviceTestRecord | undefined = editingDevice?.last_test;
    if (testResult) {
      lastTestRecord = {
        date: testResult.timestamp || nowStr,
        result: testResult.success ? 'SUCCESS' : 'FAILED',
        message: testResult.message,
        cause: testResult.cause,
        user: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador DRAC',
        latency_ms: testResult.latency_ms,
        ip: cleanIp,
        port: cleanPort,
        model: finalModel,
        serial_number: cleanSn,
      };
    }

    setIsSubmitting(true);

    try {
      if (editingDevice) {
        await onEditDevice({
          ...editingDevice,
          serial_number: cleanSn,
          name: cleanName,
          brand: cleanBrand,
          model: finalModel,
          ip_address: cleanIp,
          port: cleanPort,
          location_detail: cleanLocation,
          dependencia_tipo: depTipo,
          dependencia_id: selectedDepId,
          dependencia_name: depName,
          status: finalStatus,
          last_test: lastTestRecord,
        });
        setSuccessToast('Marcador registrado correctamente.');
      } else {
        await onAddDevice({
          serial_number: cleanSn,
          name: cleanName,
          brand: cleanBrand,
          model: finalModel,
          ip_address: cleanIp,
          port: cleanPort,
          protocol: 'PUSH_ADMS',
          dependencia_tipo: depTipo,
          dependencia_id: selectedDepId,
          dependencia_name: depName,
          location_detail: cleanLocation,
          status: finalStatus,
          firmware_version: 'Ver 8.0.4.3-2026',
          last_test: lastTestRecord,
        });
        setSuccessToast('Marcador registrado correctamente.');
      }

      // Success: Close modal and reset state
      setShowAddDeviceModal(false);
      setEditingDevice(null);
      setFormError(null);
    } catch (err: any) {
      // Failure: Do NOT close form, keep input values, show error banner, log to console
      const message = err?.message || 'No fue posible guardar el marcador en la base de datos.';
      setFormError(message);
      console.error('Error al persistir marcador ZKTeco:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Punch Push Handler & Live Simulation
  const handlePunchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString().split('T')[0];

    const result = onSimulatePunch({
      device_sn: selectedDeviceSn,
      employee_dni: selectedEmpDni,
      timestamp: `${now} ${punchTime}`,
      verify_mode: 1, // Fingerprint / Biometric
      punch_state: punchType,
    });

    const punchRes = result as MarcacionRaw | undefined;

    if (punchRes && punchRes.validation_status === 'RECHAZADA_DEPENDENCIA') {
      setPunchResultAlert({
        status: 'RECHAZADA_DEPENDENCIA',
        message: 'Marcación RECHAZADA por Conflicto de Dependencia',
        details: punchRes.rejection_reason || 'El colaborador pertenece a otra dependencia.',
      });
    } else if (punchRes && punchRes.validation_status === 'EXCEPCION_AUTORIZADA') {
      setPunchResultAlert({
        status: 'EXCEPCION_AUTORIZADA',
        message: 'Marcación REGISTRADA mediante AUTORIZACIÓN TEMPORAL',
        details: 'El colaborador cuenta con permiso de marcación inter-sede activo.',
      });
      setSuccessToast('Marcación registrada por excepción autorizada.');
    } else {
      setPunchResultAlert({
        status: 'VALIDA',
        message: 'Marcación VÁLIDA Registrada Exitosamente',
        details: 'Coincidencia confirmada de Dependencia entre trabajador y marcador.',
      });
      setSuccessToast('Marcación transmitida y validada correctamente.');
    }
  };

  // Selected Employee & Device in Punch Simulation Modal for Real-Time Analysis
  const currentPunchEmp = useMemo(() => {
    return employees.find((e) => e.dni === selectedEmpDni) || employees[0];
  }, [employees, selectedEmpDni]);

  const currentPunchDev = useMemo(() => {
    return devices.find((d) => d.serial_number === selectedDeviceSn) || devices[0];
  }, [devices, selectedDeviceSn]);

  const currentPunchEmpDep = useMemo(() => {
    if (!currentPunchEmp) return 'SEDE CENTRAL';
    return currentPunchEmp.dependencia_id === 'dep-02' || currentPunchEmp.dependencia_name?.toUpperCase().includes('AGENCIA')
      ? 'AGENCIA AGRARIA'
      : 'SEDE CENTRAL';
  }, [currentPunchEmp]);

  const currentPunchDevDep = useMemo(() => {
    if (!currentPunchDev) return 'SEDE CENTRAL';
    return currentPunchDev.dependencia_tipo === 'AGENCIA_AGRARIA' ||
      currentPunchDev.dependencia_id === 'dep-02' ||
      currentPunchDev.dependencia_name?.toUpperCase().includes('AGENCIA')
      ? 'AGENCIA AGRARIA'
      : 'SEDE CENTRAL';
  }, [currentPunchDev]);

  const currentActiveAuth = useMemo(() => {
    if (!currentPunchEmp || !currentPunchDev) return null;
    const nowStr = new Date().toISOString().split('T')[0];
    const devDepTipo = currentPunchDevDep === 'AGENCIA_AGRARIA' ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL';
    return punchAuthorizations.find(
      (a) =>
        a.status === 'ACTIVA' &&
        a.employee_dni === currentPunchEmp.dni &&
        nowStr >= a.start_date &&
        nowStr <= a.end_date &&
        a.dependencia_autorizada_tipo === devDepTipo
    );
  }, [currentPunchEmp, currentPunchDev, currentPunchDevDep, punchAuthorizations]);

  // Handle Save New Authorization
  const handleSaveAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authEmpDni) {
      setAuthError('Debe seleccionar un trabajador.');
      return;
    }

    const emp = employees.find((e) => e.dni === authEmpDni);
    if (!emp) {
      setAuthError('Trabajador no válido.');
      return;
    }

    if (!authStartDate || !authEndDate) {
      setAuthError('Debe ingresar el periodo de vigencia completo.');
      return;
    }

    if (authStartDate > authEndDate) {
      setAuthError('La fecha de inicio no puede ser posterior a la fecha de término.');
      return;
    }

    if (!authMotivo.trim()) {
      setAuthError('El motivo de la autorización es obligatorio.');
      return;
    }

    if (!authDocumento.trim()) {
      setAuthError('El documento de sustento/autorización es obligatorio.');
      return;
    }

    const empDepTipo = emp.dependencia_id === 'dep-02' || emp.dependencia_name?.toUpperCase().includes('AGENCIA')
      ? 'AGENCIA_AGRARIA'
      : 'SEDE_CENTRAL';
    const empDepName = empDepTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';
    const authedDev = devices.find((d) => d.id === authDeviceId);

    setIsSubmittingAuth(true);

    try {
      if (onAddPunchAuthorization) {
        await onAddPunchAuthorization({
          employee_id: emp.id,
          employee_dni: emp.dni,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_cargo: emp.cargo || 'Servidor DRAC',
          dependencia_origen_tipo: empDepTipo,
          dependencia_origen_name: empDepName,
          dependencia_autorizada_tipo: authDepAutorizada,
          dependencia_autorizada_name: authDepAutorizada === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL',
          device_id: authedDev ? authedDev.id : undefined,
          device_name: authedDev ? authedDev.name : undefined,
          device_sn: authedDev ? authedDev.serial_number : undefined,
          start_date: authStartDate,
          end_date: authEndDate,
          motivo: authMotivo.trim(),
          documento_autorizacion: authDocumento.trim(),
          created_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador DRAC',
        });
      }

      setSuccessToast('Autorización temporal de marcación registrada correctamente.');
      setShowAuthModal(false);
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err?.message || 'Error al registrar la autorización temporal.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRevokeAuth = (auth: AutorizacionMarcacionTemporal) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Revocar Autorización Temporal',
      message: `¿Está seguro de revocar la autorización de marcación inter-sede para ${auth.employee_name} (${auth.employee_dni})? El colaborador ya no podrá registrar asistencia en ${auth.dependencia_autorizada_name}.`,
      actionType: 'DEACTIVATE',
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (onRevokePunchAuthorization) {
          await onRevokePunchAuthorization(auth.id, 'Revocada por decisión de Recursos Humanos');
        }
        setSuccessToast(`Autorización de ${auth.employee_name} revocada.`);
      },
      onCancel: () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* SUCCESS TOAST BANNER */}
      {successToast && (
        <div className="bg-emerald-950/90 border border-emerald-500/80 text-emerald-100 px-4 py-3 rounded-xl flex items-center justify-between shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-300">{successToast}</p>
              <p className="text-[11px] text-emerald-400/90">
                La operación ha sido persistida y sincronizada correctamente con la base de datos institucional.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-400 hover:text-white p-1 rounded transition-colors"
            title="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Gestión de Marcadores Biométricos ZKTeco &amp; Reglas de Dependencia
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cada marcador está vinculado estrictamente a <strong className="text-indigo-300 font-semibold">SEDE CENTRAL</strong> o <strong className="text-amber-300 font-semibold">AGENCIA AGRARIA</strong>. Las marcaciones fuera de sede se validan contra autorizaciones temporales activas.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* TABS */}
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
            <button
              onClick={() => setActiveTab('AUTHORIZATIONS')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'AUTHORIZATIONS'
                  ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Autorizaciones Temporales ({punchAuthorizations.length})
            </button>
          </div>

          {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
            <div className="flex items-center gap-2">
              {activeTab === 'AUTHORIZATIONS' ? (
                <button
                  onClick={() => {
                    setAuthEmpDni(employees[0]?.dni || '');
                    setAuthDepAutorizada('AGENCIA_AGRARIA');
                    setAuthDeviceId('');
                    setAuthStartDate(new Date().toISOString().split('T')[0]);
                    setAuthEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                    setAuthMotivo('Comisión de servicios');
                    setAuthDocumento('Memorando N° 142-2026-GR.CAJ/DRA-RRHH');
                    setAuthError(null);
                    setShowAuthModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Nueva Autorización Temporal</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenAddDevice}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Dispositivo</span>
                </button>
              )}

              <button
                onClick={() => {
                  setPunchResultAlert(null);
                  setShowPunchModal(true);
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmitir Marcación ADMS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DEVICES GRID VIEW */}
      {/* ========================================================= */}
      {activeTab === 'DEVICES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={devSearchTerm}
            onSearchChange={(val) => {
              setDevSearchTerm(val);
              setDevCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar marcador por nombre, S/N, IP, modelo, ubicación o dependencia..."
            activeFilterCount={activeDevFilterCount}
            onResetFilters={handleResetDevFilters}
          >
            <FilterField label="Estado Operativo">
              <FilterSelect
                value={devStatusFilter}
                onChange={(val) => {
                  setDevStatusFilter(val);
                  setDevCurrentPage(1);
                }}
                placeholder="Todos los Estados"
                options={[
                  { value: 'ONLINE', label: '🟢 Conectado (ONLINE)' },
                  { value: 'OFFLINE', label: '🔴 Sin Conexión (OFFLINE)' },
                  { value: 'CONFIGURED', label: '🟡 Registrado en Base de Datos' },
                ]}
              />
            </FilterField>

            <FilterField label="Dependencia Asignada">
              <FilterSelect
                value={devDepFilter}
                onChange={(val) => {
                  setDevDepFilter(val);
                  setDevCurrentPage(1);
                }}
                placeholder="Todas las Dependencias"
                options={[
                  { value: 'SEDE_CENTRAL', label: '🏢 SEDE CENTRAL' },
                  { value: 'AGENCIA_AGRARIA', label: '🌾 AGENCIA AGRARIA' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {filteredDevices.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="No se encontraron marcadores biométricos"
              description="No hay dispositivos ZKTeco que coincidan con los criterios de búsqueda o filtros seleccionados."
              isFiltered={Boolean(devSearchTerm.trim()) || activeDevFilterCount > 0}
              onAction={handleResetDevFilters}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedDevices.map((d) => {
                  const isTestingRow = testingDeviceId === d.id;
                  const depTipo = d.dependencia_tipo || (d.dependencia_name?.toUpperCase().includes('AGENCIA') ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL');
                  const depName = depTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';

                  return (
                    <div
                      key={d.id}
                      className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        {/* Top device header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-lg border ${
                                d.status === 'ONLINE'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : d.status === 'OFFLINE'
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                              }`}
                            >
                              <Cpu className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                                {d.name}
                              </h3>
                              <span className="text-[10px] font-mono text-slate-400">
                                S/N: {d.serial_number}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditDevice(d)}
                                  className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                                  title="Editar marcador"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(d)}
                                  className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Eliminar marcador"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Dependencia Badge (Mandatory SEDE CENTRAL vs AGENCIA AGRARIA) */}
                        <div className="mb-3">
                          {depTipo === 'SEDE_CENTRAL' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-[11px]">
                              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Dependencia: SEDE CENTRAL</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-amber-400" />
                              <span>Dependencia: AGENCIA AGRARIA</span>
                            </span>
                          )}
                        </div>

                        {/* Specs Grid */}
                        <div className="space-y-1.5 text-xs text-slate-300 bg-[#090A0D]/60 p-3 rounded-lg border border-slate-800/80">
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-400">Modelo ZKTeco:</span>
                            <span className="text-white font-bold">{d.model}</span>
                          </div>
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-400">Dirección IP:</span>
                            <span className="text-indigo-300 font-semibold">{d.ip_address}:{d.port}</span>
                          </div>
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-400">Protocolo:</span>
                            <span className="text-slate-200">{d.protocol || 'PUSH_ADMS'}</span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800">
                            <span className="text-slate-400">Ubicación:</span>
                            <span className="text-slate-300 truncate max-w-[170px]" title={d.location_detail}>
                              {d.location_detail}
                            </span>
                          </div>
                        </div>

                        {/* Diagnostic & Connection Result */}
                        {d.last_test ? (
                          <div
                            className={`mt-3 p-2.5 rounded-lg border text-xs space-y-1 ${
                              d.last_test.result === 'SUCCESS'
                                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-mono">Último Test TCP:</span>
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

      {/* ========================================================= */}
      {/* RAW PUNCHES STAGING TABLE */}
      {/* ========================================================= */}
      {activeTab === 'RAW_PUNCHES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={punchSearchTerm}
            onSearchChange={(val) => {
              setPunchSearchTerm(val);
              setPunchCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar marcación por DNI, empleado, S/N de reloj, fecha o motivo de rechazo..."
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
                options={devices.map((d) => ({
                  value: d.serial_number,
                  label: `${d.serial_number} - ${d.name} (${d.dependencia_tipo === 'AGENCIA_AGRARIA' ? 'AGENCIA' : 'SEDE'})`,
                }))}
              />
            </FilterField>

            <FilterField label="Validación por Dependencia">
              <FilterSelect
                value={punchValidationFilter}
                onChange={(val) => {
                  setPunchValidationFilter(val);
                  setPunchCurrentPage(1);
                }}
                placeholder="Todos los Estados de Validación"
                options={[
                  { value: 'VALIDA', label: '🟢 Válida (Misma Sede)' },
                  { value: 'EXCEPCION_AUTORIZADA', label: '🔵 Excepción Autorizada' },
                  { value: 'RECHAZADA_DEPENDENCIA', label: '🔴 Rechazada por Dependencia' },
                ]}
              />
            </FilterField>

            <FilterField label="Tipo de Fichaje">
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
                        label="Marcador ZKTeco / Dependencia"
                        field="device_sn"
                        currentField={punchSortField}
                        currentOrder={punchSortOrder}
                        onSort={handlePunchSort}
                      />
                      <SortableHeader
                        label="Colaborador / Dependencia Origen"
                        field="employee_dni"
                        currentField={punchSortField}
                        currentOrder={punchSortOrder}
                        onSort={handlePunchSort}
                      />
                      <SortableHeader
                        label="Timestamp"
                        field="timestamp"
                        currentField={punchSortField}
                        currentOrder={punchSortOrder}
                        onSort={handlePunchSort}
                      />
                      <th className="px-4 py-3 text-slate-400">Tipo</th>
                      <th className="px-4 py-3 text-slate-400">Validación de Sede</th>
                      <th className="px-4 py-3 text-slate-400">Trazabilidad / Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-sans">
                    {paginatedRawPunches.map((punch) => {
                      const emp = employees.find((e) => e.dni === punch.employee_dni);
                      const dev = devices.find((d) => d.serial_number === punch.device_sn);

                      const empDep = punch.employee_dependencia_name ||
                        (emp?.dependencia_id === 'dep-02' || emp?.dependencia_name?.toUpperCase().includes('AGENCIA')
                          ? 'AGENCIA AGRARIA'
                          : 'SEDE CENTRAL');

                      const devDep = punch.device_dependencia_name ||
                        (dev?.dependencia_tipo === 'AGENCIA_AGRARIA' || dev?.dependencia_name?.toUpperCase().includes('AGENCIA')
                          ? 'AGENCIA AGRARIA'
                          : 'SEDE CENTRAL');

                      const valStatus: PunchValidationStatus = punch.validation_status || (punch.processed ? 'VALIDA' : 'VALIDA');

                      return (
                        <tr key={punch.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{dev?.name || punch.device_name || punch.device_sn}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <span className="font-mono">{punch.device_sn}</span>
                              <span>•</span>
                              <span className={devDep === 'AGENCIA AGRARIA' ? 'text-amber-400 font-semibold' : 'text-indigo-300 font-semibold'}>
                                {devDep}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-mono text-slate-200 font-bold">
                              {emp ? `${emp.first_name} ${emp.last_name}` : punch.employee_name || 'Personal DRAC'}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="font-mono">DNI: {punch.employee_dni}</span>
                              <span>•</span>
                              <span className={empDep === 'AGENCIA AGRARIA' ? 'text-amber-400 font-semibold' : 'text-indigo-300 font-semibold'}>
                                {empDep}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                            {punch.timestamp}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${
                                punch.punch_state === 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}
                            >
                              {punch.punch_state === 0 ? '0: ENTRADA' : '1: SALIDA'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {valStatus === 'VALIDA' && (
                              <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded inline-flex items-center gap-1.5 font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>VÁLIDA (Misma Sede)</span>
                              </span>
                            )}
                            {valStatus === 'EXCEPCION_AUTORIZADA' && (
                              <span className="px-2.5 py-1 text-[11px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded inline-flex items-center gap-1.5 font-mono">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                                <span>EXCEPCIÓN AUTORIZADA</span>
                              </span>
                            )}
                            {valStatus === 'RECHAZADA_DEPENDENCIA' && (
                              <span className="px-2.5 py-1 text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded inline-flex items-center gap-1.5 font-mono">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                                <span>RECHAZADA (Incidencia)</span>
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-300 max-w-xs">
                            {punch.rejection_reason ? (
                              <p className="text-[11px] text-rose-300/90 leading-tight">
                                {punch.rejection_reason}
                              </p>
                            ) : punch.authorization_id ? (
                              <p className="text-[11px] text-indigo-300/90 leading-tight">
                                Autorización activa ID: <code className="font-mono">{punch.authorization_id}</code>
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                Sede coincidente: {empDep} = {devDep}
                              </p>
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

      {/* ========================================================= */}
      {/* AUTHORIZATIONS TAB VIEW */}
      {/* ========================================================= */}
      {activeTab === 'AUTHORIZATIONS' && (
        <div className="space-y-4">
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Autorizaciones Temporales de Marcación Inter-Sede
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Permite a los trabajadores de <strong>SEDE CENTRAL</strong> o <strong>AGENCIA AGRARIA</strong> registrar asistencia válidamente en otra dependencia por comisión de servicios, apoyo técnico o supervisión.
              </p>
            </div>

            {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
              <button
                onClick={() => {
                  setAuthEmpDni(employees[0]?.dni || '');
                  setAuthDepAutorizada('AGENCIA_AGRARIA');
                  setAuthDeviceId('');
                  setAuthStartDate(new Date().toISOString().split('T')[0]);
                  setAuthEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                  setAuthMotivo('Comisión de servicios');
                  setAuthDocumento('Memorando N° 142-2026-GR.CAJ/DRA-RRHH');
                  setAuthError(null);
                  setShowAuthModal(true);
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Autorización</span>
              </button>
            )}
          </div>

          <AdvancedSearchFilter
            searchTerm={authSearchTerm}
            onSearchChange={(val) => {
              setAuthSearchTerm(val);
              setAuthCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar por colaborador, DNI, documento de sustento o motivo..."
            activeFilterCount={(authStatusFilter !== 'ALL' ? 1 : 0) + (authDepFilter !== 'ALL' ? 1 : 0)}
            onResetFilters={() => {
              setAuthSearchTerm('');
              setAuthStatusFilter('ALL');
              setAuthDepFilter('ALL');
              setAuthCurrentPage(1);
            }}
          >
            <FilterField label="Estado">
              <FilterSelect
                value={authStatusFilter}
                onChange={(val) => {
                  setAuthStatusFilter(val);
                  setAuthCurrentPage(1);
                }}
                placeholder="Todos los Estados"
                options={[
                  { value: 'ACTIVA', label: '🟢 Activa' },
                  { value: 'REVOCADA', label: '🔴 Revocada' },
                  { value: 'VENCIDA', label: '⚪ Vencida' },
                ]}
              />
            </FilterField>

            <FilterField label="Dependencia Autorizada">
              <FilterSelect
                value={authDepFilter}
                onChange={(val) => {
                  setAuthDepFilter(val);
                  setAuthCurrentPage(1);
                }}
                placeholder="Todas las Dependencias"
                options={[
                  { value: 'SEDE_CENTRAL', label: '🏢 SEDE CENTRAL' },
                  { value: 'AGENCIA_AGRARIA', label: '🌾 AGENCIA AGRARIA' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {filteredAuthorizations.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No se encontraron autorizaciones temporales"
              description="No hay excepciones de marcación registradas que coincidan con los filtros seleccionados."
              isFiltered={Boolean(authSearchTerm.trim()) || authStatusFilter !== 'ALL' || authDepFilter !== 'ALL'}
              onAction={() => {
                setAuthSearchTerm('');
                setAuthStatusFilter('ALL');
                setAuthDepFilter('ALL');
              }}
            />
          ) : (
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Colaborador / DNI</th>
                      <th className="px-4 py-3">Dependencia Origen</th>
                      <th className="px-4 py-3">Dependencia Autorizada</th>
                      <th className="px-4 py-3">Marcador Específico</th>
                      <th className="px-4 py-3">Periodo Vigencia</th>
                      <th className="px-4 py-3">Documento &amp; Motivo</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-sans">
                    {paginatedAuthorizations.map((auth) => (
                      <tr key={auth.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{auth.employee_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">DNI: {auth.employee_dni} • {auth.employee_cargo}</div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">
                            {auth.dependencia_origen_name}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                            auth.dependencia_autorizada_tipo === 'AGENCIA_AGRARIA'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          }`}>
                            {auth.dependencia_autorizada_name}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                          {auth.device_name ? `${auth.device_name} (${auth.device_sn})` : 'Todos los marcadores de la dependencia'}
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px]">
                          <div className="text-emerald-400 font-semibold">{auth.start_date}</div>
                          <div className="text-slate-400">al {auth.end_date}</div>
                        </td>

                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-semibold text-slate-200 text-[11px] flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{auth.documento_autorizacion}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5" title={auth.motivo}>
                            {auth.motivo}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {auth.status === 'ACTIVA' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              ACTIVA
                            </span>
                          )}
                          {auth.status === 'REVOCADA' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              REVOCADA
                            </span>
                          )}
                          {auth.status === 'VENCIDA' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-400 border border-slate-700">
                              VENCIDA
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {auth.status === 'ACTIVA' && (activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
                            <button
                              onClick={() => handleRevokeAuth(auth)}
                              className="px-2 py-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded font-semibold text-[10px] transition-colors"
                            >
                              Revocar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DataTablePagination
                currentPage={authCurrentPage}
                pageSize={authPageSize}
                totalItems={filteredAuthorizations.length}
                onPageChange={setAuthCurrentPage}
                onPageSizeChange={(newSize) => {
                  setAuthPageSize(newSize);
                  setAuthCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT DEVICE & STRICT DEPENDENCIA SELECTION */}
      {/* ========================================================= */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                {editingDevice ? 'Editar Marcador Biométrico ZKTeco' : 'Registrar Nuevo Marcador ZKTeco'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDeviceModal(false)}
                disabled={isSubmitting}
                className="text-slate-500 hover:text-white disabled:opacity-50"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ERROR BANNER IF PERSISTENCE / VALIDATION FAILS */}
            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/60 rounded-lg text-rose-200 flex items-start gap-2.5 shadow-md animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-xs text-rose-300">Error al guardar marcador:</p>
                  <p className="text-xs text-rose-200 mt-0.5">{formError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-400 hover:text-white p-0.5 rounded"
                  title="Cerrar advertencia"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleDeviceSubmit} className="space-y-3">
              {/* Device Identification */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Nombre del Marcador *</label>
                  <input
                    type="text"
                    placeholder="Marcador ZKTeco 001"
                    value={deviceName}
                    onChange={(e) => {
                      setDeviceName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Número de Serie (S/N) *</label>
                  <input
                    type="text"
                    placeholder="ZK-G3-001"
                    value={serialNumber}
                    onChange={(e) => {
                      setSerialNumber(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono uppercase focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* Brand and Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Marca *</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none font-bold text-indigo-300 disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Modelo ZKTeco *</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none font-mono disabled:opacity-50"
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
                      disabled={isSubmitting}
                      className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded mt-1 font-mono disabled:opacity-50"
                      required
                    />
                  )}
                </div>
              </div>

              {/* IP Address and Port */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Dirección IP (IPv4) *</label>
                  <input
                    type="text"
                    placeholder="192.168.1.201"
                    value={ipAddress}
                    onChange={(e) => {
                      setIpAddress(e.target.value);
                      setTestResult(null);
                      setHasPassedTest(false);
                      if (formError) setFormError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Puerto de Comunicación *</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => {
                      setPort(Number(e.target.value));
                      setTestResult(null);
                      setHasPassedTest(false);
                      if (formError) setFormError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* MANDATORY DEPENDENCIA SELECTION & LOCATION */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Dependencia <span className="text-rose-400 font-bold">*</span>
                  </label>
                  <select
                    value={selectedDepId}
                    onChange={(e) => {
                      setSelectedDepId(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none text-xs disabled:opacity-50 font-semibold"
                    required
                  >
                    <option value="" disabled>
                      [ Seleccionar dependencia ▼ ]
                    </option>
                    <option value="dep-01">SEDE CENTRAL</option>
                    <option value="dep-02">AGENCIA AGRARIA</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cada marcador está vinculado a una sola dependencia existente.
                  </p>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Ubicación Física *</label>
                  <input
                    type="text"
                    placeholder="Puerta Principal - Recepción Sede"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* INDEPENDENT CONNECTION TEST SECTION (OPTIONAL) */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Plug className="w-3.5 h-3.5 text-indigo-400" />
                    Diagnóstico de Enlace Socket TCP (Opcional)
                  </span>
                  <span className="text-[10px] text-slate-500">Puerto predeterminado: 4370</span>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnectionModal}
                  disabled={isModalTesting || isSubmitting || !ipAddress.trim() || !port}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 rounded font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-mono"
                >
                  {isModalTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                      <span>Probando socket TCP con {ipAddress}:{port}...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Probar Conexión Socket TCP</span>
                    </>
                  )}
                </button>
              </div>

              {/* CONNECTION TEST RESULT BANNER & DETAILS */}
              {isModalTesting && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2 font-mono animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando paquete socket TCP a {ipAddress}:{port} ({model})... Por favor espere.</span>
                </div>
              )}

              {testResult && !isModalTesting && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-2 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs">
                    <div className="flex items-center gap-1.5">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-emerald-400">✓ Conexión exitosa</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="text-rose-400">✕ Conexión no alcanzada</span>
                        </>
                      )}
                    </div>
                    <span className="text-[10px] font-mono opacity-80">{testResult.model || model}</span>
                  </div>

                  <p className="font-medium text-slate-200 text-[11px]">
                    {testResult.message}
                  </p>

                  <div className="bg-[#090A0D]/80 p-2 rounded border border-slate-800/80 space-y-1 font-mono text-[10px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estado Diagnóstico:</span>
                      <span className={testResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {testResult.success ? '🟢 Conectado (ONLINE)' : '🔴 Sin respuesta (OFFLINE)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dirección / Puerto:</span>
                      <span>{testResult.ip}:{testResult.port}</span>
                    </div>
                    {testResult.success && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Latencia de Red (RTT):</span>
                        <span className="text-emerald-400 font-bold">{testResult.latency_ms} ms</span>
                      </div>
                    )}
                    {!testResult.success && testResult.cause && (
                      <div className="pt-1 border-t border-slate-800/60 text-rose-300">
                        <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase tracking-wider mb-0.5">
                          Diagnóstico:
                        </span>
                        <span className="font-normal text-rose-200">{testResult.cause}</span>
                      </div>
                    )}
                  </div>

                  {!testResult.success && (
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded p-2 space-y-1.5">
                      <div className="flex items-start gap-1.5 text-amber-300 text-[10px]">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">¿El marcador está en red local (LAN/Intranet)?</p>
                          <p className="text-slate-300 text-[10px]">
                            Puede validar el enlace local o guardar el marcador directamente.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAuthorizeManualConnection}
                        className="w-full py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded font-bold text-[10px] transition-colors flex items-center justify-center gap-1 font-mono"
                      >
                        <Check className="w-3 h-3" />
                        <span>Validar Enlace de Red Local (LAN)</span>
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

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDeviceModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded font-semibold text-xs disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Guardando marcador...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar marcador</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SIMULATE PUNCH PUSH WITH REAL-TIME DEPENDENCY CHECK */}
      {/* ========================================================= */}
      {showPunchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handlePunchSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                Transmitir Marcación ADMS en Vivo (Validación Automática)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPunchModal(false);
                  setPunchResultAlert(null);
                }}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PUNCH RESULT ALERT */}
            {punchResultAlert && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1 ${
                  punchResultAlert.status === 'VALIDA'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : punchResultAlert.status === 'EXCEPCION_AUTORIZADA'
                    ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {punchResultAlert.status === 'VALIDA' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {punchResultAlert.status === 'EXCEPCION_AUTORIZADA' && <ShieldCheck className="w-4 h-4 text-indigo-400" />}
                  {punchResultAlert.status === 'RECHAZADA_DEPENDENCIA' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
                  <span>{punchResultAlert.message}</span>
                </div>
                {punchResultAlert.details && (
                  <p className="text-[11px] opacity-90">{punchResultAlert.details}</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Seleccionar Colaborador</label>
                <select
                  value={selectedEmpDni}
                  onChange={(e) => {
                    setSelectedEmpDni(e.target.value);
                    setPunchResultAlert(null);
                  }}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  {employees.map((e) => {
                    const depName = e.dependencia_id === 'dep-02' || e.dependencia_name?.toUpperCase().includes('AGENCIA')
                      ? 'AGENCIA AGRARIA'
                      : 'SEDE CENTRAL';
                    return (
                      <option key={e.id} value={e.dni}>
                        {e.first_name} {e.last_name} (DNI: {e.dni}) - {depName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Reloj Biométrico ZKTeco de Origen</label>
                <select
                  value={selectedDeviceSn}
                  onChange={(e) => {
                    setSelectedDeviceSn(e.target.value);
                    setPunchResultAlert(null);
                  }}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  {devices.map((d) => {
                    const depName = d.dependencia_tipo === 'AGENCIA_AGRARIA' || d.dependencia_name?.toUpperCase().includes('AGENCIA')
                      ? 'AGENCIA AGRARIA'
                      : 'SEDE CENTRAL';
                    return (
                      <option key={d.id} value={d.serial_number}>
                        {d.name} ({d.serial_number}) - {depName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* REAL-TIME PREVIEW OF DEPENDENCY COMPARISON */}
              <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-2">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Evaluación Previa de Regla Institucional:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Dependencia Colaborador:</span>
                    <span className={`font-bold ${currentPunchEmpDep === 'AGENCIA AGRARIA' ? 'text-amber-400' : 'text-indigo-400'}`}>
                      {currentPunchEmpDep}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Dependencia Marcador:</span>
                    <span className={`font-bold ${currentPunchDevDep === 'AGENCIA AGRARIA' ? 'text-amber-400' : 'text-indigo-400'}`}>
                      {currentPunchDevDep}
                    </span>
                  </div>
                </div>

                <div className="pt-1 text-[11px]">
                  {currentPunchEmpDep === currentPunchDevDep ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Coincidencia directa: Asistencia Válida</span>
                    </div>
                  ) : currentActiveAuth ? (
                    <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Excepción Autorizada: {currentActiveAuth.documento_autorizacion}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Conflicto de Dependencia: Marcación será RECHAZADA (Incidencia)</span>
                    </div>
                  )}
                </div>
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
                onClick={() => {
                  setShowPunchModal(false);
                  setPunchResultAlert(null);
                }}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Marcación ADMS</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NEW PUNCH TEMPORAL AUTHORIZATION */}
      {/* ========================================================= */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveAuth}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Registrar Autorización Temporal de Marcación Inter-Sede
              </h3>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                disabled={isSubmittingAuth}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/60 rounded-lg text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-xs text-rose-300">Error en el registro:</p>
                  <p className="text-xs text-rose-200">{authError}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Employee Selection */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Colaborador Asignado *</label>
                <select
                  value={authEmpDni}
                  onChange={(e) => setAuthEmpDni(e.target.value)}
                  disabled={isSubmittingAuth}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="" disabled>Seleccione un trabajador...</option>
                  {employees.map((e) => {
                    const depName = e.dependencia_id === 'dep-02' || e.dependencia_name?.toUpperCase().includes('AGENCIA')
                      ? 'AGENCIA AGRARIA'
                      : 'SEDE CENTRAL';
                    return (
                      <option key={e.id} value={e.dni}>
                        {e.first_name} {e.last_name} (DNI: {e.dni}) - {depName} ({e.cargo})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Dependencia Autorizada */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Dependencia Autorizada *</label>
                  <select
                    value={authDepAutorizada}
                    onChange={(e) => setAuthDepAutorizada(e.target.value as 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA')}
                    disabled={isSubmittingAuth}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none font-semibold"
                    required
                  >
                    <option value="SEDE_CENTRAL">SEDE CENTRAL</option>
                    <option value="AGENCIA_AGRARIA">AGENCIA AGRARIA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Marcador Específico (Opcional)</label>
                  <select
                    value={authDeviceId}
                    onChange={(e) => setAuthDeviceId(e.target.value)}
                    disabled={isSubmittingAuth}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Todos los marcadores de la dependencia</option>
                    {devices
                      .filter((d) => (authDepAutorizada === 'AGENCIA_AGRARIA' ? d.dependencia_tipo === 'AGENCIA_AGRARIA' : d.dependencia_tipo !== 'AGENCIA_AGRARIA'))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.serial_number})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Dates Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Fecha de Inicio *</label>
                  <input
                    type="date"
                    value={authStartDate}
                    onChange={(e) => setAuthStartDate(e.target.value)}
                    disabled={isSubmittingAuth}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Fecha de Término *</label>
                  <input
                    type="date"
                    value={authEndDate}
                    onChange={(e) => setAuthEndDate(e.target.value)}
                    disabled={isSubmittingAuth}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Documento de Sustento */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Documento de Autorización / Memorando *</label>
                <input
                  type="text"
                  placeholder="Memorando N° 142-2026-GR.CAJ/DRA-RRHH"
                  value={authDocumento}
                  onChange={(e) => setAuthDocumento(e.target.value)}
                  disabled={isSubmittingAuth}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Motivo de la Autorización *</label>
                <textarea
                  rows={2}
                  placeholder="Comisión de servicios, apoyo técnico en agencia agraria, etc."
                  value={authMotivo}
                  onChange={(e) => setAuthMotivo(e.target.value)}
                  disabled={isSubmittingAuth}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                disabled={isSubmittingAuth}
                className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold text-xs disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingAuth ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Autorización</span>
                  </>
                )}
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
