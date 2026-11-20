import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Building,
  CheckCircle2,
  Cpu,
  Crown,
  Eye,
  EyeOff,
  Fingerprint,
  Info,
  Link2,
  Lock,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Area,
  BiometricDeviceUser,
  Cargo,
  CondicionLaboral,
  Dependencia,
  DireccionOrgano,
  Employee,
  Horario,
  RegimenLaboral,
  ResponsableDesignation,
  RoleHistoryEntry,
  RoleType,
} from '../../types';
import { VALID_JEFE_ORGANO_TYPES, getEmployeeAssignedRoles } from '../../utils/encargaturaUtils';
import { generateUniqueUsername, hashPassword } from '../../utils/userAuthUtils';
import { generateNextDracCode } from '../../utils/dracCodeUtils';
import { getNextDracCodeFromPostgres } from '../../services/employeeService';
import { normalizePersonName } from '../../utils/nameUtils';

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
    description:
      'Perfil base para todo el personal DRAC. Permite consulta de asistencia individual, registro y firma digital de papeletas de salida y consulta de vacaciones.',
    permissions: [
      'Ver y descargar reporte de asistencia propia',
      'Registrar solicitudes de papeletas de salida con firma digital',
      'Consultar períodos y saldo de vacaciones asignadas',
      'Registro de marcaciones en relojes biométricos ZKTeco',
    ],
  },
  {
    role: 'JEFE',
    label: 'Jefe Inmediato',
    badge: 'Jefe Inmediato',
    isDefault: false,
    isSpecial: true,
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    accentColor: 'text-amber-400',
    description:
      'Perfil institucional para Directores, Jefes de Órganos de Apoyo, Jefes de Agencia y Jefes de Oficina con facultades de supervisión y visto bueno (VoBo) a solicitudes de salida.',
    scopeRule:
      'El alcance de aprobación de papeletas y supervisión de asistencia se delimita automáticamente a los colaboradores pertenecientes a su Dirección, Órgano de Apoyo, Agencia Agraria u Oficina asignada.',
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
    description:
      'Autoridad en talento humano para la aprobación final institucional de salidas, administración de vacaciones y consolidación de nómina.',
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
    description:
      'Personal de garita y portería autorizado para la fiscalización física y sellado en tiempo real de salidas y retornos institucionales.',
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
    description:
      'Máxima autoridad ejecutiva institucional de la Dirección Regional de Agricultura Cajamarca con supervisión macro.',
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
    description:
      'Operador técnico especializado responsable del monitoreo de dispositivos biométricos ZKTeco y procesamiento de marcaciones.',
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
    description:
      'Superadministrador técnico del sistema con privilegios de configuración global, asignación de perfiles y auditoría de seguridad.',
    permissions: [
      'Registro de trabajadores y asignación de perfiles y cuentas de acceso',
      'Configuración de estructura orgánica (Dependencias, Órganos, Áreas, Cargos)',
      'Configuración de turnos, jornadas y ventanas de marcación biométrica',
      'Auditoría forense completa de logs, seguridad y trazabilidad de cambios',
    ],
  },
];

export interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEmp?: Employee | null;
  dependencias: Dependencia[];
  direccionesOrganos: DireccionOrgano[];
  areas: Area[];
  cargos: Cargo[];
  horarios: Horario[];
  responsables?: ResponsableDesignation[];
  employees: Employee[];
  activeRole: RoleType | string;
  biometricPrefill?: {
    deviceUser: BiometricDeviceUser;
  } | null;
  onSaveNewEmployee: (employeeData: Omit<Employee, 'id'>) => Promise<void | { error?: string; existingEmployee?: Employee }>;
  onSaveEditEmployee?: (employee: Employee) => Promise<void | { error?: string }> | void;
  onSwitchToLinkExisting?: (existingEmp: Employee) => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  editingEmp = null,
  dependencias,
  direccionesOrganos,
  areas,
  cargos,
  horarios,
  responsables = [],
  employees,
  activeRole,
  biometricPrefill = null,
  onSaveNewEmployee,
  onSaveEditEmployee,
  onSwitchToLinkExisting,
}) => {
  const formBodyRef = useRef<HTMLFormElement | null>(null);

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
  const [empCargoName, setEmpCargoName] = useState('');
  const [empRegimen, setEmpRegimen] = useState<RegimenLaboral>('D. LEG. 276');
  const [empCondicion, setEmpCondicion] = useState<CondicionLaboral>('NOMBRADO');
  const [empRole, setEmpRole] = useState<RoleType>('TRABAJADOR');
  const [empAssignedRoles, setEmpAssignedRoles] = useState<RoleType[]>(['TRABAJADOR']);
  const [empIsJefeDirector, setEmpIsJefeDirector] = useState(false);
  const [empScheduleId, setEmpScheduleId] = useState('');
  const [empHireDate, setEmpHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [empActive, setEmpActive] = useState(true);
  const [empZkTecoPin, setEmpZkTecoPin] = useState('');

  // Cuenta de Acceso
  const [empHasAccess, setEmpHasAccess] = useState(true);
  const [empUsername, setEmpUsername] = useState('');
  const [empInitialPassword, setEmpInitialPassword] = useState('123456');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [empAccountStatus, setEmpAccountStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [empAuthMethod, setEmpAuthMethod] = useState<'PASSWORD' | 'BIOMETRIC' | 'INSTITUTIONAL'>('PASSWORD');
  const [empRoleChangeReason, setEmpRoleChangeReason] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateDniEmp, setDuplicateDniEmp] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize state whenever modal opens or target employee / biometricPrefill changes
  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setDuplicateDniEmp(null);
    setIsSubmitting(false);

    if (editingEmp) {
      setEmpCode(editingEmp.codigo_trabajador || '');
      setEmpDni(editingEmp.dni || '');
      setEmpFirstName(editingEmp.first_name || '');
      setEmpLastNamePaterno(editingEmp.apellido_paterno || editingEmp.last_name?.split(' ')[0] || '');
      setEmpLastNameMaterno(editingEmp.apellido_materno || editingEmp.last_name?.split(' ')[1] || '');
      setEmpEmail(editingEmp.email || '');
      setEmpPhone(editingEmp.phone || '');
      setEmpDepId(editingEmp.dependencia_id || dependencias[0]?.id || '');
      setEmpDirId(editingEmp.direccion_organo_id || '');
      setEmpAreaId(editingEmp.area_id || '');
      setEmpSubareaId(editingEmp.subarea_id || '');
      setEmpCargoId(editingEmp.cargo_id || '');
      setEmpCargoName(editingEmp.position || '');
      setEmpRegimen(editingEmp.regimen_laboral || 'D. LEG. 276');
      setEmpCondicion(editingEmp.condicion_laboral || 'NOMBRADO');
      setEmpScheduleId(editingEmp.schedule_id || horarios[0]?.id || '');
      setEmpHireDate(editingEmp.hire_date || new Date().toISOString().split('T')[0]);
      setEmpActive(editingEmp.active !== false);
      setEmpZkTecoPin(editingEmp.zkteco_pin || editingEmp.dni || '');
      setEmpHasAccess(editingEmp.has_system_access !== false);
      setEmpUsername(
        editingEmp.username ||
          (editingEmp.first_name
            ? `${editingEmp.first_name.charAt(0).toLowerCase()}${(
                editingEmp.apellido_paterno ||
                editingEmp.last_name?.split(' ')[0] ||
                ''
              ).toLowerCase()}`
            : editingEmp.dni)
      );
      setEmpRole(editingEmp.role || 'TRABAJADOR');
      const existingRoles = getEmployeeAssignedRoles(editingEmp);
      setEmpAssignedRoles(existingRoles);
      setEmpIsJefeDirector(Boolean(editingEmp.is_jefe_director || existingRoles.includes('JEFE')));
      setEmpAccountStatus(editingEmp.account_status || (editingEmp.active ? 'ACTIVE' : 'INACTIVE'));
      setEmpAuthMethod(editingEmp.auth_method || 'PASSWORD');
      setEmpRoleChangeReason('');
      setEmpInitialPassword('');
      setShowInitialPassword(false);
    } else {
      const defaultDepId = dependencias[0]?.id || '';
      const defaultDirId = direccionesOrganos.find((d) => d.dependencia_id === defaultDepId)?.id || '';
      const rawClockName = biometricPrefill?.deviceUser?.clock_name
        ? String(biometricPrefill.deviceUser.clock_name).trim()
        : '';
      const isSyntheticClockName = !rawClockName || /^usuario\s+\d+$/i.test(rawClockName);

      setEmpCode(generateNextDracCode(employees));
      setEmpDni('');
      setEmpFirstName(!isSyntheticClockName ? rawClockName : '');
      setEmpLastNamePaterno('');
      setEmpLastNameMaterno('');
      setEmpEmail('');
      setEmpPhone('');
      setEmpDepId(defaultDepId);
      setEmpDirId(defaultDirId);
      setEmpAreaId('');
      setEmpSubareaId('');
      setEmpCargoId('');
      setEmpCargoName('');
      setEmpRegimen('D. LEG. 276');
      setEmpCondicion('NOMBRADO');
      setEmpScheduleId(horarios[0]?.id || '');
      setEmpHireDate(new Date().toISOString().split('T')[0]);
      setEmpActive(true);
      setEmpZkTecoPin(biometricPrefill?.deviceUser?.pin ? String(biometricPrefill.deviceUser.pin).trim() : '');
      setEmpHasAccess(true);
      setEmpUsername('');
      setEmpInitialPassword('123456');
      setShowInitialPassword(false);
      setEmpRole('TRABAJADOR');
      setEmpAccountStatus('ACTIVE');
      setEmpAuthMethod('PASSWORD');
      setEmpAssignedRoles(['TRABAJADOR']);
      setEmpIsJefeDirector(false);
      setEmpRoleChangeReason('');

      getNextDracCodeFromPostgres()
        .then((nextCode) => {
          if (nextCode) setEmpCode(nextCode);
        })
        .catch(() => {});
    }
  }, [isOpen, editingEmp, biometricPrefill]);

  // Live duplicate DNI detection while typing
  const liveDuplicateDni = useMemo(() => {
    if (editingEmp) return null;
    const clean = empDni.trim();
    if (clean.length !== 8) return null;
    return employees.find((e) => String(e.dni || '').trim() === clean) || null;
  }, [empDni, employees, editingEmp]);

  const autoCalculatedUsername = useMemo(() => {
    return generateUniqueUsername(
      empFirstName,
      empLastNamePaterno,
      empLastNameMaterno,
      employees,
      editingEmp?.id
    );
  }, [empFirstName, empLastNamePaterno, empLastNameMaterno, employees, editingEmp?.id]);

  const filteredDirsForEmp = useMemo(
    () => direccionesOrganos.filter((d) => d.dependencia_id === empDepId),
    [direccionesOrganos, empDepId]
  );
  const filteredAreasForEmp = useMemo(
    () =>
      areas.filter(
        (a) =>
          (!empDepId || a.dependencia_id === empDepId) &&
          (!empDirId || a.direccion_organo_id === empDirId) &&
          !a.parent_area_id
      ),
    [areas, empDepId, empDirId]
  );
  const filteredSubareasForEmp = useMemo(
    () => areas.filter((a) => a.parent_area_id === empAreaId),
    [areas, empAreaId]
  );

  const showError = (msg: string, existingDup?: Employee | null) => {
    setFormError(msg);
    setDuplicateDniEmp(existingDup || null);
    if (formBodyRef.current) {
      formBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!isOpen) return null;

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateDniEmp(null);

    const cleanDni = empDni.trim();
    if (
      !cleanDni ||
      !empFirstName.trim() ||
      !empLastNamePaterno.trim() ||
      !empLastNameMaterno.trim() ||
      !empDepId ||
      !empDirId
    ) {
      showError(
        'Debe completar obligatoriamente: DNI (8 dígitos), Nombres, Apellido Paterno, Apellido Materno, Dependencia Institucional y Dirección u Órgano.'
      );
      return;
    }

    if (!/^\d{8}$/.test(cleanDni)) {
      showError('Formato inválido: El DNI debe contener exactamente 8 dígitos numéricos.');
      return;
    }

    // Check duplicate DNI
    const dniDuplicate = employees.find(
      (emp) => String(emp.dni || '').trim() === cleanDni && emp.id !== editingEmp?.id
    );
    if (dniDuplicate) {
      showError(
        `Ya existe un trabajador registrado con el DNI ${cleanDni}: ${normalizePersonName(
          `${dniDuplicate.first_name} ${dniDuplicate.last_name}`
        )} (${dniDuplicate.codigo_trabajador}). No se permite crear registros duplicados.`,
        dniDuplicate
      );
      return;
    }

    // Check duplicate PIN if provided from clock prefill against another worker holding that PIN on the same device
    const cleanPin = empZkTecoPin.trim();
    if (!editingEmp && biometricPrefill && cleanPin) {
      const existingPinOwner = employees.find(
        (emp) =>
          String(emp.zkteco_pin || '').trim() === cleanPin &&
          (!emp.biometric_sync_device_id ||
            emp.biometric_sync_device_id === biometricPrefill.deviceUser.device_id)
      );
      if (existingPinOwner) {
        // Note: allowed only if they explicitly don't conflict, or warn clearly
        // We check server-side too; if user wants to assign same worker, Option A is preferred
      }
    }

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
      const usernameDuplicate = employees.find(
        (emp) =>
          emp.has_system_access &&
          emp.username?.toLowerCase() === finalUsername.toLowerCase() &&
          emp.id !== editingEmp?.id
      );
      if (usernameDuplicate) {
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
      showError('La Dependencia seleccionada no existe en el catálogo institucional DRAC.');
      return;
    }

    const selectedDir = direccionesOrganos.find((d) => d.id === empDirId);
    const selectedArea = areas.find((a) => a.id === empAreaId);
    const selectedSubarea = areas.find((a) => a.id === empSubareaId);
    const selectedCargo = cargos.find((c) => c.id === empCargoId);
    const selectedSchedule = horarios.find((h) => h.id === empScheduleId);

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

    const normalizedFirstName = normalizePersonName(empFirstName);
    const normalizedPat = normalizePersonName(empLastNamePaterno);
    const normalizedMat = normalizePersonName(empLastNameMaterno);
    const fullLastName = [normalizedPat, normalizedMat].filter(Boolean).join(' ');

    setIsSubmitting(true);
    try {
      const generatedCode = editingEmp
        ? editingEmp.codigo_trabajador || empCode.trim() || (await getNextDracCodeFromPostgres())
        : empCode.trim() || (await getNextDracCodeFromPostgres());

      // Check duplicate Código DRAC
      const codeDuplicate = employees.find(
        (emp) =>
          String(emp.codigo_trabajador || '').trim().toUpperCase() ===
            String(generatedCode || '').trim().toUpperCase() && emp.id !== editingEmp?.id
      );
      if (codeDuplicate) {
        setIsSubmitting(false);
        showError(
          `El Código DRAC "${generatedCode}" ya está asignado a ${normalizePersonName(
            `${codeDuplicate.first_name} ${codeDuplicate.last_name}`
          )} (DNI ${codeDuplicate.dni}).`
        );
        return;
      }

      const finalAccountStatus = !empActive
        ? 'INACTIVE'
        : empHasAccess
        ? empAccountStatus
        : 'INACTIVE';

      const finalAssignedRoles: RoleType[] = empAssignedRoles.includes('TRABAJADOR')
        ? empAssignedRoles
        : ['TRABAJADOR', ...empAssignedRoles];

      let finalPrimaryRole: RoleType = 'TRABAJADOR';
      if (finalAssignedRoles.includes('ADMIN_GENERAL')) finalPrimaryRole = 'ADMIN_GENERAL';
      else if (finalAssignedRoles.includes('DIRECTOR_GENERAL')) finalPrimaryRole = 'DIRECTOR_GENERAL';
      else if (finalAssignedRoles.includes('JEFE_RRHH') || finalAssignedRoles.includes('HR_ADMIN'))
        finalPrimaryRole = 'JEFE_RRHH';
      else if (finalAssignedRoles.includes('JEFE') || finalAssignedRoles.includes('SUPERVISOR'))
        finalPrimaryRole = 'JEFE';
      else if (finalAssignedRoles.includes('CONTROL_ASISTENCIA')) finalPrimaryRole = 'CONTROL_ASISTENCIA';
      else if (finalAssignedRoles.includes('VIGILANCIA') || finalAssignedRoles.includes('SECURITY_GUARD'))
        finalPrimaryRole = 'VIGILANCIA';

      const isDesignatedJefe = empIsJefeDirector || finalAssignedRoles.includes('JEFE');

      if (editingEmp) {
        const roleChanged =
          editingEmp.role !== finalPrimaryRole ||
          JSON.stringify(editingEmp.assigned_roles) !== JSON.stringify(finalAssignedRoles);
        const accessChanged =
          editingEmp.has_system_access !== empHasAccess ||
          editingEmp.account_status !== finalAccountStatus;
        const updatedRoleHistory: RoleHistoryEntry[] = [...(editingEmp.role_history || [])];

        if (roleChanged || accessChanged) {
          updatedRoleHistory.push({
            id: `rh-${Date.now()}`,
            previous_role: editingEmp.role,
            new_role: finalPrimaryRole,
            previous_status: editingEmp.has_system_access
              ? editingEmp.account_status || 'ACTIVE'
              : 'INACTIVE',
            new_status: finalAccountStatus,
            changed_at: new Date().toISOString(),
            changed_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General',
            reason:
              empRoleChangeReason.trim() ||
              (roleChanged
                ? `Actualización de perfiles asignados: ${finalAssignedRoles.join(' + ')}`
                : `Actualización del estado de cuenta a ${finalAccountStatus}`),
          });
        }

        if (onSaveEditEmployee) {
          const result = await onSaveEditEmployee({
            ...editingEmp,
            codigo_trabajador: generatedCode,
            dni: cleanDni,
            first_name: normalizedFirstName,
            last_name: fullLastName,
            apellido_paterno: normalizedPat,
            apellido_materno: normalizedMat,
            email:
              empEmail.trim() ||
              `${normalizedFirstName.toLowerCase().replace(/\s+/g, '.')}.${normalizedPat
                .toLowerCase()
                .replace(/\s+/g, '.')}@regioncajamarca.gob.pe`,
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
            unidad_dirigida_id: isDesignatedJefe ? empDirId || empAreaId : undefined,
            unidad_dirigida_name: isDesignatedJefe ? selectedDir?.name || selectedArea?.name : undefined,
            unidad_dirigida_type: isDesignatedJefe ? selectedDir?.type : undefined,
            has_system_access: empHasAccess,
            username: empHasAccess ? finalUsername : undefined,
            account_status: finalAccountStatus,
            auth_method: empAuthMethod,
            role: finalPrimaryRole,
            assigned_roles: finalAssignedRoles,
            role_history: updatedRoleHistory,
            password_hash: editingEmp.password_hash,
            password_salt: editingEmp.password_salt,
            password_change_required: editingEmp.password_change_required ?? false,
            primer_ingreso:
              editingEmp.primer_ingreso ??
              (editingEmp.password_change_required ? 'PENDIENTE' : 'COMPLETADO'),
            last_password_change: editingEmp.last_password_change,
            hire_date: empHireDate,
            active: empActive,
            schedule_id: empScheduleId || undefined,
            schedule_name: selectedSchedule ? selectedSchedule.name : 'Jornada Partida DRAC',
            zkteco_pin: cleanPin || cleanDni,
            supervisor_id: determinedSupervisorId,
            supervisor_name: determinedSupervisorName,
          });
          if (result && 'error' in result && result.error) {
            showError(result.error);
            setIsSubmitting(false);
            return;
          }
        }
        onClose();
      } else {
        const initialRoleHistory: RoleHistoryEntry[] = empHasAccess
          ? [
              {
                id: `rh-${Date.now()}`,
                previous_role: finalPrimaryRole,
                new_role: finalPrimaryRole,
                previous_status: 'ACTIVE',
                new_status: finalAccountStatus,
                changed_at: new Date().toISOString(),
                changed_by:
                  activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador General',
                reason: `Registro inicial de trabajador DRAC${
                  biometricPrefill ? ` desde usuario reloj PIN ${biometricPrefill.deviceUser.pin}` : ''
                }. Usuario asignado: @${finalUsername}. Perfiles: ${finalAssignedRoles.join(' + ')}`,
              },
            ]
          : [];

        const initialPasswordToUse = empInitialPassword.trim() || '123456';
        const { hash: initialHash, salt: initialSalt } = await hashPassword(initialPasswordToUse);

        const newEmpPayload: Omit<Employee, 'id'> = {
          codigo_trabajador: generatedCode,
          dni: cleanDni,
          first_name: normalizedFirstName,
          last_name: fullLastName,
          apellido_paterno: normalizedPat,
          apellido_materno: normalizedMat,
          email:
            empEmail.trim() ||
            `${normalizedFirstName.toLowerCase().replace(/\s+/g, '.')}.${normalizedPat
              .toLowerCase()
              .replace(/\s+/g, '.')}@regioncajamarca.gob.pe`,
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
          unidad_dirigida_id: isDesignatedJefe ? empDirId || empAreaId : undefined,
          unidad_dirigida_name: isDesignatedJefe ? selectedDir?.name || selectedArea?.name : undefined,
          unidad_dirigida_type: isDesignatedJefe ? selectedDir?.type : undefined,
          has_system_access: empHasAccess,
          username: empHasAccess ? finalUsername : undefined,
          account_status: finalAccountStatus,
          auth_method: empAuthMethod,
          role: finalPrimaryRole,
          assigned_roles: finalAssignedRoles,
          role_history: initialRoleHistory,
          password_hash: initialHash,
          password_salt: initialSalt,
          password_change_required: true,
          primer_ingreso: 'PENDIENTE',
          hire_date: empHireDate,
          active: empActive,
          schedule_id: empScheduleId || undefined,
          schedule_name: selectedSchedule ? selectedSchedule.name : 'Jornada Partida DRAC',
          zkteco_pin: cleanPin || cleanDni,
          biometric_user_id: biometricPrefill?.deviceUser?.pin || cleanPin || undefined,
          biometric_sync_device_id: biometricPrefill?.deviceUser?.device_id || undefined,
          biometric_sync_device_name: biometricPrefill?.deviceUser?.device_name || undefined,
          biometric_sync_status: biometricPrefill ? 'SINCRONIZADO' : undefined,
          supervisor_id: determinedSupervisorId,
          supervisor_name: determinedSupervisorName,
        };

        const result = await onSaveNewEmployee(newEmpPayload);
        if (result && 'error' in result && result.error) {
          showError(result.error, result.existingEmployee || null);
          setIsSubmitting(false);
          return;
        }
        onClose();
      }
    } catch (err: any) {
      showError(err?.message || 'Error inesperado guardando la ficha del trabajador.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {editingEmp
                  ? 'Editar Ficha y Perfil de Trabajador'
                  : biometricPrefill
                  ? 'Registrar Nuevo Trabajador DRAC (Desde Reloj Biométrico)'
                  : 'Registrar Nuevo Trabajador DRAC'}
              </h3>
              <p className="text-xs text-slate-400">
                Dirección Regional de Agricultura Cajamarca — Gestión de datos laborales y credenciales de acceso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formBodyRef} onSubmit={handleSubmitEmployee} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Biometric Origin Context Banner when opened from DeviceUsersSection */}
          {biometricPrefill && !editingEmp && (
            <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/35 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
                  <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Origen Biométrico ZKTeco Vinculado al Registro</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-mono text-[10px]">
                  Al guardar se vinculará con estado REGISTRADO
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">PIN Biométrico</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {biometricPrefill.deviceUser.pin}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Nombre en Reloj</span>
                  <span className="text-slate-200 font-semibold">
                    {biometricPrefill.deviceUser.clock_name || 'Sin nombre en reloj'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Dispositivo</span>
                  <span className="text-slate-200">{biometricPrefill.deviceUser.device_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Número de Serie</span>
                  <span className="font-mono text-slate-300">{biometricPrefill.deviceUser.device_sn}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Complete manualmente el DNI y los apellidos institucionales reales si el reloj no los suministró. Si el DNI ya existe en el padrón, el sistema le permitirá pasar a vincularlo sin duplicar registros.
              </p>
            </div>
          )}

          {/* Error & Duplicate DNI / Code Warning Banner */}
          {(formError || liveDuplicateDni) && (
            <div className="p-3.5 bg-rose-950/45 border border-rose-700/70 rounded-xl space-y-2.5 text-xs text-rose-100">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-rose-200">
                    {liveDuplicateDni
                      ? `DNI ${liveDuplicateDni.dni} ya registrado en el Directorio Institucional`
                      : 'Validación de Registro Institucional'}
                  </div>
                  <p className="text-rose-100/90">
                    {formError ||
                      `Este DNI pertenece a ${normalizePersonName(
                        `${liveDuplicateDni!.first_name} ${liveDuplicateDni!.last_name}`
                      )} (Código ${liveDuplicateDni!.codigo_trabajador} · ${
                        liveDuplicateDni!.dependencia_name || 'DRAC'
                      }). No se permite crear un segundo trabajador con el mismo DNI.`}
                  </p>
                </div>
              </div>
              {(duplicateDniEmp || liveDuplicateDni) && onSwitchToLinkExisting && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSwitchToLinkExisting((duplicateDniEmp || liveDuplicateDni)!)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Ir a VINCULAR CON TRABAJADOR EXISTENTE</span>
                  </button>
                </div>
              )}
            </div>
          )}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    DNI (Documento Nacional de Identidad) <span className="text-rose-400">*</span>
                  </label>
                  {editingEmp && (
                    <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 font-bold">
                      Solo Lectura
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="71234567"
                  value={empDni}
                  readOnly={Boolean(editingEmp)}
                  disabled={Boolean(editingEmp)}
                  onChange={(e) => !editingEmp && setEmpDni(e.target.value.replace(/\D/g, ''))}
                  className={`w-full border rounded-lg p-2.5 text-xs font-mono ${
                    editingEmp
                      ? 'bg-[#060709] border-slate-800 text-slate-400 cursor-not-allowed opacity-90 select-all'
                      : liveDuplicateDni
                      ? 'bg-[#090A0D] border-rose-500 text-white focus:outline-none'
                      : 'bg-[#090A0D] border-slate-800 text-white focus:outline-none focus:border-indigo-500'
                  }`}
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {editingEmp
                    ? 'El DNI es el identificador único del trabajador y está protegido contra cambios'
                    : 'Exactamente 8 dígitos numéricos'}
                </span>
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
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Correo Electrónico Institucional
                </label>
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
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Subárea / Unidad (Opcional)
                  </label>
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
                  <option value="D. LEG. 276">D. LEG. 276</option>
                  <option value="D. LEG. 728">D. LEG. 728</option>
                  <option value="D. LEG. 1057 - CAS">D. LEG. 1057 - CAS</option>
                  <option value="PRACTICANTE">PRACTICANTE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                <label className="block text-xs font-bold text-slate-300 mb-1">Fecha de Ingreso</label>
                <input
                  type="date"
                  value={empHireDate}
                  onChange={(e) => setEmpHireDate(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Estado Laboral</label>
                <select
                  value={empActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setEmpActive(e.target.value === 'ACTIVE')}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVO (En servicio)</option>
                  <option value="INACTIVE">INACTIVO (Cese / Baja)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">PIN Biométrico</label>
                  {biometricPrefill && (
                    <span className="text-[9px] font-mono text-indigo-300 bg-indigo-950/70 px-1.5 py-0.2 rounded border border-indigo-700/60">
                      Del Reloj
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Ej: 71234567"
                  value={empZkTecoPin}
                  readOnly={Boolean(biometricPrefill && !editingEmp)}
                  onChange={(e) => !(biometricPrefill && !editingEmp) && setEmpZkTecoPin(e.target.value)}
                  className={`w-full border rounded-lg p-2.5 text-xs font-mono ${
                    biometricPrefill && !editingEmp
                      ? 'bg-[#060709] border-indigo-800/60 text-indigo-300 cursor-not-allowed'
                      : 'bg-[#090A0D] border-slate-800 text-white focus:outline-none focus:border-indigo-500'
                  }`}
                />
              </div>
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
                      <div className="text-emerald-300 font-bold">Turno 2: {selectedH.turno2_name}</div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      Días: {selectedH.working_days?.join(', ') || 'L-V'} | Duración:{' '}
                      {selectedH.total_duration_text || (selectedH.turn_count === 2 ? '8 horas' : '8 horas')}
                    </div>
                  </div>
                );
              })()}
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

            <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-300 leading-relaxed">
                <span className="font-bold text-white">Diferenciación Obligatoria:</span> El{' '}
                <span className="text-indigo-300 font-semibold">Cargo Institucional</span> (arriba) es el puesto de trabajo en la DRAC. El{' '}
                <span className="text-emerald-300 font-semibold">Perfil del Sistema</span> (abajo) determina exclusivamente los permisos y accesos dentro del software de asistencia.
              </div>
            </div>

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
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      empHasAccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
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
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      !empHasAccess ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
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

            {!empHasAccess && (
              <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-300">
                  El trabajador figurará en el padrón laboral de la DRAC y sincronizará con el reloj biométrico, pero{' '}
                  <strong>no podrá iniciar sesión en la aplicación web</strong>.
                </p>
              </div>
            )}

            {empHasAccess && (
              <div className="space-y-4 bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            editingEmp.primer_ingreso === 'PENDIENTE' || editingEmp.password_change_required
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {editingEmp.primer_ingreso === 'PENDIENTE' || editingEmp.password_change_required
                            ? 'Pendiente'
                            : 'Completado'}
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
                          {showInitialPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                    <span className="text-[9px] text-slate-400 mt-0.5 block">
                      {editingEmp ? 'Hash SHA-256 institucional' : 'Definición libre sin restricciones'}
                    </span>
                  </div>

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

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Método de Autenticación
                    </label>
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

                <div className="p-2.5 bg-indigo-950/20 border border-indigo-500/20 rounded-lg flex items-start gap-2 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-slate-300 leading-relaxed">
                    <strong className="text-white">Flujo de Seguridad de Contraseñas:</strong> En el registro del trabajador se asigna una contraseña temporal libremente. En su primer inicio de sesión, el sistema{' '}
                    <strong>bloqueará el acceso y exigirá obligatoriamente el cambio de contraseña</strong> aplicando las políticas de longitud y complejidad configuradas.
                  </div>
                </div>

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

                  {/* Base Role */}
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

                  {(() => {
                    const selectedDir = direccionesOrganos.find((d) => d.id === empDirId);
                    const selectedArea = areas.find((a) => a.id === empAreaId);
                    const organoType = selectedDir?.type;
                    const isOrganicJefeEligible = Boolean(
                      organoType && VALID_JEFE_ORGANO_TYPES.includes(organoType)
                    );

                    const toggleRole = (roleToToggle: RoleType) => {
                      if (roleToToggle === 'TRABAJADOR') return;

                      if (roleToToggle === 'JEFE') {
                        if (!isOrganicJefeEligible && !empAssignedRoles.includes('JEFE')) {
                          showError(
                            `Restricción Institucional: El perfil "Jefe Inmediato" requiere Dirección, Órganos de Apoyo, Jefatura de Agencia u Oficina Agraria. La unidad seleccionada (${
                              selectedDir?.name || selectedArea?.name || 'No especificada'
                            }) tiene clasificación: ${
                              organoType || 'Sin Clasificación Válida'
                            }. Use "Encargaturas Temporales" para suplencias.`
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

                        <div
                          onClick={() => toggleRole('JEFE')}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            empAssignedRoles.includes('JEFE')
                              ? 'bg-amber-950/30 border-amber-500/50 shadow-sm'
                              : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                          }`}
                        >
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
                              {!isOrganicJefeEligible && (
                                <div className="mt-2 p-2 bg-amber-950/40 border border-amber-500/30 rounded text-[10px] text-amber-200 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>
                                    Unidad actual ({selectedDir?.name || 'No seleccionada'}) — Clasificación:{' '}
                                    <strong>{organoType || 'Sin clasificación'}</strong>. Para suplencias temporales, utilice{' '}
                                    <strong>Encargaturas Temporales</strong>.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

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
                              checked={
                                empAssignedRoles.includes('HR_ADMIN') || empAssignedRoles.includes('JEFE_RRHH')
                              }
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
                                <span className="text-xs font-bold text-white">Control de Puerta &amp; Sellado Real</span>
                              </div>
                              <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                                Fiscalización física en portería, verificación de papeletas autorizadas y sellado en tiempo real de hora de salida y retorno.
                              </p>
                            </div>
                          </div>
                        </div>

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
                                <span className="text-xs font-bold text-white">Superadministración Técnica DRAC</span>
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

                  <div className="p-3.5 bg-[#090A0D] border border-slate-800 rounded-xl space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span>Perfil Resultante Acumulado:</span>
                      <span className="text-[10px] text-indigo-400 font-mono">
                        {empAssignedRoles.join(' + ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {empAssignedRoles.map((r, idx) => {
                        const rDef =
                          SYSTEM_ROLES_CATALOG.find((x) => x.role === r) || SYSTEM_ROLES_CATALOG[0];
                        return (
                          <React.Fragment key={r}>
                            {idx > 0 && <span className="text-xs text-slate-500 font-bold">+</span>}
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded-md border flex items-center gap-1 ${rDef.color}`}
                            >
                              <Shield className="w-3 h-3" />
                              <span>{rDef.badge}</span>
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {editingEmp && editingEmp.role !== empRole && (
                  <div className="p-3 bg-amber-950/20 border border-amber-500/40 rounded-xl space-y-1.5">
                    <label className="block text-[11px] font-bold text-amber-300">
                      Motivo del cambio de Perfil (Requerido para Bitácora de Auditoría){' '}
                      <span className="text-rose-400">*</span>
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

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(liveDuplicateDni)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : editingEmp
                  ? 'Guardar Cambios de Personal'
                  : biometricPrefill
                  ? 'Registrar Trabajador y Vincular Reloj'
                  : 'Completar Registro de Trabajador'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
