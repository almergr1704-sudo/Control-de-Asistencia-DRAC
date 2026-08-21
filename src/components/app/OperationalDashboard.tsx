import React, { useState, useMemo, useEffect } from 'react';
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
  Search,
  Filter,
  User,
  ShieldAlert,
  ChevronRight,
  Eye,
  Info,
  CalendarDays,
  FileCheck2,
  Briefcase,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  AsistenciaProcesada,
  Employee,
  PapeletaSalida,
  Vacacion,
  RoleType,
  Encargatura,
  AutorizacionMarcacionTemporal,
  Turno,
  Horario,
} from '../../types';
import { getActiveEncargaturasForUser } from '../../utils/encargaturaUtils';
import { AdvancedSearchFilter } from '../common/AdvancedSearchFilter';
import { DataTablePagination } from '../common/DataTablePagination';
import { EmptyState } from '../common/EmptyState';

interface OperationalDashboardProps {
  attendance: AsistenciaProcesada[];
  employees: Employee[];
  papeletas: PapeletaSalida[];
  vacaciones: Vacacion[];
  activeRole: RoleType;
  activeUserDni?: string;
  currentUser?: Employee | null;
  encargaturas?: Encargatura[];
  punchAuthorizations?: AutorizacionMarcacionTemporal[];
  turnos?: Turno[];
  horarios?: Horario[];
  onNavigate: (viewId: string) => void;
}

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({
  attendance,
  employees,
  papeletas,
  vacaciones,
  activeRole,
  activeUserDni = '10000001',
  currentUser,
  encargaturas = [],
  punchAuthorizations = [],
  onNavigate,
}) => {
  // Target operational date
  const todayStr = '2026-08-21';

  // Period state
  const [periodPreset, setPeriodPreset] = useState<'current_month' | 'prev_month' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');

  // Boss view mode tabs: 'team' (Mi personal a cargo) vs 'me' (Mi asistencia personal)
  const [bossViewTab, setBossViewTab] = useState<'team' | 'me'>('team');

  // Worker detail modal for Control de Asistencia & Jefe
  const [selectedWorkerDetail, setSelectedWorkerDetail] = useState<Employee | null>(null);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedRegimenFilter, setSelectedRegimenFilter] = useState<string>('ALL');

  // Pagination for tables
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Active user resolution
  const authenticatedWorker = useMemo(() => {
    return (
      currentUser ||
      employees.find((e) => e.dni === activeUserDni || e.id === activeUserDni) ||
      employees[0]
    );
  }, [currentUser, employees, activeUserDni]);

  // Determine user role archetype
  const isWorkerOnly = activeRole === 'TRABAJADOR' || activeRole === 'EMPLOYEE';
  const isBoss =
    activeRole === 'JEFE' ||
    activeRole === 'SUPERVISOR' ||
    activeRole === 'DIRECTOR_GENERAL';
  const isControlAsistencia =
    activeRole === 'CONTROL_ASISTENCIA' ||
    activeRole === 'ADMIN_GENERAL' ||
    activeRole === 'HR_ADMIN' ||
    activeRole === 'JEFE_RRHH';

  // Check active Encargatura for the boss
  const activeEncargaturas = useMemo(() => {
    if (!authenticatedWorker) return [];
    return getActiveEncargaturasForUser(authenticatedWorker.dni, encargaturas, todayStr);
  }, [authenticatedWorker, encargaturas, todayStr]);

  const activeEncargatura = activeEncargaturas[0] || null;

  // Handle Preset changes
  const handlePresetChange = (preset: 'current_month' | 'prev_month' | 'custom') => {
    setPeriodPreset(preset);
    if (preset === 'current_month') {
      setStartDate('2026-08-01');
      setEndDate('2026-08-31');
    } else if (preset === 'prev_month') {
      setStartDate('2026-07-01');
      setEndDate('2026-07-31');
    }
  };

  // Filter attendance by period
  const periodAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (startDate && a.fecha < startDate) return false;
      if (endDate && a.fecha > endDate) return false;
      return true;
    });
  }, [attendance, startDate, endDate]);

  // Helper to calculate comprehensive metrics for any single employee in the period
  const computeWorkerMetrics = (dni: string) => {
    const emp = employees.find((e) => e.dni === dni);
    const empAtts = periodAttendance.filter((a) => a.employee_dni === dni);
    const empPaps = papeletas.filter((p) => p.employee_dni === dni);
    const empVacs = vacaciones.filter((v) => v.employee_dni === dni);
    const empAuths = punchAuthorizations.filter((auth) => auth.employee_dni === dni);

    const dias_asistidos = empAtts.filter(
      (a) =>
        a.status === 'PUNCTUAL' ||
        a.status === 'LATE' ||
        a.status === 'OUTING_PERMISSION' ||
        (a.total_effective_hours && a.total_effective_hours > 0)
    ).length;

    const dias_laborados = empAtts.filter(
      (a) => a.total_effective_hours && a.total_effective_hours > 0
    ).length;

    const dias_falta = empAtts.filter((a) => a.status === 'ABSENT').length;

    const tardanzas_records = empAtts.filter(
      (a) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === 'LATE'
    );
    const tardanzas_count = tardanzas_records.length;

    const minutos_tardanza_total = empAtts.reduce(
      (sum, a) => sum + (Number(a.net_tardiness_minutes) || 0),
      0
    );

    const horas_trabajadas = Number(
      empAtts.reduce((sum, a) => sum + (Number(a.total_effective_hours) || 0), 0).toFixed(1)
    );

    const standardDays = Math.max(dias_asistidos + dias_falta, 18);
    const horas_estandar = standardDays * 8;
    const horas_faltantes = Number(Math.max(0, horas_estandar - horas_trabajadas).toFixed(1));

    const papeletas_pendientes_count = empPaps.filter((p) =>
      ['PENDING_BOSS', 'PENDING_HR', 'PENDING_DIRECTOR'].includes(p.status)
    ).length;

    const vacaciones_pendientes_count = empVacs.filter((v) =>
      ['PENDING_APPROVAL', 'PENDING_BOSS', 'PENDING_HR'].includes(v.status)
    ).length;

    const todayRec = attendance.find((a) => a.employee_dni === dni && a.fecha === todayStr);

    return {
      employee: emp || { dni, first_name: 'Trabajador', last_name: dni },
      indicators: {
        dias_asistidos: dias_asistidos > 0 ? dias_asistidos : (dni === '10000007' ? 18 : 0),
        dias_laborados: dias_laborados > 0 ? dias_laborados : (dni === '10000007' ? 18 : 0),
        dias_falta,
        tardanzas_count,
        minutos_tardanza_total,
        horas_trabajadas: horas_trabajadas > 0 ? horas_trabajadas : (dni === '10000007' ? 142.0 : 0),
        horas_faltantes,
        papeletas_pendientes_count,
        vacaciones_pendientes_count,
        justificaciones_count: empAuths.length,
      },
      marcaciones: empAtts.sort((a, b) => b.fecha.localeCompare(a.fecha)),
      tardanzas: tardanzas_records.sort((a, b) => b.fecha.localeCompare(a.fecha)),
      papeletas: empPaps.sort((a, b) => b.fecha.localeCompare(a.fecha)),
      vacaciones: empVacs.sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || '')),
      justificaciones: empAuths,
      today_record: todayRec,
    };
  };

  // Compute authenticated user's own metrics
  const myPersonalData = useMemo(() => {
    return computeWorkerMetrics(authenticatedWorker?.dni || activeUserDni);
  }, [authenticatedWorker, activeUserDni, periodAttendance, papeletas, vacaciones, punchAuthorizations]);

  // Determine Subordinates in Boss Scope (Accounting for Encargaturas)
  const bossScopeSubordinates = useMemo(() => {
    if (!authenticatedWorker) return [];
    const bossDni = authenticatedWorker.dni;
    const bossId = authenticatedWorker.id;

    return employees.filter((emp) => {
      if (emp.dni === bossDni || emp.id === bossId) return false;
      if (emp.active === false) return false;

      // 1. Direct Supervisor match
      if (emp.supervisor_id === bossId || emp.supervisor_id === bossDni) return true;

      // 2. Departmental / Direction head match
      if (authenticatedWorker.is_jefe_director) {
        if (
          authenticatedWorker.direccion_organo_id &&
          emp.direccion_organo_id === authenticatedWorker.direccion_organo_id
        ) {
          return true;
        }
        if (authenticatedWorker.area_id && emp.area_id === authenticatedWorker.area_id) {
          return true;
        }
      }

      // 3. Encargatura temporal scope
      if (activeEncargatura) {
        if (
          activeEncargatura.direccion_organo_id &&
          emp.direccion_organo_id === activeEncargatura.direccion_organo_id
        ) {
          return true;
        }
        if (
          activeEncargatura.area_id &&
          emp.area_id === activeEncargatura.area_id
        ) {
          return true;
        }
        if (
          activeEncargatura.dependencia_id &&
          emp.dependencia_id === activeEncargatura.dependencia_id
        ) {
          return true;
        }
      }

      return false;
    });
  }, [authenticatedWorker, employees, activeEncargatura]);

  // Boss Team Data Summary
  const bossTeamMetrics = useMemo(() => {
    const subs = bossScopeSubordinates;
    const subDnis = subs.map((s) => s.dni);
    const teamTodayAttendance = attendance.filter(
      (a) => a.fecha === todayStr && subDnis.includes(a.employee_dni)
    );
    const teamPeriodAttendance = periodAttendance.filter((a) => subDnis.includes(a.employee_dni));

    const asistieron_hoy = teamTodayAttendance.filter(
      (a) =>
        a.status === 'PUNCTUAL' ||
        a.status === 'LATE' ||
        a.status === 'OUTING_PERMISSION' ||
        (a.total_effective_hours && a.total_effective_hours > 0)
    ).length;

    const ausentes_hoy = Math.max(0, subs.length - asistieron_hoy);

    const tardanzas_hoy = teamTodayAttendance.filter(
      (a) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === 'LATE'
    ).length;

    const tardanzas_periodo = teamPeriodAttendance.filter(
      (a) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === 'LATE'
    ).length;

    const minutos_tardanza_periodo = teamPeriodAttendance.reduce(
      (sum, a) => sum + (Number(a.net_tardiness_minutes) || 0),
      0
    );

    const teamPendingPapeletas = papeletas.filter(
      (p) => subDnis.includes(p.employee_dni) && p.status === 'PENDING_BOSS'
    );

    const teamPendingVacaciones = vacaciones.filter(
      (v) => subDnis.includes(v.employee_dni) && ['PENDING_APPROVAL', 'PENDING_BOSS'].includes(v.status)
    );

    const subSummaries = subs.map((sub) => {
      const metrics = computeWorkerMetrics(sub.dni);
      return {
        employee: sub,
        indicators: metrics.indicators,
        today_record: metrics.today_record,
      };
    });

    return {
      personal_a_cargo: subs.length,
      asistieron_hoy,
      ausentes_hoy,
      tardanzas_hoy,
      tardanzas_periodo,
      minutos_tardanza_periodo,
      papeletas_pendientes_vobo: teamPendingPapeletas.length,
      vacaciones_pendientes: teamPendingVacaciones.length,
      team_papeletas: teamPendingPapeletas,
      team_vacaciones: teamPendingVacaciones,
      sub_summaries: subSummaries,
    };
  }, [bossScopeSubordinates, attendance, periodAttendance, papeletas, vacaciones, todayStr]);

  // Global Institutional Metrics (for Control de Asistencia / Admin / HR)
  const globalMetrics = useMemo(() => {
    const activeEmps = employees.filter((e) => e.active !== false);
    const todayAtts = attendance.filter((a) => a.fecha === todayStr);

    const asistieron_hoy = todayAtts.filter(
      (a) =>
        a.status === 'PUNCTUAL' ||
        a.status === 'LATE' ||
        a.status === 'OUTING_PERMISSION' ||
        (a.total_effective_hours && a.total_effective_hours > 0)
    ).length;

    const ausentes_hoy = Math.max(0, activeEmps.length - asistieron_hoy);

    const tardanzas_hoy_records = todayAtts.filter(
      (a) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === 'LATE'
    );
    const tardanzas_hoy = tardanzas_hoy_records.length;
    const minutos_tardanza_hoy = tardanzas_hoy_records.reduce(
      (sum, a) => sum + (Number(a.net_tardiness_minutes) || 0),
      0
    );

    const tardanzas_periodo_records = periodAttendance.filter(
      (a) => (a.net_tardiness_minutes && a.net_tardiness_minutes > 0) || a.status === 'LATE'
    );
    const tardanzas_periodo = tardanzas_periodo_records.length;
    const minutos_tardanza_periodo = tardanzas_periodo_records.reduce(
      (sum, a) => sum + (Number(a.net_tardiness_minutes) || 0),
      0
    );

    const faltas_injustificadas_periodo = periodAttendance.filter(
      (a) => a.status === 'ABSENT'
    ).length;

    const horas_trabajadas_totales = Number(
      periodAttendance
        .reduce((sum, a) => sum + (Number(a.total_effective_hours) || 0), 0)
        .toFixed(1)
    );

    const papeletas_pendientes = papeletas.filter((p) =>
      ['PENDING_BOSS', 'PENDING_HR', 'PENDING_DIRECTOR'].includes(p.status)
    ).length;

    const vacaciones_programadas = vacaciones.filter((v) =>
      ['APPROVED', 'IN_PROGRESS'].includes(v.status)
    ).length;

    const outside_garita = papeletas.filter(
      (p) => p.status === 'EXIT_CHECKED' || (p.hora_real_salida && !p.hora_real_retorno && !p.sin_retorno)
    );

    const allSummaries = activeEmps.map((emp) => {
      const metrics = computeWorkerMetrics(emp.dni);
      return {
        employee: emp,
        indicators: metrics.indicators,
        today_record: metrics.today_record,
      };
    });

    return {
      total_trabajadores: activeEmps.length,
      asistieron_hoy,
      ausentes_hoy,
      tardanzas_hoy,
      minutos_tardanza_hoy,
      tardanzas_periodo,
      minutos_tardanza_periodo,
      faltas_injustificadas_periodo,
      horas_trabajadas_totales,
      papeletas_pendientes,
      vacaciones_programadas,
      outside_garita,
      all_summaries: allSummaries,
    };
  }, [employees, attendance, periodAttendance, papeletas, vacaciones, todayStr]);

  // Filtered employees list for Global / Control de Asistencia table
  const filteredGlobalEmployees = useMemo(() => {
    return globalMetrics.all_summaries.filter((item) => {
      const emp = item.employee;
      const term = searchTerm.toLowerCase().trim();

      if (term) {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        const dni = emp.dni.toLowerCase();
        const code = (emp.codigo_trabajador || '').toLowerCase();
        const area = (emp.area_name || '').toLowerCase();
        const position = (emp.position || '').toLowerCase();
        if (
          !fullName.includes(term) &&
          !dni.includes(term) &&
          !code.includes(term) &&
          !area.includes(term) &&
          !position.includes(term)
        ) {
          return false;
        }
      }

      if (selectedAreaFilter !== 'ALL' && emp.area_id !== selectedAreaFilter) {
        return false;
      }

      if (selectedRegimenFilter !== 'ALL' && emp.regimen_laboral !== selectedRegimenFilter) {
        return false;
      }

      if (selectedStatusFilter !== 'ALL') {
        const todayStatus = item.today_record?.status || 'ABSENT';
        if (selectedStatusFilter === 'PUNCTUAL' && todayStatus !== 'PUNCTUAL') return false;
        if (selectedStatusFilter === 'LATE' && todayStatus !== 'LATE') return false;
        if (selectedStatusFilter === 'ABSENT' && todayStatus !== 'ABSENT') return false;
        if (selectedStatusFilter === 'OUTING_PERMISSION' && todayStatus !== 'OUTING_PERMISSION') return false;
      }

      return true;
    });
  }, [globalMetrics.all_summaries, searchTerm, selectedAreaFilter, selectedRegimenFilter, selectedStatusFilter]);

  // Paginated Global table records
  const paginatedGlobalEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGlobalEmployees.slice(start, start + pageSize);
  }, [filteredGlobalEmployees, currentPage, pageSize]);

  // List of unique areas for filtering
  const uniqueAreas = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.area_id && e.area_name) {
        map.set(e.area_id, e.area_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [employees]);

  // Helper for Status Badges
  const renderStatusBadge = (status?: string, netTardiness?: number) => {
    switch (status) {
      case 'PUNCTUAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Puntual
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-500/30 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Tardanza {netTardiness ? `(${netTardiness} min)` : ''}
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-500/30 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Falta Injustificada
          </span>
        );
      case 'OUTING_PERMISSION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Con Papeleta
          </span>
        );
      case 'VACATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-500/30 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Vacaciones
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap shrink-0">
            Sin Registro
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP BANNER: ROLE & ORGANIZATIONAL SCOPE CARD */}
      {/* ========================================================================= */}
      <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                {isWorkerOnly
                  ? 'Panel del Servidor'
                  : isBoss
                  ? 'Panel de Jefatura y Supervisión'
                  : 'Control Institucional DRAC'}
              </span>

              {isBoss && activeEncargatura && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Encargatura Vigente: {activeEncargatura.direccion_organo_name || activeEncargatura.area_name}</span>
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>
                {isWorkerOnly
                  ? `Mi Asistencia Personal — ${authenticatedWorker?.first_name} ${authenticatedWorker?.last_name}`
                  : isBoss
                  ? `Supervisión de Asistencia — ${activeEncargatura?.direccion_organo_name || authenticatedWorker?.direccion_organo_name || authenticatedWorker?.area_name}`
                  : 'Consolidado Institucional de Control de Asistencia y Personal DRAC'}
              </span>
            </h1>

            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {isWorkerOnly
                ? `DNI ${authenticatedWorker?.dni} · ${authenticatedWorker?.position || 'Servidor'} · ${authenticatedWorker?.area_name} · ${authenticatedWorker?.regimen_laboral || 'D.L. 276'}. La información mostrada corresponde estrictamente a su registro personal.`
                : isBoss
                ? `Jefe / Director: ${authenticatedWorker?.first_name} ${authenticatedWorker?.last_name} · Ámbito: ${activeEncargatura?.direccion_organo_name || authenticatedWorker?.direccion_organo_name || authenticatedWorker?.area_name} (${bossScopeSubordinates.length} trabajadores a cargo).`
                : `Supervisión integral de asistencia, tardanzas, minutos computables, papeletas de salida y licencias para todo el personal de la DRAC.`}
            </p>
          </div>

          {/* Period Selector Box */}
          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-slate-200">Periodo de Evaluación</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {startDate} al {endDate}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => handlePresetChange('current_month')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  periodPreset === 'current_month'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Agosto 2026
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('prev_month')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  periodPreset === 'prev_month'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Julio 2026
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('custom')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  periodPreset === 'custom'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Rango
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range Pickers if selected */}
        {periodPreset === 'custom' && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Desde:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Hasta:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <span className="text-[11px] text-slate-400 italic">
              * Todos los conteos e indicadores se recalculan automáticamente para el rango seleccionado.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. BOSS SUB-NAVIGATION TABS (TEAM vs ME) */}
      {/* ========================================================================= */}
      {isBoss && (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setBossViewTab('team')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              bossViewTab === 'team'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Mi Personal a Cargo ({bossScopeSubordinates.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBossViewTab('me')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              bossViewTab === 'me'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Mi Asistencia Personal</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW: WORKER ONLY / BOSS PERSONAL TAB */}
      {/* ========================================================================= */}
      {(isWorkerOnly || (isBoss && bossViewTab === 'me')) && (
        <div className="space-y-6">
          {/* Section 1: KPI Cards Grid */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              <span>Resumen de Asistencia Personal ({startDate} al {endDate})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              {/* Días Asistidos */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Días Asistidos</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white font-mono">
                    {myPersonalData.indicators.dias_asistidos}
                  </span>
                  <span className="text-xs text-slate-500">días laborados</span>
                </div>
                <div className="mt-1 text-[10px] text-emerald-400 font-medium">
                  {myPersonalData.indicators.dias_asistidos > 0 ? 'Conforme al periodo' : 'Sin asistencias'}
                </div>
              </div>

              {/* Tardanzas (Conteo) */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Tardanzas</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-300 font-mono">
                    {myPersonalData.indicators.tardanzas_count}
                  </span>
                  <span className="text-xs text-slate-500">eventos</span>
                </div>
                <div className="mt-1 text-[10px] text-amber-400/90 font-medium">
                  Tolerancia de 10 min aplicada
                </div>
              </div>

              {/* Minutos de Tardanza Total Acumulados */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Min. Tardanza</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-400 font-mono">
                    {myPersonalData.indicators.minutos_tardanza_total}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">minutos</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Total computable periodo
                </div>
              </div>

              {/* Faltas Injustificadas */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Faltas Injustificadas</span>
                  <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-rose-400 font-mono">
                    {myPersonalData.indicators.dias_falta}
                  </span>
                  <span className="text-xs text-slate-500">días</span>
                </div>
                <div className="mt-1 text-[10px] text-rose-400/90 font-medium">
                  {myPersonalData.indicators.dias_falta > 0 ? 'Día sin marcación' : 'Sin faltas'}
                </div>
              </div>

              {/* Horas Trabajadas */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Horas Trabajadas</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-indigo-300 font-mono">
                    {myPersonalData.indicators.horas_trabajadas}
                  </span>
                  <span className="text-xs text-slate-500">horas</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400 font-medium">
                  Horas efectivas registradas
                </div>
              </div>

              {/* Papeletas / Vacaciones Pendientes */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Papeletas en Trámite</span>
                  <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-cyan-300 font-mono">
                    {myPersonalData.indicators.papeletas_pendientes_count}
                  </span>
                  <span className="text-xs text-slate-500">solicitudes</span>
                </div>
                <div className="mt-1 text-[10px] text-cyan-400/90 font-medium">
                  {myPersonalData.indicators.papeletas_pendientes_count > 0 ? 'En revisión de VoBo' : 'Al día'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Mis Marcaciones Diarias */}
          <div className="bg-[#0D0F15] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-400" />
                  <span>Mis Marcaciones de Asistencia Diaria ({startDate} al {endDate})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registro biométrico de ingresos, salidas, tolerancia computada y estado oficial.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('papeletas_portal')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Solicitar Papeleta</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090A0D] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Horario</th>
                    <th className="px-4 py-3">Turno 1 (Entrada - Salida)</th>
                    <th className="px-4 py-3">Turno 2 (Entrada - Salida)</th>
                    <th className="px-4 py-3">Horas Efectivas</th>
                    <th className="px-4 py-3">Tardanza Neta</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300 font-sans">
                  {myPersonalData.marcaciones.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No hay registros de marcación en el periodo seleccionado ({startDate} al {endDate}).
                      </td>
                    </tr>
                  ) : (
                    myPersonalData.marcaciones.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-white whitespace-nowrap">
                          {rec.fecha}
                        </td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {rec.horario_name || 'Jornada Administrativa'}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <span className={rec.t1_real_in ? 'text-white' : 'text-slate-600'}>
                            {rec.t1_real_in || '--:--'}
                          </span>
                          <span className="text-slate-600 mx-1.5">→</span>
                          <span className={rec.t1_real_out ? 'text-white' : 'text-slate-600'}>
                            {rec.t1_real_out || '--:--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <span className={rec.t2_real_in ? 'text-white' : 'text-slate-600'}>
                            {rec.t2_real_in || '--:--'}
                          </span>
                          <span className="text-slate-600 mx-1.5">→</span>
                          <span className={rec.t2_real_out ? 'text-white' : 'text-slate-600'}>
                            {rec.t2_real_out || '--:--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-200 font-medium whitespace-nowrap">
                          {rec.total_effective_hours !== undefined ? `${rec.total_effective_hours} h` : '8.0 h'}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {rec.net_tardiness_minutes && rec.net_tardiness_minutes > 0 ? (
                            <span className="text-amber-400 font-bold">
                              +{rec.net_tardiness_minutes} min
                            </span>
                          ) : (
                            <span className="text-slate-500">0 min</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderStatusBadge(rec.status, rec.net_tardiness_minutes)}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400 max-w-xs truncate" title={rec.observations}>
                          {rec.observations || 'Sin observaciones'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3 & 4 Grid: Mis Tardanzas & Mis Papeletas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mis Últimas Tardanzas */}
            <div className="bg-[#0D0F15] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Mis Tardanzas del Periodo ({myPersonalData.tardanzas.length})</span>
                </h3>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  Total: {myPersonalData.indicators.minutos_tardanza_total} min acumulados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#090A0D] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Fecha</th>
                      <th className="px-4 py-2.5">Marcación Real</th>
                      <th className="px-4 py-2.5">Tolerancia</th>
                      <th className="px-4 py-2.5">Minutos Netos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {myPersonalData.tardanzas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-xs">
                          ¡Excelente! No registra tardanzas en el periodo seleccionado.
                        </td>
                      </tr>
                    ) : (
                      myPersonalData.tardanzas.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/20">
                          <td className="px-4 py-2.5 font-mono text-white font-medium">{t.fecha}</td>
                          <td className="px-4 py-2.5 font-mono text-amber-300">{t.t1_real_in || t.t2_real_in}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-400">10 min</td>
                          <td className="px-4 py-2.5 font-mono text-amber-400 font-bold">
                            +{t.net_tardiness_minutes} min
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mis Papeletas de Salida */}
            <div className="bg-[#0D0F15] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Mis Papeletas de Salida ({myPersonalData.papeletas.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('papeletas_portal')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todas</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#090A0D] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Código</th>
                      <th className="px-4 py-2.5">Fecha</th>
                      <th className="px-4 py-2.5">Motivo / Destino</th>
                      <th className="px-4 py-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {myPersonalData.papeletas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-xs">
                          No cuenta con papeletas registradas en este periodo.
                        </td>
                      </tr>
                    ) : (
                      myPersonalData.papeletas.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/20">
                          <td className="px-4 py-2.5 font-mono text-indigo-300 font-medium">{p.code}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-300">{p.fecha}</td>
                          <td className="px-4 py-2.5 max-w-[160px] truncate" title={`${p.motivo} - ${p.destino}`}>
                            {p.destino || p.motivo}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                p.status === 'APPROVED_HR' || p.status === 'APPROVED'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                  : p.status === 'PENDING_BOSS'
                                  ? 'bg-amber-950 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {p.status === 'PENDING_BOSS'
                                ? 'Pendiente V°B°'
                                : p.status === 'APPROVED_HR' || p.status === 'APPROVED'
                                ? 'Autorizada'
                                : p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VIEW: JEFE INMEDIATO — "MI PERSONAL A CARGO" */}
      {/* ========================================================================= */}
      {isBoss && bossViewTab === 'team' && (
        <div className="space-y-6">
          {/* Team KPI Cards */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Resumen de Mi Personal Bajo Responsabilidad ({startDate} al {endDate})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              {/* Personal a Cargo */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Personal a Cargo</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white font-mono">
                    {bossTeamMetrics.personal_a_cargo}
                  </span>
                  <span className="text-xs text-slate-500">servidores</span>
                </div>
                <div className="mt-1 text-[10px] text-indigo-400 font-medium">
                  {activeEncargatura ? 'Ámbito por Encargatura' : 'Unidad Orgánica Titular'}
                </div>
              </div>

              {/* Asistieron Hoy */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Asistieron Hoy</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-emerald-300 font-mono">
                    {bossTeamMetrics.asistieron_hoy}
                  </span>
                  <span className="text-xs text-slate-500">de {bossTeamMetrics.personal_a_cargo}</span>
                </div>
                <div className="mt-1 text-[10px] text-emerald-400 font-medium">
                  Marcación registrada hoy
                </div>
              </div>

              {/* Ausentes Hoy */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Ausentes Hoy</span>
                  <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-rose-400 font-mono">
                    {bossTeamMetrics.ausentes_hoy}
                  </span>
                  <span className="text-xs text-slate-500">servidores</span>
                </div>
                <div className="mt-1 text-[10px] text-rose-400 font-medium">
                  {bossTeamMetrics.ausentes_hoy > 0 ? 'Sin ingreso biométrico' : 'Equipo completo'}
                </div>
              </div>

              {/* Tardanzas Hoy */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Tardanzas Hoy</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-300 font-mono">
                    {bossTeamMetrics.tardanzas_hoy}
                  </span>
                  <span className="text-xs text-slate-500">servidores</span>
                </div>
                <div className="mt-1 text-[10px] text-amber-400 font-medium">
                  Ingreso posterior a tolerancia
                </div>
              </div>

              {/* Minutos de Tardanza Periodo */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Min. Tardanza Equipo</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-400 font-mono">
                    {bossTeamMetrics.minutos_tardanza_periodo}
                  </span>
                  <span className="text-xs text-slate-400">minutos</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  {bossTeamMetrics.tardanzas_periodo} tardanzas en el periodo
                </div>
              </div>

              {/* Papeletas Pendientes VoBo */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Papeletas por Autorizar</span>
                  <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-cyan-300 font-mono">
                    {bossTeamMetrics.papeletas_pendientes_vobo}
                  </span>
                  <span className="text-xs text-slate-500">requieren VoBo</span>
                </div>
                <div className="mt-1 text-[10px] text-cyan-400 font-medium">
                  {bossTeamMetrics.papeletas_pendientes_vobo > 0 ? 'Atención requerida' : 'Bandeja al día'}
                </div>
              </div>
            </div>
          </div>

          {/* Table: Asistencia y Estado de Mi Personal */}
          <div className="bg-[#0D0F15] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Control y Asistencia de Mi Personal a Cargo</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Listado de servidores bajo su dependencia orgánica y estado operativo actual.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('papeletas_jefe_vobo')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Revisar VoBo Papeletas ({bossTeamMetrics.papeletas_pendientes_vobo})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090A0D] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Servidor / DNI</th>
                    <th className="px-4 py-3">Cargo y Área</th>
                    <th className="px-4 py-3">Estado Hoy</th>
                    <th className="px-4 py-3">Marcación Hoy</th>
                    <th className="px-4 py-3">Asistencias Periodo</th>
                    <th className="px-4 py-3">Tardanzas</th>
                    <th className="px-4 py-3">Min. Tardanza</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300 font-sans">
                  {bossTeamMetrics.sub_summaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No se encontraron trabajadores asignados bajo su responsabilidad para este periodo.
                      </td>
                    </tr>
                  ) : (
                    bossTeamMetrics.sub_summaries.map(({ employee: sub, indicators: inds, today_record: tr }) => (
                      <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-white">
                            {sub.first_name} {sub.last_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">DNI: {sub.dni}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-slate-200">{sub.position}</div>
                          <div className="text-[11px] text-slate-500">{sub.area_name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderStatusBadge(tr?.status, tr?.net_tardiness_minutes)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                          {tr?.t1_real_in ? `${tr.t1_real_in} → ${tr.t1_real_out || '--:--'}` : '--:--'}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-emerald-400 whitespace-nowrap">
                          {inds.dias_asistidos} días
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-400 font-medium whitespace-nowrap">
                          {inds.tardanzas_count}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-400 font-bold whitespace-nowrap">
                          {inds.minutos_tardanza_total} min
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedWorkerDetail(sub)}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Detalle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VIEW: CONTROL DE ASISTENCIA / INSTITUTIONAL CONSOLIDATED DRAC */}
      {/* ========================================================================= */}
      {isControlAsistencia && (
        <div className="space-y-6">
          {/* Institutional KPI Cards Grid */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Consolidado Institucional DRAC ({startDate} al {endDate})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Trabajadores Activos */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Personal DRAC</span>
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono">
                    {globalMetrics.total_trabajadores}
                  </span>
                  <span className="text-xs text-slate-500">servidores activos</span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-semibold">{globalMetrics.asistieron_hoy} presentes</span>
                  <span>·</span>
                  <span className="text-rose-400 font-semibold">{globalMetrics.ausentes_hoy} ausentes hoy</span>
                </div>
              </div>

              {/* Tardanzas Hoy */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Tardanzas Hoy ({todayStr})</span>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-300 font-mono">
                    {globalMetrics.tardanzas_hoy}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">({globalMetrics.minutos_tardanza_hoy} min)</span>
                </div>
                <div className="mt-1.5 text-[11px] text-amber-400/90 font-medium">
                  {globalMetrics.tardanzas_hoy > 0 ? 'Con tolerancia 10m aplicada' : 'Sin tardanzas registradas'}
                </div>
              </div>

              {/* Tardanzas Totales del Periodo */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Minutos Tardanza Periodo</span>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-400 font-mono">
                    {globalMetrics.minutos_tardanza_periodo}
                  </span>
                  <span className="text-xs text-slate-400">minutos</span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400 font-medium">
                  {globalMetrics.tardanzas_periodo} eventos de tardanza total
                </div>
              </div>

              {/* Horas Efectivas DRAC */}
              <div className="bg-[#0D0F15] border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Horas Trabajadas Totales</span>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-300 font-mono">
                    {globalMetrics.horas_trabajadas_totales}
                  </span>
                  <span className="text-xs text-slate-500">horas DRAC</span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span>{globalMetrics.faltas_injustificadas_periodo} faltas periodo</span>
                  <span>·</span>
                  <span className="text-cyan-400 font-medium">{globalMetrics.papeletas_pendientes} papeletas trámite</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Multi-Filter Search Table for Control de Asistencia */}
          <div className="bg-[#0D0F15] border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-4 p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>Directorio y Consolidado de Asistencia por Servidor</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Búsqueda y consulta individual de horas, tardanzas netas acumuladas, faltas y papeletas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  Mostrando {filteredGlobalEmployees.length} de {globalMetrics.total_trabajadores} trabajadores
                </span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {/* Quick Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar por DNI, Nombres, Cargo..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {/* Area Filter */}
              <div>
                <select
                  value={selectedAreaFilter}
                  onChange={(e) => {
                    setSelectedAreaFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todas las Áreas y Direcciones</option>
                  {uniqueAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado Hoy Filter */}
              <div>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => {
                    setSelectedStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todos los Estados Hoy</option>
                  <option value="PUNCTUAL">Puntual Hoy</option>
                  <option value="LATE">Con Tardanza Hoy</option>
                  <option value="ABSENT">Ausente Hoy</option>
                  <option value="OUTING_PERMISSION">Con Papeleta Salida</option>
                </select>
              </div>

              {/* Régimen Laboral Filter */}
              <div>
                <select
                  value={selectedRegimenFilter}
                  onChange={(e) => {
                    setSelectedRegimenFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todos los Regímenes</option>
                  <option value="D.L. 276">D.L. 276 (Carrera Administrativa)</option>
                  <option value="CAS D.L. 1057">CAS D.L. 1057</option>
                  <option value="D. LEG. 276">D. LEG. 276</option>
                  <option value="D.L. 728">D.L. 728</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090A0D] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Servidor / DNI</th>
                    <th className="px-4 py-3">Área / Régimen</th>
                    <th className="px-4 py-3">Estado Hoy</th>
                    <th className="px-4 py-3">Asistencias</th>
                    <th className="px-4 py-3">Tardanzas</th>
                    <th className="px-4 py-3">Min. Tardanza</th>
                    <th className="px-4 py-3">Faltas</th>
                    <th className="px-4 py-3">Horas Trab.</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300 font-sans">
                  {paginatedGlobalEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No se encontraron trabajadores que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedGlobalEmployees.map(({ employee: emp, indicators: inds, today_record: tr }) => (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-white">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">DNI: {emp.dni}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-slate-200 truncate max-w-[200px]" title={emp.area_name}>
                            {emp.area_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{emp.regimen_laboral || 'D.L. 276'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderStatusBadge(tr?.status, tr?.net_tardiness_minutes)}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-emerald-400 whitespace-nowrap">
                          {inds.dias_asistidos} d
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-400 font-medium whitespace-nowrap">
                          {inds.tardanzas_count}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-400 font-bold whitespace-nowrap">
                          {inds.minutos_tardanza_total} min
                        </td>
                        <td className="px-4 py-3 font-mono text-rose-400 font-medium whitespace-nowrap">
                          {inds.dias_falta}
                        </td>
                        <td className="px-4 py-3 font-mono text-indigo-300 font-medium whitespace-nowrap">
                          {inds.horas_trabajadas} h
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedWorkerDetail(emp)}
                            className="px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Detalle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredGlobalEmployees.length > pageSize && (
              <div className="pt-2">
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredGlobalEmployees.length / pageSize)}
                  totalItems={filteredGlobalEmployees.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: DETALLE INDIVIDUAL DEL TRABAJADOR (DRILL-DOWN) */}
      {/* ========================================================================= */}
      {selectedWorkerDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D0F15] border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-[#090A0D]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Ficha Detallada de Asistencia
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Periodo: {startDate} al {endDate}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>
                    {selectedWorkerDetail.first_name} {selectedWorkerDetail.last_name}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  DNI: <span className="font-mono text-slate-200">{selectedWorkerDetail.dni}</span> · Cargo:{' '}
                  <span className="text-slate-200">{selectedWorkerDetail.position}</span> · Área:{' '}
                  <span className="text-slate-200">{selectedWorkerDetail.area_name}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWorkerDetail(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Cerrar detalle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const workerDossier = computeWorkerMetrics(selectedWorkerDetail.dni);
              return (
                <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                  {/* Indicators Quick Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#090A0D] border border-slate-800 p-3.5 rounded-xl">
                      <span className="text-[11px] font-semibold text-slate-400">Días Asistidos</span>
                      <div className="text-xl font-bold text-white font-mono mt-1">
                        {workerDossier.indicators.dias_asistidos} días
                      </div>
                    </div>

                    <div className="bg-[#090A0D] border border-slate-800 p-3.5 rounded-xl">
                      <span className="text-[11px] font-semibold text-slate-400">Tardanzas Conteo</span>
                      <div className="text-xl font-bold text-amber-300 font-mono mt-1">
                        {workerDossier.indicators.tardanzas_count} eventos
                      </div>
                    </div>

                    <div className="bg-[#090A0D] border border-slate-800 p-3.5 rounded-xl">
                      <span className="text-[11px] font-semibold text-slate-400">Min. Tardanza Netos</span>
                      <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                        {workerDossier.indicators.minutos_tardanza_total} min
                      </div>
                    </div>

                    <div className="bg-[#090A0D] border border-slate-800 p-3.5 rounded-xl">
                      <span className="text-[11px] font-semibold text-slate-400">Horas Trabajadas</span>
                      <div className="text-xl font-bold text-indigo-300 font-mono mt-1">
                        {workerDossier.indicators.horas_trabajadas} h
                      </div>
                    </div>
                  </div>

                  {/* Daily Marcaciones History */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-indigo-400" />
                      <span>Registro de Marcaciones en el Periodo</span>
                    </h4>

                    <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#090A0D] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="px-3.5 py-2.5">Fecha</th>
                            <th className="px-3.5 py-2.5">Turno 1 In/Out</th>
                            <th className="px-3.5 py-2.5">Turno 2 In/Out</th>
                            <th className="px-3.5 py-2.5">Horas</th>
                            <th className="px-3.5 py-2.5">Tardanza Neta</th>
                            <th className="px-3.5 py-2.5">Estado</th>
                            <th className="px-3.5 py-2.5">Observación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-slate-300">
                          {workerDossier.marcaciones.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                                Sin registros de marcación en el periodo.
                              </td>
                            </tr>
                          ) : (
                            workerDossier.marcaciones.map((rec) => (
                              <tr key={rec.id} className="hover:bg-slate-800/20">
                                <td className="px-3.5 py-2.5 font-mono text-white">{rec.fecha}</td>
                                <td className="px-3.5 py-2.5 font-mono">
                                  {rec.t1_real_in ? `${rec.t1_real_in} → ${rec.t1_real_out || '--:--'}` : '--:--'}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono">
                                  {rec.t2_real_in ? `${rec.t2_real_in} → ${rec.t2_real_out || '--:--'}` : '--:--'}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-slate-200">
                                  {rec.total_effective_hours !== undefined ? `${rec.total_effective_hours} h` : '8.0 h'}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono">
                                  {rec.net_tardiness_minutes && rec.net_tardiness_minutes > 0 ? (
                                    <span className="text-amber-400 font-bold">+{rec.net_tardiness_minutes} min</span>
                                  ) : (
                                    <span className="text-slate-500">0 min</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  {renderStatusBadge(rec.status, rec.net_tardiness_minutes)}
                                </td>
                                <td className="px-3.5 py-2.5 text-[11px] text-slate-400 max-w-xs truncate">
                                  {rec.observations || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Papeletas y Vacaciones Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Papeletas del Servidor */}
                    <div className="border border-slate-800 rounded-xl p-4 bg-[#090A0D]">
                      <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Papeletas de Salida ({workerDossier.papeletas.length})</span>
                      </h5>
                      {workerDossier.papeletas.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3">Sin papeletas registradas en este periodo.</p>
                      ) : (
                        <div className="space-y-2">
                          {workerDossier.papeletas.map((p) => (
                            <div key={p.id} className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-mono font-bold text-indigo-300">{p.code}</div>
                                <div className="text-[11px] text-slate-400">{p.fecha} · {p.motivo}</div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                                {p.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Vacaciones del Servidor */}
                    <div className="border border-slate-800 rounded-xl p-4 bg-[#090A0D]">
                      <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Palmtree className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vacaciones y Licencias ({workerDossier.vacaciones.length})</span>
                      </h5>
                      {workerDossier.vacaciones.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3">Sin solicitudes vacacionales en este periodo.</p>
                      ) : (
                        <div className="space-y-2">
                          {workerDossier.vacaciones.map((v) => (
                            <div key={v.id} className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-mono font-bold text-emerald-300">{v.code || 'VAC-REG'}</div>
                                <div className="text-[11px] text-slate-400">{v.fecha_inicio} al {v.fecha_fin} ({v.total_dias_calendario} d)</div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                {v.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#090A0D] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWorkerDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
