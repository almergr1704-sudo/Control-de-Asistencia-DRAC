/**
 * HRMS / WFM System - Core Types
 * Dirección Regional de Agricultura Cajamarca (DRAC)
 */

export type RoleType =
  | 'ADMIN_GENERAL'
  | 'TRABAJADOR'
  | 'JEFE'
  | 'JEFE_RRHH'
  | 'VIGILANCIA'
  | 'DIRECTOR_GENERAL'
  | 'CONTROL_ASISTENCIA'
  | 'EMPLOYEE'
  | 'SUPERVISOR'
  | 'HR_ADMIN'
  | 'SECURITY_GUARD';

export type DependenciaType = 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA' | 'OFICINA_AGRARIA';

export type OrganoType =
  | 'DIRECCION'
  | 'ORGANO_APOYO'
  | 'ORGANO_LINEA'
  | 'JEFATURA_AGENCIA'
  | 'OFICINA_AGRARIA';

export type RegimenLaboral =
  | 'D.L. 276'
  | 'D.L. 728'
  | 'CAS D.L. 1057'
  | 'LOCACION_SERVICIOS'
  | 'OTRO';

export type CondicionLaboral = 'NOMBRADO' | 'CONTRATADO' | 'DESIGNADO' | 'PRACTICANTE' | 'INDETERMINADO';

export interface Dependencia {
  id: string;
  code: string; // Ej: SEDE-01, AA-CAJ, AA-JAEN, AA-CHOTA
  name: string; // Ej: Sede Central DRAC, Agencia Agraria Jaén
  type: DependenciaType;
  ubigeo?: string;
  address?: string;
  active: boolean;
  created_at: string;
}

export interface DireccionOrgano {
  id: string;
  code: string; // Ej: DIR-ADM, DIR-AGR, JEF-JAEN
  name: string; // Ej: Dirección de Administración, Dirección de Competitividad Agraria
  type: OrganoType;
  dependencia_id: string;
  dependencia_name: string;
  director_id?: string | null;
  director_name?: string;
  active: boolean;
  created_at: string;
}

export interface Area {
  id: string;
  code: string;
  name: string;
  description?: string;
  dependencia_id?: string;
  dependencia_name?: string;
  direccion_organo_id?: string;
  direccion_organo_name?: string;
  parent_area_id?: string | null;
  parent_area_name?: string;
  responsible_employee_id?: string | null;
  responsible_employee_name?: string;
  active: boolean;
  created_at: string;
}

export interface Cargo {
  id: string;
  code: string;
  name: string; // Ej: Director Regional, Especialista Agrario, Técnico Administrativo, Vigilante
  nivel?: string;
  active: boolean;
}

export interface ResponsableDesignation {
  id: string;
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  title: 'DIRECTOR' | 'JEFE' | 'RESPONSABLE' | 'ENCARGADO';
  unit_type: 'DEPENDENCIA' | 'DIRECCION_ORGANO' | 'AREA_OFICINA';
  unit_id: string;
  unit_name: string;
  start_date: string;
  end_date?: string | null;
  active: boolean;
}

export interface EmployeeAssignmentHistory {
  id: string;
  employee_id: string;
  employee_dni: string;
  start_date: string;
  end_date?: string | null; // null if current
  dependencia_id: string;
  dependencia_name: string;
  direccion_organo_id?: string;
  direccion_organo_name?: string;
  area_id: string;
  area_name: string;
  subarea_id?: string;
  subarea_name?: string;
  position: string;
  cargo_id?: string;
  supervisor_id?: string | null;
  supervisor_name?: string;
  reason?: string;
  created_at: string;
}

export interface Employee {
  id: string;
  codigo_trabajador: string; // Ej: DRAC-2026-001 - NON-EDITABLE after creation
  dni: string; // NON-EDITABLE after creation
  first_name: string;
  last_name: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  email: string; // EDITABLE
  phone: string; // EDITABLE
  address?: string; // EDITABLE
  
  // DRAC Current Structure
  dependencia_id: string;
  dependencia_name: string;
  direccion_organo_id?: string;
  direccion_organo_name?: string;
  area_id: string;
  area_name: string;
  subarea_id?: string;
  subarea_name?: string;
  
  supervisor_id?: string | null; // Auto-calculated or override
  supervisor_name?: string;
  hr_contact_id?: string | null;
  hr_contact_name?: string;
  
  role: RoleType;
  position: string;
  cargo_id?: string;
  regimen_laboral: RegimenLaboral;
  condicion_laboral: CondicionLaboral;
  is_jefe_director?: boolean;
  
  hire_date: string; // NON-EDITABLE original hire date
  active: boolean; // DESACTIVABLE
  schedule_id?: string;
  schedule_name?: string;
  zkteco_pin?: string; // NON-EDITABLE after punches exist
}

export interface Turno {
  id: string;
  code: string;
  name: string; // Ej: "Turno 001 — Mañana", "Turno 002 — Tarde"
  description?: string;
  start_time: string; // "08:00"
  end_time: string; // "13:00"
  tolerance_minutes: number; // Tolerancia de entrada (mins)
  tolerance_exit_minutes?: number; // Tolerancia de salida (mins)
  is_overnight: boolean;
  active?: boolean;
  is_historical?: boolean;
  created_at: string;
}

export interface Horario {
  id: string;
  code: string;
  name: string; // Ej: "Jornada Partida Institucional DRAC"
  turn_count: 1 | 2; // 1 o 2 turnos por día
  turno1_id: string;
  turno1_name?: string;
  turno2_id?: string | null;
  turno2_name?: string;
  working_days: string[]; // ["MON", "TUE", "WED", "THU", "FRI"]
  active: boolean;
  effective_start_date?: string; // Vigencia inicio
  effective_end_date?: string | null; // Vigencia fin
  version?: number;
}

