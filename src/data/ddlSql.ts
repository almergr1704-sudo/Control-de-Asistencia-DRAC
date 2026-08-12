/**
 * Complete PostgreSQL DDL Script for HRMS WFM System
 */

export const POSTGRES_DDL_SQL = `-- =============================================================================
-- ESQUEMA DE BASE DE DATOS POSTGRESQL - HRMS WFM & CONTROL DE ASISTENCIA
-- Generado para Producción Enterprise con Reglas de Negocio Strict
-- Autor: Arquitecto de Software Senior HRMS
-- =============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- =============================================================================
CREATE TYPE user_role_enum AS ENUM (
    'EMPLOYEE', 
    'SUPERVISOR', 
    'HR_ADMIN', 
    'SECURITY_GUARD'
);

CREATE TYPE zkteco_protocol_enum AS ENUM (
    'PUSH_ADMS', 
    'UDP', 
    'TCP'
);

CREATE TYPE punch_type_enum AS ENUM (
    'CHECK_IN', 
    'CHECK_OUT', 
    'BREAK_OUT', 
    'BREAK_IN', 
    'AUTO'
);

CREATE TYPE verify_mode_enum AS ENUM (
    'FINGERPRINT', 
    'FACE', 
    'PALM', 
    'CARD', 
    'PASSWORD'
);

CREATE TYPE papeleta_status_enum AS ENUM (
    'DRAFT', 
    'PENDING_BOSS', 
    'PENDING_HR', 
    'APPROVED', 
    'IN_OUTING', 
    'COMPLETED', 
    'REJECTED'
);

CREATE TYPE papeleta_motivo_enum AS ENUM (
    'PERSONAL', 
    'SALUD_MEDICA', 
    'COMISION_SERVICIOS', 
    'DILIGENCIA_OFICIAL', 
    'OTRO'
);

CREATE TYPE vacacion_tipo_enum AS ENUM (
    'TOTAL', 
    'PARCIAL'
);

CREATE TYPE asistencia_estado_enum AS ENUM (
    'PUNCTUAL', 
    'LATE', 
    'ABSENT', 
    'VACATION', 
    'OUTING_PERMISSION', 
    'REST_DAY', 
    'WORK_ON_REST_DAY'
);

-- =============================================================================
-- 2. DOMINIO ORGANIZACIONAL (Estructura de Empresa)
-- =============================================================================

-- Tabla de Áreas y Subáreas (Estructura Jerárquica Padre-Hijo)
CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_area_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_area_parent FOREIGN KEY (parent_area_id) 
        REFERENCES areas(id) ON DELETE SET NULL
);

CREATE INDEX idx_areas_parent_id ON areas(parent_area_id);
CREATE INDEX idx_areas_code ON areas(code);

-- Tabla de Empleados
CREATE TABLE empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni VARCHAR(15) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    area_id UUID NOT NULL,
    subarea_id UUID,
    supervisor_id UUID, -- Jefe Inmediato
    hr_contact_id UUID, -- Encargado de Personal / RRHH
    role user_role_enum NOT NULL DEFAULT 'EMPLOYEE',
    position VARCHAR(100) NOT NULL,
    hire_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_empleado_area FOREIGN KEY (area_id) 
        REFERENCES areas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_empleado_subarea FOREIGN KEY (subarea_id) 
        REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT fk_empleado_supervisor FOREIGN KEY (supervisor_id) 
        REFERENCES empleados(id) ON DELETE SET NULL,
    CONSTRAINT fk_empleado_hr_contact FOREIGN KEY (hr_contact_id) 
        REFERENCES empleados(id) ON DELETE SET NULL
);

CREATE INDEX idx_empleados_dni ON empleados(dni);
CREATE INDEX idx_empleados_area ON empleados(area_id);
CREATE INDEX idx_empleados_supervisor ON empleados(supervisor_id);

-- =============================================================================
-- 3. DOMINIO DE CONTROL DE ACCESO (RBAC: Roles y Permisos)
-- =============================================================================

CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL, -- Ej: 'papeleta:create', 'asistencia:read_all'
    module VARCHAR(50) NOT NULL,       -- Ej: 'PAPELETAS', 'ASISTENCIA'
    description TEXT NOT NULL
);

CREATE TABLE roles_permisos (
    role user_role_enum NOT NULL,
    permiso_id UUID NOT NULL,
    PRIMARY KEY (role, permiso_id),
    CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (permiso_id) 
        REFERENCES permisos(id) ON DELETE CASCADE
);

-- =============================================================================
-- 4. DOMINIO DE TIEMPOS: TURNOS Y HORARIOS (Regla de 1 o 2 Turnos)
-- =============================================================================

-- Turnos Laborales (Tramos continuos)
CREATE TABLE turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL, -- Ej: "Turno Mañana (08:00 - 13:00)"
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    tolerance_minutes INT NOT NULL DEFAULT 10,
    is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Horarios Laborales (Jornada Diaria)
CREATE TABLE horarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL, -- Ej: "Jornada Partida Oficina"
    turn_count INT NOT NULL CHECK (turn_count IN (1, 2)), -- Máximo 2 turnos por día
    working_days JSONB NOT NULL DEFAULT '["MON", "TUE", "WED", "THU", "FRI"]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Relación Horario <-> Turnos (Composición de 1 o 2 turnos en el día)
CREATE TABLE horario_turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    horario_id UUID NOT NULL,
    turno_id UUID NOT NULL,
    turn_order INT NOT NULL CHECK (turn_order IN (1, 2)), -- Turno 1 o Turno 2
    CONSTRAINT fk_horario_turnos_horario FOREIGN KEY (horario_id) 
        REFERENCES horarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_horario_turnos_turno FOREIGN KEY (turno_id) 
        REFERENCES turnos(id) ON DELETE RESTRICT,
    CONSTRAINT uq_horario_turn_order UNIQUE (horario_id, turn_order)
);

-- Asignación de Horario a Empleado
CREATE TABLE empleado_horarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    horario_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_emp_horario_emp FOREIGN KEY (employee_id) 
        REFERENCES empleados(id) ON DELETE CASCADE,
    CONSTRAINT fk_emp_horario_horario FOREIGN KEY (horario_id) 
        REFERENCES horarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_emp_horarios_active ON empleado_horarios(employee_id, active);

-- =============================================================================
-- 5. DOMINIO DE BIOMÉTRICOS (Integración ZKTeco Push ADMS)
-- =============================================================================

CREATE TABLE dispositivos_zkteco (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    port INT NOT NULL DEFAULT 4370,
    protocol zkteco_protocol_enum NOT NULL DEFAULT 'PUSH_ADMS',
    area_id UUID NOT NULL,
    location_detail VARCHAR(150),
    last_activity TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'ONLINE',
    firmware_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dispositivo_area FOREIGN KEY (area_id) 
        REFERENCES areas(id) ON DELETE RESTRICT
);

-- Tabla de Staging / Logs Crudos Inmutables (punch_logs)
CREATE TABLE marcaciones_raw (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL,
    employee_dni VARCHAR(15) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    punch_type punch_type_enum NOT NULL DEFAULT 'AUTO',
    verify_mode verify_mode_enum NOT NULL DEFAULT 'FINGERPRINT',
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    raw_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_marcacion_device FOREIGN KEY (device_id) 
        REFERENCES dispositivos_zkteco(id) ON DELETE RESTRICT
);

CREATE INDEX idx_marcaciones_raw_dni_ts ON marcaciones_raw(employee_dni, timestamp);
CREATE INDEX idx_marcaciones_raw_unprocessed ON marcaciones_raw(processed) WHERE processed = FALSE;

-- =============================================================================
-- 6. DOMINIO DE VACACIONES
-- =============================================================================

CREATE TABLE vacaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    tipo vacacion_tipo_enum NOT NULL, -- TOTAL (30 días) o PARCIAL (Fraccionada)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL,
    period_year INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    approved_by_hr UUID,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vacaciones_empleado FOREIGN KEY (employee_id) 
        REFERENCES empleados(id) ON DELETE CASCADE,
    CONSTRAINT fk_vacaciones_hr FOREIGN KEY (approved_by_hr) 
        REFERENCES empleados(id) ON DELETE SET NULL,
    CONSTRAINT chk_vacaciones_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_vacaciones_emp_dates ON vacaciones(employee_id, start_date, end_date);

-- =============================================================================
-- 7. DOMINIO DE PAPELETAS DE SALIDA (Workflow con Máquina de Estados)
-- =============================================================================

CREATE TABLE papeletas_salida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL, -- Ej: PAP-2026-0001
    employee_id UUID NOT NULL,
    supervisor_id UUID NOT NULL,
    motivo papeleta_motivo_enum NOT NULL,
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL,
    hora_estimada_salida TIME NOT NULL,
    hora_estimada_retorno TIME NOT NULL,
    hora_real_salida TIME, -- Control de Garita
    hora_real_retorno TIME, -- Control de Garita
    status papeleta_status_enum NOT NULL DEFAULT 'PENDING_BOSS',
    boss_approved_at TIMESTAMP WITH TIME ZONE,
    boss_comment TEXT,
    hr_approved_at TIMESTAMP WITH TIME ZONE,
    hr_comment TEXT,
    security_guard_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_papeleta_employee FOREIGN KEY (employee_id) 
        REFERENCES empleados(id) ON DELETE CASCADE,
    CONSTRAINT fk_papeleta_supervisor FOREIGN KEY (supervisor_id) 
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_papeleta_guard FOREIGN KEY (security_guard_id) 
        REFERENCES empleados(id) ON DELETE SET NULL
);

CREATE INDEX idx_papeletas_employee ON papeletas_salida(employee_id);
CREATE INDEX idx_papeletas_fecha_status ON papeletas_salida(fecha, status);

-- Auditoría e Trazabilidad Inmutable de la Papeleta de Salida
CREATE TABLE auditoria_papeletas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    papeleta_id UUID NOT NULL,
    previous_status papeleta_status_enum NOT NULL,
    new_status papeleta_status_enum NOT NULL,
    action_by_user_id UUID NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_papeleta FOREIGN KEY (papeleta_id) 
        REFERENCES papeletas_salida(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (action_by_user_id) 
        REFERENCES empleados(id) ON DELETE RESTRICT
);

-- =============================================================================
-- 8. ASISTENCIA PROCESADA (Consolidado de Asistencia y Tardanzas)
-- =============================================================================

CREATE TABLE asistencia_procesada (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    fecha DATE NOT NULL,
    horario_id UUID,
    
    -- Turno 1
    t1_scheduled_in TIME,
    t1_scheduled_out TIME,
    t1_real_in TIME,
    t1_real_out TIME,
    t1_tardiness_minutes INT DEFAULT 0,
    
    -- Turno 2 (Jornada Partida)
    t2_scheduled_in TIME,
    t2_scheduled_out TIME,
    t2_real_in TIME,
    t2_real_out TIME,
    t2_tardiness_minutes INT DEFAULT 0,
    
    total_tardiness_minutes INT DEFAULT 0,
    tolerance_applied_minutes INT DEFAULT 0,
    net_tardiness_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    
    status asistencia_estado_enum NOT NULL,
    has_papeleta BOOLEAN DEFAULT FALSE,
    papeleta_id UUID,
    is_vacation_day BOOLEAN DEFAULT FALSE,
    observations TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_asistencia_emp FOREIGN KEY (employee_id) 
        REFERENCES empleados(id) ON DELETE CASCADE,
    CONSTRAINT fk_asistencia_papeleta FOREIGN KEY (papeleta_id) 
        REFERENCES papeletas_salida(id) ON DELETE SET NULL,
    CONSTRAINT uq_asistencia_emp_fecha UNIQUE (employee_id, fecha)
);

CREATE INDEX idx_asistencia_fecha_status ON asistencia_procesada(fecha, status);
CREATE INDEX idx_asistencia_emp_fecha ON asistencia_procesada(employee_id, fecha);

-- =============================================================================
-- 9. TRIGGERS Y FUNCIONES AUTOMÁTICAS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_empleados_modtime
    BEFORE UPDATE ON empleados
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER update_papeletas_modtime
    BEFORE UPDATE ON papeletas_salida
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
`;
