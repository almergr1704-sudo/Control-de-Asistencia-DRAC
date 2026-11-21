import { normalizePersonName, normalizeInstitutionalName } from '../src/utils/nameUtils';
import { resolveEmployeeForDevicePin } from '../src/utils/deviceUserSync';
import type { BiometricDeviceUser } from '../src/types';

export interface ClosedPeriodEntry {
  period: string; // "YYYY-MM"
  closed_at: string;
  closed_by: string;
  reason?: string;
}

export function isPeriodClosed(fecha: string | undefined, closedPeriods: ClosedPeriodEntry[]): boolean {
  if (!fecha || !Array.isArray(closedPeriods) || closedPeriods.length === 0) return false;
  const period = String(fecha).trim().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) return false;
  return closedPeriods.some((cp) => String(cp.period).trim() === period);
}

/**
 * Enriquece una marcación cruda con los datos OFICIALES del Directorio Institucional
 * SIN modificar jamás la fecha/hora original del reloj ni los campos físicos de origen.
 */
export function enrichPunchWithOfficialEmployee(
  punch: any,
  employees: any[],
  devices: any[],
  deviceUsers: BiometricDeviceUser[]
): any {
  const rawCode = String(punch.employee_code || punch.employee_dni || punch.pin || '').trim();
  const deviceSn = String(punch.device_sn || '').trim().toUpperCase();

  const linkedById = punch.employee_id
    ? employees.find((e) => e.id === punch.employee_id)
    : undefined;

  const resolved = linkedById
    ? { employee: linkedById, ambiguous: false, binding: deviceUsers.find((du) => du.device_sn === deviceSn && du.pin === rawCode && du.employee_id === linkedById.id) }
    : resolveEmployeeForDevicePin(employees, deviceUsers, deviceSn, rawCode);

  const emp = resolved.employee;
  const dev = devices.find((d) => d.serial_number === punch.device_sn || d.id === punch.device_id);
  const binding =
    ('binding' in resolved ? resolved.binding : undefined) ||
    deviceUsers.find((du) => du.device_sn === deviceSn && du.pin === rawCode);

  const isIdentified = Boolean(emp);
  const officialName = emp
    ? normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim())
    : 'Pendiente de Identificación';

  return {
    ...punch,
    // Campos oficiales resueltos desde el Directorio Institucional (nunca sobreescriben al reloj)
    employee_id: emp ? emp.id : null,
    employee_dni: emp ? emp.dni : rawCode,
    employee_codigo_drac: emp ? emp.codigo_trabajador || null : null,
    employee_code: rawCode,
    employee_name: officialName,
    dependencia_name: emp ? normalizeInstitutionalName(emp.dependencia_name || '') : null,
    direccion_organo_name: emp ? normalizeInstitutionalName(emp.direccion_organo_name || '') : null,
    area_name: emp ? normalizeInstitutionalName(emp.area_name || '') : null,
    cargo_name: emp ? normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || '') : null,
    clock_name_origin: punch.clock_name_origin || binding?.clock_name || null,
    device_name: dev ? dev.name : (punch.device_name || 'ZKTeco G3 Sede Central'),
    validation_status: isIdentified
      ? (punch.validation_status === 'PENDIENTE_IDENTIFICACION' ? 'VALIDA' : (punch.validation_status || 'VALIDA'))
      : 'PENDIENTE_IDENTIFICACION',
    synced_at: punch.synced_at || punch.created_at || null,
    source: punch.source || 'DIRECT_READ',
  };
}

/**
 * Enriquece un registro de asistencia consolidada con los datos institucionales oficiales
 * actuales del trabajador sin alterar métricas históricas ni fechas.
 */
export function enrichAttendanceWithOfficialEmployee(att: any, employees: any[]): any {
  const emp = employees.find(
    (e) =>
      (att.employee_id && e.id === att.employee_id) ||
      (att.employee_dni && e.dni === att.employee_dni)
  );
  if (!emp) return att;

  return {
    ...att,
    employee_id: emp.id,
    employee_dni: emp.dni,
    employee_codigo_drac: emp.codigo_trabajador || att.employee_codigo_drac || null,
    employee_name: normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim()),
    dependencia_id: emp.dependencia_id || att.dependencia_id,
    dependencia_name: normalizeInstitutionalName(emp.dependencia_name || att.dependencia_name || ''),
    direccion_organo_name: normalizeInstitutionalName(emp.direccion_organo_name || att.direccion_organo_name || ''),
    area_id: emp.area_id || att.area_id,
    area_name: normalizeInstitutionalName(emp.area_name || att.area_name || ''),
    cargo_name: normalizeInstitutionalName(emp.position || emp.cargo || emp.cargo_name || att.cargo_name || ''),
  };
}