export interface MarcacionCorrection {
  id: string;
  raw_marcacion_id?: string;
  employee_dni: string;
  employee_name?: string;
  original_timestamp?: string;
  corrected_timestamp: string;
  incident_type: 'OLVIDO_MARCACION' | 'FALLO_BIOMETRICO' | 'SALIDA_OFICIAL_JUSTIFICADA' | 'OTRO';
  reason: string;
  authorized_by_id: string;
  authorized_by_name: string;
  created_at: string;
}

export interface AsistenciaCorrectionLog {
  id: string;
  asistencia_id: string;
  employee_dni: string;
  fecha_asistencia: string;
  field_changed: string;
  original_value: string;
  new_value: string;
  reason: string;
  authorized_by_name: string;
  timestamp: string;
}

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'CONFIGURED' | 'ERROR' | 'INACTIVE';

export interface DeviceTestRecord {
  date: string;
  result: 'SUCCESS' | 'FAILED';
  message: string;
  cause?: string;
  user: string;
  latency_ms?: number;
  ip: string;
  port: number;
  model?: string;
  serial_number?: string;
}

export interface DispositivoZkTeco {
  id: string;
  serial_number: string;
  name: string;
  brand?: string; // Default ZKTeco
  model?: string; // e.g. uFace 800, K40, MB20, iClock 880
  ip_address: string;
  port: number;
  protocol: 'PUSH_ADMS' | 'UDP' | 'TCP';
  dependencia_id?: string;
  dependencia_name?: string;
  area_id?: string;
  area_name?: string;
  location_detail: string;
  last_activity: string;
  status: DeviceStatus;
  firmware_version?: string;
  last_test?: DeviceTestRecord;
}

export interface MarcacionRaw {
  id: string;
  device_id: string;
  device_name: string;
  employee_dni: string;
  employee_name?: string;
  timestamp: string; // "2026-08-12 08:03:12"
  punch_type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO';
  verify_mode: 'FINGERPRINT' | 'FACE' | 'PALM' | 'CARD' | 'PASSWORD';
  processed: boolean;
  processed_at?: string;
  raw_payload?: string;
}

export type PapeletaStatus =
  | 'DRAFT'
  | 'PENDING_BOSS'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'IN_OUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type PapeletaMotivo =
  | 'PERSONAL'
  | 'SALUD_MEDICA'
  | 'COMISION_SERVICIOS'
  | 'DILIGENCIA_OFICIAL'
  | 'OTRO';

export interface PapeletaAudit {
  id: string;
  papeleta_id: string;
  previous_status: PapeletaStatus;
  new_status: PapeletaStatus;
  action_by_user_id: string;
  action_by_user_name: string;
  action_by_role: RoleType;
  comment?: string;
  timestamp: string;
}

export interface PapeletaSalida {
  id: string;
  code: string; // Ej: PAP-2026-001
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  dependencia_name: string;
  direccion_organo_name?: string;
  area_name: string;
  
  supervisor_id: string;
  supervisor_name: string;
  
  motivo: PapeletaMotivo;
  descripcion: string;
  destino: string;
  fecha: string; // YYYY-MM-DD
  hora_estimada_salida: string; // "10:30"
  hora_estimada_retorno: string; // "12:00"
  hora_real_salida?: string | null; // Guarded by Vigilancia
  hora_real_retorno?: string | null; // Guarded by Vigilancia
  sin_retorno?: boolean; // Salida sin retorno (Comisión final de jornada, etc.)
  status: PapeletaStatus;
  
  digital_signature_data?: string; // Digital signature image / vector
  signed_at?: string;
  
  boss_approved_at?: string;
  boss_comment?: string;
  hr_approved_at?: string;
  hr_comment?: string;
  security_guard_id?: string;
  security_guard_name?: string;
  created_at: string;
  updated_at: string;
}

export type VacacionTipo = 'TOTAL' | 'PARCIAL';

export interface Vacacion {
  id: string;
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  tipo: VacacionTipo;
  start_date: string;
  end_date: string;
  total_days: number;
  period_year: number;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  approved_by_hr?: string;
  comments?: string;
  created_at: string;
}

export type AsistenciaEstado =
  | 'PUNCTUAL'
  | 'LATE'
  | 'ABSENT'
  | 'VACATION'
  | 'OUTING_PERMISSION'
  | 'REST_DAY'
  | 'WORK_ON_REST_DAY';

export interface AsistenciaProcesada {
  id: string;
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  dependencia_name?: string;
  area_name: string;
  fecha: string; // YYYY-MM-DD
  horario_name: string;
  // Turn 1
  t1_scheduled_in?: string;
  t1_scheduled_out?: string;
  t1_real_in?: string;
  t1_real_out?: string;
  t1_tardiness_minutes: number;
  // Turn 2 (Dual Turn Shift)
  t2_scheduled_in?: string;
  t2_scheduled_out?: string;
  t2_real_in?: string;
  t2_real_out?: string;
  t2_tardiness_minutes: number;

  total_tardiness_minutes: number;
  tolerance_applied_minutes: number;
  net_tardiness_minutes: number;
  overtime_minutes: number;
  status: AsistenciaEstado;
  has_papeleta: boolean;
  papeleta_code?: string;
  is_vacation_day: boolean;
  observations?: string;
}

export interface RbacPermission {
  module: string;
  action: string;
  description: string;
  employee: boolean;
  supervisor: boolean;
  hr_admin: boolean;
  security_guard: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  role: RoleType;
  module: string;
  action: string;
  affected_record_id: string;
  details: string;
}

