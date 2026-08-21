import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  PapeletaSalida,
  PapeletaStatus,
  PapeletaAudit,
  RoleType,
  PapeletaMotivo,
  Employee,
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  Encargatura,
} from '../../types';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  Building2,
  AlertCircle,
  Send,
  PenTool,
  RotateCcw,
  MapPin,
  Shield,
  Crown,
  Eye,
  X,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  Filter,
  ArrowRight,
  Briefcase,
  Printer,
  FileCheck2,
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';
import { getImmediateBossForPapeleta } from '../../utils/vacationEngine';
import { canUserApproveForRequester } from '../../utils/encargaturaUtils';

interface PapeletasModuleProps {
  activeView?: string;
  papeletas: PapeletaSalida[];
  papeletaAudits?: PapeletaAudit[];
  employees: Employee[];
  activeRole: RoleType;
  activeUserDni: string;
  currentUser?: Employee | null;
  encargaturas?: Encargatura[];
  dependencias?: Dependencia[];
  direccionesOrganos?: DireccionOrgano[];
  areas?: Area[];
  cargos?: Cargo[];
  onUpdatePapeletaStatus: (
    papeletaId: string,
    action: PapeletaStatus | 'APPROVE_BOSS' | 'APPROVE_HR' | 'REJECT' | 'MARK_OUTING_REAL' | 'MARK_COMPLETED_REAL',
    comment?: string,
    horaRealSalida?: string,
    horaRealRetorno?: string,
    approverMetadata?: {
      boss_dni?: string;
      boss_id?: string;
      boss_name?: string;
      boss_role?: string;
      boss_function?: string;
      delegation_info?: any;
    }
  ) => void;
  onCreatePapeleta: (newPapeleta: Omit<PapeletaSalida, 'id' | 'code' | 'created_at' | 'updated_at'>) => void;
}

