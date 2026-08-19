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
} from 'lucide-react';
import {
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  ResponsableDesignation,
  Employee,
  RoleType,
  RoleHistoryEntry,
  Horario,
  RegimenLaboral,
  CondicionLaboral,
  DependenciaType,
  OrganoType,
  EmployeeAssignmentHistory,
} from '../../types';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';
import { VALID_JEFE_ORGANO_TYPES, getEmployeeAssignedRoles } from '../../utils/encargaturaUtils';
import { generateUniqueUsername, hashPassword } from '../../utils/userAuthUtils';
import { generateNextDracCode } from '../../utils/dracCodeUtils';
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

export interface SystemRoleDef {
  role: RoleType;
  label: string;
  badge: string;
  isDefault: boolean;
  isSpecial: boolean;
  color: string;
  accentColor: string;
  description: string;
  scopeRule?: string;
  permissions: string[];
}

export const getOrganoTypeLabel = (type?: string): string => {
  if (!type) return 'Sin Clasificación';
  switch (type) {
    case 'DIRECCION':
      return 'Dirección';
    case 'ORGANO_APOYO':
      return 'Órganos de Apoyo';
    case 'JEFATURA_AGENCIA':
      return 'Jefatura de Agencia';
    case 'OFICINA_AGRARIA':
      return 'Oficina Agraria';
    default:
      return type;
  }
};

export const getDependenciaTypeLabel = (type?: string): string => {
  if (!type) return 'Dependencia DRAC';
  switch (type) {
    case 'SEDE_CENTRAL':
      return 'Sede Central DRAC';
    case 'AGENCIA_AGRARIA':
      return 'Agencia Agraria';
    default:
      return type;
  }
};

export const SYSTEM_ROLES_CATALOG: SystemRoleDef[] = [
  {
    role: 'TRABAJADOR',
    label: 'Trabajador',
    badge: 'Trabajador',
    isDefault: true,
    isSpecial: false,
    color: 'bg-slate-800 text-slate-200 border-slate-700',
    accentColor: 'text-slate-300',
    description: 'Perfil base para todo el personal DRAC. Permite consulta de asistencia individual, registro y firma digital de papeletas de salida y consulta de vacaciones.',
    permissions: [
      'Ver y descargar reporte de asistencia propia',
      'Registrar solicitudes de papeletas de salida con firma digital',
      'Consultar períodos y saldo de vacaciones asignadas',
      'Registro de marcaciones en relojes biométricos ZKTeco',
    ],
  },
  {
    role: 'JEFE',
    label: 'Jefe / Responsable de Unidad',
    badge: 'Jefe',
    isDefault: false,
    isSpecial: true,
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    accentColor: 'text-amber-400',
    description: 'Mando institucional con facultades de supervisión de equipo y otorgamiento de visto bueno (VoBo) a solicitudes de salida.',
    scopeRule: 'El alcance de aprobación de papeletas y supervisión de asistencia se delimita automáticamente a los colaboradores pertenecientes a su Dependencia, Dirección u Órgano y Área asignadas.',
    permissions: [
      'Dar Visto Bueno (VoBo) a papeletas de salida de su ámbito de responsabilidad',
      'Supervisar marcaciones, puntualidad y tardanzas de su equipo',
      'Consultar solicitudes de descanso vacacional de sus dependientes',
      'Todas las funciones base del perfil Trabajador',
    ],
  },
  {
    role: 'JEFE_RRHH',
    label: 'Jefe de Recursos Humanos (RRHH)',
    badge: 'Jefe RRHH',
    isDefault: false,
    isSpecial: true,
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    accentColor: 'text-blue-400',
    description: 'Autoridad en talento humano para la aprobación final institucional de salidas, administración de vacaciones y consolidación de nómina.',
    permissions: [
      'Autorización final institucional de papeletas de salida para garita',
      'Aprobación, asignación y programación de vacaciones de toda la DRAC',
      'Justificación formal de tardanzas, incidencias y olvidos de marcación',
      'Emisión de reportes ejecutivos consolidados para planilla',
    ],
  },
  {
    role: 'VIGILANCIA',
    label: 'Seguridad / Vigilancia (Garita)',
    badge: 'Seguridad / Vigilancia',
    isDefault: false,
    isSpecial: true,
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    accentColor: 'text-purple-400',
    description: 'Personal de garita y portería autorizado para la fiscalización física y sellado en tiempo real de salidas y retornos institucionales.',
    permissions: [
      'Visualizar papeletas de salida con autorización vigente del día',
      'Registrar y sellar la Hora Real de Salida del personal en puerta',
      'Registrar y sellar la Hora Real de Retorno a la sede',
      'Monitoreo en vivo de trabajadores fuera de las instalaciones DRAC',
    ],
  },
  {
    role: 'DIRECTOR_GENERAL',
    label: 'Director General',
    badge: 'Director General',
    isDefault: false,
    isSpecial: true,
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    accentColor: 'text-emerald-400',
    description: 'Máxima autoridad ejecutiva institucional de la Dirección Regional de Agricultura Cajamarca con supervisión macro.',
    permissions: [
      'Supervisión gerencial institucional global de asistencia y operatividad',
      'Acceso a reportes gerenciales e indicadores de cumplimiento por sede',
      'Emisión de directivas y visto bueno de comisiones oficiales de alto nivel',
    ],
  },
  {
    role: 'CONTROL_ASISTENCIA',
    label: 'Control de Asistencia',
    badge: 'Control Asistencia',
    isDefault: false,
    isSpecial: true,
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    accentColor: 'text-cyan-400',
    description: 'Operador técnico especializado responsable del monitoreo de dispositivos biométricos ZKTeco y procesamiento de marcaciones.',
    permissions: [
      'Monitoreo del estado y sincronización de relojes biométricos ZKTeco',
      'Procesamiento de marcaciones e ingesta de logs biométricos brutos',
      'Gestión de tolerancias de turno y justificaciones de asistencia',
      'Emisión de partes de asistencia diaria y mensual institucional',
    ],
  },
  {
    role: 'ADMIN_GENERAL',
    label: 'Administrador General',
    badge: 'Admin General',
    isDefault: false,
    isSpecial: true,
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    accentColor: 'text-rose-400',
    description: 'Superadministrador técnico del sistema con privilegios de configuración global, asignación de perfiles y auditoría de seguridad.',
    permissions: [
      'Registro de trabajadores y asignación de perfiles y cuentas de acceso',
      'Configuración de estructura orgánica (Dependencias, Órganos, Áreas, Cargos)',
      'Configuración de turnos, jornadas y ventanas de marcación biométrica',
      'Auditoría forense completa de logs, seguridad y trazabilidad de cambios',
    ],
  },
];

interface OrgPersonnelModuleProps {
  activeView?: string;
  dependencias: Dependencia[];
  direccionesOrganos: DireccionOrgano[];
  areas: Area[];
  cargos: Cargo[];
  responsables: ResponsableDesignation[];
  employees: Employee[];
  assignmentHistory?: EmployeeAssignmentHistory[];
  horarios: Horario[];
  activeRole: RoleType;

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

