import {
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  ResponsableDesignation,
  Employee,
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

export const INITIAL_TURNOS: Turno[] = [];

export const INITIAL_HORARIOS: Horario[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_DEVICES: DispositivoZkTeco[] = [];

export const INITIAL_RAW_PUNCHES: MarcacionRaw[] = [];

export const INITIAL_PAPELETAS: PapeletaSalida[] = [];

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
