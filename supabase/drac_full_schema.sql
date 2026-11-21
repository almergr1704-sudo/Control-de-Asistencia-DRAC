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
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS device_sn VARCHAR(50);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS device_name VARCHAR(150);
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS validation_status VARCHAR(40) DEFAULT 'VALIDA';
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS punch_state INT DEFAULT 0;
    ALTER TABLE IF EXISTS marcaciones_raw ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'DIRECT_READ';
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
-- 4. POLÍTICAS RLS PARA TABLAS DE SINCRONIZACIÓN
-- =============================================================================
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_outbox_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Permitir lectura migraciones DRAC"
    ON schema_migrations FOR SELECT TO authenticated, anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión outbox DRAC"
    ON sync_outbox_audit FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 5. REGISTRO DE MIGRACIONES INCREMENTALES EN POSTGRESQL
-- =============================================================================
INSERT INTO schema_migrations (id, version, description, app_version, status)
VALUES
    ('001_baseline_schema_v1', '2026.01.01', 'Esquema institucional base DRAC - ZKTeco.', '1.0.0', 'APPLIED'),
    ('002_biometric_enrichment_fields', '2026.03.01', 'Campos de enriquecimiento oficial en marcaciones_raw y trabajadores.', '1.0.0', 'APPLIED'),
    ('003_sync_outbox_and_versioning', '2026.04.01', 'Columnas de versionamiento optimista, updated_by_origin y tabla sync_outbox_audit.', '1.0.0', 'APPLIED'),
    ('004_reconcile_config_directory', '2026.04.01', 'Consolidación no destructiva de estructura de datos Web <-> Desktop.', '1.0.0', 'APPLIED')
ON CONFLICT (id) DO NOTHING;