  onAddResponsable: (resp: Omit<ResponsableDesignation, 'id'>) => void;
  onEditResponsable: (resp: ResponsableDesignation) => void;
  onDeleteResponsable: (id: string) => void;

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
  responsables,
  employees,
  assignmentHistory = [],
  horarios,
  activeRole,
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
        const term = empSearchTerm.toLowerCase().trim();
        const fullSearch = `${emp.first_name} ${emp.last_name} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.dni} ${emp.codigo_trabajador || ''} ${emp.position} ${emp.username || ''}`.toLowerCase();
        if (!fullSearch.includes(term)) return false;
      }
      if (empFilterDni.trim() && !emp.dni.includes(empFilterDni.trim())) return false;
      if (empFilterRegimen !== 'ALL' && emp.regimen_laboral !== empFilterRegimen) return false;
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
  // TAB 6: RESPONSABLES STATE
  // =========================================================================
  const [respSearchTerm, setRespSearchTerm] = useState('');
  const [respFilterUnitType, setRespFilterUnitType] = useState<string>('ALL');
  const [respSortField, setRespSortField] = useState<string | null>('employee_name');
  const [respSortOrder, setRespSortOrder] = useState<SortOrder>('asc');
  const [respCurrentPage, setRespCurrentPage] = useState<number>(1);
  const [respPageSize, setRespPageSize] = useState<number>(20);

  const respActiveFilterCount = React.useMemo(() => {
    let count = 0;
    if (respFilterUnitType !== 'ALL') count++;
    return count;
  }, [respFilterUnitType]);

  const handleResetRespFilters = () => {
    setRespSearchTerm('');
    setRespFilterUnitType('ALL');
    setRespCurrentPage(1);
  };

  const filteredRespList = React.useMemo(() => {
    return responsables.filter((r) => {
      if (respSearchTerm.trim()) {
        const term = respSearchTerm.toLowerCase().trim();
        const match = `${r.employee_name} ${r.employee_dni} ${r.unit_name} ${r.title}`.toLowerCase();
        if (!match.includes(term)) return false;
      }
      if (respFilterUnitType !== 'ALL' && r.unit_type !== respFilterUnitType) return false;
      return true;
    });
  }, [responsables, respSearchTerm, respFilterUnitType]);

  const sortedRespList = React.useMemo(() => {
    if (!respSortField || !respSortOrder) return filteredRespList;
    return [...filteredRespList].sort((a, b) => {
      let valA: any = a[respSortField as keyof ResponsableDesignation] ?? '';
      let valB: any = b[respSortField as keyof ResponsableDesignation] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return respSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return respSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRespList, respSortField, respSortOrder]);

  const paginatedRespList = React.useMemo(() => {
    const start = (respCurrentPage - 1) * respPageSize;
    return sortedRespList.slice(start, start + respPageSize);
  }, [sortedRespList, respCurrentPage, respPageSize]);

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
  const [areaDesc, setAreaDesc] = useState('');
  const [areaDepId, setAreaDepId] = useState('');
  const [areaDirId, setAreaDirId] = useState('');
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

  // FORM STATES: Employee DRAC
  const [empCode, setEmpCode] = useState('');
  const [empDni, setEmpDni] = useState('');
  const [empFirstName, setEmpFirstName] = useState('');
  const [empLastNamePaterno, setEmpLastNamePaterno] = useState('');
  const [empLastNameMaterno, setEmpLastNameMaterno] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empDepId, setEmpDepId] = useState('');
  const [empDirId, setEmpDirId] = useState('');
  const [empAreaId, setEmpAreaId] = useState('');
  const [empSubareaId, setEmpSubareaId] = useState('');
  const [empCargoId, setEmpCargoId] = useState('');
  const [empCargoName, setEmpCargoName] = useState('Especialista Agrario');
  const [empRegimen, setEmpRegimen] = useState<RegimenLaboral>('D.L. 276');
  const [empCondicion, setEmpCondicion] = useState<CondicionLaboral>('NOMBRADO');
  const [empRole, setEmpRole] = useState<RoleType>('TRABAJADOR');
  const [empAssignedRoles, setEmpAssignedRoles] = useState<RoleType[]>(['TRABAJADOR']);
  const [empIsJefeDirector, setEmpIsJefeDirector] = useState(false);
  const [empScheduleId, setEmpScheduleId] = useState('');
  const [empHireDate, setEmpHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [empActive, setEmpActive] = useState(true);
  const [empZkTecoPin, setEmpZkTecoPin] = useState('');

  // FORM STATES: Perfil del Sistema & Cuenta de Acceso
  const [empHasAccess, setEmpHasAccess] = useState(true);
  const [empUsername, setEmpUsername] = useState('');
  const [empInitialPassword, setEmpInitialPassword] = useState('123456');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [empAccountStatus, setEmpAccountStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [empAuthMethod, setEmpAuthMethod] = useState<'PASSWORD' | 'BIOMETRIC' | 'INSTITUTIONAL'>('PASSWORD');
  const [empRoleChangeReason, setEmpRoleChangeReason] = useState('');
  const [selectedEmpForRoleModal, setSelectedEmpForRoleModal] = useState<Employee | null>(null);

  // RESET PASSWORD MODAL STATE (ADMIN / HR)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedEmpForPasswordReset, setSelectedEmpForPasswordReset] = useState<Employee | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('123456');
  const [showResetPasswordEye, setShowResetPasswordEye] = useState(false);

  // Auto-calculated unique username based on first name + paternal surname (+ maternal surname / suffix if collision)
  const autoCalculatedUsername = React.useMemo(() => {
    return generateUniqueUsername(
      empFirstName,
      empLastNamePaterno,
      empLastNameMaterno,
      employees,
      editingEmp?.id
    );
  }, [empFirstName, empLastNamePaterno, empLastNameMaterno, employees, editingEmp?.id]);

  // SUB-DIRECCIONES & AREAS FILTERED FOR EMP FORM
  const filteredDirsForEmp = direccionesOrganos.filter((d) => d.dependencia_id === empDepId);
  const filteredAreasForEmp = areas.filter((a) => (!empDepId || a.dependencia_id === empDepId) && (!empDirId || a.direccion_organo_id === empDirId) && !a.parent_area_id);
  const filteredSubareasForEmp = areas.filter((a) => a.parent_area_id === empAreaId);

  // --- HANDLERS FOR MODALS & SUBMITS ---
  
  // Dependencia submit
  const handleSubmitDependencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depCode || !depName) return;

    if (editingDep) {
      onEditDependencia({
        ...editingDep,
        code: depCode.trim(),
        name: depName.trim(),
        type: depType,
        address: depAddress.trim(),
      });
    } else {
      onAddDependencia({
        code: depCode.trim(),
        name: depName.trim(),
        type: depType,
        address: depAddress.trim(),
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
        code: dirCode.trim(),
        name: dirName.trim(),
        type: dirType,
        dependencia_id: dirDepId,
        dependencia_name: selectedDep ? selectedDep.name : 'Sede Central DRAC',
      });
    } else {
      onAddDireccionOrgano({
        code: dirCode.trim(),
        name: dirName.trim(),
        type: dirType,
        dependencia_id: dirDepId,
        dependencia_name: selectedDep ? selectedDep.name : 'Sede Central DRAC',
        active: true,
      });
    }
    setShowDirModal(false);
  };

  // Area submit
  const handleSubmitArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaCode || !areaName) return;

    const selectedDep = dependencias.find((d) => d.id === areaDepId);
    const selectedDir = direccionesOrganos.find((d) => d.id === areaDirId);
    const parentArea = areas.find((a) => a.id === parentAreaId);

    if (editingArea) {
      onEditArea({
        ...editingArea,
        code: areaCode.trim(),
        name: areaName.trim(),
        description: areaDesc.trim(),
        dependencia_id: areaDepId || undefined,
        dependencia_name: selectedDep?.name,
        direccion_organo_id: areaDirId || undefined,
        direccion_organo_name: selectedDir?.name,
        parent_area_id: parentAreaId || null,
        parent_area_name: parentArea?.name,
      });
    } else {
      onAddArea({
        code: areaCode.trim(),
        name: areaName.trim(),
        description: areaDesc.trim(),
        dependencia_id: areaDepId || undefined,
        dependencia_name: selectedDep?.name,
        direccion_organo_id: areaDirId || undefined,
        direccion_organo_name: selectedDir?.name,
        parent_area_id: parentAreaId || null,
        parent_area_name: parentArea?.name,
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
        code: cargoCode.trim(),
        name: cargoName.trim(),
        nivel: cargoNivel,
      });
    } else {
      onAddCargo({
        code: cargoCode.trim(),
        name: cargoName.trim(),
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

  // Employee submit
  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDni = empDni.trim();
    if (!cleanDni || !empFirstName.trim() || !empLastNamePaterno.trim() || !empLastNameMaterno.trim() || !empDepId || !empDirId) {
      alert('⚠️ Error de Validación:\nDebe completar obligatoriamente:\n- DNI (8 dígitos numéricos)\n- Nombres\n- Apellido Paterno\n- Apellido Materno\n- Dependencia Institucional\n- Dirección u Órgano');
      return;
    }

    if (!/^\d{8}$/.test(cleanDni)) {
      alert('⚠️ Formato Inválido:\nEl DNI debe contener exactamente 8 dígitos numéricos.');
      return;
    }

    // Check duplicate DNI
    const dniDuplicate = employees.find(
      (emp) => emp.dni === cleanDni && emp.id !== editingEmp?.id
    );
    if (dniDuplicate) {
      alert(`⚠️ DNI Duplicado:\nYa existe un trabajador registrado con el DNI ${cleanDni} (${dniDuplicate.first_name} ${dniDuplicate.last_name}).`);
      return;
    }

    // Automatic unique username generation based on official DRAC rules
    let finalUsername = empUsername.trim() || autoCalculatedUsername;
    if (empHasAccess) {
      if (!finalUsername) {
        finalUsername = generateUniqueUsername(
          empFirstName,
          empLastNamePaterno,
          empLastNameMaterno,
          employees,
          editingEmp?.id
        );
      }
      // Check duplicate Username among employees with system access
      const usernameDuplicate = employees.find(
        (emp) =>
          emp.has_system_access &&
          emp.username?.toLowerCase() === finalUsername.toLowerCase() &&
          emp.id !== editingEmp?.id
      );
      if (usernameDuplicate) {
        // Auto resolve suffix if conflict still occurred
        finalUsername = generateUniqueUsername(
          empFirstName,
          empLastNamePaterno,
          empLastNameMaterno,
          employees,
          editingEmp?.id
        );
      }
    }

    const selectedDep = dependencias.find((d) => d.id === empDepId);
    if (!selectedDep) {
      alert('Error: La Dependencia seleccionada no existe en la DRAC.');
      return;
    }

    const selectedDir = direccionesOrganos.find((d) => d.id === empDirId);
    const selectedArea = areas.find((a) => a.id === empAreaId);
    const selectedSubarea = areas.find((a) => a.id === empSubareaId);
    const selectedCargo = cargos.find((c) => c.id === empCargoId);
    const selectedSchedule = horarios.find((h) => h.id === empScheduleId);

    // Auto-determine supervisor based on designated leader of unit
    let determinedSupervisorId: string | null = null;
    let determinedSupervisorName: string | undefined = undefined;

    const matchedResp = responsables.find(
      (r) =>
        r.active &&
        ((r.unit_type === 'DIRECCION_ORGANO' && r.unit_id === empDirId) ||
          (empAreaId && r.unit_type === 'AREA_OFICINA' && r.unit_id === empAreaId) ||
          (r.unit_type === 'DEPENDENCIA' && r.unit_id === empDepId))
    );

    if (matchedResp) {
      determinedSupervisorId = matchedResp.employee_id;
      determinedSupervisorName = `${matchedResp.title}: ${matchedResp.employee_name}`;
    }

    const fullLastName = `${empLastNamePaterno.trim()} ${empLastNameMaterno.trim()}`.trim();
    const generatedCode = editingEmp
      ? (editingEmp.codigo_trabajador || empCode.trim() || generateNextDracCode(employees))
      : (empCode.trim() || generateNextDracCode(employees));
    const finalAccountStatus = !empActive ? 'INACTIVE' : (empHasAccess ? empAccountStatus : 'INACTIVE');

    // Ensure base profile TRABAJADOR is always present
    const finalAssignedRoles: RoleType[] = empAssignedRoles.includes('TRABAJADOR')
      ? empAssignedRoles
      : ['TRABAJADOR', ...empAssignedRoles];

    // Priority for primary session role
    let finalPrimaryRole: RoleType = 'TRABAJADOR';
    if (finalAssignedRoles.includes('ADMIN_GENERAL')) finalPrimaryRole = 'ADMIN_GENERAL';
    else if (finalAssignedRoles.includes('DIRECTOR_GENERAL')) finalPrimaryRole = 'DIRECTOR_GENERAL';
    else if (finalAssignedRoles.includes('JEFE_RRHH') || finalAssignedRoles.includes('HR_ADMIN')) finalPrimaryRole = 'JEFE_RRHH';
    else if (finalAssignedRoles.includes('JEFE') || finalAssignedRoles.includes('SUPERVISOR')) finalPrimaryRole = 'JEFE';
    else if (finalAssignedRoles.includes('CONTROL_ASISTENCIA')) finalPrimaryRole = 'CONTROL_ASISTENCIA';
    else if (finalAssignedRoles.includes('VIGILANCIA') || finalAssignedRoles.includes('SECURITY_GUARD')) finalPrimaryRole = 'VIGILANCIA';

    const isDesignatedJefe = empIsJefeDirector || finalAssignedRoles.includes('JEFE');

    if (editingEmp) {
      // Check for Role or Access changes for audit logging
      const roleChanged = editingEmp.role !== finalPrimaryRole || JSON.stringify(editingEmp.assigned_roles) !== JSON.stringify(finalAssignedRoles);
      const accessChanged = (editingEmp.has_system_access !== empHasAccess) || (editingEmp.account_status !== finalAccountStatus);
      const updatedRoleHistory: RoleHistoryEntry[] = [...(editingEmp.role_history || [])];

      if (roleChanged || accessChanged) {
        updatedRoleHistory.push({
          id: `rh-${Date.now()}`,
          previous_role: editingEmp.role,
          new_role: finalPrimaryRole,
          previous_status: editingEmp.has_system_access ? (editingEmp.account_status || 'ACTIVE') : 'INACTIVE',
          new_status: finalAccountStatus,
          changed_at: new Date().toISOString(),
          changed_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General',
          reason: empRoleChangeReason.trim() || (roleChanged ? `Actualización de perfiles asignados: ${finalAssignedRoles.join(' + ')}` : `Actualización del estado de cuenta a ${finalAccountStatus}`),
        });
      }

      onEditEmployee({
        ...editingEmp,
        codigo_trabajador: generatedCode,
        dni: cleanDni,
        first_name: empFirstName.trim(),
        last_name: fullLastName,
        apellido_paterno: empLastNamePaterno.trim(),
        apellido_materno: empLastNameMaterno.trim(),
        email: empEmail.trim() || `${empFirstName.toLowerCase().replace(/\s+/g, '.')}.${empLastNamePaterno.toLowerCase().replace(/\s+/g, '.')}@regioncajamarca.gob.pe`,
        phone: empPhone.trim() || '+51 976000000',
        dependencia_id: empDepId,
        dependencia_name: selectedDep.name,
        direccion_organo_id: empDirId || undefined,
        direccion_organo_name: selectedDir?.name,
        area_id: empAreaId || undefined,
        area_name: selectedArea ? selectedArea.name : undefined,
        subarea_id: empSubareaId || undefined,
        subarea_name: selectedSubarea?.name,
        position: empCargoName.trim() || selectedCargo?.name || 'Servidor Público',
        cargo_id: empCargoId || undefined,
        regimen_laboral: empRegimen,
        condicion_laboral: empCondicion,
        is_jefe_director: isDesignatedJefe,
        unidad_dirigida_id: isDesignatedJefe ? (empDirId || empAreaId) : undefined,
        unidad_dirigida_name: isDesignatedJefe ? (selectedDir?.name || selectedArea?.name) : undefined,
        unidad_dirigida_type: isDesignatedJefe ? selectedDir?.type : undefined,
        // Perfil y cuenta de acceso
        has_system_access: empHasAccess,
        username: empHasAccess ? finalUsername : undefined,
        account_status: finalAccountStatus,
        auth_method: empAuthMethod,
        role: finalPrimaryRole,
        assigned_roles: finalAssignedRoles,
        role_history: updatedRoleHistory,
        // Mantener hash de contraseña y estado de primer ingreso
        password_hash: editingEmp.password_hash,
        password_salt: editingEmp.password_salt,
        password_change_required: editingEmp.password_change_required ?? false,
        primer_ingreso: editingEmp.primer_ingreso ?? (editingEmp.password_change_required ? 'PENDIENTE' : 'COMPLETADO'),
        last_password_change: editingEmp.last_password_change,
        // Laboral
        hire_date: empHireDate,
        active: empActive,
        schedule_id: empScheduleId || undefined,
        schedule_name: selectedSchedule ? selectedSchedule.name : 'Jornada Partida DRAC',
        zkteco_pin: empZkTecoPin.trim() || cleanDni,
        supervisor_id: determinedSupervisorId,
        supervisor_name: determinedSupervisorName,
      });
    } else {
      const initialRoleHistory: RoleHistoryEntry[] = empHasAccess ? [
        {
          id: `rh-${Date.now()}`,
          previous_role: finalPrimaryRole,
          new_role: finalPrimaryRole,
          previous_status: 'ACTIVE',
          new_status: finalAccountStatus,
          changed_at: new Date().toISOString(),
          changed_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General',
          reason: `Registro inicial de trabajador DRAC. Usuario asignado: @${finalUsername}. Perfiles: ${finalAssignedRoles.join(' + ')}`,
        }
      ] : [];

      // Initial temporary password can be defined freely without complexity rules on registration
      const initialPasswordToUse = empInitialPassword.trim() || '123456';
      const { hash: initialHash, salt: initialSalt } = await hashPassword(initialPasswordToUse);

      onAddEmployee({
        codigo_trabajador: generatedCode,
        dni: cleanDni,
        first_name: empFirstName.trim(),
        last_name: fullLastName,
        apellido_paterno: empLastNamePaterno.trim(),
        apellido_materno: empLastNameMaterno.trim(),
        email: empEmail.trim() || `${empFirstName.toLowerCase().replace(/\s+/g, '.')}.${empLastNamePaterno.toLowerCase().replace(/\s+/g, '.')}@regioncajamarca.gob.pe`,
        phone: empPhone.trim() || '+51 976000000',
        dependencia_id: empDepId,
        dependencia_name: selectedDep.name,
        direccion_organo_id: empDirId || undefined,
        direccion_organo_name: selectedDir?.name,
        area_id: empAreaId || undefined,
        area_name: selectedArea ? selectedArea.name : undefined,
        subarea_id: empSubareaId || undefined,
        subarea_name: selectedSubarea?.name,
        position: empCargoName.trim() || selectedCargo?.name || 'Servidor Público',
        cargo_id: empCargoId || undefined,
        regimen_laboral: empRegimen,
        condicion_laboral: empCondicion,
        is_jefe_director: isDesignatedJefe,
        unidad_dirigida_id: isDesignatedJefe ? (empDirId || empAreaId) : undefined,
        unidad_dirigida_name: isDesignatedJefe ? (selectedDir?.name || selectedArea?.name) : undefined,
        unidad_dirigida_type: isDesignatedJefe ? selectedDir?.type : undefined,
        // Perfil y cuenta de acceso
        has_system_access: empHasAccess,
        username: empHasAccess ? finalUsername : undefined,
        account_status: finalAccountStatus,
        auth_method: empAuthMethod,
        role: finalPrimaryRole,
        assigned_roles: finalAssignedRoles,
        role_history: initialRoleHistory,
        // Credenciales iniciales con hash y forzado de cambio en primer ingreso
        password_hash: initialHash,
        password_salt: initialSalt,
        password_change_required: true,
        primer_ingreso: 'PENDIENTE',
        // Laboral
        hire_date: empHireDate,
        active: empActive,
        schedule_id: empScheduleId || undefined,
        schedule_name: selectedSchedule ? selectedSchedule.name : 'Jornada Partida DRAC',
        zkteco_pin: empZkTecoPin.trim() || cleanDni,
        supervisor_id: determinedSupervisorId,
        supervisor_name: determinedSupervisorName,
      });
    }
    setShowEmpModal(false);
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
          <span>Jefes / Aprobadores ({responsables.length})</span>
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

                {activeRole === 'HR_ADMIN' && (
                  <button
                    onClick={() => {
                      if (dependencias.length === 0) {
                        alert('⚠️ Secuencia Obligatoria:\n\n1. Primero debe registrar al menos una Dependencia (ej. Sede Central, Agencia Agraria).\n2. Luego Direcciones u Oficinas.\n3. Posteriormente podrá registrar al Personal.');
                        setActiveTab('DEPENDENCIAS');
                        return;
                      }
                      setEditingEmp(null);
                      const nextDracCode = generateNextDracCode(employees);
                      setEmpCode(nextDracCode);
                      setEmpDni('');
                      setEmpFirstName('');
                      setEmpLastNamePaterno('');
                      setEmpLastNameMaterno('');
                      setEmpEmail('');
                      setEmpPhone('');
                      setEmpDepId(dependencias[0]?.id || '');
                      setEmpDirId(direccionesOrganos.find((d) => d.dependencia_id === dependencias[0]?.id)?.id || '');
                      setEmpAreaId('');
                      setEmpSubareaId('');
                      setEmpCargoId('');
                      setEmpCargoName('');
                      setEmpRegimen('D.L. 276');
                      setEmpCondicion('NOMBRADO');
                      setEmpScheduleId(horarios[0]?.id || '');
                      setEmpHireDate(new Date().toISOString().split('T')[0]);
                      setEmpActive(true);
                      setEmpZkTecoPin('');
                      setEmpHasAccess(true);
                      setEmpUsername('');
                      setEmpRole('TRABAJADOR');
                      setEmpAccountStatus('ACTIVE');
                      setEmpAuthMethod('PASSWORD');
                      setEmpAssignedRoles(['TRABAJADOR']);
                      setEmpIsJefeDirector(false);
                      setEmpRoleChangeReason('');
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
                  { value: 'D.L. 276', label: 'D.L. 276 — Carrera Administrativa' },
                  { value: 'D.L. 728', label: 'D.L. 728 — Régimen Privado' },
                  { value: 'D.L. 1057 (CAS)', label: 'D.L. 1057 — Contratación CAS' },
                  { value: 'LOCACION DE SERVICIOS', label: 'Locación de Servicios (Terceros)' },
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                  <tr>
                    <SortableHeader
                      label="Cód. DRAC / Trabajador"
                      field="first_name"
                      currentField={empSortField}
                      currentOrder={empSortOrder}
                      onSort={handleEmpSort}
                    />
                    <SortableHeader
                      label="DNI / PIN ZKTeco"
                      field="dni"
                      currentField={empSortField}
                      currentOrder={empSortOrder}
                      onSort={handleEmpSort}
                    />
                    <SortableHeader
                      label="Dependencia & Ubicación DRAC"
                      field="dependencia_name"
                      currentField={empSortField}
                      currentOrder={empSortOrder}
                      onSort={handleEmpSort}
                    />
                    <SortableHeader
                      label="Cargo Institucional (Puesto)"
                      field="position"
                      currentField={empSortField}
                      currentOrder={empSortOrder}
                      onSort={handleEmpSort}
                    />
                    <SortableHeader
                      label="Perfil Sistema & Cuenta"
                      field="role"
                      currentField={empSortField}
                      currentOrder={empSortOrder}
                      onSort={handleEmpSort}
                    />
                    <th className="px-4 py-3 text-slate-400">Jefe Inmediato (VoBo)</th>
                    <SortableHeader
                      label="Estado"
                      field="active"
                      currentField={empSortField}
                      currentOrder={empSortOrder}
                      onSort={handleEmpSort}
                    />
                    {activeRole === 'HR_ADMIN' && <th className="px-4 py-3 text-right text-slate-400">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedEmployeesList.map((emp) => {
                    const assignedRolesList = getEmployeeAssignedRoles(emp);
                    const roleConfig = SYSTEM_ROLES_CATALOG.find((r) => r.role === emp.role) || SYSTEM_ROLES_CATALOG[0];
                    const hasAccess = emp.has_system_access !== false;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20">
                              {emp.first_name[0]}
                              {emp.last_name[0]}
                            </div>
                            <div>
                              <div className="font-bold text-white">
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div className="text-[10px] font-mono text-indigo-400">
                                {emp.codigo_trabajador || 'DRAC-2026'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono">
                          <div className="text-slate-200 font-bold">{emp.dni}</div>
                          <div className="text-[10px] text-slate-500">PIN: {emp.zkteco_pin || emp.dni}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-200">{emp.dependencia_name}</div>
                          <div className="text-[10px] text-slate-400">
                            {emp.direccion_organo_name ? `${emp.direccion_organo_name} ➔ ` : ''}
                            {emp.area_name}
                          </div>
                        </td>

                        {/* CARGO INSTITUCIONAL */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{emp.position}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px] font-mono border border-slate-700">
                              {emp.regimen_laboral}
                            </span>
                            <span className="text-[9px] text-slate-500">{emp.condicion_laboral}</span>
                          </div>
                        </td>

                        {/* PERFIL DEL SISTEMA & CUENTA */}
                        <td className="px-4 py-3">
                          {hasAccess ? (
                            <div className="space-y-1.5 max-w-xs">
                              <div className="flex flex-wrap items-center gap-1">
                                {assignedRolesList.map((r, idx) => {
                                  const rDef = SYSTEM_ROLES_CATALOG.find((x) => x.role === r) || SYSTEM_ROLES_CATALOG[0];
                                  return (
                                    <React.Fragment key={r}>
                                      {idx > 0 && <span className="text-[10px] text-slate-500 font-bold">+</span>}
                                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border inline-flex items-center gap-1 ${rDef.color}`}>
                                        <Shield className="w-2.5 h-2.5" />
                                        <span>{rDef.badge}</span>
                                      </span>
                                    </React.Fragment>
                                  );
                                })}
                                <span
                                  className={`w-2 h-2 rounded-full inline-block ml-0.5 ${
                                    emp.account_status === 'INACTIVE' || !emp.active
                                      ? 'bg-rose-500'
                                      : 'bg-emerald-400 ring-2 ring-emerald-400/20'
                                  }`}
                                  title={emp.account_status === 'INACTIVE' || !emp.active ? 'Cuenta Inactiva' : 'Cuenta Activa'}
                                />
                              </div>
                              {emp.is_jefe_director && (
                                <div className="text-[9px] text-amber-300 font-medium flex items-center gap-1">
                                  <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  <span>Titular: {emp.unidad_dirigida_name || emp.direccion_organo_name || emp.area_name}</span>
                                </div>
                              )}
                              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between gap-1 pt-0.5">
                                <div className="flex items-center gap-1">
                                  <UserCog className="w-3 h-3 text-slate-500" />
                                  <span className="text-indigo-300 font-semibold">@{emp.username || emp.dni}</span>
                                </div>
                                {emp.primer_ingreso === 'PENDIENTE' || emp.password_change_required ? (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[9px] font-semibold" title="Deberá cambiar su contraseña temporal en su primer inicio de sesión">
                                    1er Ingreso: Pendiente
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[9px] font-semibold" title="Primer ingreso completado con contraseña segura">
                                    1er Ingreso: Listo
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/60 inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>Sin Cuenta / Solo Biométrico</span>
                              </span>
                              <div className="text-[9px] text-slate-500 italic">No inicia sesión</div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {emp.supervisor_name ? (
                            <div className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{emp.supervisor_name}</span>
                            </div>
                          ) : (
                            <div className="text-slate-500 italic text-[11px]">Asignación Jerárquica Directa</div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                              emp.active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {emp.active ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>

                        {activeRole === 'HR_ADMIN' && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingEmp(emp);
                                  setEmpCode(emp.codigo_trabajador);
                                  setEmpDni(emp.dni);
                                  setEmpFirstName(emp.first_name);
                                  setEmpLastNamePaterno(emp.apellido_paterno || emp.last_name.split(' ')[0] || '');
                                  setEmpLastNameMaterno(emp.apellido_materno || emp.last_name.split(' ')[1] || '');
                                  setEmpEmail(emp.email);
                                  setEmpPhone(emp.phone);
                                  setEmpDepId(emp.dependencia_id);
                                  setEmpDirId(emp.direccion_organo_id || '');
                                  setEmpAreaId(emp.area_id);
                                  setEmpSubareaId(emp.subarea_id || '');
                                  setEmpCargoId(emp.cargo_id || '');
                                  setEmpCargoName(emp.position);
                                  setEmpRegimen(emp.regimen_laboral);
                                  setEmpCondicion(emp.condicion_laboral);
                                  setEmpScheduleId(emp.schedule_id || '');
                                  setEmpHireDate(emp.hire_date);
                                  setEmpActive(emp.active);
                                  setEmpZkTecoPin(emp.zkteco_pin || emp.dni);
                                  setEmpHasAccess(emp.has_system_access !== false);
                                  setEmpUsername(emp.username || (emp.first_name ? `${emp.first_name.charAt(0).toLowerCase()}${(emp.apellido_paterno || emp.last_name.split(' ')[0] || '').toLowerCase()}` : emp.dni));
                                  setEmpRole(emp.role || 'TRABAJADOR');
                                  const existingRoles = getEmployeeAssignedRoles(emp);
                                  setEmpAssignedRoles(existingRoles);
                                  setEmpIsJefeDirector(Boolean(emp.is_jefe_director || existingRoles.includes('JEFE')));
                                  setEmpAccountStatus(emp.account_status || (emp.active ? 'ACTIVE' : 'INACTIVE'));
                                  setEmpAuthMethod(emp.auth_method || 'PASSWORD');
                                  setEmpRoleChangeReason('');
                                  setEmpInitialPassword('');
                                  setShowInitialPassword(false);
                                  setShowEmpModal(true);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                                title="Editar Trabajador y Perfil de Acceso"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {hasAccess && (
                                <button
                                  onClick={() => {
                                    setSelectedEmpForPasswordReset(emp);
                                    setResetNewPassword('123456');
                                    setShowResetPasswordEye(false);
                                    setShowResetPasswordModal(true);
                                  }}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors"
                                  title="Restablecer Contraseña Temporal y Forzar 1er Ingreso"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedEmpForRoleModal(emp)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded transition-colors"
                                title="Ver Perfil de Acceso & Trazabilidad de Roles"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedEmpForHistory(emp)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors"
                                title="Ver Historial de Asignaciones Orgánicas"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
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
                                className="p-1.5 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded transition-colors"
                                title={emp.active ? 'Desactivar Trabajador' : 'Reactivar Trabajador'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
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
              activeRole === 'HR_ADMIN' ? (
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

                  {activeRole === 'HR_ADMIN' && (
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

                {activeRole === 'HR_ADMIN' && (
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

                  {activeRole === 'HR_ADMIN' && (
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

                {activeRole === 'HR_ADMIN' && (
                  <button
                    onClick={() => {
                      setEditingArea(null);
                      setAreaCode('');
                      setAreaName('');
                      setAreaDesc('');
                      setAreaDepId(dependencias[0]?.id || '');
                      setAreaDirId('');
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

              return (
                <div key={area.id} className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{area.code}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                        {staffCount} Personal
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white mb-1">{area.name}</h4>
                    <p className="text-xs text-slate-400 mb-3">{area.description || 'Oficina Operativa DRAC'}</p>

                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Subáreas ({subareas.length})</div>
                      {subareas.map((sub) => (
                        <div key={sub.id} className="p-2 bg-[#090A0D] rounded border border-slate-800 text-xs flex justify-between">
                          <span className="text-slate-300">{sub.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{sub.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {activeRole === 'HR_ADMIN' && (
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setEditingArea(area);
                          setAreaCode(area.code);
                          setAreaName(area.name);
                          setAreaDesc(area.description || '');
                          setAreaDepId(area.dependencia_id || '');
                          setAreaDirId(area.direccion_organo_id || '');
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
              activeRole === 'HR_ADMIN' ? (
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
                {activeRole === 'HR_ADMIN' && (
                  <button
                    onClick={() => {
                      setConfirmModalConfig({
                        isOpen: true,
                        title: 'Desactivar Cargo',
                        message: `¿Desea desactivar el cargo "${cargo.name}"? Los contratos e historial del personal con este cargo se mantendrán intactos.`,
                        actionType: 'DEACTIVATE',
                        entityName: `Código: ${cargo.code} - ${cargo.name}`,
                        confirmText: 'Desactivar Cargo',
                        onConfirm: () => {
                          onDeleteCargo(cargo.id);
                          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                        },
                        onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                      });
                    }}
                    className="p-1.5 text-rose-400 hover:bg-rose-900/30 rounded"
                    title="Desactivar Cargo"
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
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

      {/* TAB 6: DESIGNACIÓN DE JEFES Y DIRECTORES */}
      {activeTab === 'RESPONSABLES' && (
        <div className="space-y-4">
          <AdvancedSearchFilter
            searchTerm={respSearchTerm}
            onSearchChange={(val) => {
              setRespSearchTerm(val);
              setRespCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar por nombre del jefe, DNI o unidad designada..."
            activeFilterCount={respActiveFilterCount}
            onResetFilters={handleResetRespFilters}
            extraActions={
              activeRole === 'HR_ADMIN' ? (
                <button
                  onClick={() => {
                    if (employees.length === 0) {
                      alert('Error: Debe registrar personal primero antes de designar Jefes.');
                      return;
                    }
                    setEditingResp(null);
                    setRespEmpId(employees[0]?.id || '');
                    setRespTitle('DIRECTOR');
                    setRespUnitType('DIRECCION_ORGANO');
                    setRespUnitId(direccionesOrganos[0]?.id || dependencias[0]?.id || '');
                    setRespStartDate(new Date().toISOString().split('T')[0]);
                    setShowRespModal(true);
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Designar Jefe / Director</span>
                </button>
              ) : null
            }
          >
            <FilterField label="Tipo de Unidad">
              <FilterSelect
                value={respFilterUnitType}
                onChange={(val) => {
                  setRespFilterUnitType(val);
                  setRespCurrentPage(1);
                }}
                placeholder="Todos los Tipos de Unidad"
                options={[
                  { value: 'DEPENDENCIA', label: 'Dependencia' },
                  { value: 'DIRECCION_ORGANO', label: 'Dirección / Órgano' },
                  { value: 'AREA_OFICINA', label: 'Área / Oficina' },
                ]}
              />
            </FilterField>
          </AdvancedSearchFilter>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedRespList.map((resp) => (
              <div key={resp.id} className="bg-slate-900/30 border border-amber-500/30 rounded-xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px] rounded">
                      {resp.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Desde: {resp.start_date}</span>
                  </div>

                  <h4 className="font-bold text-base text-white">{resp.employee_name}</h4>
                  <div className="text-xs text-indigo-300 mt-1 font-semibold">
                    Unidad Asignada: {resp.unit_name} ({resp.unit_type})
                  </div>
                </div>

                {activeRole === 'HR_ADMIN' && (
                  <button
                    onClick={() => {
                      setConfirmModalConfig({
                        isOpen: true,
                        title: 'Anular Designación de Jefatura',
                        message: `¿Desea anular la designación de jefatura de "${resp.employee_name}"? Las papeletas previamente aprobadas por esta jefatura conservarán la firma y trazabilidad válida.`,
                        actionType: 'ANNUL',
                        entityName: `${resp.title} - ${resp.unit_name}`,
                        confirmText: 'Anular Designación',
                        onConfirm: () => {
                          onDeleteResponsable(resp.id);
                          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                        },
                        onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                      });
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded"
                    title="Anular Designación"
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {filteredRespList.length === 0 && (
            <EmptyState
              icon={Crown}
              title="No hay designaciones con los criterios de búsqueda"
              description="Ajuste los filtros o agregue designaciones de jefatura."
              isFiltered={Boolean(respSearchTerm.trim()) || respActiveFilterCount > 0}
              onAction={handleResetRespFilters}
            />
          )}

          {filteredRespList.length > 0 && (
            <DataTablePagination
              currentPage={respCurrentPage}
              pageSize={respPageSize}
              totalItems={filteredRespList.length}
              onPageChange={setRespCurrentPage}
              onPageSizeChange={(newSize) => {
                setRespPageSize(newSize);
                setRespCurrentPage(1);
              }}
            />
          )}
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingDep ? 'Editar Dependencia DRAC' : 'Nueva Dependencia DRAC'}
              </h3>
              <button onClick={() => setShowDepModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDependencia} className="p-5 space-y-4">
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingDir ? 'Editar Dirección / Órgano' : 'Nueva Dirección / Órgano DRAC'}
              </h3>
              <button onClick={() => setShowDirModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDireccionOrgano} className="p-5 space-y-4">
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingArea ? 'Editar Área / Oficina' : 'Nueva Área / Oficina DRAC'}
              </h3>
              <button onClick={() => setShowAreaModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitArea} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dependencia</label>
                <select
                  value={areaDepId}
                  onChange={(e) => setAreaDepId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="">Seleccionar Dependencia...</option>
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código Área</label>
                <input
                  type="text"
                  placeholder="Ej: OFI-PER, OFI-INF"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre de Área / Oficina</label>
                <input
                  type="text"
                  placeholder="Ej: Oficina de Personal / Gestión de RRHH"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Área Padre (Opcional - Si es Subárea)</label>
                <select
                  value={parentAreaId}
                  onChange={(e) => setParentAreaId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="">Ninguna (Es Área Principal)</option>
                  {areas.filter((a) => !a.parent_area_id).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAreaModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                >
                  Guardar Área
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CARGO */}
      {showCargoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingCargo ? 'Editar Cargo' : 'Nuevo Cargo Institucional DRAC'}
              </h3>
              <button onClick={() => setShowCargoModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCargo} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código Cargo</label>
                <input
                  type="text"
                  placeholder="Ej: CRG-DIR, CRG-ESP"
                  value={cargoCode}
                  onChange={(e) => setCargoCode(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Designar Jefe / Director Responsable</span>
              </h3>
              <button onClick={() => setShowRespModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResponsable} className="p-5 space-y-4">
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

      {/* MODAL: ADD / EDIT EMPLOYEE DRAC */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingEmp ? 'Editar Ficha y Perfil de Trabajador' : 'Registrar Nuevo Trabajador DRAC'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dirección Regional de Agricultura Cajamarca — Gestión de datos laborales y credenciales de acceso
                  </p>
                </div>
              </div>
              <button onClick={() => setShowEmpModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmployee} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
              
              {/* ================================================================= */}
              {/* SECCIÓN 1: DATOS LABORALES & ESTRUCTURA INSTITUCIONAL DRAC        */}
              {/* ================================================================= */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      1. Datos del Trabajador &amp; Cargo Institucional
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 text-[10px] font-mono border border-indigo-800/40">
                    Ficha Laboral DRAC
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      DNI (Documento Nacional de Identidad) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="71234567"
                      value={empDni}
                      onChange={(e) => setEmpDni(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Exactamente 8 dígitos numéricos</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-300">
                        Código DRAC de Trabajador
                      </label>
                      <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                        Generación Automática
                      </span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      placeholder="DRAC-0001"
                      value={empCode || (editingEmp ? editingEmp.codigo_trabajador : generateNextDracCode(employees))}
                      className="w-full bg-[#060709] border border-slate-800 rounded-lg p-2.5 text-xs text-cyan-300 font-mono cursor-not-allowed opacity-90 select-all"
                      title="El Código DRAC se genera automáticamente con correlativo y reutilización de huecos disponibles."
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Asignado automáticamente por el correlativo institucional DRAC.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Nombres <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Juan Carlos"
                      value={empFirstName}
                      onChange={(e) => setEmpFirstName(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Apellido Paterno <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Pérez"
                      value={empLastNamePaterno}
                      onChange={(e) => setEmpLastNamePaterno(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Apellido Materno <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Gómez"
                      value={empLastNameMaterno}
                      onChange={(e) => setEmpLastNameMaterno(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico Institucional</label>
                    <input
                      type="email"
                      placeholder="ejemplo@regioncajamarca.gob.pe"
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono / Celular</label>
                    <input
                      type="text"
                      placeholder="+51 976 123 456"
                      value={empPhone}
                      onChange={(e) => setEmpPhone(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* ESTRUCTURA ORGANIZACIONAL DRAC */}
                <div className="p-4 bg-indigo-950/20 border border-indigo-800/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Ubicación en el Organigrama DRAC</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-medium">Determina el Jefe Aprobador</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        1. Dependencia <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={empDepId}
                        onChange={(e) => {
                          setEmpDepId(e.target.value);
                          setEmpDirId('');
                          setEmpAreaId('');
                        }}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        2. Dirección / Órgano <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={empDirId}
                        onChange={(e) => {
                          setEmpDirId(e.target.value);
                          setEmpAreaId('');
                        }}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        required
                      >
                        <option value="">Seleccionar Dirección / Órgano...</option>
                        {filteredDirsForEmp.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({getOrganoTypeLabel(d.type)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        3. Área / Oficina (Opcional)
                      </label>
                      <select
                        value={empAreaId}
                        onChange={(e) => setEmpAreaId(e.target.value)}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">[ Sin Asignar / Área General ]</option>
                        {filteredAreasForEmp.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Subárea / Unidad (Opcional)</label>
                      <select
                        value={empSubareaId}
                        onChange={(e) => setEmpSubareaId(e.target.value)}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Ninguna Subárea</option>
                        {filteredSubareasForEmp.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* CARGO INSTITUCIONAL & RÉGIMEN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Cargo Institucional (Puesto Laboral) (Opcional)
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Ej: Especialista Agrario, Asistente, Inspector..."
                        value={empCargoName}
                        onChange={(e) => {
                          setEmpCargoName(e.target.value);
                          const matched = cargos.find(
                            (c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase()
                          );
                          if (matched) setEmpCargoId(matched.id);
                        }}
                        list="cargos-datalist"
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <datalist id="cargos-datalist">
                        {cargos.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </datalist>
                      <select
                        value={empCargoId}
                        onChange={(e) => {
                          setEmpCargoId(e.target.value);
                          const selected = cargos.find((c) => c.id === e.target.value);
                          if (selected) setEmpCargoName(selected.name);
                        }}
                        className="w-full bg-[#090A0D]/70 border border-slate-800/80 rounded-lg p-1.5 text-[11px] text-slate-300"
                      >
                        <option value="">-- O seleccionar del Catálogo de Cargos DRAC --</option>
                        {cargos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Régimen Laboral</label>
                    <select
                      value={empRegimen}
                      onChange={(e) => setEmpRegimen(e.target.value as RegimenLaboral)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="D.L. 276">D.L. 276 (Carrera Administrativa)</option>
                      <option value="D.L. 728">D.L. 728 (Actividad Privada)</option>
                      <option value="CAS D.L. 1057">CAS D.L. 1057</option>
                      <option value="LOCACION_SERVICIOS">Locación de Servicios</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Condición Laboral</label>
                    <select
                      value={empCondicion}
                      onChange={(e) => setEmpCondicion(e.target.value as CondicionLaboral)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="NOMBRADO">Nombrado</option>
                      <option value="CONTRATADO">Contratado</option>
                      <option value="INDETERMINADO">Indeterminado</option>
                      <option value="DESIGNADO">Designado / Funcionario</option>
                      <option value="PRACTICANTE">Practicante</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Horario Asignado</label>
                    <select
                      value={empScheduleId}
                      onChange={(e) => setEmpScheduleId(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {horarios.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.turn_count === 2 ? '(2 Turnos)' : '(1 Turno)'}
                        </option>
                      ))}
                    </select>

                    {/* LIVE PREVIEW OF SELECTED HORARIO TURNS */}
                    {(() => {
                      const selectedH = horarios.find((h) => h.id === empScheduleId) || horarios[0];
                      if (!selectedH) return null;
                      return (
                        <div className="mt-2 p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] font-mono space-y-1">
                          <div className="flex items-center justify-between text-indigo-300 font-bold">
                            <span>Turno 1: {selectedH.turno1_name || 'Turno Principal'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                              {selectedH.turn_count === 2 ? '2 Turnos' : '1 Turno'}
                            </span>
                          </div>
                          {selectedH.turn_count === 2 && selectedH.turno2_name && (
                            <div className="text-emerald-300 font-bold">
                              Turno 2: {selectedH.turno2_name}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400">
                            Días: {selectedH.working_days?.join(', ') || 'L-V'} | Duración: {selectedH.total_duration_text || (selectedH.turn_count === 2 ? '8 horas' : '8 horas')}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">PIN Biométrico ZKTeco</label>
                    <input
                      type="text"
                      placeholder="Ej: 71234567"
                      value={empZkTecoPin}
                      onChange={(e) => setEmpZkTecoPin(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* SECCIÓN 2: PERFIL DE ACCESO AL SISTEMA & CUENTA DE USUARIO        */}
              {/* ================================================================= */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      2. Perfil del Sistema &amp; Cuenta de Acceso
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[10px] font-mono border border-emerald-800/40">
                    Seguridad &amp; Roles RBAC
                  </span>
                </div>

                {/* EXPLANATORY CALLOUT: CARGO INSTITUCIONAL VS PERFIL SISTEMA */}
                <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex items-start gap-3">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-300 leading-relaxed">
                    <span className="font-bold text-white">Diferenciación Obligatoria:</span> El{' '}
                    <span className="text-indigo-300 font-semibold">Cargo Institucional</span> (arriba) es el puesto de trabajo en la DRAC. El{' '}
                    <span className="text-emerald-300 font-semibold">Perfil del Sistema</span> (abajo) determina exclusivamente los permisos y accesos dentro del software de asistencia.
                  </div>
                </div>

                {/* TOGGLE: ¿TENDRÁ ACCESO AL SISTEMA? */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-2">
                    ¿Tendrá cuenta de acceso al sistema de control de asistencia?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEmpHasAccess(true)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        empHasAccess
                          ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40 text-white'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${empHasAccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Sí, habilitar cuenta en el sistema</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tendrá usuario, contraseña y perfil para ingresar a la plataforma web.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmpHasAccess(false)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        !empHasAccess
                          ? 'bg-rose-950/30 border-rose-500/60 ring-1 ring-rose-500/40 text-white'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${!empHasAccess ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">No, solo registro laboral y biométrico</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Solo registrará asistencia por huella/PIN en el reloj físico ZKTeco.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* IF ACCESS IS DISABLED */}
                {!empHasAccess && (
                  <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-[11px] text-amber-300">
                      El trabajador figurará en el padrón laboral de la DRAC y sincronizará con el reloj biométrico, pero <strong>no podrá iniciar sesión en la aplicación web</strong>.
                    </p>
                  </div>
                )}

                {/* IF ACCESS IS ENABLED: SHOW CREDENTIALS AND SYSTEM ROLE SELECTOR */}
                {empHasAccess && (
                  <div className="space-y-4 bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* USERNAME (AUTO-GENERATED) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-slate-300">
                            Usuario (@username) <span className="text-rose-400">*</span>
                          </label>
                          <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                            Auto
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="jperez"
                            value={empUsername || autoCalculatedUsername}
                            onChange={(e) => setEmpUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                            className="w-full bg-[#090A0D] border border-slate-800 rounded-lg pl-6 pr-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 font-bold"
                            required={empHasAccess}
                          />
                          <span className="absolute left-2.5 top-2 text-xs text-indigo-400 font-mono font-bold">@</span>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-0.5 block truncate">
                          Generado: {autoCalculatedUsername ? `@${autoCalculatedUsername}` : 'Inicial + Apellidos'}
                        </span>
                      </div>

                      {/* INITIAL TEMPORARY PASSWORD */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-slate-300">
                            {editingEmp ? 'Contraseña Asignada' : 'Contraseña Inicial (Temporal)'}
                          </label>
                          <span className="text-[9px] text-amber-400 font-mono">1er Ingreso</span>
                        </div>
                        {editingEmp ? (
                          <div className="flex items-center justify-between p-2 bg-[#060709] border border-slate-800 rounded-lg text-xs font-mono text-slate-400">
                            <span>•••••••• (Protegida)</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              editingEmp.primer_ingreso === 'PENDIENTE' || editingEmp.password_change_required
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {editingEmp.primer_ingreso === 'PENDIENTE' || editingEmp.password_change_required ? 'Pendiente' : 'Completado'}
                            </span>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type={showInitialPassword ? 'text' : 'password'}
                              placeholder="Ej: 123456"
                              value={empInitialPassword}
                              onChange={(e) => setEmpInitialPassword(e.target.value)}
                              className="w-full bg-[#090A0D] border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowInitialPassword(!showInitialPassword)}
                              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                            >
                              {showInitialPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                        <span className="text-[9px] text-slate-400 mt-0.5 block">
                          {editingEmp ? 'Hash SHA-256 institucional' : 'Definición libre sin restricciones'}
                        </span>
                      </div>

                      {/* ACCOUNT STATUS */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Estado de la Cuenta</label>
                        <select
                          value={empAccountStatus}
                          onChange={(e) => setEmpAccountStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                          className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="ACTIVE">Activa (Permitir Ingreso)</option>
                          <option value="INACTIVE">Inactiva (Bloqueado)</option>
                        </select>
                      </div>

                      {/* AUTH METHOD */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Método de Autenticación</label>
                        <select
                          value={empAuthMethod}
                          onChange={(e) => setEmpAuthMethod(e.target.value as any)}
                          className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="PASSWORD">Contraseña Estándar</option>
                          <option value="INSTITUTIONAL">Credenciales DRAC</option>
                          <option value="BIOMETRIC">PIN ZKTeco</option>
                        </select>
                      </div>
                    </div>

                    {/* CALLOUT: FIRST LOGIN POLICY INFORMATION */}
                    <div className="p-2.5 bg-indigo-950/20 border border-indigo-500/20 rounded-lg flex items-start gap-2 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="text-slate-300 leading-relaxed">
                        <strong className="text-white">Flujo de Seguridad de Contraseñas:</strong> En el registro del trabajador se asigna una contraseña temporal libremente. En su primer inicio de sesión, el sistema <strong>bloqueará el acceso y exigirá obligatoriamente el cambio de contraseña</strong> aplicando las políticas de longitud y complejidad configuradas.
                      </div>
                    </div>

                    {/* SISTEMA DE PERFILES ACUMULATIVOS DRAC */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold text-slate-200">
                            Perfiles de Acceso del Sistema (Perfiles Acumulativos) <span className="text-rose-400">*</span>
                          </label>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            El perfil <strong className="text-emerald-400">Trabajador</strong> es la base obligatoria. Los roles adicionales se agregan sin reemplazarlo.
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-full">
                          {empAssignedRoles.length} Perfil(es) Activo(s)
                        </span>
                      </div>

                      {/* 1. PERFIL BASE OBLIGATORIO */}
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={true}
                            disabled={true}
                            className="mt-1 w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-not-allowed opacity-75"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-200 border border-slate-700">
                                TRABAJADOR
                              </span>
                              <span className="text-xs font-bold text-white">Perfil Base Obligatorio</span>
                              <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                Siempre Activo
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                              Todo trabajador registrado cuenta con este perfil para consultar asistencia, registrar y firmar digitalmente papeletas de salida y consultar vacaciones.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* VALIDACIÓN DE CLASIFICACIÓN ORGÁNICA PARA JEFE INMEDIATO */}
                      {(() => {
                        const selectedDir = direccionesOrganos.find((d) => d.id === empDirId);
                        const selectedArea = areas.find((a) => a.id === empAreaId);
                        const organoType = selectedDir?.type;
                        const isOrganicJefeEligible = Boolean(organoType && VALID_JEFE_ORGANO_TYPES.includes(organoType));

                        const toggleRole = (roleToToggle: RoleType) => {
                          if (roleToToggle === 'TRABAJADOR') return; // Cannot toggle base

                          if (roleToToggle === 'JEFE') {
                            if (!isOrganicJefeEligible && !empAssignedRoles.includes('JEFE')) {
                              alert(
                                '⚠️ Restricción Institucional:\n\n' +
                                'El perfil "Jefe Inmediato" está restringido exclusivamente a las siguientes clasificaciones orgánicas:\n' +
                                '1. DIRECCIÓN\n' +
                                '2. ÓRGANOS DE APOYO\n' +
                                '3. JEFATURA DE AGENCIA\n' +
                                '4. OFICINA AGRARIA\n\n' +
                                `La unidad seleccionada actualmente (${selectedDir?.name || selectedArea?.name || 'No especificada'}) ` +
                                `tiene clasificación: ${organoType || 'Sin Clasificación Válida'}.\n\n` +
                                'Si el trabajador cubrirá una suplencia temporal o descanso del titular, registre una "Encargatura Temporal" en el módulo correspondiente.'
                              );
                              return;
                            }
                          }

                          if (empAssignedRoles.includes(roleToToggle)) {
                            const updated = empAssignedRoles.filter((r) => r !== roleToToggle);
                            setEmpAssignedRoles(updated.length > 0 ? updated : ['TRABAJADOR']);
                            if (roleToToggle === 'JEFE') setEmpIsJefeDirector(false);
                          } else {
                            const updated = [...empAssignedRoles, roleToToggle];
                            setEmpAssignedRoles(updated);
                            if (roleToToggle === 'JEFE') setEmpIsJefeDirector(true);
                          }
                        };

                        return (
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                              Perfiles Adicionales Disponibles:
                            </div>

                            {/* ROLE 1: JEFE INMEDIATO */}
                            <div
                              onClick={() => toggleRole('JEFE')}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                empAssignedRoles.includes('JEFE')
                                  ? 'bg-amber-950/30 border-amber-500/50 shadow-sm'
                                  : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={empAssignedRoles.includes('JEFE')}
                                    onChange={() => {}}
                                    className="mt-1 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                        <Crown className="w-2.5 h-2.5" />
                                        <span>JEFE INMEDIATO</span>
                                      </span>
                                      <span className="text-xs font-bold text-white">
                                        Responsable Titular de Unidad Orgánica
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                      Otorga facultades de supervisión y <strong>Visto Bueno (VoBo)</strong> a solicitudes de salida del personal de su unidad.
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px]">
                                      <span className="text-slate-400">Ámbito Orgánico Permitido:</span>
                                      <span className="px-1.5 py-0.2 bg-slate-800 text-amber-200 rounded border border-slate-700 font-mono">
                                        Dirección | Órganos de Apoyo | Jefatura de Agencia | Oficina Agraria
                                      </span>
                                    </div>
                                    {!isOrganicJefeEligible && (
                                      <div className="mt-2 p-2 bg-amber-950/40 border border-amber-500/30 rounded text-[10px] text-amber-200 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>
                                          Unidad actual ({selectedDir?.name || 'No seleccionada'}) — Clasificación: <strong>{organoType || 'Sin clasificación'}</strong>. Para ausencias temporales, utilice <strong>Encargaturas Temporales</strong>.
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* ROLE 2: JEFE DE RECURSOS HUMANOS */}
                            <div
                              onClick={() => toggleRole('HR_ADMIN')}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                empAssignedRoles.includes('HR_ADMIN') || empAssignedRoles.includes('JEFE_RRHH')
                                  ? 'bg-blue-950/30 border-blue-500/50 shadow-sm'
                                  : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={empAssignedRoles.includes('HR_ADMIN') || empAssignedRoles.includes('JEFE_RRHH')}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                                      <ShieldCheck className="w-2.5 h-2.5" />
                                      <span>JEFE DE RECURSOS HUMANOS</span>
                                    </span>
                                    <span className="text-xs font-bold text-white">
                                      Autorización Institucional &amp; Gestión de Personal DRAC
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                    Aprobación final de papeletas de salida hacia garita, gestión de vacaciones de toda la DRAC, justificación formal de tardanzas y reportes de planilla.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* ROLE 3: DIRECTOR GENERAL */}
                            <div
                              onClick={() => toggleRole('DIRECTOR_GENERAL')}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                empAssignedRoles.includes('DIRECTOR_GENERAL')
                                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm'
                                  : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={empAssignedRoles.includes('DIRECTOR_GENERAL')}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                      <Crown className="w-2.5 h-2.5" />
                                      <span>DIRECTOR GENERAL</span>
                                    </span>
                                    <span className="text-xs font-bold text-white">
                                      Director Regional de Agricultura Cajamarca
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                    Máxima autoridad ejecutiva institucional con supervisión macro, reportes gerenciales globales y autorización de comisiones oficiales.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* ROLE 4: CONTROL DE ASISTENCIA */}
                            <div
                              onClick={() => toggleRole('CONTROL_ASISTENCIA')}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                empAssignedRoles.includes('CONTROL_ASISTENCIA')
                                  ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm'
                                  : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={empAssignedRoles.includes('CONTROL_ASISTENCIA')}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                                      <Fingerprint className="w-2.5 h-2.5" />
                                      <span>CONTROL DE ASISTENCIA</span>
                                    </span>
                                    <span className="text-xs font-bold text-white">
                                      Operador Técnico de Biométricos ZKTeco
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                    Sincronización de relojes biométricos, ingesta de logs, configuración de tolerancias y emisión de partes de asistencia diaria.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* ROLE 5: VIGILANCIA / GARITA */}
                            <div
                              onClick={() => toggleRole('VIGILANCIA')}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                empAssignedRoles.includes('VIGILANCIA')
                                  ? 'bg-purple-950/30 border-purple-500/50 shadow-sm'
                                  : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={empAssignedRoles.includes('VIGILANCIA')}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 rounded border-slate-700 text-purple-500 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                      <Shield className="w-2.5 h-2.5" />
                                      <span>SEGURIDAD / GARITA</span>
                                    </span>
                                    <span className="text-xs font-bold text-white">
                                      Control de Puerta &amp; Sellado Real
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                    Fiscalización física en portería, verificación de papeletas autorizadas y sellado en tiempo real de hora de salida y retorno.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* ROLE 6: ADMIN GENERAL */}
                            <div
                              onClick={() => toggleRole('ADMIN_GENERAL')}
                              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                empAssignedRoles.includes('ADMIN_GENERAL')
                                  ? 'bg-rose-950/30 border-rose-500/50 shadow-sm'
                                  : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={empAssignedRoles.includes('ADMIN_GENERAL')}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 rounded border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                      <ShieldAlert className="w-2.5 h-2.5" />
                                      <span>ADMINISTRADOR GENERAL</span>
                                    </span>
                                    <span className="text-xs font-bold text-white">
                                      Superadministración Técnica DRAC
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                    Configuración integral de estructura orgánica, asignación de perfiles, bitácoras de auditoría de seguridad y administración global del sistema.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* RESUMEN ACUMULATIVO DEL PERFIL RESULTANTE */}
                      <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                        <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                          <span>Perfil Resultante Acumulado:</span>
                          <span className="text-[10px] text-indigo-400 font-mono">
                            {empAssignedRoles.join(' + ')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {empAssignedRoles.map((r, idx) => {
                            const rDef = SYSTEM_ROLES_CATALOG.find((x) => x.role === r) || SYSTEM_ROLES_CATALOG[0];
                            return (
                              <React.Fragment key={r}>
                                {idx > 0 && <span className="text-xs text-slate-500 font-bold">+</span>}
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-md border flex items-center gap-1 ${rDef.color}`}>
                                  <Shield className="w-3 h-3" />
                                  <span>{rDef.badge}</span>
                                </span>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* MOTIVO DE CAMBIO EN CASO DE EDICIÓN */}
                    {editingEmp && editingEmp.role !== empRole && (
                      <div className="p-3 bg-amber-950/20 border border-amber-500/40 rounded-xl space-y-1.5">
                        <label className="block text-[11px] font-bold text-amber-300">
                          Motivo del cambio de Perfil (Requerido para Bitácora de Auditoría) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Designación como Jefe de Unidad mediante Resolución Administrativa..."
                          value={empRoleChangeReason}
                          onChange={(e) => setEmpRoleChangeReason(e.target.value)}
                          className="w-full bg-[#090A0D] border border-amber-500/30 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                          required
                        />
                        <span className="text-[9px] text-slate-400 block">
                          Se registrará en la bitácora: Perfil anterior ({editingEmp.role}) ➔ Nuevo perfil ({empRole}).
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingEmp ? 'Guardar Cambios de Personal' : 'Completar Registro de Trabajador'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: VER PERFIL DE ACCESO & BITÁCORA DE AUDITORÍA DE ROLES      */}
      {/* ================================================================= */}
      {selectedEmpForRoleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
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

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
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

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex justify-end">
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
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

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
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

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 text-right">
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Política Institucional de Clasificación de Datos</h3>
              </div>
              <button onClick={() => setShowPolicyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto text-xs text-slate-300">
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

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 text-right">
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
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
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
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
                    onChange={(e) => setResetNewPassword(e.target.value)}
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
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedEmpForPasswordReset(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!resetNewPassword.trim()) {
                    alert('Por favor ingrese una contraseña temporal válida.');
                    return;
                  }
                  const { hash, salt } = await hashPassword(resetNewPassword.trim());
                  onEditEmployee({
                    ...selectedEmpForPasswordReset,
                    password_hash: hash,
                    password_salt: salt,
                    password_change_required: true,
                    primer_ingreso: 'PENDIENTE',
                    last_password_change: undefined,
                  });
                  setShowResetPasswordModal(false);
                  setSelectedEmpForPasswordReset(null);
                  alert(`✅ Contraseña temporal restablecida con éxito para @${selectedEmpForPasswordReset.username || selectedEmpForPasswordReset.dni}.\nSe solicitará cambio obligatorio en su próximo inicio de sesión.`);
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
