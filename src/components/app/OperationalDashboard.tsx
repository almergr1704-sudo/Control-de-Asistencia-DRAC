import React from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Palmtree,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import {
  AsistenciaProcesada,
  Employee,
  PapeletaSalida,
  Vacacion,
  RoleType,
} from '../../types';

interface OperationalDashboardProps {
  attendance: AsistenciaProcesada[];
  employees: Employee[];
  papeletas: PapeletaSalida[];
  vacaciones: Vacacion[];
  activeRole: RoleType;
  onNavigate: (viewId: string) => void;
}

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({
  attendance,
  employees,
  papeletas,
  vacaciones,
  activeRole,
  onNavigate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Live operational calculations
  const totalEmployees = employees.length;

  const todayAttendance = attendance.filter((a) => a.fecha === todayStr || a.fecha === '2026-08-12');
  const presentCount = todayAttendance.filter((a) => a.status === 'PUNCTUAL' || a.status === 'LATE').length;
  const lateCount = todayAttendance.filter((a) => a.status === 'LATE').length;
  const absentCount = todayAttendance.filter((a) => a.status === 'ABSENT').length;

  const pendingPapeletas = papeletas.filter(
    (p) => p.status === 'PENDING_BOSS' || p.status === 'PENDING_HR'
  );

  const activeVacations = vacaciones.filter((v) => v.status === 'APPROVED');

  const outsideGarita = papeletas.filter((p) => p.status === 'EXIT_CHECKED');
  const pendingReturns = papeletas.filter((p) => p.status === 'EXIT_CHECKED');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0B0D12] to-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              Dirección Regional de Agricultura Cajamarca (DRAC)
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Panel Operativo de Control de Asistencia, Personal, Papeletas y Vigilancia
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#060709] px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span>Fecha Operativa: {todayStr}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Personal Presente */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Personal Presente Hoy</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{presentCount}</span>
            <span className="text-xs text-slate-500">de {totalEmployees} registrados</span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-400/90 flex items-center gap-1 font-medium">
            <span>{presentCount > 0 ? 'Registros de asistencia activos' : 'Sin asistencias aún'}</span>
          </div>
        </div>

        {/* Tardanzas */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tardanzas Detectadas</span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{lateCount}</span>
            <span className="text-xs text-slate-500">colaboradores</span>
          </div>
          <div className="mt-2 text-[10px] text-amber-400/90 flex items-center gap-1 font-medium">
            <span>Sujeto a tolerancia de turno</span>
          </div>
        </div>

        {/* Papeletas Pendientes */}
        <div
          onClick={() => onNavigate('papeletas_pending')}
          className="bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all rounded-xl p-4 shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Papeletas Pendientes</span>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{pendingPapeletas.length}</span>
            <span className="text-xs text-slate-500">por aprobar</span>
          </div>
          <div className="mt-2 text-[10px] text-indigo-400 flex items-center gap-1 font-medium">
            <span>Requieren VoBo Inmediato</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        {/* Garita - Personal Fuera */}
        <div
          onClick={() => onNavigate('security_outside')}
          className="bg-slate-900/40 border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-all rounded-xl p-4 shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Personal Fuera (Garita)</span>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{outsideGarita.length}</span>
            <span className="text-xs text-slate-500">en comisión / salida</span>
          </div>
          <div className="mt-2 text-[10px] text-purple-300 flex items-center gap-1 font-medium">
            <span>Retornos pendientes: {pendingReturns.length}</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Main Operational Tables / Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Pending Papeletas for Immediate Attention */}
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h2 className="font-bold text-sm text-white">Solicitudes de Papeleta Pendientes</h2>
            </div>
            <button
              onClick={() => onNavigate('papeletas_pending')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <span>Ver Todas</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {pendingPapeletas.length === 0 ? (
            <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
              <CheckCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
              <span className="text-[11px] text-slate-500">Todas las papeletas han sido procesadas.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingPapeletas.slice(0, 4).map((pap) => (
                <div
                  key={pap.id}
                  className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{pap.employee_name}</div>
                    <div className="text-[11px] text-slate-400">
                      Motivo: <span className="text-slate-300">{pap.reason}</span> ({pap.type})
                    </div>
                    <div className="text-[10px] text-indigo-400 font-mono mt-0.5">
                      Horario: {pap.start_time} a {pap.end_time} ({pap.fecha})
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded font-semibold text-[10px]">
                    {pap.status === 'PENDING_BOSS' ? 'VoBo Jefe' : 'Pendiente RRHH'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 2: Vigilancia & Security Garita Status */}
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">Garita & Control de Salidas DRAC</h2>
            </div>
            <button
              onClick={() => onNavigate('security_outside')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <span>Ver Garita</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {outsideGarita.length === 0 ? (
            <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
              <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
              <span className="text-[11px] text-slate-500">No hay personal fuera de la institución con papeleta activa.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {outsideGarita.slice(0, 4).map((pap) => (
                <div
                  key={pap.id}
                  className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{pap.employee_name}</div>
                    <div className="text-[11px] text-purple-300">
                      Salida Registrada: <span className="font-mono">{pap.real_exit_time}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-purple-950 text-purple-300 border border-purple-800/50 rounded font-semibold text-[10px]">
                    Retorno Pendiente
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Direct Module Shortcuts */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5">
        <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-3">Acceso Rápido Operativo</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('attendance_list')}
            className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-all"
          >
            <Users className="w-4 h-4 text-indigo-400 mb-1" />
            <span className="text-xs font-bold text-white block">Control Asistencia</span>
            <span className="text-[10px] text-slate-400 block">Marcaciones e incidencias</span>
          </button>

          <button
            onClick={() => onNavigate('personnel_list')}
            className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-all"
          >
            <Building2 className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-xs font-bold text-white block">Directorio Personal</span>
            <span className="text-[10px] text-slate-400 block">Personal y estructura</span>
          </button>

          <button
            onClick={() => onNavigate('shifts_turnos')}
            className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-all"
          >
            <Clock className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-xs font-bold text-white block">Turnos & Horarios</span>
            <span className="text-[10px] text-slate-400 block">Jornadas y tolerancias</span>
          </button>

          <button
            onClick={() => onNavigate('vacations_requests')}
            className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-all"
          >
            <Palmtree className="w-4 h-4 text-teal-400 mb-1" />
            <span className="text-xs font-bold text-white block">Vacaciones</span>
            <span className="text-[10px] text-slate-400 block">Solicitudes y periodos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
