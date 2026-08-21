import {
  Employee,
  Encargatura,
  Vacacion,
  VacacionStatus,
  VacacionOrigen,
  VacacionAudit,
  RoleType,
} from '../types';
import { computeEncargaturaStatus, getActiveEncargaturasForUser, getEmployeeAssignedRoles } from './encargaturaUtils';

/**
 * Calcula los días calendario computables entre dos fechas (ambas inclusive)
 */
export function calculateVacationDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  if (end < start) return 1;
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

export interface ImmediateBossResult {
  bossEmployee?: Employee | null;
  bossName: string;
  bossDni: string;
  bossId: string;
  isEncargado: boolean;
  bossFunction: 'Jefe Titular' | 'Jefe Encargado';
  delegationInfo?: {
    is_encargado: boolean;
    encargatura_id?: string;
    unidad_encargada?: string;
    documento?: string;
    vigencia?: string;
  };
  reason: string;
}

/**
 * Identifica el Jefe Inmediato competente para otorgar el V°B° a un trabajador
 * Prioridad 1: Encargatura Temporal Vigente de la unidad del trabajador en la fecha objetivo.
 * Prioridad 2: Jefe Inmediato Titular configurado o titular de la unidad orgánica.
 */
export function getImmediateBossForEmployee(params: {
  requester: Employee;
  allEmployees: Employee[];
  allEncargaturas: Encargatura[];
  targetDate?: string;
}): ImmediateBossResult {
  const { requester, allEmployees, allEncargaturas, targetDate = new Date().toISOString().split('T')[0] } = params;

  // 1. Prioridad: Buscar si existe una Encargatura Temporal Vigente para el ámbito orgánico del trabajador
  for (const enc of allEncargaturas) {
    if (enc.status === 'ANULADA') continue;
    const computedStatus = computeEncargaturaStatus(enc, targetDate);
    if (computedStatus !== 'VIGENTE') continue;

    let matches = false;
    if (enc.area_id && requester.area_id === enc.area_id) matches = true;
    if (enc.direccion_organo_id && requester.direccion_organo_id === enc.direccion_organo_id) matches = true;
    if (enc.dependencia_id && requester.dependencia_id === enc.dependencia_id) matches = true;

    if (matches) {
      const encargadoEmp = allEmployees.find((e) => e.dni === enc.encargado_dni || e.id === enc.encargado_employee_id);
      return {
        bossEmployee: encargadoEmp || null,
        bossName: enc.encargado_name,
        bossDni: enc.encargado_dni,
        bossId: enc.encargado_employee_id,
        isEncargado: true,
        bossFunction: 'Jefe Encargado',
        delegationInfo: {
          is_encargado: true,
          encargatura_id: enc.id,
          unidad_encargada: enc.cargo_encargado,
          documento: `${enc.document_type} N.º ${enc.document_number}`,
          vigencia: `${enc.start_date} al ${enc.end_date}`,
        },
        reason: `Jefe Encargado mediante ${enc.document_type} N.º ${enc.document_number} (${enc.cargo_encargado})`,
      };
    }
  }

  // 2. Prioridad: Jefe Titular directo o titular de la dirección
  if (requester.supervisor_id) {
    const supervisorEmp = allEmployees.find((e) => e.id === requester.supervisor_id || e.dni === requester.supervisor_id);
    if (supervisorEmp) {
      return {
        bossEmployee: supervisorEmp,
        bossName: `${supervisorEmp.first_name} ${supervisorEmp.last_name}`,
        bossDni: supervisorEmp.dni,
        bossId: supervisorEmp.id,
        isEncargado: false,
        bossFunction: 'Jefe Titular',
        reason: 'Jefe Inmediato Titular Directo',
      };
    }
  }

  // Buscar Director/Jefe de la dirección u órgano
  if (requester.direccion_organo_id) {
    const director = allEmployees.find(
      (e) =>
        e.direccion_organo_id === requester.direccion_organo_id &&
        (e.is_jefe_director || e.role === 'DIRECTOR_GENERAL' || e.role === 'JEFE_RRHH' || e.role === 'JEFE') &&
        e.id !== requester.id
    );
    if (director) {
      return {
        bossEmployee: director,
        bossName: `${director.first_name} ${director.last_name}`,
        bossDni: director.dni,
        bossId: director.id,
        isEncargado: false,
        bossFunction: 'Jefe Titular',
        reason: 'Director / Jefe Titular de la Unidad Orgánica',
      };
    }
  }

  // Fallback si no tiene supervisor explícito
  return {
    bossEmployee: null,
    bossName: requester.supervisor_name || 'Jefe Inmediato Directo',
    bossDni: '10000003',
    bossId: requester.supervisor_id || 'emp-03',
    isEncargado: false,
    bossFunction: 'Jefe Titular',
    reason: 'Jefatura Jerárquica Directa',
  };
}