/**
 * Consolida el Perfil Institucional Único del Trabajador directamente desde
 * todas las entidades relacionadas existentes (sin copias duplicadas).
 */
export function buildConsolidatedEmployeeProfile(options: {
  employee: any;
  dependencias: any[];
  direcciones: any[];
  areas: any[];
  cargos: any[];
  horarios: any[];
  turnos: any[];
  asignacionesHorario: any[];
  devices: any[];
  deviceUsers: BiometricDeviceUser[];
  rawPunches: any[];
  attendance: any[];
  papeletas: any[];
  vacaciones: any[];
  viewerRole?: string;
}) {
  const emp = options.employee;
  const empName = normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim());

  const dep = options.dependencias.find((d) => d.id === emp.dependencia_id);
  const dir = options.direcciones.find((d) => d.id === emp.direccion_organo_id);
  const area = options.areas.find((a) => a.id === emp.area_id);
  const cargo = options.cargos.find((c) => c.id === emp.cargo_id);

  // Resolver horario vigente asignado (asignacion_horarios -> empleado.schedule_id -> horario base)
  const activeAsig = options.asignacionesHorario.find(
    (a) => (a.employee_id === emp.id || a.employee_dni === emp.dni) && a.activo !== false
  );
  const horarioId = activeAsig?.horario_id || emp.schedule_id || 'hor-01';
  const horario = options.horarios.find((h) => h.id === horarioId) || options.horarios[0] || null;
  const turno1 = horario ? options.turnos.find((t) => t.id === horario.turno1_id) : null;
  const turno2 = horario?.turno2_id ? options.turnos.find((t) => t.id === horario.turno2_id) : null;

  // Vinculaciones biométricas reales por dispositivo
  const linkedBindings = options.deviceUsers
    .filter((du) => du.employee_id === emp.id && (du.link_status === 'VINCULADO' || du.link_status === 'REGISTRADO'))
    .map((du) => {
      const dev = options.devices.find((d) => d.serial_number === du.device_sn || d.id === du.device_id);
      return {
        id: du.id,
        device_id: du.device_id,
        device_sn: du.device_sn,
        device_name: dev?.name || du.device_name || du.device_sn,
        pin: du.pin,
        clock_name_origin: du.clock_name || null,
        link_status: du.link_status,
        link_type: du.link_type || 'VINCULADO',
        linked_at: du.linked_at || null,
        linked_by: du.linked_by || null,
        present_on_device: du.present_on_device,
      };
    });

  // Marcaciones crudas del trabajador
  const bindingKeySet = new Set(linkedBindings.map((b) => `${b.device_sn}::${b.pin}`));
  const workerPunches = options.rawPunches
    .filter((p) => {
      if (p.employee_id && p.employee_id === emp.id) return true;
      if (p.employee_dni && p.employee_dni === emp.dni) return true;
      const pSn = String(p.device_sn || '').trim().toUpperCase();
      const pPin = String(p.employee_code || p.employee_dni || '').trim();
      return bindingKeySet.has(`${pSn}::${pPin}`);
    })
    .map((p) => enrichPunchWithOfficialEmployee(p, [emp], options.devices, options.deviceUsers))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

  // Asistencia diaria consolidada
  const workerAttendance = options.attendance
    .filter((a) => a.employee_id === emp.id || a.employee_dni === emp.dni)
    .map((a) => enrichAttendanceWithOfficialEmployee(a, [emp]))
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  // Papeletas y Vacaciones
  const workerPapeletas = options.papeletas
    .filter((p) => p.employee_id === emp.id || p.employee_dni === emp.dni)
    .sort((a, b) => String(b.fecha || b.created_at || '').localeCompare(String(a.fecha || a.created_at || '')));

  const workerVacaciones = options.vacaciones
    .filter((v) => v.employee_id === emp.id || v.employee_dni === emp.dni)
    .sort((a, b) => String(b.fecha_inicio || b.created_at || '').localeCompare(String(a.fecha_inicio || a.created_at || '')));

  const totalHoursWorked = workerAttendance.reduce(
    (sum, a) => sum + Number(a.total_effective_hours ?? ((a.t1_effective_hours || 0) + (a.t2_effective_hours || 0))),
    0
  );
  const tardinessDays = workerAttendance.filter((a) => a.status === 'LATE' || Number(a.net_tardiness_minutes || 0) > 0).length;
  const totalTardinessMinutes = workerAttendance.reduce(
    (sum, a) => sum + Number(a.net_tardiness_minutes ?? a.total_tardiness_minutes ?? 0),
    0
  );
  const absencesCount = workerAttendance.filter((a) => a.status === 'ABSENT').length;

  const isPrivileged = [
    'ADMIN_GENERAL',
    'HR_ADMIN',
    'JEFE_RRHH',
    'CONTROL_ASISTENCIA',
    'DIRECTOR_GENERAL',
    'SUPERVISOR',
    'JEFE',
  ].includes(String(options.viewerRole || 'ADMIN_GENERAL'));

  return {
    personal: {
      id: emp.id,
      dni: emp.dni,
      codigo_drac: emp.codigo_trabajador,
      first_name: normalizePersonName(emp.first_name),
      last_name: normalizePersonName(emp.last_name),
      full_name: empName,
      email: emp.email || '',
      phone: isPrivileged ? (emp.phone || '') : undefined,
      active: emp.active !== false,
      hire_date: emp.hire_date || null,
    },
    institucional: {
      sede_dependencia: normalizeInstitutionalName(dep?.name || emp.dependencia_name || 'Sede Central'),
      dependencia_tipo: dep?.type || (String(emp.dependencia_name || '').toUpperCase().includes('AGENCIA') ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL'),
      agencia_agraria:
        dep?.type === 'AGENCIA_AGRARIA' || String(emp.dependencia_name || '').toUpperCase().includes('AGENCIA')
          ? normalizeInstitutionalName(dep?.name || emp.dependencia_name)
          : null,
      direccion_organo: normalizeInstitutionalName(dir?.name || emp.direccion_organo_name || 'Sin Dirección Asignada'),
      area_oficina: normalizeInstitutionalName(area?.name || emp.area_name || 'Sin Área Asignada'),
      subarea: emp.subarea_name ? normalizeInstitutionalName(emp.subarea_name) : null,
      cargo: normalizeInstitutionalName(cargo?.name || emp.position || emp.cargo || 'Servidor Público'),
      regimen_laboral: emp.regimen_laboral || 'D.L. 276',
      condicion_laboral: emp.condicion_laboral || 'NOMBRADO',
      supervisor_name: emp.supervisor_name || null,
      horario_asignado: horario
        ? {
            id: horario.id,
            code: horario.code,
            name: horario.name,
            turno1: turno1 ? `${turno1.start_time} - ${turno1.end_time}` : null,
            turno2: turno2 ? `${turno2.start_time} - ${turno2.end_time}` : null,
            working_days: horario.working_days || [],
            tipo_asignacion: activeAsig?.tipo_asignacion || 'PERMANENTE',
          }
        : {
            id: emp.schedule_id || 'hor-01',
            name: emp.schedule_name || 'Jornada Administrativa DRAC',
          },
    },
    biometrico: {
      pin_principal: emp.zkteco_pin || emp.biometric_user_id || emp.dni,
      estado_vinculacion:
        linkedBindings.length > 0
          ? linkedBindings[0].link_status
          : emp.biometric_sync_status || 'PENDIENTE_VINCULACION',
      fecha_vinculacion: linkedBindings[0]?.linked_at || emp.biometric_last_sync || null,
      dispositivos_vinculados: linkedBindings,
    },
    asistencia: {
      resumen: {
        total_marcaciones: workerPunches.length,
        entradas: workerPunches.filter((p) => p.punch_type !== 'CHECK_OUT' && Number(p.punch_state) !== 1).length,
        salidas: workerPunches.filter((p) => p.punch_type === 'CHECK_OUT' || Number(p.punch_state) === 1).length,
        dias_asistencia: workerAttendance.length,
        tardanzas_dias: tardinessDays,
        tardanzas_minutos_netos: totalTardinessMinutes,
        inasistencias: absencesCount,
        horas_trabajadas: Number(totalHoursWorked.toFixed(2)),
        papeletas_total: workerPapeletas.length,
        vacaciones_total: workerVacaciones.length,
      },
      marcaciones_recientes: workerPunches.slice(0, 50),
      asistencia_reciente: workerAttendance.slice(0, 30),
      papeletas: workerPapeletas.slice(0, 20),
      vacaciones: workerVacaciones.slice(0, 20),
    },
  };
}
