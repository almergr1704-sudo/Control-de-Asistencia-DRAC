-- =============================================================================
-- ESQUEMA INTEGRAL INCREMENTAL Y NO DESTRUCTIVO - SISTEMA DRAC ZKTECO
-- Versión de Esquema: 2026.04.01
-- Garantía: Cero comandos destructivos (sin DROP TABLE, sin TRUNCATE).
-- Diseñado para sincronización bidireccional Web (Vercel) <-> Escritorio (Electron).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. CONTROL DE MIGRACIONES INCREMENTALES Y VERSIONADO DE ESQUEMA
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

-- =============================================================================
-- 2. COLA OUTBOX CENTRAL / TRAZABILIDAD DE SINCRONIZACIÓN E IDEMPOTENCIA
-- =============================================================================
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

-- =============================================================================
-- 2B. TABLA CANÓNICA DE SINCRONIZACIÓN SIN PÉRDIDA (WEB <-> DESKTOP)
-- =============================================================================
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

-- =============================================================================
-- 3. ACTUALIZACIONES INCREMENTALES DE COLUMNAS EN TABLAS EXISTENTES
-- =============================================================================
DO $$ BEGIN
    -- Trabajadores: pin biométrico, versión optimista, origen
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS zkteco_pin VARCHAR(50);
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS biometric_user_id VARCHAR(50);
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';
    ALTER TABLE IF EXISTS trabajadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    -- Dispositivos ZKTeco
    ALTER TABLE IF EXISTS dispositivos_zkteco ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS dispositivos_zkteco ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';

    -- Marcaciones crudas: trazabilidad oficial sin alterar fecha/hora original
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
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS punch_state INT DEFAULT 0;
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'DIRECT_READ';
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS raw_payload JSONB;
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    -- Asistencias consolidadas
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS codigo_drac VARCHAR(30);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS dependencia_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS direccion_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS area_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS cargo_nombre VARCHAR(150);
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS asistencias ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';

    -- Papeletas y Vacaciones
    ALTER TABLE IF EXISTS papeletas ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS papeletas ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';
    ALTER TABLE IF EXISTS vacaciones ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS vacaciones ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';
    ALTER TABLE IF EXISTS vacaciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    -- Horarios, Turnos y Asignaciones
    ALTER TABLE IF EXISTS horarios ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS horarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE IF EXISTS turnos ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS turnos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE IF EXISTS asignacion_horarios ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS asignacion_horarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    -- Vinculaciones biométricas
    ALTER TABLE IF EXISTS vinculaciones_usuario_reloj ADD COLUMN IF NOT EXISTS record_version INT NOT NULL DEFAULT 1;
    ALTER TABLE IF EXISTS vinculaciones_usuario_reloj ADD COLUMN IF NOT EXISTS updated_by_origin VARCHAR(20) DEFAULT 'WEB';
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- =============================================================================
-- 4. POLÍTICAS RLS Y REALTIME PARA SINCRONIZACIÓN WEB <-> DESKTOP
-- =============================================================================
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_outbox_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE drac_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_zkteco ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculaciones_usuario_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_periods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Permitir lectura migraciones DRAC"
    ON schema_migrations FOR SELECT TO authenticated, anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión outbox DRAC"
    ON sync_outbox_audit FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir sincronizacion canonica DRAC"
    ON drac_sync_records FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion dispositivos DRAC"
    ON dispositivos_zkteco FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion usuarios reloj DRAC"
    ON usuarios_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion vinculaciones reloj DRAC"
    ON vinculaciones_usuario_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestion periodos cerrados DRAC"
    ON closed_periods FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE drac_sync_records;
EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================================================
-- 5. REGISTRO DE MIGRACIONES INCREMENTALES EN POSTGRESQL
-- =============================================================================
INSERT INTO schema_migrations (id, version, description, app_version, status)
VALUES
    ('001_baseline_schema_v1', '2026.01.01', 'Esquema institucional base DRAC - ZKTeco.', '1.0.0', 'APPLIED'),
    ('002_biometric_enrichment_fields', '2026.03.01', 'Campos de enriquecimiento oficial en marcaciones_raw y trabajadores.', '1.0.0', 'APPLIED'),
    ('003_sync_outbox_and_versioning', '2026.04.01', 'Columnas de versionamiento optimista, updated_by_origin y tabla sync_outbox_audit.', '1.0.0', 'APPLIED'),
    ('004_reconcile_config_directory', '2026.04.01', 'Consolidación no destructiva de estructura de datos Web <-> Desktop.', '1.0.0', 'APPLIED'),
    ('005_canonical_cloud_sync', '2026.05.01', 'Tabla canónica drac_sync_records con Realtime para sincronización bidireccional sin pérdida Web <-> Escritorio.', '1.0.0', 'APPLIED')
ON CONFLICT (id) DO NOTHING;
