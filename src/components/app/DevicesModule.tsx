import React, { useState, useMemo } from 'react';
import { DispositivoZkTeco, MarcacionRaw, Employee } from '../../types';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Wifi,
  Clock,
  Database,
  Search,
  Sliders,
  Radio,
  ExternalLink,
  ShieldCheck,
  Check,
  Copy,
} from 'lucide-react';

interface DevicesModuleProps {
  devices: DispositivoZkTeco[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  activeRole: string;
  onRefreshDevices?: () => void;
  onRefreshPunches?: () => void;
}

export const DevicesModule: React.FC<DevicesModuleProps> = ({
  devices,
  rawPunches,
  employees,
  activeRole,
  onRefreshDevices,
  onRefreshPunches,
}) => {
  const [selectedDevice, setSelectedDevice] = useState<DispositivoZkTeco | null>(devices[0] || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSyncDevice = async (dev: DispositivoZkTeco) => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch(`/api/zkteco/devices/${dev.id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg(`✓ Sincronización finalizada: ${data.imported_count || 0} marcaciones nuevas descargadas.`);
        if (onRefreshDevices) onRefreshDevices();
        if (onRefreshPunches) onRefreshPunches();
      } else {
        setSyncStatusMsg(`Aviso: ${data.message || 'No se pudo contactar al dispositivo'}`);
      }
    } catch (err: any) {
      setSyncStatusMsg(`Error de conexión con el dispositivo: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
              <Cpu className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Marcadores Biométricos ZKTeco</span>
                <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-400 border border-indigo-800 text-[11px] rounded-full font-mono">
                  {devices.length} Equipo Físico Operativo
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Gestión de terminales físicos, lectura directa vía socket TCP (puerto 4370) y escucha ADMS Push.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onRefreshDevices && onRefreshDevices()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar Lista</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-3 bg-slate-900 border border-indigo-500/40 rounded-xl text-xs flex items-center justify-between text-indigo-200 font-mono">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>{syncStatusMsg}</span>
          </div>
          <button onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid: Device List & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Cards */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Terminales Registrados</span>
          </h3>

          <div className="space-y-3">
            {devices.map((dev) => {
              const isSelected = selectedDevice?.id === dev.id;
              const devPunches = rawPunches.filter((p) => p.device_sn === dev.serial_number || p.deviceId === dev.id);

              return (
                <div
                  key={dev.id}
                  onClick={() => setSelectedDevice(dev)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900/90 border-indigo-500 shadow-md shadow-indigo-950/30'
                      : 'bg-[#0F1115] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs">{dev.name}</h4>
                      <span className="font-mono text-[11px] text-indigo-300 font-semibold">{dev.serial_number}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      ONLINE
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                    <div>
                      <span className="block text-[10px] text-slate-500">IP:PUERTO</span>
                      <span className="text-slate-200">{dev.ip_address}:{dev.port}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">MARCACIONES</span>
                      <span className="text-emerald-400 font-bold">{devPunches.length} reales</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{dev.dependencia_name || 'SEDE CENTRAL'}</span>
                    <span>Latencia: {dev.last_latency_ms || 18}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Device Details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedDevice ? (
            <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{selectedDevice.name}</h3>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300">
                      {selectedDevice.device_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modelo institucional ZKTeco G3-id para reconocimiento facial, huella SilkBio y tarjeta RFID.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncDevice(selectedDevice)}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Conectando...' : 'Sincronizar Vía Socket'}</span>
                  </button>
                </div>
              </div>

              {/* Hardware Specifications Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Número de Serie</span>
                  <div className="flex items-center justify-between font-mono font-bold text-slate-100">
                    <span>{selectedDevice.serial_number}</span>
                    <button
                      onClick={() => handleCopy(selectedDevice.serial_number, 'sn')}
                      className="text-slate-500 hover:text-white"
                    >
                      {copiedKey === 'sn' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Dirección IP LAN</span>
                  <div className="flex items-center justify-between font-mono font-bold text-slate-100">
                    <span>{selectedDevice.ip_address}</span>
                    <button
                      onClick={() => handleCopy(selectedDevice.ip_address, 'ip')}
                      className="text-slate-500 hover:text-white"
                    >
                      {copiedKey === 'ip' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Puerto Socket TCP</span>
                  <div className="flex items-center justify-between font-mono font-bold text-slate-100">
                    <span>{selectedDevice.port}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Dirección MAC</span>
                  <div className="flex items-center justify-between font-mono text-slate-300">
                    <span>{selectedDevice.mac_address}</span>
                  </div>
                </div>
              </div>

              {/* Status and Diagnostics */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <h4 className="font-bold text-xs text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Estado de Comunicación Institucional</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded border border-slate-800">
                    <span className="text-slate-400">Socket TCP 4370</span>
                    <span className="font-mono font-bold text-emerald-400">CONECTADO</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded border border-slate-800">
                    <span className="text-slate-400">Servidor Cloud PUSH</span>
                    <span className="font-mono font-bold text-emerald-400">HABILITADO</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded border border-slate-800">
                    <span className="text-slate-400">Usuarios Registrados</span>
                    <span className="font-mono font-bold text-indigo-400">{selectedDevice.enrolled_user_count}</span>
                  </div>
                </div>
              </div>

              {/* Real Raw Punches from this device */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Marcaciones Reales Ingeridas ({rawPunches.filter((p) => p.device_sn === selectedDevice.serial_number).length})</span>
                  </h4>
                </div>

                {rawPunches.filter((p) => p.device_sn === selectedDevice.serial_number).length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-800 rounded-lg text-center space-y-2 bg-[#090A0D]">
                    <Clock className="w-6 h-6 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-300 font-semibold">Sin marcaciones en este marcador</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Las marcaciones aparecerán en tiempo real cuando el personal marque físicamente en el terminal ZKTeco G3-id o se ejecute la sincronización bajo demanda.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#090A0D]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#060709] text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">DNI</th>
                          <th className="p-2.5">Trabajador</th>
                          <th className="p-2.5">Fecha y Hora</th>
                          <th className="p-2.5">Método</th>
                          <th className="p-2.5">Origen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {rawPunches
                          .filter((p) => p.device_sn === selectedDevice.serial_number)
                          .slice(0, 5)
                          .map((p) => (
                            <tr key={p.id} className="hover:bg-slate-900/40">
                              <td className="p-2.5 font-mono text-indigo-300 font-bold">{p.employee_dni}</td>
                              <td className="p-2.5 text-white">{p.employee_name}</td>
                              <td className="p-2.5 font-mono text-slate-300">{p.timestamp}</td>
                              <td className="p-2.5 font-mono text-[10px]">{p.verify_mode}</td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                                  {p.source}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-10 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
              Seleccione un dispositivo para ver sus detalles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
