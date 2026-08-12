export interface ApiEndpointDoc {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  rbacScope: string;
  parameters?: { name: string; type: string; required: boolean; description: string }[];
  requestBody?: object;
  response200: object;
  category: 'Asistencia' | 'Papeletas' | 'ZKTeco Ingesta' | 'Vacaciones' | 'Estructura';
}

export const API_ENDPOINTS_SPEC: ApiEndpointDoc[] = [
  {
    method: 'GET',
    path: '/api/v1/attendance',
    summary: 'Consulta Paginada de Asistencia y Tardanzas',
    description: 'Obtiene el reporte procesado de asistencia calculando tolerancia, tardanzas por turno (jornada de 1 o 2 turnos), horas extra y validación de vacaciones/papeletas. Aplica filtrado automático por rol RBAC.',
    rbacScope: 'EMPLOYEE: solo sus registros | SUPERVISOR: su equipo | HR_ADMIN: global',
    category: 'Asistencia',
    parameters: [
      { name: 'page', type: 'integer', required: false, description: 'Número de página (default: 1)' },
      { name: 'limit', type: 'integer', required: false, description: 'Registros por página (default: 20)' },
      { name: 'startDate', type: 'string (YYYY-MM-DD)', required: true, description: 'Fecha inicio de búsqueda' },
      { name: 'endDate', type: 'string (YYYY-MM-DD)', required: true, description: 'Fecha fin de búsqueda' },
      { name: 'areaId', type: 'string (UUID)', required: false, description: 'Filtro por ID de área o subárea' },
      { name: 'employeeDni', type: 'string', required: false, description: 'Filtro por DNI de empleado' },
      { name: 'status', type: 'string (ENUM)', required: false, description: 'PUNCTUAL | LATE | ABSENT | OUTING_PERMISSION | VACATION' },
    ],
    response200: {
      success: true,
      meta: { page: 1, limit: 20, totalRecords: 15, totalPages: 1 },
      data: [
        {
          id: "ast-001",
          employee_id: "emp-std-1",
          employee_dni: "71234567",
          employee_name: "Juan Pérez Gómez",
          area_name: "Operaciones > Mantenimiento",
          fecha: "2026-08-12",
          horario_name: "Jornada Partida (2 Turnos)",
          t1_scheduled_in: "08:00",
          t1_real_in: "08:02",
          t1_tardiness_minutes: 0,
          t2_scheduled_in: "14:00",
          t2_real_in: "14:00",
          t2_tardiness_minutes: 0,
          total_tardiness_minutes: 2,
          tolerance_applied_minutes: 10,
          net_tardiness_minutes: 0,
          status: "OUTING_PERMISSION",
          has_papeleta: true,
          papeleta_code: "PAP-2026-0001",
          is_vacation_day: false
        }
      ]
    }
  },
  {
    method: 'GET',
    path: '/api/v1/papeletas',
    summary: 'Consulta Paginada e Histórico de Papeletas de Salida',
    description: 'Recupera solicitudes de papeletas de salida con estado del workflow, trazabilidad de horas estimadas vs reales de garita y motivo.',
    rbacScope: 'EMPLOYEE: sus papeletas | SUPERVISOR: pendientes de VoBo | HR_ADMIN: histórico global | SECURITY_GUARD: aprobadas del día',
    category: 'Papeletas',
    parameters: [
      { name: 'status', type: 'string (ENUM)', required: false, description: 'PENDING_BOSS | PENDING_HR | APPROVED | IN_OUTING | COMPLETED | REJECTED' },
      { name: 'fecha', type: 'string (YYYY-MM-DD)', required: false, description: 'Filtro por fecha de papeleta' },
      { name: 'employeeDni', type: 'string', required: false, description: 'DNI del empleado solicitante' },
      { name: 'motivo', type: 'string (ENUM)', required: false, description: 'PERSONAL | SALUD_MEDICA | COMISION_SERVICIOS | DILIGENCIA_OFICIAL' }
    ],
    response200: {
      success: true,
      data: [
        {
          id: "pap-001",
          code: "PAP-2026-0001",
          employee_dni: "71234567",
          employee_name: "Juan Pérez Gómez",
          motivo: "SALUD_MEDICA",
          fecha: "2026-08-12",
          hora_estimada_salida: "10:30",
          hora_estimada_retorno: "12:00",
          hora_real_salida: "10:32",
          hora_real_retorno: "11:55",
          status: "COMPLETED",
          boss_approved_at: "2026-08-11T16:00:00Z",
          hr_approved_at: "2026-08-11T17:30:00Z"
        }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/v1/papeletas',
    summary: 'Registrar Nueva Solicitud de Papeleta de Salida',
    description: 'Permite a un Empleado crear una solicitud de permiso dentro de la jornada laboral. Genera estado PENDING_BOSS y registro de auditoría inmutable.',
    rbacScope: 'EMPLOYEE, SUPERVISOR, HR_ADMIN (Para sí mismo)',
    category: 'Papeletas',
    requestBody: {
      motivo: "SALUD_MEDICA",
      descripcion: "Cita medica programada en centro hospitalario",
      fecha: "2026-08-14",
      hora_estimada_salida: "10:00",
      hora_estimada_retorno: "12:00"
    },
    response200: {
      success: true,
      message: "Solicitud de papeleta registrada exitosamente.",
      data: {
        id: "pap-004",
        code: "PAP-2026-0004",
        status: "PENDING_BOSS",
        created_at: "2026-08-12T10:15:00Z"
      }
    }
  },
  {
    method: 'PATCH',
    path: '/api/v1/papeletas/{id}/workflow',
    summary: 'Transición de Estado de Papeleta (VoBo Jefe, Aprobación RRHH, Rechazo, Garita)',
    description: 'Aplica una acción en la máquina de estados de la papeleta. Valida rol y guarda la traza en auditoria_papeletas.',
    rbacScope: 'SUPERVISOR (VoBo) | HR_ADMIN (Aprobación Final) | SECURITY_GUARD (Garita: Salida/Retorno)',
    category: 'Papeletas',
    requestBody: {
      action: "APPROVE_BOSS | APPROVE_HR | REJECT | MARK_OUTING_REAL | MARK_COMPLETED_REAL",
      comment: "Aprobado conforme a normas de mantenimiento.",
      hora_real: "10:32"
    },
    response200: {
      success: true,
      message: "Estado de papeleta actualizado a APPROVED.",
      data: {
        papeleta_id: "pap-002",
        previous_status: "PENDING_HR",
        new_status: "APPROVED",
        action_by: "María Silva (RRHH)",
        timestamp: "2026-08-12T10:20:00Z"
      }
    }
  },
  {
    method: 'POST',
    path: '/iclock/cdata.php',
    summary: 'Webhook Ingesta Real-Time ZKTeco Push ADMS Protocol',
    description: 'Endpoint HTTP que escuchan los marcadores ZKTeco en protocolo Push/ADMS. Recibe logs crudos de fichaje (PIN, TIME, VERIFY) y los inserta de manera inmutable en marcaciones_raw (punch_logs).',
    rbacScope: 'PÚBLICO / TOKEN BIOMÉTRICO (ZKTeco Device Protocol)',
    category: 'ZKTeco Ingesta',
    requestBody: {
      SN: "ZK-ADMS-99801",
      table: "ATTLOG",
      Stamp: "1723456800",
      payload: "PIN=71234567\tTIME=2026-08-12 08:02:15\tSTATUS=0\tVERIFY=1"
    },
    response200: {
      status: "OK",
      processed_records: 1,
      message: "Punch raw stored in staging table"
    }
  },
  {
    method: 'POST',
    path: '/api/v1/vacations',
    summary: 'Asignar Período de Vacaciones (Total o Parcial)',
    description: 'Registra vacaciones totales o parciales. Invalida alertas de falta/tardanza durante el rango seleccionado.',
    rbacScope: 'HR_ADMIN',
    category: 'Vacaciones',
    requestBody: {
      employee_id: "emp-std-2",
      tipo: "PARCIAL",
      start_date: "2026-08-20",
      end_date: "2026-08-22",
      period_year: 2026,
      comments: "Fraccionamiento de 3 días solicitado por el colaborador."
    },
    response200: {
      success: true,
      message: "Vacaciones programadas correctamente.",
      data: {
        id: "vac-003",
        total_days: 3,
        status: "APPROVED"
      }
    }
  }
];
