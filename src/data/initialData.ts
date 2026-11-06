import {
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  ResponsableDesignation,
  Employee,
  Encargatura,
  Turno,
  Horario,
  DispositivoZkTeco,
  MarcacionRaw,
  PapeletaSalida,
  PapeletaAudit,
  Vacacion,
  AsistenciaProcesada,
  RbacPermission,
  AuditLog,
} from '../types';

export const INITIAL_DEPENDENCIAS: Dependencia[] = [];

export const INITIAL_DIRECCIONES_ORGANOS: DireccionOrgano[] = [];

export const INITIAL_AREAS: Area[] = [];

export const INITIAL_CARGOS: Cargo[] = [];

export const INITIAL_RESPONSABLES: ResponsableDesignation[] = [];

export const INITIAL_TURNOS: Turno[] = [
  {
    id: "turno-01",
    code: "T-01",
    name: "Turno Mañana Institucional",
    description: "Jornada matutina ordinaria de lunes a viernes según RIS DRAC",
    start_time: "08:00",
    end_time: "13:00",
    window_entry_start: "07:00",
    window_exit_limit: "13:30",
    tolerance_minutes: 10,
    tolerance_exit_minutes: 0,
    is_overnight: false,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z"
  },
  {
    id: "turno-02",
    code: "T-02",
    name: "Turno Tarde Institucional",
    description: "Jornada vespertina ordinaria posterior al refrigerio institucional",
    start_time: "14:00",
    end_time: "17:00",
    window_entry_start: "13:30",
    window_exit_limit: "17:30",
    tolerance_minutes: 5,
    tolerance_exit_minutes: 0,
    is_overnight: false,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z"
  },
  {
    id: "turno-03",
    code: "T-03",
    name: "Jornada Continua Sede Central",
    description: "Horario corrido de 8 horas con refrigerio intercalado",
    start_time: "07:30",
    end_time: "15:30",
    window_entry_start: "06:45",
    window_exit_limit: "16:00",
    tolerance_minutes: 10,
    tolerance_exit_minutes: 0,
    is_overnight: false,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z"
  },
  {
    id: "turno-04",
    code: "T-04",
    name: "Turno Especial Campo y Riego",
    description: "Jornada temprana para inspectores y técnicos de agencias agrarias",
    start_time: "06:00",
    end_time: "14:00",
    window_entry_start: "05:30",
    window_exit_limit: "14:30",
    tolerance_minutes: 15,
    tolerance_exit_minutes: 0,
    is_overnight: false,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z"
  },
  {
    id: "turno-05",
    code: "T-05",
    name: "Turno Vigilancia Diurno",
    description: "Servicio de resguardo institucional y control de accesos sede",
    start_time: "07:00",
    end_time: "19:00",
    window_entry_start: "06:30",
    window_exit_limit: "19:30",
    tolerance_minutes: 10,
    tolerance_exit_minutes: 0,
    is_overnight: false,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z"
  }
];

export const INITIAL_HORARIOS: Horario[] = [
  {
    id: "hor-01",
    code: "HOR-01",
    name: "Jornada Partida Institucional DRAC",
    turn_count: 2,
    turno1_id: "turno-01",
    turno1_name: "Turno Mañana Institucional (08:00 - 13:00)",
    turno2_id: "turno-02",
    turno2_name: "Turno Tarde Institucional (14:00 - 17:00)",
    working_days: ["MON", "TUE", "WED", "THU", "FRI"],
    active: true,
    effective_start_date: "2026-01-01",
    effective_end_date: null,
    version: 1,
    total_hours: 8,
    total_duration_text: "8 horas diarias (2 turnos: 5h mañana + 3h tarde)"
  },
  {
    id: "hor-02",
    code: "HOR-02",
    name: "Jornada Continua Sede Central",
    turn_count: 1,
    turno1_id: "turno-03",
    turno1_name: "Jornada Continua Sede Central (07:30 - 15:30)",
    turno2_id: null,
    turno2_name: undefined,
    working_days: ["MON", "TUE", "WED", "THU", "FRI"],
    active: true,
    effective_start_date: "2026-01-01",
    effective_end_date: null,
    version: 1,
    total_hours: 8,
    total_duration_text: "8 horas diarias continuas"
  },
  {
    id: "hor-03",
    code: "HOR-03",
    name: "Horario Especial de Campo y Agencias Agrarias",
    turn_count: 1,
    turno1_id: "turno-04",
    turno1_name: "Turno Especial Campo y Riego (06:00 - 14:00)",
    turno2_id: null,
    turno2_name: undefined,
    working_days: ["MON", "TUE", "WED", "THU", "FRI"],
    active: true,
    effective_start_date: "2026-01-01",
    effective_end_date: null,
    version: 1,
    total_hours: 8,
    total_duration_text: "8 horas en jornada de campo matutina"
  },
  {
    id: "hor-04",
    code: "HOR-04",
    name: "Horario de Seguridad y Vigilancia",
    turn_count: 1,
    turno1_id: "turno-05",
    turno1_name: "Turno Vigilancia Diurno (07:00 - 19:00)",
    turno2_id: null,
    turno2_name: undefined,
    working_days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    active: true,
    effective_start_date: "2026-01-01",
    effective_end_date: null,
    version: 1,
    total_hours: 12,
    total_duration_text: "12 horas diurnas"
  }
];

