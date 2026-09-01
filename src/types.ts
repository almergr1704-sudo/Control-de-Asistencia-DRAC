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

export type DependenciaType = 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA';

export type OrganoType =
  | 'DIRECCION'
  | 'ORGANO_APOYO'
  | 'JEFATURA_AGENCIA'
  | 'OFICINA_AGRARIA';

export type RegimenLaboral =
  | 'D. LEG. 276'
  | 'D. LEG. 728'
  | 'D. LEG. 1057 - CAS'
  | 'PRACTICANTE'
  | 'D.L. 276'
  | 'D.L. 728'
  | 'CAS D.L. 1057'
  | 'LEY 30057 - SERVICIO CIVIL'
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
  tipo?: 'AREA' | 'OFICINA' | 'UNIDAD_FUNCIONAL' | 'SUB_AREA';
  description?: string;
  dependencia_id?: string;
  dependencia_name?: string;
  direccion_organo_id: string; // ID de la Dirección / Órgano de Apoyo / Oficina Agraria (Obligatorio)
  direccion_organo_name: string; // Nombre de la Dirección / Órgano de Apoyo / Oficina Agraria
  unidad_superior_id?: string; // Alias para vinculación relacional
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

export interface RoleHistoryEntry {
  id: string;
  previous_role: RoleType;
  new_role: RoleType;
  previous_status?: 'ACTIVE' | 'INACTIVE';
  new_status?: 'ACTIVE' | 'INACTIVE';
  changed_at: string;
  changed_by: string;
  reason?: string;
}

export type EncargaturaMotivo =
  | 'VACACIONES'
  | 'PERMISO'
  | 'COMISION_SERVICIOS'
  | 'LICENCIA'
  | 'TRABAJO_FUERA_SEDE'
  | 'OTRO';

export type EncargaturaDocumentType =
  | 'MEMORANDO'
  | 'RESOLUCION_DIRECTORAL'
  | 'OFICIO'
  | 'DECRETO'
  | 'OTRO';

export type EncargaturaStatus = 'PENDIENTE' | 'VIGENTE' | 'FINALIZADA' | 'ANULADA';

export interface Encargatura {
  id: string;
  // Trabajador Titular (quien se ausenta)
  titular_employee_id: string;
  titular_dni: string;
  titular_name: string;
  titular_cargo: string;
  titular_area_name: string;
  titular_direccion_organo_name?: string;

  // Trabajador Encargado (quien asume temporalmente la jefatura)
  encargado_employee_id: string;
  encargado_dni: string;
  encargado_name: string;
  encargado_cargo: string;
  encargado_area_procedencia_id: string;
  encargado_area_procedencia_name: string;
  encargado_dependencia_procedencia_name?: string;

  // Unidad Orgánica Encargada (Ámbito de Jefatura Delegada)
  dependencia_id: string;
  dependencia_name: string;
  direccion_organo_id?: string;
  direccion_organo_name?: string;
  direccion_organo_type?: OrganoType;
  area_id?: string;
  area_name?: string;
  cargo_encargado: string; // Ej: "Director de Administración (e)", "Jefe de Oficina Agraria Celendín (e)"

  // Sustento y Vigencia Administrativa
  motivo: EncargaturaMotivo;
  motivo_detalle?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  document_type: EncargaturaDocumentType;
  document_number: string; // Ej: "Memorando N.º 025-2026-DRAC"
  document_date: string; // YYYY-MM-DD
  document_file_name?: string;
  status: EncargaturaStatus;

  // Trazabilidad y Auditoría
  papeletas_approved_count?: number;
  created_at: string;
  created_by?: string;
  observaciones?: string;
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
  
  // Perfil y Cuenta de Acceso al Sistema
  has_system_access?: boolean; // ¿Tendrá acceso al sistema? Sí / No
  username?: string; // Nombre de usuario para iniciar sesión (autogenerado con regla institucional)
  account_status?: 'ACTIVE' | 'INACTIVE'; // Estado de la cuenta
  auth_method?: 'PASSWORD' | 'BIOMETRIC' | 'INSTITUTIONAL'; // Método de acceso
  role: RoleType; // Perfil primario/activo en sesión
  assigned_roles?: RoleType[]; // Conjunto de perfiles acumulativos (siempre incluye TRABAJADOR)
  role_history?: RoleHistoryEntry[]; // Historial de cambios de perfil para trazabilidad