export const getImmediateBossForVacation = getImmediateBossForEmployee;
export const getImmediateBossForPapeleta = getImmediateBossForEmployee;

/**
 * Valida si un usuario específico tiene potestad de otorgar V°B° a una solicitud de vacaciones.
 * Regla de Oro: ¡ESTÁ ESTRICTAMENTE PROHIBIDA LA AUTOAPROBACIÓN! (solicitante == aprobador)
 */
export function canUserApproveVacation(params: {
  currentUserDni: string;
  currentUserRole?: RoleType;
  currentUserId?: string;
  requesterDni: string;
  requesterId: string;
  requesterEmp?: Employee | null;
  allEncargaturas: Encargatura[];
  allEmployees: Employee[];
  targetDate?: string;
}): {
  canApprove: boolean;
  isSelfApproval: boolean;
  isEncargado: boolean;
  delegationInfo?: any;
  reason: string;
} {
  const {
    currentUserDni,
    currentUserRole,
    currentUserId,
    requesterDni,
    requesterId,
    requesterEmp,
    allEncargaturas,
    allEmployees,
    targetDate = new Date().toISOString().split('T')[0],
  } = params;

  // REGLA DE SEGURIDAD CRÍTICA: NO AUTOAPROBACIÓN
  if (
    (currentUserDni && requesterDni && currentUserDni.trim() === requesterDni.trim()) ||
    (currentUserId && requesterId && currentUserId === requesterId)
  ) {
    return {
      canApprove: false,
      isSelfApproval: true,
      isEncargado: false,
      reason: 'No puede aprobar una solicitud de vacaciones que usted mismo ha generado.',
    };
  }

  // Admins y Jefes de RRHH tienen facultad general si se requiere
  if (currentUserRole === 'ADMIN_GENERAL' || currentUserRole === 'JEFE_RRHH' || currentUserRole === 'HR_ADMIN') {
    return {
      canApprove: true,
      isSelfApproval: false,
      isEncargado: false,
      reason: 'Facultad Administrativa Institucional',
    };
  }

  const approverEmp = allEmployees.find((e) => e.dni === currentUserDni || e.id === currentUserId);
  const targetRequester = requesterEmp || allEmployees.find((e) => e.dni === requesterDni || e.id === requesterId);

  if (!targetRequester) {
    return {
      canApprove: false,
      isSelfApproval: false,
      isEncargado: false,
      reason: 'Trabajador solicitante no identificado en el sistema.',
    };
  }

  // 1. Revisar Encargaturas Temporales Vigentes del aprobador
  const activeEncargaturas = getActiveEncargaturasForUser(currentUserDni, allEncargaturas, targetDate);
  for (const enc of activeEncargaturas) {
    let matches = false;
    if (enc.area_id && targetRequester.area_id === enc.area_id) matches = true;
    if (enc.direccion_organo_id && targetRequester.direccion_organo_id === enc.direccion_organo_id) matches = true;
    if (enc.dependencia_id && targetRequester.dependencia_id === enc.dependencia_id) matches = true;

    if (matches) {
      return {
        canApprove: true,
        isSelfApproval: false,
        isEncargado: true,
        delegationInfo: {
          is_encargado: true,
          encargatura_id: enc.id,
          unidad_encargada: enc.cargo_encargado,
          documento: `${enc.document_type} N.º ${enc.document_number}`,
          vigencia: `${enc.start_date} al ${enc.end_date}`,
        },
        reason: `Jefe Encargado mediante ${enc.document_type} N.º ${enc.document_number}`,
      };
    }
  }

  // 2. Revisar si es Jefe Titular / Supervisor del solicitante
  if (approverEmp) {
    const roles = getEmployeeAssignedRoles(approverEmp);
    const hasJefeRole = roles.includes('JEFE') || roles.includes('SUPERVISOR') || roles.includes('DIRECTOR_GENERAL');

    if (hasJefeRole) {
      // Supervisor directo asignado
      if (targetRequester.supervisor_id === approverEmp.id || targetRequester.supervisor_id === approverEmp.dni) {
        return {
          canApprove: true,
          isSelfApproval: false,
          isEncargado: false,
          reason: 'Jefe Inmediato Titular Directo',
        };
      }

      // Director de la Dirección u Órgano
      if (
        approverEmp.is_jefe_director &&
        approverEmp.direccion_organo_id &&
        approverEmp.direccion_organo_id === targetRequester.direccion_organo_id
      ) {
        return {
          canApprove: true,
          isSelfApproval: false,
          isEncargado: false,
          reason: 'Director Titular de la Unidad Orgánica',
        };
      }

      // Jefe de Área
      if (approverEmp.area_id && approverEmp.area_id === targetRequester.area_id) {
        return {
          canApprove: true,
          isSelfApproval: false,
          isEncargado: false,
          reason: 'Jefe Inmediato de Área',
        };
      }
    }
  }

  return {
    canApprove: false,
    isSelfApproval: false,
    isEncargado: false,
    reason: 'El trabajador no se encuentra bajo su ámbito orgánico o supervisión directa.',
  };
}