/**
 * ÚNICA CUENTA INICIAL PERMITIDA:
 * Usuario: admin
 * Contraseña inicial temporal: Drac2026
 * Perfil: Administrador General
 * Requiere cambio obligatorio de contraseña en el primer inicio de sesión.
 */
export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-admin',
    codigo_trabajador: 'DRAC-0001',
    dni: '10000001',
    first_name: 'Administrador',
    last_name: 'General',
    apellido_paterno: 'General',
    apellido_materno: '',
    username: 'admin',
    email: 'admin@drac.gob.pe',
    phone: '',
    dependencia_id: '',
    dependencia_name: '',
    direccion_organo_id: '',
    direccion_organo_name: '',
    area_id: '',
    area_name: '',
    position: 'Administrador General del Sistema',
    cargo_id: '',
    regimen_laboral: 'D.L. 276',
    condicion_laboral: 'NOMBRADO',
    role: 'ADMIN_GENERAL',
    assigned_roles: ['ADMIN_GENERAL'],
    has_system_access: true,
    account_status: 'ACTIVE',
    auth_method: 'PASSWORD',
    primer_ingreso: 'PENDIENTE',
    password_change_required: true,
    active: true,
    hire_date: '2026-01-01',
    zkteco_pin: '10000001',
    schedule_id: '',
    schedule_name: '',
  },
];

export const INITIAL_DEVICES: DispositivoZkTeco[] = [];

import { INITIAL_RAW_PUNCHES } from './initialRawPunches';
export { INITIAL_RAW_PUNCHES };

export const INITIAL_PAPELETAS: PapeletaSalida[] = [];

export const INITIAL_ENCARGATURAS: Encargatura[] = [];

export const INITIAL_PAPELETA_AUDITS: PapeletaAudit[] = [];

export const INITIAL_VACACIONES: Vacacion[] = [];

export const INITIAL_ATTENDANCE: AsistenciaProcesada[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const RBAC_PERMISSIONS_MATRIX: RbacPermission[] = [
  {
    module: 'ASISTENCIA',
    action: 'Ver Asistencia Propia',
    description: 'Consultar marcaciones y consolidados de asistencia personal',
    employee: true,
    supervisor: true,
    hr_admin: true,
    security_guard: true,
  },
  {
    module: 'ASISTENCIA',
    action: 'Ver Asistencia de Equipo / Área',
    description: 'Consultar asistencia de subordinados directos',
    employee: false,
    supervisor: true,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'ASISTENCIA',
    action: 'Ver Asistencia Global Empresa',
    description: 'Acceso a reporte completo de todos los empleados y áreas',
    employee: false,
    supervisor: false,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'PAPELETAS',
    action: 'Crear Solicitud de Papeleta',
    description: 'Registrar solicitud de salida para sí mismo (Excepción de escritura)',
    employee: true,
    supervisor: true,
    hr_admin: true,
    security_guard: true,
  },
  {
    module: 'PAPELETAS',
    action: 'Dar VoBo Jefe Inmediato',
    description: 'Aprobar o rechazar el primer nivel de papeleta de equipo',
    employee: false,
    supervisor: true,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'PAPELETAS',
    action: 'Aprobación Final RRHH',
    description: 'Conceder la aprobación institucional final de la papeleta',
    employee: false,
    supervisor: false,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'PAPELETAS',
    action: 'Control de Garita / Registro Salida-Retorno',
    description: 'Visualizar papeletas aprobadas del día y registrar horas reales',
    employee: false,
    supervisor: false,
    hr_admin: true,
    security_guard: true,
  },
  {
    module: 'VACACIONES',
    action: 'Ver Mis Vacaciones',
    description: 'Consultar saldo y períodos de descanso asignados',
    employee: true,
    supervisor: true,
    hr_admin: true,
    security_guard: true,
  },
  {
    module: 'VACACIONES',
    action: 'Asignar / Gestionar Vacaciones',
    description: 'Asignar períodos totales o parciales e impacto en horario',
    employee: false,
    supervisor: false,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'CONFIGURACION',
    action: 'Gestionar Turnos y Horarios',
    description: 'Configurar turnos (1 o 2 por día) y asignar jornadas',
    employee: false,
    supervisor: false,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'BIOMETRICOS',
    action: 'CRUD Dispositivos ZKTeco',
    description: 'Administración de IP, puertos y protocolos de marcadores',
    employee: false,
    supervisor: false,
    hr_admin: true,
    security_guard: false,
  },
  {
    module: 'REPORTES',
    action: 'Exportar Excel / PDF',
    description: 'Generación de consolidados ejecutivos y auditorías',
    employee: false,
    supervisor: true,
    hr_admin: true,
    security_guard: false,
  },
];