  // Seguridad & Credenciales de Acceso
  password_hash?: string; // Hash criptográfico de la contraseña (NUNCA texto plano)
  password_salt?: string; // Salt criptográfico aleatorio
  password_change_required?: boolean; // true = Obliga cambio en primer ingreso (PENDIENTE)
  primer_ingreso?: 'PENDIENTE' | 'COMPLETADO'; // Estado visible de primer ingreso
  last_password_change?: string; // Fecha de último cambio de contraseña
  
  // Cargo y Datos Laborales
  position: string; // Nombre del Cargo institucional
  cargo_id?: string; // ID del catálogo de cargos
  regimen_laboral: RegimenLaboral;
  condicion_laboral: CondicionLaboral;
  is_jefe_director?: boolean; // Es titular de Dirección, Órgano Apoyo, Jefatura Agencia u Oficina Agraria
  unidad_dirigida_id?: string; // ID de la unidad que dirige formalmente como titular
  unidad_dirigida_name?: string; // Nombre de la unidad que dirige
  unidad_dirigida_type?: OrganoType; // Tipo orgánico (DIRECCION, ORGANO_APOYO, JEFATURA_AGENCIA, OFICINA_AGRARIA)
  
  hire_date: string; // NON-EDITABLE original hire date
  active: boolean; // DESACTIVABLE
  schedule_id?: string;
  schedule_name?: string;
  zkteco_pin?: string; // PIN for ZKTeco terminal
  
  // ZKTeco Biometric Synchronization
  biometric_user_id?: string; // Unique User ID in device (e.g. "000123" or numeric string)
  biometric_sync_status?: 'SINCRONIZADO' | 'PENDIENTE' | 'ERROR' | 'NO_REGISTRADO' | 'DESACTIVADO';
  biometric_last_sync?: string; // Date of last sync e.g. "2026-08-20 09:35:10"
  biometric_sync_device_id?: string; // Main synced device ID
  biometric_sync_device_name?: string; // Main synced device Name
  biometric_sync_error?: string; // Error detail if sync failed
  assigned_device_ids?: string[]; // IDs of biometric terminals assigned to employee
  device_sync_records?: Record<string, {
    user_id: string;
    status: 'SINCRONIZADO' | 'PENDIENTE' | 'ERROR' | 'DESACTIVADO';
    last_sync: string;
    error_message?: string;
    privilege?: number;
  }>;
}

export interface Turno {
  id: string;
  code: string;
  name: string;
  description?: string;
  // 1. HORARIO DEL TURNO (Jornada Estándar)
  start_time: string; // Hora inicio estándar de la jornada (TIME)
  end_time: string; // Hora fin estándar de la jornada (TIME) - Evaluación estricta

  // 2. VENTANA DE MARCACIÓN (Permitida en Biométrico)
  window_entry_start?: string; // Hora inicio marcación de entrada (TIME)
  window_exit_limit?: string; // Hora límite marcación de salida (TIME)

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
  effective_start_date?: string; // Vigencia inicio (YYYY-MM-DD)
  effective_end_date?: string | null; // Vigencia fin (YYYY-MM-DD o null si vigente)
  version?: number;
  total_hours?: number;
  total_duration_text?: string;
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
  status?: 'ONLINE' | 'OFFLINE' | 'ONLINE_ATT_ERROR';
  message: string;
  cause?: string;
  user: string;
  latency_ms?: number;
  ip: string;
  port: number;
  model?: string;
  serial_number?: string;
  user_count?: number;
  clock_punches_count?: number | string;
  new_punches_count?: number;
  saved_punches_count?: number;
  error_count?: number;
  formatted_output?: string;
  step_details?: {
    tcp_ok: boolean;
    auth_ok: boolean;
    device_info_ok: boolean;
    users_ok: boolean;
    punches_ok: boolean;
    saved_ok: boolean;
    api_verified_ok: boolean;
  };
}

