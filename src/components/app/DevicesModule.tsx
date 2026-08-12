import React, { useState } from 'react';
import { DispositivoZkTeco, MarcacionRaw, Employee, RoleType } from '../../types';
import { Cpu, Plus, Wifi, RefreshCw, Send, CheckCircle, AlertTriangle, Edit2, Trash2, X } from 'lucide-react';

interface DevicesModuleProps {
  devices: DispositivoZkTeco[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  activeRole: RoleType;
  onAddDevice: (newDevice: Omit<DispositivoZkTeco, 'id' | 'last_activity' | 'status'>) => void;
  onEditDevice: (device: DispositivoZkTeco) => void;
  onDeleteDevice: (deviceId: string) => void;
  onSimulatePunch: (newPunch: Omit<MarcacionRaw, 'id' | 'processed' | 'processed_at'>) => void;
}

export const DevicesModule: React.FC<DevicesModuleProps> = ({
  devices,
  rawPunches,
  employees,
  activeRole,
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onSimulatePunch,
}) => {
  const [activeTab, setActiveTab] = useState<'DEVICES' | 'RAW_PUNCHES'>('DEVICES');

  // Modal State: Devices
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DispositivoZkTeco | null>(null);

  // Form State: Device
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.1.100');
  const [port, setPort] = useState(4370);
  const [location, setLocation] = useState('Puerta Principal - Recepción');

  // Modal State: Punch Manual Test / Push
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [selectedEmpDni, setSelectedEmpDni] = useState(employees[0]?.dni || '71234567');
  const [selectedDeviceSn, setSelectedDeviceSn] = useState(devices[0]?.serial_number || 'ZK-88201');
  const [punchTime, setPunchTime] = useState('08:02:15');
  const [punchType, setPunchType] = useState<0 | 1>(0); // 0: IN, 1: OUT

  // Device Handlers
  const handleOpenAddDevice = () => {
    setEditingDevice(null);
    setSerialNumber('');
    setDeviceName('');
    setIpAddress('192.168.1.100');
    setPort(4370);
    setLocation('Puerta Principal - Recepción');
    setShowAddDeviceModal(true);
  };

  const handleOpenEditDevice = (dev: DispositivoZkTeco) => {
    setEditingDevice(dev);
    setSerialNumber(dev.serial_number);
    setDeviceName(dev.name);
    setIpAddress(dev.ip_address);
    setPort(dev.port);
    setLocation(dev.location_detail);
    setShowAddDeviceModal(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber || !deviceName) return;

    if (editingDevice) {
      onEditDevice({
        ...editingDevice,
        serial_number: serialNumber.toUpperCase().trim(),
        name: deviceName.trim(),
        ip_address: ipAddress.trim(),
        port: Number(port),
        location_detail: location.trim(),
      });
    } else {
      onAddDevice({
        serial_number: serialNumber.toUpperCase().trim(),
        name: deviceName.trim(),
        ip_address: ipAddress.trim(),
        port: Number(port),
        protocol: 'PUSH_ADMS',
        area_id: 'area-1',
        area_name: 'Operaciones',
        location_detail: location.trim(),
        firmware_version: 'Ver 8.0.4.3-2025',
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
              Gestión de Marcadores Biométricos (ZKTeco ADMS) &amp; Staging Logs
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Recepción e integración de logs en tiempo real vía protocolo ADMS / Push SDK de dispositivos físicos.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((d) => (
            <div
              key={d.id}
              className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-indigo-400">{d.serial_number}</span>
                  <div className="flex items-center gap-2">
                    {d.status === 'ONLINE' ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded flex items-center gap-1 font-mono">
                        <Wifi className="w-3 h-3" /> ONLINE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded flex items-center gap-1 font-mono">
                        OFFLINE
                      </span>
                    )}

                    {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditDevice(d)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded"
                          title="Editar Dispositivo"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Desea dar de baja el marcador ${d.name}?`)) {
                              onDeleteDevice(d.id);
                            }
                          }}
                          className="p-1 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded"
                          title="Eliminar Dispositivo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-sm text-white mb-1">{d.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{d.location_detail}</p>

                <div className="bg-[#090A0D] p-3 rounded border border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>IP / Puerto:</span>
                    <span className="text-slate-200">{d.ip_address}:{d.port}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Protocolo SDK:</span>
                    <span className="text-indigo-400 font-bold">{d.protocol}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Firmware ZK:</span>
                    <span className="text-slate-300">{d.firmware_version}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Última Sincronización ADMS:</span>
                <span className="text-slate-300">{d.last_activity}</span>
              </div>
            </div>
          ))}
        </div>
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
                {rawPunches.map((punch) => {
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
                            <CheckCircle className="w-3 h-3" /> PROCESADO (OK)
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
        </div>
      )}

      {/* MODAL: ADD / EDIT DEVICE */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDeviceSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                {editingDevice ? 'Editar Marcador Biométrico ZKTeco' : 'Registrar Nuevo Marcador ZKTeco'}
              </h3>
              <button type="button" onClick={() => setShowAddDeviceModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Número de Serie (SN)</label>
                  <input
                    type="text"
                    placeholder="ZK-99100"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono uppercase focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nombre Descriptivo</label>
                  <input
                    type="text"
                    placeholder="Biométrico Almacén Norte"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Dirección IP</label>
                  <input
                    type="text"
                    placeholder="192.168.1.105"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Puerto ADMS</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ubicación Física</label>
                <input
                  type="text"
                  placeholder="Garita Nro 2 - Acceso Peatonal Planta"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddDeviceModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition-colors shadow-sm"
              >
                {editingDevice ? 'Actualizar Marcador' : 'Guardar Dispositivo'}
              </button>
            </div>
          </form>
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
              <button type="button" onClick={() => setShowPunchModal(false)} className="text-slate-500 hover:text-white">
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
    </div>
  );
};
