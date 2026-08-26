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
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Users,
  Check,
  X,
  AlertTriangle,
  FileBadge,
  Sparkles,
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
import { computeEncargaturaStatus, VALID_JEFE_ORGANO_TYPES, getEmployeeAssignedRoles } from '../../utils/encargaturaUtils';
import { BulkUploadModal } from './BulkUploadModal';
import { generateTemplateEncargaturas } from '../../utils/bulkUploadUtils';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter, FilterField, FilterSelect, FilterDateRange } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';
import { normalizePersonName, buildNormalizedFullName, matchesSearch } from '../../utils/nameUtils';

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
  const [showNewWizardModal, setShowNewWizardModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEnc, setEditingEnc] = useState<Encargatura | null>(null);
  const [selectedEncForView, setSelectedEncForView] = useState<Encargatura | null>(null);
  const [anularModalEnc, setAnularModalEnc] = useState<Encargatura | null>(null);
  const [anularReason, setAnularReason] = useState('');

  // WIZARD STEPS FOR NEW ENCARGATURA (1: Dir/Titular, 2: Encargado, 3: Sustento/Fechas, 4: Resumen)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 State: Search & Selection of Dirección / Órgano
  const [dirSearchQuery, setDirSearchQuery] = useState('');
  const [selectedDirId, setSelectedDirId] = useState<string>('');
  const [selectedTitularId, setSelectedTitularId] = useState<string>('');

  // Step 2 State: Search & Selection of Encargado
  const [encargadoSearchQuery, setEncargadoSearchQuery] = useState('');
  const [encargadoFilterMode, setEncargadoFilterMode] = useState<'ALL' | 'SAME_UNIT' | 'OTHER_BOSS'>('ALL');
  const [selectedEncargadoId, setSelectedEncargadoId] = useState<string>('');

  // Step 3 State: Details, Dates, Document
  const [formCargoEncargado, setFormCargoEncargado] = useState('');
  const [formMotivo, setFormMotivo] = useState<EncargaturaMotivo>('VACACIONES');
  const [formMotivoDetalle, setFormMotivoDetalle] = useState('');
  const [formStartDate, setFormStartDate] = useState(todayStr);
  const [formEndDate, setFormEndDate] = useState(todayStr);
  const [formDocType, setFormDocType] = useState<EncargaturaDocumentType>('RESOLUCION_DIRECTORAL');
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
        const fullSearch = `${enc.titular_name} ${enc.encargado_name} ${enc.titular_dni || ''} ${enc.encargado_dni || ''} ${enc.cargo_encargado} ${enc.document_number} ${enc.direccion_organo_name || ''} ${enc.area_name || ''} ${enc.dependencia_name || ''}`;
        if (!matchesSearch(fullSearch, searchTerm)) return false;
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

  // =========================================================================
  // LOGIC FOR WIZARD / REGISTER NEW ENCARGATURA
  // =========================================================================

  // Filtered Direcciones / Órganos for Step 1
  const filteredDirecciones = useMemo(() => {
    const query = dirSearchQuery.toLowerCase().trim();
    return direccionesOrganos.filter((dir) => {
      if (!dir.active) return false;
      if (!query) return true;
      return (
        dir.name.toLowerCase().includes(query) ||
        dir.code.toLowerCase().includes(query) ||
        (dir.type && dir.type.toLowerCase().includes(query)) ||
        (dir.dependencia_name && dir.dependencia_name.toLowerCase().includes(query))
      );
    });
  }, [direccionesOrganos, dirSearchQuery]);

  // Selected Dirección / Órgano Object
  const currentSelectedDir = useMemo(() => {
    return direccionesOrganos.find((d) => d.id === selectedDirId) || null;
  }, [direccionesOrganos, selectedDirId]);

  // All employees belonging to the selected Dirección / Órgano
  const unitEmployees = useMemo(() => {
    if (!selectedDirId) return [];
    return employees.filter((e) => e.direccion_organo_id === selectedDirId && e.active);
  }, [employees, selectedDirId]);

  // Auto-identified Jefe Inmediato Titular for the selected Dirección / Órgano
  const identifiedTitulars = useMemo(() => {
    if (!selectedDirId) return [];
    
    // First, look for employee explicitly marked as jefe/director of this unit
    const explicitJefe = employees.filter(
      (e) =>
        e.active &&
        e.direccion_organo_id === selectedDirId &&
        (e.is_jefe_director ||
          e.role === 'JEFE' ||
          e.role === 'JEFE_RRHH' ||
          e.role === 'DIRECTOR_GENERAL' ||
          (e.position && (e.position.toUpperCase().includes('DIRECTOR') || e.position.toUpperCase().includes('JEFE'))))
    );

    if (explicitJefe.length > 0) return explicitJefe;

    // Fallback: any worker in this unit
    return unitEmployees;
  }, [employees, selectedDirId, unitEmployees]);

  // Active Titular Object
  const currentSelectedTitular = useMemo(() => {
    if (selectedTitularId) {
      return employees.find((e) => e.id === selectedTitularId) || null;
    }
    return identifiedTitulars[0] || null;
  }, [employees, selectedTitularId, identifiedTitulars]);

  // When Dirección is selected in Step 1, auto-select the Titular and set suggested Cargo
  const handleSelectDireccion = (dir: DireccionOrgano) => {
    setSelectedDirId(dir.id);
    
    // Auto-identify boss
    const autoTitular = employees.find(
      (e) =>
        e.active &&
        e.direccion_organo_id === dir.id &&
        (e.is_jefe_director ||
          e.role === 'JEFE' ||
          e.role === 'JEFE_RRHH' ||
          e.role === 'DIRECTOR_GENERAL' ||
          (e.position && (e.position.toUpperCase().includes('DIRECTOR') || e.position.toUpperCase().includes('JEFE'))))
    ) || employees.find((e) => e.active && e.direccion_organo_id === dir.id);

    if (autoTitular) {
      setSelectedTitularId(autoTitular.id);
      setFormCargoEncargado(autoTitular.position ? `${autoTitular.position} (e)` : `${dir.name} (e)`);
    } else {
      setSelectedTitularId('');
      setFormCargoEncargado(`${dir.name} (e)`);
    }
    setSelectedEncargadoId('');
  };

  // STRICT RULE FOR ENCARGADO CANDIDATES:
  // Option 1: Worker belonging to the SAME Dirección / Órgano
  // Option 2: Another worker with profile JEFE INMEDIATO (is_jefe_director or role in JEFE/DIRECTOR_GENERAL/JEFE_RRHH/SUPERVISOR)
  const eligibleEncargados = useMemo(() => {
    if (!selectedDirId) return [];

    const titularId = currentSelectedTitular?.id;

    return employees
      .filter((emp) => {
        // Exclude inactive workers and the titular himself
        if (!emp.active) return false;
        if (titularId && emp.id === titularId) return false;

        const isSameUnit = emp.direccion_organo_id === selectedDirId;
        const roles = getEmployeeAssignedRoles(emp);
        const isJefeInmediato =
          Boolean(emp.is_jefe_director) ||
          roles.includes('JEFE') ||
          roles.includes('JEFE_RRHH') ||
          roles.includes('DIRECTOR_GENERAL') ||
          roles.includes('SUPERVISOR') ||
          (emp.position &&
            (emp.position.toUpperCase().includes('DIRECTOR') ||
              emp.position.toUpperCase().includes('JEFE') ||
              emp.position.toUpperCase().includes('RESPONSABLE')));

        return isSameUnit || isJefeInmediato;
      })
      .map((emp) => {
        const isSameUnit = emp.direccion_organo_id === selectedDirId;
        const roles = getEmployeeAssignedRoles(emp);
        const isOtherBoss =
          !isSameUnit &&
          (Boolean(emp.is_jefe_director) ||
            roles.includes('JEFE') ||
            roles.includes('JEFE_RRHH') ||
            roles.includes('DIRECTOR_GENERAL') ||
            roles.includes('SUPERVISOR') ||
            (emp.position &&
              (emp.position.toUpperCase().includes('DIRECTOR') ||
                emp.position.toUpperCase().includes('JEFE') ||
                emp.position.toUpperCase().includes('RESPONSABLE'))));

        return {
          employee: emp,
          isSameUnit,
          isOtherBoss,
          eligibilityType: isSameUnit ? ('SAME_UNIT' as const) : ('OTHER_BOSS' as const),
          eligibilityLabel: isSameUnit
            ? 'Trabajador de la Misma Unidad Orgánica'
            : 'Jefe Inmediato Institucional (Otra Unidad)',
        };
      });
  }, [employees, selectedDirId, currentSelectedTitular]);

  // Filtered Encargado candidates by mode and search query
  const filteredEncargados = useMemo(() => {
    const query = encargadoSearchQuery.toLowerCase().trim();

    return eligibleEncargados.filter((item) => {
      if (encargadoFilterMode === 'SAME_UNIT' && !item.isSameUnit) return false;
      if (encargadoFilterMode === 'OTHER_BOSS' && !item.isOtherBoss) return false;

      if (!query) return true;

      const emp = item.employee;
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      return (
        fullName.includes(query) ||
        emp.dni.includes(query) ||
        (emp.codigo_trabajador && emp.codigo_trabajador.toLowerCase().includes(query)) ||
        emp.position.toLowerCase().includes(query) ||
        emp.area_name.toLowerCase().includes(query) ||
        (emp.direccion_organo_name && emp.direccion_organo_name.toLowerCase().includes(query))
      );
    });
  }, [eligibleEncargados, encargadoFilterMode, encargadoSearchQuery]);

  // Selected Encargado Object
  const currentSelectedEncargado = useMemo(() => {
    const found = eligibleEncargados.find((item) => item.employee.id === selectedEncargadoId);
    return found || null;
  }, [eligibleEncargados, selectedEncargadoId]);

  // Open New Wizard Modal
  const handleOpenNewWizard = () => {
    setWizardStep(1);
    setFormError(null);
    setDirSearchQuery('');
    setEncargadoSearchQuery('');
    setEncargadoFilterMode('ALL');

    // Auto-select first active direction if available
    const firstDir = direccionesOrganos.find((d) => d.active) || direccionesOrganos[0];
    if (firstDir) {
      handleSelectDireccion(firstDir);
    } else {
      setSelectedDirId('');
      setSelectedTitularId('');
    }

    setSelectedEncargadoId('');
    setFormMotivo('VACACIONES');
    setFormMotivoDetalle('');
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);
    setFormDocType('RESOLUCION_DIRECTORAL');
    setFormDocNumber(`RDR N.º 0${encargaturas.length + 1}-2026-GR.CAJ/DRA`);
    setFormDocDate(todayStr);
    setFormDocFileName('');
    setFormObservaciones('');
    setShowNewWizardModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (enc: Encargatura) => {
    const approvedCount =
      (enc.papeletas_approved_count || 0) +
      papeletas.filter((p) => p.boss_delegation_info?.encargatura_id === enc.id).length;

    if (approvedCount > 0) {
      setFormError(
        'Esta encargatura ya cuenta con papeletas autorizadas en el historial institucional. Solo se permiten ajustes administrativos de sustento.'
      );
    } else {
      setFormError(null);
    }

    setEditingEnc(enc);
    setSelectedTitularId(enc.titular_employee_id);
    setSelectedEncargadoId(enc.encargado_employee_id);
    setSelectedDirId(enc.direccion_organo_id || '');
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
    setShowEditModal(true);
  };

  // Advance Wizard Steps with Strict Validations
  const handleNextStep = () => {
    setFormError(null);

    if (wizardStep === 1) {
      if (!selectedDirId) {
        setFormError('Debe seleccionar una Dirección / Órgano de Apoyo.');
        return;
      }
      if (!currentSelectedTitular) {
        setFormError('Debe identificar al Jefe Inmediato Titular que será reemplazado.');
        return;
      }
      setWizardStep(2);
    } else if (wizardStep === 2) {
      if (!selectedEncargadoId || !currentSelectedEncargado) {
        setFormError('Debe seleccionar al trabajador que asumirá la encargatura temporal.');
        return;
      }
      setWizardStep(3);
    } else if (wizardStep === 3) {
      if (!formCargoEncargado.trim()) {
        setFormError('La denominación del cargo / función encargada es obligatoria.');
        return;
      }
      if (!formDocNumber.trim()) {
        setFormError('El número de documento de sustento oficial es obligatorio (ej. RDR N.º 045-2026-GR.CAJ/DRA).');
        return;
      }
      if (!formStartDate || !formEndDate) {
        setFormError('Debe especificar la fecha de inicio y la fecha de término.');
        return;
      }
      if (formStartDate > formEndDate) {
        setFormError('La fecha de inicio no puede ser posterior a la fecha de término.');
        return;
      }

      // Check overlap
      const overlapping = encargaturas.find((other) => {
        if (other.status === 'ANULADA') return false;
        if (other.direccion_organo_id === selectedDirId) {
          const datesOverlap = formStartDate <= other.end_date && formEndDate >= other.start_date;
          return datesOverlap;
        }
        return false;
      });

      if (overlapping) {
        setFormError(
          `Ya existe una encargatura activa/programada para esta Dirección/Órgano en el período indicado (${overlapping.cargo_encargado} asignado a ${overlapping.encargado_name}).`
        );
        return;
      }

      setWizardStep(4);
    }
  };

  // Submit New Encargatura from Wizard
  const handleConfirmEmitEncargatura = () => {
    setFormError(null);

    if (!currentSelectedDir || !currentSelectedTitular || !currentSelectedEncargado) {
      setFormError('Datos incompletos para emitir la encargatura.');
      return;
    }

    const titular = currentSelectedTitular;
    const encargado = currentSelectedEncargado.employee;
    const dirObj = currentSelectedDir;
    const depObj = dependencias.find((d) => d.id === dirObj.dependencia_id) || dependencias[0];

    const fullTitularName = buildNormalizedFullName(titular.first_name, titular.last_name);
    const fullEncargadoName = buildNormalizedFullName(encargado.first_name, encargado.last_name);

    onAddEncargatura({
      titular_employee_id: titular.id,
      titular_dni: titular.dni,
      titular_name: fullTitularName,
      titular_cargo: titular.position || 'Director / Jefe Inmediato',
      titular_area_name: titular.area_name,
      titular_direccion_organo_name: dirObj.name,
      encargado_employee_id: encargado.id,
      encargado_dni: encargado.dni,
      encargado_name: fullEncargadoName,
      encargado_cargo: encargado.position,
      encargado_area_procedencia_id: encargado.area_id,
      encargado_area_procedencia_name: encargado.area_name,
      encargado_dependencia_procedencia_name: encargado.dependencia_name,
      dependencia_id: depObj?.id || 'dep-01',
      dependencia_name: depObj?.name || 'Sede Central DRAC',
      direccion_organo_id: dirObj.id,
      direccion_organo_name: dirObj.name,
      direccion_organo_type: dirObj.type,
      cargo_encargado: formCargoEncargado.trim(),
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

    setShowNewWizardModal(false);
  };

  // Save Edit Encargatura
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnc) return;

    if (!formCargoEncargado.trim() || !formDocNumber.trim() || !formStartDate || !formEndDate) {
      setFormError('Complete los campos obligatorios.');
      return;
    }

    if (formStartDate > formEndDate) {
      setFormError('La fecha de inicio no puede ser posterior a la fecha de término.');
      return;
    }

    onEditEncargatura({
      ...editingEnc,
      cargo_encargado: formCargoEncargado.trim(),
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

    setShowEditModal(false);
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

  const getOrganoTypeBadge = (tipo?: string) => {
    switch (tipo) {
      case 'DIRECCION':
        return { label: 'DIRECCIÓN DE LÍNEA', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'ORGANO_APOYO':
        return { label: 'ÓRGANO DE ASESORAMIENTO/APOYO', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'JEFATURA_AGENCIA':
        return { label: 'JEFATURA DE AGENCIA', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'OFICINA_AGRARIA':
        return { label: 'OFICINA AGRARIA', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      default:
        return { label: 'UNIDAD DRAC', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getStatusBadge = (status: 'PENDIENTE' | 'VIGENTE' | 'FINALIZADA' | 'ANULADA') => {
    switch (status) {
      case 'VIGENTE':
        return {
          label: 'VIGENTE',
          color: 'bg-emerald-950/50 text-emerald-300 border-emerald-500/50',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'PENDIENTE':
        return {
          label: 'PROGRAMADA',
          color: 'bg-amber-950/50 text-amber-300 border-amber-500/50',
          dot: 'bg-amber-400',
        };
      case 'FINALIZADA':
        return {
          label: 'FINALIZADA',
          color: 'bg-slate-900 text-slate-400 border-slate-800',
          dot: 'bg-slate-500',
        };
      case 'ANULADA':
        return {
          label: 'ANULADA',
          color: 'bg-rose-950/50 text-rose-400 border-rose-500/50',
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
              Designación y trazabilidad de encargaturas para Directores de Direcciones, Jefes de Órganos de Apoyo, Jefes de Agencia y Jefes de Oficina Agraria. Durante la vigencia, el encargado asume automáticamente las funciones de Visto Bueno (V°B°) de papeletas, preservando permanentemente el área de origen del servidor.
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
                onClick={handleOpenNewWizard}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Nueva Encargatura</span>
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
              <div className="text-[10px] text-slate-400 mt-0.5">Ejerciendo V°B° hoy</div>
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
              <div className="text-[10px] text-slate-400 mt-0.5">Vigencia futura</div>
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
              <div className="text-[10px] text-slate-500 mt-0.5">Facultades concluidas</div>
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
        searchPlaceholder="🔍 Buscar por titular, encargado, DNI, cargo, documento o dirección..."
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

        <FilterField label="Motivo de Ausencia">
          <FilterSelect
            value={motivoFilter}
            onChange={(val) => {
              setMotivoFilter(val);
              setCurrentPage(1);
            }}
            placeholder="Todos los Motivos"
            options={[
              { value: 'VACACIONES', label: 'Vacaciones de Ley' },
              { value: 'COMISION_SERVICIOS', label: 'Comisión de Servicios' },
              { value: 'LICENCIA', label: 'Licencia Médica / Concedida' },
              { value: 'PERMISO', label: 'Permiso Justificado' },
              { value: 'TRABAJO_FUERA_SEDE', label: 'Trabajo Fuera de Sede' },
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
              { value: 'MEMORANDO', label: 'Memorando Institucional' },
              { value: 'OFICIO', label: 'Oficio / Disposición' },
              { value: 'DECRETO', label: 'Decreto Regional' },
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

      {/* Encargaturas Table - Compact, Auto-fit, No Unnecessary Horizontal Scrollbar */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <SortableHeader
                  label="Función & Unidad Orgánica"
                  field="cargo_encargado"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="w-[26%]"
                />
                <SortableHeader
                  label="Trabajador Encargado"
                  field="encargado_name"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="w-[22%]"
                />
                <SortableHeader
                  label="Titular Ausente & Causa"
                  field="titular_name"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="w-[20%]"
                />
                <SortableHeader
                  label="Vigencia & Sustento"
                  field="start_date"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="w-[18%]"
                />
                <th className="px-3 py-3 text-center text-slate-400 font-semibold w-[6%]">Estado</th>
                <th className="px-3 py-3 text-right text-slate-400 font-semibold w-[8%]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {paginatedList.map((enc) => {
                const badge = getStatusBadge(enc.computed_status);
                const approvedCount =
                  (enc.papeletas_approved_count || 0) +
                  papeletas.filter((p) => p.boss_delegation_info?.encargatura_id === enc.id).length;

                return (
                  <tr key={enc.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Función & Unidad Orgánica */}
                    <td className="px-3 py-3 align-top">
                      <div className="font-bold text-white flex items-center gap-1.5" title={enc.cargo_encargado}>
                        <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{enc.cargo_encargado}</span>
                      </div>
                      <div
                        className="text-[11px] text-slate-300 mt-0.5 font-medium truncate"
                        title={enc.direccion_organo_name || enc.area_name || enc.dependencia_name}
                      >
                        {enc.direccion_organo_name || enc.area_name || enc.dependencia_name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        {enc.dependencia_name}
                      </div>
                    </td>

                    {/* Trabajador Encargado */}
                    <td className="px-3 py-3 align-top">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5" title={enc.encargado_name}>
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{enc.encargado_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        DNI: <span className="font-mono text-slate-300 font-semibold">{enc.encargado_dni}</span>
                      </div>
                      <div
                        className="text-[10px] text-slate-400 mt-0.5 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800 truncate block max-w-full"
                        title={`Área permanente: ${enc.encargado_area_procedencia_name}`}
                      >
                        Origen: <strong className="text-slate-300">{enc.encargado_area_procedencia_name}</strong>
                      </div>
                    </td>

                    {/* Titular Ausente & Causa */}
                    <td className="px-3 py-3 align-top">
                      <div className="text-slate-200 font-medium truncate" title={enc.titular_name}>
                        {enc.titular_name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate" title={enc.titular_cargo}>
                        {enc.titular_cargo}
                      </div>
                      <div className="text-[10px] text-indigo-300 mt-0.5 font-semibold truncate" title={enc.motivo_detalle || getMotivoLabel(enc.motivo)}>
                        Causa: {getMotivoLabel(enc.motivo)}
                      </div>
                    </td>

                    {/* Vigencia & Sustento */}
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1 text-slate-200 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{enc.start_date}</span>
                        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        <span>{enc.end_date}</span>
                      </div>
                      <div className="font-mono text-indigo-300 font-bold text-[10px] mt-0.5 flex items-center gap-1 truncate" title={`${enc.document_type} ${enc.document_number}`}>
                        <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">{enc.document_number}</span>
                      </div>
                      {approvedCount > 0 && (
                        <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                          ✓ {approvedCount} papeleta(s) aprobadas
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3 text-center align-middle">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border inline-flex items-center gap-1 whitespace-nowrap ${badge.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1">
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
      {/* MODAL: REGISTRAR NUEVA ENCARGATURA TEMPORAL (WIZARD GUIADO)        */}
      {/* ================================================================= */}
      {showNewWizardModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
            {/* Wizard Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Registrar Nueva Encargatura Temporal de Jefatura
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acto administrativo para delegación temporal de funciones de V°B° de papeletas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewWizardModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="bg-[#090A0D] px-6 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4 w-full">
                {/* Step 1 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 1
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40'
                        : wizardStep > 1
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {wizardStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  <span
                    className={`text-xs font-bold hidden sm:inline ${
                      wizardStep === 1 ? 'text-indigo-400' : wizardStep > 1 ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    Dirección & Titular
                  </span>
                </div>

                <div className={`flex-1 h-0.5 ${wizardStep > 1 ? 'bg-emerald-600' : 'bg-slate-800'}`} />

                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 2
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40'
                        : wizardStep > 2
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {wizardStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                  </div>
                  <span
                    className={`text-xs font-bold hidden sm:inline ${
                      wizardStep === 2 ? 'text-indigo-400' : wizardStep > 2 ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    Trabajador Encargado
                  </span>
                </div>

                <div className={`flex-1 h-0.5 ${wizardStep > 2 ? 'bg-emerald-600' : 'bg-slate-800'}`} />

                {/* Step 3 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 3
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40'
                        : wizardStep > 3
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {wizardStep > 3 ? <Check className="w-4 h-4" /> : '3'}
                  </div>
                  <span
                    className={`text-xs font-bold hidden sm:inline ${
                      wizardStep === 3 ? 'text-indigo-400' : wizardStep > 3 ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    Sustento & Vigencia
                  </span>
                </div>

                <div className={`flex-1 h-0.5 ${wizardStep > 3 ? 'bg-emerald-600' : 'bg-slate-800'}`} />

                {/* Step 4 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 4 ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    4
                  </div>
                  <span className={`text-xs font-bold hidden sm:inline ${wizardStep === 4 ? 'text-indigo-400' : 'text-slate-500'}`}>
                    Resumen & Emisión
                  </span>
                </div>
              </div>
            </div>

            {/* Form / Wizard Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3 text-rose-300 text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                  <div>{formError}</div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 1: DIRECCIÓN / ÓRGANO & JEFE TITULAR AUSENTE         */}
              {/* ========================================================= */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3 text-xs text-indigo-300">
                    <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold mb-0.5">
                        Paso 1: Seleccione la Dirección / Órgano de Apoyo donde se ausentará el Jefe Inmediato
                      </strong>
                      Al seleccionar la unidad orgánica, el sistema identificará automáticamente al Director o Jefe Titular actual.
                    </div>
                  </div>

                  {/* Search Bar for Direcciones */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por código, nombre de Dirección, Órgano de Apoyo o Agencia Agraria..."
                      value={dirSearchQuery}
                      onChange={(e) => setDirSearchQuery(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Direcciones List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                    {filteredDirecciones.map((dir) => {
                      const isSelected = selectedDirId === dir.id;
                      const typeBadge = getOrganoTypeBadge(dir.type);
                      const staffCount = employees.filter((e) => e.direccion_organo_id === dir.id && e.active).length;

                      return (
                        <div
                          key={dir.id}
                          onClick={() => handleSelectDireccion(dir)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500'
                              : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-mono text-xs font-bold text-indigo-400">{dir.code}</span>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${typeBadge.color}`}>
                                {typeBadge.label}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white mb-1">{dir.name}</div>
                            <div className="text-[10px] text-slate-400">{dir.dependencia_name}</div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">{staffCount} trabajadores en planilla</span>
                            {isSelected && (
                              <span className="text-indigo-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Seleccionado
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Identified Titular Panel */}
                  {currentSelectedDir && (
                    <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-indigo-400" />
                          <span>Jefe Inmediato Titular Identificado (Ausente)</span>
                        </span>
                        {identifiedTitulars.length > 1 && (
                          <span className="text-[10px] text-amber-400 normal-case font-normal">
                            Hay {identifiedTitulars.length} trabajadores con cargo directivo en esta unidad
                          </span>
                        )}
                      </div>

                      {identifiedTitulars.length > 1 ? (
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">
                            Seleccione al titular que se ausentará:
                          </label>
                          <select
                            value={selectedTitularId}
                            onChange={(e) => setSelectedTitularId(e.target.value)}
                            className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            {identifiedTitulars.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name} — DNI: {emp.dni} ({emp.position})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : currentSelectedTitular ? (
                        <div className="p-3 bg-[#0F1115] border border-slate-800/80 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                              {currentSelectedTitular.first_name[0]}
                              {currentSelectedTitular.last_name[0]}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">
                                {currentSelectedTitular.first_name} {currentSelectedTitular.last_name}
                              </div>
                              <div className="text-[11px] text-slate-400">{currentSelectedTitular.position}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                DNI: {currentSelectedTitular.dni} | Código: {currentSelectedTitular.codigo_trabajador}
                              </div>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                            Titular de la Unidad
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            No se detectó un director formal asignado a esta unidad. Seleccione un servidor de la lista o registre un jefe en el directorio.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 2: TRABAJADOR ENCARGADO DESIGNADO                     */}
              {/* ========================================================= */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  {/* Institutional Legal Rules Banner */}
                  <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-2 text-white">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>Requisitos Institucionales para la Designación del Encargado</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      Por directiva institucional de la Dirección Regional de Agricultura Cajamarca, el encargado únicamente puede ser:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300 pl-1 font-medium">
                      <li>
                        <strong>Opción A:</strong> Un trabajador perteneciente a la <strong>misma Dirección / Órgano seleccionado</strong>.
                      </li>
                      <li>
                        <strong>Opción B:</strong> Otro trabajador que cuente formalmente con el perfil de <strong>JEFE INMEDIATO</strong> en la institución (aunque pertenezca a otra unidad).
                      </li>
                    </ul>
                  </div>

                  {/* Filter Tabs & Search */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
                      <button
                        type="button"
                        onClick={() => setEncargadoFilterMode('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          encargadoFilterMode === 'ALL'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        Todos los Elegibles ({eligibleEncargados.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setEncargadoFilterMode('SAME_UNIT')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          encargadoFilterMode === 'SAME_UNIT'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Misma Unidad Orgánica ({eligibleEncargados.filter((e) => e.isSameUnit).length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEncargadoFilterMode('OTHER_BOSS')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          encargadoFilterMode === 'OTHER_BOSS'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Otros Jefes Inmediatos ({eligibleEncargados.filter((e) => e.isOtherBoss).length})</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por DNI, apellidos, nombres, cargo o área..."
                        value={encargadoSearchQuery}
                        onChange={(e) => setEncargadoSearchQuery(e.target.value)}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Candidates List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {filteredEncargados.map((item) => {
                      const emp = item.employee;
                      const isSelected = selectedEncargadoId === emp.id;

                      return (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedEncargadoId(emp.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500'
                              : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-mono text-[10px] text-slate-400">
                                DNI: <strong className="text-white">{emp.dni}</strong>
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[9px] font-bold rounded border ${
                                  item.isSameUnit
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                }`}
                              >
                                {item.eligibilityLabel}
                              </span>
                            </div>

                            <div className="text-xs font-bold text-white mb-0.5">
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div className="text-[11px] text-amber-300 font-medium">{emp.position}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              Área permanente: <span className="text-slate-300 font-semibold">{emp.area_name}</span>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Régimen: {emp.regimen_laboral}</span>
                            {isSelected && (
                              <span className="text-amber-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Seleccionado como Encargado
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {filteredEncargados.length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                        No se encontraron candidatos que coincidan con los criterios de búsqueda.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 3: SUSTENTO LEGAL, MOTIVO & VIGENCIA TEMPORAL         */}
              {/* ========================================================= */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {/* Summary of chosen participants */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-xl space-y-1">
                      <div className="text-[10px] font-bold text-indigo-400 uppercase">Unidad & Titular Ausente</div>
                      <div className="text-xs font-bold text-white">{currentSelectedTitular?.first_name} {currentSelectedTitular?.last_name}</div>
                      <div className="text-[11px] text-slate-400">{currentSelectedDir?.name}</div>
                    </div>

                    <div className="p-3 bg-[#090A0D] border border-amber-500/30 rounded-xl space-y-1">
                      <div className="text-[10px] font-bold text-amber-400 uppercase">Trabajador Encargado Designado</div>
                      <div className="text-xs font-bold text-amber-300">{currentSelectedEncargado?.employee.first_name} {currentSelectedEncargado?.employee.last_name}</div>
                      <div className="text-[11px] text-slate-400">Origen: {currentSelectedEncargado?.employee.area_name}</div>
                    </div>
                  </div>

                  {/* Form inputs */}
                  <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-4">
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Datos de la Encargatura y Sustento Oficial
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        Denominación de la Función / Cargo Encargado <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formCargoEncargado}
                        onChange={(e) => setFormCargoEncargado(e.target.value)}
                        placeholder="Ej: Director de Administración (e) / Jefe de Oficina Agraria Celendín (e)"
                        className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Motivo de Ausencia del Titular <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={formMotivo}
                          onChange={(e) => setFormMotivo(e.target.value as EncargaturaMotivo)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                        >
                          <option value="VACACIONES">Descanso Vacacional de Ley</option>
                          <option value="COMISION_SERVICIOS">Comisión de Servicios</option>
                          <option value="LICENCIA">Licencia con/sin Goce de Haber</option>
                          <option value="PERMISO">Permiso Oficial Justificado</option>
                          <option value="TRABAJO_FUERA_SEDE">Trabajo Fuera de Sede</option>
                          <option value="OTRO">Otra Ausencia Autorizada</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Detalle / Justificación del Motivo
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Goce de 15 días de vacaciones según rol anual..."
                          value={formMotivoDetalle}
                          onChange={(e) => setFormMotivoDetalle(e.target.value)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Tipo de Documento Resolutivo <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={formDocType}
                          onChange={(e) => setFormDocType(e.target.value as EncargaturaDocumentType)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                        >
                          <option value="RESOLUCION_DIRECTORAL">Resolución Directoral (RDR)</option>
                          <option value="MEMORANDO">Memorando Institucional</option>
                          <option value="OFICIO">Oficio / Disposición</option>
                          <option value="DECRETO">Decreto Regional</option>
                          <option value="OTRO">Otro Documento</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Número de Documento <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: RDR N.º 045-2026-GR.CAJ/DRA"
                          value={formDocNumber}
                          onChange={(e) => setFormDocNumber(e.target.value)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Fecha del Documento <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={formDocDate}
                          onChange={(e) => setFormDocDate(e.target.value)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Fecha de Inicio de Vigencia <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Fecha de Término de Vigencia <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Archivo Adjunto / Referencia Digital (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: rdr_045_2026_encargatura_administracion.pdf"
                        value={formDocFileName}
                        onChange={(e) => setFormDocFileName(e.target.value)}
                        className="w-full bg-[#0F1115] border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 4: RESUMEN EJECUTIVO Y EMISIÓN                       */}
              {/* ========================================================= */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-4 text-xs text-emerald-300 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold mb-0.5">
                        Paso 4: Resumen de la Encargatura y Delegación de Facultades
                      </strong>
                      Verifique los datos antes de emitir el acto administrativo. Durante el período de vigencia, el trabajador encargado tendrá plenas facultades para otorgar el V°B° a las papeletas de salida del personal de esta Dirección/Órgano.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Titular vs Encargado Card */}
                    <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2.5 text-xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Titular Ausente</span>
                      </div>
                      <div className="text-sm font-bold text-white">{currentSelectedTitular?.first_name} {currentSelectedTitular?.last_name}</div>
                      <div className="text-slate-300">{currentSelectedTitular?.position}</div>
                      <div className="text-slate-400 text-[11px]">DNI: <span className="font-mono text-slate-200">{currentSelectedTitular?.dni}</span></div>
                      <div className="text-indigo-400 text-[11px] font-semibold pt-1 border-t border-slate-800">
                        Unidad: {currentSelectedDir?.name}
                      </div>
                    </div>

                    <div className="p-4 bg-[#090A0D] border border-amber-500/30 rounded-xl space-y-2.5 text-xs">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Encargado Designado</span>
                      </div>
                      <div className="text-sm font-bold text-white">{currentSelectedEncargado?.employee.first_name} {currentSelectedEncargado?.employee.last_name}</div>
                      <div className="text-amber-300 font-semibold">{formCargoEncargado}</div>
                      <div className="text-slate-400 text-[11px]">DNI: <span className="font-mono text-slate-200">{currentSelectedEncargado?.employee.dni}</span></div>
                      <div className="text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                        Área Permanente: <strong className="text-slate-300">{currentSelectedEncargado?.employee.area_name}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Document & Period Details */}
                  <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Período de Vigencia</span>
                        <span className="font-mono text-white font-bold text-xs">{formStartDate} ➔ {formEndDate}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Documento de Sustento</span>
                        <span className="font-mono text-indigo-300 font-bold text-xs">{formDocType} N.º {formDocNumber}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Estado Calculado</span>
                        <span className="inline-block mt-0.5">
                          {todayStr >= formStartDate && todayStr <= formEndDate ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              🟢 VIGENTE HOY
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                              🟡 PROGRAMADA
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      <strong>Causa de Ausencia:</strong> {getMotivoLabel(formMotivo)} {formMotivoDetalle && `— ${formMotivoDetalle}`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer / Navigation Buttons */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setWizardStep((prev) => (prev - 1) as any);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewWizardModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                  >
                    <span>Siguiente Paso</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmEmitEncargatura}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirmar y Emitir Encargatura</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: EDITAR ENCARGATURA EXISTENTE                               */}
      {/* ================================================================= */}
      {showEditModal && editingEnc && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-6">
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Modificar Encargatura Temporal</h3>
                  <p className="text-xs text-slate-400">{editingEnc.document_number}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>{formError}</div>
                </div>
              )}

              <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-400 font-semibold">Titular: <strong className="text-white">{editingEnc.titular_name}</strong></div>
                <div className="text-slate-400 font-semibold">Encargado: <strong className="text-amber-300">{editingEnc.encargado_name}</strong></div>
                <div className="text-slate-500 text-[11px]">Unidad: {editingEnc.direccion_organo_name || editingEnc.area_name}</div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Denominación del Cargo Encargado</label>
                <input
                  type="text"
                  value={formCargoEncargado}
                  onChange={(e) => setFormCargoEncargado(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white font-medium focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Motivo de Ausencia</label>
                  <select
                    value={formMotivo}
                    onChange={(e) => setFormMotivo(e.target.value as EncargaturaMotivo)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white"
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
                  <label className="block text-slate-300 font-bold mb-1">Detalle del Motivo</label>
                  <input
                    type="text"
                    value={formMotivoDetalle}
                    onChange={(e) => setFormMotivoDetalle(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Tipo de Documento</label>
                  <select
                    value={formDocType}
                    onChange={(e) => setFormDocType(e.target.value as EncargaturaDocumentType)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="RESOLUCION_DIRECTORAL">Resolución Directoral (RDR)</option>
                    <option value="MEMORANDO">Memorando Institucional</option>
                    <option value="OFICIO">Oficio / Disposición</option>
                    <option value="DECRETO">Decreto Regional</option>
                    <option value="OTRO">Otro Documento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Número de Documento</label>
                  <input
                    type="text"
                    value={formDocNumber}
                    onChange={(e) => setFormDocNumber(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Fecha del Documento</label>
                  <input
                    type="date"
                    value={formDocDate}
                    onChange={(e) => setFormDocDate(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Fecha de Término</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Guardar Cambios</span>
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-6">
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Ficha Oficial de Encargatura Temporal DRAC</h3>
                  <p className="text-xs font-mono text-indigo-300">{selectedEncForView.document_number}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEncForView(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
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

              {/* Titular vs Encargado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Área permanente: {selectedEncForView.encargado_area_procedencia_name}
                  </div>
                </div>
              </div>

              {/* Vigencia & Documento */}
              <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <span className="text-xs font-bold text-slate-300">
                      Papeletas de Salida Autorizadas con este V°B° ({delegatedPapeletas.length})
                    </span>

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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