export interface DeviceCapabilities {
  tcp_zk: boolean;
  adms_push: boolean;
  fingerprint: boolean;
  face: boolean;
  palm: boolean;
  card: boolean;
  pin: boolean;
  user_management: boolean;
  punch_query: boolean;
  realtime_push: boolean;
}

export interface DevicePushConfig {
  push_enabled: boolean;
  server_address: string; // Dirección IP o Dominio del Servidor Express DRAC
  server_port: number; // Puerto HTTP/HTTPS (ej. 3000)
  protocol: 'HTTP' | 'HTTPS';
  endpoint: string; // Ej. "/api/zkteco/push" o "/iclock/cdata"
  push_interval_sec?: number;
  status: 'PUSH_ONLINE' | 'PUSH_OFFLINE' | 'WAITING_PUNCHES' | 'ERROR';
  last_connection?: string | null;
  last_punch_received?: string | null;
  last_heartbeat?: string | null;
}

export interface PushReceptionLog {
  id: string;
  dispositivo: string;
  serial: string;
  ip_origen?: string;
  employeeCode: string;
  employee_name?: string;
  employee_dni?: string;
  punch_time: string; // fecha/hora de marcación en reloj
  reception_time: string; // fecha/hora de recepción en servidor DRAC
  event_type?: string; // CHECK_IN, CHECK_OUT, VERIFY_FACE, VERIFY_FP, HEARTBEAT
  payload_original: string;
  estado: 'VALIDA' | 'PROCESADA' | 'YA_EXISTENTE_IGNORADA' | 'PENDIENTE_IDENTIFICACION' | 'IGNORADA' | 'ERROR';
  error?: string | null;
  stage_diagnostics?: {
    clock_network: boolean;
    tcp_socket: boolean;
    adms_config: boolean;
    push_endpoint: boolean;
    auth: boolean;
    payload_received: boolean;
    storage_saved: boolean;
    processed_attendance: boolean;
    api_available: boolean;
    frontend_rendered: boolean;
  };
}

export interface PushDashboardSummary {
  push_online: boolean;
  status_message: string;
  tcp_status: 'OK' | 'ERROR' | 'UNAVAILABLE_CLOUD';
  tcp_message?: string;
  adms_status: 'OK' | 'WAITING_PUNCHES' | 'ERROR';
  adms_message?: string;
  last_connection: string | null;
  last_punch: string | null;
  punches_today: number;
  punches_new: number;
  punches_processed: number;
  error_count: number;
  server_address: string;
  server_domain?: string;
  server_port: number;
  protocol: 'HTTP' | 'HTTPS';
  endpoint?: string;
  listener_endpoints: string[];
  total_raw_punches?: number;
  registered_devices_count?: number;
  online_devices_count?: number;
  devices?: any[];
  server_time?: string;
}

export interface DispositivoZkTeco {
  id: string;
  serial_number: string;
  name: string;
  brand?: string; // Default ZKTeco
  model?: string; // e.g. G3-id, SilkBio-101TC, uFace 800, K40, MB20, iClock 880, SpeedFace-V5L
  ip_address: string;
  port: number;
  protocol: 'PUSH_ADMS' | 'UDP' | 'TCP';
  dependencia_tipo: DependenciaType; // SEDE_CENTRAL o AGENCIA_AGRARIA
  dependencia_id: string;
  dependencia_name: string;
  area_id?: string;
  area_name?: string;
  location_detail: string;
  last_activity: string;
  status: DeviceStatus;
  firmware_version?: string;
  last_test?: DeviceTestRecord;
  capabilities?: DeviceCapabilities;
  enrolled_user_count?: number;
  enrolled_fingerprint_count?: number;
  enrolled_face_count?: number;
  log_count?: number;
  adms_url?: string;
  push_config?: DevicePushConfig;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  agent_status?: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';
  tcp_status?: 'ONLINE' | 'OFFLINE' | 'UNTESTED';
}

export interface DracZkAgent {
  id: string;
  name: string;
  hostname: string;
  ip_lan: string;
  version: string;
  status: 'ONLINE' | 'SYNCING' | 'OFFLINE' | 'ERROR';
  assigned_device_ids: string[];
  assigned_device_sns: string[];
  last_ping: string;
  last_sync: string;
  pending_queue_count: number;
  sync_interval_seconds: number;
  auto_sync: boolean;
  auth_token: string;
  os_info?: string;
  last_error?: string | null;
  total_punches_bridged?: number;
  total_users_pushed?: number;
}

