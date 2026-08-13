import { RoleType } from '../types';

export const VIEW_TO_HASH: Record<string, string> = {
  dash_overview: '#/dashboard',
  org_deps: '#/organizacion/dependencias',
  org_dirs: '#/organizacion/direcciones',
  org_areas: '#/organizacion/areas',
  org_cargos: '#/organizacion/cargos',
  org_resps: '#/organizacion/responsables',
  personnel_list: '#/directorio-personal/directorio',
  personnel_new: '#/directorio-personal/registrar',
  personnel_assign: '#/directorio-personal/asignaciones',
  personnel_history: '#/directorio-personal/historial',
  shifts_turnos: '#/turnos',
  shifts_horarios: '#/horarios',
  shifts_assign: '#/asignacion-horarios',
  attendance_list: '#/asistencia',
  attendance_punches: '#/marcaciones',
  attendance_incidents: '#/incidencias',
  attendance_corrections: '#/asistencia/correcciones',
  devices_list: '#/biometricos/dispositivos',
  devices_sync: '#/biometricos/sincronizacion',
  devices_staging: '#/biometricos/staging',
  vacations_requests: '#/vacaciones/solicitudes',
  vacations_approvals: '#/vacaciones/aprobaciones',
  vacations_history: '#/vacaciones/historial',
  papeletas_new: '#/papeletas/nueva',
  papeletas_my: '#/papeletas/mis-papeletas',
  papeletas_pending: '#/papeletas/pendientes',
  papeletas_approved: '#/papeletas/aprobadas',
  papeletas_history: '#/papeletas/historial',
  security_papeletas: '#/vigilancia',
  security_exit: '#/vigilancia/salidas',
  security_return: '#/vigilancia/retornos',
  security_outside: '#/vigilancia/personal-fuera',
  reports_attendance: '#/reportes/asistencia',
  reports_tardiness: '#/reportes/tardanzas',
  reports_absences: '#/reportes/faltas',
  reports_overtime: '#/reportes/horas-extras',
  reports_vacations: '#/reportes/vacaciones',
  reports_papeletas: '#/reportes/papeletas',
  reports_exits: '#/reportes/salidas',
  admin_users: '#/administracion/usuarios',
  admin_roles: '#/administracion/roles',
  admin_audit: '#/administracion/auditoria',
  config_system: '#/configuracion',
};

export const HASH_TO_VIEW: Record<string, string> = Object.entries(VIEW_TO_HASH).reduce(
  (acc, [view, hash]) => {
    acc[hash] = view;
    return acc;
  },
  {} as Record<string, string>
);

export const VIEW_TO_GROUP: Record<string, string> = {
  dash_overview: 'inicio',
  org_deps: 'org',
  org_dirs: 'org',
  org_areas: 'org',
  org_cargos: 'org',
  org_resps: 'org',
  personnel_list: 'personnel',
  personnel_new: 'personnel',
  personnel_assign: 'personnel',
  personnel_history: 'personnel',
  shifts_turnos: 'shifts',
  shifts_horarios: 'shifts',
  shifts_assign: 'shifts',
  attendance_list: 'attendance',
  attendance_punches: 'attendance',
  attendance_incidents: 'attendance',
  attendance_corrections: 'attendance',
  devices_list: 'devices',
  devices_sync: 'devices',
  devices_staging: 'devices',
  vacations_requests: 'vacations',
  vacations_approvals: 'vacations',
  vacations_history: 'vacations',
  papeletas_new: 'papeletas',
  papeletas_my: 'papeletas',
  papeletas_pending: 'papeletas',
  papeletas_approved: 'papeletas',
  papeletas_history: 'papeletas',
  security_papeletas: 'security',
  security_exit: 'security',
  security_return: 'security',
  security_outside: 'security',
  reports_attendance: 'reports',
  reports_tardiness: 'reports',
  reports_absences: 'reports',
  reports_overtime: 'reports',
  reports_vacations: 'reports',
  reports_papeletas: 'reports',
  reports_exits: 'reports',
  admin_users: 'admin',
  admin_roles: 'admin',
  admin_audit: 'admin',
  config_system: 'config',
};

export function isViewAllowedForRole(viewId: string, role: RoleType): boolean {
  if (role === 'HR_ADMIN') return true;

  if (role === 'SUPERVISOR') {
    return !viewId.startsWith('admin_') && viewId !== 'config_system';
  }

  if (role === 'SECURITY_GUARD') {
    return (
      viewId === 'dash_overview' ||
      viewId.startsWith('security_') ||
      viewId === 'attendance_list'
    );
  }

  if (role === 'EMPLOYEE') {
    return (
      viewId === 'dash_overview' ||
      viewId === 'attendance_list' ||
      viewId === 'attendance_punches' ||
      viewId === 'vacations_requests' ||
      viewId === 'vacations_history' ||
      viewId === 'papeletas_new' ||
      viewId === 'papeletas_my' ||
      viewId === 'papeletas_history'
    );
  }

  return true;
}

export function getViewFromHash(hash: string, role: RoleType): string {
  const cleanHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '#/dashboard';
  const matchedView = HASH_TO_VIEW[cleanHash] || HASH_TO_VIEW['#/'] || 'dash_overview';

  if (isViewAllowedForRole(matchedView, role)) {
    return matchedView;
  }

  return 'dash_overview';
}
