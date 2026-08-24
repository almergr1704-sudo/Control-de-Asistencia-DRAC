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
 * Busca si existe una Encargatura Temporal Vigente activa para una unidad orgánica específica
 * o para un jefe titular específico.
 */
export function getActiveEncargaturaForUnit(params: {
  direccionOrganoId?: string;
  areaId?: string;
  dependenciaId?: string;
  titularDni?: string;
  allEncargaturas: Encargatura[];
  currentDate?: string;
}): Encargatura | null {
  const { direccionOrganoId, areaId, dependenciaId, titularDni, allEncargaturas, currentDate = new Date().toISOString().substring(0, 10) } = params;

  for (const enc of allEncargaturas) {
    if (enc.status === 'ANULADA') continue;
    const status = computeEncargaturaStatus(enc, currentDate);
    if (status !== 'VIGENTE') continue;

    // Coincidencia por titular ausente
    if (titularDni && enc.titular_dni === titularDni) {
      return enc;
    }

    // Coincidencia por unidad orgánica encargada
    if (areaId && enc.area_id && enc.area_id === areaId) {
      return enc;
    }
    if (direccionOrganoId && enc.direccion_organo_id && enc.direccion_organo_id === direccionOrganoId) {
      return enc;
    }
    if (dependenciaId && enc.dependencia_id && enc.dependencia_id === dependenciaId && !enc.direccion_organo_id && !enc.area_id) {
      return enc;
    }
  }

  return null;
}

/**
 * Determina si un usuario (sea como Jefe Titular o Jefe Encargado) tiene potestad de dar VoBo
 * a una papeleta o trámite de un trabajador solicitante.
 * 
 * REGLA INSTITUCIONAL DE ENCARGATURAS:
 * 1. Si existe una Encargatura Temporal Vigente para la unidad:
 *    - El JEFE TITULAR queda TEMPORALMENTE SUSPENDIDO de aprobar en esa unidad durante la vigencia.
 *    - El TRABAJADOR ENCARGADO asume la potestad de dar V°B°.
 * 2. Al vencer la vigencia, la autoridad se restituye automáticamente al titular sin modificar roles.
 * 3. En ningún caso un usuario puede dar V°B° a sus propios trámites (anti-autoaprobación).
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
  const { bossDni, bossEmployee, requesterEmployee, allEncargaturas, currentDate = new Date().toISOString().substring(0, 10) } = params;

  if (!requesterEmployee) {
    return { canApprove: false, isEncargado: false, reason: 'Trabajador solicitante no encontrado' };
  }

  // REGLA CRÍTICA: Anti-Autoaprobación
  if (bossDni && requesterEmployee.dni && bossDni.trim() === requesterEmployee.dni.trim()) {
    return {
      canApprove: false,
      isEncargado: false,
      reason: 'No puede otorgarse visto bueno a sí mismo.',
    };
  }

  // 1. REVISAR SI EL USUARIO ES EL JEFE ENCARGADO VIGENTE PARA EL ÁMBITO DEL SOLICITANTE
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

  // 2. REVISAR SI EXISTE ENCARGATURA VIGENTE QUE REEMPLAZA AL JEFE TITULAR EN ESTA UNIDAD
  const activeUnitEncargatura = getActiveEncargaturaForUnit({
    direccionOrganoId: requesterEmployee.direccion_organo_id,
    areaId: requesterEmployee.area_id,
    dependenciaId: requesterEmployee.dependencia_id,
    titularDni: bossDni,
    allEncargaturas,
    currentDate,
  });

  // Si existe encargatura activa en la unidad y el usuario actual NO es el encargado:
  // El titular pierde temporalmente la facultad de aprobación.
  if (activeUnitEncargatura && activeUnitEncargatura.encargado_dni !== bossDni) {
    return {
      canApprove: false,
      isEncargado: false,
      activeEncargatura: activeUnitEncargatura,
      reason: `Facultad de V°B° suspendida temporalmente: Encargatura vigente asignada a ${activeUnitEncargatura.encargado_name} mediante ${activeUnitEncargatura.document_type} N.º ${activeUnitEncargatura.document_number} (Vigencia: ${activeUnitEncargatura.start_date} al ${activeUnitEncargatura.end_date}).`,
    };
  }

  // 3. REVISAR SI ES EL JEFE INMEDIATO TITULAR (Sin encargatura activa que lo suspenda)
  if (bossEmployee) {
    const roles = getEmployeeAssignedRoles(bossEmployee);
    const hasJefeRole =
      roles.includes('JEFE') ||
      roles.includes('SUPERVISOR') ||
      roles.includes('DIRECTOR_GENERAL') ||
      roles.includes('JEFE_RRHH') ||
      roles.includes('ADMIN_GENERAL') ||
      roles.includes('HR_ADMIN');
    
    if (hasJefeRole) {
      // Supervisor directo del trabajador
      if (requesterEmployee.supervisor_id === bossEmployee.id || requesterEmployee.supervisor_id === bossEmployee.dni) {
        return { canApprove: true, isEncargado: false, reason: 'Jefe Inmediato Titular Directo' };
      }

      // Director o Titular de la Dirección / Órgano
      if (
        bossEmployee.is_jefe_director &&
        bossEmployee.direccion_organo_id &&
        bossEmployee.direccion_organo_id === requesterEmployee.direccion_organo_id
      ) {
        return { canApprove: true, isEncargado: false, reason: 'Director / Jefe Titular de la Unidad Orgánica' };
      }

      // Titular del Área / Oficina
      if (
        bossEmployee.area_id &&
        bossEmployee.area_id === requesterEmployee.area_id &&
        (bossEmployee.is_jefe_director || roles.includes('JEFE') || roles.includes('SUPERVISOR'))
      ) {
        return { canApprove: true, isEncargado: false, reason: 'Jefe Inmediato de Área / Oficina' };
      }

      // Administrador / RRHH con facultad global
      if (roles.includes('ADMIN_GENERAL') || roles.includes('HR_ADMIN') || roles.includes('JEFE_RRHH')) {
        return { canApprove: true, isEncargado: false, reason: 'Autoridad Administrativa Institucional' };
      }
    }
  }

  return { canApprove: false, isEncargado: false, reason: 'Fuera del ámbito orgánico de responsabilidad asignado' };
}

/**
 * Helper para verificar si un jefe (titular o encargado) puede autorizar papeleta para un solicitante
 */
