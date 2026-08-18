import React, { useState, useRef, useMemo } from 'react';
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
  Search,
  Filter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';

interface PapeletasModuleProps {
  activeView?: string;
  papeletas: PapeletaSalida[];
  papeletaAudits: PapeletaAudit[];
  employees: Employee[];
  activeRole: RoleType;
  activeUserDni: string;
  onUpdatePapeletaStatus: (
    papeletaId: string,
    action: PapeletaStatus | 'APPROVE_BOSS' | 'APPROVE_HR' | 'REJECT' | 'MARK_OUTING_REAL' | 'MARK_COMPLETED_REAL',
    comment?: string,
    horaRealSalida?: string,
    horaRealRetorno?: string
  ) => void;
  onCreatePapeleta: (newPapeleta: Omit<PapeletaSalida, 'id' | 'code' | 'created_at' | 'updated_at'>) => void;
}

export const PapeletasModule: React.FC<PapeletasModuleProps> = ({
  activeView,
  papeletas,
  papeletaAudits,
  employees,
  activeRole,
  activeUserDni,
  onUpdatePapeletaStatus,
  onCreatePapeleta,
}) => {
  // Navigation & View Mode Detection
  const isSecurityView =
    activeView?.startsWith('security_') ||
    activeRole === 'VIGILANCIA' ||
    activeRole === 'SECURITY_GUARD';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPapeleta, setSelectedPapeleta] = useState<PapeletaSalida | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Tab filter (ALL, PENDING, APPROVED, IN_OUTING, COMPLETED, MY)
  const [statusTab, setStatusTab] = useState<string>(() => {
    if (activeView === 'security_exit') return 'APPROVED';
    if (activeView === 'security_return' || activeView === 'security_outside') return 'IN_OUTING';
    if (activeView === 'papeletas_pending') return 'PENDING';
    if (activeView === 'papeletas_approved') return 'APPROVED';
    if (activeView === 'papeletas_my') return 'MY';
    return 'ALL';
  });

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'papeletas_new') {
      setShowCreateModal(true);
      setStatusTab('ALL');
    } else if (activeView === 'papeletas_pending') {
      setShowCreateModal(false);
      setStatusTab('PENDING');
    } else if (activeView === 'papeletas_approved' || activeView === 'security_exit') {
      setShowCreateModal(false);
      setStatusTab('APPROVED');
    } else if (activeView === 'security_return' || activeView === 'security_outside') {
      setShowCreateModal(false);
      setStatusTab('IN_OUTING');
    } else if (activeView === 'papeletas_my') {
      setShowCreateModal(false);
      setStatusTab('MY');
    } else {
      setShowCreateModal(false);
    }
  }, [activeView]);

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
  const [filterSalidaRegistrada, setFilterSalidaRegistrada] = useState<string>('ALL'); // 'ALL' | 'YES' | 'NO'
  const [filterRetornoRegistrado, setFilterRetornoRegistrado] = useState<string>('ALL');

  // DATA POLICY CONFIRM MODAL
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

  // FORM STATE FOR NEW PAPELETA
  const [formEmployeeId, setFormEmployeeId] = useState(
    employees.find((e) => e.dni === activeUserDni)?.id || employees[0]?.id || ''
  );
  const [formMotivo, setFormMotivo] = useState<PapeletaMotivo>('COMISION_SERVICIOS');
  const [formDestino, setFormDestino] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formHoraSalida, setFormHoraSalida] = useState('10:00');
  const [formHoraRetorno, setFormHoraRetorno] = useState('12:30');
  const [formSinRetorno, setFormSinRetorno] = useState(false);

  // SIGNATURE CANVAS
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Active user employee object & Selected employee
  const currentEmployee = employees.find((e) => e.id === formEmployeeId) || employees[0];
  const activeUserEmployee = employees.find((e) => e.dni === activeUserDni) || employees[0];

  const autoSupervisorName = currentEmployee?.supervisor_name || 'Jefe / Director Inmediato';
  const autoSupervisorId = currentEmployee?.supervisor_id || 'boss-default';

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
      // 1. RBAC SCOPE
      if (activeRole === 'TRABAJADOR' || activeRole === 'EMPLOYEE') {
        if (p.employee_dni !== activeUserDni) return false;
      } else if (activeRole === 'JEFE' || activeRole === 'SUPERVISOR') {
        // Jefe inmediato: ve sus propias papeletas + las de su ámbito asignado
        if (p.employee_dni !== activeUserDni) {
          const req = employees.find((e) => e.dni === p.employee_dni);
          const isDirectSubordinate = req && req.supervisor_id === activeUserEmployee?.id;
          const sameDir = req && activeUserEmployee && req.direccion_organo_id && req.direccion_organo_id === activeUserEmployee.direccion_organo_id;
          const sameDep = req && activeUserEmployee && req.dependencia_id && req.dependencia_id === activeUserEmployee.dependencia_id;
          if (!isDirectSubordinate && !sameDir && !sameDep) {
            return false;
          }
        }
      }

      // 2. VIGILANCIA / GARITA SCOPE RULE (CRITICAL DRAC SPEC)
      // Toda papeleta con V°B° Jefe + Aprobación RRHH (status === 'APPROVED') y salida no registrada debe aparecer en Garita.
      if (isSecurityView) {
        if (statusTab === 'APPROVED' || activeView === 'security_exit') {
          // Pendientes de salida física
          if (p.status !== 'APPROVED' || Boolean(p.hora_real_salida)) return false;
        } else if (statusTab === 'IN_OUTING' || activeView === 'security_return' || activeView === 'security_outside') {
          // Personal actualmente fuera con salida sellada pero sin retorno
          if (p.status !== 'IN_OUTING') return false;
        } else if (statusTab === 'COMPLETED') {
          if (p.status !== 'COMPLETED') return false;
        } else if (statusTab === 'ALL') {
          // Todas las papeletas relevantes para garita (autorizadas, en curso o finalizadas)
          const isRelevantForGarita =
            p.status === 'APPROVED' || p.status === 'IN_OUTING' || p.status === 'COMPLETED';
          if (!isRelevantForGarita) return false;
        }
      } else {
        // NON-SECURITY TAB FILTERS
        if (statusTab === 'PENDING') {
          if (p.status !== 'PENDING_BOSS' && p.status !== 'PENDING_HR') return false;
        } else if (statusTab === 'APPROVED') {
          if (p.status !== 'APPROVED' && p.status !== 'IN_OUTING' && p.status !== 'COMPLETED') return false;
        } else if (statusTab === 'IN_OUTING') {
          if (p.status !== 'IN_OUTING') return false;
        } else if (statusTab === 'COMPLETED') {
          if (p.status !== 'COMPLETED') return false;
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
    activeRole,
    activeUserDni,
    activeUserEmployee,
    employees,
    isSecurityView,
    activeView,
    statusTab,
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
    ctx.lineWidth = 2;
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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescripcion || !formDestino) {
      alert('Error: Debe ingresar la descripción del motivo y el lugar de destino.');
      return;
    }

    if (!currentEmployee) {
      alert('Error: No se ha seleccionado un colaborador válido.');
      return;
    }

    onCreatePapeleta({
      employee_id: currentEmployee.id,
      employee_dni: currentEmployee.dni,
      employee_name: `${currentEmployee.first_name} ${currentEmployee.last_name}`,
      dependencia_name: currentEmployee.dependencia_name || 'Sede Central DRAC',
      direccion_organo_name: currentEmployee.direccion_organo_name,
      area_name: currentEmployee.area_name || 'Oficina DRAC',
      supervisor_id: autoSupervisorId,
      supervisor_name: autoSupervisorName,
      motivo: formMotivo,
      descripcion: formDescripcion,
      destino: formDestino,
      fecha: formFecha,
      hora_estimada_salida: formHoraSalida,
      hora_estimada_retorno: formSinRetorno ? 'Sin retorno' : formHoraRetorno,
      sin_retorno: formSinRetorno,
      status: 'PENDING_BOSS',
      digital_signature_data: signatureData || undefined,
      signed_at: new Date().toISOString(),
    });

    setShowCreateModal(false);
    setFormDescripcion('');
    setFormSinRetorno(false);
    setSignatureData(null);
  };

  // VIGILANCIA CONFIRMATION SUBMISSION
  const handleVigilanciaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vigilanciaModal.papeleta) return;

    // DNI confirmation check
    const enteredDni = vigilanciaModal.dniConfirmInput.trim();
    if (enteredDni && enteredDni !== vigilanciaModal.papeleta.employee_dni) {
      setVigilanciaModal((prev) => ({
        ...prev,
        dniError: `DNI no coincide con el titular (${vigilanciaModal.papeleta?.employee_dni}).`,
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
          ? 'Salida definitiva sin retorno registrada en Garita de Vigilancia'
          : 'Salida física registrada en Garita de Vigilancia');

      onUpdatePapeletaStatus(
        vigilanciaModal.papeleta.id,
        action,
        obs,
        currentServerTime
      );
    } else {
      const obs =
        vigilanciaModal.observacion || 'Retorno físico registrado conforme en Garita de Vigilancia';

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
                  : 'Flujo oficial: Solicitud + Firma Digital ➔ VoBo Jefe Inmediato ➔ Autorización RRHH ➔ Garita Vigilancia.'}
              </p>
            </div>
          </div>
        </div>

        {/* Create Papeleta Button */}
        {!isSecurityView && (
          <button
            type="button"
            onClick={() => {
              if (employees.length === 0) {
                alert('Error: No se puede solicitar papeletas sin personal registrado en el sistema.');
                return;
              }
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 self-start md:self-auto shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Solicitar Papeleta de Salida</span>
          </button>
        )}
      </div>

      {/* Quick Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
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
          {isSecurityView ? 'Todas en Garita' : 'Todas'} ({papeletas.length})
        </button>

        {isSecurityView ? (
          <>
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
          <>
            <button
              type="button"
              onClick={() => {
                setStatusTab('PENDING');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusTab === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Pendientes VoBo ({papeletas.filter((p) => p.status === 'PENDING_BOSS' || p.status === 'PENDING_HR').length})
              </span>
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
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Autorizadas Garita ({papeletas.filter((p) => p.status === 'APPROVED' || p.status === 'IN_OUTING' || p.status === 'COMPLETED').length})
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
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Mis Solicitudes ({papeletas.filter((p) => p.employee_dni === activeUserDni).length})</span>
            </button>
          </>
        )}
      </div>

      {/* Advanced Search & Multi-filter */}
      <AdvancedSearchFilter
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="🔍 Buscar por DNI, N.º papeleta, trabajador, área, destino..."
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
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los motivos</option>
            <option value="COMISION_SERVICIOS">Comisión de Servicios</option>
            <option value="SALUD_MEDICA">Salud / Atención Médica</option>
            <option value="DILIGENCIA_OFICIAL">Diligencia Oficial</option>
            <option value="PERSONAL">Asuntos Personales</option>
            <option value="OTRO">Otros</option>
          </select>
        </div>

        {/* Filter by Dependencia */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Dependencia</label>
          <select
            value={filterDependencia}
            onChange={(e) => {
              setFilterDependencia(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas las dependencias</option>
            {uniqueDependencias.map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Área */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Área / Oficina</label>
          <select
            value={filterArea}
            onChange={(e) => {
              setFilterArea(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas las áreas</option>
            {uniqueAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

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
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
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
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
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
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Cualquiera</option>
            <option value="YES">Con Salida Registrada</option>
            <option value="NO">Sin Salida Registrada</option>
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
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Cualquiera</option>
            <option value="YES">Con Retorno Registrado</option>
            <option value="NO">Sin Retorno Registrado</option>
          </select>
        </div>
      </AdvancedSearchFilter>

      {/* Main Responsive Table Container */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="w-full">
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
                  label="Motivo & Destino"
                  field="motivo"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
                <SortableHeader
                  label="Fecha & Horas"
                  field="fecha"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="w-32"
                />
                <th className="px-3 py-3 w-28 text-center">Salida / Retorno</th>
                <SortableHeader
                  label="Estado"
                  field="status"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="w-28 text-center"
                  align="center"
                />
                <th className="px-3 py-3 text-right w-36">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {paginatedPapeletas.map((p, idx) => {
                const badge = statusBadge[p.status] || statusBadge.DRAFT;
                const isExpanded = expandedRowId === p.id;
                const rowNum = (currentPage - 1) * pageSize + idx + 1;

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

                      {/* Code */}
                      <td className="px-3 py-3">
                        <div className="font-mono text-indigo-400 font-bold">{p.code}</div>
                        <button
                          type="button"
                          onClick={() => setExpandedRowId(isExpanded ? null : p.id)}
                          className="text-[10px] text-slate-400 hover:text-indigo-300 flex items-center gap-0.5 mt-0.5"
                        >
                          <span>{isExpanded ? 'Ocultar' : 'Detalle'}</span>
                          {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        </button>
                      </td>

                      {/* Worker & DNI */}
                      <td className="px-3 py-3">
                        <div className="font-bold text-white text-xs">{p.employee_name}</div>
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
                          {p.motivo.replace('_', ' ')}
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
                            title="Ver Ficha Completa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* 1º VoBo Jefe Inmediato */}
                          {p.status === 'PENDING_BOSS' &&
                            (activeRole === 'JEFE' ||
                              activeRole === 'SUPERVISOR' ||
                              activeRole === 'DIRECTOR_GENERAL' ||
                              activeRole === 'ADMIN_GENERAL' ||
                              activeRole === 'HR_ADMIN' ||
                              activeRole === 'JEFE_RRHH') && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePapeletaStatus(
                                    p.id,
                                    'APPROVE_BOSS',
                                    'VoBo Aprobado por Jefe Inmediato / Director Responsable'
                                  )
                                }
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
                              >
                                <Check className="w-3 h-3" />
                                <span>VoBo Jefe</span>
                              </button>
                            )}

                          {/* 2º Aprobación RRHH / Jefe de Personal */}
                          {p.status === 'PENDING_HR' &&
                            (activeRole === 'JEFE_RRHH' ||
                              activeRole === 'ADMIN_GENERAL' ||
                              activeRole === 'HR_ADMIN' ||
                              activeRole === 'CONTROL_ASISTENCIA') && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePapeletaStatus(
                                    p.id,
                                    'APPROVE_HR',
                                    'Papeleta Autorizada Institucionalmente por RRHH / Jefe de Personal'
                                  )
                                }
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Aprobar RRHH</span>
                              </button>
                            )}

                          {/* Reject Option */}
                          {(p.status === 'PENDING_BOSS' || p.status === 'PENDING_HR') &&
                            (activeRole === 'JEFE' ||
                              activeRole === 'SUPERVISOR' ||
                              activeRole === 'DIRECTOR_GENERAL' ||
                              activeRole === 'JEFE_RRHH' ||
                              activeRole === 'ADMIN_GENERAL' ||
                              activeRole === 'HR_ADMIN') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModalConfig({
                                    isOpen: true,
                                    title: 'Rechazar Solicitud de Papeleta',
                                    message: `¿Desea rechazar la papeleta ${p.code} de ${p.employee_name}? Ingrese el motivo institucional en la bitácora.`,
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
                            (isSecurityView ||
                              activeRole === 'ADMIN_GENERAL' ||
                              activeRole === 'HR_ADMIN' ||
                              activeRole === 'JEFE_RRHH') && (
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
                                      : 'Salida autorizada registrada en Garita',
                                    dniError: null,
                                  });
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-sm whitespace-nowrap transition-colors"
                              >
                                <Shield className="w-3 h-3" />
                                <span>REGISTRAR SALIDA</span>
                              </button>
                            )}

                          {/* VIGILANCIA / GARITA: REGISTRAR RETORNO */}
                          {p.status === 'IN_OUTING' &&
                            (isSecurityView ||
                              activeRole === 'ADMIN_GENERAL' ||
                              activeRole === 'HR_ADMIN' ||
                              activeRole === 'JEFE_RRHH') && (
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
                                    observacion: 'Retorno registrado conforme en Garita de Vigilancia',
                                    dniError: null,
                                  });
                                }}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-sm whitespace-nowrap transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>REGISTRAR RETORNO</span>
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Row Details (For Complete Data Without Horizontal Scroll) */}
                    {isExpanded && (
                      <tr className="bg-[#090A0D]/90 border-b border-slate-800">
                        <td colSpan={9} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                              <span className="text-slate-400 block font-semibold text-[10px] uppercase">
                                Dependencia & Área
                              </span>
                              <div className="text-white font-medium mt-0.5">{p.dependencia_name}</div>
                              <div className="text-slate-300 text-[11px]">{p.area_name}</div>
                            </div>

                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                              <span className="text-slate-400 block font-semibold text-[10px] uppercase">
                                Destino & Justificación
                              </span>
                              <div className="text-indigo-300 font-medium mt-0.5">{p.destino}</div>
                              <div className="text-slate-300 text-[11px] line-clamp-2">{p.descripcion}</div>
                            </div>

                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                              <span className="text-slate-400 block font-semibold text-[10px] uppercase">
                                Horario Solicitado
                              </span>
                              <div className="text-white font-mono font-bold mt-0.5">{p.fecha}</div>
                              <div className="text-slate-300 font-mono text-[11px]">
                                {p.hora_estimada_salida} ➔ {p.hora_estimada_retorno}
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                              <span className="text-slate-400 block font-semibold text-[10px] uppercase">
                                Trazabilidad Garita
                              </span>
                              <div className="text-emerald-400 font-mono text-[11px]">
                                Salida Real: {p.hora_real_salida || 'Pendiente...'}
                              </div>
                              <div className="text-purple-400 font-mono text-[11px]">
                                Retorno Real: {p.hora_real_retorno || (p.sin_retorno ? 'Sin retorno' : 'Pendiente...')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <div>
                              Aprobador Asignado:{' '}
                              <strong className="text-amber-400">{p.supervisor_name}</strong>
                            </div>
                            {p.signed_at && (
                              <div>
                                Firmado digitalmente:{' '}
                                <span className="text-slate-300">{new Date(p.signed_at).toLocaleString('es-PE')}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Empty State */}
          {filteredPapeletas.length === 0 && (
            <EmptyState
              icon={FileText}
              title={
                isSecurityView
                  ? 'No hay papeletas en esta cola de Garita'
                  : 'No se encontraron papeletas de salida'
              }
              description={
                isSecurityView
                  ? 'Las papeletas aprobadas por el Jefe Inmediato y autorizadas por Recursos Humanos aparecerán automáticamente aquí para el registro de salida física.'
                  : 'No hay registros que coincidan con los filtros y criterios de búsqueda actuales.'
              }
              isFiltered={activeFilterCount > 0 || Boolean(searchTerm)}
              onAction={handleResetFilters}
            />
          )}
        </div>

        {/* Reusable Pagination */}
        <DataTablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredPapeletas.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* CREATE PAPELETA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Solicitud de Papeleta de Salida DRAC</h3>
                <p className="text-xs text-slate-400">Permiso oficial durante la jornada laboral</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Trabajador Solicitante</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} (DNI: {e.dni} — {e.dependencia_name} - {e.area_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Automatic Approver Display */}
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs">
                <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-amber-300">Aprobador Asignado Automáticamente por la DRAC:</div>
                  <div className="text-white font-semibold mt-0.5">{autoSupervisorName}</div>
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    * La papeleta se enviará directamente a la bandeja de visto bueno de esta jefatura asignada.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Motivo de Salida</label>
                  <select
                    value={formMotivo}
                    onChange={(e) => setFormMotivo(e.target.value as PapeletaMotivo)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="COMISION_SERVICIOS">Comisión de Servicios Oficial</option>
                    <option value="SALUD_MEDICA">Atención Médica / Cita Essalud</option>
                    <option value="DILIGENCIA_OFICIAL">Diligencia Institucional</option>
                    <option value="PERSONAL">Asunto Personal Justificado</option>
                    <option value="OTRO">Otro Motivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Destino / Lugar</label>
                  <input
                    type="text"
                    placeholder="Ej: Agencia Agraria Jaén / Terreno de Cultivo"
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Descripción / Fundamentación</label>
                <textarea
                  rows={2}
                  placeholder="Detalle el motivo institucional o personal de la salida..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Hora Estimada Salida</label>
                  <input
                    type="time"
                    value={formHoraSalida}
                    onChange={(e) => setFormHoraSalida(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Hora Estimada Retorno</label>
                  <input
                    type="time"
                    disabled={formSinRetorno}
                    value={formSinRetorno ? '' : formHoraRetorno}
                    onChange={(e) => setFormHoraRetorno(e.target.value)}
                    className={`w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono ${
                      formSinRetorno ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    required={!formSinRetorno}
                  />
                </div>
              </div>

              {/* Salida Sin Retorno */}
              <label className="flex items-start gap-2.5 p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formSinRetorno}
                  onChange={(e) => setFormSinRetorno(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 shrink-0"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Salida sin retorno (Comisión final de jornada / No regresa a la entidad hoy)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Garita de Vigilancia registrará la salida física y finalizará la papeleta sin exigir retorno.
                  </p>
                </div>
              </label>

              {/* Digital Signature Canvas */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Firma Digital del Solicitante</span>
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
                    width={380}
                    height={90}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair touch-none bg-[#090A0D] rounded border border-slate-800/80"
                  />
                </div>
                <p className="text-[10px] text-slate-500 italic text-center">
                  Firme en el recuadro superior usando el mouse o pantalla táctil.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Papeleta a Visto Bueno</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedPapeleta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-mono text-indigo-400 font-bold text-sm">{selectedPapeleta.code}</div>
                <h3 className="font-bold text-base text-white">Ficha de Papeleta de Salida DRAC</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPapeleta(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-1">
                <div>
                  Colaborador: <span className="font-bold text-white">{selectedPapeleta.employee_name}</span> (DNI:{' '}
                  {selectedPapeleta.employee_dni})
                </div>
                <div>
                  Dependencia: <span className="text-indigo-300 font-medium">{selectedPapeleta.dependencia_name}</span>
                </div>
                <div>
                  Área: <span className="text-slate-300">{selectedPapeleta.area_name}</span>
                </div>
                <div>
                  Aprobador Asignado:{' '}
                  <span className="text-amber-400 font-semibold">{selectedPapeleta.supervisor_name}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-1">
                <div>
                  Motivo: <span className="font-bold text-slate-200">{selectedPapeleta.motivo}</span>
                </div>
                <div>
                  Destino: <span className="text-indigo-300 font-medium">{selectedPapeleta.destino}</span>
                </div>
                <div>
                  Descripción: <span className="text-slate-300">{selectedPapeleta.descripcion}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800">
                  <div className="font-bold text-slate-400 text-[10px]">PROGRAMADO</div>
                  <div className="text-white font-mono mt-1">{selectedPapeleta.fecha}</div>
                  <div className="text-slate-300 font-mono">
                    {selectedPapeleta.hora_estimada_salida} ➔ {selectedPapeleta.hora_estimada_retorno}
                  </div>
                </div>

                <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800">
                  <div className="font-bold text-slate-400 text-[10px]">REAL GARITA</div>
                  <div className="text-emerald-400 font-mono mt-1">
                    Salida: {selectedPapeleta.hora_real_salida || 'Sin registrar'}
                  </div>
                  <div className="text-purple-400 font-mono">
                    Retorno: {selectedPapeleta.hora_real_retorno || 'Sin registrar'}
                  </div>
                </div>
              </div>

              {selectedPapeleta.digital_signature_data && (
                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Firma Digital del Solicitante:</span>
                  <img
                    src={selectedPapeleta.digital_signature_data}
                    alt="Firma Digital"
                    className="h-10 bg-[#090A0D] rounded p-1 border border-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPapeleta(null)}
                className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIGILANCIA GARITA: REGISTRAR SALIDA / RETORNO MODAL (WITH DNI VERIFICATION) */}
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
                      ? 'Vigilancia / Garita: Registrar Salida Física'
                      : 'Vigilancia / Garita: Registrar Retorno Físico'}
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
                  <span className="text-slate-400">Dependencia / Área:</span>
                  <span className="text-slate-300">
                    {vigilanciaModal.papeleta.dependencia_name} — {vigilanciaModal.papeleta.area_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Destino Autorizado:</span>
                  <span className="text-slate-200 font-medium">{vigilanciaModal.papeleta.destino}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-1">
                  <span className="text-slate-400">Horario Solicitado:</span>
                  <span className="text-indigo-300 font-mono">
                    {vigilanciaModal.papeleta.hora_estimada_salida} ➔ {vigilanciaModal.papeleta.hora_estimada_retorno}
                  </span>
                </div>
                {vigilanciaModal.type === 'RETURN' && vigilanciaModal.papeleta.hora_real_salida && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>Salida Real Sellada:</span>
                    <span className="font-mono font-bold">{vigilanciaModal.papeleta.hora_real_salida}</span>
                  </div>
                )}
              </div>

              {/* Step: Confirm DNI in Gate */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirmación de Identidad en Garita (DNI del Trabajador):
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
                {vigilanciaModal.dniError ? (
                  <p className="text-rose-400 text-[11px] mt-1 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {vigilanciaModal.dniError}
                  </p>
                ) : (
                  <p className="text-slate-400 text-[10px] mt-1">
                    * Opcional si ya verificó visualmente el fotocheck institucional.
                  </p>
                )}
              </div>

              {/* Step: Real Server Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hora Real de {vigilanciaModal.type === 'EXIT' ? 'Salida' : 'Retorno'} (HH:MM):
                </label>
                <input
                  type="time"
                  value={vigilanciaModal.hora}
                  onChange={(e) => setVigilanciaModal((prev) => ({ ...prev, hora: e.target.value }))}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 font-bold"
                  required
                />
              </div>

              {/* Step: Security Observation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observación de Garita (Opcional):
                </label>
                <input
                  type="text"
                  value={vigilanciaModal.observacion}
                  onChange={(e) => setVigilanciaModal((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Ej: Salida conforme en vehículo institucional..."
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
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
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm ${
                    vigilanciaModal.type === 'EXIT'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                >
                  {vigilanciaModal.type === 'EXIT' ? (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      <span>Confirmar y Registrar Salida</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirmar y Registrar Retorno</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <DataPolicyConfirmModal config={confirmModalConfig} />
    </div>
  );
};