export const PapeletasModule: React.FC<PapeletasModuleProps> = ({
  activeView,
  papeletas,
  papeletaAudits = [],
  employees,
  activeRole,
  activeUserDni,
  currentUser,
  encargaturas = [],
  dependencias = [],
  direccionesOrganos = [],
  areas = [],
  cargos = [],
  onUpdatePapeletaStatus,
  onCreatePapeleta,
}) => {
  // 1. Resolve Authenticated Worker (Strict Identity)
  const activeUserEmployee = useMemo(() => {
    if (currentUser) return currentUser;
    return employees.find((e) => e.dni === activeUserDni) || employees[0] || null;
  }, [currentUser, employees, activeUserDni]);

  // Is security/gatekeeper role or view
  const isSecurityView =
    activeView?.startsWith('security_') ||
    activeRole === 'VIGILANCIA' ||
    activeRole === 'SECURITY_GUARD';

  const isStrictWorker = activeRole === 'TRABAJADOR' || activeRole === 'EMPLOYEE';
  const isBossRole = activeRole === 'JEFE' || activeRole === 'SUPERVISOR' || activeRole === 'DIRECTOR_GENERAL';
  const isHRAdmin = activeRole === 'HR_ADMIN' || activeRole === 'JEFE_RRHH' || activeRole === 'ADMIN_GENERAL' || activeRole === 'CONTROL_ASISTENCIA';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPapeleta, setSelectedPapeleta] = useState<PapeletaSalida | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Tab filter (ALL, PENDING_BOSS, PENDING_HR, APPROVED, IN_OUTING, COMPLETED, REJECTED, MY)
  const [statusTab, setStatusTab] = useState<string>(() => {
    if (isStrictWorker) return 'MY';
    if (activeView === 'security_exit') return 'APPROVED';
    if (activeView === 'security_return' || activeView === 'security_outside') return 'IN_OUTING';
    if (activeView === 'papeletas_pending') return 'PENDING_BOSS';
    if (activeView === 'papeletas_approved') return 'APPROVED';
    if (activeView === 'papeletas_my') return 'MY';
    return isBossRole ? 'PENDING_BOSS' : 'ALL';
  });

  useEffect(() => {
    if (!activeView) return;
    if (activeView === 'papeletas_new') {
      setShowCreateModal(true);
      if (isStrictWorker) setStatusTab('MY');
    } else if (activeView === 'papeletas_pending') {
      setShowCreateModal(false);
      setStatusTab('PENDING_BOSS');
    } else if (activeView === 'papeletas_approved' || activeView === 'security_exit') {
      setShowCreateModal(false);
      setStatusTab('APPROVED');
    } else if (activeView === 'security_return' || activeView === 'security_outside') {
      setShowCreateModal(false);
      setStatusTab('IN_OUTING');
    } else if (activeView === 'papeletas_my') {
      setShowCreateModal(false);
      setStatusTab('MY');
    }
  }, [activeView, isStrictWorker]);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // SORTING STATE
  const [sortField, setSortField] = useState<string | null>('fecha');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // ADVANCED SEARCH & MULTI-FILTER STATE
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMotivo, setFilterMotivo] = useState<string>('ALL');
  const [filterDependencia, setFilterDependencia] = useState<string>('ALL');
  const [filterArea, setFilterArea] = useState<string>('ALL');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [filterSalidaRegistrada, setFilterSalidaRegistrada] = useState<string>('ALL');
  const [filterRetornoRegistrado, setFilterRetornoRegistrado] = useState<string>('ALL');

  // DATA POLICY CONFIRM MODAL (for rejection or approvals)
  const [confirmModalConfig, setConfirmModalConfig] = useState<DataPolicyConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'REJECT',
    requireReason: true,
    onConfirm: () => {},
    onCancel: () => {},
  });

  // VIGILANCIA REGISTRATION MODAL
  const [vigilanciaModal, setVigilanciaModal] = useState<{
    isOpen: boolean;
    papeleta: PapeletaSalida | null;
    type: 'EXIT' | 'RETURN';
    hora: string;
    dniConfirmInput: string;
    observacion: string;
    dniError: string | null;
  }>({
    isOpen: false,
    papeleta: null,
    type: 'EXIT',
    hora: new Date().toLocaleTimeString('es-PE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    dniConfirmInput: '',
    observacion: '',
    dniError: null,
  });

  // FORM STATE FOR NEW PAPELETA (Authenticated Worker Only)
  const [formMotivo, setFormMotivo] = useState<PapeletaMotivo>('COMISION_SERVICIOS');
  const [formDestino, setFormDestino] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [formHoraSalida, setFormHoraSalida] = useState('09:30');
  const [formHoraRetorno, setFormHoraRetorno] = useState('12:30');
  const [formSinRetorno, setFormSinRetorno] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // SIGNATURE CANVAS
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Automatic boss resolution for the active authenticated worker
  const activeWorkerBossResult = useMemo(() => {
    if (!activeUserEmployee) {
      return {
        bossName: 'Jefatura Inmediata DRAC',
        bossDni: '10000003',
        bossId: 'emp-03',
        bossFunction: 'Jefe Titular',
        reason: 'Jefatura General DRAC',
      };
    }
    return getImmediateBossForPapeleta({
      requester: activeUserEmployee,
      allEmployees: employees,
      allEncargaturas: encargaturas,
      targetDate: formFecha,
    });
  }, [activeUserEmployee, employees, encargaturas, formFecha]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterMotivo !== 'ALL') count++;
    if (filterDependencia !== 'ALL') count++;
    if (filterArea !== 'ALL') count++;
    if (filterFechaDesde) count++;
    if (filterFechaHasta) count++;
    if (filterSalidaRegistrada !== 'ALL') count++;
    if (filterRetornoRegistrado !== 'ALL') count++;
    return count;
  }, [
    filterMotivo,
    filterDependencia,
    filterArea,
    filterFechaDesde,
    filterFechaHasta,
    filterSalidaRegistrada,
    filterRetornoRegistrado,
  ]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterMotivo('ALL');
    setFilterDependencia('ALL');
    setFilterArea('ALL');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterSalidaRegistrada('ALL');
    setFilterRetornoRegistrado('ALL');
    setCurrentPage(1);
  };

  // Sort handler
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

  // UNIQUE DEPENDENCIES & AREAS FOR FILTERS
  const uniqueDependencias = useMemo(() => {
    const set = new Set<string>();
    papeletas.forEach((p) => {
      if (p.dependencia_name) set.add(p.dependencia_name);
    });
    return Array.from(set);
  }, [papeletas]);

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    papeletas.forEach((p) => {
      if (p.area_name) set.add(p.area_name);
    });
    return Array.from(set);
  }, [papeletas]);

  // MASTER FILTERING & RBAC SCOPING
  const filteredPapeletas = useMemo(() => {
    return papeletas.filter((p) => {
      // 1. RBAC SCOPE: Worker can ONLY ever see their own papeletas
      if (isStrictWorker) {
        if (p.employee_dni !== activeUserDni) return false;
      } else if (isBossRole && !isHRAdmin) {
        // JEFE/SUPERVISOR: sees their subordinates + their own
        if (statusTab === 'MY') {
          if (p.employee_dni !== activeUserDni) return false;
        } else if (statusTab === 'PENDING_BOSS') {
          if (p.status !== 'PENDING_BOSS') return false;
        }
      }

      // 2. VIGILANCIA / GARITA SCOPE RULE
      if (isSecurityView) {
        if (statusTab === 'APPROVED' || activeView === 'security_exit') {
          if (p.status !== 'APPROVED' || Boolean(p.hora_real_salida)) return false;
        } else if (statusTab === 'IN_OUTING' || activeView === 'security_return' || activeView === 'security_outside') {
          if (p.status !== 'IN_OUTING') return false;
        } else if (statusTab === 'COMPLETED') {
          if (p.status !== 'COMPLETED') return false;
        } else if (statusTab === 'ALL') {
          const isRelevant = p.status === 'APPROVED' || p.status === 'IN_OUTING' || p.status === 'COMPLETED';
          if (!isRelevant) return false;
        }
      } else {
        // NON-SECURITY TAB FILTERS
        if (statusTab === 'PENDING_BOSS') {
          if (p.status !== 'PENDING_BOSS') return false;
        } else if (statusTab === 'PENDING_HR') {
          if (p.status !== 'PENDING_HR') return false;
        } else if (statusTab === 'APPROVED') {
          if (p.status !== 'APPROVED') return false;
        } else if (statusTab === 'IN_OUTING') {
          if (p.status !== 'IN_OUTING') return false;
        } else if (statusTab === 'COMPLETED') {
          if (p.status !== 'COMPLETED') return false;
        } else if (statusTab === 'REJECTED') {
          if (p.status !== 'REJECTED') return false;
        } else if (statusTab === 'MY') {
          if (p.employee_dni !== activeUserDni) return false;
        }
      }

      // 3. TEXT SEARCH
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchCode = p.code.toLowerCase().includes(term);
        const matchDni = p.employee_dni.includes(term);
        const matchName = p.employee_name.toLowerCase().includes(term);
        const matchDestino = p.destino.toLowerCase().includes(term);
        const matchDesc = p.descripcion.toLowerCase().includes(term);
        const matchArea = p.area_name.toLowerCase().includes(term);
        if (!matchCode && !matchDni && !matchName && !matchDestino && !matchDesc && !matchArea) {
          return false;
        }
      }

      // 4. MULTI-FILTERS
      if (filterMotivo !== 'ALL' && p.motivo !== filterMotivo) return false;
      if (filterDependencia !== 'ALL' && p.dependencia_name !== filterDependencia) return false;
      if (filterArea !== 'ALL' && p.area_name !== filterArea) return false;
      if (filterFechaDesde && p.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && p.fecha > filterFechaHasta) return false;
      if (filterSalidaRegistrada === 'YES' && !p.hora_real_salida) return false;
      if (filterSalidaRegistrada === 'NO' && Boolean(p.hora_real_salida)) return false;
      if (filterRetornoRegistrado === 'YES' && !p.hora_real_retorno) return false;
      if (filterRetornoRegistrado === 'NO' && Boolean(p.hora_real_retorno)) return false;

      return true;
    });
  }, [
    papeletas,
    isStrictWorker,
    isBossRole,
    isHRAdmin,
    isSecurityView,
    activeView,
    statusTab,
    activeUserDni,
    searchTerm,
    filterMotivo,
    filterDependencia,
    filterArea,
    filterFechaDesde,
    filterFechaHasta,
    filterSalidaRegistrada,
    filterRetornoRegistrado,
  ]);

  // SORTED RESULTS
  const sortedPapeletas = useMemo(() => {
    if (!sortField || !sortOrder) return filteredPapeletas;

    return [...filteredPapeletas].sort((a, b) => {
      let valA: any = a[sortField as keyof PapeletaSalida] ?? '';
      let valB: any = b[sortField as keyof PapeletaSalida] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPapeletas, sortField, sortOrder]);

  // PAGINATED SLICE
  const paginatedPapeletas = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedPapeletas.slice(startIndex, startIndex + pageSize);
  }, [sortedPapeletas, currentPage, pageSize]);

  // CANVAS DRAWING HANDLERS
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  // SUBMIT HANDLER FOR NEW PAPELETA (EXCLUSIVELY AUTHENTICATED WORKER)
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activeUserEmployee) {
      setFormError('Error de sesión: No se identificó el trabajador autenticado.');
      return;
    }

    if (!formDestino.trim()) {
      setFormError('Debe ingresar el lugar de destino de la salida.');
      return;
    }

    if (!formDescripcion.trim()) {
      setFormError('Debe detallar la justificación o motivo institucional de la papeleta.');
      return;
    }

    if (!formFecha) {
      setFormError('Debe seleccionar la fecha de la salida.');
      return;
    }

    if (!formHoraSalida) {
      setFormError('Debe especificar la hora estimada de salida.');
      return;
    }

    if (!formSinRetorno && !formHoraRetorno) {
      setFormError('Debe especificar la hora estimada de retorno o marcar salida sin retorno.');
      return;
    }

    // Call onCreatePapeleta with the authenticated worker's exact data
    onCreatePapeleta({
      employee_id: activeUserEmployee.id,
      employee_dni: activeUserEmployee.dni,
      employee_name: `${activeUserEmployee.first_name} ${activeUserEmployee.last_name}`,
      dependencia_name: activeUserEmployee.dependencia_name || 'SEDE CENTRAL',
      direccion_organo_name: activeUserEmployee.direccion_organo_name,
      area_name: activeUserEmployee.area_name || 'OFICINA DRAC',
      supervisor_id: activeWorkerBossResult.bossId || 'boss-default',
      supervisor_name: activeWorkerBossResult.bossName,
      motivo: formMotivo,
      descripcion: formDescripcion.trim(),
      destino: formDestino.trim(),
      fecha: formFecha,
      hora_estimada_salida: formHoraSalida,
      hora_estimada_retorno: formSinRetorno ? 'Sin retorno' : formHoraRetorno,
      sin_retorno: formSinRetorno,
      status: 'PENDING_BOSS',
      origin: 'PORTAL_TRABAJADOR',
      digital_signature_data: signatureData || undefined,
      signed_at: new Date().toISOString(),
      created_by: `${activeUserEmployee.first_name} ${activeUserEmployee.last_name}`,
      created_by_role: activeRole,
    });

    // Reset & Close
    setShowCreateModal(false);
    setFormDestino('');
    setFormDescripcion('');
    setFormSinRetorno(false);
    setSignatureData(null);
    setFormError(null);
  };

  // VIGILANCIA CONFIRMATION SUBMISSION
  const handleVigilanciaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vigilanciaModal.papeleta) return;

    const enteredDni = vigilanciaModal.dniConfirmInput.trim();
    if (enteredDni && enteredDni !== vigilanciaModal.papeleta.employee_dni) {
      setVigilanciaModal((prev) => ({
        ...prev,
        dniError: `El DNI ingresado (${enteredDni}) no coincide con el titular autorizado (${vigilanciaModal.papeleta?.employee_dni}).`,
      }));
      return;
    }

    const currentServerTime =
      vigilanciaModal.hora ||
      new Date().toLocaleTimeString('es-PE', { hour12: false, hour: '2-digit', minute: '2-digit' });

    if (vigilanciaModal.type === 'EXIT') {
      const isSinRetorno = Boolean(vigilanciaModal.papeleta.sin_retorno);
      const action = isSinRetorno ? 'MARK_COMPLETED_REAL' : 'MARK_OUTING_REAL';
      const obs =
        vigilanciaModal.observacion ||
        (isSinRetorno
          ? 'Salida física sin retorno registrada en Garita de Vigilancia'
          : 'Salida física autorizada registrada en Garita de Vigilancia');

      onUpdatePapeletaStatus(
        vigilanciaModal.papeleta.id,
        action,
        obs,
        currentServerTime
      );
    } else {
      const obs =
        vigilanciaModal.observacion || 'Retorno físico verificado conforme en Garita de Vigilancia';

      onUpdatePapeletaStatus(
        vigilanciaModal.papeleta.id,
        'MARK_COMPLETED_REAL',
        obs,
        vigilanciaModal.papeleta.hora_real_salida || undefined,
        currentServerTime
      );
    }

    setVigilanciaModal({
      isOpen: false,
      papeleta: null,
      type: 'EXIT',
      hora: '',
      dniConfirmInput: '',
      observacion: '',
      dniError: null,
    });
  };

  // Boss Approval Handler with full anti-autoaprobación guard
  const handleBossApproval = (papeleta: PapeletaSalida) => {
    // 1. Anti-Autoaprobación validation
    if (papeleta.employee_dni === activeUserDni || papeleta.employee_id === activeUserEmployee?.id) {
      alert('🔒 Control Anti-Autoaprobación: No puede otorgar visto bueno a una papeleta que usted mismo ha solicitado.');
      return;
    }

    // Determine if acting as titular or encargado temporal
    const bossEmp = activeUserEmployee;
    const reqEmp = employees.find((e) => e.dni === papeleta.employee_dni);
    let bossFunction = 'Jefe Titular';
    let delegationInfo: any = undefined;

    if (bossEmp && reqEmp) {
      const evalResult = canUserApproveForRequester({
        bossEmployee: bossEmp,
        requesterEmployee: reqEmp,
        allEncargaturas: encargaturas,
        targetDate: papeleta.fecha,
      });

      if (evalResult.isEncargado && evalResult.encargatura) {
        bossFunction = 'Jefe Encargado';
        delegationInfo = {
          is_encargado: true,
          encargatura_id: evalResult.encargatura.id,
          unidad_encargada: evalResult.encargatura.cargo_encargado,
          documento: `${evalResult.encargatura.document_type} N.º ${evalResult.encargatura.document_number}`,
          vigencia: `${evalResult.encargatura.start_date} al ${evalResult.encargatura.end_date}`,
        };
      }
    }

    const approverName = bossEmp ? `${bossEmp.first_name} ${bossEmp.last_name}` : 'Jefe Inmediato DRAC';
    const approverDni = activeUserDni;

    onUpdatePapeletaStatus(
      papeleta.id,
      'APPROVE_BOSS',
      `V°B° otorgado por ${bossFunction} (${approverName})`,
      undefined,
      undefined,
      {
        boss_dni: approverDni,
        boss_id: bossEmp?.id,
        boss_name: approverName,
        boss_role: activeRole,
        boss_function: bossFunction,
        delegation_info: delegationInfo,
      }
    );
  };

  const statusBadge: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'BORRADOR', color: 'bg-slate-800 text-slate-400 border-slate-700' },
    PENDING_BOSS: { label: '1º VOBO JEFE', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    PENDING_HR: { label: '2º VOBO RRHH', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
    APPROVED: { label: 'AUTORIZADA GARITA', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    IN_OUTING: { label: 'EN SALIDA REAL', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    COMPLETED: { label: 'FINALIZADA', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    REJECTED: { label: 'RECHAZADA', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    CANCELLED: { label: 'CANCELADA', color: 'bg-slate-800 text-slate-500 border-slate-700' },
  };

  const motivoLabels: Record<string, string> = {
    COMISION_SERVICIOS: 'Comisión de Servicios',
    SALUD_MEDICA: 'Salud / Cita Médica',
    CAPACITACION_INSTITUCIONAL: 'Capacitación Institucional',
    ASUNTOS_PARTICULARES: 'Asuntos Particulares',
    PERSONAL: 'Asuntos Personales',
    DILIGENCIA_OFICIAL: 'Diligencia Oficial',
    OTRO: 'Otro Motivo',
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              {isSecurityView ? <Shield className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {isSecurityView
                  ? 'Control de Garita y Vigilancia DRAC — Salidas y Retornos'
                  : 'Papeletas de Salida DRAC (Permisos Oficiales de Jornada)'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSecurityView
                  ? 'Verificación física de DNI, registro de horas exactas de salida y retorno de servidores públicos autorizados.'
                  : isStrictWorker
                  ? 'Gestión personal de papeletas de salida: solicitud oficial intransferible sujeta a V°B° del jefe inmediato.'
                  : 'Flujo oficial: Solicitud del trabajador ➔ V°B° Jefe Inmediato ➔ Autorización RRHH ➔ Control Garita.'}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        {!isSecurityView && (
          <button
            type="button"
            onClick={() => {
              if (!activeUserEmployee) {
                alert('Error: No se encontró registro del trabajador autenticado.');
                return;
              }
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 self-start md:self-auto shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Papeleta de Salida</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs - STRICTLY ROLE-SCOPED */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        {/* Worker View: ONLY "Mis Papeletas" */}
        {isStrictWorker ? (
          <button
            type="button"
            onClick={() => {
              setStatusTab('MY');
              setCurrentPage(1);
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors bg-indigo-600 text-white flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Mis Papeletas de Salida ({papeletas.filter((p) => p.employee_dni === activeUserDni).length})</span>
          </button>
        ) : isSecurityView ? (
          <>
            <button
              type="button"
              onClick={() => {
                setStatusTab('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusTab === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todas en Garita ({papeletas.filter((p) => p.status === 'APPROVED' || p.status === 'IN_OUTING' || p.status === 'COMPLETED').length})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('APPROVED');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'APPROVED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-emerald-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                Pendientes de Salida ({papeletas.filter((p) => p.status === 'APPROVED' && !p.hora_real_salida).length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('IN_OUTING');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'IN_OUTING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-blue-400 hover:text-white'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>
                Personal Fuera / Retorno ({papeletas.filter((p) => p.status === 'IN_OUTING').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('COMPLETED');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'COMPLETED'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-purple-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Finalizadas ({papeletas.filter((p) => p.status === 'COMPLETED').length})</span>
            </button>
          </>
        ) : (
          /* Jefes / RRHH / Administradores */
          <>
            <button
              type="button"
              onClick={() => {
                setStatusTab('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusTab === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todas ({papeletas.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('PENDING_BOSS');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'PENDING_BOSS'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-amber-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                Pendientes V°B° Jefe ({papeletas.filter((p) => p.status === 'PENDING_BOSS').length})
              </span>
            </button>

            {isHRAdmin && (
              <button
                type="button"
                onClick={() => {
                  setStatusTab('PENDING_HR');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  statusTab === 'PENDING_HR'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Pendientes RRHH ({papeletas.filter((p) => p.status === 'PENDING_HR').length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setStatusTab('APPROVED');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'APPROVED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-emerald-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Autorizadas ({papeletas.filter((p) => p.status === 'APPROVED').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('MY');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'MY'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-purple-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Mis Solicitudes ({papeletas.filter((p) => p.employee_dni === activeUserDni).length})</span>
            </button>
          </>
        )}
      </div>

      {/* Advanced Search & Multi-filter (Available for Admin/Boss/Gate, clean for Worker) */}
      <AdvancedSearchFilter
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        searchPlaceholder={
          isStrictWorker
            ? '🔍 Buscar en mis papeletas por N.º papeleta, destino, motivo...'
            : '🔍 Buscar por DNI, N.º papeleta, trabajador, área, destino...'
        }
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      >
        {/* Filter by Motivo */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Tipo / Motivo</label>
          <select
            value={filterMotivo}
            onChange={(e) => {
              setFilterMotivo(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="COMISION_SERVICIOS">Comisión de Servicios</option>
            <option value="SALUD_MEDICA">Salud / Cita Médica</option>
            <option value="CAPACITACION_INSTITUCIONAL">Capacitación Institucional</option>
            <option value="ASUNTOS_PARTICULARES">Asuntos Particulares</option>
          </select>
        </div>

        {/* Filter by Dependencia (Only for administrative roles) */}
        {!isStrictWorker && (
          <div>
            <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Dependencia</label>
            <select
              value={filterDependencia}
              onChange={(e) => {
                setFilterDependencia(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="ALL">Todas las dependencias</option>
              {uniqueDependencias.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter by Área (Only for administrative roles) */}
        {!isStrictWorker && (
          <div>
            <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Área / Oficina</label>
            <select
              value={filterArea}
              onChange={(e) => {
                setFilterArea(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="ALL">Todas las áreas</option>
              {uniqueAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Date From */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Fecha Desde</label>
          <input
            type="date"
            value={filterFechaDesde}
            onChange={(e) => {
              setFilterFechaDesde(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
          />
        </div>

        {/* Filter Date To */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Fecha Hasta</label>
          <input
            type="date"
            value={filterFechaHasta}
            onChange={(e) => {
              setFilterFechaHasta(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
          />
        </div>

        {/* Filter Salida Registrada */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Salida Física</label>
          <select
            value={filterSalidaRegistrada}
            onChange={(e) => {
              setFilterSalidaRegistrada(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
          >
            <option value="ALL">Cualquiera</option>
            <option value="YES">Con Salida Sellada</option>
            <option value="NO">Sin Salida Sellada</option>
          </select>
        </div>

        {/* Filter Retorno Registrado */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Retorno Físico</label>
          <select
            value={filterRetornoRegistrado}
            onChange={(e) => {
              setFilterRetornoRegistrado(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
          >
            <option value="ALL">Cualquiera</option>
            <option value="YES">Con Retorno Sellado</option>
            <option value="NO">Sin Retorno Sellado</option>
          </select>
        </div>
      </AdvancedSearchFilter>

      {/* Main Responsive Table Container */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {sortedPapeletas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              isStrictWorker
                ? 'No tiene papeletas de salida registradas'
                : 'No se encontraron papeletas con los filtros seleccionados'
            }
            description={
              isStrictWorker
                ? 'Haga clic en "Nueva Papeleta de Salida" para generar su primera solicitud intransferible.'
                : 'Verifique los términos de búsqueda o limpie los filtros para ver todos los registros.'
            }
            actionLabel={isStrictWorker ? 'Solicitar Papeleta' : undefined}
            onAction={isStrictWorker ? () => setShowCreateModal(true) : undefined}
          />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#090A0D] border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="w-8 px-2 py-3 text-center">#</th>
                  <SortableHeader
                    label="Nº Papeleta"
                    field="code"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    className="w-28"
                  />
                  <SortableHeader
                    label="Trabajador / DNI"
                    field="employee_name"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Dependencia / Área"
                    field="dependencia_name"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    className="hidden md:table-cell"
                  />
                  <SortableHeader
                    label="Tipo & Destino"
                    field="motivo"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    className="hidden sm:table-cell"
                  />
                  <SortableHeader
                    label="Fecha & Horario"
                    field="fecha"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    className="w-32"
                  />
                  <th className="px-3 py-3 w-28 text-center">Garita (S / R)</th>
                  <SortableHeader
                    label="Estado"
                    field="status"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    className="w-28 text-center"
                    align="center"
                  />
                  <th className="px-3 py-3 text-right w-44">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {paginatedPapeletas.map((p, idx) => {
                  const badge = statusBadge[p.status] || statusBadge.DRAFT;
                  const isExpanded = expandedRowId === p.id;
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const isSelfApplicant =
                    p.employee_dni === activeUserDni || p.employee_id === activeUserEmployee?.id;

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className={`hover:bg-slate-800/30 transition-colors ${
                          isExpanded ? 'bg-slate-900/60' : ''
                        }`}
                      >
                        <td className="px-2 py-3 text-center text-slate-500 font-mono text-[11px]">
                          {rowNum}
                        </td>

                        {/* Code & Toggle Detail */}
                        <td className="px-3 py-3">
                          <div className="font-mono text-indigo-400 font-bold">{p.code}</div>
                          <button
                            type="button"
                            onClick={() => setExpandedRowId(isExpanded ? null : p.id)}
                            className="text-[10px] text-slate-400 hover:text-indigo-300 flex items-center gap-0.5 mt-0.5 font-medium"
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver datos'}</span>
                            {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          </button>
                        </td>

                        {/* Worker & DNI */}
                        <td className="px-3 py-3">
                          <div className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span>{p.employee_name}</span>
                            {isSelfApplicant && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded">
                                Yo
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">DNI: {p.employee_dni}</div>
                        </td>

                        {/* Dependency & Area */}
                        <td className="px-3 py-3 hidden md:table-cell">
                          <div className="text-slate-200 font-medium truncate max-w-[180px]">
                            {p.dependencia_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{p.area_name}</div>
                        </td>

                        {/* Motivo & Destino */}
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="font-semibold text-slate-200 text-[11px] block">
                            {motivoLabels[p.motivo] || p.motivo}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[180px]">
                            <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                            {p.destino}
                          </span>
                        </td>

                        {/* Date & Scheduled Time */}
                        <td className="px-3 py-3 font-mono">
                          <div className="text-slate-200 font-bold text-xs">{p.fecha}</div>
                          <div className="text-slate-400 text-[10px] whitespace-nowrap">
                            {p.hora_estimada_salida} ➔ {p.hora_estimada_retorno}
                          </div>
                        </td>

                        {/* Real Garita Times */}
                        <td className="px-3 py-3 font-mono text-[11px] text-center">
                          {p.hora_real_salida ? (
                            <div className="space-y-0.5">
                              <span className="text-emerald-400 font-bold block">
                                S: {p.hora_real_salida}
                              </span>
                              <span
                                className={`block font-bold ${
                                  p.hora_real_retorno ? 'text-purple-400' : 'text-amber-400 animate-pulse'
                                }`}
                              >
                                R: {p.hora_real_retorno || (p.sin_retorno ? 'Sin retorno' : 'Fuera...')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">Sin salida</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border whitespace-nowrap ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* View Detail Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedPapeleta(p)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                              title="Ver Ficha Completa y Trazabilidad"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* 1º VoBo Jefe Inmediato (STRICT ANTI-AUTOAPROBACIÓN IMPLEMENTATION) */}
                            {p.status === 'PENDING_BOSS' && (
                              <>
                                {isSelfApplicant ? (
                                  <span
                                    className="px-2 py-1 bg-amber-950/40 border border-amber-500/30 text-amber-400 rounded text-[10px] font-bold flex items-center gap-1 cursor-not-allowed select-none"
                                    title="Autoaprobación bloqueada: No puede otorgar visto bueno a una papeleta que usted mismo ha solicitado."
                                  >
                                    <Lock className="w-3 h-3 text-amber-400" />
                                    <span>Autoaprobación Bloqueada</span>
                                  </span>
                                ) : (
                                  (isBossRole || isHRAdmin) && (
                                    <button
                                      type="button"
                                      onClick={() => handleBossApproval(p)}
                                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>VoBo Jefe</span>
                                    </button>
                                  )
                                )}
                              </>
                            )}

                            {/* 2º Aprobación RRHH / Control de Asistencia */}
                            {p.status === 'PENDING_HR' && isHRAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePapeletaStatus(
                                    p.id,
                                    'APPROVE_HR',
                                    'Papeleta Autorizada Oficialmente por Recursos Humanos DRAC'
                                  )
                                }
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Aprobar RRHH</span>
                              </button>
                            )}

                            {/* Reject Option (Boss / RRHH) */}
                            {(p.status === 'PENDING_BOSS' || p.status === 'PENDING_HR') &&
                              (isBossRole || isHRAdmin) &&
                              !isSelfApplicant && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModalConfig({
                                      isOpen: true,
                                      title: 'Rechazar Solicitud de Papeleta',
                                      message: `¿Desea rechazar la papeleta ${p.code} de ${p.employee_name}? Ingrese el motivo institucional para la bitácora de auditoría.`,
                                      actionType: 'REJECT',
                                      requireReason: true,
                                      entityName: `${p.code} - ${p.employee_name}`,
                                      confirmText: 'Confirmar Rechazo',
                                      onConfirm: (reason) => {
                                        onUpdatePapeletaStatus(
                                          p.id,
                                          'REJECT',
                                          reason || 'Rechazado por Jefatura / RRHH'
                                        );
                                        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                      },
                                      onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                                    });
                                  }}
                                  className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 border border-rose-500/20 rounded text-xs transition-colors"
                                  title="Rechazar Papeleta"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                            {/* VIGILANCIA / GARITA: REGISTRAR SALIDA */}
                            {p.status === 'APPROVED' &&
                              !p.hora_real_salida &&
                              (isSecurityView || isHRAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nowTime = new Date().toLocaleTimeString('es-PE', {
                                      hour12: false,
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                    setVigilanciaModal({
                                      isOpen: true,
                                      papeleta: p,
                                      type: 'EXIT',
                                      hora: nowTime,
                                      dniConfirmInput: '',
                                      observacion: p.sin_retorno
                                        ? 'Salida definitiva sin retorno registrada en Garita'
                                        : 'Salida física autorizada registrada en Garita',
                                      dniError: null,
                                    });
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
                                >
                                  <Shield className="w-3 h-3" />
                                  <span>Sellar Salida</span>
                                </button>
                              )}

                            {/* VIGILANCIA / GARITA: REGISTRAR RETORNO */}
                            {p.status === 'IN_OUTING' &&
                              !p.hora_real_retorno &&
                              (isSecurityView || isHRAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nowTime = new Date().toLocaleTimeString('es-PE', {
                                      hour12: false,
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                    setVigilanciaModal({
                                      isOpen: true,
                                      papeleta: p,
                                      type: 'RETURN',
                                      hora: nowTime,
                                      dniConfirmInput: '',
                                      observacion: 'Retorno físico verificado conforme en Garita',
                                      dniError: null,
                                    });
                                  }}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Sellar Retorno</span>
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Quick View Row */}
                      {isExpanded && (
                        <tr className="bg-slate-900/40 border-b border-slate-800">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div className="space-y-1">
                                <span className="font-bold text-slate-400 block">Fundamentación / Motivo:</span>
                                <p className="text-slate-200 bg-[#090A0D] p-2.5 rounded-lg border border-slate-800">
                                  {p.descripcion}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <span className="font-bold text-slate-400 block">Jefatura Evaluadora:</span>
                                <div className="bg-[#090A0D] p-2.5 rounded-lg border border-slate-800 space-y-1">
                                  <div className="text-white font-medium">{p.supervisor_name}</div>
                                  {p.boss_approved_at && (
                                    <div className="text-[11px] text-emerald-400">
                                      ✓ V°B° otorgado: {p.boss_approved_at}
                                    </div>
                                  )}
                                  {p.boss_comment && (
                                    <div className="text-[10px] text-slate-400 italic">"{p.boss_comment}"</div>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="font-bold text-slate-400 block">Autorización y Garita:</span>
                                <div className="bg-[#090A0D] p-2.5 rounded-lg border border-slate-800 space-y-1">
                                  {p.hr_approved_at ? (
                                    <div className="text-[11px] text-indigo-300">
                                      ✓ RRHH Aprobado: {p.hr_approved_at} ({p.hr_approver_name || 'Personal'})
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-500">Pendiente de autorización RRHH</div>
                                  )}
                                  {p.sin_retorno && (
                                    <div className="text-[10px] text-amber-400 font-semibold">
                                      * Salida sin retorno (Finalización en garita)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {sortedPapeletas.length > 0 && (
          <div className="p-3 border-t border-slate-800">
            <DataTablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={sortedPapeletas.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* ========================================================
          CREATE PAPELETA MODAL: STRICT SELF-SERVICE ONLY
          Worker is automatically identified from session/profile.
          NO SELECTOR, NO SEARCH, NO OTHER WORKER OPTION.
          ======================================================== */}
      {showCreateModal && activeUserEmployee && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">NUEVA PAPELETA DE SALIDA</h3>
                  <p className="text-xs text-slate-400">Solicitud personal e intransferible — DRAC</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Trabajador Solicitante (READ ONLY / LOCKED IDENTITY) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Trabajador Solicitante</span>
                  <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Identificación Automática Intransferible
                  </span>
                </label>
                <div className="p-3.5 bg-[#090A0D] border border-indigo-500/30 rounded-xl space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-xs">
                        {activeUserEmployee.first_name[0]}
                        {activeUserEmployee.last_name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          {activeUserEmployee.first_name} {activeUserEmployee.last_name}
                        </div>
                        <div className="font-mono text-xs text-indigo-300">
                          DNI: {activeUserEmployee.dni}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-full">
                      Sesión Activa
                    </span>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Dependencia: </span>
                      <span className="text-slate-200 font-medium">{activeUserEmployee.dependencia_name || 'SEDE CENTRAL'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Área: </span>
                      <span className="text-slate-200 font-medium">{activeUserEmployee.area_name || 'ADMINISTRACIÓN'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Cargo & Régimen: </span>
                      <span className="text-slate-300">{activeUserEmployee.position} ({activeUserEmployee.regimen_laboral || 'D.L. 1057 / 276'})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Immediate Boss Determination (Automatic) */}
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs">
                <Crown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-300">
                    V°B° Asignado Automáticamente: {activeWorkerBossResult.bossName}
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    Función: <span className="font-semibold text-white">{activeWorkerBossResult.bossFunction}</span> ({activeWorkerBossResult.reason})
                  </div>
                  <div className="text-[10px] text-amber-400/80">
                    * La papeleta será dirigida a la bandeja de visto bueno de esta autoridad antes de su pase a RRHH.
                  </div>
                </div>
              </div>

              {/* 3. Tipo de Papeleta & Destino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tipo de Papeleta <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formMotivo}
                    onChange={(e) => setFormMotivo(e.target.value as PapeletaMotivo)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="COMISION_SERVICIOS">Comisión de Servicios</option>
                    <option value="SALUD_MEDICA">Salud / Cita Médica</option>
                    <option value="CAPACITACION_INSTITUCIONAL">Capacitación Institucional</option>
                    <option value="ASUNTOS_PARTICULARES">Asuntos Particulares</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Lugar de Destino <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Sede GORE Cajamarca / EsSalud / Notaría"
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* 4. Descripción / Fundamentación */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Motivo / Descripción / Fundamentación <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle los fundamentos y diligencias oficiales o justificación a realizar..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* 5. Fecha y Horarios Estimados */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Fecha <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Hora Salida <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    value={formHoraSalida}
                    onChange={(e) => setFormHoraSalida(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Hora Retorno <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    disabled={formSinRetorno}
                    value={formSinRetorno ? '' : formHoraRetorno}
                    onChange={(e) => setFormHoraRetorno(e.target.value)}
                    className={`w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 ${
                      formSinRetorno ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    required={!formSinRetorno}
                  />
                </div>
              </div>

              {/* Salida Sin Retorno Checkbox */}
              <label className="flex items-start gap-2.5 p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formSinRetorno}
                  onChange={(e) => setFormSinRetorno(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 shrink-0"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Salida sin retorno (Comisión final de jornada / No regresa hoy a la entidad)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Garita de Vigilancia registrará la salida física y finalizará la papeleta sin requerir retorno.
                  </p>
                </div>
              </label>

              {/* Digital Signature Canvas */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Firma Digital del Solicitante (Mouse o Pantalla Táctil)</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[10px] text-slate-400 hover:text-rose-400"
                  >
                    Limpiar Trazo
                  </button>
                </div>

                <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={90}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair touch-none bg-[#090A0D] rounded border border-slate-800/80 w-full"
                  />
                </div>
                <p className="text-[10px] text-slate-500 italic text-center">
                  * Al enviar, la solicitud quedará firmada digitalmente y vinculada a su DNI {activeUserEmployee.dni}.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormError(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Solicitar papeleta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          VIEW DETAILS MODAL & AUDIT TRAIL
          ======================================================== */}
      {selectedPapeleta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#090A0D]">
              <div>
                <div className="font-mono text-indigo-400 font-bold text-sm">{selectedPapeleta.code}</div>
                <h3 className="font-bold text-base text-white">Ficha Oficial de Papeleta de Salida DRAC</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPapeleta(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Anti-Autoaprobación Banner if viewing own pending papeleta */}
              {selectedPapeleta.status === 'PENDING_BOSS' &&
                (selectedPapeleta.employee_dni === activeUserDni ||
                  selectedPapeleta.employee_id === activeUserEmployee?.id) && (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      🔒 <strong>Control Anti-Autoaprobación:</strong> Usted es el solicitante de esta papeleta. El visto bueno debe ser otorgado por su jefe inmediato superior o encargado temporal.
                    </span>
                  </div>
                )}

              {/* Worker Information */}
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Trabajador:</span>
                  <span className="font-bold text-white text-sm">{selectedPapeleta.employee_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">DNI:</span>
                  <span className="text-indigo-400 font-mono font-bold">{selectedPapeleta.employee_dni}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dependencia / Área:</span>
                  <span className="text-slate-200">
                    {selectedPapeleta.dependencia_name} — {selectedPapeleta.area_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Jefe Inmediato:</span>
                  <span className="text-amber-300 font-semibold">{selectedPapeleta.supervisor_name}</span>
                </div>
              </div>

              {/* Details */}
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tipo de Papeleta:</span>
                  <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                    {motivoLabels[selectedPapeleta.motivo] || selectedPapeleta.motivo}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Destino:</span>
                  <span className="text-indigo-300 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    {selectedPapeleta.destino}
                  </span>
                </div>
                <div className="border-t border-slate-800/80 pt-2">
                  <span className="text-slate-400 block mb-1 font-semibold">Fundamentación:</span>
                  <p className="text-slate-200 bg-[#090A0D] p-2.5 rounded-lg border border-slate-800">
                    {selectedPapeleta.descripcion}
                  </p>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#090A0D] rounded-xl border border-slate-800">
                  <div className="font-bold text-slate-400 text-[10px]">HORARIO PROGRAMADO</div>
                  <div className="text-white font-mono mt-1 font-bold">{selectedPapeleta.fecha}</div>
                  <div className="text-slate-300 font-mono mt-0.5">
                    {selectedPapeleta.hora_estimada_salida} ➔ {selectedPapeleta.hora_estimada_retorno}
                  </div>
                </div>

                <div className="p-3 bg-[#090A0D] rounded-xl border border-slate-800">
                  <div className="font-bold text-slate-400 text-[10px]">SELLOS REALES EN GARITA</div>
                  <div className="text-emerald-400 font-mono mt-1 font-bold">
                    Salida: {selectedPapeleta.hora_real_salida || 'Sin registrar'}
                  </div>
                  <div className="text-purple-400 font-mono mt-0.5 font-bold">
                    Retorno: {selectedPapeleta.hora_real_retorno || (selectedPapeleta.sin_retorno ? 'Sin retorno' : 'Sin registrar')}
                  </div>
                </div>
              </div>

              {/* Digital Signature */}
              {selectedPapeleta.digital_signature_data && (
                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Firma Digital del Solicitante:</span>
                  <img
                    src={selectedPapeleta.digital_signature_data}
                    alt="Firma Digital"
                    className="h-10 bg-[#090A0D] rounded p-1 border border-slate-800"
                  />
                </div>
              )}

              {/* Boss VoBo section */}
              {selectedPapeleta.boss_approved_at && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>V°B° Otorgado por: {selectedPapeleta.boss_approver_name || selectedPapeleta.supervisor_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Fecha: {selectedPapeleta.boss_approved_at} | Función: {selectedPapeleta.boss_approver_function || 'Jefe Titular'}
                  </div>
                  {selectedPapeleta.boss_comment && (
                    <div className="text-[11px] text-slate-400 italic">"{selectedPapeleta.boss_comment}"</div>
                  )}
                </div>
              )}

              {/* RRHH section */}
              {selectedPapeleta.hr_approved_at && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Autorizado por RRHH: {selectedPapeleta.hr_approver_name || 'Recursos Humanos'}</span>
                  </div>
                  <div className="text-[11px] text-slate-300">Fecha: {selectedPapeleta.hr_approved_at}</div>
                  {selectedPapeleta.hr_comment && (
                    <div className="text-[11px] text-slate-400 italic">"{selectedPapeleta.hr_comment}"</div>
                  )}
                </div>
              )}

              {/* Rejection */}
              {selectedPapeleta.status === 'REJECTED' && selectedPapeleta.rejection_reason && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-1 text-rose-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Papeleta Rechazada</span>
                  </div>
                  <div className="text-[11px]">Motivo de no procedencia: {selectedPapeleta.rejection_reason}</div>
                </div>
              )}

              {/* Audit History */}
              {selectedPapeleta.audits && selectedPapeleta.audits.length > 0 && (
                <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Bitácora de Auditoría y Trazabilidad</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedPapeleta.audits.map((aud, i) => (
                      <div key={aud.id || i} className="text-[11px] text-slate-400 flex items-start justify-between border-b border-slate-800/60 pb-1">
                        <div>
                          <span className="text-white font-medium">{aud.action_by_user_name}</span> ({aud.action_by_role}): {aud.comment || aud.action_type}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">{aud.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#090A0D] border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPapeleta(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VIGILANCIA GARITA: REGISTRAR SALIDA / RETORNO MODAL
          ======================================================== */}
      {vigilanciaModal.isOpen && vigilanciaModal.papeleta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg border ${
                    vigilanciaModal.type === 'EXIT'
                      ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
                      : 'bg-purple-950/60 border-purple-500/30 text-purple-400'
                  }`}
                >
                  {vigilanciaModal.type === 'EXIT' ? (
                    <Shield className="w-5 h-5" />
                  ) : (
                    <RotateCcw className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {vigilanciaModal.type === 'EXIT'
                      ? 'Garita de Vigilancia: Registrar Salida Física'
                      : 'Garita de Vigilancia: Registrar Retorno Físico'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {vigilanciaModal.papeleta.code} — {vigilanciaModal.papeleta.employee_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setVigilanciaModal((prev) => ({
                    ...prev,
                    isOpen: false,
                    papeleta: null,
                    dniError: null,
                  }))
                }
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVigilanciaSubmit} className="space-y-3.5 text-xs">
              {/* Worker Verification Details Card */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Trabajador:</span>
                  <span className="text-white font-bold">{vigilanciaModal.papeleta.employee_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">DNI Registrado:</span>
                  <span className="text-indigo-400 font-mono font-bold">{vigilanciaModal.papeleta.employee_dni}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Destino Autorizado:</span>
                  <span className="text-slate-200 font-medium">{vigilanciaModal.papeleta.destino}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-1">
                  <span className="text-slate-400">Horario Autorizado:</span>
                  <span className="text-indigo-300 font-mono">
                    {vigilanciaModal.papeleta.hora_estimada_salida} ➔ {vigilanciaModal.papeleta.hora_estimada_retorno}
                  </span>
                </div>
                {vigilanciaModal.type === 'RETURN' && vigilanciaModal.papeleta.hora_real_salida && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>Salida Sellada:</span>
                    <span className="font-mono font-bold">{vigilanciaModal.papeleta.hora_real_salida}</span>
                  </div>
                )}
              </div>

              {/* Confirm DNI in Gate */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Verificación de DNI en Garita:
                </label>
                <input
                  type="text"
                  placeholder={`Ingrese o verifique ${vigilanciaModal.papeleta.employee_dni}`}
                  value={vigilanciaModal.dniConfirmInput}
                  onChange={(e) =>
                    setVigilanciaModal((prev) => ({
                      ...prev,
                      dniConfirmInput: e.target.value,
                      dniError: null,
                    }))
                  }
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                {vigilanciaModal.dniError && (
                  <p className="text-rose-400 text-[11px] mt-1 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {vigilanciaModal.dniError}
                  </p>
                )}
              </div>

              {/* Real Server Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hora Real de {vigilanciaModal.type === 'EXIT' ? 'Salida' : 'Retorno'} (HH:MM):
                </label>
                <input
                  type="time"
                  value={vigilanciaModal.hora}
                  onChange={(e) =>
                    setVigilanciaModal((prev) => ({ ...prev, hora: e.target.value }))
                  }
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Observation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observación de Garita (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Salida conforme en vehículo institucional / Vehículo particular"
                  value={vigilanciaModal.observacion}
                  onChange={(e) =>
                    setVigilanciaModal((prev) => ({ ...prev, observacion: e.target.value }))
                  }
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setVigilanciaModal((prev) => ({
                      ...prev,
                      isOpen: false,
                      papeleta: null,
                      dniError: null,
                    }))
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 font-bold text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm ${
                    vigilanciaModal.type === 'EXIT'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {vigilanciaModal.type === 'EXIT'
                      ? 'Confirmar Salida en Garita'
                      : 'Confirmar Retorno en Garita'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION / ACTION CONFIRMATION MODAL */}
      <DataPolicyConfirmModal config={confirmModalConfig} />
    </div>
  );
};
