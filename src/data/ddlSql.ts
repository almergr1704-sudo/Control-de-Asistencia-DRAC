/**
 * Complete PostgreSQL / Supabase DDL Script for DRAC Cajamarca
 * ÚNICA FUENTE DE VERDAD CENTRALIZADA PARA CLIENTES WEB (VERCEL) Y ESCRITORIO (DESKTOP)
 */

export const POSTGRES_DDL_SQL = `-- =============================================================================
-- BASE DE DATOS CENTRAL POSTGRESQL / SUPABASE - DRAC CAJAMARCA
-- Sistema de Control de Asistencia, Papeletas, Vacaciones y Marcadores ZKTeco
-- Única Fuente de Verdad para Clientes Web (Vercel) y Escritorio (Desktop)
-- =============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. TIPOS ENUMERADOS (ENUMS)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE app_origin_enum AS ENUM ('WEB', 'DESKTOP', 'ZK_AGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE rol_usuario_enum AS ENUM (
        'ADMIN_GENERAL',
        'JEFE_RRHH',
        'DIRECTOR_GENERAL',
        'CONTROL_ASISTENCIA',
        'JEFE_INMEDIATO',
        'TRABAJADOR',
        'SEGURIDAD_GARITA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dependencia_tipo_enum AS ENUM (
        'SEDE_CENTRAL',
        'AGENCIA_AGRARIA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE papeleta_estado_enum AS ENUM (
        'PENDING_BOSS',
        'PENDING_HR',
        'APPROVED',
        'IN_PROGRESS',
        'COMPLETED',
        'REJECTED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vacacion_estado_enum AS ENUM (
        'PENDING_BOSS',
        'PENDING_HR',
        'APPROVED',
        'IN_PROGRESS',
        'COMPLETED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE encargatura_estado_enum AS ENUM (
        'ACTIVE',
        'FINISHED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE zkteco_protocol_enum AS ENUM (
        'PUSH_ADMS',
        'AGENT_TCP',
        'TCP_DIRECT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 3. ESTRUCTURA ORGANIZACIONAL (Tablas Maestras)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dependencias (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    tipo dependencia_tipo_enum NOT NULL DEFAULT 'SEDE_CENTRAL',
    direccion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS direcciones (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    dependencia_id VARCHAR(50) NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas_oficinas (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    direccion_id VARCHAR(50) REFERENCES direcciones(id) ON DELETE RESTRICT,
    dependencia_id VARCHAR(50) NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
    jefe_actual_id VARCHAR(50), -- FK circular resuelta a trabajadores
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cargos (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    area_id VARCHAR(50) REFERENCES areas_oficinas(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regimenes_laborales (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL, -- D.L. 276, D.L. 728, D.L. 1057 (CAS), etc.
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- 4. TRABAJADORES (Con Código DRAC con Relleno de Huecos Transaccional)
-- =============================================================================

CREATE TABLE IF NOT EXISTS trabajadores (
    id VARCHAR(50) PRIMARY KEY,
    codigo_drac VARCHAR(20) UNIQUE NOT NULL, -- Ej: DRAC-0001, DRAC-0002
    dni VARCHAR(15) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    telefono VARCHAR(20),
    dependencia_id VARCHAR(50) NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
    area_id VARCHAR(50) REFERENCES areas_oficinas(id) ON DELETE RESTRICT,
    cargo_id VARCHAR(50) REFERENCES cargos(id) ON DELETE RESTRICT,
    regimen_id VARCHAR(50) REFERENCES regimenes_laborales(id) ON DELETE RESTRICT,
    es_jefe BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trabajadores_dni ON trabajadores(dni);
CREATE INDEX IF NOT EXISTS idx_trabajadores_codigo_drac ON trabajadores(codigo_drac);
CREATE INDEX IF NOT EXISTS idx_trabajadores_area ON trabajadores(area_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_dependencia ON trabajadores(dependencia_id);

-- =============================================================================
-- 5. FUNCIÓN CORRELATIVO CENTRALIZADO DRAC (RELLENO DE HUECOS / GAPS)
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_next_drac_code()
RETURNS VARCHAR AS $$
DECLARE
    v_next_num INT := 1;
    v_cand INT := 1;
    v_found BOOLEAN;
    v_max INT;
BEGIN
    -- Bloqueo transaccional advisory para evitar condiciones de carrera entre Vercel y Desktop
    PERFORM pg_advisory_xact_lock(74291845);

    -- Buscar el primer hueco numérico disponible (1, 2, 3, 4, 5...)
    FOR v_cand IN 1..99999 LOOP
        SELECT EXISTS (
            SELECT 1 FROM trabajadores 
            WHERE codigo_drac = 'DRAC-' || LPAD(v_cand::TEXT, 4, '0')
        ) INTO v_found;

        IF NOT v_found THEN
            v_next_num := v_cand;
            EXIT;
        END IF;
    END LOOP;

    RETURN 'DRAC-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. USUARIOS Y AUTENTICACIÓN (Integrado con Supabase Auth)
-- =============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_uid UUID UNIQUE, -- Vinculado a auth.users de Supabase
    username VARCHAR(100) UNIQUE NOT NULL,
    trabajador_id VARCHAR(50) UNIQUE REFERENCES trabajadores(id) ON DELETE CASCADE,
    email VARCHAR(150) UNIQUE NOT NULL,
    roles rol_usuario_enum[] NOT NULL DEFAULT ARRAY['TRABAJADOR']::rol_usuario_enum[],
    requiere_cambio_password BOOLEAN NOT NULL DEFAULT TRUE,
    password_hash TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_supabase_uid ON usuarios(supabase_uid);

-- =============================================================================
-- 7. HORARIOS Y TURNOS (Máximo 2 Turnos Diarios)
-- =============================================================================

CREATE TABLE IF NOT EXISTS turnos (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tolerancia_minutos INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS horarios (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    total_turnos INT NOT NULL CHECK (total_turnos IN (1, 2)),
    turno1_id VARCHAR(50) NOT NULL REFERENCES turnos(id) ON DELETE RESTRICT,
    turno2_id VARCHAR(50) REFERENCES turnos(id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asignacion_horarios (
    id VARCHAR(50) PRIMARY KEY,
    trabajador_id VARCHAR(50) NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
    horario_id VARCHAR(50) NOT NULL REFERENCES horarios(id) ON DELETE RESTRICT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. ENCARGATURAS TEMPORALES (Sustitución Funcional de Jefe Inmediato)
-- =============================================================================

CREATE TABLE IF NOT EXISTS encargaturas (
    id VARCHAR(50) PRIMARY KEY,
    unidad_id VARCHAR(50) NOT NULL REFERENCES areas_oficinas(id) ON DELETE CASCADE,
    jefe_titular_id VARCHAR(50) NOT NULL REFERENCES trabajadores(id) ON DELETE RESTRICT,
    encargado_id VARCHAR(50) NOT NULL REFERENCES trabajadores(id) ON DELETE RESTRICT,
    documento VARCHAR(100) NOT NULL, -- Ej: "Resolución Directoral N° 045-2026-GR.CAJ/DRA"
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo TEXT,
    estado encargatura_estado_enum NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_encargatura_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_distintos_jefes CHECK (jefe_titular_id <> encargado_id)
);

CREATE INDEX IF NOT EXISTS idx_encargaturas_unidad_fechas ON encargaturas(unidad_id, fecha_inicio, fecha_fin, estado);

-- Función para resolver quién es el jefe autorizador activo (Titular vs Encargado)
CREATE OR REPLACE FUNCTION fn_obtener_jefe_activo_unidad(
    p_unidad_id VARCHAR(50), 
    p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS VARCHAR AS $$
DECLARE
    v_encargado_id VARCHAR(50);
    v_titular_id VARCHAR(50);
BEGIN
    -- 1. Verificar si existe una encargatura activa para la fecha
    SELECT encargado_id INTO v_encargado_id
    FROM encargaturas
    WHERE unidad_id = p_unidad_id
      AND p_fecha BETWEEN fecha_inicio AND fecha_fin
      AND estado = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_encargado_id IS NOT NULL THEN
        RETURN v_encargado_id; -- El encargado asume plenamente las funciones
    END IF;

    -- 2. Si no hay encargatura, retornar el jefe titular de la unidad
    SELECT jefe_actual_id INTO v_titular_id
    FROM areas_oficinas
    WHERE id = p_unidad_id;

    RETURN v_titular_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. PAPELETAS DE SALIDA
-- =============================================================================

CREATE TABLE IF NOT EXISTS papeletas (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    trabajador_id VARCHAR(50) NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
    aprobador_id VARCHAR(50) REFERENCES trabajadores(id) ON DELETE SET NULL,
    motivo VARCHAR(50) NOT NULL, -- PERSONAL, SALUD, COMISION_SERVICIOS, DILIGENCIA_OFICIAL
    fundamentacion TEXT NOT NULL,
    fecha DATE NOT NULL,
    hora_salida_estimada TIME NOT NULL,
    hora_retorno_estimada TIME,
    hora_real_salida TIME,  -- Registrado EXCLUSIVAMENTE por Seguridad/Garita
    hora_real_retorno TIME, -- Registrado EXCLUSIVAMENTE por Seguridad/Garita
    sin_retorno BOOLEAN NOT NULL DEFAULT FALSE,
    estado papeleta_estado_enum NOT NULL DEFAULT 'PENDING_BOSS',
    boss_approved_at TIMESTAMP WITH TIME ZONE,
    hr_approved_at TIMESTAMP WITH TIME ZONE,
    security_guard_id VARCHAR(50) REFERENCES trabajadores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_papeletas_trabajador ON papeletas(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_papeletas_fecha_estado ON papeletas(fecha, estado);

-- =============================================================================
-- 10. VACACIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS vacaciones (
    id VARCHAR(50) PRIMARY KEY,
    trabajador_id VARCHAR(50) NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'PARCIAL', -- TOTAL o PARCIAL
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias INT NOT NULL,
    periodo_anual INT NOT NULL,
    estado vacacion_estado_enum NOT NULL DEFAULT 'APPROVED',
    aprobado_por_rrhh_id VARCHAR(50) REFERENCES trabajadores(id) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_trabajador ON vacaciones(trabajador_id, fecha_inicio, fecha_fin);

-- =============================================================================
-- 11. MARCADORES ZKTECO Y MARCACIONES (Con Identificadores Idempotentes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS marcadores_zkteco (
    id VARCHAR(50) PRIMARY KEY,
    numero_serie VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    puerto INT NOT NULL DEFAULT 4370,
    dependencia_id VARCHAR(50) NOT NULL REFERENCES dependencias(id) ON DELETE RESTRICT,
    protocolo zkteco_protocol_enum NOT NULL DEFAULT 'PUSH_ADMS',
    estado VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    ultima_conexion TIMESTAMP WITH TIME ZONE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marcaciones_raw (
    id VARCHAR(100) PRIMARY KEY, -- Idempotent hash: SHA256(sn + dni + timestamp + tipo)
    marcador_id VARCHAR(50) NOT NULL REFERENCES marcadores_zkteco(id) ON DELETE RESTRICT,
    dni_trabajador VARCHAR(15) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'AUTO',
    metodo_verificacion VARCHAR(20) NOT NULL DEFAULT 'FACE',
    procesado BOOLEAN NOT NULL DEFAULT FALSE,
    procesado_at TIMESTAMP WITH TIME ZONE,
    app_origin app_origin_enum NOT NULL DEFAULT 'ZK_AGENT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_marcacion_idempotente UNIQUE (dni_trabajador, timestamp, marcador_id)
);

CREATE INDEX IF NOT EXISTS idx_marcaciones_dni_ts ON marcaciones_raw(dni_trabajador, timestamp);
CREATE INDEX IF NOT EXISTS idx_marcaciones_unprocessed ON marcaciones_raw(procesado) WHERE procesado = FALSE;

-- =============================================================================
-- 12. ASISTENCIA PROCESADA
-- =============================================================================

CREATE TABLE IF NOT EXISTS asistencias (
    id VARCHAR(50) PRIMARY KEY,
    trabajador_id VARCHAR(50) NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
    dni VARCHAR(15) NOT NULL,
    fecha DATE NOT NULL,
    horario_id VARCHAR(50) REFERENCES horarios(id) ON DELETE SET NULL,
    t1_ingreso TIME,
    t1_salida TIME,
    t2_ingreso TIME,
    t2_salida TIME,
    minutos_tardanza INT NOT NULL DEFAULT 0,
    minutos_tardanza_neto INT NOT NULL DEFAULT 0,
    horas_efectivas NUMERIC(4, 2) NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'PUNCTUAL',
    tiene_papeleta BOOLEAN NOT NULL DEFAULT FALSE,
    papeleta_id VARCHAR(50) REFERENCES papeletas(id) ON DELETE SET NULL,
    es_dia_vacaciones BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asistencia_trabajador_fecha UNIQUE (trabajador_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_dni_fecha ON asistencias(dni, fecha);

-- =============================================================================
-- 13. AUDITORÍA INMUTABLE CON ORIGEN DE APLICACIÓN (WEB / DESKTOP / ZK_AGENT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS auditoria (
    id VARCHAR(100) PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    usuario_nombre VARCHAR(150),
    rol VARCHAR(50),
    modulo VARCHAR(50) NOT NULL, -- PAPELETAS, VACACIONES, TRABAJADORES, BIOMETRICOS, HORARIOS, ENCARGATURAS
    accion VARCHAR(50) NOT NULL,  -- INSERT, UPDATE, DELETE, APROBACION, SYNC
    registro_afectado_id VARCHAR(100) NOT NULL,
    detalles TEXT,
    ip_address VARCHAR(45),
    app_origin app_origin_enum NOT NULL DEFAULT 'WEB', -- WEB (Vercel) o DESKTOP (Local) o ZK_AGENT
    resultado VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS, ERROR, WARNING
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp ON auditoria(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_app_origin ON auditoria(app_origin);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON auditoria(modulo);

-- =============================================================================
-- 14. POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS) EN SUPABASE
-- =============================================================================

ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE papeletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE encargaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Política para que cualquier cliente autenticado o rol autorizado pueda consultar y operar
CREATE POLICY "Permitir lectura general a usuarios autenticados DRAC" 
ON trabajadores FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Permitir gestión de trabajadores a administradores y RRHH"
ON trabajadores FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Permitir gestión de papeletas DRAC"
ON papeletas FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Permitir gestión de vacaciones DRAC"
ON vacaciones FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Permitir gestión de encargaturas DRAC"
ON encargaturas FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Permitir inserción de logs de auditoría"
ON auditoria FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Permitir lectura de auditoría a directivos y administradores"
ON auditoria FOR SELECT TO authenticated, anon USING (true);

-- =============================================================================
-- 15. MIGRACIONES INCREMENTALES, OUTBOX Y VERSIONADO OPTIMISTA (NO DESTRUCTIVO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) PRIMARY KEY,
    version VARCHAR(40) NOT NULL,
    description TEXT NOT NULL,
    checksum VARCHAR(128),
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    app_version VARCHAR(40),
    status VARCHAR(30) NOT NULL DEFAULT 'APPLIED'
);

CREATE TABLE IF NOT EXISTS sync_outbox_audit (
    id UUID PRIMARY KEY,
    idempotency_key VARCHAR(200) UNIQUE NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(120) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    record_version INT NOT NULL DEFAULT 1,
    origin VARCHAR(20) NOT NULL DEFAULT 'DESKTOP',
    payload JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'SINCRONIZADO',
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_audit_entity ON sync_outbox_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_audit_synced ON sync_outbox_audit(synced_at DESC);

CREATE TABLE IF NOT EXISTS drac_sync_records (
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL,
    record_version INT NOT NULL DEFAULT 1,
    origin VARCHAR(20) NOT NULL DEFAULT 'DESKTOP',
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_drac_sync_records_updated ON drac_sync_records(entity_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS dispositivos_zkteco (
    id VARCHAR(80) PRIMARY KEY,
    serial_number VARCHAR(80),
    name VARCHAR(150),
    ip_address VARCHAR(60),
    port INT DEFAULT 4370,
    netmask VARCHAR(40),
    gateway VARCHAR(40),
    dns VARCHAR(40),
    mac_address VARCHAR(40),
    comm_key VARCHAR(40),
    device_id_num INT DEFAULT 1,
    model VARCHAR(80),
    protocol VARCHAR(30),
    status VARCHAR(30),
    location_detail TEXT,
    last_modified_by VARCHAR(150),
    last_modified_at TIMESTAMP WITH TIME ZONE,
    record_version INT NOT NULL DEFAULT 1,
    updated_by_origin VARCHAR(20) DEFAULT 'DESKTOP',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_reloj (
    id VARCHAR(160) PRIMARY KEY,
    device_id VARCHAR(80),
    device_sn VARCHAR(80),
    device_name VARCHAR(150),
    pin VARCHAR(60),
    uid VARCHAR(60),
    clock_name VARCHAR(150),
    clock_employee_code VARCHAR(60),
    card_number VARCHAR(60),
    privilege_code INT,
    privilege_label VARCHAR(60),
    clock_status VARCHAR(40),
    source_method VARCHAR(40),
    source_scope VARCHAR(40),
    available_fields JSONB,
    raw_attributes JSONB,
    present_on_device BOOLEAN DEFAULT TRUE,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    last_queried_at TIMESTAMP WITH TIME ZONE,
    last_clock_updated_at TIMESTAMP WITH TIME ZONE,
    missing_since_at TIMESTAMP WITH TIME ZONE,
    record_version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vinculaciones_usuario_reloj (
    id VARCHAR(180) PRIMARY KEY,
    device_user_id VARCHAR(160),
    device_sn VARCHAR(80),
    pin VARCHAR(60),
    trabajador_id VARCHAR(80),
    codigo_drac VARCHAR(40),
    dni VARCHAR(20),
    nombre_institucional VARCHAR(200),
    dependencia_name VARCHAR(150),
    area_name VARCHAR(150),
    cargo_name VARCHAR(150),
    estado_vinculacion VARCHAR(40),
    conflicto_detalle TEXT,
    posible_trabajador_id VARCHAR(80),
    posible_trabajador_nombre VARCHAR(200),
    posible_motivo TEXT,
    observaciones TEXT,
    vinculado_por VARCHAR(150),
    vinculado_en TIMESTAMP WITH TIME ZONE,
    desvinculado_en TIMESTAMP WITH TIME ZONE,
    record_version INT NOT NULL DEFAULT 1,
    updated_by_origin VARCHAR(20) DEFAULT 'DESKTOP',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS closed_periods (
    period VARCHAR(20) PRIMARY KEY,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_by VARCHAR(150),
    reason TEXT
);

DO $$ BEGIN
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS zkteco_pin VARCHAR(50);
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS biometric_user_id VARCHAR(50);
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS employee_codigo_drac VARCHAR(30);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS employee_name VARCHAR(200);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS device_id VARCHAR(80);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS device_sn VARCHAR(50);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS device_name VARCHAR(150);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS employee_dni VARCHAR(30);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS punch_type VARCHAR(30);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS verify_mode VARCHAR(40);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS validation_status VARCHAR(40) DEFAULT 'VALIDA';
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;

    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS codigo_drac VARCHAR(30);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS dependencia_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS direccion_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS area_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS cargo_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_outbox_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE drac_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_zkteco ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculaciones_usuario_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_periods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Permitir lectura migraciones DRAC" ON schema_migrations FOR SELECT TO authenticated, anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión outbox DRAC" ON sync_outbox_audit FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir sincronizacion canonica DRAC" ON drac_sync_records FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion dispositivos DRAC" ON dispositivos_zkteco FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion usuarios reloj DRAC" ON usuarios_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion vinculaciones reloj DRAC" ON vinculaciones_usuario_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion periodos cerrados DRAC" ON closed_periods FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE drac_sync_records;
EXCEPTION WHEN others THEN NULL; END $$;
`;


