import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calculator,
  Search,
  Filter,
  Users,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
  X,
  Save,
  RefreshCw,
  Tag,
  Check,
} from 'lucide-react';
import { Turno, Horario, AsignacionHorario, TipoAsignacionHorario, Employee } from '../../types';
import {
  fetchTurnosFromSupabase,
  saveTurnoToSupabase,
  deleteTurnoFromSupabase,
  fetchHorariosFromSupabase,
  saveHorarioToSupabase,
  deleteHorarioFromSupabase,
  fetchAsignacionesFromSupabase,
  saveAsignacionToSupabase,
  deleteAsignacionFromSupabase,
} from '../../services/scheduleService';
import { INITIAL_TURNOS, INITIAL_HORARIOS } from '../../data/initialData';
import { normalizeInstitutionalName, normalizePersonName, normalizeText } from '../../utils/nameUtils';

interface ShiftsSchedulesModuleProps {
  activeSubView?: string;
  activeRole?: string;
  employees?: Employee[];
  onRecordAudit?: (action: string, description: string) => void;
}

export const ShiftsSchedulesModule: React.FC<ShiftsSchedulesModuleProps> = ({
  activeSubView,
  activeRole = 'ADMIN_GENERAL',
  employees = [],
  onRecordAudit,
}) => {
  // Determine initial tab from activeSubView
  const getInitialTab = (): 'turnos' | 'horarios' | 'asignaciones' | 'calculadora' => {
    if (activeSubView === 'shifts_turnos') return 'turnos';
    if (activeSubView === 'shifts_horarios') return 'horarios';
    if (activeSubView === 'shifts_assign') return 'asignaciones';
    return 'turnos';
  };

  const [activeTab, setActiveTab] = useState<'turnos' | 'horarios' | 'asignaciones' | 'calculadora'>(getInitialTab());

  // Listen for changes in activeSubView prop
  useEffect(() => {
    if (activeSubView === 'shifts_turnos') setActiveTab('turnos');
    else if (activeSubView === 'shifts_horarios') setActiveTab('horarios');
    else if (activeSubView === 'shifts_assign') setActiveTab('asignaciones');
  }, [activeSubView]);

  // Data States
  const [turnos, setTurnos] = useState<Turno[]>(INITIAL_TURNOS);
  const [horarios, setHorarios] = useState<Horario[]>(INITIAL_HORARIOS);
  const [asignaciones, setAsignaciones] = useState<AsignacionHorario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipoAsignacion, setFilterTipoAsignacion] = useState<'ALL' | 'TEMPORAL' | 'PERMANENTE'>('ALL');

  // Modals States
  const [isTurnoModalOpen, setIsTurnoModalOpen] = useState(false);
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null);

  const [isHorarioModalOpen, setIsHorarioModalOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);

  const [isAsignacionModalOpen, setIsAsignacionModalOpen] = useState(false);
  const [editingAsignacion, setEditingAsignacion] = useState<AsignacionHorario | null>(null);

  // Delete Confirmations
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'turno' | 'horario' | 'asignacion';
    id: string;
    name: string;
  } | null>(null);

  // In-Memory Calculator State
  const [calcTime, setCalcTime] = useState('08:08');
  const [calcShift, setCalcShift] = useState<'T1' | 'T2'>('T1');

  // Form State: Turno
  const [turnoForm, setTurnoForm] = useState({
    code: '',
    name: '',
    description: '',
    start_time: '08:00',
    end_time: '13:00',
    window_entry_start: '07:00',
    window_exit_limit: '13:30',
    tolerance_minutes: 10,
    tolerance_exit_minutes: 0,
    is_overnight: false,
    active: true,
  });

  // Form State: Horario
  const [horarioForm, setHorarioForm] = useState({
    code: '',
    name: '',
    turn_count: 2 as 1 | 2,
    turno1_id: '',
    turno2_id: '',
    working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    active: true,
  });

  // Form State: Asignacion
  const [asignacionForm, setAsignacionForm] = useState({
    employee_id: '',
    horario_id: '',
    tipo_asignacion: 'PERMANENTE' as TipoAsignacionHorario,
    fecha_inicio: new Date().toISOString().substring(0, 10),
    fecha_fin: '',
    motivo: '',
    documento_sustento: '',
    activo: true,
  });

  // Show auto-dismiss feedback
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Load all schedule data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, hList, aList] = await Promise.all([
        fetchTurnosFromSupabase(),
        fetchHorariosFromSupabase(),
        fetchAsignacionesFromSupabase(),
      ]);
      if (tList && tList.length > 0) setTurnos(tList);
      if (hList && hList.length > 0) setHorarios(hList);
      if (aList) setAsignaciones(aList);
    } catch (err) {
      console.warn('Aviso cargando datos de turnos/horarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set default turno IDs for Horario Form when turnos load
  useEffect(() => {
    if (turnos.length > 0 && !horarioForm.turno1_id) {
      setHorarioForm((prev) => ({
        ...prev,
        turno1_id: turnos[0]?.id || '',
        turno2_id: turnos[1]?.id || '',
      }));
    }
  }, [turnos]);

  // Set default employee and horario for Asignacion Form
  useEffect(() => {
    if (employees.length > 0 && !asignacionForm.employee_id) {
      setAsignacionForm((prev) => ({
        ...prev,
        employee_id: employees[0]?.id || '',
        horario_id: horarios[0]?.id || '',
      }));
    }
  }, [employees, horarios]);

  // ----------------------------------------------------
  // TURNO HANDLERS
  // ----------------------------------------------------
  const handleOpenTurnoModal = (turno?: Turno) => {
    if (turno) {
      setEditingTurno(turno);
      setTurnoForm({
        code: turno.code,
        name: turno.name,
        description: turno.description || '',
        start_time: turno.start_time,
        end_time: turno.end_time,
        window_entry_start: turno.window_entry_start || '07:00',
        window_exit_limit: turno.window_exit_limit || '13:30',
        tolerance_minutes: turno.tolerance_minutes,
        tolerance_exit_minutes: turno.tolerance_exit_minutes || 0,
        is_overnight: turno.is_overnight,
        active: turno.active !== undefined ? turno.active : true,
      });
    } else {
      setEditingTurno(null);
      const nextCodeNum = turnos.length + 1;
      setTurnoForm({
        code: `T-0${nextCodeNum}`,
        name: '',
        description: '',
        start_time: '08:00',
        end_time: '13:00',
        window_entry_start: '07:00',
        window_exit_limit: '13:30',
        tolerance_minutes: 10,
        tolerance_exit_minutes: 0,
        is_overnight: false,
        active: true,
      });
    }
    setIsTurnoModalOpen(true);
  };

  const handleSaveTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoForm.name.trim()) {
      showFeedback('error', 'El nombre del turno es obligatorio.');
      return;
    }

    const turnoToSave: Turno = {
      id: editingTurno ? editingTurno.id : `turno-${Date.now()}`,
      code: turnoForm.code.trim().toUpperCase() || `T-${Date.now().toString().slice(-3)}`,
      name: normalizeInstitutionalName(turnoForm.name),
      description: turnoForm.description.trim(),
      start_time: turnoForm.start_time,
      end_time: turnoForm.end_time,
      window_entry_start: turnoForm.window_entry_start,
      window_exit_limit: turnoForm.window_exit_limit,
      tolerance_minutes: Number(turnoForm.tolerance_minutes) || 10,
      tolerance_exit_minutes: Number(turnoForm.tolerance_exit_minutes) || 0,
      is_overnight: turnoForm.is_overnight,
      active: turnoForm.active,
      created_at: editingTurno?.created_at || new Date().toISOString(),
    };

    const res = await saveTurnoToSupabase(turnoToSave);
    if (res.success) {
      setTurnos((prev) => {
        const index = prev.findIndex((t) => t.id === turnoToSave.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = turnoToSave;
          return next;
        }
        return [...prev, turnoToSave];
      });
      showFeedback('success', editingTurno ? 'Turno actualizado exitosamente.' : 'Nuevo turno registrado.');
      setIsTurnoModalOpen(false);
      if (onRecordAudit) {
        onRecordAudit(
          editingTurno ? 'TURNO_EDITADO' : 'TURNO_CREADO',
          `Turno ${turnoToSave.code} (${turnoToSave.name}) guardado correctamente.`
        );
      }
    } else {
      showFeedback('error', res.message || 'Error al guardar el turno.');
    }
  };

  const handleDeleteTurno = async (id: string) => {
    const res = await deleteTurnoFromSupabase(id);
    if (res.success) {
      setTurnos((prev) => prev.filter((t) => t.id !== id));
      showFeedback('success', 'Turno eliminado del catálogo.');
      setDeleteTarget(null);
      if (onRecordAudit) {
        onRecordAudit('TURNO_ELIMINADO', `Se eliminó el turno con identificador ${id}.`);
      }
    } else {
      showFeedback('error', res.message || 'No se pudo eliminar el turno.');
    }
  };

  // ----------------------------------------------------
  // HORARIO HANDLERS
  // ----------------------------------------------------
  const handleOpenHorarioModal = (horario?: Horario) => {
    if (horario) {
      setEditingHorario(horario);
      setHorarioForm({
        code: horario.code,
        name: horario.name,
        turn_count: horario.turn_count,
        turno1_id: horario.turno1_id,
        turno2_id: horario.turno2_id || '',
        working_days: horario.working_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        active: horario.active,
      });
    } else {
      setEditingHorario(null);
      const nextCodeNum = horarios.length + 1;
      setHorarioForm({
        code: `HOR-0${nextCodeNum}`,
        name: '',
        turn_count: 2,
        turno1_id: turnos[0]?.id || '',
        turno2_id: turnos[1]?.id || '',
        working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        active: true,
      });
    }
    setIsHorarioModalOpen(true);
  };

  const handleSaveHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horarioForm.name.trim()) {
      showFeedback('error', 'El nombre del horario es obligatorio.');
      return;
    }
    if (!horarioForm.turno1_id) {
      showFeedback('error', 'Debe seleccionar al menos el primer turno.');
      return;
    }

    const t1 = turnos.find((t) => t.id === horarioForm.turno1_id);
    const t2 = horarioForm.turn_count === 2 ? turnos.find((t) => t.id === horarioForm.turno2_id) : null;

    // Calculate estimated daily hours
    let hours = 8;
    if (t1) {
      const [h1s, m1s] = t1.start_time.split(':').map(Number);
      const [h1e, m1e] = t1.end_time.split(':').map(Number);
      const dur1 = (h1e * 60 + m1e - (h1s * 60 + m1s)) / 60;
      hours = dur1;
      if (t2) {
        const [h2s, m2s] = t2.start_time.split(':').map(Number);
        const [h2e, m2e] = t2.end_time.split(':').map(Number);
        const dur2 = (h2e * 60 + m2e - (h2s * 60 + m2s)) / 60;
        hours += dur2;
      }
    }

    const horarioToSave: Horario = {
      id: editingHorario ? editingHorario.id : `hor-${Date.now()}`,
      code: horarioForm.code.trim().toUpperCase() || `HOR-${Date.now().toString().slice(-3)}`,
      name: normalizeInstitutionalName(horarioForm.name),
      turn_count: horarioForm.turn_count,
      turno1_id: horarioForm.turno1_id,
      turno1_name: t1 ? `${t1.name} (${t1.start_time} - ${t1.end_time})` : '',
      turno2_id: horarioForm.turn_count === 2 ? horarioForm.turno2_id : null,
      turno2_name: t2 ? `${t2.name} (${t2.start_time} - ${t2.end_time})` : undefined,
      working_days: horarioForm.working_days,
      active: horarioForm.active,
      effective_start_date: editingHorario?.effective_start_date || '2026-01-01',
      effective_end_date: editingHorario?.effective_end_date || null,
      version: (editingHorario?.version || 1) + (editingHorario ? 1 : 0),
      total_hours: Math.round(hours * 10) / 10,
      total_duration_text: `${Math.round(hours * 10) / 10} horas diarias (${horarioForm.turn_count} turno${horarioForm.turn_count > 1 ? 's' : ''})`,
    };

    const res = await saveHorarioToSupabase(horarioToSave);
    if (res.success) {
      setHorarios((prev) => {
        const index = prev.findIndex((h) => h.id === horarioToSave.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = horarioToSave;
          return next;
        }
        return [...prev, horarioToSave];
      });
      showFeedback('success', editingHorario ? 'Horario actualizado exitosamente.' : 'Nuevo horario registrado.');
      setIsHorarioModalOpen(false);
      if (onRecordAudit) {
        onRecordAudit(
          editingHorario ? 'HORARIO_EDITADO' : 'HORARIO_CREADO',
          `Horario ${horarioToSave.code} (${horarioToSave.name}) guardado correctamente.`
        );
      }
    } else {
      showFeedback('error', res.message || 'Error al guardar el horario.');
    }
  };

  const handleDeleteHorario = async (id: string) => {
    const res = await deleteHorarioFromSupabase(id);
    if (res.success) {
      setHorarios((prev) => prev.filter((h) => h.id !== id));
      showFeedback('success', 'Horario eliminado del catálogo.');
      setDeleteTarget(null);
      if (onRecordAudit) {
        onRecordAudit('HORARIO_ELIMINADO', `Se eliminó el horario con identificador ${id}.`);
      }
    } else {
      showFeedback('error', res.message || 'No se pudo eliminar el horario.');
    }
  };

  // ----------------------------------------------------
  // ASIGNACION HANDLERS (PERMANENTES Y TEMPORALES)
  // ----------------------------------------------------
  const handleOpenAsignacionModal = (asignacion?: AsignacionHorario) => {
    if (asignacion) {
      setEditingAsignacion(asignacion);
      setAsignacionForm({
        employee_id: asignacion.employee_id,
        horario_id: asignacion.horario_id,
        tipo_asignacion: asignacion.tipo_asignacion,
        fecha_inicio: asignacion.fecha_inicio || new Date().toISOString().substring(0, 10),
        fecha_fin: asignacion.fecha_fin || '',
        motivo: asignacion.motivo || '',
        documento_sustento: asignacion.documento_sustento || '',
        activo: asignacion.activo,
      });
    } else {
      setEditingAsignacion(null);
      setAsignacionForm({
        employee_id: employees[0]?.id || '',
        horario_id: horarios[0]?.id || '',
        tipo_asignacion: 'TEMPORAL',
        fecha_inicio: new Date().toISOString().substring(0, 10),
        fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
        motivo: 'Asignación temporal por necesidad de servicio',
        documento_sustento: 'Memorando N° 001-2026-DRAC',
        activo: true,
      });
    }
    setIsAsignacionModalOpen(true);
  };

  const handleSaveAsignacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignacionForm.employee_id) {
      showFeedback('error', 'Debe seleccionar un trabajador.');
      return;
    }
    if (!asignacionForm.horario_id) {
      showFeedback('error', 'Debe seleccionar un horario laboral.');
      return;
    }
    if (asignacionForm.tipo_asignacion === 'TEMPORAL' && !asignacionForm.fecha_fin) {
      showFeedback('error', 'Para asignaciones temporales la fecha de fin es obligatoria.');
      return;
    }

    const emp = employees.find((e) => e.id === asignacionForm.employee_id);
    const hor = horarios.find((h) => h.id === asignacionForm.horario_id);

    const asignacionToSave: AsignacionHorario = {
      id: editingAsignacion ? editingAsignacion.id : `asig-${Date.now()}`,
      employee_id: asignacionForm.employee_id,
      employee_dni: emp ? emp.dni : (editingAsignacion?.employee_dni || '10000001'),
      employee_name: emp
        ? normalizePersonName(`${emp.first_name} ${emp.last_name}`)
        : (editingAsignacion?.employee_name || 'Servidor DRAC'),
      employee_cargo: normalizeInstitutionalName(emp?.position || editingAsignacion?.employee_cargo || 'Servidor DRAC'),
      dependencia_name: normalizeInstitutionalName(emp?.dependencia_name || editingAsignacion?.dependencia_name || 'Sede Central - DRAC Cajamarca'),
      area_name: normalizeInstitutionalName(emp?.area_name || editingAsignacion?.area_name || 'General'),
      horario_id: asignacionForm.horario_id,
      horario_name: normalizeInstitutionalName(hor ? hor.name : (editingAsignacion?.horario_name || 'Horario Institucional')),
      horario_code: hor?.code || editingAsignacion?.horario_code || 'HOR-01',
      fecha_inicio: asignacionForm.fecha_inicio,
      fecha_fin: asignacionForm.tipo_asignacion === 'TEMPORAL' ? asignacionForm.fecha_fin : null,
      tipo_asignacion: asignacionForm.tipo_asignacion,
      motivo: normalizeText(asignacionForm.motivo.trim() || (asignacionForm.tipo_asignacion === 'TEMPORAL' ? 'Asignación temporal por servicio' : 'Horario regular')),
      documento_sustento: normalizeText(asignacionForm.documento_sustento.trim() || 'Memorando Institucional'),
      activo: asignacionForm.activo,
      created_at: editingAsignacion?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await saveAsignacionToSupabase(asignacionToSave);
    if (res.success) {
      setAsignaciones((prev) => {
        const index = prev.findIndex((a) => a.id === asignacionToSave.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = asignacionToSave;
          return next;
        }
        return [asignacionToSave, ...prev];
      });
      showFeedback(
        'success',
        editingAsignacion
          ? 'Asignación de horario actualizada exitosamente.'
          : `Horario asignado correctamente (${asignacionToSave.tipo_asignacion}).`
      );
      setIsAsignacionModalOpen(false);
      if (onRecordAudit) {
        onRecordAudit(
          editingAsignacion ? 'ASIGNACION_HORARIO_EDITADA' : 'ASIGNACION_HORARIO_CREADA',
          `Asignación ${asignacionToSave.tipo_asignacion} de ${asignacionToSave.horario_name} a ${asignacionToSave.employee_name} (DNI ${asignacionToSave.employee_dni}).`
        );
      }
    } else {
      showFeedback('error', res.message || 'Error al guardar la asignación.');
    }
  };

  const handleDeleteAsignacion = async (id: string) => {
    const res = await deleteAsignacionFromSupabase(id);
    if (res.success) {
      setAsignaciones((prev) => prev.filter((a) => a.id !== id));
      showFeedback('success', 'Asignación de horario eliminada.');
      setDeleteTarget(null);
      if (onRecordAudit) {
        onRecordAudit('ASIGNACION_HORARIO_ELIMINADA', `Se eliminó la asignación de horario ${id}.`);
      }
    } else {
      showFeedback('error', res.message || 'No se pudo eliminar la asignación.');
    }
  };

  // Filtered Asignaciones
  const filteredAsignaciones = useMemo(() => {
    return asignaciones.filter((asig) => {
      // Filter by type
      if (filterTipoAsignacion !== 'ALL' && asig.tipo_asignacion !== filterTipoAsignacion) {
        return false;
      }
      // Filter by search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = asig.employee_name?.toLowerCase().includes(query);
        const matchDni = asig.employee_dni?.includes(query);
        const matchHor = asig.horario_name?.toLowerCase().includes(query);
        const matchMotivo = asig.motivo?.toLowerCase().includes(query);
        return matchName || matchDni || matchHor || matchMotivo;
      }
      return true;
    });
  }, [asignaciones, filterTipoAsignacion, searchQuery]);

  // Evaluate RIS Rule in memory for calculator
  const evaluation = useMemo(() => {
    const [h, m] = calcTime.split(':').map(Number);
    const totalMinutes = h * 60 + m;

    if (calcShift === 'T1') {
      const scheduledMinutes = 8 * 60; // 08:00
      const toleranceMinutes = scheduledMinutes + 10; // 08:10

      if (totalMinutes <= scheduledMinutes) {
        return { status: 'PUNCTUAL', tardiness: 0, netTardiness: 0, desc: 'Puntual (Sin tardanza)' };
      } else if (totalMinutes <= toleranceMinutes) {
        return {
          status: 'TOLERANCE',
          tardiness: totalMinutes - scheduledMinutes,
          netTardiness: 0,
          desc: 'Dentro del periodo de tolerancia (10 min)',
        };
      } else {
        return {
          status: 'LATE',
          tardiness: totalMinutes - scheduledMinutes,
          netTardiness: totalMinutes - toleranceMinutes,
          desc: `Tardanza computada (${totalMinutes - toleranceMinutes} min netos)`,
        };
      }
    } else {
      const scheduledMinutes = 14 * 60; // 14:00
      const toleranceMinutes = scheduledMinutes + 5; // 14:05

      if (totalMinutes <= scheduledMinutes) {
        return { status: 'PUNCTUAL', tardiness: 0, netTardiness: 0, desc: 'Puntual (Sin tardanza)' };
      } else if (totalMinutes <= toleranceMinutes) {
        return {
          status: 'TOLERANCE',
          tardiness: totalMinutes - scheduledMinutes,
          netTardiness: 0,
          desc: 'Dentro del periodo de tolerancia (5 min)',
        };
      } else {
        return {
          status: 'LATE',
          tardiness: totalMinutes - scheduledMinutes,
          netTardiness: totalMinutes - toleranceMinutes,
          desc: `Tardanza computada (${totalMinutes - toleranceMinutes} min netos)`,
        };
      }
    }
  }, [calcTime, calcShift]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-950/80 text-indigo-400 rounded-xl border border-indigo-800/50">
              <Clock className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Gestión de Turnos, Horarios y Asignaciones</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  RIS DRAC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configuración oficial de turnos institucionales, plantillas de horarios y asignaciones permanentes o temporales del personal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              Actualizar
            </button>

            {activeTab === 'turnos' && (
              <button
                type="button"
                onClick={() => handleOpenTurnoModal()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo Turno
              </button>
            )}

            {activeTab === 'horarios' && (
              <button
                type="button"
                onClick={() => handleOpenHorarioModal()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo Horario
              </button>
            )}

            {activeTab === 'asignaciones' && (
              <button
                type="button"
                onClick={() => handleOpenAsignacionModal()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Asignar Horario
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedbackMessage && (
          <div
            className={`mt-4 p-3 rounded-lg border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                : 'bg-rose-950/70 border-rose-500/60 text-rose-200'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-800/80 pt-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('turnos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'turnos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Turnos Laborales ({turnos.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('horarios')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'horarios'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Horarios Laborales ({horarios.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('asignaciones')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'asignaciones'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Asignaciones de Horarios ({asignaciones.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calculadora')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'calculadora'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Calculadora Tolerancia RIS
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: TURNOS LABORALES */}
      {/* ==================================================== */}
      {activeTab === 'turnos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {turnos.map((turno) => (
              <div
                key={turno.id}
                className="bg-[#0F1115] border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {turno.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            turno.active
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {turno.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-white mt-1.5">{turno.name}</h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenTurnoModal(turno)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar Turno"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'turno',
                            id: turno.id,
                            name: `${turno.code} - ${turno.name}`,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Eliminar Turno"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {turno.description && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {turno.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-[#090A0D] border border-slate-800 rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Entrada</span>
                      <span className="font-mono text-sm font-bold text-emerald-400 mt-0.5 block">
                        {turno.start_time} hrs
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Tolerancia: {turno.tolerance_minutes} min
                      </span>
                    </div>

                    <div className="p-2.5 bg-[#090A0D] border border-slate-800 rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Salida</span>
                      <span className="font-mono text-sm font-bold text-indigo-300 mt-0.5 block">
                        {turno.end_time} hrs
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {turno.is_overnight ? 'Turno nocturno' : 'Mismo día'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900/40 border border-slate-800/80 rounded-lg text-[11px] font-mono text-slate-300 flex items-center justify-between">
                    <span className="text-slate-500">Ventana Biométrica:</span>
                    <span>{turno.window_entry_start || '07:00'} - {turno.window_exit_limit || '17:30'}</span>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-500 font-mono">
                  Registrado: {new Date(turno.created_at).toLocaleDateString('es-PE')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: HORARIOS LABORALES */}
      {/* ==================================================== */}
      {activeTab === 'horarios' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {horarios.map((horario) => (
              <div
                key={horario.id}
                className="bg-[#0F1115] border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {horario.code}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {horario.turn_count} {horario.turn_count === 1 ? 'Turno Diario' : 'Turnos Diarios'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          horario.active
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {horario.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-white mt-1.5">{horario.name}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenHorarioModal(horario)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar Horario"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'horario',
                          id: horario.id,
                          name: `${horario.code} - ${horario.name}`,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Eliminar Horario"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Turnos incluidos en este horario */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Turnos que integran este horario:
                  </span>

                  {/* Turno 1 */}
                  <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-slate-200">
                        {horario.turno1_name || 'Turno 1'}
                      </span>
                    </div>
                    <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                      Primer Turno
                    </span>
                  </div>

                  {/* Turno 2 (si aplica) */}
                  {horario.turn_count === 2 && (
                    <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                        <span className="font-bold text-slate-200">
                          {horario.turno2_name || 'Turno 2'}
                        </span>
                      </div>
                      <span className="font-mono text-indigo-300 font-semibold text-[11px]">
                        Segundo Turno
                      </span>
                    </div>
                  )}
                </div>

                {/* Resumen de días y horas */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Días:</span>
                    <div className="flex items-center gap-1">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => {
                        const isWork = horario.working_days?.includes(d);
                        const labels: Record<string, string> = {
                          MON: 'L',
                          TUE: 'M',
                          WED: 'M',
                          THU: 'J',
                          FRI: 'V',
                          SAT: 'S',
                        };
                        return (
                          <span
                            key={d}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                              isWork
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                                : 'bg-slate-900 text-slate-600 border border-slate-800'
                            }`}
                          >
                            {labels[d]}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <span className="font-mono font-bold text-indigo-400 text-xs">
                    {horario.total_hours || 8} horas diarias
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: ASIGNACIONES DE HORARIOS (PERMANENTES Y TEMPORALES) */}
      {/* ==================================================== */}
      {activeTab === 'asignaciones' && (
        <div className="space-y-4">
          {/* SEARCH & FILTER CONTROLS */}
          <div className="bg-[#090A0D] border border-slate-800 p-3.5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nombre, DNI o motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter by Type */}
            <div className="flex items-center gap-1.5 self-stretch md:self-auto justify-end">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-500" /> Tipo:
              </span>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterTipoAsignacion('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    filterTipoAsignacion === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todas ({asignaciones.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTipoAsignacion('TEMPORAL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    filterTipoAsignacion === 'TEMPORAL'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Temporales ({asignaciones.filter((a) => a.tipo_asignacion === 'TEMPORAL').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTipoAsignacion('PERMANENTE')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    filterTipoAsignacion === 'PERMANENTE'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Permanentes ({asignaciones.filter((a) => a.tipo_asignacion === 'PERMANENTE').length})
                </button>
              </div>
            </div>
          </div>

          {/* ASIGNACIONES LIST / CARDS */}
          {filteredAsignaciones.length === 0 ? (
            <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <UserCheck className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">
                No se encontraron asignaciones de horario
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay registros que coincidan con los filtros seleccionados. Puede crear una nueva asignación temporal o permanente haciendo clic en el botón superior.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAsignacionModal()}
                className="mt-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Asignar Horario Ahora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAsignaciones.map((asig) => {
                const isTemporal = asig.tipo_asignacion === 'TEMPORAL';

                return (
                  <div
                    key={asig.id}
                    className={`bg-[#0F1115] border rounded-xl p-4 space-y-3 transition-all shadow-sm flex flex-col justify-between ${
                      isTemporal
                        ? 'border-amber-600/40 hover:border-amber-500/70 bg-gradient-to-br from-amber-950/10 via-[#0F1115] to-[#0F1115]'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Top Badges & Actions */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isTemporal
                                ? 'bg-amber-950 text-amber-300 border border-amber-700/80'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            }`}
                          >
                            {asig.tipo_asignacion}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              asig.activo
                                ? 'text-emerald-400 bg-emerald-950/80'
                                : 'text-slate-500 bg-slate-900'
                            }`}
                          >
                            {asig.activo ? 'Vigente' : 'Inactivo'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAsignacionModal(asig)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar Asignación"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'asignacion',
                                id: asig.id,
                                name: `Asignación de ${asig.employee_name}`,
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Eliminar Asignación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Employee info */}
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{asig.employee_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          DNI: <strong className="text-slate-200">{asig.employee_dni}</strong>
                          {asig.employee_cargo && (
                            <span className="text-slate-400 font-sans ml-1.5">| {asig.employee_cargo}</span>
                          )}
                        </div>
                      </div>

                      {/* Assigned Horario Card */}
                      <div className="p-2.5 bg-[#090A0D] border border-slate-800 rounded-lg space-y-1">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Horario Asignado:</div>
                        <div className="text-xs font-bold text-indigo-300">
                          {asig.horario_name}
                        </div>
                      </div>

                      {/* Date Range / Vigencia */}
                      <div className="p-2.5 bg-slate-900/50 border border-slate-800/80 rounded-lg text-xs space-y-1 font-mono">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Desde:</span>
                          <span className="text-slate-200 font-bold">{asig.fecha_inicio}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Hasta:</span>
                          <span className={isTemporal ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                            {asig.fecha_fin ? asig.fecha_fin : 'Indefinido (Permanente)'}
                          </span>
                        </div>
                      </div>

                      {/* Motivo & Documento */}
                      {(asig.motivo || asig.documento_sustento) && (
                        <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                          {asig.motivo && (
                            <div>
                              <strong className="text-slate-300">Motivo:</strong> {asig.motivo}
                            </div>
                          )}
                          {asig.documento_sustento && (
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{asig.documento_sustento}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-[10px] text-slate-600 font-mono border-t border-slate-800/60 flex items-center justify-between">
                      <span>ID: {asig.id.substring(0, 12)}</span>
                      <span>{new Date(asig.created_at).toLocaleDateString('es-PE')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: CALCULADORA RIS DRAC (EN MEMORIA) */}
      {/* ==================================================== */}
      {activeTab === 'calculadora' && (
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calculator className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Calculadora Pedagógica de Tolerancia RIS (En Memoria)</h3>
              <p className="text-xs text-slate-400">
                Herramienta de consulta interactiva para verificar cómo computa el sistema una marcación de entrada según el Reglamento Interno de Servidores Civiles de DRAC.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold block">Seleccione el Turno a Evaluar:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalcShift('T1')}
                  className={`p-3 rounded-lg border text-left text-xs transition-all ${
                    calcShift === 'T1'
                      ? 'bg-emerald-950/80 border-emerald-500 text-white'
                      : 'bg-[#090A0D] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">Turno 1: Mañana</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Ingreso 08:00 (Tol. 10m)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCalcShift('T2')}
                  className={`p-3 rounded-lg border text-left text-xs transition-all ${
                    calcShift === 'T2'
                      ? 'bg-indigo-950/80 border-indigo-500 text-white'
                      : 'bg-[#090A0D] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">Turno 2: Tarde</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Retorno 14:00 (Tol. 5m)</div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold block">Hora de Marcación en el Reloj:</label>
              <input
                type="time"
                value={calcTime}
                onChange={(e) => setCalcTime(e.target.value)}
                className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-white font-mono text-base focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Resultado de la simulación */}
          <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              {evaluation.status === 'PUNCTUAL' && (
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              {evaluation.status === 'TOLERANCE' && (
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Info className="w-5 h-5" />
                </div>
              )}
              {evaluation.status === 'LATE' && (
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Dictamen RIS DRAC:</span>
                <span className="text-sm font-bold text-white block mt-0.5">{evaluation.desc}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Descuento Neto</span>
              <span
                className={`font-mono text-base font-bold ${
                  evaluation.netTardiness > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {evaluation.netTardiness} min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREAR / EDITAR TURNO */}
      {/* ==================================================== */}
      {isTurnoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  {editingTurno ? 'Editar Turno Laboral' : 'Registrar Nuevo Turno Laboral'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTurnoModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTurno} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Código:</label>
                  <input
                    type="text"
                    required
                    value={turnoForm.code}
                    onChange={(e) => setTurnoForm({ ...turnoForm, code: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono uppercase"
                    placeholder="T-01"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 font-bold block mb-1">Nombre del Turno:</label>
                  <input
                    type="text"
                    required
                    value={turnoForm.name}
                    onChange={(e) => setTurnoForm({ ...turnoForm, name: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="Turno Mañana Institucional"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Descripción / Notas:</label>
                <input
                  type="text"
                  value={turnoForm.description}
                  onChange={(e) => setTurnoForm({ ...turnoForm, description: e.target.value })}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-slate-300"
                  placeholder="Jornada matutina ordinaria de lunes a viernes"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Hora Inicio (Entrada):</label>
                  <input
                    type="time"
                    required
                    value={turnoForm.start_time}
                    onChange={(e) => setTurnoForm({ ...turnoForm, start_time: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Hora Fin (Salida):</label>
                  <input
                    type="time"
                    required
                    value={turnoForm.end_time}
                    onChange={(e) => setTurnoForm({ ...turnoForm, end_time: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Tolerancia Entrada (min):</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={turnoForm.tolerance_minutes}
                    onChange={(e) => setTurnoForm({ ...turnoForm, tolerance_minutes: Number(e.target.value) })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Tolerancia Salida (min):</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={turnoForm.tolerance_exit_minutes}
                    onChange={(e) => setTurnoForm({ ...turnoForm, tolerance_exit_minutes: Number(e.target.value) })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Ventana Inicio Marcación:</label>
                  <input
                    type="time"
                    value={turnoForm.window_entry_start}
                    onChange={(e) => setTurnoForm({ ...turnoForm, window_entry_start: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Ventana Fin Marcación:</label>
                  <input
                    type="time"
                    value={turnoForm.window_exit_limit}
                    onChange={(e) => setTurnoForm({ ...turnoForm, window_exit_limit: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={turnoForm.is_overnight}
                    onChange={(e) => setTurnoForm({ ...turnoForm, is_overnight: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-slate-300">Turno nocturno (cruza medianoche)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={turnoForm.active}
                    onChange={(e) => setTurnoForm({ ...turnoForm, active: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-slate-300">Turno activo</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTurnoModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingTurno ? 'Guardar Cambios' : 'Registrar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREAR / EDITAR HORARIO */}
      {/* ==================================================== */}
      {isHorarioModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  {editingHorario ? 'Editar Horario Laboral' : 'Registrar Nuevo Horario Laboral'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHorarioModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHorario} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Código:</label>
                  <input
                    type="text"
                    required
                    value={horarioForm.code}
                    onChange={(e) => setHorarioForm({ ...horarioForm, code: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono uppercase"
                    placeholder="HOR-01"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 font-bold block mb-1">Nombre del Horario:</label>
                  <input
                    type="text"
                    required
                    value={horarioForm.name}
                    onChange={(e) => setHorarioForm({ ...horarioForm, name: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="Jornada Partida Institucional DRAC"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Estructura Diaria de Turnos:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHorarioForm({ ...horarioForm, turn_count: 1 })}
                    className={`p-2.5 rounded-lg border text-center font-bold ${
                      horarioForm.turn_count === 1
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-600'
                        : 'bg-[#090A0D] text-slate-400 border-slate-800'
                    }`}
                  >
                    1 Turno por Día (Continua)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorarioForm({ ...horarioForm, turn_count: 2 })}
                    className={`p-2.5 rounded-lg border text-center font-bold ${
                      horarioForm.turn_count === 2
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-600'
                        : 'bg-[#090A0D] text-slate-400 border-slate-800'
                    }`}
                  >
                    2 Turnos por Día (Partida)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Primer Turno (Obligatorio):</label>
                <select
                  required
                  value={horarioForm.turno1_id}
                  onChange={(e) => setHorarioForm({ ...horarioForm, turno1_id: e.target.value })}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="">Seleccione un turno...</option>
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} - {t.name} ({t.start_time} - {t.end_time})
                    </option>
                  ))}
                </select>
              </div>

              {horarioForm.turn_count === 2 && (
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Segundo Turno:</label>
                  <select
                    required
                    value={horarioForm.turno2_id}
                    onChange={(e) => setHorarioForm({ ...horarioForm, turno2_id: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">Seleccione el segundo turno...</option>
                    {turnos
                      .filter((t) => t.id !== horarioForm.turno1_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} - {t.name} ({t.start_time} - {t.end_time})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-slate-400 font-bold block mb-1.5">Días Laborables:</label>
                <div className="flex items-center gap-2">
                  {[
                    { key: 'MON', label: 'Lun' },
                    { key: 'TUE', label: 'Mar' },
                    { key: 'WED', label: 'Mié' },
                    { key: 'THU', label: 'Jue' },
                    { key: 'FRI', label: 'Vie' },
                    { key: 'SAT', label: 'Sáb' },
                  ].map((day) => {
                    const isChecked = horarioForm.working_days.includes(day.key);
                    return (
                      <button
                        type="button"
                        key={day.key}
                        onClick={() => {
                          const nextDays = isChecked
                            ? horarioForm.working_days.filter((d) => d !== day.key)
                            : [...horarioForm.working_days, day.key];
                          setHorarioForm({ ...horarioForm, working_days: nextDays });
                        }}
                        className={`w-9 h-8 rounded-lg font-bold border transition-all ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-[#090A0D] text-slate-500 border-slate-800'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={horarioForm.active}
                    onChange={(e) => setHorarioForm({ ...horarioForm, active: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-slate-300">Horario activo en el sistema</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHorarioModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingHorario ? 'Guardar Cambios' : 'Registrar Horario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ASIGNAR HORARIO (PERMANENTE O TEMPORAL) */}
      {/* ==================================================== */}
      {isAsignacionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  {editingAsignacion
                    ? 'Editar Asignación de Horario'
                    : 'Asignar Horario (Permanente o Temporal)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAsignacionModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsignacion} className="p-5 space-y-4 text-xs">
              {/* Employee selector */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Servidor / Trabajador:</label>
                <select
                  required
                  value={asignacionForm.employee_id}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, employee_id: e.target.value })}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="">Seleccione un trabajador...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      DNI {emp.dni} - {emp.first_name} {emp.last_name} ({emp.position || 'Servidor'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Horario selector */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Horario Laboral Asignado:</label>
                <select
                  required
                  value={asignacionForm.horario_id}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, horario_id: e.target.value })}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="">Seleccione un horario laboral...</option>
                  {horarios.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} - {h.name} ({h.turn_count} turno{h.turn_count > 1 ? 's' : ''}, {h.total_hours}h)
                    </option>
                  ))}
                </select>
              </div>

              {/* TIPO DE ASIGNACIÓN */}
              <div className="space-y-1.5 bg-[#090A0D] p-3 rounded-lg border border-slate-800">
                <label className="text-[10px] uppercase font-bold text-slate-400 block">
                  Naturaleza de la Asignación:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAsignacionForm({ ...asignacionForm, tipo_asignacion: 'PERMANENTE', fecha_fin: '' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      asignacionForm.tipo_asignacion === 'PERMANENTE'
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Permanente / Regular</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Vigencia indefinida</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setAsignacionForm({
                        ...asignacionForm,
                        tipo_asignacion: 'TEMPORAL',
                        fecha_fin: asignacionForm.fecha_fin || new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
                      })
                    }
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      asignacionForm.tipo_asignacion === 'TEMPORAL'
                        ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Temporal / Excepcional</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Con fecha de expiración</div>
                  </button>
                </div>
              </div>

              {/* Date Ranges */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Fecha de Inicio:</label>
                  <input
                    type="date"
                    required
                    value={asignacionForm.fecha_inicio}
                    onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_inicio: e.target.value })}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Fecha de Fin {asignacionForm.tipo_asignacion === 'TEMPORAL' ? '(Requerido):' : '(Opcional):'}
                  </label>
                  <input
                    type="date"
                    required={asignacionForm.tipo_asignacion === 'TEMPORAL'}
                    disabled={asignacionForm.tipo_asignacion === 'PERMANENTE'}
                    value={asignacionForm.fecha_fin}
                    onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_fin: e.target.value })}
                    className={`w-full border rounded-lg p-2 font-mono ${
                      asignacionForm.tipo_asignacion === 'PERMANENTE'
                        ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-[#090A0D] border-amber-600/70 text-amber-300'
                    }`}
                  />
                </div>
              </div>

              {/* Motivo institucional */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  Motivo o Justificación {asignacionForm.tipo_asignacion === 'TEMPORAL' ? '(Requerido para Temporal):' : ':'}
                </label>
                <input
                  type="text"
                  required={asignacionForm.tipo_asignacion === 'TEMPORAL'}
                  value={asignacionForm.motivo}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, motivo: e.target.value })}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                  placeholder="Ej: Campaña Agraria de Siembra / Reemplazo de guardia / Necesidad de servicio"
                />
              </div>

              {/* Documento de sustento */}
              <div>
                <label className="text-slate-400 font-bold block mb-1">Documento de Sustento:</label>
                <input
                  type="text"
                  value={asignacionForm.documento_sustento}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, documento_sustento: e.target.value })}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2 text-white"
                  placeholder="Ej: Memorando N° 148-2026-DRAC-DIA o Resolución Directoral N° ..."
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={asignacionForm.activo}
                    onChange={(e) => setAsignacionForm({ ...asignacionForm, activo: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-slate-300">Asignación vigente</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAsignacionModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingAsignacion ? 'Actualizar Asignación' : 'Confirmar Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CONFIRMAR ELIMINACIÓN */}
      {/* ==================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-rose-800/60 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-sm text-white">Confirmar Eliminación</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Está seguro de eliminar <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer y retirará la configuración del repositorio central.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTarget.type === 'turno') handleDeleteTurno(deleteTarget.id);
                  else if (deleteTarget.type === 'horario') handleDeleteHorario(deleteTarget.id);
                  else if (deleteTarget.type === 'asignacion') handleDeleteAsignacion(deleteTarget.id);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
              >
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