export interface AgentCommand {
  id: string;
  agent_id: string;
  device_id?: string;
  device_ip?: string;
  device_port?: number;
  command: 'TEST_CONNECTION' | 'GET_INFO' | 'DOWNLOAD_PUNCHES' | 'SYNC_USER' | 'SYNC_BATCH_USERS' | 'CLEAR_LOGS';
  params?: any;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  completed_at?: string;
  result?: any;
  error?: string;
}

export type BiometricSyncStatus = 'SINCRONIZADO' | 'PENDIENTE' | 'ERROR' | 'NO_REGISTRADO' | 'DESACTIVADO';

export interface ZkDeviceUserComparison {
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  employee_cargo: string;
  biometric_user_id: string;
  system_status: 'ACTIVO' | 'INACTIVO';
  in_device: boolean;
  device_user_id?: string;
  device_name?: string;
  device_privilege?: string;
  device_enabled?: boolean;
  status_match: 'MATCH' | 'MISSING_IN_DEVICE' | 'MISMATCH' | 'DISABLED_IN_DEVICE';
  diagnosis: string;
}

export interface ZkPunchQueryRecord {
  uid: string;
  device_id: string;
  device_name: string;
  device_sn: string;
  user_id: string;
  employee_dni?: string;
  employee_name?: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  punch_type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO';
  verify_mode: 'FINGERPRINT' | 'FACE' | 'PALM' | 'CARD' | 'PASSWORD';
  is_already_imported: boolean;
}

export interface ZkSyncBatchResult {
  total: number;
  synced_count: number;
  error_count: number;
  details: {
    employee_id: string;
    employee_dni: string;
    name: string;
    biometric_user_id: string;
    status: 'SUCCESS' | 'ERROR';
    message: string;
  }[];
}

export type PunchValidationStatus = 'VALIDA' | 'RECHAZADA_DEPENDENCIA' | 'EXCEPCION_AUTORIZADA' | 'PENDIENTE_IDENTIFICACION';

export interface MarcacionRaw {
  id: string;
  device_id: string;
  device_sn?: string;
  device_name: string;
  device_dependencia_tipo?: DependenciaType;
  device_dependencia_name?: string;
  employee_dni: string;
  employee_code?: string;
  employee_name?: string;
  employee_dependencia_tipo?: DependenciaType;
  employee_dependencia_name?: string;
  timestamp: string; // "2026-08-12 08:03:12"
  punch_type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO';
  punch_state?: number;
  verify_mode: 'FINGERPRINT' | 'FACE' | 'PALM' | 'CARD' | 'PASSWORD';
  processed: boolean;
  processed_at?: string;
  raw_payload?: string;
  validation_status?: PunchValidationStatus;
  rejection_reason?: string;
  authorization_id?: string;
}

export interface AutorizacionMarcacionTemporal {
  id: string;
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  employee_cargo?: string;
  dependencia_origen_tipo: DependenciaType;
  dependencia_origen_name: string;
  dependencia_autorizada_tipo: DependenciaType;
  dependencia_autorizada_name: string;
  device_id?: string; // ID específico o vacío para todos los marcadores de la dependencia
  device_name?: string;
  device_sn?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  motivo: string; // Ej: "Comisión de Servicios", "Apoyo técnico en Agencia", "Capacitación en Sede Central", "Auditoría en campo"
  documento_autorizacion: string; // Ej: "Memorando N° 142-2026-GR.CAJ/DRA-RRHH"
  document_file_name?: string;
  status: 'ACTIVA' | 'VENCIDA' | 'REVOCADA';
  created_at: string;
  created_by: string;
  revoked_at?: string;
  revoked_by?: string;
  revoked_reason?: string;
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
  | 'COMISION_SERVICIOS'
  | 'SALUD_MEDICA'
  | 'CAPACITACION_INSTITUCIONAL'
  | 'ASUNTOS_PARTICULARES'
  | 'PERSONAL'
  | 'DILIGENCIA_OFICIAL'
  | 'OTRO';

export type PapeletaOrigen = 'PORTAL_TRABAJADOR' | 'ADMINISTRATIVO';

export interface PapeletaAudit {
  id: string;
  papeleta_id: string;
  previous_status?: PapeletaStatus;
  new_status: PapeletaStatus;
  action_by_user_id: string;
  action_by_user_name: string;
  action_by_role: RoleType | string;
  action_type?: string;
  origin?: PapeletaOrigen | string;
  comment?: string;
  rejection_reason?: string;
  boss_approver_name?: string;
  boss_approver_dni?: string;
  boss_approver_function?: string;
  delegation_info?: PapeletaBossDelegationInfo;
  timestamp: string;
}

export interface PapeletaBossDelegationInfo {
  is_encargado: boolean;
  encargatura_id?: string;
  unidad_encargada: string;
  documento: string; // Ej: "Memorando N.º 025-2026-DRAC"
  vigencia: string; // Ej: "01/09/2026 – 15/09/2026"
  motivo?: string;
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
  supervisor_dni?: string;
  supervisor_function?: string;
  supervisor_delegation_info?: PapeletaBossDelegationInfo;
  
