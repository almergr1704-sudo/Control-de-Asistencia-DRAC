export type UserRole =
  | 'ADMIN_GENERAL'
  | 'HR_ADMIN'
  | 'JEFE_RRHH'
  | 'CONTROL_ASISTENCIA'
  | 'SUPERVISOR'
  | 'DIRECTOR_GENERAL'
  | 'JEFE_INMEDIATO'
  | 'TRABAJADOR';

export interface Employee {
  id: string;
  dni: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  regimen_laboral: 'D.L. 276' | 'D.L. 728' | 'D.L. 1057 (CAS)' | 'LOCACION_SERVICIOS';
  cargo: string;
  dependencia_id: string;
  dependencia_name: string;
  direccion_organo_name?: string;
  area_name?: string;
  condicion: 'NOMBRADO' | 'CONTRATADO' | 'DESIGNADO' | 'PRACTICANTE';
  estado: 'ACTIVO' | 'INACTIVO' | 'LICENCIA' | 'VACACIONES';
  biometric_user_id?: string;
  zkteco_pin?: string;
  codigo_trabajador?: string;
  username?: string;
  photo_url?: string;
  fecha_ingreso?: string;
}

export interface DispositivoZkTeco {
  id: string;
  name: string;
  serial_number: string;
  ip_address: string;
  port: number;
  mac_address: string;
  device_type: 'FACIAL_G3' | 'HUELLA_SILKBIO' | 'PROFACE_X' | 'STANDALONE_K40' | 'OTRO';
  firmware_version?: string;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';
  tcp_status?: 'ONLINE' | 'OFFLINE';
  agent_status?: 'ONLINE' | 'OFFLINE';
  last_activity?: string;
  last_sync?: string;
  last_latency_ms?: number;
  log_count: number;
  enrolled_user_count: number;
  dependencia_id?: string;
  dependencia_name?: string;
  dependencia_tipo?: 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA';
  push_enabled?: boolean;
  push_server_address?: string;
  push_server_port?: number;
  push_endpoint?: string;
  push_protocol?: 'HTTP' | 'HTTPS';
  push_interval?: number;
}

export interface MarcacionRaw {
  id: string;
  device_id: string;
  deviceId?: string;
  device_sn: string;
  serialNumber?: string;
  device_name?: string;
  device_dependencia_tipo?: 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA';
  device_dependencia_name?: string;
  employee_id?: string | null;
  employee_dni: string;
  dni?: string;
  employee_code?: string;
  employeeCode?: string;
  employee_name: string;
  employee_dependencia_tipo?: 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA';
  employee_dependencia_name?: string;
  timestamp: string;
  fecha: string;
  hora: string;
  punch_type: 'AUTO' | 'CHECK_IN' | 'CHECK_OUT' | 'LUNCH_OUT' | 'LUNCH_IN' | 'DUTY_OUT' | 'DUTY_IN';
  punch_state: number; // 0=in, 1=out
  verify_mode: 'FINGERPRINT' | 'FACE' | 'CARD' | 'PASSWORD' | 'PALM';
  source: 'SOCKET_TCP' | 'PUSH' | 'REST_PUSH' | 'ADMS_PUSH' | 'USB_DAT' | 'BIOTIME_BRIDGE' | 'MANUAL_AUTH';
  origen?: string;
  processed: boolean;
  processed_at?: string;
  status: 'RECIBIDA' | 'PROCESADA' | 'PENDIENTE_IDENTIFICACION' | 'DESCARTADA' | 'YA_EXISTENTE_IGNORADA';
  processingStatus?: string;
  validation_status: 'VALIDA' | 'PENDIENTE_IDENTIFICACION' | 'DUPLICADA_FILTRADA' | 'RECHAZADA';
  raw_payload?: string;
  rawPayload?: string;
  rejection_reason?: string;
  authorization_id?: string;
  received_at?: string;
  receivedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_dni: string;
  employee_name: string;
  dependencia_id: string;
  dependencia_name: string;
  direccion_organo_name?: string;
  area_name?: string;
  fecha: string; // YYYY-MM-DD
  t1_scheduled_in: string; // "08:00"
  t1_scheduled_out: string; // "13:00"
  t1_real_in: string | null;
  t1_real_out: string | null;
  t2_scheduled_in: string; // "14:00"
  t2_scheduled_out: string; // "17:00"
  t2_real_in: string | null;
  t2_real_out: string | null;
  status: 'PUNCTUAL' | 'LATE' | 'ABSENCE' | 'JUSTIFIED' | 'COMMISSION' | 'VACATION' | 'HOLIDAY';
  tardiness_minutes: number;
  net_tardiness_minutes: number;
  total_effective_hours: number;
  raw_punch_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PushDashboardSummary {
  success: boolean;
  device_count: number;
  online_devices: number;
  total_received_today: number;
  total_raw_punches: number;
  identified_punches: number;
  unidentified_punches: number;
  processed_punches: number;
  last_received_at: string | null;
  server_parameters: {
    ip: string;
    port: number;
    protocol: string;
    endpoint: string;
    health_url: string;
    cdata_url: string;
  };
}

export interface PushReceptionLog {
  id: string;
  dispositivo: string;
  serial: string;
  ip_origen: string;
  employeeCode: string;
  employee_name: string;
  employee_dni: string;
  punch_time: string;
  reception_time: string;
  event_type: string;
  payload_original: string;
  estado: 'VALIDA' | 'PROCESADA' | 'PENDIENTE_IDENTIFICACION' | 'YA_EXISTENTE_IGNORADA' | 'ERROR';
  error: string | null;
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

export interface Dependencia {
  id: string;
  name: string;
  tipo: 'SEDE_CENTRAL' | 'AGENCIA_AGRARIA' | 'SEDE_OPERATIVA';
  direccion: string;
  telefono?: string;
}
