import React, { useState, useMemo, useEffect } from 'react';
import { Turno, Horario, RoleType, Employee } from '../../types';
import {
  Clock,
  Plus,
  Info,
  Edit2,
  Trash2,
  X,
  Power,
  ShieldAlert,
  CheckCircle2,
  Moon,
  Copy,
  AlertTriangle,
  PlayCircle,
  Sliders,
  Calendar,
  Check,
  Layers,
  ArrowRight,
  History,
  Sparkles,
  UserCheck,
  Users,
  Zap,
  CheckSquare,
  Square,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { DataTablePagination } from '../common/DataTablePagination';
import { AdvancedSearchFilter } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';
import {
  calculateShiftAndWorkedHours,
  formatMinutesToText,
  getShiftDurationDetails,
  validateShiftOverlap,
  calculateScheduleTotalDuration,
  timeToMinutes,
} from '../../utils/shiftCalculations';

interface ShiftsSchedulesModuleProps {
  activeView?: string;
  turnos: Turno[];
  horarios: Horario[];
  activeRole: RoleType;
  employees?: Employee[];
  onEditEmployee?: (emp: Employee) => void;
  onAddTurno: (newTurno: Omit<Turno, 'id' | 'created_at'>) => void;
  onEditTurno: (turno: Turno) => void;
  onDeleteTurno: (turnoId: string) => void;
  onAddHorario: (newHorario: Omit<Horario, 'id'>) => void;
  onEditHorario: (horario: Horario) => void;
  onDeleteHorario: (horarioId: string) => void;
}

export const ShiftsSchedulesModule: React.FC<ShiftsSchedulesModuleProps> = ({
  activeView,
  turnos,
  horarios,
  activeRole,
  employees = [],
  onEditEmployee,
  onAddTurno,
  onEditTurno,
  onDeleteTurno,
  onAddHorario,
  onEditHorario,
  onDeleteHorario,
}) => {
  const [activeTab, setActiveTab] = useState<'HORARIOS' | 'TURNOS' | 'ASIGNACIONES'>('HORARIOS');
  const [expandedSimulatorTurnoId, setExpandedSimulatorTurnoId] = useState<string | null>(null);

  // Toast Notification for Schedule Assignments
  const [scheduleToast, setScheduleToast] = useState<string | null>(null);
  useEffect(() => {
    if (scheduleToast) {
      const timer = setTimeout(() => setScheduleToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [scheduleToast]);

  // State for card simulator
  const [cardSimIn, setCardSimIn] = useState('07:55');
  const [cardSimOut, setCardSimOut] = useState('13:05');

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'shifts_turnos') setActiveTab('TURNOS');
    else if (activeView === 'shifts_horarios') setActiveTab('HORARIOS');
    else if (activeView === 'shifts_assign') setActiveTab('ASIGNACIONES');
  }, [activeView]);

  // SEARCH & FILTER STATE: ASIGNACIONES
  const [searchAssign, setSearchAssign] = useState('');
  const [filterAssignHorario, setFilterAssignHorario] = useState('ALL');
  const [filterAssignArea, setFilterAssignArea] = useState('ALL');
  const [pageAssign, setPageAssign] = useState(1);
  const [pageSizeAssign, setPageSizeAssign] = useState(15);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // Modals for Assignment
  const [singleAssignEmp, setSingleAssignEmp] = useState<Employee | null>(null);
  const [selectedHorarioForSingle, setSelectedHorarioForSingle] = useState<string>('');
  const [singleEffectiveDate, setSingleEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkHorarioId, setBulkHorarioId] = useState<string>('');
  const [bulkAreaFilter, setBulkAreaFilter] = useState<string>('ALL');
  const [bulkEffectiveDate, setBulkEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Unique Areas from employees
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.area_name) set.add(e.area_name);
    });
    return Array.from(set).sort();
  }, [employees]);

  // SEARCH & FILTER STATE: HORARIOS
  const [searchHorario, setSearchHorario] = useState('');
  const [filterHorarioTurnCount, setFilterHorarioTurnCount] = useState<string>('ALL');
  const [pageHorarios, setPageHorarios] = useState(1);
  const [pageSizeHorarios, setPageSizeHorarios] = useState(20);

  // SEARCH & FILTER STATE: TURNOS
  const [searchTurno, setSearchTurno] = useState('');
  const [filterTurnoActive, setFilterTurnoActive] = useState<string>('ALL');
  const [pageTurnos, setPageTurnos] = useState(1);
  const [pageSizeTurnos, setPageSizeTurnos] = useState(20);

  // Filtered Horarios
  const filteredHorarios = React.useMemo(() => {
    return horarios.filter((h) => {
      if (searchHorario.trim()) {
        const term = searchHorario.toLowerCase().trim();
        const matchName = h.name.toLowerCase().includes(term);
        const matchCode = h.code.toLowerCase().includes(term);
        if (!matchName && !matchCode) return false;
      }
      if (filterHorarioTurnCount !== 'ALL') {
        if (Number(filterHorarioTurnCount) !== h.turn_count) return false;
      }
      return true;
    });
  }, [horarios, searchHorario, filterHorarioTurnCount]);

  const paginatedHorarios = React.useMemo(() => {
    const start = (pageHorarios - 1) * pageSizeHorarios;
    return filteredHorarios.slice(start, start + pageSizeHorarios);
  }, [filteredHorarios, pageHorarios, pageSizeHorarios]);

  // Filtered Turnos
  const filteredTurnos = React.useMemo(() => {
    return turnos.filter((t) => {
      if (searchTurno.trim()) {
        const term = searchTurno.toLowerCase().trim();
        const matchName = t.name.toLowerCase().includes(term);
        const matchCode = t.code.toLowerCase().includes(term);
        const matchDesc = (t.description || '').toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchDesc) return false;
      }
      if (filterTurnoActive === 'ACTIVE' && t.active === false) return false;
      if (filterTurnoActive === 'INACTIVE' && t.active !== false) return false;
      return true;
    });
  }, [turnos, searchTurno, filterTurnoActive]);

  const paginatedTurnos = React.useMemo(() => {
    const start = (pageTurnos - 1) * pageSizeTurnos;
    return filteredTurnos.slice(start, start + pageSizeTurnos);
  }, [filteredTurnos, pageTurnos, pageSizeTurnos]);

  // DATA POLICY CONFIRMATION MODAL STATE
  const [confirmModalConfig, setConfirmModalConfig] = useState<DataPolicyConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'DEACTIVATE',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Modal State: Turno
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null);
  const [turnoCode, setTurnoCode] = useState('');
  const [turnoName, setTurnoName] = useState('');
  const [turnoDescription, setTurnoDescription] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('13:00');
  const [tolerance, setTolerance] = useState(10);
  const [windowEntryStart, setWindowEntryStart] = useState('07:00');
  const [windowExitLimit, setWindowExitLimit] = useState('13:30');
  const [turnoActive, setTurnoActive] = useState(true);
  const [turnoValidationError, setTurnoValidationError] = useState<string | null>(null);
  const [showTurnoConfirmModal, setShowTurnoConfirmModal] = useState(false);

  // Modal State: Horario
  const [showHorarioModal, setShowHorarioModal] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [horarioCode, setHorarioCode] = useState('');
  const [horarioName, setHorarioName] = useState('');
  const [turno1Id, setTurno1Id] = useState('');
  const [turno2Id, setTurno2Id] = useState('');
  const [workingDays, setWorkingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [effectiveStartDate, setEffectiveStartDate] = useState('2026-01-01');
  const [effectiveEndDate, setEffectiveEndDate] = useState('');
  const [horarioValidationError, setHorarioValidationError] = useState<string | null>(null);

  // Live Durations for Modals
  const currentTurnoDuration = getShiftDurationDetails(startTime, endTime);

  const selectedT1 = turnos.find((t) => t.id === turno1Id) || null;
  const selectedT2 = turnos.find((t) => t.id === turno2Id) || null;
  const currentScheduleDuration = calculateScheduleTotalDuration(selectedT1, selectedT2);
  const overlapCheck = validateShiftOverlap(selectedT1, selectedT2);

  // Turno Handlers
  const handleOpenAddTurno = () => {
    const autoCode = `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
    setEditingTurno(null);
    setTurnoCode(autoCode);
    setTurnoName(`Turno 00${turnos.length + 1}`);
    setTurnoDescription('');
    setStartTime('08:00');
    setEndTime('13:00');
    setWindowEntryStart('07:00');
    setWindowExitLimit('13:30');
    setTolerance(10);
    setTurnoActive(true);
    setTurnoValidationError(null);
    setShowTurnoConfirmModal(false);
    setShowTurnoModal(true);
  };

  const handleOpenEditTurno = (t: Turno) => {
    setEditingTurno(t);
    setTurnoCode(t.code);
    setTurnoName(t.name);
    setTurnoDescription(t.description || '');
    setStartTime(t.start_time);
    setEndTime(t.end_time);
    setWindowEntryStart(t.window_entry_start || '07:00');
    setWindowExitLimit(t.window_exit_limit || '13:30');
    setTolerance(t.tolerance_minutes);
    setTurnoActive(t.active !== false);
    setTurnoValidationError(null);
    setShowTurnoConfirmModal(false);
    setShowTurnoModal(true);
  };

  const handleCloneAsNewTurno = (t: Turno) => {
    const autoCode = `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
    setEditingTurno(null);
    setTurnoCode(autoCode);
    setTurnoName(`${t.name} (Copia)`);
    setTurnoDescription(t.description ? `Copia de ${t.description}` : '');
    setStartTime(t.start_time);
    setEndTime(t.end_time);
    setWindowEntryStart(t.window_entry_start || '07:00');
    setWindowExitLimit(t.window_exit_limit || '13:30');
    setTolerance(t.tolerance_minutes);
    setTurnoActive(true);
    setTurnoValidationError(null);
    setShowTurnoConfirmModal(false);
    setShowTurnoModal(true);
  };

  const handlePreSaveTurno = (e: React.FormEvent) => {
    e.preventDefault();
    setTurnoValidationError(null);

    if (!turnoName.trim()) {
      setTurnoValidationError('El Nombre del Turno es obligatorio.');
      return;
    }
    if (!startTime || !endTime) {
      setTurnoValidationError('Debe seleccionar la Hora de Inicio y Hora Final del turno estándar.');
      return;
    }

    const dur = getShiftDurationDetails(startTime, endTime);
    if (!dur.isValid) {
      setTurnoValidationError('Las horas de inicio y fin deben tener un formato de tiempo válido HH:MM.');
      return;
    }

    let codeToUse = turnoCode.trim().toUpperCase();
    if (!codeToUse) {
      codeToUse = `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
      setTurnoCode(codeToUse);
    }

    const codeConflict = turnos.find((t) => t.code === codeToUse && t.id !== editingTurno?.id);
    if (codeConflict) {
      setTurnoValidationError(`El código "${codeToUse}" ya existe (${codeConflict.name}). Ingrese un código único.`);
      return;
    }

    setShowTurnoConfirmModal(true);
  };

  const handleConfirmSaveTurno = () => {
    let codeToUse = turnoCode.trim().toUpperCase() || `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
    const dur = getShiftDurationDetails(startTime, endTime);

    const turnoPayload = {
      code: codeToUse,
      name: turnoName.trim(),
      description: turnoDescription.trim() || undefined,
      start_time: startTime,
      end_time: endTime,
      window_entry_start: windowEntryStart || undefined,
      window_exit_limit: windowExitLimit || undefined,
      tolerance_minutes: Number(tolerance),
      tolerance_exit_minutes: 0,
      is_overnight: dur.isOvernight,
      active: turnoActive,
    };

    if (editingTurno) {
      onEditTurno({
        ...editingTurno,
        ...turnoPayload,
      });
    } else {
      onAddTurno(turnoPayload);
    }

    setShowTurnoConfirmModal(false);
    setShowTurnoModal(false);
    setEditingTurno(null);
  };

  // Horario Handlers
  const handleOpenAddHorario = () => {
    const autoCode = `HOR-${String(horarios.length + 1).padStart(3, '0')}`;
    setEditingHorario(null);
    setHorarioCode(autoCode);
    setHorarioName(`Jornada Institucional 00${horarios.length + 1}`);
    setTurno1Id(turnos[0]?.id || '');
    setTurno2Id('');
    setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    setEffectiveStartDate('2026-01-01');
    setEffectiveEndDate('');
    setHorarioValidationError(null);
    setShowHorarioModal(true);
  };

  const handleOpenEditHorario = (h: Horario) => {
    setEditingHorario(h);
    setHorarioCode(h.code);
    setHorarioName(h.name);
    setTurno1Id(h.turno1_id);
    setTurno2Id(h.turno2_id || '');
    setWorkingDays(h.working_days || ['MON', 'TUE', 'WED', 'THU', 'FRI']);
    setEffectiveStartDate(h.effective_start_date || '2026-01-01');
    setEffectiveEndDate(h.effective_end_date || '');
    setHorarioValidationError(null);
    setShowHorarioModal(true);
  };

  const handleCloneHorarioAsNewVersion = (h: Horario) => {
    const nextVer = (h.version || 1) + 1;
    const autoCode = `HOR-${String(horarios.length + 1).padStart(3, '0')}`;
    setEditingHorario(null);
    setHorarioCode(autoCode);
    setHorarioName(`${h.name} (V${nextVer})`);
    setTurno1Id(h.turno1_id);
    setTurno2Id(h.turno2_id || '');
    setWorkingDays(h.working_days);
    setEffectiveStartDate(new Date().toISOString().slice(0, 10));
    setEffectiveEndDate('');
    setHorarioValidationError(null);
    setShowHorarioModal(true);
  };

  const handleHorarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHorarioValidationError(null);

    // Rule 1: Obligatorio nombre y código
    if (!horarioName.trim()) {
      setHorarioValidationError('El Nombre del Horario es obligatorio.');
      return;
    }
    const finalCode = horarioCode.trim().toUpperCase() || `HOR-${String(horarios.length + 1).padStart(3, '0')}`;

    // Rule 2: Turno 1 es obligatorio
    if (!turno1Id) {
      setHorarioValidationError('El Turno 1 es obligatorio. Seleccione un turno para la primera jornada.');
      return;
    }

    // Rule 3: No permitir seleccionar el mismo turno como Turno 1 y Turno 2
    if (turno2Id && turno1Id === turno2Id) {
      setHorarioValidationError('No puede seleccionar el mismo turno como Turno 1 y Turno 2. Seleccione un turno distinto o deje el Turno 2 como No asignado.');
      return;
    }

    const t1 = turnos.find((t) => t.id === turno1Id);
    const t2 = turno2Id ? turnos.find((t) => t.id === turno2Id) : null;

    if (!t1) {
      setHorarioValidationError('El Turno 1 seleccionado no es válido.');
      return;
    }

    // Rule 4: Validar que los turnos no se superpongan
    if (t2) {
      const overlap = validateShiftOverlap(t1, t2);
      if (overlap.hasOverlap) {
        setHorarioValidationError(overlap.message || 'Los turnos seleccionados se superponen en sus rangos de horario.');
        return;
      }
    }

    // Rule 5: Al menos un día laborable
    if (workingDays.length === 0) {
      setHorarioValidationError('Debe seleccionar al menos un día de trabajo para este horario.');
      return;
    }

    const calc = calculateScheduleTotalDuration(t1, t2);
    const turnCount: 1 | 2 = t2 ? 2 : 1;

    const payload = {
      code: finalCode,
      name: horarioName.trim(),
      turn_count: turnCount,
      turno1_id: t1.id,
      turno1_name: `${t1.name} (${t1.start_time} → ${t1.end_time})`,
      turno2_id: t2 ? t2.id : null,
      turno2_name: t2 ? `${t2.name} (${t2.start_time} → ${t2.end_time})` : undefined,
      working_days: workingDays,
      active: true,
      effective_start_date: effectiveStartDate || '2026-01-01',
      effective_end_date: effectiveEndDate || null,
      version: editingHorario?.version ? editingHorario.version : 1,
      total_hours: calc.totalHours,
      total_duration_text: calc.totalDurationText,
    };

    if (editingHorario) {
      onEditHorario({
        ...editingHorario,
        ...payload,
      });
    } else {
      onAddHorario(payload);
    }

    setShowHorarioModal(false);
    setEditingHorario(null);
  };

  const toggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const allDaysList = [
    { code: 'MON', label: 'Lunes', short: 'L' },
    { code: 'TUE', label: 'Martes', short: 'M' },
    { code: 'WED', label: 'Miércoles', short: 'X' },
    { code: 'THU', label: 'Jueves', short: 'J' },
    { code: 'FRI', label: 'Viernes', short: 'V' },
    { code: 'SAT', label: 'Sábado', short: 'S' },
    { code: 'SUN', label: 'Domingo', short: 'D' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Gestión de Horarios y Turnos Laborales (DRAC)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configuración de <strong>Turnos Laborales</strong> (períodos específicos con tolerancias) y <strong>Horarios Laborales</strong> (jornadas con hasta 2 turnos y cálculo automático de horas).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#090A0D] p-1 rounded border border-slate-800">
            <button
              onClick={() => setActiveTab('HORARIOS')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'HORARIOS'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Horarios Laborales ({horarios.length})
            </button>
            <button
              onClick={() => setActiveTab('TURNOS')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'TURNOS'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Turnos Laborales ({turnos.length})
            </button>
            <button
              onClick={() => setActiveTab('ASIGNACIONES')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
                activeTab === 'ASIGNACIONES'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Asignación de Horarios ({employees.length})</span>
            </button>
          </div>

          {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
            <div className="flex items-center gap-2">
              {activeTab === 'HORARIOS' && (
                <button
                  onClick={handleOpenAddHorario}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Horario Laboral</span>
                </button>
              )}
              {activeTab === 'TURNOS' && (
                <button
                  onClick={handleOpenAddTurno}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Turno Laboral</span>
                </button>
              )}
              {activeTab === 'ASIGNACIONES' && (
                <button
                  onClick={() => {
                    setBulkHorarioId(horarios[0]?.id || '');
                    setBulkAreaFilter('ALL');
                    setShowBulkModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Asignación Masiva</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Distinction Guide Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
            <Clock className="w-4 h-4" />
            <span>1. Turno Laboral (Período Específico)</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Representa un período continuo de trabajo con: <strong>Hora Inicio</strong>, <strong>Hora Final</strong>, <strong>Tolerancia de Entrada</strong> y ventanas biométricas.
          </p>
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Ej: Turno Mañana: 08:00 → 13:00 (5h)</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Turno Tarde: 14:00 → 17:00 (3h)</span>
          </div>
        </div>

        <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <Layers className="w-4 h-4" />
            <span>2. Horario Laboral (Jornada con hasta 2 Turnos)</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Se asigna al trabajador. Contiene <strong>Turno 1 (Obligatorio)</strong> y <strong>Turno 2 (Opcional)</strong>. El sistema calcula automáticamente la <strong>duración total (5h + 3h = 8 horas)</strong> y evalúa 4 marcaciones.
          </p>
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">Jornada Administrativa: T1 (08-13h) + T2 (14-17h) = 8 horas</span>
          </div>
        </div>
      </div>

      {/* TAB 1: HORARIOS LABORALES */}
      {activeTab === 'HORARIOS' && (
        <div className="space-y-4">
          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre o código de horario..."
                value={searchHorario}
                onChange={(e) => {
                  setSearchHorario(e.target.value);
                  setPageHorarios(1);
                }}
                className="px-3 py-1.5 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none focus:border-indigo-600 min-w-[220px]"
              />

              <div className="flex items-center gap-2 bg-[#0F1115] px-3 py-1.5 rounded border border-slate-800">
                <span className="text-slate-400 font-medium">Modalidad:</span>
                <select
                  value={filterHorarioTurnCount}
                  onChange={(e) => {
                    setFilterHorarioTurnCount(e.target.value);
                    setPageHorarios(1);
                  }}
                  className="bg-transparent text-slate-200 focus:outline-none"
                >
                  <option value="ALL">Todas las Jornadas</option>
                  <option value="1">Jornada Continua (1 Turno)</option>
                  <option value="2">Jornada Partida (2 Turnos)</option>
                </select>
              </div>

              {(searchHorario || filterHorarioTurnCount !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchHorario('');
                    setFilterHorarioTurnCount('ALL');
                    setPageHorarios(1);
                  }}
                  className="text-slate-400 hover:text-white underline text-[11px]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="text-slate-500 font-mono text-xs">
              {filteredHorarios.length} horario{filteredHorarios.length !== 1 ? 's' : ''}
            </div>
          </div>

          {filteredHorarios.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No se encontraron horarios laborales"
              description="Cree un nuevo horario laboral o modifique los filtros de búsqueda."
              isFiltered={Boolean(searchHorario) || filterHorarioTurnCount !== 'ALL'}
              onAction={() => {
                setSearchHorario('');
                setFilterHorarioTurnCount('ALL');
                setPageHorarios(1);
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {paginatedHorarios.map((h) => {
                  const t1 = turnos.find((t) => t.id === h.turno1_id);
                  const t2 = h.turno2_id ? turnos.find((t) => t.id === h.turno2_id) : null;
                  const duration = calculateScheduleTotalDuration(t1, t2);

                  return (
                    <div
                      key={h.id}
                      className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        {/* Top Header of Card */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-400">{h.code}</span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono border ${
                                h.turn_count === 2
                                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40'
                                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                              }`}>
                                {h.turn_count === 2 ? 'JORNADA PARTIDA (2 TURNOS)' : 'JORNADA CONTINUA (1 TURNO)'}
                              </span>
                              {h.version && h.version > 1 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded">
                                  v{h.version}
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-sm text-white mt-1">{h.name}</h3>
                          </div>

                          {/* Actions */}
                          {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleCloneHorarioAsNewVersion(h)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded"
                                title="Crear Nueva Vigencia / Versionar Horario (No altera asistencias previas)"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditHorario(h)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded"
                                title="Editar Horario"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmModalConfig({
                                    isOpen: true,
                                    title: 'Desactivar Horario Institucional',
                                    message: `¿Desea cambiar el estado del horario "${h.name}"? Las asistencias históricas ya procesadas mantendrán su cálculo según la vigencia correspondiente.`,
                                    actionType: 'DEACTIVATE',
                                    entityName: `${h.code} - ${h.name}`,
                                    confirmText: 'Confirmar',
                                    onConfirm: () => {
                                      onDeleteHorario(h.id);
                                      setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                    },
                                    onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                                  });
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-rose-400 rounded"
                                title="Desactivar Horario"
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Turnos Breakdown Boxes */}
                        <div className="space-y-2 mt-3">
                          {/* Turno 1 */}
                          <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800 flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Turno 1 (Obligatorio)
                              </div>
                              <div className="text-xs font-bold text-white">
                                {t1?.name || 'Turno 1'}
                              </div>
                              {t1 && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Tolerancia entrada: {t1.tolerance_minutes} min
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/30">
                                {t1 ? `${t1.start_time} → ${t1.end_time}` : '--:--'}
                              </span>
                              {t1 && (
                                <div className="text-[10px] text-slate-400 font-mono mt-1">
                                  {duration.t1Details?.text}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Turno 2 */}
                          {h.turn_count === 2 && t2 ? (
                            <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Turno 2 (Retorno / Tarde)
                                </div>
                                <div className="text-xs font-bold text-white">
                                  {t2.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Tolerancia entrada: {t2.tolerance_minutes} min
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/30">
                                  {t2.start_time} → {t2.end_time}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono mt-1">
                                  {duration.t2Details?.text}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-[#090A0D]/50 rounded-lg border border-dashed border-slate-800 text-center text-slate-500 text-[11px]">
                              Turno 2: No asignado (Jornada Continua)
                            </div>
                          )}
                        </div>

                        {/* Total Duration Banner */}
                        <div className="mt-3 p-2.5 bg-gradient-to-r from-indigo-950/30 to-emerald-950/30 rounded-lg border border-indigo-900/30 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Duración Total Calculada:</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            {duration.breakdownText}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Metadata: Days & Validity */}
                      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-slate-500">Días:</span>
                          <div className="flex gap-1">
                            {allDaysList.map((d) => {
                              const isWork = h.working_days?.includes(d.code);
                              return (
                                <span
                                  key={d.code}
                                  className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                                    isWork
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-900 text-slate-600 border border-slate-800'
                                  }`}
                                  title={d.label}
                                >
                                  {d.short}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="font-mono text-[10px] text-slate-400">
                          Vigencia: {h.effective_start_date || '01/01/2026'} → {h.effective_end_date || 'Actualidad'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination for Horarios */}
              <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <DataTablePagination
                  currentPage={pageHorarios}
                  pageSize={pageSizeHorarios}
                  totalItems={filteredHorarios.length}
                  onPageChange={setPageHorarios}
                  onPageSizeChange={setPageSizeHorarios}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: TURNOS LABORALES */}
      {activeTab === 'TURNOS' && (
        <div className="space-y-4">
          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre, código o descripción de turno..."
                value={searchTurno}
                onChange={(e) => {
                  setSearchTurno(e.target.value);
                  setPageTurnos(1);
                }}
                className="px-3 py-1.5 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none focus:border-indigo-600 min-w-[220px]"
              />

              <div className="flex items-center gap-2 bg-[#0F1115] px-3 py-1.5 rounded border border-slate-800">
                <span className="text-slate-400 font-medium">Estado:</span>
                <select
                  value={filterTurnoActive}
                  onChange={(e) => {
                    setFilterTurnoActive(e.target.value);
                    setPageTurnos(1);
                  }}
                  className="bg-transparent text-slate-200 focus:outline-none"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                </select>
              </div>

              {(searchTurno || filterTurnoActive !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTurno('');
                    setFilterTurnoActive('ALL');
                    setPageTurnos(1);
                  }}
                  className="text-slate-400 hover:text-white underline text-[11px]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="text-slate-500 font-mono text-xs">
              {filteredTurnos.length} turno{filteredTurnos.length !== 1 ? 's' : ''}
            </div>
          </div>

          {filteredTurnos.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No se encontraron turnos laborales"
              description="Defina los turnos con hora de inicio, hora de fin, tolerancias y ventanas de marcación permitidas."
              isFiltered={Boolean(searchTurno) || filterTurnoActive !== 'ALL'}
              onAction={() => {
                setSearchTurno('');
                setFilterTurnoActive('ALL');
                setPageTurnos(1);
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedTurnos.map((t) => {
                  const dur = getShiftDurationDetails(t.start_time, t.end_time);
                  const winEntry = t.window_entry_start || '--:--';
                  const winExit = t.window_exit_limit || '--:--';
                  const isSimulatorOpen = expandedSimulatorTurnoId === t.id;

                  const cardCalc = calculateShiftAndWorkedHours({
                    startTime: t.start_time,
                    endTime: t.end_time,
                    windowEntryStart: winEntry,
                    windowExitLimit: winExit,
                    realIn: cardSimIn,
                    realOut: cardSimOut,
                    toleranceMinutes: t.tolerance_minutes,
                    toleranceExitMinutes: t.tolerance_exit_minutes || 0,
                  });

                  return (
                    <div
                      key={t.id}
                      className={`bg-[#0F1115] border ${
                        t.active === false ? 'border-rose-900/40 opacity-75' : 'border-slate-800'
                      } rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors`}
                    >
                      <div>
                        {/* Top Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">{t.code}</span>
                          <div className="flex items-center gap-1.5">
                            {t.active === false ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-950/60 text-rose-400 rounded border border-rose-800/40">
                                Inactivo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950/60 text-emerald-400 rounded border border-emerald-800/40">
                                Activo
                              </span>
                            )}

                            {dur.isOvernight && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-950/60 text-purple-300 rounded border border-purple-800/40 flex items-center gap-1">
                                <Moon className="w-2.5 h-2.5" />
                                <span>Medianoche</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="font-bold text-sm text-white mb-1">{t.name}</h3>
                        {t.description && (
                          <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{t.description}</p>
                        )}

                        {/* 1. HORARIO DEL TURNO */}
                        <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800/90 space-y-2 mt-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Horario del Turno:</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {t.start_time} → {t.end_time}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5 font-mono">
                            <span>Duración Estándar:</span>
                            <span className="text-white font-bold">{dur.text}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>Tolerancia de Entrada:</span>
                            <span className="text-white">{t.tolerance_minutes} min</span>
                          </div>
                        </div>

                        {/* 2. VENTANA BIOMÉTRICA */}
                        <div className="mt-2 p-2.5 bg-indigo-950/20 rounded-lg border border-indigo-900/30 text-[11px] font-mono space-y-1">
                          <div className="text-indigo-300 font-bold flex items-center gap-1 text-[10px] uppercase">
                            <Sliders className="w-3 h-3 text-indigo-400" />
                            <span>Ventana de Marcación Permitida</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Entrada desde: <strong className="text-white">{winEntry}</strong></span>
                            <span>Salida hasta: <strong className="text-white">{winExit}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Actions & Simulator */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <button
                          onClick={() => setExpandedSimulatorTurnoId(isSimulatorOpen ? null : t.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>{isSimulatorOpen ? 'Ocultar Simulador' : 'Simular Marcación'}</span>
                        </button>

                        {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCloneAsNewTurno(t)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded"
                              title="Clonar Turno"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleOpenEditTurno(t)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded"
                              title="Editar Turno"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmModalConfig({
                                  isOpen: true,
                                  title: 'Desactivar Turno Laboral',
                                  message: `¿Desea cambiar el estado del turno "${t.name}"? Los horarios que ya lo utilizan continuarán funcionando.`,
                                  actionType: 'DEACTIVATE',
                                  entityName: `${t.code} - ${t.name}`,
                                  confirmText: 'Confirmar',
                                  onConfirm: () => {
                                    onDeleteTurno(t.id);
                                    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                  },
                                  onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                                });
                              }}
                              className="p-1 bg-slate-800 hover:bg-rose-900/50 text-rose-400 rounded"
                              title="Desactivar Turno"
                            >
                              <Power className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Interactive Biometric Simulator Panel */}
                      {isSimulatorOpen && (
                        <div className="p-3 bg-[#090A0D] border border-indigo-800/40 rounded-lg space-y-3 pt-3">
                          <div className="text-[11px] font-bold text-indigo-300 flex items-center justify-between">
                            <span>Simulador de Regla Efectiva</span>
                            <span className="text-[10px] text-slate-500 font-mono">Tolerancia: {t.tolerance_minutes} min</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Entrada Real:</label>
                              <input
                                type="time"
                                value={cardSimIn}
                                onChange={(e) => setCardSimIn(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-emerald-400 font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Salida Real:</label>
                              <input
                                type="time"
                                value={cardSimOut}
                                onChange={(e) => setCardSimOut(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-amber-400 font-mono font-bold"
                              />
                            </div>
                          </div>

                          <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1.5 text-[11px] font-mono">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Ventana Biométrico:</span>
                              <span className={cardCalc.isValidPunchWindow ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                                {cardCalc.isValidPunchWindow ? '✓ Válida en Ventana' : '⚠️ Fuera de Rango'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Inicio Efectivo:</span>
                              <span className="text-white font-bold">{cardCalc.effectiveStart} (Turno: {t.start_time})</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Fin Efectivo:</span>
                              <span className="text-white font-bold">{cardCalc.effectiveEnd} (Turno: {t.end_time})</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-800 pt-1.5">
                              <span className="text-indigo-300 font-bold">Tiempo Efectivo:</span>
                              <span className="text-emerald-400 font-bold text-sm bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                                {cardCalc.effectiveDurationText} ({cardCalc.effectiveHours}h)
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {cardCalc.ruleExplanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination for Turnos */}
              <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <DataTablePagination
                  currentPage={pageTurnos}
                  pageSize={pageSizeTurnos}
                  totalItems={filteredTurnos.length}
                  onPageChange={setPageTurnos}
                  onPageSizeChange={setPageSizeTurnos}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ASIGNACIÓN DE HORARIOS A SERVIDORES PÚBLICOS                       */}
      {/* ========================================================================= */}
      {activeTab === 'ASIGNACIONES' && (
        <div className="space-y-4">
          {/* Toast Banner */}
          {scheduleToast && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{scheduleToast}</span>
              </div>
              <button
                onClick={() => setScheduleToast(null)}
                className="text-emerald-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Metrics */}
          {(() => {
            const totalEmps = employees.length;
            const assignedEmps = employees.filter((e) => e.horario_id).length;
            const unassignedEmps = totalEmps - assignedEmps;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400">Total Servidores Registrados</div>
                    <div className="text-xl font-extrabold text-white mt-0.5">{totalEmps}</div>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400">Con Horario Asignado</div>
                    <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{assignedEmps}</div>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400">Sin Horario Asignado</div>
                    <div className="text-xl font-extrabold text-amber-400 mt-0.5">{unassignedEmps}</div>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Search, Filter & Bulk Action Toolbar */}
          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <input
                type="text"
                placeholder="🔍 Buscar por DNI, nombres, cargo o área..."
                value={searchAssign}
                onChange={(e) => {
                  setSearchAssign(e.target.value);
                  setPageAssign(1);
                }}
                className="px-3 py-1.5 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none focus:border-indigo-600 min-w-[240px]"
              />

              <select
                value={filterAssignHorario}
                onChange={(e) => {
                  setFilterAssignHorario(e.target.value);
                  setPageAssign(1);
                }}
                className="px-3 py-1.5 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none"
              >
                <option value="ALL">Todos los Horarios</option>
                <option value="UNASSIGNED">⚠️ Sin Horario Asignado</option>
                {horarios.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>

              <select
                value={filterAssignArea}
                onChange={(e) => {
                  setFilterAssignArea(e.target.value);
                  setPageAssign(1);
                }}
                className="px-3 py-1.5 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none"
              >
                <option value="ALL">Todas las Áreas</option>
                {uniqueAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              {(searchAssign || filterAssignHorario !== 'ALL' || filterAssignArea !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchAssign('');
                    setFilterAssignHorario('ALL');
                    setFilterAssignArea('ALL');
                    setPageAssign(1);
                  }}
                  className="text-slate-400 hover:text-white underline text-[11px]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Selected batch actions */}
            {selectedEmpIds.length > 0 && (
              <div className="flex items-center gap-2 bg-indigo-950/80 border border-indigo-700/60 px-3 py-1.5 rounded-lg text-indigo-200">
                <span className="font-bold text-xs">{selectedEmpIds.length} seleccionados</span>
                <button
                  type="button"
                  onClick={() => {
                    setBulkHorarioId(horarios[0]?.id || '');
                    setBulkAreaFilter('SELECTED');
                    setShowBulkModal(true);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded transition-colors"
                >
                  Asignar Horario
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEmpIds([])}
                  className="text-slate-400 hover:text-white text-[11px] underline"
                >
                  Deseleccionar
                </button>
              </div>
            )}
          </div>

          {/* Employee Schedule Table */}
          {(() => {
            const filtered = employees.filter((emp) => {
              if (searchAssign.trim()) {
                const term = searchAssign.toLowerCase().trim();
                const matchDni = emp.dni.toLowerCase().includes(term);
                const matchName = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term);
                const matchCargo = (emp.cargo_name || '').toLowerCase().includes(term);
                const matchArea = (emp.area_name || '').toLowerCase().includes(term);
                if (!matchDni && !matchName && !matchCargo && !matchArea) return false;
              }
              if (filterAssignHorario === 'UNASSIGNED') {
                if (emp.horario_id) return false;
              } else if (filterAssignHorario !== 'ALL') {
                if (emp.horario_id !== filterAssignHorario) return false;
              }
              if (filterAssignArea !== 'ALL' && emp.area_name !== filterAssignArea) {
                return false;
              }
              return true;
            });

            const paginated = filtered.slice(
              (pageAssign - 1) * pageSizeAssign,
              pageAssign * pageSizeAssign
            );

            const allSelected = paginated.length > 0 && paginated.every((e) => selectedEmpIds.includes(e.id));

            const toggleSelectAll = () => {
              if (allSelected) {
                setSelectedEmpIds((prev) => prev.filter((id) => !paginated.some((e) => e.id === id)));
              } else {
                const newIds = new Set([...selectedEmpIds, ...paginated.map((e) => e.id)]);
                setSelectedEmpIds(Array.from(newIds));
              }
            };

            const toggleSelectOne = (id: string) => {
              setSelectedEmpIds((prev) =>
                prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
              );
            };

            if (filtered.length === 0) {
              return (
                <EmptyState
                  icon={Users}
                  title="No se encontraron servidores públicos"
                  description="Ajuste los criterios de búsqueda o cree nuevos horarios laborales."
                  isFiltered={Boolean(searchAssign) || filterAssignHorario !== 'ALL' || filterAssignArea !== 'ALL'}
                  onAction={() => {
                    setSearchAssign('');
                    setFilterAssignHorario('ALL');
                    setFilterAssignArea('ALL');
                    setPageAssign(1);
                  }}
                />
              );
            }

            return (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-[#090A0D]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                        <th className="p-3 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-slate-400 hover:text-white"
                          >
                            {allSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </th>
                        <th className="p-3">Servidor Público</th>
                        <th className="p-3">DNI</th>
                        <th className="p-3">Área / Dependencia</th>
                        <th className="p-3">Horario Asignado</th>
                        <th className="p-3">Turnos & Horas</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {paginated.map((emp) => {
                        const assignedHorario = horarios.find((h) => h.id === emp.horario_id);
                        const t1 = assignedHorario ? turnos.find((t) => t.id === assignedHorario.turno1_id) : null;
                        const t2 = assignedHorario && assignedHorario.turno2_id ? turnos.find((t) => t.id === assignedHorario.turno2_id) : null;
                        const duration = assignedHorario ? calculateScheduleTotalDuration(t1, t2) : null;
                        const isSelected = selectedEmpIds.includes(emp.id);

                        return (
                          <tr
                            key={emp.id}
                            className={`hover:bg-slate-900/40 transition-colors ${
                              isSelected ? 'bg-indigo-950/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSelectOne(emp.id)}
                                className="text-slate-400 hover:text-white"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-600" />
                                )}
                              </button>
                            </td>

                            <td className="p-3">
                              <div className="font-bold text-white flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                                  {emp.first_name[0]}{emp.last_name[0]}
                                </div>
                                <span>{emp.first_name} {emp.last_name}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 pl-8">{emp.cargo_name || 'Servidor'}</div>
                            </td>

                            <td className="p-3 font-mono text-[11px] text-indigo-300 font-bold">
                              {emp.dni}
                            </td>

                            <td className="p-3 text-slate-400">
                              <div>{emp.area_name || emp.dependencia_name || 'Sede Central'}</div>
                              <div className="text-[10px] text-slate-500">{emp.dependencia_name}</div>
                            </td>

                            <td className="p-3">
                              {assignedHorario ? (
                                <div>
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span className="font-mono text-indigo-400 text-[10px]">{assignedHorario.code}</span>
                                    <span>{assignedHorario.name}</span>
                                  </div>
                                  <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                                    {assignedHorario.turn_count === 2 ? '2 Turnos (Partida)' : '1 Turno (Continua)'}
                                    {duration && ` • ${duration.totalDurationText}`}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50">
                                  ⚠️ Sin Asignar
                                </span>
                              )}
                            </td>

                            <td className="p-3 font-mono text-[11px]">
                              {assignedHorario && t1 ? (
                                <div className="space-y-0.5">
                                  <div className="text-emerald-400">
                                    T1: {t1.start_time} - {t1.end_time}
                                  </div>
                                  {t2 && (
                                    <div className="text-indigo-400">
                                      T2: {t2.start_time} - {t2.end_time}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleAssignEmp(emp);
                                  setSelectedHorarioForSingle(emp.horario_id || horarios[0]?.id || '');
                                  setSingleEffectiveDate(new Date().toISOString().slice(0, 10));
                                }}
                                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded border border-indigo-500/30 font-semibold text-[11px] transition-colors"
                              >
                                {emp.horario_id ? 'Cambiar Horario' : 'Asignar Horario'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <DataTablePagination
                    currentPage={pageAssign}
                    pageSize={pageSizeAssign}
                    totalItems={filtered.length}
                    onPageChange={setPageAssign}
                    onPageSizeChange={(newSize) => {
                      setPageSizeAssign(newSize);
                      setPageAssign(1);
                    }}
                    pageSizeOptions={[10, 15, 25, 50]}
                  />
                </div>
              </div>
            );
          })()}

          {/* SINGLE ASSIGNMENT MODAL */}
          {singleAssignEmp && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-sm text-white">
                      Asignar Horario Laboral al Servidor
                    </h3>
                  </div>
                  <button
                    onClick={() => setSingleAssignEmp(null)}
                    className="text-slate-400 hover:text-white p-1 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-white text-xs">
                    {singleAssignEmp.first_name} {singleAssignEmp.last_name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    DNI: <span className="text-indigo-300 font-mono">{singleAssignEmp.dni}</span> | Cargo: {singleAssignEmp.cargo_name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Área: {singleAssignEmp.area_name || singleAssignEmp.dependencia_name}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Seleccionar Horario Laboral:
                    </label>
                    <select
                      value={selectedHorarioForSingle}
                      onChange={(e) => setSelectedHorarioForSingle(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-slate-200 border border-slate-800 rounded text-xs focus:outline-none focus:border-indigo-600 font-semibold"
                    >
                      <option value="">[ Sin Horario Asignado ]</option>
                      {horarios.map((h) => {
                        const t1 = turnos.find((t) => t.id === h.turno1_id);
                        const t2 = h.turno2_id ? turnos.find((t) => t.id === h.turno2_id) : null;
                        const duration = calculateScheduleTotalDuration(t1, t2);
                        return (
                          <option key={h.id} value={h.id}>
                            {h.code} - {h.name} ({duration.totalDurationText}, {h.turn_count === 2 ? '2 Turnos' : '1 Turno'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Fecha de Inicio de Vigencia:
                    </label>
                    <input
                      type="date"
                      value={singleEffectiveDate}
                      onChange={(e) => setSingleEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-slate-200 border border-slate-800 rounded text-xs focus:outline-none font-mono"
                    />
                  </div>

                  {/* Selected Horario Preview */}
                  {(() => {
                    const selectedH = horarios.find((h) => h.id === selectedHorarioForSingle);
                    if (!selectedH) return null;
                    const t1 = turnos.find((t) => t.id === selectedH.turno1_id);
                    const t2 = selectedH.turno2_id ? turnos.find((t) => t.id === selectedH.turno2_id) : null;
                    const duration = calculateScheduleTotalDuration(t1, t2);

                    return (
                      <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs space-y-1 font-mono">
                        <div className="font-bold text-emerald-400">{selectedH.name} ({duration.totalDurationText})</div>
                        {t1 && <div className="text-slate-300">Turno 1: {t1.start_time} → {t1.end_time} (Tol: {t1.tolerance_minutes}m)</div>}
                        {t2 && <div className="text-slate-300">Turno 2: {t2.start_time} → {t2.end_time} (Tol: {t2.tolerance_minutes}m)</div>}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSingleAssignEmp(null)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onEditEmployee && singleAssignEmp) {
                        const updated: Employee = {
                          ...singleAssignEmp,
                          horario_id: selectedHorarioForSingle || undefined,
                        };
                        onEditEmployee(updated);
                        const hName = horarios.find((h) => h.id === selectedHorarioForSingle)?.name || 'Sin horario';
                        setScheduleToast(`Horario "${hName}" asignado a ${singleAssignEmp.first_name} ${singleAssignEmp.last_name}.`);
                        setSingleAssignEmp(null);
                      }
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors shadow-sm"
                  >
                    Guardar Asignación
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MASS / BATCH ASSIGNMENT MODAL */}
          {showBulkModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">
                      Asignación Masiva de Horarios
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Grupo Destinatario:
                    </label>
                    <select
                      value={bulkAreaFilter}
                      onChange={(e) => setBulkAreaFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none font-semibold"
                    >
                      {selectedEmpIds.length > 0 && (
                        <option value="SELECTED">
                          ✓ Los {selectedEmpIds.length} servidores seleccionados previamente
                        </option>
                      )}
                      <option value="ALL">Todo el Personal de la Entidad DRAC ({employees.length})</option>
                      <option value="UNASSIGNED">Solo Personal Sin Horario Asignado ({employees.filter((e) => !e.horario_id).length})</option>
                      <optgroup label="Por Dirección / Área Específica">
                        {uniqueAreas.map((area) => {
                          const count = employees.filter((e) => e.area_name === area).length;
                          return (
                            <option key={area} value={area}>
                              Área: {area} ({count} servidores)
                            </option>
                          );
                        })}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Horario Laboral a Asignar:
                    </label>
                    <select
                      value={bulkHorarioId}
                      onChange={(e) => setBulkHorarioId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-slate-200 border border-slate-800 rounded focus:outline-none font-semibold"
                    >
                      {horarios.map((h) => {
                        const t1 = turnos.find((t) => t.id === h.turno1_id);
                        const t2 = h.turno2_id ? turnos.find((t) => t.id === h.turno2_id) : null;
                        const duration = calculateScheduleTotalDuration(t1, t2);
                        return (
                          <option key={h.id} value={h.id}>
                            {h.code} - {h.name} ({duration.totalDurationText})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Fecha de Inicio de Vigencia:
                    </label>
                    <input
                      type="date"
                      value={bulkEffectiveDate}
                      onChange={(e) => setBulkEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-slate-200 border border-slate-800 rounded font-mono"
                    />
                  </div>

                  {/* Target summary count */}
                  {(() => {
                    let targets: Employee[] = [];
                    if (bulkAreaFilter === 'SELECTED') {
                      targets = employees.filter((e) => selectedEmpIds.includes(e.id));
                    } else if (bulkAreaFilter === 'ALL') {
                      targets = employees;
                    } else if (bulkAreaFilter === 'UNASSIGNED') {
                      targets = employees.filter((e) => !e.horario_id);
                    } else {
                      targets = employees.filter((e) => e.area_name === bulkAreaFilter);
                    }

                    return (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-emerald-300 space-y-1 font-mono text-[11px]">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Se asignará este horario a {targets.length} servidores públicos.</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onEditEmployee) {
                        let targets: Employee[] = [];
                        if (bulkAreaFilter === 'SELECTED') {
                          targets = employees.filter((e) => selectedEmpIds.includes(e.id));
                        } else if (bulkAreaFilter === 'ALL') {
                          targets = employees;
                        } else if (bulkAreaFilter === 'UNASSIGNED') {
                          targets = employees.filter((e) => !e.horario_id);
                        } else {
                          targets = employees.filter((e) => e.area_name === bulkAreaFilter);
                        }

                        targets.forEach((emp) => {
                          onEditEmployee({
                            ...emp,
                            horario_id: bulkHorarioId,
                          });
                        });

                        const hName = horarios.find((h) => h.id === bulkHorarioId)?.name || '';
                        setScheduleToast(`Horario "${hName}" asignado exitosamente a ${targets.length} servidores.`);
                        setSelectedEmpIds([]);
                        setShowBulkModal(false);
                      }
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors shadow-sm"
                  >
                    Confirmar Asignación Masiva
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM MODAL: REGISTRAR / EDITAR HORARIO LABORAL (HASTA 2 TURNOS)           */}
      {/* ========================================================================= */}
      {showHorarioModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleHorarioSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  {editingHorario ? 'Editar Horario Laboral' : 'Registrar Horario Laboral'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHorarioModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Horario Validation Error */}
            {horarioValidationError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-lg text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">{horarioValidationError}</div>
              </div>
            )}

            {/* Overlap Warning if detected live */}
            {overlapCheck.hasOverlap && (
              <div className="p-3 bg-amber-950/80 border border-amber-800/80 rounded-lg text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Atención - Superposición de Turnos:</strong> {overlapCheck.message}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Horario Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Nombre del Horario *</label>
                  <input
                    type="text"
                    placeholder="Ej: Jornada Administrativa"
                    value={horarioName}
                    onChange={(e) => setHorarioName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-500 focus:outline-none font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Código</label>
                  <input
                    type="text"
                    placeholder="HOR-001"
                    value={horarioCode}
                    onChange={(e) => setHorarioCode(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-indigo-400 border border-slate-800 rounded font-mono uppercase focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Días de Trabajo */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Días de Trabajo (Semana)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                  {allDaysList.map((d) => {
                    const isSelected = workingDays.includes(d.code);
                    return (
                      <button
                        type="button"
                        key={d.code}
                        onClick={() => toggleDay(d.code)}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                            : 'bg-[#090A0D] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-[10px] opacity-75">☑</span>
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION: SELECCIÓN DE TURNOS (HASTA 2 TURNOS) */}
              <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Configuración de Turnos Laborales (Máximo 2)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {selectedT2 ? '2 Turnos Asignados' : '1 Turno (Jornada Continua)'}
                  </span>
                </div>

                {/* TURNO 1 (OBLIGATORIO) */}
                <div className="p-3 bg-[#0F1115] border border-emerald-900/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span>Turno 1</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Obligatorio
                      </span>
                    </label>
                    {selectedT1 && (
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {selectedT1.start_time} → {selectedT1.end_time} ({getShiftDurationDetails(selectedT1.start_time, selectedT1.end_time).text})
                      </span>
                    )}
                  </div>

                  <select
                    value={turno1Id}
                    onChange={(e) => setTurno1Id(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-700 rounded text-xs focus:border-emerald-500 focus:outline-none"
                    required
                  >
                    <option value="">[ Seleccionar Turno 1 ▼ ]</option>
                    {turnos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.start_time} → {t.end_time}) [Duración: {getShiftDurationDetails(t.start_time, t.end_time).text}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* TURNO 2 (OPCIONAL) */}
                <div className="p-3 bg-[#0F1115] border border-indigo-900/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                      <span>Turno 2</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                        Opcional
                      </span>
                    </label>
                    {selectedT2 ? (
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        {selectedT2.start_time} → {selectedT2.end_time} ({getShiftDurationDetails(selectedT2.start_time, selectedT2.end_time).text})
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">No asignado</span>
                    )}
                  </div>

                  <select
                    value={turno2Id}
                    onChange={(e) => setTurno2Id(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-700 rounded text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">[ Sin Turno 2 (Jornada Continua / 1 solo turno) ▼ ]</option>
                    {turnos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.start_time} → {t.end_time}) [Duración: {getShiftDurationDetails(t.start_time, t.end_time).text}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* COMPUTED TOTAL DURATION BANNER */}
                <div className="p-3.5 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-indigo-950/50 border border-emerald-800/40 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Duración Total del Horario:
                    </span>
                    <span className="text-sm font-extrabold text-emerald-400 font-mono">
                      {currentScheduleDuration.totalDurationText}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Cálculo: {currentScheduleDuration.breakdownText}
                  </div>
                </div>
              </div>

              {/* VIGENCIA HISTÓRICA */}
              <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <History className="w-3.5 h-3.5" />
                  <span>Vigencia del Horario (Regla de Inmutabilidad Histórica)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Las asistencias pasadas continuarán utilizando la vigencia histórica correspondiente. Si la jornada cambia, cree una nueva versión con nueva fecha de inicio.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Vigencia Inicio (Desde):</label>
                    <input
                      type="date"
                      value={effectiveStartDate}
                      onChange={(e) => setEffectiveStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0F1115] text-white border border-slate-700 rounded font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Vigencia Fin (Hasta - opcional):</label>
                    <input
                      type="date"
                      value={effectiveEndDate}
                      onChange={(e) => setEffectiveEndDate(e.target.value)}
                      placeholder="Indefinido"
                      className="w-full px-2.5 py-1.5 bg-[#0F1115] text-white border border-slate-700 rounded font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowHorarioModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={overlapCheck.hasOverlap || !turno1Id}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingHorario ? 'Actualizar Horario' : 'Guardar Horario'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM MODAL: REGISTRAR / EDITAR TURNO LABORAL & VENTANAS                   */}
      {/* ========================================================================= */}
      {showTurnoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handlePreSaveTurno}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                {editingTurno ? 'Editar Turno Laboral & Tolerancias' : 'Registrar Turno Laboral & Tolerancias'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTurnoModal(false);
                  setShowTurnoConfirmModal(false);
                }}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Validation Error Banner */}
            {turnoValidationError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-lg text-rose-300 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">{turnoValidationError}</div>
                </div>
                {editingTurno && (
                  <button
                    type="button"
                    onClick={() => handleCloneAsNewTurno(editingTurno)}
                    className="w-full mt-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Clonar en Nuevo Turno (Recomendado)</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {/* Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Código del Turno</label>
                  <input
                    type="text"
                    placeholder="TUR-001"
                    value={turnoCode}
                    onChange={(e) => setTurnoCode(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono uppercase focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nombre del Turno *</label>
                  <input
                    type="text"
                    placeholder="Ej: Turno Mañana / Turno Tarde"
                    value={turnoName}
                    onChange={(e) => setTurnoName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none font-medium"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Descripción (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Jornada matutina sede central DRAC"
                  value={turnoDescription}
                  onChange={(e) => setTurnoDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {/* SECTION 1: HORARIO DEL TURNO & TOLERANCIAS */}
              <div className="bg-[#090A0D] border border-emerald-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">Horario del Turno &amp; Tolerancias</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    Duración: {currentTurnoDuration.text}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
                      Hora de Inicio (TIME) *
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-emerald-400 border border-slate-700 rounded font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Hora oficial de inicio</span>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
                      Hora Final (TIME) *
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-amber-400 border border-slate-700 rounded font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Hora oficial de salida</span>
                  </div>
                </div>

                {/* Tolerancia de Entrada */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block text-slate-300 mb-1 font-bold">Tolerancia de Entrada</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={tolerance}
                      onChange={(e) => setTolerance(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 bg-[#0F1115] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                      required
                    />
                    <span className="absolute right-3 top-1.5 text-[10px] text-slate-500">min</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Minutos de gracia al ingreso antes de registrar tardanza
                  </span>
                </div>
              </div>

              {/* SECTION 2: VENTANA DE MARCACIÓN BIOMÉTRICA */}
              <div className="bg-[#090A0D] border border-indigo-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-xs">Ventana de Marcación Permitida (ZKTeco)</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-mono">
                    Rango Válido
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
                      Hora inicio marcación entrada (TIME)
                    </label>
                    <input
                      type="time"
                      value={windowEntryStart}
                      onChange={(e) => setWindowEntryStart(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-indigo-300 border border-slate-700 rounded font-mono text-sm font-bold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
                      Hora límite marcación salida (TIME)
                    </label>
                    <input
                      type="time"
                      value={windowExitLimit}
                      onChange={(e) => setWindowExitLimit(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-indigo-300 border border-slate-700 rounded font-mono text-sm font-bold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Estado del Turno</label>
                <select
                  value={turnoActive ? 'ACTIVO' : 'INACTIVO'}
                  onChange={(e) => setTurnoActive(e.target.value === 'ACTIVO')}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowTurnoModal(false);
                  setShowTurnoConfirmModal(false);
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Guardar Turno</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL FOR TURNO */}
      {showTurnoConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-indigo-500/40 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-indigo-400 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0" />
              <h3 className="font-bold text-sm text-white">Confirmar Registro de Turno</h3>
            </div>

            <p className="text-slate-300 font-medium leading-relaxed">
              ¿Desea registrar o actualizar este turno laboral en el catálogo institucional?
            </p>

            <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Código / Nombre:</span>
                <span className="text-white font-bold">{turnoCode} - {turnoName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-1.5">
                <span className="text-slate-400">Horario:</span>
                <span className="text-emerald-400 font-bold">
                  {startTime} → {endTime} ({currentTurnoDuration.text})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tolerancia Entrada:</span>
                <span className="text-white">{tolerance} min</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTurnoConfirmModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveTurno}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar y Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATA POLICY CONFIRMATION MODAL */}
      <DataPolicyConfirmModal config={confirmModalConfig} />
    </div>
  );
};