/**
 * Valida la integridad del periodo vacacional (fechas, superposiciones con otras vacaciones)
 */
export function validateVacationIntegrity(params: {
  employeeDni: string;
  startDate: string;
  endDate: string;
  existingVacaciones: Vacacion[];
  excludeVacationId?: string;
}): { valid: boolean; errorMessage?: string } {
  const { employeeDni, startDate, endDate, existingVacaciones, excludeVacationId } = params;

  if (!startDate || !endDate) {
    return { valid: false, errorMessage: 'Las fechas de inicio y fin son obligatorias.' };
  }

  if (startDate > endDate) {
    return { valid: false, errorMessage: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  }

  // Verificar superposiciones con vacaciones ya solicitadas, aprobadas o programadas
  const activeStatuses: VacacionStatus[] = ['SOLICITADA', 'VISTO_BUENO_JEFE', 'APROBADA_RRHH', 'PROGRAMADA', 'EN_CURSO'];
  const overlapping = existingVacaciones.find((v) => {
    if (v.id === excludeVacationId) return false;
    if (v.employee_dni !== employeeDni) return false;
    if (!activeStatuses.includes(v.status)) return false;

    // Hay superposición si los rangos de fechas se intersecan: (startA <= endB) && (endA >= startB)
    return startDate <= v.end_date && endDate >= v.start_date;
  });

  if (overlapping) {
    return {
      valid: false,
      errorMessage: `El período seleccionado (${startDate} al ${endDate}) se superpone con otra vacación existente (${overlapping.start_date} al ${overlapping.end_date} - Estado: ${overlapping.status}).`,
    };
  }

  return { valid: true };
}

/**
 * Calcula el estado dinámico de la vacación en función de la fecha actual del sistema
 */
export function getDynamicVacationStatus(
  vac: Vacacion,
  currentDate: string = new Date().toISOString().split('T')[0]
): VacacionStatus {
  if (['RECHAZADA', 'OBSERVADA', 'CANCELADA', 'SOLICITADA', 'VISTO_BUENO_JEFE'].includes(vac.status)) {
    return vac.status;
  }

  if (vac.status === 'PROGRAMADA' || vac.status === 'APROBADA_RRHH' || vac.status === 'EN_CURSO') {
    if (currentDate < vac.start_date) {
      return 'PROGRAMADA';
    }
    if (currentDate >= vac.start_date && currentDate <= vac.end_date) {
      return 'EN_CURSO';
    }
    if (currentDate > vac.end_date) {
      return 'FINALIZADA';
    }
  }

  return vac.status;
}

export interface WorkerAdvancedFilterCriteria {
  // Identificación
  searchTerm?: string;
  dni?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  // Organización
  dependenciaId?: string;
  direccionOrganoId?: string;
  areaId?: string;
  subareaId?: string;
  cargoId?: string;
  position?: string;
  // Información Laboral
  regimenLaboral?: string;
  condicionLaboral?: string;
  activeStatus?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  scheduleId?: string;
  // Situación Vacacional
  situacionVacacional?: 'ALL' | 'CON_VACACIONES' | 'SIN_VACACIONES' | 'PENDIENTES' | 'VIGENTES';
  periodYear?: number;
}

/**
 * Filtro combinado de búsqueda avanzada para selección de trabajadores en Control de Asistencia / RRHH
 */
export function filterWorkersForVacation(
  employees: Employee[],
  criteria: WorkerAdvancedFilterCriteria,
  vacaciones: Vacacion[],
  currentDate: string = new Date().toISOString().split('T')[0]
): Employee[] {
  return employees.filter((emp) => {
    // 1. Identificación: Búsqueda rápida general
    if (criteria.searchTerm && criteria.searchTerm.trim()) {
      const term = criteria.searchTerm.toLowerCase().trim();
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const matchDni = emp.dni.includes(term);
      const matchCode = (emp.codigo_trabajador || '').toLowerCase().includes(term);
      const matchName = fullName.includes(term);
      const matchPos = (emp.position || '').toLowerCase().includes(term);
      const matchArea = (emp.area_name || '').toLowerCase().includes(term);
      if (!matchDni && !matchCode && !matchName && !matchPos && !matchArea) return false;
    }

    if (criteria.dni && !emp.dni.includes(criteria.dni.trim())) return false;
    if (criteria.nombres && !emp.first_name.toLowerCase().includes(criteria.nombres.toLowerCase().trim())) return false;
    if (
      criteria.apellidoPaterno &&
      !(emp.apellido_paterno || emp.last_name)
        .toLowerCase()
        .includes(criteria.apellidoPaterno.toLowerCase().trim())
    )
      return false;
    if (
      criteria.apellidoMaterno &&
      !(emp.apellido_materno || emp.last_name)
        .toLowerCase()
        .includes(criteria.apellidoMaterno.toLowerCase().trim())
    )
      return false;

    // 2. Organización
    if (criteria.dependenciaId && criteria.dependenciaId !== 'ALL' && emp.dependencia_id !== criteria.dependenciaId)
      return false;
    if (
      criteria.direccionOrganoId &&
      criteria.direccionOrganoId !== 'ALL' &&
      emp.direccion_organo_id !== criteria.direccionOrganoId
    )
      return false;
    if (criteria.areaId && criteria.areaId !== 'ALL' && emp.area_id !== criteria.areaId) return false;
    if (criteria.subareaId && criteria.subareaId !== 'ALL' && emp.subarea_id !== criteria.subareaId) return false;
    if (criteria.cargoId && criteria.cargoId !== 'ALL' && emp.cargo_id !== criteria.cargoId) return false;
    if (criteria.position && !emp.position.toLowerCase().includes(criteria.position.toLowerCase().trim()))
      return false;

    // 3. Información Laboral
    if (criteria.regimenLaboral && criteria.regimenLaboral !== 'ALL' && emp.regimen_laboral !== criteria.regimenLaboral)
      return false;
    if (
      criteria.condicionLaboral &&
      criteria.condicionLaboral !== 'ALL' &&
      emp.condicion_laboral !== criteria.condicionLaboral
    )
      return false;
    if (criteria.activeStatus === 'ACTIVE' && !emp.active) return false;
    if (criteria.activeStatus === 'INACTIVE' && emp.active) return false;
    if (criteria.scheduleId && criteria.scheduleId !== 'ALL' && emp.schedule_id !== criteria.scheduleId) return false;

    // 4. Situación Vacacional
    if (criteria.situacionVacacional && criteria.situacionVacacional !== 'ALL') {
      const empVacs = vacaciones.filter((v) => v.employee_dni === emp.dni);
      if (criteria.situacionVacacional === 'CON_VACACIONES' && empVacs.length === 0) return false;
      if (criteria.situacionVacacional === 'SIN_VACACIONES' && empVacs.length > 0) return false;
      if (
        criteria.situacionVacacional === 'PENDIENTES' &&
        !empVacs.some((v) => v.status === 'SOLICITADA' || v.status === 'VISTO_BUENO_JEFE')
      )
        return false;
      if (
        criteria.situacionVacacional === 'VIGENTES' &&
        !empVacs.some(
          (v) =>
            ['PROGRAMADA', 'APROBADA_RRHH', 'EN_CURSO'].includes(v.status) &&
            currentDate >= v.start_date &&
            currentDate <= v.end_date
        )
      )
        return false;
    }

    return true;
  });
}
