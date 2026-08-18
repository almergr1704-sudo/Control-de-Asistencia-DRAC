import { Employee, Encargatura, OrganoType, RoleType } from '../types';

export const VALID_JEFE_ORGANO_TYPES: OrganoType[] = [
  'DIRECCION',
  'ORGANO_APOYO',
  'JEFATURA_AGENCIA',
  'OFICINA_AGRARIA',
];

/**
 * Retorna todos los perfiles asignados a un trabajador.
 * Garantiza que TRABAJADOR siempre esté presente como perfil base obligatorio.
 */
export function getEmployeeAssignedRoles(emp?: Employee | null): RoleType[] {
  if (!emp) return ['TRABAJADOR'];
  const base: RoleType[] = ['TRABAJADOR'];
  const assigned = emp.assigned_roles || [];
  
  assigned.forEach((r) => {
    if (!base.includes(r)) {
      base.push(r);
    }
  });

  if (emp.role && !base.includes(emp.role)) {
    base.push(emp.role);
  }

  return base;
}

/**
 * Valida si un trabajador cumple con los requisitos institucionales para ser Jefe Inmediato:
 * Directores de Direcciones, Jefes de Órganos de Apoyo, Jefes de Agencia y Jefes de Oficina Agraria.
 */
export function isEligibleForJefeInmediato(params: {
  organoType?: OrganoType | string;
  isJefeDirector?: boolean;
  cargoName?: string;
  position?: string;
}): { eligible: boolean; reason?: string } {
  const { organoType, isJefeDirector, cargoName = '', position = '' } = params;

  const validOrg = organoType && VALID_JEFE_ORGANO_TYPES.includes(organoType as OrganoType);
  const positionText = `${cargoName} ${position}`.toUpperCase();
  const hasLeadershipTitle =
    Boolean(isJefeDirector) ||
    positionText.includes('DIRECTOR') ||
    positionText.includes('JEFE') ||
    positionText.includes('RESPONSABLE');

  if (!validOrg && !hasLeadershipTitle) {
    return {
      eligible: false,
      reason:
        'El perfil Jefe Inmediato solo puede corresponder a Directores de Direcciones, Jefes de Órganos de Apoyo, Jefes de Agencia y Jefes de Oficina Agraria.',
    };
  }

  return { eligible: true };
}

/**
 * Calcula automáticamente el estado de una encargatura según la fecha actual del sistema.
 */
export function computeEncargaturaStatus(
  enc: Encargatura,
  currentDate: string = new Date().toISOString().substring(0, 10)
): 'PENDIENTE' | 'VIGENTE' | 'FINALIZADA' | 'ANULADA' {
  if (enc.status === 'ANULADA') return 'ANULADA';
  
  if (currentDate < enc.start_date) {
    return 'PENDIENTE';
  }
  if (currentDate > enc.end_date) {
    return 'FINALIZADA';
  }
  return 'VIGENTE';
}

/**
 * Obtiene las encargaturas activas/vigentes de un trabajador en una fecha determinada.
 */
export function getActiveEncargaturasForUser(
  userDni: string,
  allEncargaturas: Encargatura[],
  currentDate: string = new Date().toISOString().substring(0, 10)
): Encargatura[] {
  return allEncargaturas.filter((enc) => {
    if (enc.encargado_dni !== userDni) return false;
    const computedStatus = computeEncargaturaStatus(enc, currentDate);
    return computedStatus === 'VIGENTE';
  });
}

/**
 * Determina si un usuario (sea como Jefe Titular o Jefe Encargado) tiene potestad de dar VoBo
 * a una papeleta de un trabajador solicitante.
 */
export function canApproveAsBoss(params: {
  bossDni: string;
  bossEmployee?: Employee | null;
  requesterEmployee?: Employee | null;
  allEncargaturas: Encargatura[];
  currentDate?: string;
}): {
  canApprove: boolean;
  isEncargado: boolean;
  activeEncargatura?: Encargatura;
  reason: string;
} {
  const { bossDni, bossEmployee, requesterEmployee, allEncargaturas, currentDate } = params;

  if (!requesterEmployee) {
    return { canApprove: false, isEncargado: false, reason: 'Trabajador solicitante no encontrado' };
  }

  // 1. Revisar si tiene una Encargatura Temporal Vigente para el ámbito del solicitante
  const activeEncargaturas = getActiveEncargaturasForUser(bossDni, allEncargaturas, currentDate);
  for (const enc of activeEncargaturas) {
    let matchesUnit = false;
    if (enc.direccion_organo_id && requesterEmployee.direccion_organo_id === enc.direccion_organo_id) {
      matchesUnit = true;
    }
    if (enc.area_id && requesterEmployee.area_id === enc.area_id) {
      matchesUnit = true;
    }
    if (enc.dependencia_id && requesterEmployee.dependencia_id === enc.dependencia_id) {
      matchesUnit = true;
    }

    if (matchesUnit) {
      return {
        canApprove: true,
        isEncargado: true,
        activeEncargatura: enc,
        reason: `Jefe Encargado mediante ${enc.document_type} N.º ${enc.document_number} (${enc.cargo_encargado})`,
      };
    }
  }

  // 2. Revisar si es el Jefe Inmediato Titular
  if (bossEmployee) {
    const roles = getEmployeeAssignedRoles(bossEmployee);
    const hasJefeRole = roles.includes('JEFE') || roles.includes('SUPERVISOR');
    
    if (hasJefeRole) {
      // Supervisor directo
      if (requesterEmployee.supervisor_id === bossEmployee.id) {
        return { canApprove: true, isEncargado: false, reason: 'Jefe Inmediato Titular Directo' };
      }

      // Titular de la Dirección / Órgano
      if (
        bossEmployee.is_jefe_director &&
        bossEmployee.direccion_organo_id &&
        bossEmployee.direccion_organo_id === requesterEmployee.direccion_organo_id
      ) {
        return { canApprove: true, isEncargado: false, reason: 'Director / Jefe Titular de la Unidad Orgánica' };
      }

      // Titular de RRHH aprobando a su propia área
      if (
        bossEmployee.area_id &&
        bossEmployee.area_id === requesterEmployee.area_id
      ) {
        return { canApprove: true, isEncargado: false, reason: 'Jefe Inmediato de Área / Oficina' };
      }
    }
  }

  return { canApprove: false, isEncargado: false, reason: 'Fuera del ámbito orgánico asignado' };
}