  motivo: PapeletaMotivo;
  descripcion: string;
  destino: string;
  fecha: string; // YYYY-MM-DD
  hora_estimada_salida?: string; // "10:30" (Opcional para el trabajador solicitante)
  hora_estimada_retorno?: string; // "12:00" (Opcional para el trabajador solicitante)
  hora_real_salida?: string | null; // Guarded by Vigilancia
  hora_real_retorno?: string | null; // Guarded by Vigilancia
  sin_retorno?: boolean; // Salida sin retorno (Comisión final de jornada, etc.)
  status: PapeletaStatus;
  origin?: PapeletaOrigen;
  
  digital_signature_data?: string; // Digital signature image / vector
  signed_at?: string;
  
  boss_approved_at?: string;
  boss_comment?: string;
  boss_approver_name?: string;
  boss_approver_dni?: string;
  boss_approver_profile?: string; // Ej: "Trabajador" | "Trabajador + Jefe Inmediato"
  boss_approver_function?: string; // Ej: "Jefe Titular" | "Jefe Encargado"
  boss_delegation_info?: PapeletaBossDelegationInfo;

  hr_approved_at?: string;
  hr_comment?: string;
  hr_approver_name?: string;
  hr_approver_dni?: string;
  
  security_guard_id?: string;
  security_guard_name?: string;
  rejection_reason?: string;
  created_by?: string;
  created_by_role?: string;
  audits?: PapeletaAudit[];
  created_at: string;
  updated_at: string;
}

export type VacacionTipo = 'TOTAL' | 'PARCIAL' | 'TOTAL_30' | 'FRACCIONADO';

export type VacacionStatus =
  | 'SOLICITADA'
  | 'VISTO_BUENO_JEFE'
  | 'OBSERVADA'
  | 'RECHAZADA'
  | 'APROBADA_RRHH'
  | 'PROGRAMADA'
  | 'EN_CURSO'
  | 'FINALIZADA'
  | 'CANCELADA';

export type VacacionOrigen = 'PROFILE_VACATION_REQUEST' | 'ATTENDANCE_VACATION_PROGRAMMING';

export interface VacacionAudit {
  id: string;
  vacacion_id: string;
  previous_status?: VacacionStatus;
  new_status: VacacionStatus;
  action_by_user_id: string;
  action_by_user_name: string;
  action_by_role: RoleType;
  action_type:
    | 'SOLICITAR'
    | 'VISTO_BUENO_JEFE'
    | 'OBSERVAR'
    | 'RECHAZAR'
    | 'APROBAR_RRHH'
    | 'PROGRAMAR'
    | 'CANCELAR'
    | 'EDITAR'
    | 'ACTUALIZACION_SISTEMA';
  origin: VacacionOrigen;
  comment?: string;
  rejection_reason?: string;
  timestamp: string;
  boss_approver_name?: string;
  boss_approver_dni?: string;
  boss_approver_function?: string;
  delegation_info?: {
    is_encargado: boolean;
    encargatura_id?: string;
    unidad_encargada?: string;
    documento?: string;
    vigencia?: string;
  };
}

export interface Vacacion {
  id: string;
  code?: string; // Ej: VAC-2026-001
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  dependencia_id?: string;
  dependencia_name?: string;
  direccion_organo_name?: string;
  area_id?: string;
  area_name?: string;
  position?: string;
  regimen_laboral?: RegimenLaboral;
  condicion_laboral?: CondicionLaboral;