export function canUserApproveForRequester(params: {
  bossEmployee?: Employee | null;
  requesterEmployee?: Employee | null;
  allEncargaturas: Encargatura[];
  targetDate?: string;
}): {
  canApprove: boolean;
  isEncargado: boolean;
  encargatura?: Encargatura;
  reason: string;
} {
  const result = canApproveAsBoss({
    bossDni: params.bossEmployee?.dni || '',
    bossEmployee: params.bossEmployee,
    requesterEmployee: params.requesterEmployee,
    allEncargaturas: params.allEncargaturas,
    currentDate: params.targetDate,
  });
  return {
    canApprove: result.canApprove,
    isEncargado: result.isEncargado,
    encargatura: result.activeEncargatura,
    reason: result.reason,
  };
}

/**
 * Determina si un trabajador está dentro del ámbito de supervisión de un Jefe Inmediato
 * (ya sea como Jefe Titular de la unidad o por Encargatura Temporal Vigente).
 */
export function isWorkerInBossScope(params: {
  bossEmployee?: Employee | null;
  workerEmployee?: Employee | null;
  allEncargaturas: Encargatura[];
  currentDate?: string;
}): boolean {
  const { bossEmployee, workerEmployee, allEncargaturas, currentDate = new Date().toISOString().substring(0, 10) } = params;
  if (!bossEmployee || !workerEmployee) return false;
  if (bossEmployee.dni === workerEmployee.dni) return false;

  const roles = getEmployeeAssignedRoles(bossEmployee);
  if (roles.includes('ADMIN_GENERAL') || roles.includes('HR_ADMIN') || roles.includes('JEFE_RRHH')) {
    return true;
  }

  // 1. Encargatura Vigente como encargado
  const activeEncargaturas = getActiveEncargaturasForUser(bossEmployee.dni, allEncargaturas, currentDate);
  for (const enc of activeEncargaturas) {
    if (enc.direccion_organo_id && workerEmployee.direccion_organo_id === enc.direccion_organo_id) return true;
    if (enc.area_id && workerEmployee.area_id === enc.area_id) return true;
    if (enc.dependencia_id && workerEmployee.dependencia_id === enc.dependencia_id) return true;
  }

  // 2. Si el jefe titular tiene una encargatura activa que delegó sus funciones a otro, NO ve para aprobar
  // pero puede consultar su equipo
  if (workerEmployee.supervisor_id === bossEmployee.id || workerEmployee.supervisor_id === bossEmployee.dni) {
    return true;
  }

  if (bossEmployee.is_jefe_director && bossEmployee.direccion_organo_id && bossEmployee.direccion_organo_id === workerEmployee.direccion_organo_id) {
    return true;
  }

  if (bossEmployee.area_id && bossEmployee.area_id === workerEmployee.area_id) {
    return true;
  }

  return false;
}

