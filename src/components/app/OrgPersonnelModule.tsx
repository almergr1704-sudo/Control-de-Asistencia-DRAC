import React, { useState } from 'react';
import {
  Building2,
  Users,
  Plus,
  Search,
  UserPlus,
  Shield,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Filter,
  Layers,
  Edit2,
  Trash2,
  X,
  UserCheck,
  Award,
  Crown,
  Building,
  MapPin,
  AlertTriangle,
  History,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Power,
  Key,
  ShieldCheck,
  UserCog,
  Check,
  HelpCircle,
  Info,
  Fingerprint,
  Save,
  FileSpreadsheet,
  Upload,
  Download,
  MoreVertical,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Cpu,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  ResponsableDesignation,
  Employee,
  RoleType,
  Horario,
  RegimenLaboral,
  CondicionLaboral,
  DependenciaType,
  OrganoType,
  EmployeeAssignmentHistory,
  Encargatura,
  PapeletaSalida,
  DispositivoZkTeco,
  MarcacionRaw,
  AttendanceRecord,
  Vacacion,
  ConsolidatedEmployeeProfile,
} from '../../types';
import { getApiUrl } from '../../utils/apiConfig';
import { syncEmployeeToDevice, disableUserOnDevice } from '../../utils/zktecoEngine';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { getEmployeeAssignedRoles } from '../../utils/encargaturaUtils';
import { hashPassword } from '../../utils/userAuthUtils';
import { BulkUploadModal } from './BulkUploadModal';
import {
  BulkUploadEntityType,
  generateTemplateDireccionesOrganos,
  generateTemplateAreasOficinas,
  generateTemplateTrabajadores,
  ValidationSummary,
} from '../../utils/bulkUploadUtils';
import { AdvancedSearchFilter, FilterField, FilterSelect, FilterDateRange } from '../common/AdvancedSearchFilter';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { EmptyState } from '../common/EmptyState';
import { normalizePersonName, normalizeInstitutionalName, normalizeText, buildNormalizedFullName, matchesSearch } from '../../utils/nameUtils';
import {
  EmployeeFormModal,
  SYSTEM_ROLES_CATALOG,
  getDependenciaTypeLabel,
  getOrganoTypeLabel,
  type SystemRoleDef,
} from './EmployeeFormModal';

export { SYSTEM_ROLES_CATALOG, getDependenciaTypeLabel, getOrganoTypeLabel, type SystemRoleDef };

interface OrgPersonnelModuleProps {
  activeView?: string;
  dependencias: Dependencia[];
  direccionesOrganos: DireccionOrgano[];
  areas: Area[];
  cargos: Cargo[];
  responsables?: ResponsableDesignation[];
  employees: Employee[];
  assignmentHistory?: EmployeeAssignmentHistory[];
  horarios: Horario[];
  activeRole: RoleType;
  encargaturas?: Encargatura[];
  papeletas?: PapeletaSalida[];
  devices?: DispositivoZkTeco[];
  rawPunches?: MarcacionRaw[];
  attendance?: AttendanceRecord[];
  vacaciones?: Vacacion[];

  onAddDependencia: (dep: Omit<Dependencia, 'id' | 'created_at'>) => void;
  onEditDependencia: (dep: Dependencia) => void;
  onDeleteDependencia: (id: string) => void;

  onAddDireccionOrgano: (dir: Omit<DireccionOrgano, 'id' | 'created_at'>) => void;
  onEditDireccionOrgano: (dir: DireccionOrgano) => void;
  onDeleteDireccionOrgano: (id: string) => void;

  onAddArea: (area: Omit<Area, 'id' | 'created_at'>) => void;
  onEditArea: (area: Area) => void;
  onDeleteArea: (id: string) => void;

  onAddCargo: (cargo: Omit<Cargo, 'id'>) => void;
  onEditCargo: (cargo: Cargo) => void;
  onDeleteCargo: (id: string) => void;

  onAddResponsable?: (resp: Omit<ResponsableDesignation, 'id'>) => void;
  onEditResponsable?: (resp: ResponsableDesignation) => void;
  onDeleteResponsable?: (id: string) => void;

  onAddEmployee: (employee: Omit<Employee, 'id'>) => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;

  onBulkImportDirecciones?: (validDirs: DireccionOrgano[], updateDirs: DireccionOrgano[], summary: ValidationSummary<DireccionOrgano>) => void;
  onBulkImportAreas?: (validAreas: Area[], updateAreas: Area[], summary: ValidationSummary<Area>) => void;
  onBulkImportTrabajadores?: (validEmps: Employee[], updateEmps: Employee[], summary: ValidationSummary<Employee>) => void;
}

