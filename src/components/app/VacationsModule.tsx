import React, { useState, useMemo, useEffect } from 'react';
import {
  Vacacion,
  VacacionTipo,
  VacacionStatus,
  VacacionOrigen,
  Employee,
  RoleType,
  Encargatura,
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  Horario,
} from '../../types';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  User,
  Info,
  Edit2,
  Trash2,
  X,
  Search,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  FileText,
  UserCheck,
  Building2,
  ChevronRight,
  Filter,
  Check,
  XCircle,
  Eye,
  History,
  Briefcase,
  Layers,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';
import {
  calculateVacationDays,
  getImmediateBossForVacation,
  canUserApproveVacation,
  validateVacationIntegrity,
  getDynamicVacationStatus,
  filterWorkersForVacation,
  WorkerAdvancedFilterCriteria,
} from '../../utils/vacationEngine';
import { isWorkerInBossScope } from '../../utils/encargaturaUtils';

interface VacationsModuleProps {
  activeView?: string;
  vacaciones: Vacacion[];
  employees: Employee[];
  activeRole: RoleType;
  activeUserDni?: string;
  currentUser?: Employee | null;
  encargaturas?: Encargatura[];
  dependencias?: Dependencia[];
  direccionesOrganos?: DireccionOrgano[];
  areas?: Area[];
  cargos?: Cargo[];
  horarios?: Horario[];
  onAddVacation: (vacation: Omit<Vacacion, 'id' | 'created_at'>) => void;
  onEditVacation?: (vacation: Vacacion) => void;
  onDeleteVacation?: (vacationId: string) => void;
  onApproveBoss?: (vacationId: string, bossData: any) => void;
  onRejectVacation?: (vacationId: string, rejectData: any) => void;
  onApproveHR?: (vacationId: string, hrData: any) => void;
}

