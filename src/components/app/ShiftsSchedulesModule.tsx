import React, { useState } from 'react';
import { Turno, Horario, RoleType } from '../../types';
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
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import {
  calculateShiftAndWorkedHours,
  formatMinutesToText,
  timeToMinutes,
} from '../../utils/shiftCalculations';

interface ShiftsSchedulesModuleProps {
  activeView?: string;
  turnos: Turno[];
  horarios: Horario[];
  activeRole: RoleType;
  onAddTurno: (newTurno: Omit<Turno, 'id' | 'created_at'>) => void;
  onEditTurno: (turno: Turno) => void;
  onDeleteTurno: (turnoId: string) => void;
  onAddHorario: (newHorario: Omit<Horario, 'id'>) => void;
  onEditHorario: (horario: Horario) => void;
  onDeleteHorario: (horarioId: string) => void;
}

// HELPER: CÁLCULO DE DURACIÓN DE TURNO Y DETECCIÓN DE MEDIANOCHE
export const calculateShiftDuration = (start: string, end: string) => {
  if (!start || !end) {
    return { hours: 0, minutes: 0, totalMinutes: 0, text: '0 horas', isOvernight: false, isValid: false };
  }
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  if (
    isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM) ||
    sH < 0 || sH > 23 || eH < 0 || eH > 23 || sM < 0 || sM > 59 || eM < 0 || eM > 59
  ) {
    return { hours: 0, minutes: 0, totalMinutes: 0, text: 'Hora Inválida', isOvernight: false, isValid: false };
  }

  let startTotal = sH * 60 + sM;
  let endTotal = eH * 60 + eM;
  let isOvernight = false;

  // Turno que cruza la medianoche (ej: 22:00 -> 06:00)
  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
    isOvernight = true;
  }

  const diffMins = endTotal - startTotal;
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;

  let text = '';
  if (minutes === 0) {
    text = `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else {
    text = `${hours}h ${minutes}m`;
  }

  if (isOvernight) {
    text += ' (+1 día)';
  }

  return { hours, minutes, totalMinutes: diffMins, text, isOvernight, isValid: true };
};

export const ShiftsSchedulesModule: React.FC<ShiftsSchedulesModuleProps> = ({
  activeView,
  turnos,
  horarios,
  activeRole,
  onAddTurno,
  onEditTurno,
  onDeleteTurno,
  onAddHorario,
  onEditHorario,
  onDeleteHorario,
}) => {
  const [activeTab, setActiveTab] = useState<'HORARIOS' | 'TURNOS'>('HORARIOS');
  const [expandedSimulatorTurnoId, setExpandedSimulatorTurnoId] = useState<string | null>(null);

  // State for card simulator
  const [cardSimIn, setCardSimIn] = useState('07:00');
  const [cardSimOut, setCardSimOut] = useState('13:59');

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'shifts_turnos') setActiveTab('TURNOS');
    else if (activeView === 'shifts_horarios' || activeView === 'shifts_assign') setActiveTab('HORARIOS');
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

  // Modal State
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null);

  const [showHorarioModal, setShowHorarioModal] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);

  // Form State: Turno
  const [turnoCode, setTurnoCode] = useState('');
  const [turnoName, setTurnoName] = useState('');
  const [turnoDescription, setTurnoDescription] = useState('');
  // 1. Horario del Turno (Estándar)
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('13:00');
  const [tolerance, setTolerance] = useState(10);
  // 2. Ventana de Marcación Permitida
  const [windowEntryStart, setWindowEntryStart] = useState('07:00');
  const [windowExitLimit, setWindowExitLimit] = useState('13:59');
  // 3. Simulador interactivo en modal
  const [modalSimIn, setModalSimIn] = useState('07:00');
  const [modalSimOut, setModalSimOut] = useState('13:59');

  const [turnoActive, setTurnoActive] = useState(true);
  const [turnoValidationError, setTurnoValidationError] = useState<string | null>(null);
  const [showTurnoConfirmModal, setShowTurnoConfirmModal] = useState(false);

  // Form State: Horario
  const [horarioCode, setHorarioCode] = useState('');
  const [horarioName, setHorarioName] = useState('');
  const [turnCount, setTurnCount] = useState<1 | 2>(1);
  const [turno1Id, setTurno1Id] = useState(turnos[0]?.id || '');
  const [turno2Id, setTurno2Id] = useState('');
  const [workingDays, setWorkingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);

  // Calculated duration live
  const currentDuration = calculateShiftDuration(startTime, endTime);

  // Live simulation in modal
  const modalSimResult = calculateShiftAndWorkedHours({
    startTime,
    endTime,
    windowEntryStart,
    windowExitLimit,
    realIn: modalSimIn,
    realOut: modalSimOut,
    toleranceMinutes: tolerance,
  });

  // Handlers for Turno
  const handleOpenAddTurno = () => {
    const autoCode = `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
    setEditingTurno(null);
    setTurnoCode(autoCode);
    setTurnoName(`Turno 00${turnos.length + 1}`);
    setTurnoDescription('');
    setStartTime('08:00');
    setEndTime('13:00');
    setWindowEntryStart('07:00');
    setWindowExitLimit('13:59');
    setTolerance(10);
    setModalSimIn('07:00');
    setModalSimOut('13:59');
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
    setWindowExitLimit(t.window_exit_limit || '13:59');
    setTolerance(t.tolerance_minutes);
    setModalSimIn(t.window_entry_start || '07:00');
    setModalSimOut(t.window_exit_limit || '13:59');
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
    setWindowExitLimit(t.window_exit_limit || '13:59');
    setTolerance(t.tolerance_minutes);
    setModalSimIn(t.window_entry_start || '07:00');
    setModalSimOut(t.window_exit_limit || '13:59');
    setTurnoActive(true);
    setTurnoValidationError(null);
    setShowTurnoConfirmModal(false);
    setShowTurnoModal(true);
  };

  const handlePreSaveTurno = (e: React.FormEvent) => {
    e.preventDefault();
    setTurnoValidationError(null);

    // 1. Validation: Required fields
    if (!turnoName.trim()) {
      setTurnoValidationError('El Nombre del Turno es obligatorio.');
      return;
    }

    if (!startTime || !endTime) {
      setTurnoValidationError('Debe seleccionar la Hora de Inicio y Hora Final del turno estándar.');
      return;
    }

    if (!windowEntryStart || !windowExitLimit) {
      setTurnoValidationError('Debe configurar la Ventana de Marcación Permitida (Hora Inicio Entrada y Hora Límite Salida).');
      return;
    }

    const dur = calculateShiftDuration(startTime, endTime);
    if (!dur.isValid) {
      setTurnoValidationError('Las horas de inicio y fin deben tener un formato de tiempo válido HH:MM.');
      return;
    }

    let codeToUse = turnoCode.trim().toUpperCase();
    if (!codeToUse) {
      codeToUse = `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
      setTurnoCode(codeToUse);
    }

    // 2. Validation: Unique Code
    const codeConflict = turnos.find((t) => t.code === codeToUse && t.id !== editingTurno?.id);
    if (codeConflict) {
      setTurnoValidationError(`El código de turno "${codeToUse}" ya está registrado (${codeConflict.name}). Asigne un código único.`);
      return;
    }

    // 3. Validation: Duplicate configuration check
    const duplicateConflict = turnos.find(
      (t) =>
        t.id !== editingTurno?.id &&
        t.active !== false &&
        t.name.toLowerCase() === turnoName.trim().toLowerCase() &&
        t.start_time === startTime &&
        t.end_time === endTime
    );
    if (duplicateConflict) {
      setTurnoValidationError(`Ya existe un turno activo idéntico "${duplicateConflict.name}" con horario ${startTime} a ${endTime}.`);
      return;
    }

    // 4. Requirement 8: Historical / Assigned Turno Immutability Check
    if (editingTurno) {
      const isAssigned = horarios.some((h) => h.turno1_id === editingTurno.id || h.turno2_id === editingTurno.id);
      const hoursChanged = editingTurno.start_time !== startTime || editingTurno.end_time !== endTime;

      if ((isAssigned || editingTurno.is_historical) && hoursChanged) {
        setTurnoValidationError(
          `REGLA DE INTEGRIDAD HISTÓRICA: El turno "${editingTurno.name}" está asignado a un Horario y/o asistencias procesadas. No se debe modificar la hora de inicio o final de un turno histórico. En su lugar, cree o clone un NUEVO TURNO.`
        );
        return;
      }
    }

    // Opens confirmation dialog modal
    setShowTurnoConfirmModal(true);
  };

  const handleConfirmSaveTurno = () => {
    let codeToUse = turnoCode.trim().toUpperCase();
    if (!codeToUse) {
      codeToUse = `TUR-${String(turnos.length + 1).padStart(3, '0')}`;
    }

    const dur = calculateShiftDuration(startTime, endTime);

    if (editingTurno) {
      onEditTurno({
        ...editingTurno,
        code: codeToUse,
        name: turnoName.trim(),
        description: turnoDescription.trim() || undefined,
        start_time: startTime,
        end_time: endTime,
        window_entry_start: windowEntryStart,
        window_exit_limit: windowExitLimit,
        tolerance_minutes: Number(tolerance),
        is_overnight: dur.isOvernight,
        active: turnoActive,
      });
    } else {
      onAddTurno({
        code: codeToUse,
        name: turnoName.trim(),
        description: turnoDescription.trim() || undefined,
        start_time: startTime,
        end_time: endTime,
        window_entry_start: windowEntryStart,
        window_exit_limit: windowExitLimit,
        tolerance_minutes: Number(tolerance),
        is_overnight: dur.isOvernight,
        active: turnoActive,
      });
    }

    setShowTurnoConfirmModal(false);
    setShowTurnoModal(false);
    setEditingTurno(null);
  };

  // Handlers for Horario
  const handleOpenAddHorario = () => {
    setEditingHorario(null);
    setHorarioCode('');
    setHorarioName('');
    setTurnCount(1);
    setTurno1Id(turnos[0]?.id || '');
    setTurno2Id('');
    setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    setShowHorarioModal(true);
  };

  const handleOpenEditHorario = (h: Horario) => {
    setEditingHorario(h);
    setHorarioCode(h.code);
    setHorarioName(h.name);
    setTurnCount(h.turn_count);
    setTurno1Id(h.turno1_id);
    setTurno2Id(h.turno2_id || '');
    setWorkingDays(h.working_days);
    setShowHorarioModal(true);
  };

  const handleHorarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!horarioCode || !horarioName || !turno1Id) return;

    const t1 = turnos.find((t) => t.id === turno1Id);
    const t2 = turnos.find((t) => t.id === turno2Id);

    if (editingHorario) {
      onEditHorario({
        ...editingHorario,
        code: horarioCode.toUpperCase().trim(),
        name: horarioName.trim(),
        turn_count: turnCount,
        turno1_id: turno1Id,
        turno1_name: t1 ? `${t1.name} (${t1.start_time} - ${t1.end_time})` : undefined,
        turno2_id: turnCount === 2 ? turno2Id || null : null,
        turno2_name: turnCount === 2 && t2 ? `${t2.name} (${t2.start_time} - ${t2.end_time})` : undefined,
        working_days: workingDays,
      });
    } else {
      onAddHorario({
        code: horarioCode.toUpperCase().trim(),
        name: horarioName.trim(),
        turn_count: turnCount,
        turno1_id: turno1Id,
        turno1_name: t1 ? `${t1.name} (${t1.start_time} - ${t1.end_time})` : undefined,
        turno2_id: turnCount === 2 ? turno2Id || null : null,
        turno2_name: turnCount === 2 && t2 ? `${t2.name} (${t2.start_time} - ${t2.end_time})` : undefined,
        working_days: workingDays,
        active: true,
      });
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
    { code: 'MON', label: 'L' },
    { code: 'TUE', label: 'M' },
    { code: 'WED', label: 'X' },
    { code: 'THU', label: 'J' },
    { code: 'FRI', label: 'V' },
    { code: 'SAT', label: 'S' },
    { code: 'SUN', label: 'D' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Gestión de Tiempos: Turnos, Ventanas de Marcación &amp; Horarios
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configuración de Horario del Turno (Jornada estándar), Ventana de Marcación Permitida (Biométricos ZKTeco) y regla de cómputo de horas efectivas para la DRAC.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#090A0D] p-1 rounded border border-slate-800">
            <button
              onClick={() => setActiveTab('HORARIOS')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'HORARIOS'
                  ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Horarios ({horarios.length})
            </button>
            <button
              onClick={() => setActiveTab('TURNOS')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeTab === 'TURNOS'
                  ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Turnos &amp; Ventanas ({turnos.length})
            </button>
          </div>

          {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
            <div>
              {activeTab === 'HORARIOS' ? (
                <button
                  onClick={handleOpenAddHorario}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Horario</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenAddTurno}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Turno Laboral</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Regla de Turnos y Ventanas Banner */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4.5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-800 pb-3 md:pb-0 md:pr-4">
          <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[13px]">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>1. Horario del Turno</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Define el inicio y fin de la <strong>jornada laboral estándar (TIME)</strong> con evaluación estricta a la hora de salida.
          </p>
        </div>

        <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-800 pb-3 md:pb-0 md:pr-4">
          <div className="flex items-center gap-1.5 font-bold text-indigo-400 text-[13px]">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>2. Ventana de Marcación</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Rango permitido en biométrico: <strong>Hora inicio entrada (TIME)</strong> y <strong>Hora límite salida (TIME)</strong>.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[13px]">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>3. Regla de Cómputo Efectivo</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Las marcaciones en ventana comprueban asistencia; el tiempo efectivo se computa <strong>estrictamente dentro del turno</strong> sin tolerancia de salida.
          </p>
        </div>
      </div>

      {/* Horarios View */}
      {activeTab === 'HORARIOS' && (
        <>
          {horarios.length === 0 ? (
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 text-center">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-300">No hay horarios institucionales registrados</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Cree plantillas de horarios vinculando los turnos y definiendo los días laborales aplicables al personal.
              </p>
              {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                <button
                  onClick={handleOpenAddHorario}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Primer Horario</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {horarios.map((h) => (
                <div
                  key={h.id}
                  className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-indigo-400">{h.code}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                          {h.turn_count === 2 ? 'JORNADA PARTIDA (2 TURNOS)' : 'JORNADA CONTINUA (1 TURNO)'}
                        </span>
                        {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditHorario(h)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded"
                              title="Editar Horario"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmModalConfig({
                                  isOpen: true,
                                  title: 'Desactivar Horario Institucional',
                                  message: `¿Desea desactivar el horario "${h.name}"? Los procesamientos de asistencia históricos continuarán utilizando la versión con la que fueron procesados.`,
                                  actionType: 'DEACTIVATE',
                                  entityName: `Código: ${h.code} - ${h.name}`,
                                  confirmText: 'Desactivar Horario',
                                  onConfirm: () => {
                                    onDeleteHorario(h.id);
                                    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                  },
                                  onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                                });
                              }}
                              className="p-1 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded"
                              title="Desactivar Horario"
                            >
                              <Power className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-white mb-2">{h.name}</h3>

                    <div className="space-y-2 mt-4">
                      <div className="p-3 bg-[#090A0D] rounded border border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Turno 1 (Principal)</span>
                        <span className="font-mono text-xs text-emerald-400 font-bold">
                          {h.turno1_name || 'Turno Principal'}
                        </span>
                      </div>

                      {h.turn_count === 2 && (
                        <div className="p-3 bg-[#090A0D] rounded border border-slate-800 flex items-center justify-between">
                          <span className="text-xs text-slate-400">Turno 2 (Retorno)</span>
                          <span className="font-mono text-xs text-emerald-400 font-bold">
                            {h.turno2_name || 'Turno Retorno'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Días Laborables:</span>
                    <span className="text-white">{h.working_days.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Turnos View */}
      {activeTab === 'TURNOS' && (
        <>
          {turnos.length === 0 ? (
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 text-center">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-300">No hay turnos laborales configurados</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Defina los turnos con su horario laboral estándar y ventanas de marcación permitidas.
              </p>
              {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                <button
                  onClick={handleOpenAddTurno}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configurar Primer Turno</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {turnos.map((t) => {
            const dur = calculateShiftDuration(t.start_time, t.end_time);
            const isAssigned = horarios.some((h) => h.turno1_id === t.id || h.turno2_id === t.id);
            const winEntry = t.window_entry_start || '--:--';
            const winExit = t.window_exit_limit || '--:--';
            const isSimulatorOpen = expandedSimulatorTurnoId === t.id;

            // Live computation for this card
            const cardCalc = calculateShiftAndWorkedHours({
              startTime: t.start_time,
              endTime: t.end_time,
              windowEntryStart: winEntry,
              windowExitLimit: winExit,
              realIn: cardSimIn,
              realOut: cardSimOut,
              toleranceMinutes: t.tolerance_minutes,
            });

            return (
              <div
                key={t.id}
                className={`bg-[#0F1115] border ${
                  t.active === false ? 'border-rose-900/40 opacity-70' : 'border-slate-800'
                } rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4`}
              >
                <div>
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
                          <Moon className="w-2.5 h-2.5 text-purple-400" />
                          <span>+1 día</span>
                        </span>
                      )}

                      {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleOpenEditTurno(t)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                            title="Editar Turno & Ventanas"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleCloneAsNewTurno(t)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors"
                            title="Clonar en Nuevo Turno (Histórico)"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModalConfig({
                                isOpen: true,
                                title: 'Desactivar Turno Institucional',
                                message: `¿Desea desactivar el turno "${t.name}"? Los horarios y marcaciones procesadas mantendrán la trazabilidad del turno original sin afectación.`,
                                actionType: 'DEACTIVATE',
                                entityName: `Código: ${t.code} - ${t.name}`,
                                confirmText: 'Desactivar Turno',
                                onConfirm: () => {
                                  onDeleteTurno(t.id);
                                  setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                },
                                onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                              });
                            }}
                            className="p-1 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded transition-colors"
                            title="Desactivar Turno"
                          >
                            <Power className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-white mb-1">{t.name}</h3>
                  {t.description && <p className="text-xs text-slate-400 mb-3">{t.description}</p>}

                  {/* 2 DISTINCT HORARIOS BREAKDOWN */}
                  <div className="space-y-2 text-xs">
                    {/* 1. HORARIO DEL TURNO */}
                    <div className="bg-[#090A0D] p-3 rounded-lg border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>1. Horario del Turno (Estándar):</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Duración: <strong className="text-white">{dur.text}</strong>
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono bg-slate-900/60 p-2 rounded border border-slate-800/80">
                        <span className="text-slate-300">Inicio: <strong className="text-emerald-300">{t.start_time}</strong></span>
                        <span className="text-slate-500">→</span>
                        <span className="text-slate-300">Fin: <strong className="text-amber-300">{t.end_time}</strong> {dur.isOvernight && '(+1d)'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                        <span>Tolerancia Entrada: <strong className="text-slate-200">{t.tolerance_minutes} min</strong></span>
                        <span className="text-amber-400/90 font-semibold">Salida Estricta: Sin Tolerancia</span>
                      </div>
                    </div>

                    {/* 2. VENTANA DE MARCACIÓN PERMITIDA */}
                    <div className="bg-[#090A0D] p-3 rounded-lg border border-indigo-950 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-400 flex items-center gap-1">
                          <Sliders className="w-3 h-3" />
                          <span>2. Ventana de Marcación Permitida:</span>
                        </span>
                        <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[9px] font-mono font-bold">
                          ZKTeco Biométrico
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Inicio entrada:</span>
                          <span className="text-indigo-300 font-bold">{winEntry}</span>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Límite salida:</span>
                          <span className="text-indigo-300 font-bold">{winExit}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight pt-0.5">
                        Marcaciones entre <strong>{winEntry}</strong> y <strong>{winExit}</strong> son válidas para asistencia.
                      </p>
                    </div>

                    {/* 3. REGLA DE CÓMPUTO EFFECTIVE RULE */}
                    <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800/80 text-[10px] text-slate-300 space-y-1">
                      <div className="flex items-center gap-1 text-amber-400 font-bold">
                        <Info className="w-3 h-3 shrink-0" />
                        <span>Regla de Cómputo de Horas:</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        Marcación en ventana previa o salida posterior se computa <strong className="text-white">estrictamente a la jornada del turno</strong> ({t.start_time} - {t.end_time}). Retiros previos computan como salida anticipada.
                      </p>
                    </div>
                  </div>

                  {isAssigned && (
                    <div className="mt-2 text-[10px] text-indigo-400/80 flex items-center gap-1 font-mono">
                      <ShieldAlert className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>Asignado a Horario Institucional Activo</span>
                    </div>
                  )}
                </div>

                {/* INTERACTIVE SIMULATOR DRAWER FOR THIS CARD */}
                <div className="border-t border-slate-800/80 pt-2">
                  <button
                    onClick={() => setExpandedSimulatorTurnoId(isSimulatorOpen ? null : t.id)}
                    className="w-full py-1.5 px-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded text-[11px] font-semibold flex items-center justify-between transition-colors font-mono"
                  >
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Simular Marcación &amp; Cómputo</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{isSimulatorOpen ? 'Ocultar ▲' : 'Probar ▼'}</span>
                  </button>

                  {isSimulatorOpen && (
                    <div className="mt-2.5 p-3 bg-[#090A0D] border border-indigo-900/50 rounded-lg space-y-2.5 text-xs animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Marcación Entrada (TIME)</label>
                          <input
                            type="time"
                            value={cardSimIn}
                            onChange={(e) => setCardSimIn(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-emerald-400 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Marcación Salida (TIME)</label>
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
              </div>
            );
          })}
            </div>
          )}
        </>
      )}

      {/* FORM MODAL: REGISTRAR / EDITAR TURNO LABORAL & VENTANAS */}
      {showTurnoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handlePreSaveTurno}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                {editingTurno ? 'Editar Turno Laboral & Ventanas' : 'Registrar Turno Laboral & Ventanas de Marcación'}
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
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Identificador institucional</span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nombre del Turno *</label>
                  <input
                    type="text"
                    placeholder="Ej: Turno 001 — Mañana"
                    value={turnoName}
                    onChange={(e) => setTurnoName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Descripción (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Turno matutino sede central DRAC"
                  value={turnoDescription}
                  onChange={(e) => setTurnoDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {/* SECTION 1: HORARIO DEL TURNO */}
              <div className="bg-[#090A0D] border border-emerald-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">1. Horario del Turno (Jornada Estándar)</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    Duración: {currentDuration.text}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold flex items-center gap-1">
                      <span>Hora de Inicio del Turno (TIME) *</span>
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-emerald-400 border border-slate-700 rounded font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Hora oficial de inicio de jornada laboral</span>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold flex items-center gap-1">
                      <span>Hora Final del Turno (TIME) *</span>
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] text-amber-400 border border-slate-700 rounded font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Hora oficial de fin (Evaluación estricta sin tolerancia)</span>
                  </div>
                </div>

                {/* Tolerances */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="max-w-xs">
                    <label className="block text-slate-400 mb-1 font-medium">Tolerancia de Entrada</label>
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
                      Minutos de gracia para marcación de ingreso antes de computar tardanza
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: VENTANA DE MARCACIÓN PERMITIDA */}
              <div className="bg-[#090A0D] border border-indigo-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-xs">2. Ventana de Marcación Permitida (Biométrico ZKTeco)</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-mono">
                    Rango Válido
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold flex items-center gap-1">
                      <span>Hora inicio marcación de entrada (TIME) *</span>
                    </label>
                    <input
                      type="time"
                      value={windowEntryStart}
                      onChange={(e) => {
                        setWindowEntryStart(e.target.value);
                        setModalSimIn(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-[#0F1115] text-indigo-300 border border-slate-700 rounded font-mono text-sm font-bold focus:border-indigo-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">A partir de qué hora se permite registrar entrada</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-bold flex items-center gap-1">
                      <span>Hora límite marcación de salida (TIME) *</span>
                    </label>
                    <input
                      type="time"
                      value={windowExitLimit}
                      onChange={(e) => {
                        setWindowExitLimit(e.target.value);
                        setModalSimOut(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-[#0F1115] text-indigo-300 border border-slate-700 rounded font-mono text-sm font-bold focus:border-indigo-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Hasta qué hora se permite registrar la salida</span>
                  </div>
                </div>

                {/* Range Visual Map */}
                <div className="bg-[#0F1115] p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
                  <div className="text-slate-400 flex items-center justify-between">
                    <span>Ventana Entrada: <strong className="text-indigo-300">{windowEntryStart}</strong></span>
                    <span className="text-slate-600">→</span>
                    <span className="text-emerald-400 font-bold">Turno: {startTime} a {endTime}</span>
                    <span className="text-slate-600">→</span>
                    <span>Ventana Salida: <strong className="text-indigo-300">{windowExitLimit}</strong></span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: REGLA DE CÁLCULO DE HORAS TRABAJADAS & SIMULADOR EN VIVO */}
              <div className="bg-gradient-to-br from-slate-900 via-[#090A0D] to-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>3. Regla de Cálculo de Horas &amp; Simulador en Vivo</span>
                  </div>
                  <span className="text-[10px] text-indigo-300 font-mono">Prueba Interactiva</span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Las marcaciones dentro de la ventana de tiempo (<strong className="text-indigo-300">{windowEntryStart}</strong> a <strong className="text-indigo-300">{windowExitLimit}</strong>) son válidas para comprobar la asistencia. Sin embargo, el cálculo de horas trabajadas se basa estrictamente en el horario del turno (<strong className="text-emerald-400">{startTime} a {endTime}</strong>).
                </p>

                {/* Live simulation controllers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Probar Marcación Entrada Real (TIME):</label>
                    <input
                      type="time"
                      value={modalSimIn}
                      onChange={(e) => setModalSimIn(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0F1115] text-emerald-400 border border-slate-700 rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Probar Marcación Salida Real (TIME):</label>
                    <input
                      type="time"
                      value={modalSimOut}
                      onChange={(e) => setModalSimOut(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0F1115] text-amber-400 border border-slate-700 rounded font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Simulation Output Card */}
                <div className="bg-[#090A0D] border border-indigo-900/60 rounded-lg p-3 space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Verificación de Ventana:</span>
                    <span className={modalSimResult.isValidPunchWindow ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-amber-400 font-bold'}>
                      <Check className="w-3 h-3" />
                      <span>{modalSimResult.isValidPunchWindow ? 'Marcación Válida en Ventana' : 'Fuera de Rango'}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inicio Efectivo Computado:</span>
                    <span className="text-white font-bold">{modalSimResult.effectiveStart} (Inicio Turno: {startTime})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fin Efectivo Computado:</span>
                    <span className="text-white font-bold">{modalSimResult.effectiveEnd} (Fin Turno: {endTime})</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 text-xs">
                    <span className="text-indigo-300 font-bold">Tiempo Efectivo Contabilizado:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      {modalSimResult.effectiveDurationText} ({modalSimResult.effectiveHours}h)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans leading-tight pt-1">
                    {modalSimResult.ruleExplanation}
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
                <span>Guardar Turno &amp; Ventana</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL */}
      {showTurnoConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-indigo-500/40 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-indigo-400 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0" />
              <h3 className="font-bold text-sm text-white">Confirmación de Registro de Turno</h3>
            </div>

            <p className="text-slate-300 font-medium leading-relaxed">
              ¿Está seguro de registrar este turno laboral y ventana de marcación en el sistema institucional?
            </p>

            {/* Shift Summary Card */}
            <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Código / Nombre:</span>
                <span className="text-white font-bold">{turnoCode} - {turnoName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-1.5">
                <span className="text-slate-400">Horario del Turno:</span>
                <span className="text-emerald-400 font-bold">
                  {startTime} → {endTime} ({currentDuration.text})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ventana de Marcación:</span>
                <span className="text-indigo-300 font-bold">
                  {windowEntryStart} a {windowExitLimit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tolerancia Entrada:</span>
                <span className="text-white">{tolerance} minutos</span>
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

      {/* MODAL: ADD / EDIT HORARIO */}
      {showHorarioModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleHorarioSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                {editingHorario ? 'Editar Horario Laboral' : 'Crear Horario Laboral (Jornada)'}
              </h3>
              <button type="button" onClick={() => setShowHorarioModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Código Horario</label>
                  <input
                    type="text"
                    placeholder="HOR-PLANTA"
                    value={horarioCode}
                    onChange={(e) => setHorarioCode(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono uppercase focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Tipo de Jornada</label>
                  <select
                    value={turnCount}
                    onChange={(e) => setTurnCount(Number(e.target.value) as 1 | 2)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                  >
                    <option value={1}>Jornada Continua (1 Turno)</option>
                    <option value={2}>Jornada Partida (2 Turnos)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nombre de la Jornada</label>
                <input
                  type="text"
                  placeholder="Jornada Rotativa Operaciones"
                  value={horarioName}
                  onChange={(e) => setHorarioName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Turno 1 (Principal)</label>
                <select
                  value={turno1Id}
                  onChange={(e) => setTurno1Id(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                  required
                >
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.start_time} - {t.end_time}) [Ventana: {t.window_entry_start || '--:--'} a {t.window_exit_limit || '--:--'}]
                    </option>
                  ))}
                </select>
              </div>

              {turnCount === 2 && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Turno 2 (Retorno)</label>
                  <select
                    value={turno2Id}
                    onChange={(e) => setTurno2Id(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar Turno 2...</option>
                    {turnos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.start_time} - {t.end_time}) [Ventana: {t.window_entry_start || '--:--'} a {t.window_exit_limit || '--:--'}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Días Laborables de la Semana</label>
                <div className="flex gap-1.5">
                  {allDaysList.map((d) => {
                    const isSelected = workingDays.includes(d.code);
                    return (
                      <button
                        type="button"
                        key={d.code}
                        onClick={() => toggleDay(d.code)}
                        className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-[#090A0D] text-slate-500 border border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowHorarioModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition-colors shadow-sm"
              >
                {editingHorario ? 'Actualizar Horario' : 'Guardar Horario'}
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
