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
} from '../../types';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';

interface OrgPersonnelModuleProps {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [dependenciaFilter, setDependenciaFilter] = useState('ALL');
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
  const [empRole, setEmpRole] = useState<RoleType>('EMPLOYEE');
  const [empScheduleId, setEmpScheduleId] = useState('');
  const [empHireDate, setEmpHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [empActive, setEmpActive] = useState(true);
  const [empZkTecoPin, setEmpZkTecoPin] = useState('');

  // SUB-DIRECCIONES & AREAS FILTERED FOR EMP FORM
  const filteredDirsForEmp = direccionesOrganos.filter((d) => d.dependencia_id === empDepId);
  const filteredAreasForEmp = areas.filter((a) => (!empDepId || a.dependencia_id === empDepId) && (!empDirId || a.direccion_organo_id === empDirId) && !a.parent_area_id);
  const filteredSubareasForEmp = areas.filter((a) => a.parent_area_id === empAreaId);

  // EMPLOYEES FILTER
  const filteredEmployees = employees.filter((emp) => {
    const fullSearch = `${emp.first_name} ${emp.last_name} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.dni} ${emp.codigo_trabajador}`.toLowerCase();
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
    if (!empDni || !empFirstName || !empLastNamePaterno || !empDepId || !empAreaId) {
      alert('Error: Debe completar DNI, Nombres, Apellidos y seleccionar Dependencia y Área válidas.');
      return;
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

    if (editingEmp) {
      onEditEmployee({
        ...editingEmp,
        codigo_trabajador: generatedCode,
        dni: empDni.trim(),
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
        role: empRole,
        hire_date: empHireDate,
        active: empActive,
        schedule_id: empScheduleId || undefined,
        schedule_name: selectedSchedule ? selectedSchedule.name : 'Jornada Partida DRAC',
        zkteco_pin: empZkTecoPin.trim() || empDni.trim(),
        supervisor_id: determinedSupervisorId,
        supervisor_name: determinedSupervisorName,
      });
    } else {
      onAddEmployee({
        codigo_trabajador: generatedCode,
        dni: empDni.trim(),
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
        role: empRole,
        hire_date: empHireDate,
        active: empActive,
        schedule_id: empScheduleId || undefined,
        schedule_name: selectedSchedule ? selectedSchedule.name : 'Jornada Partida DRAC',
        zkteco_pin: empZkTecoPin.trim() || empDni.trim(),
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
              Estructura Organizacional DRAC &amp; Padrón de Personal
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">
              CAJAMARCA REGIONAL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión institucional jerárquica: Sede Central, Agencias Agrarias, Oficinas, Direcciones de Línea, Cargos y Designación de Jefes Aprobadores.
          </p>
        </div>

        <button
          onClick={() => setShowPolicyModal(true)}
          className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Política de Integridad &amp; Trazabilidad</span>
        </button>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#090A0D] p-1.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'EMPLOYEES'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Personal ({employees.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('DEPENDENCIAS')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'DEPENDENCIAS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Dependencias ({dependencias.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('DIRECCIONES')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'DIRECCIONES'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Direcciones/Órganos ({direccionesOrganos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('AREAS')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'AREAS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Áreas/Oficinas ({areas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CARGOS')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'CARGOS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Cargos ({cargos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('RESPONSABLES')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'RESPONSABLES'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Jefes/Aprobadores ({responsables.length})</span>
          </button>
        </div>
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
                  setEmpRole('EMPLOYEE');
                  setEmpScheduleId(horarios[0]?.id || '');
                  setEmpHireDate(new Date().toISOString().split('T')[0]);
                  setEmpActive(true);
                  setEmpZkTecoPin('');
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
                    <th className="px-4 py-3">Dependencia &amp; Área DRAC</th>
                    <th className="px-4 py-3">Cargo &amp; Régimen</th>
                    <th className="px-4 py-3">Jefe Inmediato Aprobador</th>
                    <th className="px-4 py-3">Estado</th>
                    {activeRole === 'HR_ADMIN' && <th className="px-4 py-3 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredEmployees.map((emp) => (
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

                      <td className="px-4 py-3">
                        <div className="text-slate-200 font-medium">{emp.position}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px] font-mono border border-slate-700">
                            {emp.regimen_laboral}
                          </span>
                          <span className="text-[9px] text-slate-500">{emp.condicion_laboral}</span>
                        </div>
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
                                setEmpRole(emp.role);
                                setEmpScheduleId(emp.schedule_id || '');
                                setEmpHireDate(emp.hire_date);
                                setEmpActive(emp.active);
                                setEmpZkTecoPin(emp.zkteco_pin || emp.dni);
                                setShowEmpModal(true);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                              title="Editar Trabajador"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
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
                                  message: `¿Desea cambiar el estado del colaborador ${emp.first_name} ${emp.last_name}? Sus marcaciones, papeletas y registros de asistencia permanecerán archivados para auditoría e historial.`,
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
                  ))}
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
                        {dep.type}
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
          <div className="flex items-center justify-between bg-slate-900/30 p-4 border border-slate-800 rounded-xl">
            <div>
              <h3 className="font-bold text-sm text-white">Nivel 2 — Direcciones de Apoyo / Línea DRAC</h3>
              <p className="text-xs text-slate-400">Dirección de Administración, Dirección de Competitividad Agraria, Dirección de Titulación de Tierras, Jefaturas de Agencia.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {direccionesOrganos.map((dir) => {
              const staffCount = employees.filter((e) => e.direccion_organo_id === dir.id).length;

              return (
                <div key={dir.id} className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{dir.code}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                        {dir.type}
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

          {direccionesOrganos.length === 0 && (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
              <Layers className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">No hay Direcciones / Órganos de Línea registrados</h4>
              <p className="text-xs text-slate-400 mt-1">Registre Direcciones como Dirección de Administración o Competitividad Agraria.</p>
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
                  <option value="OFICINA_AGRARIA">Oficina Agraria</option>
                </select>
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
                      {d.name} ({d.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código</label>
                <input
                  type="text"
                  placeholder="Ej: DIR-ADM, DIR-AGR"
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
                  placeholder="Ej: Dirección de Administración"
                  value={dirName}
                  onChange={(e) => setDirName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Clasificación Orgánica</label>
                <select
                  value={dirType}
                  onChange={(e) => setDirType(e.target.value as OrganoType)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="DIRECCION">Dirección</option>
                  <option value="ORGANO_APOYO">Órgano de Apoyo</option>
                  <option value="ORGANO_LINEA">Órgano de Línea</option>
                  <option value="JEFATURA_AGENCIA">Jefatura de Agencia</option>
                </select>
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
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingEmp ? 'Editar Personal DRAC' : 'Registrar Nuevo Trabajador DRAC'}
              </h3>
              <button onClick={() => setShowEmpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmployee} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">DNI (Único)</label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="71234567"
                    value={empDni}
                    onChange={(e) => setEmpDni(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Código Trabajador DRAC</label>
                  <input
                    type="text"
                    placeholder="DRAC-2026-001"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombres</label>
                  <input
                    type="text"
                    placeholder="Juan Carlos"
                    value={empFirstName}
                    onChange={(e) => setEmpFirstName(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Apellido Paterno</label>
                  <input
                    type="text"
                    placeholder="Pérez"
                    value={empLastNamePaterno}
                    onChange={(e) => setEmpLastNamePaterno(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
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
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* ASIGNACIÓN DE ESTRUCTURA DRAC */}
              <div className="p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-xl space-y-3">
                <div className="text-xs font-bold text-indigo-200">Asignación Organizacional DRAC</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">1. Dependencia</label>
                    <select
                      value={empDepId}
                      onChange={(e) => {
                        setEmpDepId(e.target.value);
                        setEmpDirId('');
                      }}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
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
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">2. Dirección / Órgano</label>
                    <select
                      value={empDirId}
                      onChange={(e) => setEmpDirId(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="">Seleccionar Dirección...</option>
                      {filteredDirsForEmp.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">3. Área / Oficina</label>
                    <select
                      value={empAreaId}
                      onChange={(e) => setEmpAreaId(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
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
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Subárea (Si aplica)</label>
                    <select
                      value={empSubareaId}
                      onChange={(e) => setEmpSubareaId(e.target.value)}
                      className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Cargo / Puesto (Escriba o Seleccione)
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Ej: Especialista Agrario, Asistente, etc."
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
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="D.L. 276">D.L. 276 (Carrera Administrativa)</option>
                    <option value="D.L. 728">D.L. 728 (Actividad Privada)</option>
                    <option value="CAS D.L. 1057">CAS D.L. 1057</option>
                    <option value="LOCACION_SERVICIOS">Locación de Servicios</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Condición Laboral</label>
                  <select
                    value={empCondicion}
                    onChange={(e) => setEmpCondicion(e.target.value as CondicionLaboral)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
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
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  >
                    {horarios.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">PIN / ID Biométrico ZKTeco</label>
                <input
                  type="text"
                  placeholder="Ej: 71234567"
                  value={empZkTecoPin}
                  onChange={(e) => setEmpZkTecoPin(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                >
                  Guardar Personal
                </button>
              </div>
            </form>
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
