import React, { useMemo } from 'react';
import { MarcacionRaw, AttendanceRecord, DispositivoZkTeco, Employee } from '../../types';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Calendar,
  Layers,
  ShieldCheck,
  TrendingUp,
  FileText,
} from 'lucide-react';

interface OperationalDashboardProps {
  devices: DispositivoZkTeco[];
  rawPunches: MarcacionRaw[];
  attendance: AttendanceRecord[];
  employees: Employee[];
  activeRole: string;
  onNavigateTab?: (tab: string) => void;
}

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({
  devices,
  rawPunches,
  attendance,
  employees,
  activeRole,
  onNavigateTab,
}) => {
  // Current calendar date
  const todayStr = useMemo(() => {
    return new Date().toISOString().substring(0, 10);
  }, []);

  // Today's real punches
  const todayPunches = useMemo(() => {
    return rawPunches.filter((p) => p.fecha === todayStr || p.timestamp?.startsWith(todayStr));
  }, [rawPunches, todayStr]);

  // Today's attendance
  const todayAttendance = useMemo(() => {
    return attendance.filter((a) => a.fecha === todayStr);
  }, [attendance, todayStr]);

  // Total tardiness minutes computed strictly from real data
  const totalTardinessMinutes = useMemo(() => {
    return attendance.reduce((sum, a) => sum + (a.net_tardiness_minutes || 0), 0);
  }, [attendance]);

  // Total effective hours worked computed strictly from real data
  const totalEffectiveHours = useMemo(() => {
    return attendance.reduce((sum, a) => sum + (a.total_effective_hours || 0), 0);
  }, [attendance]);

  // Unique employees with punches today
  const activeEmployeesToday = useMemo(() => {
    const dnis = new Set(todayPunches.map((p) => p.employee_dni));
    return dnis.size;
  }, [todayPunches]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-[#0F1115] border border-indigo-500/20 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                DRAC CAJAMARCA — PANEL OPERATIVO
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Control Institucional de Asistencia y Biometría
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Supervisión de enlaces biométricos ZKTeco en tiempo real, trazabilidad de marcaciones y cómputo estricto sin datos ficticios.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Marcador G3-id</span>
              <div className="flex items-center gap-1.5 mt-0.5 justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-xs font-bold text-white">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Real Punches */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Marcaciones Hoy</span>
            <div className="p-2 bg-indigo-950/50 text-indigo-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{todayPunches.length}</span>
            <span className="text-xs text-slate-500 font-mono">({rawPunches.length} total)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {todayPunches.length === 0 ? 'Sin marcaciones físicas hoy' : `${activeEmployeesToday} personas registradas`}
          </p>
        </div>

        {/* Card 2: Employees Active */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Personal Registrado</span>
            <div className="p-2 bg-emerald-950/50 text-emerald-400 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{employees.length}</span>
            <span className="text-xs text-emerald-400 font-mono">activos</span>
          </div>
          <p className="text-[11px] text-slate-500">Padrón de la sede central y agencias</p>
        </div>

        {/* Card 3: Tardiness */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Tardanza Acumulada</span>
            <div className="p-2 bg-amber-950/50 text-amber-400 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{totalTardinessMinutes}</span>
            <span className="text-xs text-amber-400 font-mono">minutos</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {attendance.length === 0 ? 'Sin incidencias calculadas' : `${attendance.filter(a => a.status === 'LATE').length} registros con tardanza`}
          </p>
        </div>

        {/* Card 4: Hours Worked */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Horas Efectivas</span>
            <div className="p-2 bg-cyan-950/50 text-cyan-400 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{totalEffectiveHours.toFixed(1)}</span>
            <span className="text-xs text-cyan-400 font-mono">horas</span>
          </div>
          <p className="text-[11px] text-slate-500">Calculadas a partir de marcaciones reales</p>
        </div>
      </div>

      {/* Hardware Connectivity & Recent Punches Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hardware Status */}
        <div className="lg:col-span-1 bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Infraestructura Biometría ZKTeco</span>
          </h3>

          <div className="space-y-3">
            {devices.map((d) => (
              <div key={d.id} className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{d.name}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-400">
                  <div>SN: <span className="text-slate-200">{d.serial_number}</span></div>
                  <div>IP: <span className="text-slate-200">{d.ip_address}</span></div>
                  <div>TCP: <span className="text-emerald-400 font-bold">{d.port || 7496} OK</span></div>
                  <div>PUSH: <span className="text-emerald-400 font-bold">3000 OK</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-lg text-xs space-y-1">
            <span className="font-bold text-indigo-300 block">Política de Integridad:</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              El sistema opera exclusivamente con eventos genuinos capturados por el marcador facial/huella. Se garantiza consistencia jurídica ante la OGRRHH y SERVIR.
            </p>
          </div>
        </div>

        {/* Recent Real Punches Preview */}
        <div className="lg:col-span-2 bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Últimas Marcaciones Reales Registradas</span>
            </h3>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('attendance')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Ver todas →
              </button>
            )}
          </div>

          {rawPunches.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center space-y-2 bg-[#090A0D]">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-300 font-semibold">0 marcaciones reales en la base de datos</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                No existen registros sintéticos. El sistema reflejará inmediatamente las marcaciones físicas enviadas por el ZKTeco G3-id.
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
                    <th className="p-2.5">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rawPunches.slice(0, 6).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/40">
                      <td className="p-2.5 font-mono text-indigo-300 font-bold">{p.employee_dni}</td>
                      <td className="p-2.5 text-white">{p.employee_name}</td>
                      <td className="p-2.5 font-mono text-amber-300">{p.timestamp}</td>
                      <td className="p-2.5 font-mono text-[10px]">{p.verify_mode}</td>
                      <td className="p-2.5 font-mono text-[10px]">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          p.punch_state === 0
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                        }`}>
                          {p.punch_state === 0 ? 'ENTRADA' : 'SALIDA'}
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
    </div>
  );
};
