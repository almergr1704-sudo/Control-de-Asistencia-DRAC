import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Calendar,
  FileText,
  UserCheck,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  ArrowRight,
  Shield,
  FileCheck,
  ShieldCheck,
  Download,
  Info,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  Employee,
  Encargatura,
  Dependencia,
  DireccionOrgano,
  Area,
  RoleType,
  EncargaturaMotivo,
  EncargaturaDocumentType,
  PapeletaSalida,
} from '../../types';
import { computeEncargaturaStatus, VALID_JEFE_ORGANO_TYPES } from '../../utils/encargaturaUtils';
import { BulkUploadModal } from './BulkUploadModal';
import { generateTemplateEncargaturas } from '../../utils/bulkUploadUtils';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter, FilterField, FilterSelect, FilterDateRange } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';

interface EncargaturasModuleProps {
  encargaturas: Encargatura[];
  onAddEncargatura: (enc: Omit<Encargatura, 'id' | 'created_at'>) => void;
  onEditEncargatura: (enc: Encargatura) => void;
  onDeleteEncargatura: (encId: string) => void;
  onAnularEncargatura: (encId: string, motivo: string) => void;
  onBulkImportEncargaturas?: (validEncs: Encargatura[]) => void;
  employees: Employee[];
  dependencias: Dependencia[];
  direccionesOrganos: DireccionOrgano[];
  areas: Area[];
  papeletas: PapeletaSalida[];
  activeRole: RoleType;
  activeUserDni: string;
}

