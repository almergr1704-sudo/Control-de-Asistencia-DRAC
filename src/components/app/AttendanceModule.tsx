import React, { useState } from 'react';
import { AsistenciaProcesada, AsistenciaEstado, RoleType } from '../../types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  User,
  Building2,
  Filter,
  Download,
  Edit2,
  X,
  FileCheck2,
  Sliders,
  Info,
  Check,
} from 'lucide-react';
import { calculateShiftAndWorkedHours } from '../../utils/shiftCalculations';

interface AttendanceModuleProps {
  activeView?: string;
  attendanceData: AsistenciaProcesada[];
  activeRole: RoleType;
  activeUserDni: string;
  onEditAttendanceRecord?: (record: AsistenciaProcesada) => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  activeView,
  attendanceData,
  activeRole,
  activeUserDni,
  onEditAttendanceRecord,
}) => {
  const [selectedDate, setSelectedDate] = useState('2026-08-12');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'attendance_list') setStatusFilter('ALL');
    else if (activeView === 'attendance_punches') setStatusFilter('ALL');
    else if (activeView === 'attendance_incidents') setStatusFilter('LATE');
    else if (activeView === 'attendance_corrections') setStatusFilter('ALL');
  }, [activeView]);

  // Modal State for Manual Adjustment / Regularization
  const [editingRecord, setEditingRecord] = useState<AsistenciaProcesada | null>(null);
  const [editStatus, setEditStatus] = useState<AsistenciaEstado>('PUNCTUAL');
  const [editT1Entrada, setEditT1Entrada] = useState('');
  const [editT1Salida, setEditT1Salida] = useState('');
  const [editT2Entrada, setEditT2Entrada] = useState('');
  const [editT2Salida, setEditT2Salida] = useState('');
  const [editTardanza, setEditTardanza] = useState(0);
  const [editObservations, setEditObservations] = useState('');

  // Dynamic live calculation during edit in modal
  const editT1Calc = calculateShiftAndWorkedHours({
    startTime: editingRecord?.t1_scheduled_in || '08:00',
    endTime: editingRecord?.t1_scheduled_out || '13:00',
    windowEntryStart: editingRecord?.t1_window_entry_start || '07:00',
    windowExitLimit: editingRecord?.t1_window_exit_limit || '13:59',
    realIn: editT1Entrada,
    realOut: editT1Salida,
  });

  const editT2Calc = editingRecord?.t2_scheduled_in
    ? calculateShiftAndWorkedHours({
        startTime: editingRecord?.t2_scheduled_in || '14:00',
        endTime: editingRecord?.t2_scheduled_out || '17:00',
        windowEntryStart: editingRecord?.t2_window_entry_start || '13:30',
        windowExitLimit: editingRecord?.t2_window_exit_limit || '17:59',
        realIn: editT2Entrada,
        realOut: editT2Salida,
      })
    : null;

  const totalEffectiveHoursCalculated =
    editT1Calc.effectiveHours + (editT2Calc ? editT2Calc.effectiveHours : 0);

  // Filter records
  const filteredRecords = attendanceData.filter((rec) => {
    // Role filter
    if (activeRole === 'EMPLOYEE' && rec.employee_dni !== activeUserDni) {
      return false;
    }
    const matchesSearch =
      rec.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.employee_dni.includes(searchTerm) ||
      rec.area_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || rec.status === statusFilter;
    const matchesDate = !selectedDate || rec.fecha === selectedDate;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleOpenEdit = (rec: AsistenciaProcesada) => {
    setEditingRecord(rec);
    setEditStatus(rec.status);
    setEditT1Entrada(rec.t1_real_in || '08:00');
    setEditT1Salida(rec.t1_real_out || '13:00');
    setEditT2Entrada(rec.t2_real_in || '14:00');
    setEditT2Salida(rec.t2_real_out || '17:00');
    setEditTardanza(rec.net_tardiness_minutes || 0);
    setEditObservations(rec.observations || 'Regularización manual por RRHH');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !onEditAttendanceRecord) return;

    onEditAttendanceRecord({
      ...editingRecord,
      status: editStatus,
      t1_real_in: editT1Entrada || undefined,
      t1_real_out: editT1Salida || undefined,
      t1_effective_hours: editT1Calc.effectiveHours,
      t2_real_in: editT2Entrada || undefined,
      t2_real_out: editT2Salida || undefined,
      t2_effective_hours: editT2Calc ? editT2Calc.effectiveHours : undefined,
      total_effective_hours: totalEffectiveHoursCalculated,
      net_tardiness_minutes: editTardanza,
      observations: editObservations,
    });

    setEditingRecord(null);
  };

  const statusBadges: Record<AsistenciaEstado, { label: string; bg: string; icon: React.ReactNode }> = {
    PUNCTUAL: {
      label: 'PUNTUAL',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    },
    LATE: {
      label: 'TARDANZA',
      bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      icon: <Clock className="w-3 h-3 text-amber-500" />,
    },
    ABSENT: {
      label: 'FALTA',
      bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      icon: <XCircle className="w-3 h-3 text-rose-500" />,
    },
    VACATION: {
      label: 'VACACIONES',
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      icon: <Calendar className="w-3 h-3 text-indigo-400" />,
    },
    OUTING_PERMISSION: {
      label: 'PERMISO / PAPELETA',
      bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: <FileCheck2 className="w-3 h-3 text-purple-400" />,
    },
    REST_DAY: {
      label: 'DESCANSO',
      bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      icon: <Clock className="w-3 h-3 text-slate-400" />,
    },
    WORK_ON_REST_DAY: {
      label: 'TRABAJO EN DESCANSO',
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: <CheckCircle2 className="w-3 h-3 text-blue-400" />,
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Sábana de Asistencia Procesada &amp; Cómputo de Horas Efectivas
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Consolidado de marcaciones en ventanas biométricas, validación de turnos y cómputo de horas trabajadas según normativa DRAC.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Generando consolidado oficial en Excel / PDF...')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Asistencia</span>
          </button>
        </div>
      </div>

      {/* Info Card: Punch Window & Calculation Rule */}
      <div className="bg-[#090A0D] border border-indigo-950 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-indigo-300">
            Regla de Cómputo de Horas Trabajadas (DRAC):
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Las marcaciones dentro de la <strong>Ventana Permitida (TIME)</strong> comprueban la asistencia. El tiempo efectivo computado se calcula <strong className="text-slate-200">estrictamente a partir del Horario del Turno (TIME)</strong> con evaluación estricta a la hora de salida (sin tolerancia de salida; salidas anticipadas son descontadas).
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#090A0D] px-3 py-1.5 rounded border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-medium">Fecha:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-200 font-mono focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#090A0D] px-3 py-1.5 rounded border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PUNCTUAL">Puntual</option>
              <option value="LATE">Tardanza</option>
              <option value="ABSENT">Falta</option>
              <option value="VACATION">Vacaciones</option>
              <option value="OUTING_PERMISSION">Papeleta / Permiso</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Filtrar por empleado, DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 bg-[#090A0D] text-slate-200 border border-slate-800 rounded focus:outline-none focus:border-indigo-600 min-w-[200px]"
          />
        </div>

        <div className="text-slate-500 font-mono">
          Registros: {filteredRecords.length}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Empleado / DNI</th>
                <th className="px-4 py-3">Área / Fecha</th>
                <th className="px-4 py-3">Turno 1 (Turno / Ventana / Real)</th>
                <th className="px-4 py-3">Turno 2 (Turno / Ventana / Real)</th>
                <th className="px-4 py-3 text-center">Horas Efectivas</th>
                <th className="px-4 py-3 text-center">Tardanza</th>
                <th className="px-4 py-3 text-center">Estado Final</th>
                <th className="px-4 py-3">Observaciones &amp; Cómputo</th>
                {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                  <th className="px-4 py-3 text-right">Acción</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {filteredRecords.map((rec) => {
                const badge = statusBadges[rec.status] || statusBadges.PUNCTUAL;
                const effHours = rec.total_effective_hours !== undefined
                  ? rec.total_effective_hours
                  : (rec.t1_effective_hours || 0) + (rec.t2_effective_hours || 0);

                return (
                  <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{rec.employee_name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">DNI: {rec.employee_dni}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      <div className="font-medium text-slate-200">{rec.area_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{rec.fecha}</div>
                    </td>

                    {/* Turno 1 */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-slate-400">
                        Turno: <span className="text-white font-semibold">{rec.t1_scheduled_in || '--:--'} - {rec.t1_scheduled_out || '--:--'}</span>
                      </div>
                      <div className="text-indigo-400 text-[10px]">
                        Ventana: {rec.t1_window_entry_start || '--:--'} a {rec.t1_window_exit_limit || '--:--'}
                      </div>
                      <div className="text-emerald-400 font-bold">
                        Real: {rec.t1_real_in || '--:--'} - {rec.t1_real_out || '--:--'}
                      </div>
                      {rec.t1_effective_hours !== undefined && (
                        <div className="text-[10px] text-slate-400">
                          Cómputo T1: <strong className="text-emerald-300">{rec.t1_effective_hours}h</strong>
                        </div>
                      )}
                    </td>

                    {/* Turno 2 */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {rec.t2_scheduled_in ? (
                        <>
                          <div className="text-slate-400">
                            Turno: <span className="text-white font-semibold">{rec.t2_scheduled_in} - {rec.t2_scheduled_out}</span>
                          </div>
                          <div className="text-indigo-400 text-[10px]">
                            Ventana: {rec.t2_window_entry_start || '--:--'} a {rec.t2_window_exit_limit || '--:--'}
                          </div>
                          <div className="text-emerald-400 font-bold">
                            Real: {rec.t2_real_in || '--:--'} - {rec.t2_real_out || '--:--'}
                          </div>
                          {rec.t2_effective_hours !== undefined && (
                            <div className="text-[10px] text-slate-400">
                              Cómputo T2: <strong className="text-emerald-300">{rec.t2_effective_hours}h</strong>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-600 text-[10px] italic">Jornada Continua</span>
                      )}
                    </td>

                    {/* Horas Efectivas Computadas */}
                    <td className="px-4 py-3 text-center font-mono">
                      <div className="text-emerald-400 font-bold text-xs bg-emerald-950/40 border border-emerald-900/60 px-2 py-1 rounded inline-block">
                        {effHours > 0 ? `${effHours.toFixed(1)} hrs` : '0.0 hrs'}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Topado a Turno</div>
                    </td>

                    {/* Tardanza */}
                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {rec.total_tardiness_minutes > 0 ? (
                        <span className="text-amber-500">{rec.total_tardiness_minutes} min</span>
                      ) : (
                        <span className="text-slate-600">0 min</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold border rounded uppercase inline-flex items-center gap-1 font-mono ${badge.bg}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-400 text-[11px] max-w-xs">
                      <div className="truncate">{rec.observations || 'Marcación regular en ventana permitida'}</div>
                    </td>

                    {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR' || activeRole === 'ADMIN_GENERAL' || activeRole === 'JEFE_RRHH' || activeRole === 'CONTROL_ASISTENCIA') && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[11px] font-semibold border border-indigo-500/30 transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Regularizar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: EDIT / REGULARIZE ATTENDANCE */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                Regularización de Asistencia &amp; Cómputo
              </h3>
              <button type="button" onClick={() => setEditingRecord(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800 space-y-1">
              <div className="font-bold text-white text-xs">{editingRecord.employee_name}</div>
              <div className="text-slate-400 font-mono text-[11px]">
                DNI: {editingRecord.employee_dni} | Fecha: {editingRecord.fecha} | {editingRecord.horario_name}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Estado de Asistencia Determinado</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AsistenciaEstado)}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                >
                  <option value="PUNCTUAL">PUNCTUAL (Puntual / Asistió Normal)</option>
                  <option value="LATE">LATE (Tardanza)</option>
                  <option value="ABSENT">ABSENT (Inasistencia / Falta)</option>
                  <option value="VACATION">VACATION (Vacaciones Autorizadas)</option>
                  <option value="OUTING_PERMISSION">OUTING_PERMISSION (Con Papeleta / Permiso)</option>
                </select>
              </div>

              {/* Turno 1 Edits & Live Computation */}
              <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                  <span>Turno 1 ({editingRecord.t1_scheduled_in || '--:--'} - {editingRecord.t1_scheduled_out || '--:--'})</span>
                  <span className="text-indigo-400 font-mono text-[10px]">
                    Ventana: {editingRecord.t1_window_entry_start || '--:--'} a {editingRecord.t1_window_exit_limit || '--:--'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Entrada Real (TIME)</label>
                    <input
                      type="time"
                      value={editT1Entrada}
                      onChange={(e) => setEditT1Entrada(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#0F1115] text-emerald-400 font-bold border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Salida Real (TIME)</label>
                    <input
                      type="time"
                      value={editT1Salida}
                      onChange={(e) => setEditT1Salida(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#0F1115] text-amber-400 font-bold border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span>Cómputo Efectivo T1: <strong className="text-emerald-400">{editT1Calc.effectiveDurationText} ({editT1Calc.effectiveHours}h)</strong></span>
                  <span className={editT1Calc.isValidPunchWindow ? 'text-emerald-400' : 'text-amber-400'}>
                    {editT1Calc.isValidPunchWindow ? '✓ En Ventana' : '⚠️ Fuera de Rango'}
                  </span>
                </div>
              </div>

              {/* Turno 2 Edits & Live Computation (if applicable) */}
              {editingRecord.t2_scheduled_in && (
                <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-bold text-[11px]">
                    <span>Turno 2 ({editingRecord.t2_scheduled_in} - {editingRecord.t2_scheduled_out})</span>
                    <span className="text-indigo-400 font-mono text-[10px]">
                      Ventana: {editingRecord.t2_window_entry_start || '--:--'} a {editingRecord.t2_window_exit_limit || '--:--'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Entrada Real (TIME)</label>
                      <input
                        type="time"
                        value={editT2Entrada}
                        onChange={(e) => setEditT2Entrada(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0F1115] text-emerald-400 font-bold border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Salida Real (TIME)</label>
                      <input
                        type="time"
                        value={editT2Salida}
                        onChange={(e) => setEditT2Salida(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0F1115] text-amber-400 font-bold border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  {editT2Calc && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span>Cómputo Efectivo T2: <strong className="text-emerald-400">{editT2Calc.effectiveDurationText} ({editT2Calc.effectiveHours}h)</strong></span>
                      <span className={editT2Calc.isValidPunchWindow ? 'text-emerald-400' : 'text-amber-400'}>
                        {editT2Calc.isValidPunchWindow ? '✓ En Ventana' : '⚠️ Fuera de Rango'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Total Hours Computed Card */}
              <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">Total Horas Efectivas Computadas:</span>
                <span className="text-emerald-400 font-bold text-sm bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {totalEffectiveHoursCalculated.toFixed(1)} hrs
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Minutos de Tardanza Ajustados</label>
                <input
                  type="number"
                  min={0}
                  value={editTardanza}
                  onChange={(e) => setEditTardanza(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Motivo / Justificación de Ajuste Manual</label>
                <textarea
                  rows={2}
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                  placeholder="Escriba la razón de la regularización..."
                  className="w-full px-3 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition-colors shadow-sm"
              >
                Guardar Regularización
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
