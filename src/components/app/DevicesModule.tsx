import React, { useState } from 'react';
import { DispositivoZkTeco, MarcacionRaw, Employee, RoleType, Dependencia, DeviceStatus, DeviceTestRecord } from '../../types';
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
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';

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
  const [model, setModel] = useState('uFace 800');
  const [customModel, setCustomModel] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState(4370);
  const [location, setLocation] = useState('');
  const [selectedDepId, setSelectedDepId] = useState<string>(dependencias[0]?.id || '');

  // Connection Test State inside Modal
  const [isModalTesting, setIsModalTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    message: string;
    cause?: string;
    latency_ms?: number;
    ip: string;
    port: number;
    timestamp: string;
  } | null>(null);
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
    setModel('uFace 800');
    setCustomModel('');
    setIpAddress('');
    setPort(4370);
    setLocation('');
    setSelectedDepId(dependencias[0]?.id || '');
    setTestResult(null);
    setHasPassedTest(false);
    setIsModalTesting(false);
    setShowAddDeviceModal(true);
  };

  // Open Edit Device Modal
  const handleOpenEditDevice = (dev: DispositivoZkTeco) => {
    setEditingDevice(dev);
    setSerialNumber(dev.serial_number);
    setDeviceName(dev.name);
    setBrand(dev.brand || 'ZKTeco');
    setModel(dev.model || 'uFace 800');
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
      timestamp: dev.last_test.date,
    } : null);
    setHasPassedTest(dev.status === 'ONLINE');
    setIsModalTesting(false);
    setShowAddDeviceModal(true);
  };

  // Real Connection Test in Modal
  const handleTestConnectionModal = async () => {
    if (!ipAddress.trim() || !port) return;

    setIsModalTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/zkteco/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: ipAddress.trim(),
          port: Number(port),
          timeoutMs: 4000,
        }),
      });

      const data = await response.json();
      setIsModalTesting(false);
      setTestResult(data);

      if (data.success) {
        setHasPassedTest(true);
      } else {
        setHasPassedTest(false);
      }
    } catch (err: any) {
      setIsModalTesting(false);
      setTestResult({
        success: false,
        status: 'OFFLINE',
        message: 'Conexión fallida',
        cause: err.message || 'Error de red al comunicarse con el servidor backend.',
        ip: ipAddress.trim(),
        port: Number(port),
        timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      });
      setHasPassedTest(false);
    }
  };

  // Real Connection Test from List View
  const handleTestConnectionList = async (dev: DispositivoZkTeco) => {
    setTestingDeviceId(dev.id);

    try {
      const response = await fetch('/api/zkteco/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: dev.ip_address,
          port: dev.port,
          timeoutMs: 4000,
        }),
      });

      const data = await response.json();
      setTestingDeviceId(null);

      const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
      const testRecord: DeviceTestRecord = {
        date: nowStr,
        result: data.success ? 'SUCCESS' : 'FAILED',
        message: data.message,
        cause: data.cause,
        user: 'María Silva (RRHH)',
        latency_ms: data.latency_ms,
        ip: dev.ip_address,
        port: dev.port,
        model: dev.model,
        serial_number: dev.serial_number,
      };

      const updatedDevice: DispositivoZkTeco = {
        ...dev,
        status: data.success ? 'ONLINE' : 'OFFLINE',
        last_activity: nowStr,
        last_test: testRecord,
      };

      onEditDevice(updatedDevice);
    } catch (err: any) {
      setTestingDeviceId(null);
      const nowStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

      const testRecord: DeviceTestRecord = {
        date: nowStr,
        result: 'FAILED',
        message: 'Conexión fallida',
        cause: err.message || 'Error al conectar con la API de prueba.',
        user: 'María Silva (RRHH)',
        ip: dev.ip_address,
        port: dev.port,
        model: dev.model,
        serial_number: dev.serial_number,
      };

      onEditDevice({
        ...dev,
        status: 'OFFLINE',
        last_test: testRecord,
      });
    }
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
        <>
          {devices.length === 0 ? (
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 text-center">
              <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-300">No hay dispositivos biométricos configurados</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Registre los relojes marcadores ZKTeco instalados en la sede central o agencias agrarias para sincronizar marcaciones vía PUSH ADMS.
              </p>
              {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
                <button
                  onClick={handleOpenAddDevice}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Primer Marcador</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((d) => {
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

                      {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
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
                    Última sincronización: {d.last_activity}
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
          )}
        </>
      )}

      {/* RAW PUNCHES STAGING TABLE */}
      {activeTab === 'RAW_PUNCHES' && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Dispositivo SN</th>
                  <th className="px-4 py-3">DNI Empleado / ID Biométrico</th>
                  <th className="px-4 py-3">Timestamp Log Crudo</th>
                  <th className="px-4 py-3">Modo Verificación</th>
                  <th className="px-4 py-3">Estado Punch (ADMS)</th>
                  <th className="px-4 py-3 text-right">Motor Procesamiento ETL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-sans">
                {rawPunches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm font-medium text-slate-400">No hay registros crudos en el staging</p>
                      <p className="text-xs text-slate-600 mt-1">Los fichajes recibidos desde marcadores biométricos se encolarán aquí para su validación.</p>
                    </td>
                  </tr>
                ) : (
                  rawPunches.map((punch) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>
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
                    <option value="uFace 800">uFace 800 (Biométrico Facial + Huella)</option>
                    <option value="K40 Pro">K40 Pro (Control Asistencia Dactilar)</option>
                    <option value="MB20">MB20 (Control Acceso Híbrido)</option>
                    <option value="iClock 880">iClock 880 (Gran Capacidad ADMS)</option>
                    <option value="SilkFP-101TA">SilkFP-101TA (Sensor SilkID)</option>
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
                    placeholder="192.168.1.100"
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
                      <span>🟡 Probando conexión real con {ipAddress}:{port}...</span>
                    </>
                  ) : (
                    <>
                      <Plug className="w-4 h-4" />
                      <span>🔌 Probar Conexión</span>
                    </>
                  )}
                </button>
              </div>

              {/* CONNECTION TEST RESULT BANNER & DETAILS */}
              {isModalTesting && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2 font-mono animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando paquete socket TCP a {ipAddress}:{port}... Por favor espere.</span>
                </div>
              )}

              {testResult && !isModalTesting && (
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
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
                      <div className="pt-1 border-t border-slate-800/60 text-rose-300">
                        <span className="text-slate-400 block font-sans text-[10px]">Causa diagnosticada:</span>
                        <span className="font-semibold">{testResult.cause}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                      <span>Fecha y hora prueba:</span>
                      <span>{testResult.timestamp}</span>
                    </div>
                  </div>
                </div>
              )}
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
                    alert('⚠️ ATENCIÓN: No se puede activar el marcador como "Conectado" sin haber realizado primero una prueba de conexión exitosa.\n\nPor favor presione "🔌 Probar Conexión" para verificar el equipo en vivo o elija "Guardar como Configurado".');
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