export const OrgPersonnelModule: React.FC<OrgPersonnelModuleProps> = ({
  activeView,
  dependencias,
  direccionesOrganos,
  areas,
  cargos,
  responsables = [],
  employees,
  assignmentHistory = [],
  horarios,
  activeRole,
  encargaturas = [],
  papeletas = [],
  devices = [],
  rawPunches = [],
  attendance = [],
  vacaciones = [],
  onAddDependencia,
  onEditDependencia,
  onDeleteDependencia,
  onAddDireccionOrgano,
  onEditDireccionOrgano,
  onDeleteDireccionOrgano,
  onAddArea,
  onEditArea,
  onDeleteArea,
  onAddCargo,
  onEditCargo,
  onDeleteCargo,
  onAddResponsable,
  onEditResponsable,
  onDeleteResponsable,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onBulkImportDirecciones,
  onBulkImportAreas,
  onBulkImportTrabajadores,
}) => {
  const [activeTab, setActiveTab] = useState<
    'EMPLOYEES' | 'DEPENDENCIAS' | 'DIRECCIONES' | 'AREAS' | 'CARGOS' | 'RESPONSABLES' | 'CARGA_MASIVA'
  >('EMPLOYEES');

  // RBAC Permission Check: ADMIN_GENERAL, HR_ADMIN, and JEFE_RRHH can manage organizational and personnel records
  const canManageOrg = activeRole === 'ADMIN_GENERAL' || activeRole === 'HR_ADMIN' || activeRole === 'JEFE_RRHH';

  // BULK UPLOAD MODAL STATE
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInitialEntity, setBulkInitialEntity] = useState<BulkUploadEntityType>('DIRECCIONES');

  const openBulkUploadFor = (entity: BulkUploadEntityType) => {
    setBulkInitialEntity(entity);
    setShowBulkModal(true);
  };

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'org_deps') setActiveTab('DEPENDENCIAS');
    else if (activeView === 'org_dirs') setActiveTab('DIRECCIONES');
    else if (activeView === 'org_areas') setActiveTab('AREAS');
    else if (activeView === 'org_cargos') setActiveTab('CARGOS');
    else if (activeView === 'org_resps') setActiveTab('RESPONSABLES');
    else if (activeView === 'org_bulk') {
      setActiveTab('CARGA_MASIVA');
      setBulkInitialEntity('DIRECCIONES');
    } else if (activeView === 'personnel_list') setActiveTab('EMPLOYEES');
    else if (activeView === 'personnel_bulk') {
      setActiveTab('CARGA_MASIVA');
      setBulkInitialEntity('TRABAJADORES');
    } else if (activeView === 'personnel_new') {
      setActiveTab('EMPLOYEES');
      setEditingEmp(null);
      setShowEmpModal(true);
    } else if (activeView === 'personnel_assign' || activeView === 'personnel_history') {
      setActiveTab('EMPLOYEES');
    }
  }, [activeView]);

  // =========================================================================
  // TAB 1: EMPLOYEES SEARCH, MULTI-FILTER, SORTING & PAGINATION STATE
  // =========================================================================
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [empFilterDni, setEmpFilterDni] = useState('');
  const [empFilterRegimen, setEmpFilterRegimen] = useState<string>('ALL');
  const [empFilterCondicion, setEmpFilterCondicion] = useState<string>('ALL');
  const [empFilterCargo, setEmpFilterCargo] = useState<string>('ALL');
  const [empFilterDep, setEmpFilterDep] = useState<string>('ALL');
  const [empFilterDir, setEmpFilterDir] = useState<string>('ALL');
  const [empFilterArea, setEmpFilterArea] = useState<string>('ALL');
  const [empFilterEstado, setEmpFilterEstado] = useState<string>('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [empFilterRole, setEmpFilterRole] = useState<string>('ALL');
  const [empFilterIsJefe, setEmpFilterIsJefe] = useState<string>('ALL'); // 'ALL' | 'YES' | 'NO'
  const [empFilterHireDateStart, setEmpFilterHireDateStart] = useState<string>('');
  const [empFilterHireDateEnd, setEmpFilterHireDateEnd] = useState<string>('');

  const [empSortField, setEmpSortField] = useState<string | null>('first_name');
  const [empSortOrder, setEmpSortOrder] = useState<SortOrder>('asc');
  const [empCurrentPage, setEmpCurrentPage] = useState<number>(1);
  const [empPageSize, setEmpPageSize] = useState<number>(20);

  // Dependent cascading options for employees filter
  const availableDirsForEmpFilter = React.useMemo(() => {
    if (empFilterDep === 'ALL') return direccionesOrganos;
    return direccionesOrganos.filter((d) => d.dependencia_id === empFilterDep);
  }, [direccionesOrganos, empFilterDep]);

  const availableAreasForEmpFilter = React.useMemo(() => {
    return areas.filter((a) => {
      if (empFilterDep !== 'ALL' && a.dependencia_id && a.dependencia_id !== empFilterDep) return false;
      if (empFilterDir !== 'ALL' && a.direccion_organo_id && a.direccion_organo_id !== empFilterDir) return false;
      return true;
    });
  }, [areas, empFilterDep, empFilterDir]);

  const empActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (empFilterDni.trim()) count++;
    if (empFilterRegimen !== 'ALL') count++;
    if (empFilterCondicion !== 'ALL') count++;
    if (empFilterCargo !== 'ALL') count++;
    if (empFilterDep !== 'ALL') count++;
    if (empFilterDir !== 'ALL') count++;
    if (empFilterArea !== 'ALL') count++;
    if (empFilterEstado !== 'ALL') count++;
    if (empFilterRole !== 'ALL') count++;
    if (empFilterIsJefe !== 'ALL') count++;
    if (empFilterHireDateStart) count++;
    if (empFilterHireDateEnd) count++;
    return count;
  }, [
    empFilterDni,
    empFilterRegimen,
    empFilterCondicion,
    empFilterCargo,
    empFilterDep,
    empFilterDir,
    empFilterArea,
    empFilterEstado,
    empFilterRole,
    empFilterIsJefe,
    empFilterHireDateStart,
    empFilterHireDateEnd,
  ]);

  const handleResetEmpFilters = () => {
    setEmpSearchTerm('');
    setEmpFilterDni('');
    setEmpFilterRegimen('ALL');
    setEmpFilterCondicion('ALL');
    setEmpFilterCargo('ALL');
    setEmpFilterDep('ALL');
    setEmpFilterDir('ALL');
    setEmpFilterArea('ALL');
    setEmpFilterEstado('ALL');
    setEmpFilterRole('ALL');
    setEmpFilterIsJefe('ALL');
    setEmpFilterHireDateStart('');
    setEmpFilterHireDateEnd('');
    setEmpCurrentPage(1);
  };

  const handleEmpSort = (field: string) => {
    if (empSortField === field) {
      if (empSortOrder === 'asc') setEmpSortOrder('desc');
      else if (empSortOrder === 'desc') {
        setEmpSortField(null);
        setEmpSortOrder(null);
      }
    } else {
      setEmpSortField(field);
      setEmpSortOrder('asc');
    }
    setEmpCurrentPage(1);
  };

  const filteredEmployeesList = React.useMemo(() => {
    return employees.filter((emp) => {
      if (empSearchTerm.trim()) {
        const fullSearch = `${emp.first_name} ${emp.last_name} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.dni} ${emp.codigo_trabajador || ''} ${emp.position} ${emp.username || ''}`;
        if (!matchesSearch(fullSearch, empSearchTerm)) return false;
      }
      if (empFilterDni.trim() && !emp.dni.includes(empFilterDni.trim())) return false;
      if (empFilterRegimen !== 'ALL') {
        const normFilter = empFilterRegimen.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const normEmp = (emp.regimen_laboral || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (normFilter === 'DLEG276' || normFilter === 'DL276') {
          if (!normEmp.includes('276')) return false;
        } else if (normFilter === 'DLEG728' || normFilter === 'DL728') {
          if (!normEmp.includes('728')) return false;
        } else if (normFilter.includes('1057') || normFilter.includes('CAS')) {
          if (!normEmp.includes('1057') && !normEmp.includes('CAS')) return false;
        } else if (normFilter.includes('PRACTIC')) {
          if (!normEmp.includes('PRACTIC')) return false;
        } else if (emp.regimen_laboral !== empFilterRegimen) {
          return false;
        }
      }
      if (empFilterCondicion !== 'ALL' && emp.condicion_laboral !== empFilterCondicion) return false;
      if (empFilterCargo !== 'ALL' && emp.cargo_id !== empFilterCargo && emp.position !== empFilterCargo) return false;
      if (empFilterDep !== 'ALL' && emp.dependencia_id !== empFilterDep) return false;
      if (empFilterDir !== 'ALL' && emp.direccion_organo_id !== empFilterDir) return false;
      if (empFilterArea !== 'ALL' && emp.area_id !== empFilterArea) return false;
      if (empFilterEstado === 'ACTIVE' && !emp.active) return false;
      if (empFilterEstado === 'INACTIVE' && emp.active) return false;
      if (empFilterRole !== 'ALL') {
        const assigned = getEmployeeAssignedRoles(emp);
        if (emp.role !== empFilterRole && !assigned.includes(empFilterRole as RoleType)) return false;
      }
      if (empFilterIsJefe === 'YES' && !emp.is_jefe_director && emp.role !== 'JEFE') return false;
      if (empFilterIsJefe === 'NO' && (emp.is_jefe_director || emp.role === 'JEFE')) return false;
      if (empFilterHireDateStart && emp.hire_date < empFilterHireDateStart) return false;
      if (empFilterHireDateEnd && emp.hire_date > empFilterHireDateEnd) return false;
      return true;
    });
  }, [
    employees,
    empSearchTerm,
    empFilterDni,
    empFilterRegimen,
    empFilterCondicion,
    empFilterCargo,
    empFilterDep,
    empFilterDir,
    empFilterArea,
    empFilterEstado,
    empFilterRole,
    empFilterIsJefe,
    empFilterHireDateStart,
    empFilterHireDateEnd,
  ]);

  const sortedEmployeesList = React.useMemo(() => {
    if (!empSortField || !empSortOrder) return filteredEmployeesList;
    return [...filteredEmployeesList].sort((a, b) => {
      let valA: any = a[empSortField as keyof Employee] ?? '';
      let valB: any = b[empSortField as keyof Employee] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return empSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return empSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEmployeesList, empSortField, empSortOrder]);

  const paginatedEmployeesList = React.useMemo(() => {
    const start = (empCurrentPage - 1) * empPageSize;
    return sortedEmployeesList.slice(start, start + empPageSize);
  }, [sortedEmployeesList, empCurrentPage, empPageSize]);

  // =========================================================================
  // TAB 2: DEPENDENCIAS STATE
  // =========================================================================
  const [depSearchTerm, setDepSearchTerm] = useState('');
  const [depFilterType, setDepFilterType] = useState<string>('ALL');
  const [depFilterStatus, setDepFilterStatus] = useState<string>('ALL');
  const [depSortField, setDepSortField] = useState<string | null>('code');
  const [depSortOrder, setDepSortOrder] = useState<SortOrder>('asc');
  const [depCurrentPage, setDepCurrentPage] = useState<number>(1);
  const [depPageSize, setDepPageSize] = useState<number>(20);

  const depActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (depFilterType !== 'ALL') count++;
    if (depFilterStatus !== 'ALL') count++;
    return count;
  }, [depFilterType, depFilterStatus]);

  const handleResetDepFilters = () => {
    setDepSearchTerm('');
    setDepFilterType('ALL');
    setDepFilterStatus('ALL');
    setDepCurrentPage(1);
  };

  const filteredDepsList = React.useMemo(() => {
    return dependencias.filter((dep) => {
      if (depSearchTerm.trim()) {
        const term = depSearchTerm.toLowerCase().trim();
        const match = `${dep.code} ${dep.name} ${dep.address || ''} ${dep.type}`.toLowerCase();
        if (!match.includes(term)) return false;
      }
      if (depFilterType !== 'ALL' && dep.type !== depFilterType) return false;
      if (depFilterStatus === 'ACTIVE' && dep.active === false) return false;
      if (depFilterStatus === 'INACTIVE' && dep.active !== false) return false;
      return true;
    });
  }, [dependencias, depSearchTerm, depFilterType, depFilterStatus]);

  const sortedDepsList = React.useMemo(() => {
    if (!depSortField || !depSortOrder) return filteredDepsList;
    return [...filteredDepsList].sort((a, b) => {
      let valA: any = a[depSortField as keyof Dependencia] ?? '';
      let valB: any = b[depSortField as keyof Dependencia] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return depSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return depSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDepsList, depSortField, depSortOrder]);

  const paginatedDepsList = React.useMemo(() => {
    const start = (depCurrentPage - 1) * depPageSize;
    return sortedDepsList.slice(start, start + depPageSize);
  }, [sortedDepsList, depCurrentPage, depPageSize]);

  // =========================================================================
  // TAB 3: DIRECCIONES Y ÓRGANOS STATE
  // =========================================================================
  const [dirSearchTerm, setDirSearchTerm] = useState('');
  const [dirFilterType, setDirFilterType] = useState<string>('ALL');
  const [dirFilterDep, setDirFilterDep] = useState<string>('ALL');
  const [dirSortField, setDirSortField] = useState<string | null>('code');
  const [dirSortOrder, setDirSortOrder] = useState<SortOrder>('asc');
  const [dirCurrentPage, setDirCurrentPage] = useState<number>(1);
  const [dirPageSize, setDirPageSize] = useState<number>(20);

  const dirActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (dirFilterType !== 'ALL') count++;
    if (dirFilterDep !== 'ALL') count++;
    return count;
  }, [dirFilterType, dirFilterDep]);

  const handleResetDirFilters = () => {
    setDirSearchTerm('');
    setDirFilterType('ALL');
    setDirFilterDep('ALL');
    setDirCurrentPage(1);
  };

  const filteredDirsList = React.useMemo(() => {
    return direccionesOrganos.filter((dir) => {
      if (dirSearchTerm.trim()) {
        const term = dirSearchTerm.toLowerCase().trim();
        const match = `${dir.code} ${dir.name} ${dir.dependencia_name || ''} ${dir.type}`.toLowerCase();
        if (!match.includes(term)) return false;
      }
      if (dirFilterType !== 'ALL' && dir.type !== dirFilterType) return false;
      if (dirFilterDep !== 'ALL' && dir.dependencia_id !== dirFilterDep) return false;
      return true;
    });
  }, [direccionesOrganos, dirSearchTerm, dirFilterType, dirFilterDep]);

  const sortedDirsList = React.useMemo(() => {
    if (!dirSortField || !dirSortOrder) return filteredDirsList;
    return [...filteredDirsList].sort((a, b) => {
      let valA: any = a[dirSortField as keyof DireccionOrgano] ?? '';
      let valB: any = b[dirSortField as keyof DireccionOrgano] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return dirSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return dirSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDirsList, dirSortField, dirSortOrder]);

  const paginatedDirsList = React.useMemo(() => {
    const start = (dirCurrentPage - 1) * dirPageSize;
    return sortedDirsList.slice(start, start + dirPageSize);
  }, [sortedDirsList, dirCurrentPage, dirPageSize]);

  // =========================================================================
  // TAB 4: ÁREAS Y OFICINAS STATE
  // =========================================================================
  const [areaSearchTerm, setAreaSearchTerm] = useState('');
  const [areaFilterDep, setAreaFilterDep] = useState<string>('ALL');
  const [areaFilterDir, setAreaFilterDir] = useState<string>('ALL');
  const [areaSortField, setAreaSortField] = useState<string | null>('code');
  const [areaSortOrder, setAreaSortOrder] = useState<SortOrder>('asc');
  const [areaCurrentPage, setAreaCurrentPage] = useState<number>(1);
  const [areaPageSize, setAreaPageSize] = useState<number>(20);

  const areaActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (areaFilterDep !== 'ALL') count++;
    if (areaFilterDir !== 'ALL') count++;
    return count;
  }, [areaFilterDep, areaFilterDir]);

  const handleResetAreaFilters = () => {
    setAreaSearchTerm('');
    setAreaFilterDep('ALL');
    setAreaFilterDir('ALL');
    setAreaCurrentPage(1);
  };

  const filteredAreasList = React.useMemo(() => {
    return areas.filter((area) => {
      if (areaSearchTerm.trim()) {
        const term = areaSearchTerm.toLowerCase().trim();
        const match = `${area.code} ${area.name} ${area.description || ''} ${area.dependencia_name || ''} ${area.direccion_organo_name || ''}`.toLowerCase();
        if (!match.includes(term)) return false;
      }
      if (areaFilterDep !== 'ALL' && area.dependencia_id && area.dependencia_id !== areaFilterDep) return false;
      if (areaFilterDir !== 'ALL' && area.direccion_organo_id && area.direccion_organo_id !== areaFilterDir) return false;
      return true;
    });
  }, [areas, areaSearchTerm, areaFilterDep, areaFilterDir]);

  const sortedAreasList = React.useMemo(() => {
    if (!areaSortField || !areaSortOrder) return filteredAreasList;
    return [...filteredAreasList].sort((a, b) => {
      let valA: any = a[areaSortField as keyof Area] ?? '';
      let valB: any = b[areaSortField as keyof Area] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return areaSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return areaSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAreasList, areaSortField, areaSortOrder]);

  const paginatedAreasList = React.useMemo(() => {
    const start = (areaCurrentPage - 1) * areaPageSize;
    return sortedAreasList.slice(start, start + areaPageSize);
  }, [sortedAreasList, areaCurrentPage, areaPageSize]);

  // =========================================================================
  // TAB 5: CARGOS STATE
  // =========================================================================
  const [cargoSearchTerm, setCargoSearchTerm] = useState('');
  const [cargoFilterNivel, setCargoFilterNivel] = useState<string>('ALL');
  const [cargoSortField, setCargoSortField] = useState<string | null>('name');
  const [cargoSortOrder, setCargoSortOrder] = useState<SortOrder>('asc');
  const [cargoCurrentPage, setCargoCurrentPage] = useState<number>(1);
  const [cargoPageSize, setCargoPageSize] = useState<number>(20);

  const cargoActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (cargoFilterNivel !== 'ALL') count++;
    return count;
  }, [cargoFilterNivel]);

  const handleResetCargoFilters = () => {
    setCargoSearchTerm('');
    setCargoFilterNivel('ALL');
    setCargoCurrentPage(1);
  };

  const filteredCargosList = React.useMemo(() => {
    return cargos.filter((c) => {
      if (cargoSearchTerm.trim()) {
        const term = cargoSearchTerm.toLowerCase().trim();
        const match = `${c.code} ${c.name} ${c.nivel || ''}`.toLowerCase();
        if (!match.includes(term)) return false;
      }
      if (cargoFilterNivel !== 'ALL' && c.nivel !== cargoFilterNivel) return false;
      return true;
    });
  }, [cargos, cargoSearchTerm, cargoFilterNivel]);

  const sortedCargosList = React.useMemo(() => {
    if (!cargoSortField || !cargoSortOrder) return filteredCargosList;
    return [...filteredCargosList].sort((a, b) => {
      let valA: any = a[cargoSortField as keyof Cargo] ?? '';
      let valB: any = b[cargoSortField as keyof Cargo] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return cargoSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return cargoSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCargosList, cargoSortField, cargoSortOrder]);

  const paginatedCargosList = React.useMemo(() => {
    const start = (cargoCurrentPage - 1) * cargoPageSize;
    return sortedCargosList.slice(start, start + cargoPageSize);
  }, [sortedCargosList, cargoCurrentPage, cargoPageSize]);

  // =========================================================================
  // TAB 6: JEFES Y APROBADORES (AUTOMATIZADO DESDE PERFIL JEFE INMEDIATO)
  // =========================================================================
  const [jefeSearchTerm, setJefeSearchTerm] = useState('');
  const [jefeFilterDir, setJefeFilterDir] = useState<string>('ALL');
  const [jefeFilterSource, setJefeFilterSource] = useState<string>('ALL'); // 'ALL' | 'TITULAR' | 'ENCARGATURA'
  const [jefeFilterStatus, setJefeFilterStatus] = useState<string>('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [jefeSortField, setJefeSortField] = useState<string | null>('first_name');
  const [jefeSortOrder, setJefeSortOrder] = useState<SortOrder>('asc');
  const [jefeCurrentPage, setJefeCurrentPage] = useState<number>(1);
  const [jefePageSize, setJefePageSize] = useState<number>(20);

  // Detail Modal for Jefe / Aprobador
  const [selectedJefeForDetail, setSelectedJefeForDetail] = useState<{
    employee: Employee;
    isDirectRole: boolean;
    isAssignedRole: boolean;
    isEncargado: boolean;
    activeEncargatura?: Encargatura;
    source: 'TITULAR' | 'ENCARGATURA';
    dirName: string;
    areaName: string;
    supervisedEmployees: Employee[];
    pendingPapeletasCount: number;
  } | null>(null);

  // Detail Modal for Employee (Directorio de Personal - Ficha Integral)
  const [selectedEmpForDetail, setSelectedEmpForDetail] = useState<Employee | null>(null);
  const [empProfileData, setEmpProfileData] = useState<ConsolidatedEmployeeProfile | null>(null);
  const [empProfileLoading, setEmpProfileLoading] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'GENERAL' | 'BIOMETRICO' | 'ASISTENCIA'>('GENERAL');
  const [openEmpActionMenuId, setOpenEmpActionMenuId] = useState<string | null>(null);

  const canViewSensitivePersonal = [
    'ADMIN_GENERAL',
    'HR_ADMIN',
    'JEFE_RRHH',
    'DIRECTOR_GENERAL',
    'CONTROL_ASISTENCIA',
    'JEFE',
    'SUPERVISOR',
  ].includes(activeRole);

  React.useEffect(() => {
    if (!selectedEmpForDetail) {
      setEmpProfileData(null);
      return;
    }
    setProfileModalTab('GENERAL');
    let cancelled = false;
    const emp = selectedEmpForDetail;

    const buildFallbackProfile = (): ConsolidatedEmployeeProfile => {
      const empPunches = rawPunches
        .filter(
          (p) =>
            p.employee_id === emp.id ||
            p.employee_dni === emp.dni ||
            (emp.zkteco_pin && p.employee_code === emp.zkteco_pin)
        )
        .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      const empAtt = attendance
        .filter((a) => a.employee_id === emp.id || a.employee_dni === emp.dni)
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
      const empPaps = papeletas.filter((p) => p.employee_id === emp.id || p.employee_dni === emp.dni);
      const empVacs = vacaciones.filter((v) => v.employee_id === emp.id || v.employee_dni === emp.dni);
      const assignedHor = horarios.find((h) => h.id === emp.schedule_id) || horarios[0];
      const entradas = empPunches.filter((p) => p.punch_state !== 1 && p.punch_type !== 'CHECK_OUT').length;
      const salidas = empPunches.length - entradas;
      const diasAsistencia = new Set(empAtt.filter((a) => a.status !== 'ABSENT').map((a) => a.fecha)).size;
      const tardanzaDias = empAtt.filter((a) => a.status === 'LATE' || (a.net_tardiness_minutes || 0) > 0).length;
      const tardanzaMin = empAtt.reduce((s, a) => s + Number(a.net_tardiness_minutes || a.total_tardiness_minutes || 0), 0);
      const inasistencias = empAtt.filter((a) => a.status === 'ABSENT').length;
      const horas = empAtt.reduce((s, a) => s + Number(a.total_effective_hours ?? 0), 0);
      const depMeta = dependencias.find((d) => d.id === emp.dependencia_id);
      return {
        personal: {
          id: emp.id,
          dni: emp.dni,
          codigo_drac: emp.codigo_trabajador || '',
          first_name: emp.first_name,
          last_name: emp.last_name,
          full_name: normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim()),
          email: emp.email || '',
          phone: canViewSensitivePersonal ? emp.phone || '' : undefined,
          active: emp.active !== false,
          hire_date: emp.hire_date || null,
        },
        institucional: {
          sede_dependencia: emp.dependencia_name || depMeta?.name || 'Sede Central DRAC',
          dependencia_tipo: depMeta?.type || 'SEDE_CENTRAL',
          agencia_agraria: depMeta?.type === 'AGENCIA_AGRARIA' ? emp.dependencia_name || depMeta.name : null,
          direccion_organo: emp.direccion_organo_name || 'Sin Dirección Asignada',
          area_oficina: emp.area_name || 'Sin Área',
          subarea: emp.subarea_name || null,
          cargo: emp.position || 'Servidor Público',
          regimen_laboral: emp.regimen_laboral,
          condicion_laboral: emp.condicion_laboral,
          supervisor_name: emp.supervisor_name || null,
          horario_asignado: {
            id: assignedHor?.id || emp.schedule_id || 'hor-01',
            code: assignedHor?.code,
            name: emp.schedule_name || assignedHor?.name || 'Horario Institucional DRAC',
            turno1: assignedHor?.turno1_name || null,
            turno2: assignedHor?.turno2_name || null,
            working_days: assignedHor?.working_days,
          },
        },
        biometrico: {
          pin_principal: emp.zkteco_pin || emp.biometric_user_id || emp.dni,
          estado_vinculacion: emp.biometric_sync_status || (emp.zkteco_pin ? 'SINCRONIZADO' : 'NO_REGISTRADO'),
          fecha_vinculacion: emp.biometric_last_sync || null,
          dispositivos_vinculados: emp.biometric_sync_device_id
            ? [
                {
                  id: `${emp.biometric_sync_device_id}__${emp.zkteco_pin || emp.dni}`,
                  device_id: emp.biometric_sync_device_id,
                  device_sn:
                    devices.find((d) => d.id === emp.biometric_sync_device_id)?.serial_number || 'AEH2223460040',
                  device_name: emp.biometric_sync_device_name || 'Reloj Biométrico DRAC',
                  pin: emp.zkteco_pin || emp.biometric_user_id || emp.dni,
                  link_status: 'VINCULADO',
                  linked_at: emp.biometric_last_sync || null,
                  present_on_device: true,
                },
              ]
            : [],
        },
        asistencia: {
          resumen: {
            total_marcaciones: empPunches.length,
            entradas,
            salidas,
            dias_asistencia: diasAsistencia,
            tardanzas_dias: tardanzaDias,
            tardanzas_minutos_netos: tardanzaMin,
            inasistencias,
            horas_trabajadas: Number(horas.toFixed(1)),
            papeletas_total: empPaps.length,
            vacaciones_total: empVacs.length,
          },
          marcaciones_recientes: empPunches.slice(0, 12),
          asistencia_reciente: empAtt.slice(0, 12),
          papeletas: empPaps.slice(0, 10),
          vacaciones: empVacs.slice(0, 10),
        },
      };
    };

    setEmpProfileData(buildFallbackProfile());
    setEmpProfileLoading(true);
    fetch(
      getApiUrl(`/api/employees/${encodeURIComponent(emp.id)}/profile?viewerRole=${encodeURIComponent(activeRole)}`)
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const resolvedProfile = json?.data || json?.profile;
        if (!cancelled && json?.success && resolvedProfile) {
          setEmpProfileData(resolvedProfile);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEmpProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEmpForDetail, activeRole, rawPunches, attendance, papeletas, vacaciones, horarios, devices, dependencias]);

  // Biometric Synchronization state
  const [syncingEmpId, setSyncingEmpId] = useState<string | null>(null);
  const [selectedSyncDeviceId, setSelectedSyncDeviceId] = useState<string>('dev-01');
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    message: string;
    biometric_user_id?: string;
    device_name?: string;
    timestamp?: string;
  } | null>(null);

  // Mass Biometric Sync in Personnel module
  const [selectedWorkerIdsForSync, setSelectedWorkerIdsForSync] = useState<Set<string>>(new Set());
  const [isMassSyncModalOpen, setIsMassSyncModalOpen] = useState(false);
  const [isMassSyncing, setIsMassSyncing] = useState(false);
  const [massSyncProgress, setMassSyncProgress] = useState<{ total: number; done: number; success: number; failed: number } | null>(null);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [orgActionFeedback, setOrgActionFeedback] = useState<string | null>(null);

  const todayDateStr = new Date().toISOString().split('T')[0];

  // Derived list of all Jefes and Aprobadores based strictly on system profile JEFE INMEDIATO or active encargatura
  const allJefesAprobadoresList = React.useMemo(() => {
    return employees
      .map((emp) => {
        const assignedRoles = getEmployeeAssignedRoles(emp);
        const isDirectRole = emp.role === 'JEFE' || emp.role === 'SUPERVISOR';
        const isAssignedRole = assignedRoles.includes('JEFE') || assignedRoles.includes('SUPERVISOR');

        const activeEnc = (encargaturas || []).find(
          (enc) =>
            enc.encargado_employee_id === emp.id &&
            enc.status === 'VIGENTE' &&
            enc.start_date <= todayDateStr &&
            enc.end_date >= todayDateStr
        );

        const isEncargado = Boolean(activeEnc);

        // Strict criterion: must have profile JEFE INMEDIATO or active encargatura
        if (!isDirectRole && !isAssignedRole && !isEncargado) {
          return null;
        }

        const source: 'TITULAR' | 'ENCARGATURA' = isEncargado ? 'ENCARGATURA' : 'TITULAR';
        const dirName =
          activeEnc?.direccion_organo_name ||
          emp.direccion_organo_name ||
          emp.dependencia_name ||
          'Sede Central DRAC';
        const areaName =
          activeEnc?.area_name ||
          emp.area_name ||
          (emp.is_jefe_director || isDirectRole ? 'Toda la Dirección / Unidad' : 'Área Asignada');

        const supervisedList = employees.filter((sub) => {
          if (sub.id === emp.id) return false;
          if (sub.supervisor_id === emp.id) return true;
          if (emp.direccion_organo_id && sub.direccion_organo_id === emp.direccion_organo_id) {
            if (!emp.area_id || sub.area_id === emp.area_id) return true;
          }
          if (activeEnc && activeEnc.direccion_organo_id && sub.direccion_organo_id === activeEnc.direccion_organo_id) {
            if (!activeEnc.area_id || sub.area_id === activeEnc.area_id) return true;
          }
          return false;
        });

        const pendingPapeletas = (papeletas || []).filter(
          (p) =>
            (p.status === 'PENDING_BOSS' || p.status === 'PENDING_HR') &&
            (p.supervisor_id === emp.id ||
              (emp.direccion_organo_id && p.direccion_organo_id === emp.direccion_organo_id) ||
              (activeEnc && activeEnc.direccion_organo_id === p.direccion_organo_id))
        ).length;

        return {
          employee: emp,
          isDirectRole,
          isAssignedRole,
          isEncargado,
          activeEncargatura: activeEnc,
          source,
          dirName,
          areaName,
          supervisedEmployees: supervisedList,
          pendingPapeletasCount: pendingPapeletas,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [employees, encargaturas, papeletas, todayDateStr]);

  const jefeActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (jefeFilterDir !== 'ALL') count++;
    if (jefeFilterSource !== 'ALL') count++;
    if (jefeFilterStatus !== 'ALL') count++;
    return count;
  }, [jefeFilterDir, jefeFilterSource, jefeFilterStatus]);

  const handleResetJefeFilters = () => {
    setJefeSearchTerm('');
    setJefeFilterDir('ALL');
    setJefeFilterSource('ALL');
    setJefeFilterStatus('ALL');
    setJefeCurrentPage(1);
  };

  const handleJefeSort = (field: string) => {
    if (jefeSortField === field) {
      if (jefeSortOrder === 'asc') setJefeSortOrder('desc');
      else if (jefeSortOrder === 'desc') {
        setJefeSortField(null);
        setJefeSortOrder(null);
      }
    } else {
      setJefeSortField(field);
      setJefeSortOrder('asc');
    }
    setJefeCurrentPage(1);
  };

  const filteredJefesList = React.useMemo(() => {
    return allJefesAprobadoresList.filter((item) => {
      const { employee: emp, source, dirName, areaName } = item;
      if (jefeSearchTerm.trim()) {
        const searchStr = `${emp.codigo_trabajador || ''} ${emp.first_name} ${emp.last_name} ${emp.dni} ${emp.position} ${dirName} ${areaName}`;
        if (!matchesSearch(searchStr, jefeSearchTerm)) return false;
      }
      if (
        jefeFilterDir !== 'ALL' &&
        emp.direccion_organo_id !== jefeFilterDir &&
        item.activeEncargatura?.direccion_organo_id !== jefeFilterDir
      ) {
        return false;
      }
      if (jefeFilterSource !== 'ALL' && source !== jefeFilterSource) return false;
      if (jefeFilterStatus === 'ACTIVE' && !emp.active) return false;
      if (jefeFilterStatus === 'INACTIVE' && emp.active) return false;
      return true;
    });
  }, [allJefesAprobadoresList, jefeSearchTerm, jefeFilterDir, jefeFilterSource, jefeFilterStatus]);

  const sortedJefesList = React.useMemo(() => {
    if (!jefeSortField || !jefeSortOrder) return filteredJefesList;
    return [...filteredJefesList].sort((a, b) => {
      let valA: any = a.employee[jefeSortField as keyof Employee] ?? '';
      let valB: any = b.employee[jefeSortField as keyof Employee] ?? '';
      if (jefeSortField === 'dirName') {
        valA = a.dirName;
        valB = b.dirName;
      }
      if (jefeSortField === 'areaName') {
        valA = a.areaName;
        valB = b.areaName;
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return jefeSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return jefeSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredJefesList, jefeSortField, jefeSortOrder]);

  const paginatedJefesList = React.useMemo(() => {
    const start = (jefeCurrentPage - 1) * jefePageSize;
    return sortedJefesList.slice(start, start + jefePageSize);
  }, [sortedJefesList, jefeCurrentPage, jefePageSize]);

  // Backward compatibility for legacy props
  const respSearchTerm = jefeSearchTerm;
  const respFilterUnitType = 'ALL';
  const respActiveFilterCount = 0;
  const handleResetRespFilters = handleResetJefeFilters;
  const paginatedRespList: any[] = [];
  const filteredRespList: any[] = [];
  const respCurrentPage = 1;
  const respPageSize = 20;
  const setRespSearchTerm = setJefeSearchTerm;
  const setRespFilterUnitType = () => {};
  const setRespCurrentPage = setJefeCurrentPage;
  const setRespPageSize = setJefePageSize;

  // DATA POLICY CONFIRM MODAL STATE
  const [confirmModalConfig, setConfirmModalConfig] = useState<DataPolicyConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'DEACTIVATE',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // ASSIGNMENT HISTORY MODAL STATE
  const [selectedEmpForHistory, setSelectedEmpForHistory] = useState<Employee | null>(null);

  // POLICY SUMMARY MODAL
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // MODAL STATES
  const [showDepModal, setShowDepModal] = useState(false);
  const [editingDep, setEditingDep] = useState<Dependencia | null>(null);

  const [showDirModal, setShowDirModal] = useState(false);
  const [editingDir, setEditingDir] = useState<DireccionOrgano | null>(null);

  const [showAreaModal, setShowAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  const [showCargoModal, setShowCargoModal] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);

  const [showRespModal, setShowRespModal] = useState(false);
  const [editingResp, setEditingResp] = useState<ResponsableDesignation | null>(null);

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // FORM STATES: Dependencia
  const [depCode, setDepCode] = useState('');
  const [depName, setDepName] = useState('');
  const [depType, setDepType] = useState<DependenciaType>('SEDE_CENTRAL');
  const [depAddress, setDepAddress] = useState('');

  // FORM STATES: Dirección / Órgano
  const [dirCode, setDirCode] = useState('');
  const [dirName, setDirName] = useState('');
  const [dirType, setDirType] = useState<OrganoType>('DIRECCION');
  const [dirDepId, setDirDepId] = useState('');

  // FORM STATES: Area / Oficina
  const [areaCode, setAreaCode] = useState('');
  const [areaName, setAreaName] = useState('');
  const [areaTipo, setAreaTipo] = useState<'AREA' | 'OFICINA' | 'UNIDAD_FUNCIONAL' | 'SUB_AREA'>('AREA');
  const [areaDesc, setAreaDesc] = useState('');
  const [areaDepId, setAreaDepId] = useState('');
  const [areaDirId, setAreaDirId] = useState('');
  const [areaActive, setAreaActive] = useState(true);
  const [parentAreaId, setParentAreaId] = useState('');

  // FORM STATES: Cargo
  const [cargoCode, setCargoCode] = useState('');
  const [cargoName, setCargoName] = useState('');
  const [cargoNivel, setCargoNivel] = useState('F-3 / Ejecutivo');

  // FORM STATES: Responsable
  const [respEmpId, setRespEmpId] = useState('');
  const [respTitle, setRespTitle] = useState<'DIRECTOR' | 'JEFE' | 'RESPONSABLE' | 'ENCARGADO'>('DIRECTOR');
  const [respUnitType, setRespUnitType] = useState<'DEPENDENCIA' | 'DIRECCION_ORGANO' | 'AREA_OFICINA'>('DIRECCION_ORGANO');
  const [respUnitId, setRespUnitId] = useState('');
  const [respStartDate, setRespStartDate] = useState(new Date().toISOString().split('T')[0]);

  // FORM STATES: Perfil de Acceso Modal (solo lectura/auditoría)
  const [selectedEmpForRoleModal, setSelectedEmpForRoleModal] = useState<Employee | null>(null);

  // RESET PASSWORD MODAL STATE (ADMIN / HR)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedEmpForPasswordReset, setSelectedEmpForPasswordReset] = useState<Employee | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('123456');
  const [showResetPasswordEye, setShowResetPasswordEye] = useState(false);

  // --- HANDLERS FOR MODALS & SUBMITS ---
  
  // Dependencia submit
  const handleSubmitDependencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depCode || !depName) return;

    if (editingDep) {
      onEditDependencia({
        ...editingDep,
        code: depCode.trim().toUpperCase(),
        name: normalizeInstitutionalName(depName.trim()),
        type: depType,
        address: normalizeText(depAddress.trim()),
      });
    } else {
      onAddDependencia({
        code: depCode.trim().toUpperCase(),
        name: normalizeInstitutionalName(depName.trim()),
        type: depType,
        address: normalizeText(depAddress.trim()),
        active: true,
      });
    }
    setShowDepModal(false);
  };

  // Dirección/Órgano submit
  const handleSubmitDireccionOrgano = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirCode || !dirName || !dirDepId) {
      alert('Error: Debe seleccionar una Dependencia institucional.');
      return;
    }
    const selectedDep = dependencias.find((d) => d.id === dirDepId);

    if (editingDir) {
      onEditDireccionOrgano({
        ...editingDir,
        code: dirCode.trim().toUpperCase(),
        name: normalizeInstitutionalName(dirName.trim()),
        type: dirType,
        dependencia_id: dirDepId,
        dependencia_name: selectedDep ? normalizeInstitutionalName(selectedDep.name) : 'Sede Central DRAC',
      });
    } else {
      onAddDireccionOrgano({
        code: dirCode.trim().toUpperCase(),
        name: normalizeInstitutionalName(dirName.trim()),
        type: dirType,
        dependencia_id: dirDepId,
        dependencia_name: selectedDep ? normalizeInstitutionalName(selectedDep.name) : 'Sede Central DRAC',
        active: true,
      });
    }
    setShowDirModal(false);
  };

  // Area submit
  const handleSubmitArea = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = normalizeInstitutionalName(areaName.trim());
    if (!cleanName) {
      alert('⚠️ Error de Validación:\nEl Nombre del Área / Oficina es obligatorio.');
      return;
    }

    if (!areaDirId) {
      alert('⚠️ Error de Validación:\nDebe seleccionar la Dirección, Órgano de Apoyo u Oficina Agraria a la que pertenece esta Área/Oficina.');
      return;
    }

    const selectedDir = direccionesOrganos.find((d) => d.id === areaDirId);
    if (!selectedDir) {
      alert('⚠️ Error de Validación:\nDebe seleccionar la Dirección, Órgano de Apoyo u Oficina Agraria a la que pertenece esta Área/Oficina.');
      return;
    }

    const cleanCode = areaCode.trim().toUpperCase() || `ARE-${String(areas.length + 1).padStart(3, '0')}`;
    const selectedDep = dependencias.find((d) => d.id === (selectedDir.dependencia_id || areaDepId)) || dependencias[0];
    const parentArea = areas.find((a) => a.id === parentAreaId);

    if (editingArea) {
      onEditArea({
        ...editingArea,
        code: cleanCode,
        name: cleanName,
        tipo: areaTipo,
        description: normalizeText(areaDesc.trim() || `${areaTipo === 'OFICINA' ? 'Oficina' : 'Área'} adscrita a ${selectedDir.name}`),
        dependencia_id: selectedDir.dependencia_id || selectedDep?.id,
        dependencia_name: normalizeInstitutionalName(selectedDir.dependencia_name || selectedDep?.name),
        direccion_organo_id: selectedDir.id,
        direccion_organo_name: normalizeInstitutionalName(selectedDir.name),
        unidad_superior_id: selectedDir.id,
        parent_area_id: parentAreaId || null,
        parent_area_name: parentArea ? normalizeInstitutionalName(parentArea.name) : undefined,
        active: areaActive,
      });
    } else {
      onAddArea({
        code: cleanCode,
        name: cleanName,
        tipo: areaTipo,
        description: normalizeText(areaDesc.trim() || `${areaTipo === 'OFICINA' ? 'Oficina' : 'Área'} adscrita a ${selectedDir.name}`),
        dependencia_id: selectedDir.dependencia_id || selectedDep?.id,
        dependencia_name: normalizeInstitutionalName(selectedDir.dependencia_name || selectedDep?.name),
        direccion_organo_id: selectedDir.id,
        direccion_organo_name: normalizeInstitutionalName(selectedDir.name),
        unidad_superior_id: selectedDir.id,
        parent_area_id: parentAreaId || null,
        parent_area_name: parentArea ? normalizeInstitutionalName(parentArea.name) : undefined,
        active: areaActive,
      });
    }
    setShowAreaModal(false);
  };

  // Cargo submit
  const handleSubmitCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoCode || !cargoName) return;

    if (editingCargo) {
      onEditCargo({
        ...editingCargo,
        code: cargoCode.trim().toUpperCase(),
        name: normalizeInstitutionalName(cargoName.trim()),
        nivel: cargoNivel,
      });
    } else {
      onAddCargo({
        code: cargoCode.trim().toUpperCase(),
        name: normalizeInstitutionalName(cargoName.trim()),
        nivel: cargoNivel,
        active: true,
      });
    }
    setShowCargoModal(false);
  };

  // Responsable submit
  const handleSubmitResponsable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respEmpId || !respUnitId) {
      alert('Error: Debe seleccionar un trabajador y una unidad organizacional.');
      return;
    }
    const emp = employees.find((e) => e.id === respEmpId);
    if (!emp) return;

    let unitName = 'Unidad';
    if (respUnitType === 'DEPENDENCIA') {
      unitName = dependencias.find((d) => d.id === respUnitId)?.name || 'Dependencia';
    } else if (respUnitType === 'DIRECCION_ORGANO') {
      unitName = direccionesOrganos.find((d) => d.id === respUnitId)?.name || 'Dirección/Órgano';
    } else {
      unitName = areas.find((a) => a.id === respUnitId)?.name || 'Área/Oficina';
    }

    if (editingResp) {
      onEditResponsable({
        ...editingResp,
        employee_id: emp.id,
        employee_dni: emp.dni,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        title: respTitle,
        unit_type: respUnitType,
        unit_id: respUnitId,
        unit_name: unitName,
        start_date: respStartDate,
      });
    } else {
      onAddResponsable({
        employee_id: emp.id,
        employee_dni: emp.dni,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        title: respTitle,
        unit_type: respUnitType,
        unit_id: respUnitId,
        unit_name: unitName,
        start_date: respStartDate,
        active: true,
      });
    }
    setShowRespModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Module Title Header Banner */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              {activeTab === 'EMPLOYEES' && 'Directorio de Personal DRAC'}
              {activeTab === 'DEPENDENCIAS' && 'Gestión de Dependencias DRAC'}
              {activeTab === 'DIRECCIONES' && 'Direcciones y Órganos de Línea'}
              {activeTab === 'AREAS' && 'Áreas y Oficinas Institucionales'}
              {activeTab === 'CARGOS' && 'Cargos Institucionales'}
              {activeTab === 'RESPONSABLES' && 'Jefes y Aprobadores (Responsables)'}
              {activeTab === 'CARGA_MASIVA' && 'Carga Masiva de Información (Excel .xlsx)'}
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">
              CAJAMARCA REGIONAL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión institucional jerárquica de la Dirección Regional de Agricultura Cajamarca.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('CARGA_MASIVA')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'CARGA_MASIVA'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Carga Masiva Excel</span>
          </button>

          <button
            onClick={() => setShowPolicyModal(true)}
            className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Política de Integridad</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('EMPLOYEES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'EMPLOYEES'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Directorio de Personal ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DEPENDENCIAS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'DEPENDENCIAS'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Dependencias ({dependencias.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DIRECCIONES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'DIRECCIONES'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Direcciones / Órganos ({direccionesOrganos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AREAS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'AREAS'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Áreas / Oficinas ({areas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CARGOS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'CARGOS'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Cargos ({cargos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RESPONSABLES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'RESPONSABLES'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Jefes / Aprobadores ({allJefesAprobadoresList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CARGA_MASIVA')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'CARGA_MASIVA'
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/40'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Carga Masiva Excel</span>
        </button>
      </div>

      {/* Mandatory Registration Sequence Banner */}
      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4 flex items-start gap-3 text-xs">
        <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg shrink-0 mt-0.5 font-bold font-mono">
          SECUENCIA DRAC
        </div>
        <div>
          <div className="font-bold text-indigo-200 text-sm">
            Secuencia Obligatoria de Configuración de Estructura DRAC
          </div>
          <p className="text-slate-300 mt-1 leading-relaxed">
            <span className="font-semibold text-white">1º Registrar Dependencia</span> (Sede Central / Agencia Agraria) ➔{' '}
            <span className="font-semibold text-white">2º Registrar Dirección/Órgano</span> ➔{' '}
            <span className="font-semibold text-white">3º Registrar Área/Oficina</span> ➔{' '}
            <span className="font-semibold text-white">4º Designar Jefes/Directores</span> ➔{' '}
            <span className="font-semibold text-white">5º Registrar Personal</span>.
          </p>
          <p className="text-slate-400 text-[11px] mt-1">
            * El sistema determina automáticamente al Jefe Aprobador de Papeletas de Salida en función del área y dependencia asignadas al colaborador.
          </p>
        </div>
      </div>

      {/* TAB 1: EMPLOYEES LIST */}
      {activeTab === 'EMPLOYEES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={empSearchTerm}
            onSearchChange={(val) => {
              setEmpSearchTerm(val);
              setEmpCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar por DNI, Nombres, Apellidos, Código DRAC, Cargo o Usuario..."
            activeFilterCount={empActiveFilterCount}
            onResetFilters={handleResetEmpFilters}
            extraActions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateTemplateTrabajadores(direccionesOrganos, areas, cargos)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Descargar Plantilla Oficial Excel con catálogos y formatos para Trabajadores"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Plantilla Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => openBulkUploadFor('TRABAJADORES')}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Carga Masiva Excel</span>
                </button>

                {canManageOrg && (
                  <button
                    onClick={() => {
                      if (dependencias.length === 0) {
                        alert('⚠️ Secuencia Obligatoria:\n\n1. Primero debe registrar al menos una Dependencia (ej. Sede Central, Agencia Agraria).\n2. Luego Direcciones u Oficinas.\n3. Posteriormente podrá registrar al Personal.');
                        setActiveTab('DEPENDENCIAS');
                        return;
                      }
                      setEditingEmp(null);
                      setShowEmpModal(true);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Registrar Personal DRAC</span>
                  </button>
                )}
              </div>
            }
          >
            {/* Advanced Multi-filters Drawer Content */}
            <FilterField label="DNI o Documento">
              <input
                type="text"
                placeholder="Filtrar por DNI..."
                value={empFilterDni}
                onChange={(e) => {
                  setEmpFilterDni(e.target.value);
                  setEmpCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-[#090A0D] text-slate-200 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />
            </FilterField>

            <FilterField label="Dependencia DRAC">
              <FilterSelect
                value={empFilterDep}
                onChange={(val) => {
                  setEmpFilterDep(val);
                  setEmpFilterDir('ALL');
                  setEmpFilterArea('ALL');
                  setEmpCurrentPage(1);
                }}
                placeholder="Todas las Dependencias"
                options={dependencias.map((d) => ({ value: d.id, label: d.name }))}
              />
            </FilterField>

            <FilterField label="Dirección / Órgano (Cascada)">
              <FilterSelect
                value={empFilterDir}
                onChange={(val) => {
                  setEmpFilterDir(val);
                  setEmpFilterArea('ALL');
                  setEmpCurrentPage(1);
                }}
                placeholder="Todas las Direcciones"
                options={availableDirsForEmpFilter.map((d) => ({ value: d.id, label: d.name }))}
              />
            </FilterField>

            <FilterField label="Área / Oficina (Cascada)">
              <FilterSelect
                value={empFilterArea}
                onChange={(val) => {
                  setEmpFilterArea(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todas las Áreas"
                options={availableAreasForEmpFilter.map((a) => ({ value: a.id, label: a.name }))}
              />
            </FilterField>

            <FilterField label="Régimen Laboral">
              <FilterSelect
                value={empFilterRegimen}
                onChange={(val) => {
                  setEmpFilterRegimen(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todos los Regímenes"
                options={[
                  { value: 'D. LEG. 276', label: 'D. LEG. 276' },
                  { value: 'D. LEG. 728', label: 'D. LEG. 728' },
                  { value: 'D. LEG. 1057 - CAS', label: 'D. LEG. 1057 - CAS' },
                  { value: 'PRACTICANTE', label: 'PRACTICANTE' },
                ]}
              />
            </FilterField>

            <FilterField label="Condición Laboral">
              <FilterSelect
                value={empFilterCondicion}
                onChange={(val) => {
                  setEmpFilterCondicion(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todas las Condiciones"
                options={[
                  { value: 'NOMBRADO', label: 'NOMBRADO' },
                  { value: 'CONTRATADO', label: 'CONTRATADO' },
                  { value: 'DESIGNADO', label: 'DESIGNADO' },
                  { value: 'DESTACADO', label: 'DESTACADO' },
                ]}
              />
            </FilterField>

            <FilterField label="Cargo Institucional">
              <FilterSelect
                value={empFilterCargo}
                onChange={(val) => {
                  setEmpFilterCargo(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todos los Cargos"
                options={cargos.map((c) => ({ value: c.name, label: `${c.code} - ${c.name}` }))}
              />
            </FilterField>

            <FilterField label="Perfil / Rol en Sistema">
              <FilterSelect
                value={empFilterRole}
                onChange={(val) => {
                  setEmpFilterRole(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todos los Roles"
                options={SYSTEM_ROLES_CATALOG.map((r) => ({ value: r.role, label: `${r.badge} (${r.label})` }))}
              />
            </FilterField>

            <FilterField label="Titular / Jefe de Unidad">
              <FilterSelect
                value={empFilterIsJefe}
                onChange={(val) => {
                  setEmpFilterIsJefe(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todos los Colaboradores"
                options={[
                  { value: 'YES', label: '👑 Solo Jefes / Directores Titulares' },
                  { value: 'NO', label: 'Personal Operativo / No Jefes' },
                ]}
              />
            </FilterField>

            <FilterField label="Estado del Trabajador">
              <FilterSelect
                value={empFilterEstado}
                onChange={(val) => {
                  setEmpFilterEstado(val);
                  setEmpCurrentPage(1);
                }}
                placeholder="Todos (Activos e Inactivos)"
                options={[
                  { value: 'ACTIVE', label: '🟢 Solo Trabajadores Activos' },
                  { value: 'INACTIVE', label: '🔴 Solo Trabajadores Inactivos' },
                ]}
              />
            </FilterField>

            <FilterField label="Fecha de Ingreso (Desde / Hasta)">
              <FilterDateRange
                startDate={empFilterHireDateStart}
                endDate={empFilterHireDateEnd}
                onStartDateChange={(val) => {
                  setEmpFilterHireDateStart(val);
                  setEmpCurrentPage(1);
                }}
                onEndDateChange={(val) => {
                  setEmpFilterHireDateEnd(val);
                  setEmpCurrentPage(1);
                }}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {/* Table */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {orgActionFeedback && (
              <div className="mx-4 mt-3 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2">
                <span>{orgActionFeedback}</span>
                <button
                  type="button"
                  onClick={() => setOrgActionFeedback(null)}
                  className="text-emerald-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                  <tr>
                    <th className="w-[125px] px-3.5 py-3">
                      <SortableHeader
                        label="Cód. / DNI"
                        field="dni"
                        currentField={empSortField}
                        currentOrder={empSortOrder}
                        onSort={handleEmpSort}
                      />
                    </th>
                    <th className="w-[230px] px-3.5 py-3">
                      <SortableHeader
                        label="Trabajador / Usuario"
                        field="first_name"
                        currentField={empSortField}
                        currentOrder={empSortOrder}
                        onSort={handleEmpSort}
                      />
                    </th>
                    <th className="w-[150px] px-3.5 py-3">
                      <SortableHeader
                        label="Dependencia"
                        field="dependencia_name"
                        currentField={empSortField}
                        currentOrder={empSortOrder}
                        onSort={handleEmpSort}
                      />
                    </th>
                    <th className="w-[220px] px-3.5 py-3">
                      <span className="text-slate-400 font-medium">Dirección / Área</span>
                    </th>
                    <th className="w-[180px] px-3.5 py-3">
                      <SortableHeader
                        label="Cargo / Régimen"
                        field="position"
                        currentField={empSortField}
                        currentOrder={empSortOrder}
                        onSort={handleEmpSort}
                      />
                    </th>
                    <th className="w-[85px] px-3 py-3 text-center">
                      <SortableHeader
                        label="Estado"
                        field="active"
                        currentField={empSortField}
                        currentOrder={empSortOrder}
                        onSort={handleEmpSort}
                      />
                    </th>
                    <th className="w-[95px] px-3 py-3 text-right text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedEmployeesList.map((emp) => {
                    const assignedRolesList = getEmployeeAssignedRoles(emp);
                    const hasAccess = emp.has_system_access !== false;
                    const isMenuOpen = openEmpActionMenuId === emp.id;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* CÓDIGO DRAC & DNI */}
                        <td className="px-3.5 py-3 font-mono">
                          <div className="text-indigo-400 font-bold text-[11px] truncate" title={`Código DRAC: ${emp.codigo_trabajador || 'DRAC-2026'}`}>
                            {emp.codigo_trabajador || 'DRAC-2026'}
                          </div>
                          <div className="text-slate-300 font-semibold text-xs mt-0.5">{emp.dni}</div>
                          <div className="text-[10px] text-slate-500 truncate">PIN: {emp.zkteco_pin || emp.dni}</div>
                        </td>

                        {/* TRABAJADOR */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-[11px] border border-indigo-500/20 shrink-0">
                              {emp.first_name[0]}
                              {emp.last_name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-bold text-white text-xs truncate cursor-pointer hover:text-indigo-300 transition-colors"
                                title={`${emp.first_name} ${emp.last_name}`}
                                onClick={() => setSelectedEmpForDetail(emp)}
                              >
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                <UserCog className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span className="text-indigo-300 font-semibold truncate">@{emp.username || emp.dni}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* DEPENDENCIA */}
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-slate-200 text-xs truncate" title={emp.dependencia_name}>
                            {emp.dependencia_name}
                          </div>
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[9px] border border-slate-700 truncate max-w-full">
                            {emp.dependencia_id === 'DEP-01' ? 'Sede Central' : 'Agencia Agraria'}
                          </span>
                        </td>

                        {/* DIRECCIÓN / ÁREA */}
                        <td className="px-3.5 py-3">
                          <div className="font-medium text-slate-200 text-xs truncate" title={emp.direccion_organo_name || 'Sin Dirección / Órgano'}>
                            {emp.direccion_organo_name || 'Sin Dirección'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={emp.area_name || 'Sin Área'}>
                            ↳ {emp.area_name || 'Sin Área'}
                          </div>
                        </td>

                        {/* CARGO & RÉGIMEN */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-1 text-slate-200 font-medium text-xs truncate" title={emp.position}>
                            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{emp.position}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 truncate">
                            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px] font-mono border border-slate-700 shrink-0">
                              {emp.regimen_laboral}
                            </span>
                            <span className="text-[9px] text-slate-500 truncate" title={emp.condicion_laboral}>
                              {emp.condicion_laboral}
                            </span>
                          </div>
                        </td>

                        {/* ESTADO */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-full border inline-block ${
                              emp.active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {emp.active ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>

                        {/* ACCIONES COMPACTAS */}
                        <td className="px-3 py-3 text-right">
                          <div className="relative inline-flex items-center justify-end gap-1">
                            {/* Ver Ficha Integral */}
                            <button
                              onClick={() => setSelectedEmpForDetail(emp)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded transition-colors"
                              title="Ver Ficha Integral del Colaborador"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canManageOrg && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingEmp(emp);
                                    setShowEmpModal(true);
                                  }}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                                  title="Editar Trabajador"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Dropdown Menú 3 Puntos */}
                                <div className="relative">
                                  <button
                                    onClick={() => setOpenEmpActionMenuId(isMenuOpen ? null : emp.id)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                                    title="Más Opciones"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>

                                  {isMenuOpen && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-20"
                                        onClick={() => setOpenEmpActionMenuId(null)}
                                      />
                                      <div className="absolute right-0 top-full mt-1 w-48 bg-[#0F1115] border border-slate-700 rounded-xl shadow-2xl z-30 py-1.5 text-left text-xs divide-y divide-slate-800">
                                        <div className="py-1">
                                          {hasAccess && (
                                            <button
                                              onClick={() => {
                                                setOpenEmpActionMenuId(null);
                                                setSelectedEmpForPasswordReset(emp);
                                                setResetNewPassword('123456');
                                                setShowResetPasswordEye(false);
                                                setShowResetPasswordModal(true);
                                              }}
                                              className="w-full px-3 py-2 text-left hover:bg-slate-800/80 text-amber-300 flex items-center gap-2 transition-colors"
                                            >
                                              <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                              <span>Restablecer Clave</span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => {
                                              setOpenEmpActionMenuId(null);
                                              setSelectedEmpForRoleModal(emp);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-slate-800/80 text-cyan-300 flex items-center gap-2 transition-colors"
                                          >
                                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span>Perfil & Roles RBAC</span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              setOpenEmpActionMenuId(null);
                                              setSelectedEmpForHistory(emp);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-slate-800/80 text-indigo-300 flex items-center gap-2 transition-colors"
                                          >
                                            <History className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span>Historial Traslados</span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              setOpenEmpActionMenuId(null);
                                              setSelectedEmpForDetail(emp);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-slate-800/80 text-cyan-300 flex items-center gap-2 transition-colors"
                                          >
                                            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span>Sincronizar Biométrico</span>
                                          </button>
                                        </div>

                                        <div className="py-1">
                                          <button
                                            onClick={() => {
                                              setOpenEmpActionMenuId(null);
                                              setConfirmModalConfig({
                                                isOpen: true,
                                                title: emp.active ? 'Desactivar Trabajador DRAC' : 'Reactivar Trabajador DRAC',
                                                message: `¿Desea cambiar el estado del colaborador ${emp.first_name} ${emp.last_name}? Al desactivar al trabajador, su cuenta de acceso al sistema pasará automáticamente a INACTIVA y sus registros históricos quedarán resguardados para auditoría.`,
                                                actionType: 'DEACTIVATE',
                                                entityName: `DNI: ${emp.dni} - ${emp.position}`,
                                                confirmText: emp.active ? 'Desactivar Registro' : 'Reactivar Registro',
                                                onConfirm: () => {
                                                  onDeleteEmployee(emp.id);
                                                  setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                                },
                                                onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                                              });
                                            }}
                                            className={`w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center gap-2 transition-colors ${
                                              emp.active ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'
                                            }`}
                                          >
                                            <Power className="w-3.5 h-3.5 shrink-0" />
                                            <span>{emp.active ? 'Desactivar Cuenta' : 'Reactivar Cuenta'}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredEmployeesList.length === 0 && (
                <EmptyState
                  icon={Users}
                  title="No se encontraron trabajadores con los criterios seleccionados"
                  description="Ajuste los filtros de búsqueda por DNI, cargo, dependencia, régimen o rol, o limpie los filtros para ver todos los registros."
                  isFiltered={Boolean(empSearchTerm.trim()) || empActiveFilterCount > 0}
                  onAction={handleResetEmpFilters}
                />
              )}
            </div>

            {filteredEmployeesList.length > 0 && (
              <DataTablePagination
                currentPage={empCurrentPage}
                pageSize={empPageSize}
                totalItems={filteredEmployeesList.length}
                onPageChange={setEmpCurrentPage}
                onPageSizeChange={(newSize) => {
                  setEmpPageSize(newSize);
                  setEmpCurrentPage(1);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEPENDENCIAS DRAC */}
      {activeTab === 'DEPENDENCIAS' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={depSearchTerm}
            onSearchChange={(val) => {
              setDepSearchTerm(val);
              setDepCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar dependencia por código, nombre o dirección..."
            activeFilterCount={depActiveFilterCount}
            onResetFilters={handleResetDepFilters}
            extraActions={
              canManageOrg ? (
                <button
                  onClick={() => {
                    setEditingDep(null);
                    setDepCode('');
                    setDepName('');
                    setDepType('SEDE_CENTRAL');
                    setDepAddress('');
                    setShowDepModal(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Dependencia DRAC</span>
                </button>
              ) : null
            }
          >
            <FilterField label="Tipo de Dependencia">
              <FilterSelect
                value={depFilterType}
                onChange={(val) => {
                  setDepFilterType(val);
                  setDepCurrentPage(1);
                }}
                placeholder="Todos los Tipos"
                options={[
                  { value: 'SEDE_CENTRAL', label: 'Sede Central' },
                  { value: 'AGENCIA_AGRARIA', label: 'Agencia Agraria' },
                ]}
              />
            </FilterField>

            <FilterField label="Estado">
              <FilterSelect
                value={depFilterStatus}
                onChange={(val) => {
                  setDepFilterStatus(val);
                  setDepCurrentPage(1);
                }}
                placeholder="Todos los Estados"
                options={[
                  { value: 'ACTIVE', label: '🟢 Activas' },
                  { value: 'INACTIVE', label: '🔴 Inactivas' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedDepsList.map((dep) => {
              const staffCount = employees.filter((e) => e.dependencia_id === dep.id).length;
              const dirsCount = direccionesOrganos.filter((d) => d.dependencia_id === dep.id).length;

              return (
                <div key={dep.id} className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{dep.code}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                        {getDependenciaTypeLabel(dep.type)}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white mb-1">{dep.name}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{dep.address || 'Región Cajamarca'}</span>
                    </p>

                    <div className="bg-[#090A0D] p-2.5 rounded border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                      <div>Direcciones/Órganos: <span className="font-bold text-white">{dirsCount}</span></div>
                      <div>Personal: <span className="font-bold text-indigo-400">{staffCount}</span></div>
                    </div>
                  </div>

                  {canManageOrg && (
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setEditingDep(dep);
                          setDepCode(dep.code);
                          setDepName(dep.name);
                          setDepType(dep.type);
                          setDepAddress(dep.address || '');
                          setShowDepModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs rounded flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => {
                          setConfirmModalConfig({
                            isOpen: true,
                            title: 'Desactivar Dependencia DRAC',
                            message: `¿Desea desactivar la dependencia "${dep.name}"? Los datos históricos asociados (direcciones, áreas y personal) se mantendrán protegidos para reportes e inspección laboral.`,
                            actionType: 'DEACTIVATE',
                            entityName: `Código: ${dep.code} - ${dep.name}`,
                            confirmText: 'Desactivar Dependencia',
                            onConfirm: () => {
                              onDeleteDependencia(dep.id);
                              setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                            },
                            onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                          });
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-900 text-rose-400 text-xs rounded flex items-center gap-1"
                      >
                        <Power className="w-3 h-3" />
                        <span>Desactivar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredDepsList.length === 0 && (
            <EmptyState
              icon={Building}
              title="No se encontraron dependencias con los criterios seleccionados"
              description="Ajuste los filtros de búsqueda o restablezca para consultar la totalidad de sedes y agencias."
              isFiltered={Boolean(depSearchTerm.trim()) || depActiveFilterCount > 0}
              onAction={handleResetDepFilters}
            />
          )}

          {filteredDepsList.length > 0 && (
            <DataTablePagination
              currentPage={depCurrentPage}
              pageSize={depPageSize}
              totalItems={filteredDepsList.length}
              onPageChange={setDepCurrentPage}
              onPageSizeChange={(newSize) => {
                setDepPageSize(newSize);
                setDepCurrentPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* TAB 3: DIRECCIONES Y ÓRGANOS */}
      {activeTab === 'DIRECCIONES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={dirSearchTerm}
            onSearchChange={(val) => {
              setDirSearchTerm(val);
              setDirCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar dirección u órgano por código, nombre o dependencia..."
            activeFilterCount={dirActiveFilterCount}
            onResetFilters={handleResetDirFilters}
            extraActions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateTemplateDireccionesOrganos(dependencias)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Descargar Plantilla Oficial Excel para Direcciones y Órganos"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Plantilla Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => openBulkUploadFor('DIRECCIONES')}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Carga Masiva Excel</span>
                </button>

                {canManageOrg && (
                  <button
                    onClick={() => {
                      if (dependencias.length === 0) {
                        alert('Error: Cree primero al menos una Dependencia.');
                        setActiveTab('DEPENDENCIAS');
                        return;
                      }
                      setEditingDir(null);
                      setDirCode('');
                      setDirName('');
                      setDirType('DIRECCION');
                      setDirDepId(dependencias[0]?.id || '');
                      setShowDirModal(true);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Dirección / Órgano</span>
                  </button>
                )}
              </div>
            }
          >
            <FilterField label="Clasificación Orgánica">
              <FilterSelect
                value={dirFilterType}
                onChange={(val) => {
                  setDirFilterType(val);
                  setDirCurrentPage(1);
                }}
                placeholder="Todas las Clasificaciones"
                options={[
                  { value: 'DIRECCION', label: 'DIRECCIÓN' },
                  { value: 'ORGANO_APOYO', label: 'ÓRGANOS DE APOYO' },
                  { value: 'JEFATURA_AGENCIA', label: 'JEFATURA DE AGENCIA' },
                  { value: 'OFICINA_AGRARIA', label: 'OFICINA AGRARIA' },
                ]}
              />
            </FilterField>

            <FilterField label="Dependencia">
              <FilterSelect
                value={dirFilterDep}
                onChange={(val) => {
                  setDirFilterDep(val);
                  setDirCurrentPage(1);
                }}
                placeholder="Todas las Dependencias"
                options={dependencias.map((d) => ({ value: d.id, label: d.name }))}
              />
            </FilterField>
          </AdvancedSearchFilter>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedDirsList.map((dir) => {
              const staffCount = employees.filter((e) => e.direccion_organo_id === dir.id).length;

              return (
                <div key={dir.id} className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{dir.code}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                        {getOrganoTypeLabel(dir.type)}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white mb-1">{dir.name}</h4>
                    <div className="text-xs text-slate-400 mb-3">
                      Dependencia: <span className="text-indigo-300 font-semibold">{dir.dependencia_name}</span>
                    </div>

                    <div className="bg-[#090A0D] p-2.5 rounded border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                      <div>Personal Asignado: <span className="font-bold text-indigo-400">{staffCount}</span></div>
                    </div>
                  </div>

                  {canManageOrg && (
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setEditingDir(dir);
                          setDirCode(dir.code);
                          setDirName(dir.name);
                          setDirType(dir.type);
                          setDirDepId(dir.dependencia_id);
                          setShowDirModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs rounded flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => {
                          setConfirmModalConfig({
                            isOpen: true,
                            title: 'Desactivar Dirección / Órgano',
                            message: `¿Desea desactivar la unidad "${dir.name}"? Los registros del personal asignado históricamente no sufrirán pérdida de integridad.`,
                            actionType: 'DEACTIVATE',
                            entityName: `Código: ${dir.code} - ${dir.name}`,
                            confirmText: 'Desactivar Unidad',
                            onConfirm: () => {
                              onDeleteDireccionOrgano(dir.id);
                              setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                            },
                            onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                          });
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-900 text-rose-400 text-xs rounded flex items-center gap-1"
                      >
                        <Power className="w-3 h-3" />
                        <span>Desactivar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredDirsList.length === 0 && (
            <EmptyState
              icon={Layers}
              title="No se encontraron unidades con los criterios seleccionados"
              description="Ajuste los filtros de búsqueda por clasificación o dependencia."
              isFiltered={Boolean(dirSearchTerm.trim()) || dirActiveFilterCount > 0}
              onAction={handleResetDirFilters}
            />
          )}

          {filteredDirsList.length > 0 && (
            <DataTablePagination
              currentPage={dirCurrentPage}
              pageSize={dirPageSize}
              totalItems={filteredDirsList.length}
              onPageChange={setDirCurrentPage}
              onPageSizeChange={(newSize) => {
                setDirPageSize(newSize);
                setDirCurrentPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* TAB 4: AREAS Y OFICINAS */}
      {activeTab === 'AREAS' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={areaSearchTerm}
            onSearchChange={(val) => {
              setAreaSearchTerm(val);
              setAreaCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar área u oficina por código, nombre o descripción..."
            activeFilterCount={areaActiveFilterCount}
            onResetFilters={handleResetAreaFilters}
            extraActions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateTemplateAreasOficinas(direccionesOrganos)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Descargar Plantilla Oficial Excel para Áreas y Oficinas"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Plantilla Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => openBulkUploadFor('AREAS')}
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                  <span>Carga Masiva Excel</span>
                </button>

                {canManageOrg && (
                  <button
                    onClick={() => {
                      const activeSuperiors = direccionesOrganos.filter((d) => d.active);
                      if (activeSuperiors.length === 0) {
                        alert(
                          '⚠️ Estructura Requerida:\n\nPrimero deben existir las Direcciones, Órganos de Apoyo u Oficinas Agrarias en el sistema. Luego se podrán crear las Áreas y Oficinas Institucionales asociándolas obligatoriamente a una de estas unidades.'
                        );
                        setActiveTab('DIRECCIONES');
                        return;
                      }
                      setEditingArea(null);
                      setAreaCode(`ARE-${String(areas.length + 1).padStart(3, '0')}`);
                      setAreaName('');
                      setAreaTipo('AREA');
                      setAreaDesc('');
                      setAreaDirId(activeSuperiors[0]?.id || '');
                      setAreaDepId(activeSuperiors[0]?.dependencia_id || dependencias[0]?.id || '');
                      setAreaActive(true);
                      setParentAreaId('');
                      setShowAreaModal(true);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Área / Oficina</span>
                  </button>
                )}
              </div>
            }
          >
            <FilterField label="Dependencia DRAC">
              <FilterSelect
                value={areaFilterDep}
                onChange={(val) => {
                  setAreaFilterDep(val);
                  setAreaCurrentPage(1);
                }}
                placeholder="Todas las Dependencias"
                options={dependencias.map((d) => ({ value: d.id, label: d.name }))}
              />
            </FilterField>

            <FilterField label="Dirección / Órgano">
              <FilterSelect
                value={areaFilterDir}
                onChange={(val) => {
                  setAreaFilterDir(val);
                  setAreaCurrentPage(1);
                }}
                placeholder="Todas las Direcciones"
                options={direccionesOrganos.map((d) => ({ value: d.id, label: d.name }))}
              />
            </FilterField>
          </AdvancedSearchFilter>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedAreasList.filter((a) => !a.parent_area_id).map((area) => {
              const subareas = areas.filter((a) => a.parent_area_id === area.id);
              const staffCount = employees.filter((e) => e.area_id === area.id).length;
              const superiorUnit = direccionesOrganos.find((d) => d.id === (area.direccion_organo_id || area.unidad_superior_id));

              return (
                <div key={area.id} className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-indigo-400">{area.code}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                            area.tipo === 'OFICINA' || area.name.toUpperCase().startsWith('OFICINA')
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                          }`}
                        >
                          {area.tipo || (area.name.toUpperCase().startsWith('OFICINA') ? 'OFICINA' : 'ÁREA')}
                        </span>
                        {!area.active && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            INACTIVO
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                        {staffCount} Personal
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white mb-2">{area.name}</h4>

                    {/* VINCULACIÓN JERÁRQUICA OBLIGATORIA */}
                    <div className="p-2.5 bg-[#090A0D] border border-slate-800/80 rounded-lg mb-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                        <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span>Pertenece a:</span>
                      </div>
                      <div className="text-xs font-semibold text-white truncate" title={superiorUnit?.name || area.direccion_organo_name || 'Sin especificar'}>
                        {superiorUnit?.name || area.direccion_organo_name || 'Unidad Superior DRAC'}
                      </div>
                      <div className="text-[10px] text-indigo-400/80 font-mono mt-0.5">
                        {superiorUnit ? getOrganoTypeLabel(superiorUnit.type) : 'Dirección / Órgano'}
                      </div>
                    </div>

                    {area.description && (
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{area.description}</p>
                    )}

                    {subareas.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Subáreas ({subareas.length})</div>
                        {subareas.map((sub) => (
                          <div key={sub.id} className="p-2 bg-[#090A0D] rounded border border-slate-800 text-xs flex justify-between">
                            <span className="text-slate-300">{sub.name}</span>
                            <span className="font-mono text-[10px] text-slate-500">{sub.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {canManageOrg && (
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setEditingArea(area);
                          setAreaCode(area.code);
                          setAreaName(area.name);
                          setAreaTipo(area.tipo || (area.name.toUpperCase().startsWith('OFICINA') ? 'OFICINA' : 'AREA'));
                          setAreaDesc(area.description || '');
                          setAreaDepId(area.dependencia_id || '');
                          setAreaDirId(area.direccion_organo_id || area.unidad_superior_id || '');
                          setAreaActive(area.active ?? true);
                          setParentAreaId(area.parent_area_id || '');
                          setShowAreaModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs rounded flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => {
                          setConfirmModalConfig({
                            isOpen: true,
                            title: 'Desactivar Área / Oficina',
                            message: `¿Desea desactivar el área "${area.name}"? Los registros de papeletas y marcaciones históricas continuarán referenciando esta área sin alteración.`,
                            actionType: 'DEACTIVATE',
                            entityName: `Código: ${area.code} - ${area.name}`,
                            confirmText: 'Desactivar Área',
                            onConfirm: () => {
                              onDeleteArea(area.id);
                              setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                            },
                            onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                          });
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-900 text-rose-400 text-xs rounded flex items-center gap-1"
                      >
                        <Power className="w-3 h-3" />
                        <span>Desactivar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredAreasList.length === 0 && (
            <EmptyState
              icon={Layers}
              title="No se encontraron áreas con los criterios seleccionados"
              description="Ajuste los filtros de búsqueda por dependencia o dirección."
              isFiltered={Boolean(areaSearchTerm.trim()) || areaActiveFilterCount > 0}
              onAction={handleResetAreaFilters}
            />
          )}

          {filteredAreasList.length > 0 && (
            <DataTablePagination
              currentPage={areaCurrentPage}
              pageSize={areaPageSize}
              totalItems={filteredAreasList.length}
              onPageChange={setAreaCurrentPage}
              onPageSizeChange={(newSize) => {
                setAreaPageSize(newSize);
                setAreaCurrentPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* TAB 5: CARGOS */}
      {activeTab === 'CARGOS' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={cargoSearchTerm}
            onSearchChange={(val) => {
              setCargoSearchTerm(val);
              setCargoCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar cargo por código o nombre..."
            activeFilterCount={cargoActiveFilterCount}
            onResetFilters={handleResetCargoFilters}
            extraActions={
              canManageOrg ? (
                <button
                  onClick={() => {
                    setEditingCargo(null);
                    setCargoCode('');
                    setCargoName('');
                    setCargoNivel('F-3 / Ejecutivo');
                    setShowCargoModal(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Cargo DRAC</span>
                </button>
              ) : null
            }
          >
            <FilterField label="Nivel / Escala">
              <FilterSelect
                value={cargoFilterNivel}
                onChange={(val) => {
                  setCargoFilterNivel(val);
                  setCargoCurrentPage(1);
                }}
                placeholder="Todos los Niveles"
                options={[
                  { value: 'F-5 / Directivo Superior', label: 'F-5 / Directivo Superior' },
                  { value: 'F-3 / Ejecutivo', label: 'F-3 / Ejecutivo' },
                  { value: 'Profesional / Especialista', label: 'Profesional / Especialista' },
                  { value: 'Técnico / Administrativo', label: 'Técnico / Administrativo' },
                  { value: 'Auxiliar / Operativo', label: 'Auxiliar / Operativo' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedCargosList.map((cargo) => (
              <div key={cargo.id} className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] text-indigo-400 font-bold">{cargo.code}</div>
                  <div className="font-bold text-sm text-white">{cargo.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{cargo.nivel || 'Nivel Escala DRAC'}</div>
                </div>
                {canManageOrg && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingCargo(cargo);
                        setCargoCode(cargo.code);
                        setCargoName(cargo.name);
                        setCargoNivel(cargo.nivel || 'F-3 / Ejecutivo');
                        setShowCargoModal(true);
                      }}
                      className="p-1.5 text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                      title="Editar Cargo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const employeesWithCargo = employees.filter((e) => e.cargo_id === cargo.id || e.position.toLowerCase() === cargo.name.toLowerCase());
                        const isDeactivating = cargo.active !== false;
                        setConfirmModalConfig({
                          isOpen: true,
                          title: isDeactivating ? 'Desactivar Cargo' : 'Reactivar Cargo',
                          message: isDeactivating
                            ? `¿Desea desactivar el cargo "${cargo.name}"? Los contratos e historial del personal con este cargo (${employeesWithCargo.length} asignado/s) se mantendrán intactos.`
                            : `¿Desea reactivar el cargo "${cargo.name}" para asignación a personal DRAC?`,
                          actionType: 'DEACTIVATE',
                          entityName: `Código: ${cargo.code} - ${cargo.name}`,
                          confirmText: isDeactivating ? 'Desactivar Cargo' : 'Reactivar Cargo',
                          onConfirm: () => {
                            if (isDeactivating) {
                              onDeleteCargo(cargo.id);
                            } else {
                              onEditCargo({ ...cargo, active: true });
                            }
                            setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                          },
                          onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                        });
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        cargo.active !== false
                          ? 'text-rose-400 hover:bg-rose-900/30'
                          : 'text-emerald-400 hover:bg-emerald-900/30'
                      }`}
                      title={cargo.active !== false ? 'Desactivar Cargo' : 'Reactivar Cargo'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredCargosList.length === 0 && (
            <EmptyState
              icon={Briefcase}
              title="No se encontraron cargos con los criterios de búsqueda"
              description="Ajuste los filtros o restablezca para consultar todos los cargos."
              isFiltered={Boolean(cargoSearchTerm.trim()) || cargoActiveFilterCount > 0}
              onAction={handleResetCargoFilters}
            />
          )}

          {filteredCargosList.length > 0 && (
            <DataTablePagination
              currentPage={cargoCurrentPage}
              pageSize={cargoPageSize}
              totalItems={filteredCargosList.length}
              onPageChange={setCargoCurrentPage}
              onPageSizeChange={(newSize) => {
                setCargoPageSize(newSize);
                setCargoCurrentPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* TAB 6: JEFES Y APROBADORES (AUTOMATIZADO DESDE PERFIL JEFE INMEDIATO) */}
      {activeTab === 'RESPONSABLES' && (
        <div className="space-y-4">
          {/* Header & Metrics Banner */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Jefes Inmediatos y Aprobadores Institucionales (VoBo)</span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold rounded-full">
                        Sincronización Automática
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Nómina generada en tiempo real a partir de los colaboradores con perfil asignado <strong className="text-amber-300">Jefe Inmediato</strong> o <strong className="text-indigo-300">Encargaturas de Funciones Vigentes</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Metric Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-2 bg-slate-900/80 border border-amber-500/30 rounded-xl text-center min-w-[100px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Total Jefes</div>
                  <div className="text-lg font-extrabold text-amber-400">{allJefesAprobadoresList.length}</div>
                </div>
                <div className="px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-center min-w-[100px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Titulares</div>
                  <div className="text-lg font-extrabold text-emerald-400">
                    {allJefesAprobadoresList.filter((j) => j.source === 'TITULAR').length}
                  </div>
                </div>
                <div className="px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-center min-w-[100px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Encargados (e)</div>
                  <div className="text-lg font-extrabold text-indigo-400">
                    {allJefesAprobadoresList.filter((j) => j.source === 'ENCARGATURA').length}
                  </div>
                </div>
                <div className="px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-center min-w-[100px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Activos</div>
                  <div className="text-lg font-extrabold text-white">
                    {allJefesAprobadoresList.filter((j) => j.employee.active).length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <AdvancedSearchFilter
            searchTerm={jefeSearchTerm}
            onSearchChange={(val) => {
              setJefeSearchTerm(val);
              setJefeCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar por nombre del jefe, DNI, cargo, dirección o área..."
            activeFilterCount={jefeActiveFilterCount}
            onResetFilters={handleResetJefeFilters}
          >
            <FilterField label="Dirección / Órgano">
              <FilterSelect
                value={jefeFilterDir}
                onChange={(val) => {
                  setJefeFilterDir(val);
                  setJefeCurrentPage(1);
                }}
                placeholder="Todas las Direcciones / Órganos"
                options={direccionesOrganos.map((d) => ({ value: d.id, label: d.name }))}
              />
            </FilterField>

            <FilterField label="Tipo de Asignación">
              <FilterSelect
                value={jefeFilterSource}
                onChange={(val) => {
                  setJefeFilterSource(val);
                  setJefeCurrentPage(1);
                }}
                placeholder="Todos los Orígenes"
                options={[
                  { value: 'TITULAR', label: 'Titular con Perfil Jefe Inmediato' },
                  { value: 'ENCARGATURA', label: 'Encargatura de Funciones Vigente (e)' },
                ]}
              />
            </FilterField>

            <FilterField label="Estado del Personal">
              <FilterSelect
                value={jefeFilterStatus}
                onChange={(val) => {
                  setJefeFilterStatus(val);
                  setJefeCurrentPage(1);
                }}
                placeholder="Todos los Estados"
                options={[
                  { value: 'ACTIVE', label: 'Personal Activo' },
                  { value: 'INACTIVE', label: 'Personal Inactivo' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {/* Responsive Table */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                  <tr>
                    <th className="w-[110px] px-3.5 py-3">
                      <SortableHeader
                        label="Cód. / DNI"
                        field="dni"
                        currentField={jefeSortField}
                        currentOrder={jefeSortOrder}
                        onSort={handleJefeSort}
                      />
                    </th>
                    <th className="w-[230px] px-3.5 py-3">
                      <SortableHeader
                        label="Trabajador / Aprobador"
                        field="first_name"
                        currentField={jefeSortField}
                        currentOrder={jefeSortOrder}
                        onSort={handleJefeSort}
                      />
                    </th>
                    <th className="w-[190px] px-3.5 py-3">
                      <SortableHeader
                        label="Cargo Institucional"
                        field="position"
                        currentField={jefeSortField}
                        currentOrder={jefeSortOrder}
                        onSort={handleJefeSort}
                      />
                    </th>
                    <th className="w-[210px] px-3.5 py-3">
                      <SortableHeader
                        label="Dirección / Órgano"
                        field="dirName"
                        currentField={jefeSortField}
                        currentOrder={jefeSortOrder}
                        onSort={handleJefeSort}
                      />
                    </th>
                    <th className="w-[170px] px-3.5 py-3">
                      <SortableHeader
                        label="Área / Oficina"
                        field="areaName"
                        currentField={jefeSortField}
                        currentOrder={jefeSortOrder}
                        onSort={handleJefeSort}
                      />
                    </th>
                    <th className="w-[85px] px-3 py-3 text-center">
                      <SortableHeader
                        label="Estado"
                        field="active"
                        currentField={jefeSortField}
                        currentOrder={jefeSortOrder}
                        onSort={handleJefeSort}
                      />
                    </th>
                    <th className="w-[95px] px-3 py-3 text-right text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedJefesList.map((item) => {
                    const {
                      employee: emp,
                      source,
                      dirName,
                      areaName,
                      isEncargado,
                      supervisedEmployees,
                      pendingPapeletasCount,
                    } = item;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* CÓDIGO DRAC & DNI */}
                        <td className="px-3.5 py-3 font-mono">
                          <div
                            className="text-amber-400 font-bold text-[11px] truncate"
                            title={`Código DRAC: ${emp.codigo_trabajador || 'DRAC-2026'}`}
                          >
                            {emp.codigo_trabajador || 'DRAC-2026'}
                          </div>
                          <div className="text-slate-300 font-semibold text-xs mt-0.5">{emp.dni}</div>
                          {isEncargado ? (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded text-[9px] font-bold">
                              Encargado (e)
                            </span>
                          ) : (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold">
                              Titular
                            </span>
                          )}
                        </td>

                        {/* TRABAJADOR */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[11px] border border-amber-500/30 shrink-0">
                              {emp.first_name[0]}
                              {emp.last_name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-bold text-white text-xs truncate cursor-pointer hover:text-amber-300 transition-colors flex items-center gap-1"
                                title={`${emp.first_name} ${emp.last_name}`}
                                onClick={() => setSelectedJefeForDetail(item)}
                              >
                                <span className="truncate">{emp.first_name} {emp.last_name}</span>
                                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                <UserCog className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span className="text-indigo-300 font-semibold truncate">@{emp.username || emp.dni}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* CARGO INSTITUCIONAL */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-1 text-slate-200 font-medium text-xs truncate" title={emp.position}>
                            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{emp.position}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 truncate">
                            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px] font-mono border border-slate-700 shrink-0">
                              {emp.regimen_laboral}
                            </span>
                            <span className="text-[9px] text-slate-500 truncate">{emp.condicion_laboral}</span>
                          </div>
                        </td>

                        {/* DIRECCIÓN / ÓRGANO */}
                        <td className="px-3.5 py-3">
                          <div className="font-medium text-slate-200 text-xs truncate" title={dirName}>
                            {dirName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={emp.dependencia_name}>
                            {emp.dependencia_name}
                          </div>
                        </td>

                        {/* ÁREA / OFICINA */}
                        <td className="px-3.5 py-3">
                          <div className="font-medium text-amber-300 text-xs truncate" title={areaName}>
                            {areaName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {supervisedEmployees.length} servidor(es) a cargo
                          </div>
                        </td>

                        {/* ESTADO */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-full border inline-block ${
                              emp.active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {emp.active ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>

                        {/* ACCIONES */}
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Ver Ámbito de Aprobación */}
                            <button
                              onClick={() => setSelectedJefeForDetail(item)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors"
                              title="Ver Ámbito de Aprobación VoBo & Equipo Supervisado"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Ver Roles y Permisos RBAC */}
                            <button
                              onClick={() => setSelectedEmpForRoleModal(emp)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded transition-colors"
                              title="Ver y Gestionar Perfil & Roles RBAC"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredJefesList.length === 0 && (
                <EmptyState
                  icon={Crown}
                  title="No se encontraron jefes o aprobadores con los criterios seleccionados"
                  description="Ajuste los filtros de búsqueda por nombre, cargo, dirección o tipo de asignación."
                  isFiltered={Boolean(jefeSearchTerm.trim()) || jefeActiveFilterCount > 0}
                  onAction={handleResetJefeFilters}
                />
              )}
            </div>

            {filteredJefesList.length > 0 && (
              <DataTablePagination
                currentPage={jefeCurrentPage}
                pageSize={jefePageSize}
                totalItems={filteredJefesList.length}
                onPageChange={setJefeCurrentPage}
                onPageSizeChange={(newSize) => {
                  setJefePageSize(newSize);
                  setJefeCurrentPage(1);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CARGA MASIVA DE INFORMACIÓN MEDIANTE EXCEL */}
      {activeTab === 'CARGA_MASIVA' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">
                    Centro de Carga Masiva de Información Institucional
                  </h3>
                  <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold rounded-full uppercase font-mono">
                    Excel .xlsx
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                  Importación masiva controlada, validada y trazable para la Dirección Regional de Agricultura Cajamarca. Respeta el orden jerárquico de dependencias y asegura la consistencia orgánica.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openBulkUploadFor('DIRECCIONES')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all self-start md:self-auto shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Iniciar Asistente de Carga Masiva</span>
              </button>
            </div>
          </div>

          {/* 4 Steps Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="bg-[#0F1115] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-lg font-mono">
                    Paso 1
                  </span>
                  <Building2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Direcciones / Órganos DRAC</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Direcciones de Línea, Órganos de Apoyo, Jefaturas de Agencia y Oficinas Agrarias.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => generateTemplateDireccionesOrganos(dependencias)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Descargar Plantilla (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openBulkUploadFor('DIRECCIONES')}
                  className="w-full py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar Direcciones</span>
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#0F1115] border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold rounded-lg font-mono">
                    Paso 2
                  </span>
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Áreas / Oficinas / Subáreas</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Unidades operativas dependientes de las Direcciones y Órganos existentes.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => generateTemplateAreasOficinas(direccionesOrganos)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Descargar Plantilla (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openBulkUploadFor('AREAS')}
                  className="w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar Áreas</span>
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#0F1115] border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg font-mono">
                    Paso 3
                  </span>
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Directorio de Trabajadores</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Personal DRAC con asignación automática de perfil base TRABAJADOR y perfiles acumulativos.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => generateTemplateTrabajadores(direccionesOrganos, areas, cargos)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Descargar Plantilla (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openBulkUploadFor('TRABAJADORES')}
                  className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar Trabajadores</span>
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-[#0F1115] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-lg font-mono">
                    Paso 4
                  </span>
                  <Briefcase className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Encargaturas Temporales</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Designaciones formales de jefatura por vacaciones, licencias o comisión de servicios.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => generateTemplateTrabajadores(direccionesOrganos, areas, cargos)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar Plantilla (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openBulkUploadFor('ENCARGATURAS')}
                  className="w-full py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar Encargaturas</span>
                </button>
              </div>
            </div>
          </div>

          {/* Import Rules & Security Notice */}
          <div className="bg-[#111318] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Garantías de Integridad y Reglas del Motor de Carga Masiva DRAC:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-indigo-300">1. Flujo Estricto "Validar ➔ Previsualizar ➔ Confirmar"</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Ningún dato se escribe en la base de datos sin antes pasar por la validación de estructura. Si existen inconsistencias, se muestra la tabla de errores y se permite descargar el reporte en Excel.
                </p>
              </div>

              <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-emerald-300">2. Perfil Base Obligatorio Automático</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Todo trabajador recibe de manera automática el perfil <strong>TRABAJADOR</strong>. Los perfiles adicionales (Jefe Inmediato, RRHH, Vigilancia, etc.) se validan contra la unidad orgánica.
                </p>
              </div>

              <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-300">3. Restricción Estricta de Jefe Inmediato</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Solo se otorga el perfil de Jefe Inmediato a los trabajadores asignados a <em>Dirección, Órganos de Apoyo, Jefatura de Agencia u Oficina Agraria</em>. Cualquier otra asignación es bloqueada con mensaje descriptivo.
                </p>
              </div>

              <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-blue-300">4. Modos de Carga &amp; Protección de Datos Inmutables</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Puede alternar entre "Solo nuevos registros" y "Nuevos y actualización". En ambos casos, el DNI y los identificadores primarios son inmutables para evitar duplicidades o sobreescritura accidental.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DEPENDENCIA */}
      {showDepModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base text-white">
                {editingDep ? 'Editar Dependencia DRAC' : 'Nueva Dependencia DRAC'}
              </h3>
              <button onClick={() => setShowDepModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDependencia} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código Dependencia</label>
                <input
                  type="text"
                  placeholder="Ej: SEDE-01, AA-JAEN"
                  value={depCode}
                  onChange={(e) => setDepCode(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre de la Dependencia</label>
                <input
                  type="text"
                  placeholder="Ej: Sede Central DRAC, Agencia Agraria Jaén"
                  value={depName}
                  onChange={(e) => setDepName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Dependencia</label>
                <select
                  value={depType}
                  onChange={(e) => setDepType(e.target.value as DependenciaType)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="SEDE_CENTRAL">Sede Central DRAC</option>
                  <option value="AGENCIA_AGRARIA">Agencia Agraria</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Categoría administrativa institucional de la dependencia DRAC
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dirección Física / Ubicación</label>
                <input
                  type="text"
                  placeholder="Ej: Av. Independencia 245, Cajamarca"
                  value={depAddress}
                  onChange={(e) => setDepAddress(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                >
                  Guardar Dependencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DIRECCIÓN ÓRGANO */}
      {showDirModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base text-white">
                {editingDir ? 'Editar Dirección / Órgano' : 'Nueva Dirección / Órgano DRAC'}
              </h3>
              <button onClick={() => setShowDirModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDireccionOrgano} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dependencia Perteneciente</label>
                <select
                  value={dirDepId}
                  onChange={(e) => setDirDepId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                >
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({getDependenciaTypeLabel(d.type)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código</label>
                <input
                  type="text"
                  placeholder="Ej: DIR-ADM, DIR-AGR, OFI-AGR"
                  value={dirCode}
                  onChange={(e) => setDirCode(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Dirección / Órgano</label>
                <input
                  type="text"
                  placeholder="Ej: Dirección de Administración, Oficina Agraria Celendín"
                  value={dirName}
                  onChange={(e) => setDirName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Clasificación Orgánica *</label>
                <select
                  value={dirType}
                  onChange={(e) => setDirType(e.target.value as OrganoType)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-medium"
                  required
                >
                  <option value="DIRECCION">DIRECCIÓN</option>
                  <option value="ORGANO_APOYO">ÓRGANOS DE APOYO</option>
                  <option value="JEFATURA_AGENCIA">JEFATURA DE AGENCIA</option>
                  <option value="OFICINA_AGRARIA">OFICINA AGRARIA</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Clasificación orgánica de la Dirección u Órgano en la estructura DRAC
                </span>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                >
                  Guardar Dirección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT AREA */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingArea ? 'Editar Área / Oficina Institucional' : 'Nueva Área / Oficina Institucional'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Estructura organizativa dependiente de la Dirección Regional de Agricultura Cajamarca
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAreaModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitArea} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* ALERTA DE DEPENDENCIA JERÁRQUICA OBLIGATORIA */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Dependencia Jerárquica Obligatoria</span>
                  <span>
                    Toda Área u Oficina debe estar vinculada obligatoriamente a una <strong>Dirección</strong>, <strong>Órgano de Apoyo</strong> u <strong>Oficina Agraria</strong> superior.
                  </span>
                </div>
              </div>

              {/* 1. PERTENECE A (SELECTOR OBLIGATORIO) */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Pertenece a (Unidad Superior) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={areaDirId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAreaDirId(val);
                    const selected = direccionesOrganos.find((d) => d.id === val);
                    if (selected && selected.dependencia_id) {
                      setAreaDepId(selected.dependencia_id);
                    }
                  }}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">-- Seleccionar unidad superior --</option>
                  {direccionesOrganos
                    .filter((d) => d.active || d.id === areaDirId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — [{getOrganoTypeLabel(d.type)}]
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Indica la Dirección, Órgano de Apoyo u Oficina Agraria de la cual depende directamente.
                </span>
              </div>

              {/* 2. NOMBRE DEL ÁREA / OFICINA */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Nombre del Área / Oficina <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Área de Recursos Humanos, Oficina de Informática"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* 3. TIPO Y ESTADO (GRID 2 COLS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Tipo de Unidad <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={areaTipo}
                    onChange={(e) => setAreaTipo(e.target.value as 'AREA' | 'OFICINA')}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="AREA">Área</option>
                    <option value="OFICINA">Oficina</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Estado Operativo <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={areaActive ? 'ACTIVO' : 'INACTIVO'}
                    onChange={(e) => setAreaActive(e.target.value === 'ACTIVO')}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="ACTIVO">ACTIVO (En funciones)</option>
                    <option value="INACTIVO">INACTIVO (Desactivada)</option>
                  </select>
                </div>
              </div>

              {/* 4. CÓDIGO Y ÁREA PADRE (GRID 2 COLS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Código Identificador <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: ARE-001, OFI-RRHH"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Área Padre (Opcional)
                  </label>
                  <select
                    value={parentAreaId}
                    onChange={(e) => setParentAreaId(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Ninguna (Es Área Principal)</option>
                    {areas
                      .filter((a) => !a.parent_area_id && (!editingArea || a.id !== editingArea.id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 5. DESCRIPCIÓN */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Descripción o Funciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve descripción de las funciones técnicas o administrativas..."
                  value={areaDesc}
                  onChange={(e) => setAreaDesc(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAreaModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingArea ? 'Actualizar Área / Oficina' : 'Guardar Área / Oficina'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CARGO */}
      {showCargoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base text-white">
                {editingCargo ? 'Editar Cargo' : 'Nuevo Cargo Institucional DRAC'}
              </h3>
              <button onClick={() => setShowCargoModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCargo} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código Cargo</label>
                <input
                  type="text"
                  placeholder="Ej: CRG-DIR, CRG-ESP"
                  value={cargoCode}
                  onChange={(e) => setCargoCode(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre del Cargo</label>
                <input
                  type="text"
                  placeholder="Ej: Especialista Agrario II, Vigilante"
                  value={cargoName}
                  onChange={(e) => setCargoName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nivel / Escala DRAC</label>
                <select
                  value={cargoNivel}
                  onChange={(e) => setCargoNivel(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="F-5 / Directivo Superior">F-5 / Directivo Superior</option>
                  <option value="F-3 / Ejecutivo">F-3 / Ejecutivo</option>
                  <option value="Profesional / Especialista">Profesional / Especialista</option>
                  <option value="Técnico / Administrativo">Técnico / Administrativo</option>
                  <option value="Auxiliar / Operativo">Auxiliar / Operativo</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCargoModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                >
                  Guardar Cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DESIGNAR JEFE/DIRECTOR */}
      {showRespModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Designar Jefe / Director Responsable</span>
              </h3>
              <button onClick={() => setShowRespModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResponsable} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Seleccionar Trabajador</label>
                <select
                  value={respEmpId}
                  onChange={(e) => setRespEmpId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} (DNI: {e.dni})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Título de Jefatura</label>
                <select
                  value={respTitle}
                  onChange={(e) => setRespTitle(e.target.value as any)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="DIRECTOR">Director</option>
                  <option value="JEFE">Jefe</option>
                  <option value="RESPONSABLE">Responsable</option>
                  <option value="ENCARGADO">Encargado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nivel de Unidad Orgánica</label>
                <select
                  value={respUnitType}
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    setRespUnitType(newType);
                    if (newType === 'DEPENDENCIA') setRespUnitId(dependencias[0]?.id || '');
                    else if (newType === 'DIRECCION_ORGANO') setRespUnitId(direccionesOrganos[0]?.id || '');
                    else setRespUnitId(areas[0]?.id || '');
                  }}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="DIRECCION_ORGANO">Dirección / Órgano</option>
                  <option value="AREA_OFICINA">Área / Oficina</option>
                  <option value="DEPENDENCIA">Dependencia Completa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Unidad Orgánica Específica</label>
                <select
                  value={respUnitId}
                  onChange={(e) => setRespUnitId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                >
                  {respUnitType === 'DEPENDENCIA' &&
                    dependencias.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}

                  {respUnitType === 'DIRECCION_ORGANO' &&
                    direccionesOrganos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.dependencia_name})
                      </option>
                    ))}

                  {respUnitType === 'AREA_OFICINA' &&
                    areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRespModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg"
                >
                  Guardar Designación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT EMPLOYEE DRAC (Compartido con Relojes Biométricos) */}
      <EmployeeFormModal
        isOpen={showEmpModal}
        onClose={() => setShowEmpModal(false)}
        editingEmp={editingEmp}
        dependencias={dependencias}
        direccionesOrganos={direccionesOrganos}
        areas={areas}
        cargos={cargos}
        horarios={horarios}
        responsables={responsables}
        employees={employees}
        activeRole={activeRole}
        onSaveNewEmployee={async (empData) => {
          await onAddEmployee(empData);
        }}
        onSaveEditEmployee={async (emp) => {
          await onEditEmployee(emp);
        }}
      />

      {/* ================================================================= */}
      {/* MODAL: VER PERFIL DE ACCESO & BITÁCORA DE AUDITORÍA DE ROLES      */}
      {/* ================================================================= */}
      {selectedEmpForRoleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-600/20 text-cyan-400 rounded-lg border border-cyan-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Perfil de Acceso &amp; Bitácora de Auditoría</h3>
                  <p className="text-xs text-slate-400">
                    Trazabilidad de seguridad, roles y permisos de {selectedEmpForRoleModal.first_name} {selectedEmpForRoleModal.last_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmpForRoleModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* RESUMEN DEL COLABORADOR */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">DNI</span>
                    <span className="font-mono font-bold text-white">{selectedEmpForRoleModal.dni}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Cód. DRAC</span>
                    <span className="font-mono text-indigo-400 font-bold">{selectedEmpForRoleModal.codigo_trabajador || 'DRAC-2026'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Cargo Laboral</span>
                    <span className="font-semibold text-slate-200">{selectedEmpForRoleModal.position}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Dependencia</span>
                    <span className="text-slate-300">{selectedEmpForRoleModal.dependencia_name}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-400">
                    Área: <span className="text-white font-medium">{selectedEmpForRoleModal.area_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Jefe Aprobador: <span className="text-amber-400 font-medium">{selectedEmpForRoleModal.supervisor_name || 'Asignación Jerárquica'}</span>
                  </div>
                </div>
              </div>

              {/* PERFIL DEL SISTEMA ACTUAL */}
              {(() => {
                const currentRoleInfo = SYSTEM_ROLES_CATALOG.find((r) => r.role === selectedEmpForRoleModal.role) || SYSTEM_ROLES_CATALOG[0];
                const hasAccess = selectedEmpForRoleModal.has_system_access !== false;

                return (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Estado de Cuenta y Perfil Vigente
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          hasAccess && selectedEmpForRoleModal.account_status !== 'INACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {hasAccess ? (selectedEmpForRoleModal.account_status || 'ACTIVA') : 'SIN ACCESO AL SISTEMA'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${currentRoleInfo.color}`}>
                        <Shield className="w-3.5 h-3.5" />
                        <span>{currentRoleInfo.badge}</span>
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white">{currentRoleInfo.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Usuario: @{selectedEmpForRoleModal.username || selectedEmpForRoleModal.dni} | Auth: {selectedEmpForRoleModal.auth_method || 'PASSWORD'}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300">{currentRoleInfo.description}</p>

                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Permisos activos de este perfil:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {currentRoleInfo.permissions.map((perm, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                            <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>{perm}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* BITÁCORA DE AUDITORÍA Y TRAZABILIDAD DE ROLES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Bitácora de Trazabilidad y Cambios de Perfil
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Registros: {selectedEmpForRoleModal.role_history?.length || 1}
                  </span>
                </div>

                <div className="space-y-2">
                  {(selectedEmpForRoleModal.role_history && selectedEmpForRoleModal.role_history.length > 0) ? (
                    selectedEmpForRoleModal.role_history.map((hist, idx) => (
                      <div key={hist.id || idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-cyan-400 font-bold">Evento #{idx + 1}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400 text-[10px]">{hist.changed_at}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Por: <strong className="text-slate-200">{hist.changed_by}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                            {hist.previous_role}
                          </span>
                          <span className="text-slate-500">➔</span>
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800">
                            {hist.new_role}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-[10px] text-slate-400">
                            Estado: <strong className="text-emerald-400">{hist.new_status}</strong>
                          </span>
                        </div>

                        {hist.reason && (
                          <div className="text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 italic">
                            "{hist.reason}"
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl text-center">
                      <p className="text-xs text-slate-400">
                        Perfil asignado al momento de su registro inicial ({selectedEmpForRoleModal.hire_date}). Sin modificaciones posteriores.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedEmpForRoleModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE ASIGNACIONES DEL PERSONAL */}
      {selectedEmpForHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Historial de Asignaciones Orgánicas</h3>
                  <p className="text-xs text-slate-400">
                    Colaborador: <span className="text-amber-400 font-bold">{selectedEmpForHistory.first_name} {selectedEmpForHistory.last_name}</span> (DNI: {selectedEmpForHistory.dni})
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedEmpForHistory(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {(() => {
                const historyList = assignmentHistory.filter((h) => h.employee_id === selectedEmpForHistory.id);
                if (historyList.length === 0) {
                  return (
                    <div className="p-6 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
                      <p className="text-xs text-slate-400">No hay traslados o reasignaciones registradas aún. Asignación inicial vigente desde {selectedEmpForHistory.hire_date}.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {historyList.map((hist, idx) => (
                      <div key={hist.id || idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-indigo-400 font-bold">Asignación #{historyList.length - idx}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                            Vigencia: {hist.start_date} ➔ {hist.end_date || 'VIGENTE ACTUAL'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Área / Oficina</span>
                            <span className="text-white font-semibold">{hist.area_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Cargo</span>
                            <span className="text-slate-200">{hist.position}</span>
                          </div>
                        </div>
                        {hist.change_reason && (
                          <div className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/80 italic">
                            Motivo registrado: "{hist.change_reason}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 text-right shrink-0">
              <button
                onClick={() => setSelectedEmpForHistory(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESUMEN DE POLÍTICA DE INTEGRIDAD Y TRAZABILIDAD DE DATOS */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Política Institucional de Clasificación de Datos</h3>
              </div>
              <button onClick={() => setShowPolicyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs text-slate-300">
              <p className="leading-relaxed text-slate-400">
                Para garantizar la integridad estricta del historial institucional y evitar alteraciones retrospectivas en papeletas, asistencias o vacaciones, cada dato del sistema se rige por las siguientes cuatro categorías de protección:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>A. Dato No Editable (Inmutable)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Bloqueado permanentemente tras su creación. DNI, ID Biométrico, timestamp de marcación ZKTeco, número de papeleta y fechas de auditoría.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>B. Dato Editable con Trazabilidad</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Modificable creando versiones o registros históricos automáticos. Área del personal, Cargo, Teléfono, Correo e Instructivos.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>C. Dato Configurable (Vigencia)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Modifica comportamiento futuro con fecha de inicio de vigencia. Horarios de trabajo, turnos y tolerancias.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <Power className="w-3.5 h-3.5" />
                    <span>D. Dato Desactivable (Soft Delete)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    No se elimina de la base de datos. Se desactiva mediante un flag lógico para mantener la validez de reportes pasados.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 text-right shrink-0">
              <button
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FICHA INTEGRAL DEL SERVIDOR DRAC */}
      {selectedEmpForDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-base border border-indigo-500/30">
                  {selectedEmpForDetail.first_name[0]}
                  {selectedEmpForDetail.last_name[0]}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base text-white">
                      {empProfileData?.personal.full_name ||
                        `${selectedEmpForDetail.first_name} ${selectedEmpForDetail.last_name}`}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        selectedEmpForDetail.active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {selectedEmpForDetail.active ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                    {empProfileLoading && (
                      <span className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando ficha...
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 font-mono mt-0.5">
                    <span className="text-indigo-400 font-bold">
                      Cód: {empProfileData?.personal.codigo_drac || selectedEmpForDetail.codigo_trabajador || 'DRAC-2026'}
                    </span>
                    <span>•</span>
                    <span>DNI: {selectedEmpForDetail.dni}</span>
                    <span>•</span>
                    <span className="text-cyan-400 font-semibold">@{selectedEmpForDetail.username || selectedEmpForDetail.dni}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">
                      PIN Reloj: {empProfileData?.biometrico.pin_principal || selectedEmpForDetail.zkteco_pin || selectedEmpForDetail.dni}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmpForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-6 pt-3 border-b border-slate-800 bg-[#090A0D] flex gap-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setProfileModalTab('GENERAL')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                  profileModalTab === 'GENERAL'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                1. Personal e Institucional
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab('BIOMETRICO')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                  profileModalTab === 'BIOMETRICO'
                    ? 'border-cyan-500 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                2. Vinculación Biométrica ({empProfileData?.biometrico.dispositivos_vinculados.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab('ASISTENCIA')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                  profileModalTab === 'ASISTENCIA'
                    ? 'border-emerald-500 text-emerald-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                3. Asistencia, Tardanzas y Licencias ({empProfileData?.asistencia.resumen.total_marcaciones || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {profileModalTab === 'GENERAL' && (
                <>
                  {/* Sección 1: Información Personal */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sky-400 font-bold uppercase tracking-wider text-[10px]">
                      <Users className="w-3.5 h-3.5" />
                      <span>Información Personal y de Contacto</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Nombres Completos:</span>
                        <span className="font-semibold text-white text-xs mt-0.5 block">
                          {selectedEmpForDetail.first_name} {selectedEmpForDetail.last_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">DNI / Documento:</span>
                        <span className="font-mono font-bold text-indigo-300 text-xs mt-0.5 block">{selectedEmpForDetail.dni}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Código DRAC:</span>
                        <span className="font-mono font-bold text-cyan-300 text-xs mt-0.5 block">
                          {empProfileData?.personal.codigo_drac || selectedEmpForDetail.codigo_trabajador}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Correo Institucional:</span>
                        <span className="text-slate-200 text-xs mt-0.5 block break-all">
                          {selectedEmpForDetail.email || 'Sin correo'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Teléfono de Contacto:</span>
                        <span className="text-slate-200 font-mono text-xs mt-0.5 block">
                          {canViewSensitivePersonal
                            ? empProfileData?.personal.phone || selectedEmpForDetail.phone || 'No registrado'
                            : 'Restringido por rol'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Fecha de Ingreso:</span>
                        <span className="font-mono text-slate-300 text-xs mt-0.5 block">
                          {selectedEmpForDetail.hire_date || 'No registrada'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Información Institucional y Horario */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Información Institucional, Régimen y Horario Asignado</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Sede / Dependencia:</span>
                        <span className="font-semibold text-white text-xs mt-0.5 block">
                          {empProfileData?.institucional.sede_dependencia || selectedEmpForDetail.dependencia_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Agencia Agraria:</span>
                        <span className="font-semibold text-slate-200 text-xs mt-0.5 block">
                          {empProfileData?.institucional.agencia_agraria || 'Sede Central / No aplica'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Dirección / Órgano:</span>
                        <span className="font-semibold text-white text-xs mt-0.5 block">
                          {empProfileData?.institucional.direccion_organo || selectedEmpForDetail.direccion_organo_name || 'Sin Dirección Asignada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Área / Oficina:</span>
                        <span className="font-semibold text-white text-xs mt-0.5 block">
                          {empProfileData?.institucional.area_oficina || selectedEmpForDetail.area_name || 'Sin Área'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Subárea / Sector:</span>
                        <span className="font-semibold text-slate-300 text-xs mt-0.5 block">
                          {empProfileData?.institucional.subarea || selectedEmpForDetail.subarea_name || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Cargo Institucional:</span>
                        <span className="font-bold text-indigo-300 text-xs mt-0.5 block">
                          {empProfileData?.institucional.cargo || selectedEmpForDetail.position}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Régimen Laboral:</span>
                        <span className="px-2 py-0.5 bg-slate-800 text-indigo-300 font-mono font-bold rounded border border-slate-700 inline-block mt-0.5 text-[11px]">
                          {selectedEmpForDetail.regimen_laboral}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Condición Laboral:</span>
                        <span className="font-semibold text-slate-300 text-xs mt-0.5 block">{selectedEmpForDetail.condicion_laboral}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Horario Asignado:</span>
                        <span className="font-semibold text-emerald-300 text-xs mt-0.5 block">
                          {empProfileData?.institucional.horario_asignado.name || selectedEmpForDetail.schedule_name || 'Horario Institucional'}
                        </span>
                        {(empProfileData?.institucional.horario_asignado.turno1 || empProfileData?.institucional.horario_asignado.turno2) && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {[empProfileData?.institucional.horario_asignado.turno1, empProfileData?.institucional.horario_asignado.turno2]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gobernanza RBAC y VoBo */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Perfil del Sistema, Seguridad & Aprobadores</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Perfil Principal & Secundarios:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getEmployeeAssignedRoles(selectedEmpForDetail).map((r) => {
                            const rDef = SYSTEM_ROLES_CATALOG.find((x) => x.role === r) || SYSTEM_ROLES_CATALOG[0];
                            return (
                              <span
                                key={r}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded border inline-flex items-center gap-1 ${rDef.color}`}
                              >
                                <Shield className="w-2.5 h-2.5" />
                                <span>{rDef.badge}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Jefe Inmediato Asignado (VoBo):</span>
                        <div className="font-bold text-amber-300 text-xs mt-1 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{selectedEmpForDetail.supervisor_name || 'Asignación Jerárquica Directa'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Estado de Primer Ingreso:</span>
                        <div className="mt-1">
                          {selectedEmpForDetail.primer_ingreso === 'PENDIENTE' || selectedEmpForDetail.password_change_required ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-semibold inline-block">
                              Pendiente de cambio de clave
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold inline-block">
                              Contraseña definitiva activa
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {profileModalTab === 'BIOMETRICO' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-400 text-[11px] block">PIN / User ID Principal:</span>
                      <span className="font-mono text-cyan-300 font-bold text-sm mt-0.5 block">
                        {empProfileData?.biometrico.pin_principal || selectedEmpForDetail.zkteco_pin || selectedEmpForDetail.dni}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Estado de Vinculación:</span>
                      <span className="font-mono text-emerald-300 font-bold text-xs mt-0.5 block">
                        {empProfileData?.biometrico.estado_vinculacion || selectedEmpForDetail.biometric_sync_status || 'SINCRONIZADO'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Fecha de Última Vinculación:</span>
                      <span className="font-mono text-slate-300 text-xs mt-0.5 block">
                        {empProfileData?.biometrico.fecha_vinculacion || selectedEmpForDetail.biometric_last_sync || 'Sin registro'}
                      </span>
                    </div>
                  </div>

                  {/* Lista de dispositivos vinculados */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-[10px]">
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Dispositivos Biométricos Vinculados por Número de Serie (device_sn + PIN)</span>
                    </div>
                    {!empProfileData?.biometrico.dispositivos_vinculados.length ? (
                      <div className="p-4 bg-[#090A0D] border border-slate-800 rounded-xl text-slate-400 text-center">
                        Aún no existen vínculos por número de serie registrados en la tabla de usuarios de reloj para este trabajador.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#090A0D]">
                        <table className="w-full min-w-[600px] text-left text-[11px]">
                          <thead className="border-b border-slate-800 text-slate-400">
                            <tr>
                              <th className="p-2.5">Reloj Biométrico</th>
                              <th className="p-2.5">Número de Serie</th>
                              <th className="p-2.5">PIN</th>
                              <th className="p-2.5">Nombre en Reloj</th>
                              <th className="p-2.5">Estado</th>
                              <th className="p-2.5">Vinculado el</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {empProfileData.biometrico.dispositivos_vinculados.map((dv) => (
                              <tr key={dv.id}>
                                <td className="p-2.5 text-white font-semibold">{dv.device_name}</td>
                                <td className="p-2.5 font-mono text-indigo-300">{dv.device_sn}</td>
                                <td className="p-2.5 font-mono text-cyan-300 font-bold">{dv.pin}</td>
                                <td className="p-2.5 text-slate-400 font-mono">{dv.clock_name_origin || '—'}</td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                    {dv.link_status}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono text-slate-400">{dv.linked_at ? dv.linked_at.substring(0, 19).replace('T', ' ') : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Controles Maestro DRAC -> Reloj */}
                  <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
                    {syncFeedback && (
                      <div
                        className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                          syncFeedback.type === 'SUCCESS'
                            ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
                            : syncFeedback.type === 'ERROR'
                            ? 'bg-rose-950/30 border-rose-800 text-rose-200'
                            : 'bg-indigo-950/30 border-indigo-800 text-indigo-200'
                        }`}
                      >
                        {syncFeedback.type === 'SUCCESS' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-bold">{syncFeedback.message}</p>
                          {syncFeedback.device_name && (
                            <p className="text-[11px] text-slate-400 font-mono">
                              Dispositivo: {syncFeedback.device_name} • User ID: {syncFeedback.biometric_user_id} • Fecha:{' '}
                              {syncFeedback.timestamp}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {canManageOrg && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-300">Destino:</label>
                          <select
                            value={selectedSyncDeviceId}
                            onChange={(e) => setSelectedSyncDeviceId(e.target.value)}
                            className="bg-[#060709] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-cyan-500 focus:outline-none"
                          >
                            {devices.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.ip_address}:{d.port})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          {selectedEmpForDetail.active && (
                            <button
                              type="button"
                              disabled={syncingEmpId === selectedEmpForDetail.id}
                              onClick={async () => {
                                const emp = selectedEmpForDetail;
                                const targetDev = devices.find((d) => d.id === selectedSyncDeviceId) || devices[0];
                                if (!targetDev) return;

                                setSyncingEmpId(emp.id);
                                setSyncFeedback(null);

                                try {
                                  const res = await syncEmployeeToDevice(emp, targetDev);
                                  if (res.success) {
                                    const updatedEmp: Employee = {
                                      ...emp,
                                      biometric_user_id: res.biometric_user_id,
                                      biometric_sync_status: 'SINCRONIZADO',
                                      biometric_last_sync: res.timestamp || new Date().toLocaleString('es-PE'),
                                      biometric_sync_device_id: targetDev.id,
                                      biometric_sync_device_name: targetDev.name,
                                    };
                                    onEditEmployee(updatedEmp);
                                    setSelectedEmpForDetail(updatedEmp);
                                    setSyncFeedback({
                                      type: 'SUCCESS',
                                      message: `✓ Trabajador sincronizado correctamente con ${targetDev.name}`,
                                      biometric_user_id: res.biometric_user_id,
                                      device_name: targetDev.name,
                                      timestamp: res.timestamp || new Date().toLocaleString('es-PE'),
                                    });
                                  } else {
                                    setSyncFeedback({
                                      type: 'ERROR',
                                      message: `✕ Error: ${res.message}`,
                                    });
                                  }
                                } catch (err: any) {
                                  setSyncFeedback({
                                    type: 'ERROR',
                                    message: `✕ Error al enviar al biométrico: ${err?.message || 'Fallo de conexión'}`,
                                  });
                                } finally {
                                  setSyncingEmpId(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
                            >
                              <Zap className={`w-3.5 h-3.5 ${syncingEmpId === selectedEmpForDetail.id ? 'animate-spin' : ''}`} />
                              <span>{syncingEmpId === selectedEmpForDetail.id ? 'Enviando...' : 'Enviar al Reloj'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={syncingEmpId === selectedEmpForDetail.id}
                            onClick={async () => {
                              const emp = selectedEmpForDetail;
                              const targetDev = devices.find((d) => d.id === selectedSyncDeviceId) || devices[0];
                              if (!targetDev) return;

                              setSyncingEmpId(emp.id);
                              setSyncFeedback(null);

                              try {
                                const res = await disableUserOnDevice(emp, targetDev);
                                if (res.success) {
                                  const updatedEmp: Employee = {
                                    ...emp,
                                    biometric_sync_status: 'DESACTIVADO',
                                    biometric_last_sync: new Date().toLocaleString('es-PE'),
                                  };
                                  onEditEmployee(updatedEmp);
                                  setSelectedEmpForDetail(updatedEmp);
                                  setSyncFeedback({
                                    type: 'INFO',
                                    message: `Trabajador desactivado en el terminal ${targetDev.name}`,
                                    biometric_user_id: emp.biometric_user_id || emp.dni,
                                    device_name: targetDev.name,
                                    timestamp: new Date().toLocaleString('es-PE'),
                                  });
                                } else {
                                  setSyncFeedback({
                                    type: 'ERROR',
                                    message: `Error al desactivar: ${res.message}`,
                                  });
                                }
                              } catch (err: any) {
                                setSyncFeedback({
                                  type: 'ERROR',
                                  message: `Error: ${err?.message}`,
                                });
                              } finally {
                                setSyncingEmpId(null);
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                          >
                            Desactivar en Biométrico
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {profileModalTab === 'ASISTENCIA' && empProfileData && (
                <div className="space-y-4">
                  {/* KPIs Consolidados */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase block">Marcaciones Totales</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {empProfileData.asistencia.resumen.total_marcaciones}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {empProfileData.asistencia.resumen.entradas} Ent · {empProfileData.asistencia.resumen.salidas} Sal
                      </span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase block">Días Asistidos / Horas</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {empProfileData.asistencia.resumen.dias_asistencia} d
                      </span>
                      <span className="text-[10px] text-emerald-300/80 block font-mono">
                        {empProfileData.asistencia.resumen.horas_trabajadas} hrs acumuladas
                      </span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase block">Tardanzas / Faltas</span>
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {empProfileData.asistencia.resumen.tardanzas_dias} / {empProfileData.asistencia.resumen.inasistencias}
                      </span>
                      <span className="text-[10px] text-amber-300/80 block font-mono">
                        {empProfileData.asistencia.resumen.tardanzas_minutos_netos} min netos tardanza
                      </span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase block">Papeletas / Vacaciones</span>
                      <span className="text-lg font-bold font-mono text-indigo-300">
                        {empProfileData.asistencia.resumen.papeletas_total} / {empProfileData.asistencia.resumen.vacaciones_total}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Solicitudes registradas</span>
                    </div>
                  </div>

                  {/* Marcaciones Recientes */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Historial Reciente de Marcaciones Biométricas
                    </div>
                    {empProfileData.asistencia.marcaciones_recientes.length === 0 ? (
                      <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg text-slate-400">
                        No hay marcaciones biométricas registradas para este servidor.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#090A0D]">
                        <table className="w-full min-w-[540px] text-left text-[11px]">
                          <thead className="border-b border-slate-800 text-slate-400">
                            <tr>
                              <th className="p-2.5">Fecha y Hora</th>
                              <th className="p-2.5">Dispositivo / S/N</th>
                              <th className="p-2.5">Tipo / Método</th>
                              <th className="p-2.5">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {empProfileData.asistencia.marcaciones_recientes.map((m) => (
                              <tr key={m.id}>
                                <td className="p-2.5 font-mono text-amber-300">{m.timestamp}</td>
                                <td className="p-2.5 text-slate-300">
                                  {m.device_name || m.device_sn} <span className="text-slate-500 font-mono">({m.device_sn})</span>
                                </td>
                                <td className="p-2.5 font-mono text-slate-300">
                                  {m.punch_state === 1 || m.punch_type === 'CHECK_OUT' ? 'SALIDA' : 'ENTRADA'} · {m.verify_mode}
                                </td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                                    {m.validation_status || 'VALIDA'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Papeletas y Vacaciones */}
                  {(empProfileData.asistencia.papeletas.length > 0 || empProfileData.asistencia.vacaciones.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold uppercase text-amber-400">Papeletas de Salida ({empProfileData.asistencia.papeletas.length})</div>
                        {empProfileData.asistencia.papeletas.length === 0 ? (
                          <p className="text-slate-500">Sin papeletas</p>
                        ) : (
                          empProfileData.asistencia.papeletas.slice(0, 5).map((pap) => (
                            <div key={pap.id} className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 last:border-0 last:pb-0">
                              <div>
                                <div className="font-mono text-indigo-300 font-bold">{pap.code} · {pap.fecha}</div>
                                <div className="text-slate-400 text-[10px]">{pap.motivo}</div>
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px]">{pap.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold uppercase text-emerald-400">Vacaciones ({empProfileData.asistencia.vacaciones.length})</div>
                        {empProfileData.asistencia.vacaciones.length === 0 ? (
                          <p className="text-slate-500">Sin vacaciones</p>
                        ) : (
                          empProfileData.asistencia.vacaciones.slice(0, 5).map((vac) => (
                            <div key={vac.id} className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 last:border-0 last:pb-0">
                              <div>
                                <div className="font-mono text-emerald-300 font-bold">{vac.start_date} → {vac.end_date}</div>
                                <div className="text-slate-400 text-[10px]">{vac.total_days || vac.dias_solicitados} día(s) · {vac.tipo}</div>
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px]">{vac.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setSelectedEmpForDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cerrar
              </button>
              {canManageOrg && (
                <button
                  onClick={() => {
                    const emp = selectedEmpForDetail;
                    setSelectedEmpForDetail(null);
                    setEditingEmp(emp);
                    setShowEmpModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar Datos del Servidor</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FICHA DE ÁMBITO DE APROBACIÓN VOBO (JEFATURA) */}
      {selectedJefeForDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-amber-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base border border-amber-500/30">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">
                      {selectedJefeForDetail.employee.first_name} {selectedJefeForDetail.employee.last_name}
                    </h3>
                    {selectedJefeForDetail.isEncargado ? (
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold rounded-full">
                        Encargado (e)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-full">
                        Jefe Titular
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 font-mono mt-0.5">
                    <span>{selectedJefeForDetail.employee.position}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">{selectedJefeForDetail.dirName}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedJefeForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Resumen de Métricas de Aprobación */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Equipo a Cargo</div>
                  <div className="text-lg font-extrabold text-amber-400 mt-0.5">
                    {selectedJefeForDetail.supervisedEmployees.length}
                  </div>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Papeletas por Visar</div>
                  <div className="text-lg font-extrabold text-indigo-400 mt-0.5">
                    {selectedJefeForDetail.pendingPapeletasCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Dirección / Órgano</div>
                  <div className="text-[11px] font-bold text-white mt-1 truncate" title={selectedJefeForDetail.dirName}>
                    {selectedJefeForDetail.dirName}
                  </div>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Área / Oficina</div>
                  <div className="text-[11px] font-bold text-white mt-1 truncate" title={selectedJefeForDetail.areaName}>
                    {selectedJefeForDetail.areaName}
                  </div>
                </div>
              </div>

              {/* Lista de Personal Bajo su Ámbito de VoBo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                    <Users className="w-3.5 h-3.5" />
                    <span>Personal Supervisado para VoBo de Papeletas y Permisos ({selectedJefeForDetail.supervisedEmployees.length})</span>
                  </div>
                </div>

                {selectedJefeForDetail.supervisedEmployees.length === 0 ? (
                  <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
                    No se registran servidores subordinados directamente en esta área u oficina actualmente.
                  </div>
                ) : (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                    {selectedJefeForDetail.supervisedEmployees.map((subEmp) => (
                      <div key={subEmp.id} className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20 shrink-0">
                            {subEmp.first_name[0]}
                            {subEmp.last_name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">
                              {subEmp.first_name} {subEmp.last_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              DNI: {subEmp.dni} • Cargo: {subEmp.position}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 font-mono text-[9px] rounded border border-slate-700">
                            {subEmp.regimen_laboral}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                              subEmp.active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {subEmp.active ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end">
              <button
                onClick={() => setSelectedJefeForDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cerrar Ficha de Jefatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATA POLICY CONFIRMATION MODAL */}
      <DataPolicyConfirmModal config={confirmModalConfig} />

      {/* BULK UPLOAD MODAL WIZARD */}
      {showBulkModal && (
        <BulkUploadModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          initialEntityType={bulkInitialEntity}
          dependencias={dependencias}
          direccionesOrganos={direccionesOrganos}
          areas={areas}
          cargos={cargos}
          employees={employees}
          encargaturas={[]}
          horarios={horarios}
          onConfirmDirecciones={(validDirs, updateDirs, summary) => {
            if (onBulkImportDirecciones) {
              onBulkImportDirecciones(validDirs, updateDirs, summary);
            } else {
              validDirs.forEach((dir) => onAddDireccionOrgano(dir));
              updateDirs.forEach((dir) => onEditDireccionOrgano(dir));
            }
          }}
          onConfirmAreas={(validAreas, updateAreas, summary) => {
            if (onBulkImportAreas) {
              onBulkImportAreas(validAreas, updateAreas, summary);
            } else {
              validAreas.forEach((area) => onAddArea(area));
              updateAreas.forEach((area) => onEditArea(area));
            }
          }}
          onConfirmTrabajadores={(validEmps, updateEmps, summary) => {
            if (onBulkImportTrabajadores) {
              onBulkImportTrabajadores(validEmps, updateEmps, summary);
            } else {
              validEmps.forEach((emp) => onAddEmployee(emp));
              updateEmps.forEach((emp) => onEditEmployee(emp));
            }
          }}
          onConfirmEncargaturas={(validEncs) => {
            // Handled when encargaturas module is active or in App.tsx
          }}
        />
      )}

      {/* MODAL: RESTABLECER CONTRASEÑA TEMPORAL (ADMIN / RRHH) */}
      {showResetPasswordModal && selectedEmpForPasswordReset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Restablecer Contraseña Temporal</h3>
                  <p className="text-[11px] text-slate-400">Credencial de acceso para servidor público DRAC</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedEmpForPasswordReset(null);
                  setResetPasswordError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Employee Summary Card */}
              <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
                  {selectedEmpForPasswordReset.first_name[0]}
                  {selectedEmpForPasswordReset.last_name[0]}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white text-xs">
                    {selectedEmpForPasswordReset.first_name} {selectedEmpForPasswordReset.last_name}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono mt-0.5">
                    <span>DNI: {selectedEmpForPasswordReset.dni}</span>
                    <span>•</span>
                    <span className="text-indigo-400 font-bold">@{selectedEmpForPasswordReset.username || selectedEmpForPasswordReset.dni}</span>
                  </div>
                </div>
              </div>

              {/* Information Notice */}
              <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Flujo de Seguridad Obligatorio</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Al restablecer la contraseña temporal (definible libremente, ej: <code>123456</code>), el estado del usuario volverá a <strong>"Primer Ingreso: Pendiente"</strong>. Al iniciar sesión, la plataforma exigirá obligatoriamente el cambio de contraseña aplicando las directivas de seguridad.
                </p>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200 text-xs">
                  Nueva Contraseña Temporal de Primer Acceso
                </label>
                <div className="relative">
                  <input
                    type={showResetPasswordEye ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => {
                      setResetNewPassword(e.target.value);
                      if (resetPasswordError) setResetPasswordError(null);
                    }}
                    placeholder="Ej: 123456"
                    className="w-full bg-[#060709] border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordEye(!showResetPasswordEye)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showResetPasswordEye ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Puede utilizar un valor sencillo temporal; la complejidad se validará en el primer acceso del usuario.
                </p>
              </div>

              {resetPasswordError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{resetPasswordError}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedEmpForPasswordReset(null);
                  setResetPasswordError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!resetNewPassword.trim()) {
                    setResetPasswordError('Por favor ingrese una contraseña temporal válida.');
                    return;
                  }
                  const targetEmp = selectedEmpForPasswordReset;
                  const { hash, salt } = await hashPassword(resetNewPassword.trim());
                  onEditEmployee({
                    ...targetEmp,
                    password_hash: hash,
                    password_salt: salt,
                    password_change_required: true,
                    primer_ingreso: 'PENDIENTE',
                    last_password_change: undefined,
                  });
                  setShowResetPasswordModal(false);
                  setSelectedEmpForPasswordReset(null);
                  setResetPasswordError(null);
                  setOrgActionFeedback(
                    `Contraseña temporal restablecida con éxito para @${targetEmp.username || targetEmp.dni}. Se solicitará cambio obligatorio en su próximo inicio de sesión.`
                  );
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-600/20"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Restablecer y Forzar 1er Ingreso</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