export const EncargaturasModule: React.FC<EncargaturasModuleProps> = ({
  encargaturas,
  onAddEncargatura,
  onEditEncargatura,
  onDeleteEncargatura,
  onAnularEncargatura,
  onBulkImportEncargaturas,
  employees,
  dependencias,
  direccionesOrganos,
  areas,
  papeletas,
  activeRole,
  activeUserDni,
}) => {
  const todayStr = new Date().toISOString().substring(0, 10);

  // Search, Filter, Sort & Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dirFilter, setDirFilter] = useState<string>('ALL');
  const [depFilter, setDepFilter] = useState<string>('ALL');
  const [motivoFilter, setMotivoFilter] = useState<string>('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // SORTING STATE
  const [sortField, setSortField] = useState<string | null>('start_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingEnc, setEditingEnc] = useState<Encargatura | null>(null);
  const [selectedEncForView, setSelectedEncForView] = useState<Encargatura | null>(null);
  const [anularModalEnc, setAnularModalEnc] = useState<Encargatura | null>(null);
  const [anularReason, setAnularReason] = useState('');

  // Form Fields
  const [formTitularId, setFormTitularId] = useState('');
  const [formEncargadoId, setFormEncargadoId] = useState('');
  const [formDepId, setFormDepId] = useState('');
  const [formDirId, setFormDirId] = useState('');
  const [formAreaId, setFormAreaId] = useState('');
  const [formCargoEncargado, setFormCargoEncargado] = useState('');
  const [formMotivo, setFormMotivo] = useState<EncargaturaMotivo>('VACACIONES');
  const [formMotivoDetalle, setFormMotivoDetalle] = useState('');
  const [formStartDate, setFormStartDate] = useState(todayStr);
  const [formEndDate, setFormEndDate] = useState(todayStr);
  const [formDocType, setFormDocType] = useState<EncargaturaDocumentType>('MEMORANDO');
  const [formDocNumber, setFormDocNumber] = useState('');
  const [formDocDate, setFormDocDate] = useState(todayStr);
  const [formDocFileName, setFormDocFileName] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Active user / permissions
  const canManage = activeRole === 'ADMIN_GENERAL' || activeRole === 'HR_ADMIN' || activeRole === 'JEFE_RRHH';

  // Compute live status for list
  const processedEncargaturas = useMemo(() => {
    return encargaturas.map((enc) => ({
      ...enc,
      computed_status: computeEncargaturaStatus(enc, todayStr),
    }));
  }, [encargaturas, todayStr]);

  // Summary Metrics
  const totalCount = processedEncargaturas.length;
  const vigentesCount = processedEncargaturas.filter((e) => e.computed_status === 'VIGENTE').length;
  const pendientesCount = processedEncargaturas.filter((e) => e.computed_status === 'PENDIENTE').length;
  const finalizadasCount = processedEncargaturas.filter((e) => e.computed_status === 'FINALIZADA').length;

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (dirFilter !== 'ALL') count++;
    if (depFilter !== 'ALL') count++;
    if (motivoFilter !== 'ALL') count++;
    if (docTypeFilter !== 'ALL') count++;
    if (filterFechaDesde) count++;
    if (filterFechaHasta) count++;
    return count;
  }, [statusFilter, dirFilter, depFilter, motivoFilter, docTypeFilter, filterFechaDesde, filterFechaHasta]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDirFilter('ALL');
    setDepFilter('ALL');
    setMotivoFilter('ALL');
    setDocTypeFilter('ALL');
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

  // Filtered List
  const filteredList = useMemo(() => {
    return processedEncargaturas.filter((enc) => {
      // Search
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        const matchesSearch =
          enc.titular_name.toLowerCase().includes(searchLower) ||
          enc.encargado_name.toLowerCase().includes(searchLower) ||
          enc.titular_dni?.includes(searchLower) ||
          enc.encargado_dni?.includes(searchLower) ||
          enc.cargo_encargado.toLowerCase().includes(searchLower) ||
          enc.document_number.toLowerCase().includes(searchLower) ||
          (enc.direccion_organo_name && enc.direccion_organo_name.toLowerCase().includes(searchLower)) ||
          (enc.area_name && enc.area_name.toLowerCase().includes(searchLower)) ||
          (enc.dependencia_name && enc.dependencia_name.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && enc.computed_status !== statusFilter) {
        return false;
      }

      // Direction
      if (dirFilter !== 'ALL' && enc.direccion_organo_id !== dirFilter) {
        return false;
      }

      // Dependencia
      if (depFilter !== 'ALL' && enc.dependencia_id !== depFilter) {
        return false;
      }

      // Motivo
      if (motivoFilter !== 'ALL' && enc.motivo !== motivoFilter) {
        return false;
      }

      // Doc Type
      if (docTypeFilter !== 'ALL' && enc.document_type !== docTypeFilter) {
        return false;
      }

      // Dates
      if (filterFechaDesde && enc.end_date < filterFechaDesde) {
        return false;
      }
      if (filterFechaHasta && enc.start_date > filterFechaHasta) {
        return false;
      }

      return true;
    });
  }, [
    processedEncargaturas,
    searchTerm,
    statusFilter,
    dirFilter,
    depFilter,
    motivoFilter,
    docTypeFilter,
    filterFechaDesde,
    filterFechaHasta,
  ]);

  // Sorted List
  const sortedList = useMemo(() => {
    if (!sortField || !sortOrder) return filteredList;
    return [...filteredList].sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredList, sortField, sortOrder]);

  // Paginated slice
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [sortedList, currentPage, pageSize]);

  // Open Modal for New Encargatura
  const handleOpenNewModal = () => {
    setEditingEnc(null);
    setFormError(null);
    const firstTitular = employees.find((e) => e.is_jefe_director) || employees[0];
    const firstEncargado = employees.find((e) => e.id !== firstTitular?.id) || employees[0];

    if (firstTitular) {
      setFormTitularId(firstTitular.id);
      setFormDepId(firstTitular.dependencia_id || dependencias[0]?.id || '');
      setFormDirId(firstTitular.direccion_organo_id || '');
      setFormAreaId(firstTitular.area_id || '');
      setFormCargoEncargado(firstTitular.position ? `${firstTitular.position} (e)` : 'Jefe Encargado (e)');
    } else {
      setFormTitularId('');
      setFormDepId(dependencias[0]?.id || '');
      setFormDirId('');
      setFormAreaId('');
      setFormCargoEncargado('Director / Jefe Encargado (e)');
    }

    setFormEncargadoId(firstEncargado?.id || '');
    setFormMotivo('VACACIONES');
    setFormMotivoDetalle('');
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);
    setFormDocType('MEMORANDO');
    setFormDocNumber(`MEMORANDO N.º 0${encargaturas.length + 1}-2026-GR.CAJ/DRA`);
    setFormDocDate(todayStr);
    setFormDocFileName('');
    setFormObservaciones('');
    setShowModal(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (enc: Encargatura) => {
    // Check if it already has approved papeletas
    const approvedCount = (enc.papeletas_approved_count || 0) +
      papeletas.filter((p) => p.boss_delegation_info?.encargatura_id === enc.id).length;

    if (approvedCount > 0) {
      setFormError('Esta encargatura ya cuenta con papeletas aprobadas en su historial. Por trazabilidad legal, solo se permiten ajustes administrativos menores.');
    } else {
      setFormError(null);
    }

    setEditingEnc(enc);
    setFormTitularId(enc.titular_employee_id);
    setFormEncargadoId(enc.encargado_employee_id);
    setFormDepId(enc.dependencia_id);
    setFormDirId(enc.direccion_organo_id || '');
    setFormAreaId(enc.area_id || '');
    setFormCargoEncargado(enc.cargo_encargado);
    setFormMotivo(enc.motivo);
    setFormMotivoDetalle(enc.motivo_detalle || '');
    setFormStartDate(enc.start_date);
    setFormEndDate(enc.end_date);
    setFormDocType(enc.document_type);
    setFormDocNumber(enc.document_number);
    setFormDocDate(enc.document_date);
    setFormDocFileName(enc.document_file_name || '');
    setFormObservaciones(enc.observaciones || '');
    setShowModal(true);
  };

  // When titular changes, auto-fill unit & suggested cargo
  const handleTitularChange = (empId: string) => {
    setFormTitularId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setFormDepId(emp.dependencia_id || '');
      setFormDirId(emp.direccion_organo_id || '');
      setFormAreaId(emp.area_id || '');
      setFormCargoEncargado(emp.position ? `${emp.position} (e)` : 'Jefe Encargado (e)');
    }
  };

  // Save Encargatura
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation 1: Supporting Document
    if (!formDocNumber.trim()) {
      setFormError('El número de documento de sustento oficial es obligatorio (ej. Memorando N.º 025-2026-DRAC).');
      return;
    }

    // Validation 2: Dates
    if (!formStartDate || !formEndDate) {
      setFormError('Debe especificar la fecha de inicio y la fecha de término.');
      return;
    }
    if (formStartDate > formEndDate) {
      setFormError('La fecha de inicio no puede ser posterior a la fecha de término.');
      return;
    }

    // Validation 3: Titular & Encargado
    if (!formTitularId || !formEncargadoId) {
      setFormError('Debe seleccionar tanto al trabajador titular como al trabajador encargado.');
      return;
    }
    if (formTitularId === formEncargadoId) {
      setFormError('El trabajador encargado no puede ser la misma persona que el titular ausente.');
      return;
    }

    const titular = employees.find((e) => e.id === formTitularId);
    const encargado = employees.find((e) => e.id === formEncargadoId);

    if (!titular || !encargado) {
      setFormError('Trabajador titular o encargado inválido.');
      return;
    }

    // Validation 4: Inactive Encargado
    if (!encargado.active) {
      setFormError('No se puede encargar una función a un trabajador inactivo en el sistema.');
      return;
    }

    // Validation 5: Check overlapping encargaturas for the same unit & dates
    const overlapping = encargaturas.find((other) => {
      if (editingEnc && other.id === editingEnc.id) return false;
      if (other.status === 'ANULADA') return false;
      
      const sameUnit =
        (formDirId && other.direccion_organo_id === formDirId) ||
        (formAreaId && other.area_id === formAreaId) ||
        (!formDirId && !formAreaId && other.dependencia_id === formDepId);

      if (!sameUnit) return false;

      // Overlap condition
      const datesOverlap = formStartDate <= other.end_date && formEndDate >= other.start_date;
      return datesOverlap;
    });

    if (overlapping) {
      setFormError(
        `Ya existe una encargatura activa/programada para esta misma unidad en el período indicado (${overlapping.cargo_encargado} asignado a ${overlapping.encargado_name}).`
      );
      return;
    }

    const depObj = dependencias.find((d) => d.id === formDepId);
    const dirObj = direccionesOrganos.find((d) => d.id === formDirId);
    const areaObj = areas.find((a) => a.id === formAreaId);

    const fullTitularName = `${titular.first_name} ${titular.last_name}`.trim();
    const fullEncargadoName = `${encargado.first_name} ${encargado.last_name}`.trim();

    if (editingEnc) {
      onEditEncargatura({
        ...editingEnc,
        titular_employee_id: titular.id,
        titular_dni: titular.dni,
        titular_name: fullTitularName,
        titular_cargo: titular.position,
        titular_area_name: titular.area_name,
        titular_direccion_organo_name: titular.direccion_organo_name,
        encargado_employee_id: encargado.id,
        encargado_dni: encargado.dni,
        encargado_name: fullEncargadoName,
        encargado_cargo: encargado.position,
        encargado_area_procedencia_id: encargado.area_id,
        encargado_area_procedencia_name: encargado.area_name,
        encargado_dependencia_procedencia_name: encargado.dependencia_name,
        dependencia_id: depObj?.id || formDepId,
        dependencia_name: depObj?.name || 'Sede Central DRAC',
        direccion_organo_id: dirObj?.id || undefined,
        direccion_organo_name: dirObj?.name,
        direccion_organo_type: dirObj?.type,
        area_id: areaObj?.id || undefined,
        area_name: areaObj?.name,
        cargo_encargado: formCargoEncargado.trim() || `${titular.position} (e)`,
        motivo: formMotivo,
        motivo_detalle: formMotivoDetalle.trim(),
        start_date: formStartDate,
        end_date: formEndDate,
        document_type: formDocType,
        document_number: formDocNumber.trim(),
        document_date: formDocDate,
        document_file_name: formDocFileName.trim(),
        observaciones: formObservaciones.trim(),
      });
    } else {
      onAddEncargatura({
        titular_employee_id: titular.id,
        titular_dni: titular.dni,
        titular_name: fullTitularName,
        titular_cargo: titular.position,
        titular_area_name: titular.area_name,
        titular_direccion_organo_name: titular.direccion_organo_name,
        encargado_employee_id: encargado.id,
        encargado_dni: encargado.dni,
        encargado_name: fullEncargadoName,
        encargado_cargo: encargado.position,
        encargado_area_procedencia_id: encargado.area_id,
        encargado_area_procedencia_name: encargado.area_name,
        encargado_dependencia_procedencia_name: encargado.dependencia_name,
        dependencia_id: depObj?.id || formDepId,
        dependencia_name: depObj?.name || 'Sede Central DRAC',
        direccion_organo_id: dirObj?.id || undefined,
        direccion_organo_name: dirObj?.name,
        direccion_organo_type: dirObj?.type,
        area_id: areaObj?.id || undefined,
        area_name: areaObj?.name,
        cargo_encargado: formCargoEncargado.trim() || `${titular.position} (e)`,
        motivo: formMotivo,
        motivo_detalle: formMotivoDetalle.trim(),
        start_date: formStartDate,
        end_date: formEndDate,
        document_type: formDocType,
        document_number: formDocNumber.trim(),
        document_date: formDocDate,
        document_file_name: formDocFileName.trim(),
        status: 'PENDIENTE',
        papeletas_approved_count: 0,
        observaciones: formObservaciones.trim(),
        created_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General DRAC',
      });
    }

    setShowModal(false);
  };

  const handleConfirmAnulacion = () => {
    if (!anularModalEnc) return;
    onAnularEncargatura(anularModalEnc.id, anularReason.trim() || 'Anulación de encargatura por disposición de RRHH');
    setAnularModalEnc(null);
    setAnularReason('');
  };

  const getMotivoLabel = (m: EncargaturaMotivo) => {
    switch (m) {
      case 'VACACIONES':
        return 'Descanso Vacacional';
      case 'PERMISO':
        return 'Permiso Justificado';
      case 'COMISION_SERVICIOS':
        return 'Comisión de Servicios';
      case 'LICENCIA':
        return 'Licencia con/sin Goce';
      case 'TRABAJO_FUERA_SEDE':
        return 'Trabajo Fuera de Sede';
      case 'OTRO':
        return 'Otra Ausencia Autorizada';
    }
  };

  const getStatusBadge = (status: 'PENDIENTE' | 'VIGENTE' | 'FINALIZADA' | 'ANULADA') => {
    switch (status) {
      case 'VIGENTE':
        return {
          label: 'VIGENTE',
          color: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'PENDIENTE':
        return {
          label: 'PROGRAMADA',
          color: 'bg-amber-950/40 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
        };
      case 'FINALIZADA':
        return {
          label: 'FINALIZADA',
          color: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
        };
      case 'ANULADA':
        return {
          label: 'ANULADA',
          color: 'bg-rose-950/40 text-rose-400 border-rose-500/40',
          dot: 'bg-rose-500',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Módulo de Encargaturas Temporales de Jefatura
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Designación y trazabilidad de jefaturas encargadas para Directores de Direcciones, Jefes de Órganos de Apoyo, Jefes de Agencia y Jefes de Oficina Agraria. Las facultades de Visto Bueno se activan y retiran automáticamente según la vigencia del documento administrativo, preservando permanentemente el área de origen del personal.
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => generateTemplateEncargaturas(employees, direccionesOrganos, areas)}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Descargar Plantilla Oficial Excel para Encargaturas"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Plantilla Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="px-3.5 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span>Carga Masiva</span>
              </button>

              <button
                onClick={handleOpenNewModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Encargatura Temporal</span>
              </button>
            </div>
          )}
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#090A0D] border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Encargaturas Vigentes
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{vigentesCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Ejerciendo funciones hoy</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#090A0D] border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Programadas / Pendientes
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{pendientesCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vigencia futura programada</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Finalizadas / Históricas
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{finalizadasCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Facultades revocadas</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#090A0D] border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                Total Registradas
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{totalCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Actos administrativos DRAC</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Search & Filter Bar */}
      <AdvancedSearchFilter
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="🔍 Buscar por titular, encargado, DNI, cargo, documento o unidad..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      >
        <FilterField label="Estado de la Encargatura">
          <FilterSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            placeholder="Todos los Estados"
            options={[
              { value: 'VIGENTE', label: '🟢 Vigentes (Activas con VoBo)' },
              { value: 'PENDIENTE', label: '🟡 Programadas / Pendientes' },
              { value: 'FINALIZADA', label: '⚪ Finalizadas' },
              { value: 'ANULADA', label: '🔴 Anuladas' },
            ]}
          />
        </FilterField>

        <FilterField label="Dependencia DRAC">
          <FilterSelect
            value={depFilter}
            onChange={(val) => {
              setDepFilter(val);
              setCurrentPage(1);
            }}
            placeholder="Todas las Dependencias"
            options={dependencias.map((d) => ({ value: d.id, label: d.name }))}
          />
        </FilterField>

        <FilterField label="Dirección / Órgano">
          <FilterSelect
            value={dirFilter}
            onChange={(val) => {
              setDirFilter(val);
              setCurrentPage(1);
            }}
            placeholder="Todas las Direcciones"
            options={direccionesOrganos.map((d) => ({ value: d.id, label: d.name }))}
          />
        </FilterField>

        <FilterField label="Motivo de Ausencia del Titular">
          <FilterSelect
            value={motivoFilter}
            onChange={(val) => {
              setMotivoFilter(val);
              setCurrentPage(1);
            }}
            placeholder="Todos los Motivos"
            options={[
              { value: 'VACACIONES', label: 'Vacaciones de Ley' },
              { value: 'COMISION_SERVICIO', label: 'Comisión de Servicio' },
              { value: 'LICENCIA_MEDICA', label: 'Licencia Médica' },
              { value: 'LICENCIA_CAPACITACION', label: 'Licencia por Capacitación' },
              { value: 'DESCANSO_MEDICO', label: 'Descanso Médico' },
              { value: 'VACANCIA_TEMPORAL', label: 'Vacancia Temporal' },
              { value: 'OTRO', label: 'Otro Motivo Administrativo' },
            ]}
          />
        </FilterField>

        <FilterField label="Tipo de Documento Resolutivo">
          <FilterSelect
            value={docTypeFilter}
            onChange={(val) => {
              setDocTypeFilter(val);
              setCurrentPage(1);
            }}
            placeholder="Todos los Tipos de Doc."
            options={[
              { value: 'RESOLUCION_DIRECTORAL', label: 'Resolución Directoral Regional (RDR)' },
              { value: 'MEMORANDO', label: 'Memorando Directo / Múltiple' },
              { value: 'OFICIO', label: 'Oficio / Disposición' },
              { value: 'INFORME', label: 'Informe Técnico' },
              { value: 'OTRO', label: 'Otro Documento' },
            ]}
          />
        </FilterField>

        <FilterField label="Rango de Vigencia (Desde / Hasta)">
          <FilterDateRange
            startDate={filterFechaDesde}
            endDate={filterFechaHasta}
            onStartDateChange={(val) => {
              setFilterFechaDesde(val);
              setCurrentPage(1);
            }}
            onEndDateChange={(val) => {
              setFilterFechaHasta(val);
              setCurrentPage(1);
            }}
          />
        </FilterField>
      </AdvancedSearchFilter>

      {/* Encargaturas Table */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <SortableHeader
                  label="Función & Unidad Encargada"
                  field="cargo_encargado"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Trabajador Encargado"
                  field="encargado_name"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Titular Ausente & Motivo"
                  field="titular_name"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Vigencia Administrativa"
                  field="start_date"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Documento de Sustento"
                  field="document_number"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <th className="px-4 py-3.5 text-center text-slate-400">Estado</th>
                <th className="px-4 py-3.5 text-right text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {paginatedList.map((enc) => {
                const badge = getStatusBadge(enc.computed_status);
                const approvedCount = (enc.papeletas_approved_count || 0) +
                  papeletas.filter((p) => p.boss_delegation_info?.encargatura_id === enc.id).length;

                return (
                  <tr key={enc.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Función & Unidad Encargada */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{enc.cargo_encargado}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                        {enc.direccion_organo_name || enc.area_name || enc.dependencia_name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {enc.dependencia_name}
                      </div>
                    </td>

                    {/* Trabajador Encargado */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{enc.encargado_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        DNI: <span className="font-mono text-slate-300">{enc.encargado_dni}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 inline-block">
                        Área permanente: <strong className="text-slate-300">{enc.encargado_area_procedencia_name}</strong>
                      </div>
                    </td>

                    {/* Titular Ausente & Motivo */}
                    <td className="px-4 py-3.5">
                      <div className="text-slate-200 font-medium">{enc.titular_name}</div>
                      <div className="text-[10px] text-slate-400">{enc.titular_cargo}</div>
                      <div className="text-[10px] text-indigo-300 mt-0.5 flex items-center gap-1 font-semibold">
                        <span>Motivo: {getMotivoLabel(enc.motivo)}</span>
                      </div>
                    </td>

                    {/* Vigencia */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-200 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{enc.start_date}</span>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <span>{enc.end_date}</span>
                      </div>
                      {enc.computed_status === 'VIGENTE' && (
                        <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                          ✓ Facultades de VoBo activas
                        </div>
                      )}
                    </td>

                    {/* Documento de Sustento */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-indigo-300 font-bold text-[11px] flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{enc.document_number}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Fecha: <span className="font-mono">{enc.document_date}</span>
                      </div>
                      {approvedCount > 0 && (
                        <div className="text-[10px] text-amber-400 font-medium mt-0.5">
                          {approvedCount} papeleta(s) aprobadas
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border inline-flex items-center gap-1.5 ${badge.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedEncForView(enc)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="Ver Ficha y Trazabilidad de Encargatura"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {canManage && enc.status !== 'ANULADA' && (
                          <button
                            onClick={() => handleOpenEditModal(enc)}
                            className="p-1.5 bg-slate-800 hover:bg-indigo-900/60 text-indigo-300 rounded-lg transition-colors"
                            title="Editar Encargatura"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canManage && enc.status !== 'ANULADA' && (
                          <button
                            onClick={() => {
                              setAnularModalEnc(enc);
                              setAnularReason('');
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-amber-950 text-amber-400 rounded-lg transition-colors"
                            title="Anular Administrativamente"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canManage && (
                          <button
                            onClick={() => {
                              if (approvedCount > 0) {
                                alert(
                                  `No se puede eliminar la encargatura porque ya cuenta con ${approvedCount} papeleta(s) firmadas bajo esta delegación. Debe anularla para preservar la trazabilidad legal.`
                                );
                                return;
                              }
                              if (confirm(`¿Desea eliminar la encargatura ${enc.cargo_encargado} asignada a ${enc.encargado_name}?`)) {
                                onDeleteEncargatura(enc.id);
                              }
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded-lg transition-colors"
                            title={approvedCount > 0 ? 'Bloqueado por papeletas asociadas' : 'Eliminar Registro'}
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

          {filteredList.length === 0 && (
            <EmptyState
              icon={ShieldCheck}
              title="No se encontraron encargaturas temporales"
              description="No hay actos de encargatura registrados con los criterios de búsqueda seleccionados. Pruebe cambiando los filtros."
              isFiltered={Boolean(searchTerm.trim()) || activeFilterCount > 0}
              onAction={handleResetFilters}
            />
          )}
        </div>

        {filteredList.length > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredList.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* ================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR ENCARGATURA TEMPORAL                   */}
      {/* ================================================================= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {editingEnc ? 'Modificar Encargatura Temporal' : 'Registrar Nueva Encargatura Temporal'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acto administrativo para delegación temporal de funciones de Jefe Inmediato
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>{formError}</div>
                </div>
              )}

              {/* SECTION 1: PARTICIPANTES */}
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  1. Participantes del Acto Administrativo
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Titular Ausente */}
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Trabajador Titular (Ausente) <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formTitularId}
                      onChange={(e) => handleTitularChange(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    >
                      <option value="">Seleccionar Titular...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.position} — {emp.direccion_organo_name || emp.area_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Encargado Designado */}
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">
                      Trabajador Encargado <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formEncargadoId}
                      onChange={(e) => setFormEncargadoId(e.target.value)}
                      className="w-full bg-[#0F1115] border border-amber-500/40 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    >
                      <option value="">Seleccionar Trabajador Encargado...</option>
                      {employees
                        .filter((e) => e.id !== formTitularId && e.active)
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} ({emp.position} — {emp.area_name})
                          </option>
                        ))}
                    </select>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Puede pertenecer a la misma área o a otra área distinta. Su asignación permanente no se alterará.
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: UNIDAD ORGÁNICA Y CARGO */}
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  2. Unidad Orgánica y Función Encargada
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Dependencia</label>
                    <select
                      value={formDepId}
                      onChange={(e) => setFormDepId(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                      required
                    >
                      {dependencias.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Dirección / Órgano</label>
                    <select
                      value={formDirId}
                      onChange={(e) => setFormDirId(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="">Seleccionar Dirección / Órgano...</option>
                      {direccionesOrganos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Área / Oficina</label>
                    <select
                      value={formAreaId}
                      onChange={(e) => setFormAreaId(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="">Seleccionar Área...</option>
                      {areas
                        .filter((a) => !formDirId || a.direccion_organo_id === formDirId)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Denominación del Cargo / Función Encargada <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Director de Administración (e) / Jefe de Oficina Agraria Celendín (e)"
                    value={formCargoEncargado}
                    onChange={(e) => setFormCargoEncargado(e.target.value)}
                    className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                    required
                  />
                </div>
              </div>

              {/* SECTION 3: MOTIVO Y VIGENCIA */}
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  3. Causa de Ausencia y Vigencia Temporal
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Motivo de Ausencia</label>
                    <select
                      value={formMotivo}
                      onChange={(e) => setFormMotivo(e.target.value as EncargaturaMotivo)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="VACACIONES">Descanso Vacacional</option>
                      <option value="PERMISO">Permiso Justificado</option>
                      <option value="COMISION_SERVICIOS">Comisión de Servicios</option>
                      <option value="LICENCIA">Licencia con/sin Goce</option>
                      <option value="TRABAJO_FUERA_SEDE">Trabajo Fuera de Sede</option>
                      <option value="OTRO">Otra Ausencia Autorizada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Fecha de Inicio <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Fecha de Término <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Detalle del Motivo / Observaciones</label>
                  <input
                    type="text"
                    placeholder="Ej: Goce vacacional período 2025-2026 autorizado mediante resolución..."
                    value={formMotivoDetalle}
                    onChange={(e) => setFormMotivoDetalle(e.target.value)}
                    className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* SECTION 4: DOCUMENTO DE SUSTENTO OFICIAL */}
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  4. Documento Oficial de Sustento
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Documento</label>
                    <select
                      value={formDocType}
                      onChange={(e) => setFormDocType(e.target.value as EncargaturaDocumentType)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="MEMORANDO">Memorando</option>
                      <option value="RESOLUCION_DIRECTORAL">Resolución Directoral</option>
                      <option value="OFICIO">Oficio</option>
                      <option value="DECRETO">Decreto</option>
                      <option value="OTRO">Otro Documento Oficial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Número de Documento <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Memorando N.º 025-2026-DRAC"
                      value={formDocNumber}
                      onChange={(e) => setFormDocNumber(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Fecha del Documento</label>
                    <input
                      type="date"
                      value={formDocDate}
                      onChange={(e) => setFormDocDate(e.target.value)}
                      className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombre / Referencia de Archivo Adjunto</label>
                  <input
                    type="text"
                    placeholder="Ej: memo_025_2026_encargatura_administracion.pdf"
                    value={formDocFileName}
                    onChange={(e) => setFormDocFileName(e.target.value)}
                    className="w-full bg-[#0F1115] border border-slate-800 rounded-lg p-2 text-xs text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{editingEnc ? 'Guardar Cambios' : 'Emitir Encargatura'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: VER FICHA Y TRAZABILIDAD DE ENCARGATURA                    */}
      {/* ================================================================= */}
      {selectedEncForView && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Ficha Oficial de Encargatura Temporal DRAC
                  </h3>
                  <p className="text-xs font-mono text-indigo-300">
                    {selectedEncForView.document_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEncForView(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Header Badge */}
              <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    {selectedEncForView.cargo_encargado}
                  </span>
                  {(() => {
                    const badge = getStatusBadge(computeEncargaturaStatus(selectedEncForView, todayStr));
                    return (
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-sm font-bold text-white">
                  {selectedEncForView.direccion_organo_name || selectedEncForView.area_name || selectedEncForView.dependencia_name}
                </div>
                <div className="text-xs text-slate-400">
                  Dependencia: {selectedEncForView.dependencia_name}
                </div>
              </div>

              {/* Titular vs Encargado Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Titular */}
                <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>Jefe Titular (Ausente)</span>
                  </div>
                  <div className="text-sm font-bold text-white">{selectedEncForView.titular_name}</div>
                  <div className="text-xs text-slate-300">{selectedEncForView.titular_cargo}</div>
                  <div className="text-[11px] text-slate-400">
                    DNI: <span className="font-mono">{selectedEncForView.titular_dni}</span>
                  </div>
                  <div className="text-[11px] text-indigo-300 font-semibold pt-1 border-t border-slate-800">
                    Motivo: {getMotivoLabel(selectedEncForView.motivo)}
                  </div>
                </div>

                {/* Encargado */}
                <div className="bg-[#090A0D] border border-amber-500/30 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Trabajador Encargado</span>
                  </div>
                  <div className="text-sm font-bold text-white">{selectedEncForView.encargado_name}</div>
                  <div className="text-xs text-slate-300">{selectedEncForView.encargado_cargo}</div>
                  <div className="text-[11px] text-slate-400">
                    DNI: <span className="font-mono">{selectedEncForView.encargado_dni}</span>
                  </div>
                  <div className="text-[11px] text-amber-300 font-semibold pt-1 border-t border-slate-800">
                    Área permanente de origen: {selectedEncForView.encargado_area_procedencia_name}
                  </div>
                </div>
              </div>

              {/* Vigencia & Documento */}
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Período de Vigencia:</span>
                    <span className="font-mono text-white font-bold">
                      {selectedEncForView.start_date} al {selectedEncForView.end_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Documento Administrativo:</span>
                    <span className="font-mono text-indigo-300 font-bold">
                      {selectedEncForView.document_type} N.º {selectedEncForView.document_number}
                    </span>
                  </div>
                </div>

                {selectedEncForView.motivo_detalle && (
                  <div className="text-xs text-slate-300 pt-2 border-t border-slate-800">
                    <strong className="text-slate-400">Detalle:</strong> {selectedEncForView.motivo_detalle}
                  </div>
                )}
              </div>

              {/* Trazabilidad de Papeletas Aprobadas */}
              {(() => {
                const delegatedPapeletas = papeletas.filter(
                  (p) => p.boss_delegation_info?.encargatura_id === selectedEncForView.id
                );

                return (
                  <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        Papeletas de Salida Autorizadas bajo esta Encargatura ({delegatedPapeletas.length})
                      </span>
                    </div>

                    {delegatedPapeletas.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {delegatedPapeletas.map((pap) => (
                          <div
                            key={pap.id}
                            className="p-2 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono text-indigo-400 font-bold">{pap.code}</span> —{' '}
                              <span className="text-white">{pap.employee_name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              VoBo: {pap.boss_approved_at?.substring(0, 10)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No se han procesado papeletas de salida con visto bueno emitido durante esta encargatura hasta el momento.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-900/40 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedEncForView(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ANULAR ENCARGATURA ADMINISTRATIVAMENTE                     */}
      {/* ================================================================= */}
      {anularModalEnc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-sm font-bold text-white">Anular Encargatura Temporal</h3>
            </div>

            <p className="text-xs text-slate-300">
              ¿Desea anular administrativamente la encargatura de <strong>{anularModalEnc.cargo_encargado}</strong> asignada a <strong>{anularModalEnc.encargado_name}</strong>?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Motivo / Disposición de Anulación <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Reincorporación anticipada del titular según Memorando N.º..."
                value={anularReason}
                onChange={(e) => setAnularReason(e.target.value)}
                className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAnularModalEnc(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAnulacion}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {showBulkModal && (
        <BulkUploadModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          initialEntityType="ENCARGATURAS"
          dependencias={dependencias}
          direccionesOrganos={direccionesOrganos}
          areas={areas}
          cargos={[]}
          employees={employees}
          encargaturas={encargaturas}
          horarios={[]}
          onConfirmEncargaturas={(validEncs) => {
            if (onBulkImportEncargaturas) {
              onBulkImportEncargaturas(validEncs);
            } else {
              validEncs.forEach((enc) => onAddEncargatura(enc));
            }
          }}
        />
      )}
    </div>
  );
};
