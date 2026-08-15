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
    case 'SEDE_CENTRAL':
      return 'Sede Central';
    case 'AGENCIA_AGRARIA':
      return 'Agencia Agraria';
    case 'OFICINA_AGRARIA':
      return 'Oficina Agraria';
    case 'DIRECCION':
      return 'Dirección';
    case 'ORGANO_APOYO':
      return 'Órgano de Apoyo';
    case 'ORGANO_LINEA':
      return 'Órgano de Línea';
    case 'JEFATURA_AGENCIA':
      return 'Jefatura de Agencia';
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
}) => {
  const [activeTab, setActiveTab] = useState<
    'EMPLOYEES' | 'DEPENDENCIAS' | 'DIRECCIONES' | 'AREAS' | 'CARGOS' | 'RESPONSABLES'
  >('EMPLOYEES');

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'org_deps') setActiveTab('DEPENDENCIAS');
    else if (activeView === 'org_dirs') setActiveTab('DIRECCIONES');
    else if (activeView === 'org_areas') setActiveTab('AREAS');
    else if (activeView === 'org_cargos') setActiveTab('CARGOS');
    else if (activeView === 'org_resps') setActiveTab('RESPONSABLES');
    else if (activeView === 'personnel_list') setActiveTab('EMPLOYEES');
    else if (activeView === 'personnel_new') {
      setActiveTab('EMPLOYEES');
      setEditingEmp(null);
      setShowEmpModal(true);
    } else if (activeView === 'personnel_assign' || activeView === 'personnel_history') {
      setActiveTab('EMPLOYEES');
    }
  }, [activeView]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dependenciaFilter, setDependenciaFilter] = useState('ALL');
  const [dirClasificacionFilter, setDirClasificacionFilter] = useState('ALL');
  const [showInactive, setShowInactive] = useState(true);

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
  const [dirType, setDirType] = useState<OrganoType>('OFICINA_AGRARIA');
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
  const [empScheduleId, setEmpScheduleId] = useState('');
  const [empHireDate, setEmpHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [empActive, setEmpActive] = useState(true);
  const [empZkTecoPin, setEmpZkTecoPin] = useState('');

  // FORM STATES: Perfil del Sistema & Cuenta de Acceso
  const [empHasAccess, setEmpHasAccess] = useState(true);
  const [empUsername, setEmpUsername] = useState('');
  const [empAccountStatus, setEmpAccountStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [empAuthMethod, setEmpAuthMethod] = useState<'PASSWORD' | 'BIOMETRIC' | 'INSTITUTIONAL'>('PASSWORD');
  const [empRoleChangeReason, setEmpRoleChangeReason] = useState('');
  const [selectedEmpForRoleModal, setSelectedEmpForRoleModal] = useState<Employee | null>(null);

  // SUB-DIRECCIONES & AREAS FILTERED FOR EMP FORM
  const filteredDirsForEmp = direccionesOrganos.filter((d) => d.dependencia_id === empDepId);
  const filteredAreasForEmp = areas.filter((a) => (!empDepId || a.dependencia_id === empDepId) && (!empDirId || a.direccion_organo_id === empDirId) && !a.parent_area_id);
  const filteredSubareasForEmp = areas.filter((a) => a.parent_area_id === empAreaId);

  // EMPLOYEES FILTER
  const filteredEmployees = employees.filter((emp) => {
    const fullSearch = `${emp.first_name} ${emp.last_name} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.dni} ${emp.codigo_trabajador} ${emp.position} ${emp.username || ''}`.toLowerCase();
    const matchesSearch = fullSearch.includes(searchTerm.toLowerCase());
    const matchesDep = dependenciaFilter === 'ALL' || emp.dependencia_id === dependenciaFilter;
    return matchesSearch && matchesDep;
  });

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
  const handleSubmitEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDni = empDni.trim();
    if (!cleanDni || !empFirstName || !empLastNamePaterno || !empDepId || !empAreaId) {
      alert('⚠️ Error de Validación:\nDebe completar el DNI, Nombres, Apellido Paterno y seleccionar Dependencia y Área válidas.');
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

    // Auto-generate or validate Username if system access is enabled
    let finalUsername = empUsername.trim();
    if (empHasAccess) {
      if (!finalUsername) {
        // Generate from names: e.g. jperez
        finalUsername = `${empFirstName.trim().charAt(0).toLowerCase()}${empLastNamePaterno.trim().toLowerCase()}`.replace(/\s+/g, '');
      }
      // Check duplicate Username among employees with system access
      const usernameDuplicate = employees.find(
        (emp) =>
          emp.has_system_access &&
          emp.username?.toLowerCase() === finalUsername.toLowerCase() &&
          emp.id !== editingEmp?.id
      );
      if (usernameDuplicate) {
        alert(`⚠️ Usuario de Acceso Duplicado:\nEl nombre de usuario "${finalUsername}" ya se encuentra asignado a ${usernameDuplicate.first_name} ${usernameDuplicate.last_name}. Por favor especifique otro usuario.`);
        return;
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
          (r.unit_type === 'AREA_OFICINA' && r.unit_id === empAreaId) ||
          (r.unit_type === 'DEPENDENCIA' && r.unit_id === empDepId))
    );

    if (matchedResp) {
      determinedSupervisorId = matchedResp.employee_id;
      determinedSupervisorName = `${matchedResp.title}: ${matchedResp.employee_name}`;
    }

    const fullLastName = `${empLastNamePaterno.trim()} ${empLastNameMaterno.trim()}`.trim();
    const generatedCode = empCode.trim() || `DRAC-2026-0${employees.length + 1}`;
    const finalAccountStatus = !empActive ? 'INACTIVE' : (empHasAccess ? empAccountStatus : 'INACTIVE');

    if (editingEmp) {
      // Check for Role or Access changes for audit logging
      const roleChanged = editingEmp.role !== empRole;
      const accessChanged = (editingEmp.has_system_access !== empHasAccess) || (editingEmp.account_status !== finalAccountStatus);
      const updatedRoleHistory: RoleHistoryEntry[] = [...(editingEmp.role_history || [])];

      if (roleChanged || accessChanged) {
        updatedRoleHistory.push({
          id: `rh-${Date.now()}`,
          previous_role: editingEmp.role,
          new_role: empRole,
          previous_status: editingEmp.has_system_access ? (editingEmp.account_status || 'ACTIVE') : 'INACTIVE',
          new_status: finalAccountStatus,
          changed_at: new Date().toISOString(),
          changed_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General',
          reason: empRoleChangeReason.trim() || (roleChanged ? `Cambio de perfil asignado de ${editingEmp.role} a ${empRole}` : `Actualización del estado de cuenta a ${finalAccountStatus}`),
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
        area_id: empAreaId,
        area_name: selectedArea ? selectedArea.name : 'Oficina Principal',
        subarea_id: empSubareaId || undefined,
        subarea_name: selectedSubarea?.name,
        position: empCargoName.trim() || selectedCargo?.name || 'Especialista Agrario',
        cargo_id: empCargoId || undefined,
        regimen_laboral: empRegimen,
        condicion_laboral: empCondicion,
        // Perfil y cuenta de acceso
        has_system_access: empHasAccess,
        username: empHasAccess ? finalUsername : undefined,
        account_status: finalAccountStatus,
        auth_method: empAuthMethod,
        role: empRole,
        role_history: updatedRoleHistory,
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
          previous_role: empRole,
          new_role: empRole,
          previous_status: 'ACTIVE',
          new_status: finalAccountStatus,
          changed_at: new Date().toISOString(),
          changed_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General',
          reason: 'Registro inicial de trabajador y asignación de perfil en la DRAC.',
        }
      ] : [];

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
        area_id: empAreaId,
        area_name: selectedArea ? selectedArea.name : 'Oficina Principal',
        subarea_id: empSubareaId || undefined,
        subarea_name: selectedSubarea?.name,
        position: empCargoName.trim() || selectedCargo?.name || 'Especialista Agrario',
        cargo_id: empCargoId || undefined,
        regimen_laboral: empRegimen,
        condicion_laboral: empCondicion,
        // Perfil y cuenta de acceso
        has_system_access: empHasAccess,
        username: empHasAccess ? finalUsername : undefined,
        account_status: finalAccountStatus,
        auth_method: empAuthMethod,
        role: empRole,
        role_history: initialRoleHistory,
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
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">
              CAJAMARCA REGIONAL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión institucional jerárquica de la Dirección Regional de Agricultura Cajamarca.
          </p>
        </div>

        <button
          onClick={() => setShowPolicyModal(true)}
          className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Política de Integridad &amp; Trazabilidad</span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por DNI, Nombres, Apellidos, Código DRAC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={dependenciaFilter}
                  onChange={(e) => setDependenciaFilter(e.target.value)}
                  className="bg-[#090A0D] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todas las Dependencias DRAC</option>
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeRole === 'HR_ADMIN' && (
              <button
                onClick={() => {
                  if (dependencias.length === 0) {
                    alert('⚠️ Secuencia Obligatoria:\n\n1. Primero debe registrar al menos una Dependencia (ej. Sede Central, Agencia Agraria).\n2. Luego Direcciones u Oficinas.\n3. Posteriormente podrá registrar al Personal.');
                    setActiveTab('DEPENDENCIAS');
                    return;
                  }
                  setEditingEmp(null);
                  setEmpCode('');
                  setEmpDni('');
                  setEmpFirstName('');
                  setEmpLastNamePaterno('');
                  setEmpLastNameMaterno('');
                  setEmpEmail('');
                  setEmpPhone('');
                  setEmpDepId(dependencias[0]?.id || '');
                  setEmpDirId('');
                  setEmpAreaId(areas[0]?.id || '');
                  setEmpSubareaId('');
                  setEmpCargoId(cargos[0]?.id || '');
                  setEmpCargoName('Especialista Agrario');
                  setEmpRegimen('D.L. 276');
                  setEmpCondicion('NOMBRADO');
                  setEmpScheduleId(horarios[0]?.id || '');
                  setEmpHireDate(new Date().toISOString().split('T')[0]);
                  setEmpActive(true);
                  setEmpZkTecoPin('');
                  // Access & Role states (default TRABAJADOR)
                  setEmpHasAccess(true);
                  setEmpUsername('');
                  setEmpRole('TRABAJADOR');
                  setEmpAccountStatus('ACTIVE');
                  setEmpAuthMethod('PASSWORD');
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

          {/* Table */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Cód. DRAC / Trabajador</th>
                    <th className="px-4 py-3">DNI / PIN ZKTeco</th>
                    <th className="px-4 py-3">Dependencia &amp; Ubicación DRAC</th>
                    <th className="px-4 py-3">Cargo Institucional (Puesto)</th>
                    <th className="px-4 py-3">Perfil Sistema &amp; Cuenta</th>
                    <th className="px-4 py-3">Jefe Inmediato (VoBo)</th>
                    <th className="px-4 py-3">Estado</th>
                    {activeRole === 'HR_ADMIN' && <th className="px-4 py-3 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredEmployees.map((emp) => {
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
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 ${roleConfig.color}`}>
                                  <Shield className="w-3 h-3" />
                                  <span>{roleConfig.badge}</span>
                                </span>
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    emp.account_status === 'INACTIVE' || !emp.active
                                      ? 'bg-rose-500'
                                      : 'bg-emerald-400 ring-2 ring-emerald-400/20'
                                  }`}
                                  title={emp.account_status === 'INACTIVE' || !emp.active ? 'Cuenta Inactiva' : 'Cuenta Activa'}
                                />
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                <UserCog className="w-3 h-3 text-slate-500" />
                                <span>@{emp.username || emp.dni}</span>
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
                                  // Access & Role states
                                  setEmpHasAccess(emp.has_system_access !== false);
                                  setEmpUsername(emp.username || (emp.first_name ? `${emp.first_name.charAt(0).toLowerCase()}${(emp.apellido_paterno || emp.last_name.split(' ')[0] || '').toLowerCase()}` : emp.dni));
                                  setEmpRole(emp.role || 'TRABAJADOR');
                                  setEmpAccountStatus(emp.account_status || (emp.active ? 'ACTIVE' : 'INACTIVE'));
                                  setEmpAuthMethod(emp.auth_method || 'PASSWORD');
                                  setEmpRoleChangeReason('');
                                  setShowEmpModal(true);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                                title="Editar Trabajador y Perfil de Acceso"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
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

              {filteredEmployees.length === 0 && (
                <div className="p-12 text-center bg-slate-900/40">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">No hay personal registrado en la DRAC</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Para registrar personal, configure primero las Dependencias, Direcciones y Áreas institucionales.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setActiveTab('DEPENDENCIAS')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors inline-flex items-center gap-1.5"
                    >
                      <Building className="w-4 h-4" />
                      <span>1º Ir a Dependencias DRAC</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPENDENCIAS DRAC */}
      {activeTab === 'DEPENDENCIAS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div>
              <h3 className="font-bold text-sm text-white">Nivel 1 — Dependencias Institucionales DRAC</h3>
              <p className="text-xs text-slate-400">Sede Central, Agencias Agrarias (Jaén, Chota, Cajamarca, San Ignacio, etc.) y Oficinas Agrarias.</p>
            </div>
            {activeRole === 'HR_ADMIN' && (
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
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dependencias.map((dep) => {
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

          {dependencias.length === 0 && (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
              <Building className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">No hay Dependencias DRAC registradas</h4>
              <p className="text-xs text-slate-400 mt-1">Cree la Sede Central y las Agencias Agrarias de la Región Cajamarca.</p>
              <button
                onClick={() => {
                  setEditingDep(null);
                  setDepCode('SEDE-01');
                  setDepName('Sede Central DRAC');
                  setDepType('SEDE_CENTRAL');
                  setDepAddress('Av. Independencia 245, Cajamarca');
                  setShowDepModal(true);
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded"
              >
                Crear Sede Central DRAC
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DIRECCIONES Y ÓRGANOS */}
      {activeTab === 'DIRECCIONES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div>
              <h3 className="font-bold text-sm text-white">Nivel 2 — Direcciones y Órganos DRAC</h3>
              <p className="text-xs text-slate-400">
                Oficinas Agrarias, Direcciones y Órganos de Línea/Apoyo DRAC.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={dirClasificacionFilter}
                  onChange={(e) => setDirClasificacionFilter(e.target.value)}
                  className="bg-[#090A0D] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todas las Clasificaciones</option>
                  <option value="OFICINA_AGRARIA">Oficina Agraria</option>
                  <option value="DIRECCION">Dirección</option>
                  <option value="ORGANO_APOYO">Órgano de Apoyo</option>
                  <option value="ORGANO_LINEA">Órgano de Línea</option>
                  <option value="JEFATURA_AGENCIA">Jefatura de Agencia</option>
                </select>
              </div>

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
                    setDirType('OFICINA_AGRARIA');
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {direccionesOrganos
              .filter((dir) => dirClasificacionFilter === 'ALL' || dir.type === dirClasificacionFilter)
              .map((dir) => {
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

          {direccionesOrganos.filter((dir) => dirClasificacionFilter === 'ALL' || dir.type === dirClasificacionFilter).length === 0 && (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
              <Layers className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">No se encontraron unidades con el filtro seleccionado</h4>
              <p className="text-xs text-slate-400 mt-1">
                {dirClasificacionFilter !== 'ALL'
                  ? `No hay registros con Clasificación Orgánica "${getOrganoTypeLabel(dirClasificacionFilter)}".`
                  : 'Registre Direcciones, Agencias u Oficinas Agrarias.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AREAS Y OFICINAS */}
      {activeTab === 'AREAS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div>
              <h3 className="font-bold text-sm text-white">Nivel 3 — Áreas, Oficinas y Subáreas DRAC</h3>
              <p className="text-xs text-slate-400">Oficina de Personal, Área de Informática, Área de Abastecimiento, Subáreas técnicas.</p>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.filter((a) => !a.parent_area_id).map((area) => {
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
        </div>
      )}

      {/* TAB 5: CARGOS */}
      {activeTab === 'CARGOS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div>
              <h3 className="font-bold text-sm text-white">Catálogo de Cargos Institucionales DRAC</h3>
              <p className="text-xs text-slate-400">Director Regional, Especialista Agrario, Técnico Administrativo, Vigilante de Garita.</p>
            </div>
            {activeRole === 'HR_ADMIN' && (
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
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cargos.map((cargo) => (
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
        </div>
      )}

      {/* TAB 6: DESIGNACIÓN DE JEFES Y DIRECTORES */}
      {activeTab === 'RESPONSABLES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Designación de Jefes &amp; Directores Responsables de Aprobar Papeletas</span>
              </h3>
              <p className="text-xs text-slate-400">
                Determina automáticamente a quién se envía la papeleta de salida de cada colaborador según su unidad.
              </p>
            </div>
            {activeRole === 'HR_ADMIN' && (
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
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {responsables.map((resp) => (
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

          {responsables.length === 0 && (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
              <Crown className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">No hay Jefes o Directores designados aún</h4>
              <p className="text-xs text-slate-400 mt-1">Designar un Jefe/Director permite la auto-asignación de aprobadores en Papeletas de Salida.</p>
            </div>
          )}
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
                >
                  <option value="OFICINA_AGRARIA">Oficina Agraria</option>
                  {dirType && dirType !== 'OFICINA_AGRARIA' && dirType !== 'SEDE_CENTRAL' && dirType !== 'AGENCIA_AGRARIA' && (
                    <option value={dirType}>{getOrganoTypeLabel(dirType)}</option>
                  )}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Clasificación orgánica correspondiente a este nivel en la estructura DRAC
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
                    <label className="block text-xs font-bold text-slate-300 mb-1">Código DRAC de Trabajador</label>
                    <input
                      type="text"
                      placeholder="DRAC-2026-001"
                      value={empCode}
                      onChange={(e) => setEmpCode(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
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
                    <label className="block text-xs font-bold text-slate-300 mb-1">Apellido Materno</label>
                    <input
                      type="text"
                      placeholder="Gómez"
                      value={empLastNameMaterno}
                      onChange={(e) => setEmpLastNameMaterno(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">2. Dirección / Órgano</label>
                      <select
                        value={empDirId}
                        onChange={(e) => setEmpDirId(e.target.value)}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                        3. Área / Oficina <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={empAreaId}
                        onChange={(e) => setEmpAreaId(e.target.value)}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        required
                      >
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
                      Cargo Institucional (Puesto Laboral) <span className="text-rose-400">*</span>
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Ej: Especialista Agrario, Director, Jefe, etc."
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
                        required
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Nombre de Usuario (Username) <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="jperez"
                            value={empUsername}
                            onChange={(e) => setEmpUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                            className="w-full bg-[#090A0D] border border-slate-800 rounded-lg pl-6 pr-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            required={empHasAccess}
                          />
                          <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-mono">@</span>
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5 block">Identificador único de inicio de sesión</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Estado de la Cuenta</label>
                        <select
                          value={empAccountStatus}
                          onChange={(e) => setEmpAccountStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                          className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="ACTIVE">Activa (Permitir Ingreso)</option>
                          <option value="INACTIVE">Inactiva (Bloqueado Temporalmente)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Método de Autenticación</label>
                        <select
                          value={empAuthMethod}
                          onChange={(e) => setEmpAuthMethod(e.target.value as any)}
                          className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="PASSWORD">Contraseña Estándar</option>
                          <option value="INSTITUTIONAL">Credenciales Institucionales DRAC</option>
                          <option value="BIOMETRIC">PIN Biométrico ZKTeco</option>
                        </select>
                      </div>
                    </div>

                    {/* SELECTOR DE PERFIL DEL SISTEMA */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-200">
                          Selección del Perfil de Acceso del Sistema (Rol) <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          Perfil por defecto: <strong className="text-emerald-400">Trabajador</strong>
                        </span>
                      </div>

                      <select
                        value={empRole}
                        onChange={(e) => setEmpRole(e.target.value as RoleType)}
                        className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
                      >
                        {SYSTEM_ROLES_CATALOG.map((roleItem) => (
                          <option key={roleItem.role} value={roleItem.role}>
                            {roleItem.badge} — {roleItem.label} ({roleItem.description})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ROLE CARDS / DETAILS */}
                    {(() => {
                      const selectedRoleInfo = SYSTEM_ROLES_CATALOG.find((r) => r.role === empRole) || SYSTEM_ROLES_CATALOG[0];
                      const selectedDepObj = dependencias.find((d) => d.id === empDepId);
                      const selectedDirObj = direccionesOrganos.find((d) => d.id === empDirId);
                      const selectedAreaObj = areas.find((a) => a.id === empAreaId);

                      return (
                        <div className="space-y-3 bg-[#090A0D] border border-slate-800 rounded-xl p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-md border flex items-center gap-1 ${selectedRoleInfo.color}`}>
                                <Shield className="w-3 h-3" />
                                <span>{selectedRoleInfo.badge}</span>
                              </span>
                              <span className="text-xs font-bold text-white">{selectedRoleInfo.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">Código: {selectedRoleInfo.role}</span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {selectedRoleInfo.description}
                          </p>

                          {/* REGLA DE ÁMBITO PARA JEFE */}
                          {empRole === 'JEFE' && (
                            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg space-y-1.5">
                              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                                <span>Ámbito Jerárquico de Aprobación Automático</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-relaxed">
                                Como <strong>Jefe</strong>, su potestad de dar <strong>Visto Bueno (VoBo)</strong> a papeletas y supervisar asistencias abarcará al personal de su unidad asignada:
                              </p>
                              <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono text-amber-200 bg-black/40 p-2 rounded border border-amber-500/20">
                                <span>{selectedDepObj?.name || 'Dependencia'}</span>
                                <span>➔</span>
                                <span>{selectedDirObj?.name || 'Dirección / Órgano'}</span>
                                <span>➔</span>
                                <span className="font-bold text-amber-300">{selectedAreaObj?.name || 'Área / Oficina'}</span>
                              </div>
                            </div>
                          )}

                          {/* ALERTA PARA ROLES CON PRIVILEGIOS ELEVADOS */}
                          {['ADMIN_GENERAL', 'JEFE_RRHH', 'DIRECTOR_GENERAL', 'CONTROL_ASISTENCIA'].includes(empRole) && (
                            <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/30 rounded-lg flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
                              <div className="text-[10px] text-indigo-200">
                                <strong>Privilegios Elevados:</strong> Este perfil posee facultades de gestión y administración de datos institucionales.
                              </div>
                            </div>
                          )}

                          {/* PERMISOS INCLUIDOS */}
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              Facultades otorgadas por este perfil:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {selectedRoleInfo.permissions.map((perm, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>{perm}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

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
    </div>
  );
};