  tipo: VacacionTipo;
  start_date: string;
  end_date: string;
  total_days: number;
  period_year: number;

  status: VacacionStatus;
  origin: VacacionOrigen;

  // V°B° Jefe Inmediato
  supervisor_id?: string;
  supervisor_name?: string;
  boss_approved_at?: string;
  boss_approver_id?: string;
  boss_approver_dni?: string;
  boss_approver_name?: string;
  boss_approver_function?: string; // 'Jefe Titular' | 'Jefe Encargado'
  boss_delegation_info?: {
    is_encargado: boolean;
    encargatura_id?: string;
    unidad_encargada?: string;
    documento?: string;
    vigencia?: string;
  };
  boss_comment?: string;
  rejection_reason?: string;
  observation_comment?: string;

  // RRHH / Control
  approved_by_hr?: string;
  hr_approved_at?: string;
  hr_approver_id?: string;
  hr_approver_name?: string;
  hr_comment?: string;

  comments?: string;
  created_at: string;
  created_by?: string;
  created_by_role?: RoleType;
  updated_at?: string;

  audits?: VacacionAudit[];
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
  t1_window_entry_start?: string;
  t1_window_exit_limit?: string;
  t1_real_in?: string;
  t1_real_out?: string;
  t1_effective_hours?: number; // Horas efectivas computadas según regla del turno
  t1_tardiness_minutes: number;
  // Turn 2 (Dual Turn Shift)
  t2_scheduled_in?: string;
  t2_scheduled_out?: string;
  t2_window_entry_start?: string;
  t2_window_exit_limit?: string;
  t2_real_in?: string;
  t2_real_out?: string;
  t2_effective_hours?: number; // Horas efectivas computadas según regla del turno
  t2_tardiness_minutes: number;

  total_effective_hours?: number; // Total horas efectivas trabajadas computadas
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

export type AppOrigin = 'WEB' | 'DESKTOP' | 'ZK_AGENT';

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
  ip_address?: string;
  app_origin?: AppOrigin;
  result?: 'SUCCESS' | 'ERROR' | 'WARNING';
}

export interface SupabaseConfigStatus {
  connected: boolean;
  sourceOfTruth: 'SUPABASE_POSTGRESQL' | 'LOCAL_HYBRID';
  supabaseUrl: string;
  configuredClients: {
    webVercel: boolean;
    desktopApp: boolean;
    zkAgent: boolean;
  };
  tablesCount: {
    trabajadores: number;
    dependencias: number;
    direcciones: number;
    areas_oficinas: number;
    horarios: number;
    turnos: number;
    papeletas: number;
    vacaciones: number;
    encargaturas: number;
    dispositivos_zkteco: number;
    marcaciones_raw: number;
    asistencias: number;
    auditoria: number;
  };
  rlsPoliciesActive: boolean;
  centralDracSequenceActive: boolean;
  lastSyncTimestamp?: string;
}

export interface PasswordPolicy {
  min_length: number; // Mínimo de caracteres (ej: 8)
  require_uppercase: boolean; // Requiere al menos una mayúscula (A-Z)
  require_lowercase: boolean; // Requiere al menos una minúscula (a-z)
  require_number: boolean; // Requiere al menos un número (0-9)
  require_special_char: boolean; // Requiere caracter especial (!@#$%^&*...)
  prevent_previous_password: boolean; // Impide reutilizar la contraseña inicial/anterior
  force_change_first_login?: boolean; // Forzar cambio de contraseña en primer ingreso
}

export interface SecurityConfig {
  institution_name: string;
  default_tolerance: number;
  require_garita_return: boolean;
  password_policy: PasswordPolicy;
}

// Aliases for unified Supabase PostgreSQL schema
export type Papeleta = PapeletaSalida;
export type RawPunch = MarcacionRaw;