export const VacationsModule: React.FC<VacationsModuleProps> = ({
  activeView,
  vacaciones,
  employees,
  activeRole,
  activeUserDni = '10000007',
  currentUser,
  encargaturas = [],
  dependencias = [],
  direccionesOrganos = [],
  areas = [],
  cargos = [],
  horarios = [],
  onAddVacation,
  onEditVacation,
  onDeleteVacation,
  onApproveBoss,
  onRejectVacation,
  onApproveHR,
}) => {
  // Current active employee context
  const activeEmp = useMemo(() => {
    if (currentUser) return currentUser;
    return employees.find((e) => e.dni === activeUserDni) || employees[0] || null;
  }, [currentUser, employees, activeUserDni]);

  const isEditorRole =
    activeRole === 'HR_ADMIN' ||
    activeRole === 'ADMIN_GENERAL' ||
    activeRole === 'JEFE_RRHH' ||
    activeRole === 'CONTROL_ASISTENCIA';

  const isBossRole =
    activeRole === 'JEFE' ||
    activeRole === 'SUPERVISOR' ||
    activeRole === 'DIRECTOR_GENERAL' ||
    activeRole === 'ADMIN_GENERAL' ||
    activeRole === 'JEFE_RRHH';

  // Tab State: 'all' | 'boss_approvals' | 'hr_approvals' | 'my_vacations'
  const [activeTab, setActiveTab] = useState<'all' | 'boss_approvals' | 'hr_approvals' | 'my_vacations'>(() => {
    if (activeView === 'vacations_approvals') return 'boss_approvals';
    if (activeView === 'vacations_new' || activeView === 'vacations_my') return 'my_vacations';
    if (activeView === 'vacations_requests') {
      return (activeRole === 'TRABAJADOR' || activeRole === 'EMPLOYEE') ? 'my_vacations' : 'all';
    }
    if (activeRole === 'TRABAJADOR' || activeRole === 'EMPLOYEE') return 'my_vacations';
    return 'all';
  });

  useEffect(() => {
    if (activeView === 'vacations_new') {
      setShowProfileRequestModal(true);
      setActiveTab('my_vacations');
    } else if (activeView === 'vacations_my') {
      setShowProfileRequestModal(false);
      setActiveTab('my_vacations');
    } else if (activeView === 'vacations_approvals') {
      setShowProfileRequestModal(false);
      setActiveTab(
        activeRole === 'JEFE' || activeRole === 'SUPERVISOR' || activeRole === 'DIRECTOR_GENERAL'
          ? 'boss_approvals'
          : 'hr_approvals'
      );
    } else if (activeView === 'vacations_requests') {
      setShowProfileRequestModal(false);
      if (activeRole === 'TRABAJADOR' || activeRole === 'EMPLOYEE') {
        setActiveTab('my_vacations');
      } else {
        setActiveTab('all');
      }
    } else if (activeView === 'vacations_history') {
      setShowProfileRequestModal(false);
      setActiveTab('all');
    }
  }, [activeView, activeRole]);

  // MODAL STATES
  // Modal A: Solicitar desde perfil del trabajador (PROFILE_VACATION_REQUEST) -> NO WORKER SEARCH
  const [showProfileRequestModal, setShowProfileRequestModal] = useState(false);
  const [createdVacationConfirmation, setCreatedVacationConfirmation] = useState<Vacacion | null>(null);
  // Modal B: Programar desde Control de Asistencia/RRHH (ATTENDANCE_VACATION_PROGRAMMING) -> CON BUSCADOR
  const [showAttendanceProgModal, setShowAttendanceProgModal] = useState(false);
  // Modal C: Rechazar con motivo obligatorio
  const [rejectingVacation, setRejectingVacation] = useState<Vacacion | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  // Modal D: Historial de Auditoría
  const [selectedVacationForAudit, setSelectedVacationForAudit] = useState<Vacacion | null>(null);
  // Modal E: Edición
  const [editingVacation, setEditingVacation] = useState<Vacacion | null>(null);

  // GENERAL LIST FILTER & SEARCH STATE
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterOrigen, setFilterOrigen] = useState<string>('ALL');
  const [filterDependencia, setFilterDependencia] = useState<string>('ALL');
  const [filterArea, setFilterArea] = useState<string>('ALL');
  const [filterRegimen, setFilterRegimen] = useState<string>('ALL');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');

  // PAGINATION STATE FOR GENERAL TABLE
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // SORTING STATE
  const [sortField, setSortField] = useState<string | null>('start_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // FORM STATE: PROFILE VACATION REQUEST (MODAL A)
  const [profTipo, setProfTipo] = useState<VacacionTipo>('PARCIAL');
  const [profStartDate, setProfStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [profEndDate, setProfEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [profComments, setProfComments] = useState('');
  const [profError, setProfError] = useState<string | null>(null);

  // Compute profile calculated days automatically
  const profDays = useMemo(() => {
    return calculateVacationDays(profStartDate, profEndDate);
  }, [profStartDate, profEndDate]);

  // Immediate boss for active employee
  const activeEmpBoss = useMemo(() => {
    if (!activeEmp) return null;
    return getImmediateBossForVacation({
      requester: activeEmp,
      allEmployees: employees,
      allEncargaturas: encargaturas,
      targetDate: profStartDate,
    });
  }, [activeEmp, employees, encargaturas, profStartDate]);

  // FORM STATE: ATTENDANCE VACATION PROGRAMMING (MODAL B)
  // Worker search and advanced search state
  const [progSelectedEmp, setProgSelectedEmp] = useState<Employee | null>(null);
  const [progSearchText, setProgSearchText] = useState('');
  const [showProgAdvancedSearch, setShowProgAdvancedSearch] = useState(false);
  const [progFilterDni, setProgFilterDni] = useState('');
  const [progFilterNombres, setProgFilterNombres] = useState('');
  const [progFilterPaterno, setProgFilterPaterno] = useState('');
  const [progFilterMaterno, setProgFilterMaterno] = useState('');
  const [progFilterDep, setProgFilterDep] = useState('ALL');
  const [progFilterDir, setProgFilterDir] = useState('ALL');
  const [progFilterArea, setProgFilterArea] = useState('ALL');
  const [progFilterCargo, setProgFilterCargo] = useState('ALL');
  const [progFilterRegimen, setProgFilterRegimen] = useState('ALL');
  const [progFilterCondicion, setProgFilterCondicion] = useState('ALL');
  const [progFilterEstado, setProgFilterEstado] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [progFilterSituacionVac, setProgFilterSituacionVac] = useState<
    'ALL' | 'CON_VACACIONES' | 'SIN_VACACIONES' | 'PENDIENTES' | 'VIGENTES'
  >('ALL');

  // Paginator for worker selector in modal B
  const [progWorkerPage, setProgWorkerPage] = useState<number>(1);
  const [progWorkerPageSize, setProgWorkerPageSize] = useState<number>(10);

  const [progTipo, setProgTipo] = useState<VacacionTipo>('TOTAL_30');
  const [progStartDate, setProgStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [progEndDate, setProgEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 39);
    return d.toISOString().split('T')[0];
  });
  const [progComments, setProgComments] = useState('Resolución Directoral N° 092-2026-GR.CAJ/DRA (Rol Anual Vacacional)');
  const [progError, setProgError] = useState<string | null>(null);

  // Compute programming calculated days automatically
  const progDays = useMemo(() => {
    return calculateVacationDays(progStartDate, progEndDate);
  }, [progStartDate, progEndDate]);

  // Filtered workers for modal B selection
  const filteredProgWorkers = useMemo(() => {
    const criteria: WorkerAdvancedFilterCriteria = {
      searchTerm: progSearchText,
      dni: progFilterDni,
      nombres: progFilterNombres,
      apellidoPaterno: progFilterPaterno,
      apellidoMaterno: progFilterMaterno,
      dependenciaId: progFilterDep,
      direccionOrganoId: progFilterDir,
      areaId: progFilterArea,
      cargoId: progFilterCargo,
      regimenLaboral: progFilterRegimen,
      condicionLaboral: progFilterCondicion,
      activeStatus: progFilterEstado,
      situacionVacacional: progFilterSituacionVac,
    };
    return filterWorkersForVacation(employees, criteria, vacaciones);
  }, [
    employees,
    vacaciones,
    progSearchText,
    progFilterDni,
    progFilterNombres,
    progFilterPaterno,
    progFilterMaterno,
    progFilterDep,
    progFilterDir,
    progFilterArea,
    progFilterCargo,
    progFilterRegimen,
    progFilterCondicion,
    progFilterEstado,
    progFilterSituacionVac,
  ]);

  const paginatedProgWorkers = useMemo(() => {
    const start = (progWorkerPage - 1) * progWorkerPageSize;
    return filteredProgWorkers.slice(start, start + progWorkerPageSize);
  }, [filteredProgWorkers, progWorkerPage, progWorkerPageSize]);

  // Count active filters in General list
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterTipo !== 'ALL') count++;
    if (filterStatus !== 'ALL') count++;
    if (filterOrigen !== 'ALL') count++;
    if (filterDependencia !== 'ALL') count++;
    if (filterArea !== 'ALL') count++;
    if (filterRegimen !== 'ALL') count++;
    if (filterFechaDesde) count++;
    if (filterFechaHasta) count++;
    return count;
  }, [
    filterTipo,
    filterStatus,
    filterOrigen,
    filterDependencia,
    filterArea,
    filterRegimen,
    filterFechaDesde,
    filterFechaHasta,
  ]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterTipo('ALL');
    setFilterStatus('ALL');
    setFilterOrigen('ALL');
    setFilterDependencia('ALL');
    setFilterArea('ALL');
    setFilterRegimen('ALL');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Filtered Vacations for General Table
  const filteredVacations = useMemo(() => {
    const currentDate = new Date().toISOString().split('T')[0];
    return vacaciones.map((v) => ({ ...v, computedStatus: getDynamicVacationStatus(v, currentDate) })).filter((v) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = v.employee_name.toLowerCase().includes(term);
        const matchDni = v.employee_dni.includes(term);
        const matchCode = (v.code || '').toLowerCase().includes(term);
        const matchObs = (v.comments || '').toLowerCase().includes(term);
        const matchPos = (v.position || '').toLowerCase().includes(term);
        const matchArea = (v.area_name || '').toLowerCase().includes(term);
        if (!matchName && !matchDni && !matchCode && !matchObs && !matchPos && !matchArea) return false;
      }
      if (filterTipo !== 'ALL' && v.tipo !== filterTipo) return false;
      if (filterStatus !== 'ALL' && v.computedStatus !== filterStatus) return false;
      if (filterOrigen !== 'ALL' && v.origin !== filterOrigen) return false;
      if (filterDependencia !== 'ALL' && v.dependencia_id !== filterDependencia) return false;
      if (filterArea !== 'ALL' && v.area_id !== filterArea) return false;
      if (filterRegimen !== 'ALL' && v.regimen_laboral !== filterRegimen) return false;
      if (filterFechaDesde && v.start_date < filterFechaDesde) return false;
      if (filterFechaHasta && v.end_date > filterFechaHasta) return false;
      return true;
    });
  }, [
    vacaciones,
    searchTerm,
    filterTipo,
    filterStatus,
    filterOrigen,
    filterDependencia,
    filterArea,
    filterRegimen,
    filterFechaDesde,
    filterFechaHasta,
  ]);

  const sortedVacations = useMemo(() => {
    if (!sortField || !sortOrder) return filteredVacations;
    return [...filteredVacations].sort((a, b) => {
      let valA: any = a[sortField as keyof Vacacion] ?? '';
      let valB: any = b[sortField as keyof Vacacion] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredVacations, sortField, sortOrder]);

  const paginatedVacations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVacations.slice(start, start + pageSize);
  }, [sortedVacations, currentPage, pageSize]);

  // PENDING REQUESTS FOR IMMEDIATE BOSS TRAY
  const pendingBossRequests = useMemo(() => {
    return vacaciones.filter((v) => {
      if (v.status !== 'SOLICITADA') return false;
      // Admins and HR leadership can see all
      if (
        isEditorRole ||
        activeRole === 'ADMIN_GENERAL' ||
        activeRole === 'HR_ADMIN' ||
        activeRole === 'JEFE_RRHH'
      ) {
        return true;
      }
      // For immediate boss or encargado, filter to requests within authority/scope
      const requesterEmp = employees.find((e) => e.dni === v.employee_dni || e.id === v.employee_id);
      if (!requesterEmp) return false;
      return isWorkerInBossScope({
        bossEmployee: activeEmp,
        workerEmployee: requesterEmp,
        allEncargaturas: encargaturas,
        currentDate: v.start_date,
      });
    });
  }, [vacaciones, isEditorRole, activeRole, employees, activeEmp, encargaturas]);

  // PENDING FOR HR TRAY
  const pendingHRRequests = useMemo(() => {
    return vacaciones.filter((v) => v.status === 'VISTO_BUENO_JEFE');
  }, [vacaciones]);

  // MY REQUESTS (ACTIVE EMPLOYEE)
  const myVacationRequests = useMemo(() => {
    if (!activeEmp) return [];
    return vacaciones.filter((v) => v.employee_dni === activeEmp.dni);
  }, [vacaciones, activeEmp]);

  // SUBMIT PROFILE VACATION REQUEST (FLOW A)
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmp) return;

    setProfError(null);

    // Validation
    const valResult = validateVacationIntegrity({
      employeeDni: activeEmp.dni,
      startDate: profStartDate,
      endDate: profEndDate,
      existingVacaciones: vacaciones,
    });

    if (!valResult.valid) {
      setProfError(valResult.errorMessage || 'Error de validación en fechas.');
      return;
    }

    const bossInfo = getImmediateBossForVacation({
      requester: activeEmp,
      allEmployees: employees,
      allEncargaturas: encargaturas,
      targetDate: profStartDate,
    });

    const newVac: Omit<Vacacion, 'id' | 'created_at'> = {
      code: `VAC-2026-${String(vacaciones.length + 1).padStart(3, '0')}`,
      employee_id: activeEmp.id,
      employee_dni: activeEmp.dni,
      employee_name: `${activeEmp.first_name} ${activeEmp.last_name}`,
      dependencia_id: activeEmp.dependencia_id,
      dependencia_name: activeEmp.dependencia_name || 'SEDE CENTRAL',
      direccion_organo_name: activeEmp.direccion_organo_name,
      area_id: activeEmp.area_id,
      area_name: activeEmp.area_name,
      position: activeEmp.position,
      regimen_laboral: activeEmp.regimen_laboral,
      condicion_laboral: activeEmp.condicion_laboral,
      tipo: profTipo,
      start_date: profStartDate,
      end_date: profEndDate,
      total_days: profDays,
      period_year: 2026,
      status: 'SOLICITADA',
      origin: 'PROFILE_VACATION_REQUEST',
      supervisor_id: bossInfo.bossId,
      supervisor_name: bossInfo.bossName,
      comments: profComments,
      created_by: `${activeEmp.first_name} ${activeEmp.last_name}`,
      created_by_role: 'TRABAJADOR',
      audits: [
        {
          id: `aud-vac-${Date.now()}`,
          vacacion_id: '',
          new_status: 'SOLICITADA',
          action_by_user_id: activeEmp.id,
          action_by_user_name: `${activeEmp.first_name} ${activeEmp.last_name}`,
          action_by_role: 'TRABAJADOR',
          action_type: 'SOLICITAR',
          origin: 'PROFILE_VACATION_REQUEST',
          comment: `Solicitud ingresada desde el perfil del trabajador. Destinatario V°B°: ${bossInfo.bossName} (${bossInfo.bossFunction}).`,
          timestamp: new Date().toLocaleString('es-PE'),
        },
      ],
    };

    onAddVacation(newVac);
    setCreatedVacationConfirmation(newVac as Vacacion);
    setShowProfileRequestModal(false);
    setProfComments('');
    setActiveTab('my_vacations');
  };

  // SUBMIT ATTENDANCE PROGRAMMING (FLOW B)
  const handleAttendanceProgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progSelectedEmp) {
      setProgError('Debe buscar y seleccionar a un trabajador de la lista.');
      return;
    }

    setProgError(null);

    // Validation
    const valResult = validateVacationIntegrity({
      employeeDni: progSelectedEmp.dni,
      startDate: progStartDate,
      endDate: progEndDate,
      existingVacaciones: vacaciones,
    });

    if (!valResult.valid) {
      setProgError(valResult.errorMessage || 'Error de validación en fechas.');
      return;
    }

    const newVac: Omit<Vacacion, 'id' | 'created_at'> = {
      code: `VAC-2026-${String(vacaciones.length + 1).padStart(3, '0')}`,
      employee_id: progSelectedEmp.id,
      employee_dni: progSelectedEmp.dni,
      employee_name: `${progSelectedEmp.first_name} ${progSelectedEmp.last_name}`,
      dependencia_id: progSelectedEmp.dependencia_id,
      dependencia_name: progSelectedEmp.dependencia_name || 'SEDE CENTRAL',
      direccion_organo_name: progSelectedEmp.direccion_organo_name,
      area_id: progSelectedEmp.area_id,
      area_name: progSelectedEmp.area_name,
      position: progSelectedEmp.position,
      regimen_laboral: progSelectedEmp.regimen_laboral,
      condicion_laboral: progSelectedEmp.condicion_laboral,
      tipo: progTipo,
      start_date: progStartDate,
      end_date: progEndDate,
      total_days: progDays,
      period_year: 2026,
      status: 'PROGRAMADA',
      origin: 'ATTENDANCE_VACATION_PROGRAMMING',
      approved_by_hr: activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name} (RRHH DRAC)` : 'Recursos Humanos DRAC',
      hr_approved_at: new Date().toLocaleString('es-PE'),
      hr_approver_name: activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name}` : 'Especialista de Asistencia',
      comments: progComments,
      created_by: activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name}` : 'Control de Asistencia DRAC',
      created_by_role: activeRole,
      audits: [
        {
          id: `aud-vac-${Date.now()}`,
          vacacion_id: '',
          new_status: 'PROGRAMADA',
          action_by_user_id: activeEmp?.id || 'usr-hr',
          action_by_user_name: activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name}` : 'Control Asistencia',
          action_by_role: activeRole,
          action_type: 'PROGRAMAR',
          origin: 'ATTENDANCE_VACATION_PROGRAMMING',
          comment: `Programación institucional directa de descanso vacacional (${progComments}).`,
          timestamp: new Date().toLocaleString('es-PE'),
        },
      ],
    };

    onAddVacation(newVac);
    setShowAttendanceProgModal(false);
    setProgSelectedEmp(null);
    setActiveTab('all');
  };

  // DAR V°B° DEL JEFE INMEDIATO
  const handleExecuteBossVoBo = (vac: Vacacion) => {
    const requesterEmp = employees.find((e) => e.dni === vac.employee_dni || e.id === vac.employee_id);
    const bossCheck = canUserApproveVacation({
      currentUserDni: activeEmp?.dni || activeUserDni,
      currentUserRole: activeRole,
      currentUserId: activeEmp?.id,
      requesterDni: vac.employee_dni,
      requesterId: vac.employee_id,
      requesterEmp: requesterEmp || null,
      allEncargaturas: encargaturas,
      allEmployees: employees,
      targetDate: vac.start_date,
    });

    // CRITICAL SECURITY RULE: BLOCK SELF-APPROVAL
    if (bossCheck.isSelfApproval) {
      alert('⚠️ OPERACIÓN DENEGADA:\n\nNo puede aprobar una solicitud de vacaciones que usted mismo ha generado.');
      return;
    }

    if (!bossCheck.canApprove) {
      alert(`⚠️ OPERACIÓN DENEGADA:\n\n${bossCheck.reason}`);
      return;
    }

    const bossName = activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name}` : 'Jefe Inmediato DRAC';
    const bossFunction = bossCheck.isEncargado ? 'Jefe Encargado' : 'Jefe Titular';

    if (onApproveBoss) {
      onApproveBoss(vac.id, {
        boss_dni: activeEmp?.dni || activeUserDni,
        boss_id: activeEmp?.id || 'usr-boss',
        boss_name: bossName,
        boss_role: activeRole,
        boss_function: bossFunction,
        delegation_info: bossCheck.delegationInfo,
        comment: `V°B° otorgado por ${bossFunction} (${bossName})`,
      });
    } else if (onEditVacation) {
      const nowLocal = new Date().toLocaleString('es-PE');
      const auditEntry = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: vac.id,
        previous_status: vac.status,
        new_status: 'VISTO_BUENO_JEFE' as VacacionStatus,
        action_by_user_id: activeEmp?.id || 'usr-boss',
        action_by_user_name: bossName,
        action_by_role: activeRole,
        action_type: 'VISTO_BUENO_JEFE' as any,
        origin: vac.origin,
        comment: `V°B° otorgado por ${bossFunction} (${bossName}). Pasa a RRHH.`,
        boss_approver_name: bossName,
        boss_approver_dni: activeEmp?.dni || activeUserDni,
        boss_approver_function: bossFunction,
        delegation_info: bossCheck.delegationInfo,
        timestamp: nowLocal,
      };

      onEditVacation({
        ...vac,
        status: 'VISTO_BUENO_JEFE',
        boss_approved_at: nowLocal,
        boss_approver_id: activeEmp?.id,
        boss_approver_dni: activeEmp?.dni || activeUserDni,
        boss_approver_name: bossName,
        boss_approver_function: bossFunction,
        boss_delegation_info: bossCheck.delegationInfo,
        boss_comment: `V°B° otorgado por ${bossFunction}`,
        updated_at: new Date().toISOString(),
        audits: vac.audits ? [auditEntry, ...vac.audits] : [auditEntry],
      });
    }
  };

  // RECHAZAR SOLICITUD VACACIONAL (CON MOTIVO OBLIGATORIO)
  const handleConfirmRejection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingVacation) return;

    if (!rejectionReason.trim()) {
      alert('El motivo de rechazo es obligatorio.');
      return;
    }

    const actionByName = activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name}` : 'Autoridad Evaluadora';

    if (onRejectVacation) {
      onRejectVacation(rejectingVacation.id, {
        action_by_dni: activeEmp?.dni || activeUserDni,
        action_by_id: activeEmp?.id || 'usr-01',
        action_by_name: actionByName,
        action_by_role: activeRole,
        reason: rejectionReason.trim(),
      });
    } else if (onEditVacation) {
      const nowLocal = new Date().toLocaleString('es-PE');
      const auditEntry = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: rejectingVacation.id,
        previous_status: rejectingVacation.status,
        new_status: 'RECHAZADA' as VacacionStatus,
        action_by_user_id: activeEmp?.id || 'usr-01',
        action_by_user_name: actionByName,
        action_by_role: activeRole,
        action_type: 'RECHAZAR' as any,
        origin: rejectingVacation.origin,
        comment: `Rechazado por ${actionByName}. Motivo: ${rejectionReason.trim()}`,
        rejection_reason: rejectionReason.trim(),
        timestamp: nowLocal,
      };

      onEditVacation({
        ...rejectingVacation,
        status: 'RECHAZADA',
        rejection_reason: rejectionReason.trim(),
        updated_at: new Date().toISOString(),
        audits: rejectingVacation.audits ? [auditEntry, ...rejectingVacation.audits] : [auditEntry],
      });
    }

    setRejectingVacation(null);
    setRejectionReason('');
  };

  // APROBAR FINALMENTE POR RRHH / CONTROL DE ASISTENCIA
  const handleExecuteHRApproval = (vac: Vacacion) => {
    const hrName = activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name}` : 'Recursos Humanos DRAC';

    if (onApproveHR) {
      onApproveHR(vac.id, {
        hr_dni: activeEmp?.dni || activeUserDni,
        hr_id: activeEmp?.id || 'usr-hr',
        hr_name: hrName,
        hr_role: activeRole,
        comment: `Aprobación y programación formal por RRHH (${hrName})`,
        final_status: 'PROGRAMADA',
      });
    } else if (onEditVacation) {
      const nowLocal = new Date().toLocaleString('es-PE');
      const auditEntry = {
        id: `aud-vac-${Date.now()}`,
        vacacion_id: vac.id,
        previous_status: vac.status,
        new_status: 'PROGRAMADA' as VacacionStatus,
        action_by_user_id: activeEmp?.id || 'usr-hr',
        action_by_user_name: hrName,
        action_by_role: activeRole,
        action_type: 'APROBAR_RRHH' as any,
        origin: vac.origin,
        comment: `Aprobado formalmente por RRHH (${hrName}). Programación oficial lista.`,
        timestamp: nowLocal,
      };

      onEditVacation({
        ...vac,
        status: 'PROGRAMADA',
        approved_by_hr: hrName,
        hr_approved_at: nowLocal,
        hr_approver_id: activeEmp?.id,
        hr_approver_name: hrName,
        hr_comment: 'Programación vacacional conforme y validada por RRHH DRAC',
        updated_at: new Date().toISOString(),
        audits: vac.audits ? [auditEntry, ...vac.audits] : [auditEntry],
      });
    }
  };

  // Helper render status badge
  const renderStatusBadge = (status: VacacionStatus) => {
    switch (status) {
      case 'SOLICITADA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>SOLICITADA (Pendiente V°B°)</span>
          </span>
        );
      case 'VISTO_BUENO_JEFE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            <span>V°B° JEFE (Pasa a RRHH)</span>
          </span>
        );
      case 'APROBADA_RRHH':
      case 'PROGRAMADA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-indigo-400" />
            <span>PROGRAMADA</span>
          </span>
        );
      case 'EN_CURSO':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>EN CURSO (Descanso Activo)</span>
          </span>
        );
      case 'FINALIZADA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
            <Check className="w-3 h-3 text-slate-400" />
            <span>FINALIZADA</span>
          </span>
        );
      case 'RECHAZADA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>RECHAZADA</span>
          </span>
        );
      case 'OBSERVADA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-300 border border-orange-500/30 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <span>OBSERVADA</span>
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-700">
            CANCELADA
          </span>
        );
      default:
        return <span className="px-2 py-0.5 text-slate-400 text-[10px]">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header institucional DRAC */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400 shadow-sm">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Gestión Integral de Vacaciones — DRAC
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Flujo dual: Solicitud individual con V°B° jerárquico del Jefe Inmediato y Programación institucional por Control de Asistencia/RRHH.
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions: Context-Aware Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action A: Solicitar mis vacaciones (Perfil del Trabajador) */}
          <button
            type="button"
            onClick={() => {
              setProfError(null);
              setShowProfileRequestModal(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <User className="w-4 h-4 text-indigo-400" />
            <span>Solicitar Mis Vacaciones</span>
          </button>

          {/* Action B: Programar vacaciones para personal (Control de Asistencia / RRHH) */}
          {isEditorRole && (
            <button
              type="button"
              onClick={() => {
                setProgError(null);
                setProgSelectedEmp(null);
                setProgSearchText('');
                setShowProgAdvancedSearch(false);
                setShowAttendanceProgModal(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Programar Vacaciones (RRHH / Control)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Institutional Workflow Banner */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">Reglas Operativas Institucionales: </span>
            Toda solicitud generada por el trabajador pasa a estado <span className="font-mono text-amber-300 font-bold">SOLICITADA</span> y requiere el V°B° obligatorio del Jefe Inmediato (o Encargado Temporal vigente). La programación directa de Control de Asistencia ingresa como <span className="font-mono text-indigo-300 font-bold">PROGRAMADA</span>. Durante el descanso, el motor asigna automáticamente el estado <span className="font-mono text-emerald-400 font-bold">VACATION</span> sin imputar faltas.
          </div>
        </div>
      </div>

      {/* 3. Tabbed Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Todas las Vacaciones</span>
          <span className="px-1.5 py-0.2 bg-black/30 rounded text-[10px] font-mono">
            {vacaciones.length}
          </span>
        </button>

        {isBossRole && (
          <button
            onClick={() => setActiveTab('boss_approvals')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'boss_approvals'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Bandeja V°B° Jefe Inmediato</span>
            {pendingBossRequests.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-black rounded-full text-[10px]">
                {pendingBossRequests.length}
              </span>
            )}
          </button>
        )}

        {isEditorRole && (
          <button
            onClick={() => setActiveTab('hr_approvals')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'hr_approvals'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>Bandeja Control de Asistencia / RRHH</span>
            {pendingHRRequests.length > 0 && (
              <span className="px-1.5 py-0.5 bg-cyan-500 text-slate-950 font-black rounded-full text-[10px]">
                {pendingHRRequests.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('my_vacations')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'my_vacations'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Mis Solicitudes ({activeEmp?.first_name || 'Trabajador'})</span>
          <span className="px-1.5 py-0.2 bg-black/30 rounded text-[10px] font-mono">
            {myVacationRequests.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BANDEJA V°B° JEFE INMEDIATO (SOLICITUDES PENDIENTES)               */}
      {/* ========================================================================= */}
      {activeTab === 'boss_approvals' && (
        <div className="space-y-4">
          <div className="bg-[#0F1115] border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Bandeja de Aprobación de V°B° — Jefe Inmediato / Encargado</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      {pendingBossRequests.length} Pendiente(s)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluación de solicitudes de descanso vacacional emitidas por trabajadores bajo su ámbito orgánico o supervisión directa.
                  </p>
                </div>
              </div>

              {/* Informative boss tag */}
              {activeEmp && (
                <div className="hidden md:block text-right text-xs">
                  <div className="text-slate-400">Evaluador en sesión:</div>
                  <div className="font-bold text-white">{activeEmp.first_name} {activeEmp.last_name}</div>
                  <div className="text-[11px] text-amber-400 font-mono">DNI: {activeEmp.dni} • {activeEmp.position}</div>
                </div>
              )}
            </div>
          </div>

          {pendingBossRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No hay solicitudes vacacionales pendientes de V°B°"
              description="Todas las solicitudes remitidas por el personal subordinado han sido evaluadas oportunamente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingBossRequests.map((vac) => {
                const requesterEmp = employees.find((e) => e.dni === vac.employee_dni || e.id === vac.employee_id);
                const bossCheck = canUserApproveVacation({
                  currentUserDni: activeEmp?.dni || activeUserDni,
                  currentUserRole: activeRole,
                  currentUserId: activeEmp?.id,
                  requesterDni: vac.employee_dni,
                  requesterId: vac.employee_id,
                  requesterEmp: requesterEmp || null,
                  allEncargaturas: encargaturas,
                  allEmployees: employees,
                  targetDate: vac.start_date,
                });

                const isSelfApproval = bossCheck.isSelfApproval;

                return (
                  <div
                    key={vac.id}
                    className="bg-[#0F1115] border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 transition-colors"
                  >
                    {/* Header card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                          {vac.code || 'VAC-SOLICITUD'}
                        </span>
                        <span className="text-xs text-slate-400">
                          Registrada el {vac.created_at ? new Date(vac.created_at).toLocaleDateString('es-PE') : 'Reciente'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          Origen: {vac.origin === 'PROFILE_VACATION_REQUEST' ? 'Perfil Trabajador' : 'Control Asistencia'}
                        </span>
                      </div>

                      {renderStatusBadge(vac.status)}
                    </div>

                    {/* Worker Info & Scope */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Trabajador Solicitante:</span>
                        <span className="font-bold text-white text-xs mt-0.5 block flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          {vac.employee_name}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">DNI: {vac.employee_dni}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Ubicación Orgánica:</span>
                        <span className="font-semibold text-slate-200 text-xs mt-0.5 block">
                          {vac.dependencia_name || 'SEDE CENTRAL'}
                        </span>
                        <span className="text-slate-400 text-[11px] block truncate">
                          {vac.area_name || 'Área Institucional'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Cargo & Régimen:</span>
                        <span className="font-semibold text-slate-200 text-xs mt-0.5 block truncate">
                          {vac.position || 'Servidor DRAC'}
                        </span>
                        <span className="text-indigo-400 text-[11px] font-mono font-bold">
                          {vac.regimen_laboral || 'D.L. 276'} • {vac.condicion_laboral || 'CONTRATADO'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Período y Días Solicitados:</span>
                        <span className="font-mono text-white font-bold text-xs mt-0.5 block">
                          {vac.start_date} ➔ {vac.end_date}
                        </span>
                        <span className="text-amber-300 font-mono font-bold text-xs">
                          {vac.total_days} días calendario ({vac.tipo})
                        </span>
                      </div>
                    </div>

                    {/* Sustento */}
                    {vac.comments && (
                      <div className="p-3 bg-[#060709] rounded-lg border border-slate-800 text-xs">
                        <span className="text-slate-400 font-semibold block mb-0.5 text-[11px]">
                          Motivo / Sustento de la Solicitud:
                        </span>
                        <p className="text-slate-300 italic">"{vac.comments}"</p>
                      </div>
                    )}

                    {/* Boss Delegation & Jurisdiction Box */}
                    {bossCheck.isEncargado && bossCheck.delegationInfo && (
                      <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-800/40 text-xs flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-indigo-300">Competencia de Aprobación por Encargatura Temporal Vigente:</span>
                          <p className="text-slate-300 text-[11px] mt-0.5">
                            Usted asume el V°B° como {bossCheck.delegationInfo.unidad_encargada} mediante {bossCheck.delegationInfo.documento} (Vigencia: {bossCheck.delegationInfo.vigencia}).
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Self-approval blocking banner if applicable */}
                    {isSelfApproval ? (
                      <div className="p-3 bg-rose-950/40 rounded-lg border border-rose-800 text-xs flex items-start gap-2.5 text-rose-300">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">🔒 Autoaprobación Bloqueada por Regla de Seguridad:</span>
                          <span>No puede aprobar una solicitud de vacaciones que usted mismo ha generado. El V°B° debe ser otorgado por la autoridad jerárquica superior o RRHH.</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Actions Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedVacationForAudit(vac)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ver Historial / Trazabilidad</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingVacation(vac);
                            setRejectionReason('');
                          }}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rechazar</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSelfApproval}
                          onClick={() => handleExecuteBossVoBo(vac)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Dar V°B°</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BANDEJA CONTROL DE ASISTENCIA / RRHH (VALIDACIÓN Y PROGRAMACIÓN)   */}
      {/* ========================================================================= */}
      {activeTab === 'hr_approvals' && (
        <div className="space-y-4">
          <div className="bg-[#0F1115] border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Bandeja de Validación y Programación Oficial — RRHH DRAC</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                      {pendingHRRequests.length} Solicitud(es) con V°B°
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aprobación final e incorporación formal al Rol Anual de Descanso Vacacional.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {pendingHRRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No hay solicitudes pendientes de validación por RRHH"
              description="Las solicitudes que cuenten con el V°B° del jefe inmediato aparecerán aquí para su programación definitiva."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingHRRequests.map((vac) => (
                <div
                  key={vac.id}
                  className="bg-[#0F1115] border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                        {vac.code || 'VAC-SOLICITUD'}
                      </span>
                      <span className="text-xs text-slate-400">
                        V°B° otorgado el {vac.boss_approved_at || 'Reciente'}
                      </span>
                    </div>

                    {renderStatusBadge(vac.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Servidor:</span>
                      <span className="font-bold text-white text-xs mt-0.5 block">{vac.employee_name}</span>
                      <span className="text-slate-400 font-mono text-[11px]">DNI: {vac.employee_dni} • {vac.position}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px] block">Período de Descanso:</span>
                      <span className="font-mono text-white font-bold text-xs mt-0.5 block">
                        {vac.start_date} ➔ {vac.end_date}
                      </span>
                      <span className="text-indigo-400 font-mono font-bold text-xs">
                        {vac.total_days} días calendario ({vac.tipo})
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px] block">Jefe que otorgó V°B°:</span>
                      <span className="font-bold text-emerald-400 text-xs mt-0.5 block flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {vac.boss_approver_name || vac.supervisor_name || 'Jefe Inmediato'}
                      </span>
                      <span className="text-slate-400 text-[11px] block">
                        Función: {vac.boss_approver_function || 'Jefe Titular'} {vac.boss_approver_dni ? `(DNI: ${vac.boss_approver_dni})` : ''}
                      </span>
                    </div>
                  </div>

                  {vac.boss_delegation_info && (
                    <div className="p-2.5 bg-indigo-950/20 rounded border border-indigo-800/40 text-[11px] text-indigo-300">
                      <strong>Encargatura acreditada:</strong> {vac.boss_delegation_info.unidad_encargada} — {vac.boss_delegation_info.documento} (Vigencia: {vac.boss_delegation_info.vigencia})
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedVacationForAudit(vac)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Ver Auditoría</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingVacation(vac);
                          setRejectionReason('');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-slate-700 font-bold text-xs rounded-lg"
                      >
                        Rechazar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExecuteHRApproval(vac)}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprobar y Programar Vacaciones</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MIS SOLICITUDES (PERFIL DEL TRABAJADOR)                            */}
      {/* ========================================================================= */}
      {activeTab === 'my_vacations' && (
        <div className="space-y-4">
          <div className="bg-[#0F1115] border border-indigo-500/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>Mis Solicitudes de Descanso Vacacional</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seguimiento de estados y aprobación jerárquica para {activeEmp?.first_name} {activeEmp?.last_name} (DNI: {activeEmp?.dni}).
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setProfError(null);
                setShowProfileRequestModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Solicitar Vacaciones</span>
            </button>
          </div>

          {myVacationRequests.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No ha registrado solicitudes de vacaciones"
              description="Haga clic en 'Solicitar Vacaciones' para tramitar su período de descanso ante su Jefe Inmediato."
              actionLabel="Solicitar Vacaciones"
              onAction={() => setShowProfileRequestModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myVacationRequests.map((vac) => {
                const dynamicStatus = getDynamicVacationStatus(vac);
                return (
                  <div
                    key={vac.id}
                    className="bg-[#0F1115] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                          {vac.code || 'VAC-2026-X'}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">
                          Período: {vac.start_date} al {vac.end_date} ({vac.total_days} días)
                        </span>
                      </div>

                      {renderStatusBadge(dynamicStatus)}
                    </div>

                    {/* Timeline Tracker */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Línea de Vida y Progreso de la Solicitud:
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        {/* Step 1: Solicitada */}
                        <div
                          className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                            ['SOLICITADA', 'VISTO_BUENO_JEFE', 'APROBADA_RRHH', 'PROGRAMADA', 'EN_CURSO', 'FINALIZADA'].includes(
                              vac.status
                            )
                              ? 'bg-indigo-950/30 border-indigo-800 text-indigo-200'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[11px]">1. Solicitada</div>
                            <div className="text-[10px] text-slate-400">Por el trabajador</div>
                          </div>
                        </div>

                        {/* Step 2: V°B° Jefe */}
                        <div
                          className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                            ['VISTO_BUENO_JEFE', 'APROBADA_RRHH', 'PROGRAMADA', 'EN_CURSO', 'FINALIZADA'].includes(
                              vac.status
                            )
                              ? 'bg-cyan-950/30 border-cyan-800 text-cyan-200'
                              : vac.status === 'RECHAZADA'
                              ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          {vac.status === 'RECHAZADA' ? (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-bold text-[11px]">2. V°B° Jefe</div>
                            <div className="text-[10px] text-slate-400">
                              {vac.boss_approver_name || 'Jefe Inmediato'}
                            </div>
                          </div>
                        </div>

                        {/* Step 3: Aprobación RRHH */}
                        <div
                          className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                            ['APROBADA_RRHH', 'PROGRAMADA', 'EN_CURSO', 'FINALIZADA'].includes(vac.status)
                              ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[11px]">3. Aprobación RRHH</div>
                            <div className="text-[10px] text-slate-400">{vac.approved_by_hr || 'RRHH DRAC'}</div>
                          </div>
                        </div>

                        {/* Step 4: Ejecución */}
                        <div
                          className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                            dynamicStatus === 'EN_CURSO'
                              ? 'bg-amber-950/40 border-amber-800 text-amber-200 animate-pulse'
                              : dynamicStatus === 'FINALIZADA'
                              ? 'bg-slate-800 border-slate-700 text-slate-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[11px]">4. Ejecución</div>
                            <div className="text-[10px] text-slate-400">
                              {dynamicStatus === 'EN_CURSO'
                                ? 'En curso actualmente'
                                : dynamicStatus === 'FINALIZADA'
                                ? 'Período concluido'
                                : 'Pendiente inicio'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {vac.rejection_reason && (
                      <div className="p-3 bg-rose-950/30 border border-rose-800/80 rounded-lg text-xs text-rose-200">
                        <strong className="block text-rose-300 mb-0.5">Motivo de Rechazo:</strong>
                        <p>{vac.rejection_reason}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                      <span className="text-slate-400">
                        Jefe asignado para V°B°: <strong>{vac.supervisor_name || 'Jefatura de Área'}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedVacationForAudit(vac)}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Ver Trazabilidad</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TODAS LAS VACACIONES (TABLA MAESTRA CON BÚSQUEDA AVANZADA)          */}
      {/* ========================================================================= */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Advanced Multi-Filter */}
          <AdvancedSearchFilter
            searchTerm={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar por empleado, DNI, código VAC, cargo, área..."
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetFilters}
          >
            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="SOLICITADA">SOLICITADA (Pendiente V°B°)</option>
                <option value="VISTO_BUENO_JEFE">VISTO_BUENO_JEFE</option>
                <option value="PROGRAMADA">PROGRAMADA</option>
                <option value="EN_CURSO">EN_CURSO</option>
                <option value="FINALIZADA">FINALIZADA</option>
                <option value="RECHAZADA">RECHAZADA</option>
                <option value="OBSERVADA">OBSERVADA</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Origen</label>
              <select
                value={filterOrigen}
                onChange={(e) => {
                  setFilterOrigen(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los Orígenes</option>
                <option value="PROFILE_VACATION_REQUEST">Perfil Trabajador</option>
                <option value="ATTENDANCE_VACATION_PROGRAMMING">Control Asistencia/RRHH</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Modalidad</label>
              <select
                value={filterTipo}
                onChange={(e) => {
                  setFilterTipo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todas las Modalidades</option>
                <option value="TOTAL_30">Total (30 días)</option>
                <option value="FRACCIONADO">Fraccionado</option>
                <option value="PARCIAL">Parcial</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Régimen Laboral</label>
              <select
                value={filterRegimen}
                onChange={(e) => {
                  setFilterRegimen(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los Regímenes</option>
                <option value="D.L. 276">D.L. 276 (Carrera Administrativa)</option>
                <option value="CAS D.L. 1057">CAS D.L. 1057</option>
                <option value="D.L. 728">D.L. 728 (Régimen Privado)</option>
                <option value="LOCACION_SERVICIOS">Locación de Servicios</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Fecha Desde</label>
              <input
                type="date"
                value={filterFechaDesde}
                onChange={(e) => {
                  setFilterFechaDesde(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Fecha Hasta</label>
              <input
                type="date"
                value={filterFechaHasta}
                onChange={(e) => {
                  setFilterFechaHasta(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </AdvancedSearchFilter>

          {/* Master Vacations Table */}
          <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-[#090A0D] text-slate-400 font-medium border-b border-slate-800">
                  <tr>
                    <th className="w-[40px] px-2 py-3 text-center">#</th>
                    <th className="w-[200px] px-3 py-3">
                      <SortableHeader
                        label="Servidor / DNI"
                        field="employee_name"
                        currentSortField={sortField}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="w-[130px] px-3 py-3 hidden md:table-cell">Área / Cargo</th>
                    <th className="w-[170px] px-3 py-3">
                      <SortableHeader
                        label="Período de Descanso"
                        field="start_date"
                        currentSortField={sortField}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="w-[75px] px-3 py-3 text-center">
                      <SortableHeader
                        label="Días"
                        field="total_days"
                        currentSortField={sortField}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="center"
                      />
                    </th>
                    <th className="w-[160px] px-3 py-3">Estado & V°B°</th>
                    <th className="w-[110px] px-3 py-3 hidden lg:table-cell">Origen</th>
                    <th className="w-[100px] px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {paginatedVacations.map((v, idx) => {
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-2 py-3 text-center text-slate-500 font-mono text-[11px]">
                          {rowNum}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{v.employee_name}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            DNI: {v.employee_dni} {v.code ? `• ${v.code}` : ''}
                          </div>
                        </td>

                        <td className="px-3 py-3 hidden md:table-cell">
                          <div className="text-slate-300 font-medium truncate">{v.area_name || 'Área DRAC'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{v.position}</div>
                        </td>

                        <td className="px-3 py-3 font-mono text-slate-300">
                          <span className="text-white font-bold">{v.start_date}</span> ➔ {v.end_date}
                          <div className="text-[10px] text-slate-500 font-sans">{v.tipo}</div>
                        </td>

                        <td className="px-3 py-3 text-center font-mono font-bold text-indigo-300">
                          {v.total_days}d
                        </td>

                        <td className="px-3 py-3">
                          <div>{renderStatusBadge(v.computedStatus)}</div>
                          {v.boss_approver_name && (
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">V°B°: {v.boss_approver_name}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {v.origin === 'PROFILE_VACATION_REQUEST' ? 'Perfil Trabajador' : 'Control Asistencia'}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedVacationForAudit(v)}
                              className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded transition-colors"
                              title="Ver auditoría y trazabilidad"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {isEditorRole && onDeleteVacation && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Eliminar o anular período vacacional de ${v.employee_name}?`)) {
                                    onDeleteVacation(v.id);
                                  }
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredVacations.length === 0 && (
                <EmptyState
                  icon={CalendarDays}
                  title="No se encontraron programaciones vacacionales"
                  description="Las vacaciones registradas para el personal institucional aparecerán en esta lista."
                  isFiltered={activeFilterCount > 0 || Boolean(searchTerm)}
                  onAction={handleResetFilters}
                />
              )}
            </div>

            {/* Pagination */}
            <DataTablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredVacations.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL A: SOLICITAR VACACIONES DESDE PERFIL (PROFILE_VACATION_REQUEST)     */}
      {/* REGLA CRÍTICA: ¡NO MOSTRAR BUSCADOR DE TRABAJADOR!                        */}
      {/* ========================================================================= */}
      {showProfileRequestModal && activeEmp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleProfileSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Solicitud de Vacaciones</h3>
                  <p className="text-[11px] text-slate-400">Generada desde el Perfil del Servidor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileRequestModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-Only Worker Informational Card (NO WORKER SELECTOR / SEARCH) */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Datos del Servidor Solicitante (Informativo No Editable):
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Trabajador:</span>
                  <span className="font-bold text-white text-xs block">
                    {activeEmp.first_name} {activeEmp.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">DNI:</span>
                  <span className="font-mono text-cyan-300 font-bold text-xs block">{activeEmp.dni}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Dependencia / Área:</span>
                  <span className="text-slate-300 text-xs block">
                    {activeEmp.dependencia_name || 'SEDE CENTRAL'} • {activeEmp.area_name || 'Área'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Cargo & Régimen:</span>
                  <span className="text-slate-300 text-xs block">
                    {activeEmp.position} ({activeEmp.regimen_laboral})
                  </span>
                </div>
              </div>
            </div>

            {/* Boss VoBo Destination info */}
            {activeEmpBoss && (
              <div className="p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-xl text-xs flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-indigo-300 font-bold block">
                    Destinatario de V°B° (Jefe Inmediato):
                  </span>
                  <span className="text-white font-semibold">
                    {activeEmpBoss.bossName} ({activeEmpBoss.bossFunction})
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{activeEmpBoss.reason}</p>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Modalidad de Descanso</label>
                <select
                  value={profTipo}
                  onChange={(e) => setProfTipo(e.target.value as VacacionTipo)}
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none"
                >
                  <option value="PARCIAL">Parcial (Días específicos computables)</option>
                  <option value="FRACCIONADO">Fraccionado (15 / 7 días calendario)</option>
                  <option value="TOTAL_30">Total Completo (30 días de ley)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Fecha Inicio</label>
                  <input
                    type="date"
                    value={profStartDate}
                    onChange={(e) => setProfStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Fecha Fin</label>
                  <input
                    type="date"
                    value={profEndDate}
                    onChange={(e) => setProfEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Automatically calculated days display */}
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Días Calendario Computables:</span>
                <span className="font-mono text-base font-bold text-indigo-400">{profDays} días</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">
                  Observaciones / Sustento
                </label>
                <textarea
                  rows={2}
                  value={profComments}
                  onChange={(e) => setProfComments(e.target.value)}
                  placeholder="Especifique el motivo de descanso vacacional..."
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {profError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{profError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowProfileRequestModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors shadow-sm shadow-indigo-600/20"
              >
                Solicitar Vacaciones
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL B: PROGRAMAR DESDE CONTROL DE ASISTENCIA / RRHH                     */}
      {/* REGLA CRÍTICA: ¡CON BÚSQUEDA RÁPIDA, BÚSQUEDA AVANZADA Y PAGINACIÓN!      */}
      {/* ========================================================================= */}
      {showAttendanceProgModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAttendanceProgSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Programación de Vacaciones DRAC</h3>
                  <p className="text-[11px] text-slate-400">Gestión autorizada por Control de Asistencia / RRHH</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAttendanceProgModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Buscador de Trabajadores con Búsqueda Avanzada */}
            <div className="space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-bold text-white flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. Buscar y Seleccionar Trabajador:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowProgAdvancedSearch(!showProgAdvancedSearch)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showProgAdvancedSearch ? 'Ocultar Búsqueda Avanzada' : 'Búsqueda Avanzada'}</span>
                </button>
              </div>

              {/* Búsqueda Rápida */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={progSearchText}
                  onChange={(e) => {
                    setProgSearchText(e.target.value);
                    setProgWorkerPage(1);
                  }}
                  placeholder="Búsqueda rápida por DNI, Nombres, Apellidos, Cargo..."
                  className="w-full pl-9 pr-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Panel de Búsqueda Avanzada (Combinable) */}
              {showProgAdvancedSearch && (
                <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Filtros Avanzados Múltiples:
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">DNI</label>
                      <input
                        type="text"
                        value={progFilterDni}
                        onChange={(e) => {
                          setProgFilterDni(e.target.value);
                          setProgWorkerPage(1);
                        }}
                        placeholder="DNI exacto..."
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Nombres</label>
                      <input
                        type="text"
                        value={progFilterNombres}
                        onChange={(e) => {
                          setProgFilterNombres(e.target.value);
                          setProgWorkerPage(1);
                        }}
                        placeholder="Nombres..."
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Apellido Paterno</label>
                      <input
                        type="text"
                        value={progFilterPaterno}
                        onChange={(e) => {
                          setProgFilterPaterno(e.target.value);
                          setProgWorkerPage(1);
                        }}
                        placeholder="Paterno..."
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Apellido Materno</label>
                      <input
                        type="text"
                        value={progFilterMaterno}
                        onChange={(e) => {
                          setProgFilterMaterno(e.target.value);
                          setProgWorkerPage(1);
                        }}
                        placeholder="Materno..."
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Dependencia</label>
                      <select
                        value={progFilterDep}
                        onChange={(e) => {
                          setProgFilterDep(e.target.value);
                          setProgWorkerPage(1);
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      >
                        <option value="ALL">Todas</option>
                        {dependencias.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Régimen</label>
                      <select
                        value={progFilterRegimen}
                        onChange={(e) => {
                          setProgFilterRegimen(e.target.value);
                          setProgWorkerPage(1);
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      >
                        <option value="ALL">Todos</option>
                        <option value="D.L. 276">D.L. 276</option>
                        <option value="CAS D.L. 1057">CAS D.L. 1057</option>
                        <option value="D.L. 728">D.L. 728</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Estado</label>
                      <select
                        value={progFilterEstado}
                        onChange={(e) => {
                          setProgFilterEstado(e.target.value as any);
                          setProgWorkerPage(1);
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      >
                        <option value="ALL">Todos</option>
                        <option value="ACTIVE">ACTIVO</option>
                        <option value="INACTIVE">INACTIVO</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-0.5">Situación Vacacional</label>
                      <select
                        value={progFilterSituacionVac}
                        onChange={(e) => {
                          setProgFilterSituacionVac(e.target.value as any);
                          setProgWorkerPage(1);
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                      >
                        <option value="ALL">Todos</option>
                        <option value="SIN_VACACIONES">Sin Vacaciones</option>
                        <option value="CON_VACACIONES">Con Vacaciones</option>
                        <option value="PENDIENTES">Con Pendientes</option>
                        <option value="VIGENTES">Vacaciones Vigentes</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setProgFilterDni('');
                        setProgFilterNombres('');
                        setProgFilterPaterno('');
                        setProgFilterMaterno('');
                        setProgFilterDep('ALL');
                        setProgFilterDir('ALL');
                        setProgFilterArea('ALL');
                        setProgFilterCargo('ALL');
                        setProgFilterRegimen('ALL');
                        setProgFilterCondicion('ALL');
                        setProgFilterEstado('ACTIVE');
                        setProgFilterSituacionVac('ALL');
                        setProgSearchText('');
                        setProgWorkerPage(1);
                      }}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Limpiar filtros avanzados
                    </button>
                  </div>
                </div>
              )}

              {/* Workers Selectable Table with Pagination */}
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#060709] text-slate-400 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2">DNI</th>
                      <th className="p-2">Servidor</th>
                      <th className="p-2">Dependencia / Área</th>
                      <th className="p-2">Régimen</th>
                      <th className="p-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedProgWorkers.map((emp) => {
                      const isSelected = progSelectedEmp?.id === emp.id;
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => setProgSelectedEmp(emp)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-600/20 text-white font-bold'
                              : 'hover:bg-slate-800/40 text-slate-300'
                          }`}
                        >
                          <td className="p-2 font-mono text-[11px]">{emp.dni}</td>
                          <td className="p-2 font-semibold">
                            {emp.first_name} {emp.last_name}
                          </td>
                          <td className="p-2 text-[11px] text-slate-400">
                            {emp.dependencia_name} • {emp.area_name}
                          </td>
                          <td className="p-2 text-[10px] text-indigo-400 font-mono">{emp.regimen_laboral}</td>
                          <td className="p-2 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-indigo-700 hover:text-white'
                              }`}
                            >
                              {isSelected ? '✓ Seleccionado' : 'Seleccionar'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredProgWorkers.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No se encontraron trabajadores que cumplan con todos los criterios de búsqueda.
                  </div>
                )}
              </div>

              {/* Workers Paginator */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>
                  Mostrando {paginatedProgWorkers.length} de {filteredProgWorkers.length} servidores
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={progWorkerPage <= 1}
                    onClick={() => setProgWorkerPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-mono text-white">{progWorkerPage}</span>
                  <button
                    type="button"
                    disabled={progWorkerPage * progWorkerPageSize >= filteredProgWorkers.length}
                    onClick={() => setProgWorkerPage((p) => p + 1)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Ficha Informativa del Trabajador Seleccionado (Automatic & Read-Only) */}
            {progSelectedEmp && (
              <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block">
                  Trabajador Seleccionado (Datos Informativos No Editables):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Trabajador:</span>
                    <span className="font-bold text-white text-xs block">
                      {progSelectedEmp.first_name} {progSelectedEmp.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">DNI:</span>
                    <span className="font-mono text-cyan-300 font-bold text-xs block">{progSelectedEmp.dni}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Dependencia:</span>
                    <span className="text-slate-200 text-xs block">
                      {progSelectedEmp.dependencia_name || 'SEDE CENTRAL'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Dirección / Órgano:</span>
                    <span className="text-slate-200 text-xs block truncate">
                      {progSelectedEmp.direccion_organo_name || 'Oficina de Administración'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Área / Oficina:</span>
                    <span className="text-slate-200 text-xs block truncate">{progSelectedEmp.area_name || 'Área'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Cargo:</span>
                    <span className="text-slate-200 text-xs block truncate">{progSelectedEmp.position}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Período y Documento de Sustento */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Modalidad</label>
                <select
                  value={progTipo}
                  onChange={(e) => setProgTipo(e.target.value as VacacionTipo)}
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none"
                >
                  <option value="TOTAL_30">Total Completo (30 días de ley)</option>
                  <option value="FRACCIONADO">Fraccionado (15 / 7 días calendario)</option>
                  <option value="PARCIAL">Parcial (Días específicos)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Fecha Inicio</label>
                  <input
                    type="date"
                    value={progStartDate}
                    onChange={(e) => setProgStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Fecha Fin</label>
                  <input
                    type="date"
                    value={progEndDate}
                    onChange={(e) => setProgEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Auto calculated days */}
              <div className="p-3 bg-[#060709] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Días Calendario Computables:</span>
                <span className="font-mono text-base font-bold text-indigo-400">{progDays} días</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">
                  Resolución / Documento de Aprobación Institucional
                </label>
                <textarea
                  rows={2}
                  value={progComments}
                  onChange={(e) => setProgComments(e.target.value)}
                  placeholder="Ej: Resolución Directoral N° 092-2026-GR.CAJ/DRA (Aprobación de Rol Vacacional)..."
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none"
                  required
                />
              </div>

              {progError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{progError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAttendanceProgModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!progSelectedEmp}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-bold transition-colors shadow-sm shadow-indigo-600/20"
              >
                Guardar y Programar Vacaciones
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL C: RECHAZAR SOLICITUD (CON MOTIVO OBLIGATORIO)                      */}
      {/* ========================================================================= */}
      {rejectingVacation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRejection}
            className="bg-[#0F1115] border border-rose-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <XCircle className="w-4 h-4" />
                <span>Rechazar Solicitud de Vacaciones</span>
              </div>
              <button
                type="button"
                onClick={() => setRejectingVacation(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs">
              <div>
                <strong>Servidor:</strong> {rejectingVacation.employee_name} (DNI: {rejectingVacation.employee_dni})
              </div>
              <div className="mt-0.5 text-slate-400">
                <strong>Período:</strong> {rejectingVacation.start_date} al {rejectingVacation.end_date} (
                {rejectingVacation.total_days} días)
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Motivo de Rechazo / No Procedencia <span className="text-rose-400">* (Obligatorio)</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej: El período solicitado coincide con actividades institucionales programadas y cierre de mes..."
                className="w-full px-3 py-2 bg-[#090A0D] text-white border border-rose-800/50 rounded-lg focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingVacation(null)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow-sm shadow-rose-600/20"
              >
                Confirmar Rechazo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL D: HISTORIAL DE AUDITORÍA Y TRAZABILIDAD                            */}
      {/* ========================================================================= */}
      {selectedVacationForAudit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  Historial de Auditoría & Trazabilidad ({selectedVacationForAudit.code || 'VAC'})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVacationForAudit(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
              <div>
                <strong>Servidor:</strong> {selectedVacationForAudit.employee_name} (DNI:{' '}
                {selectedVacationForAudit.employee_dni})
              </div>
              <div>
                <strong>Período:</strong> {selectedVacationForAudit.start_date} al {selectedVacationForAudit.end_date} (
                {selectedVacationForAudit.total_days} días)
              </div>
              <div>
                <strong>Origen:</strong>{' '}
                {selectedVacationForAudit.origin === 'PROFILE_VACATION_REQUEST'
                  ? 'Perfil del Trabajador'
                  : 'Control de Asistencia / RRHH'}
              </div>
              <div>
                <strong>Estado Actual:</strong> {renderStatusBadge(selectedVacationForAudit.status)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Eventos de Auditoría Registrados:
              </div>

              {selectedVacationForAudit.audits && selectedVacationForAudit.audits.length > 0 ? (
                <div className="space-y-2 divide-y divide-slate-800/60">
                  {selectedVacationForAudit.audits.map((aud, index) => (
                    <div key={aud.id || index} className="pt-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-400">
                          {aud.action_type || 'ACCION'} ➔ {aud.new_status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{aud.timestamp}</span>
                      </div>
                      <div className="text-slate-300">
                        <strong>Actor:</strong> {aud.action_by_user_name} ({aud.action_by_role})
                      </div>
                      {aud.comment && <div className="text-slate-400 italic">"{aud.comment}"</div>}
                      {aud.rejection_reason && (
                        <div className="text-rose-400 font-medium">Motivo: {aud.rejection_reason}</div>
                      )}
                      {aud.delegation_info && (
                        <div className="text-[11px] text-cyan-400">
                          Acreditación: {aud.delegation_info.unidad_encargada} ({aud.delegation_info.documento})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 italic py-2">
                  Registro vacacional inicializado conforme a la normativa institucional.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedVacationForAudit(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: SOLICITUD DE VACACIONES REGISTRADA CORRECTAMENTE      */}
      {/* ========================================================================= */}
      {createdVacationConfirmation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-emerald-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-950/30 border-b border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">¡Solicitud de vacaciones registrada correctamente!</h3>
                  <p className="text-xs text-emerald-300">Enviada formalmente al Jefe Inmediato</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedVacationConfirmation(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Código de Solicitud:</span>
                  <span className="font-mono text-sm font-bold text-indigo-400">{createdVacationConfirmation.code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estado Inicial:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 border border-amber-500/40 text-amber-300">
                    SOLICITADA
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Periodo Solicitado:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {createdVacationConfirmation.start_date} al {createdVacationConfirmation.end_date}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Cantidad de Días:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {createdVacationConfirmation.total_days} días calendario
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Modalidad:</span>
                  <span className="text-slate-200 font-semibold">{createdVacationConfirmation.tipo}</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Derivada a V°B° del Jefe Inmediato:</span>
                  <span>{createdVacationConfirmation.supervisor_name || 'Jefatura de Área'}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCreatedVacationConfirmation(null)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Entendido / Ver en Mis Vacaciones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
