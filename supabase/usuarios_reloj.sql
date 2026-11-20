-- =============================================================================
-- MÓDULO: USUARIOS REGISTRADOS EN RELOJES BIOMÉTRICOS Y VINCULACIÓN INSTITUCIONAL
-- Sistema de Control de Asistencia y Marcaciones DRAC - ZKTeco
-- =============================================================================
-- Reglas de diseño:
--   1. Datos de origen del reloj (usuarios_reloj) separados de la vinculación institucional
--      (vinculaciones_usuario_reloj). Ninguna vinculación sobrescribe los datos originales del reloj
--      ni los datos institucionales en trabajadores.
--   2. Unicidad idempotente por (device_sn, pin) para evitar duplicidades y ambigüedades entre relojes.
--   3. Trazabilidad completa mediante historial_usuarios_reloj y consultas_usuarios_reloj.
-- =============================================================================

CREATE TABLE IF NOT EXISTS usuarios_reloj (
    id VARCHAR(120) PRIMARY KEY,
    device_id VARCHAR(50),
    device_sn VARCHAR(50) NOT NULL,
    device_name VARCHAR(150),
    pin VARCHAR(50) NOT NULL,
    uid INT,
    clock_name VARCHAR(150),
    clock_employee_code VARCHAR(50),
    card_number VARCHAR(50),
    privilege_code INT,
    privilege_label VARCHAR(50),
    clock_status VARCHAR(40),
    source_method VARCHAR(40) NOT NULL,
    source_scope VARCHAR(40) NOT NULL DEFAULT 'DIRECT_CLOCK',
    available_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    present_on_device BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_queried_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_clock_updated_at TIMESTAMP WITH TIME ZONE,
    missing_since_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_usuarios_reloj_sn_pin UNIQUE (device_sn, pin)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_reloj_sn ON usuarios_reloj(device_sn);
CREATE INDEX IF NOT EXISTS idx_usuarios_reloj_pin ON usuarios_reloj(pin);
CREATE INDEX IF NOT EXISTS idx_usuarios_reloj_present ON usuarios_reloj(present_on_device);

CREATE TABLE IF NOT EXISTS vinculaciones_usuario_reloj (
    id VARCHAR(120) PRIMARY KEY,
    device_user_id VARCHAR(120) NOT NULL REFERENCES usuarios_reloj(id) ON DELETE CASCADE,
    device_sn VARCHAR(50) NOT NULL,
    pin VARCHAR(50) NOT NULL,
    trabajador_id VARCHAR(50) REFERENCES trabajadores(id) ON DELETE SET NULL,
    codigo_drac VARCHAR(30),
    dni VARCHAR(15),
    nombre_institucional VARCHAR(200),
    dependencia_name VARCHAR(150),
    area_name VARCHAR(150),
    cargo_name VARCHAR(150),
    estado_vinculacion VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE_VINCULACION'
        CHECK (estado_vinculacion IN (
            'VINCULADO',
            'REGISTRADO',
            'PENDIENTE_VINCULACION',
            'POSIBLE_COINCIDENCIA',
            'REVISAR',
            'INACTIVO'
        )),
    link_type VARCHAR(30),
    conflicto_detalle TEXT,
    posible_trabajador_id VARCHAR(50),
    posible_trabajador_nombre VARCHAR(200),
    posible_motivo VARCHAR(150),
    observaciones TEXT,
    vinculado_por VARCHAR(150),
    vinculado_en TIMESTAMP WITH TIME ZONE,
    desvinculado_en TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_vinculacion_device_user UNIQUE (device_user_id),
    CONSTRAINT uq_vinculacion_sn_pin UNIQUE (device_sn, pin)
);

CREATE INDEX IF NOT EXISTS idx_vinculacion_trabajador ON vinculaciones_usuario_reloj(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_vinculacion_estado ON vinculaciones_usuario_reloj(estado_vinculacion);
CREATE INDEX IF NOT EXISTS idx_vinculacion_sn_pin ON vinculaciones_usuario_reloj(device_sn, pin);

CREATE TABLE IF NOT EXISTS historial_usuarios_reloj (
    id VARCHAR(120) PRIMARY KEY,
    device_user_id VARCHAR(120) NOT NULL REFERENCES usuarios_reloj(id) ON DELETE CASCADE,
    device_sn VARCHAR(50) NOT NULL,
    pin VARCHAR(50) NOT NULL,
    tipo_evento VARCHAR(60) NOT NULL,
    trabajador_anterior_id VARCHAR(50),
    trabajador_nuevo_id VARCHAR(50),
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    observacion TEXT,
    usuario_operador VARCHAR(150),
    rol_operador VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historial_usuario_reloj_uid ON historial_usuarios_reloj(device_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_usuario_reloj_sn_pin ON historial_usuarios_reloj(device_sn, pin);

CREATE TABLE IF NOT EXISTS consultas_usuarios_reloj (
    id VARCHAR(120) PRIMARY KEY,
    device_id VARCHAR(50),
    device_sn VARCHAR(50),
    device_name VARCHAR(150),
    metodo VARCHAR(40) NOT NULL,
    alcance VARCHAR(40) NOT NULL,
    exito BOOLEAN NOT NULL DEFAULT FALSE,
    mensaje TEXT,
    total_recuperados INT NOT NULL DEFAULT 0,
    nuevos INT NOT NULL DEFAULT 0,
    new_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    actualizados INT NOT NULL DEFAULT 0,
    sin_cambios INT NOT NULL DEFAULT 0,
    no_encontrados_en_reloj INT NOT NULL DEFAULT 0,
    reaparecidos INT NOT NULL DEFAULT 0,
    pendientes_vinculacion INT NOT NULL DEFAULT 0,
    vinculados INT NOT NULL DEFAULT 0,
    ejecutado_por VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consultas_usuarios_reloj_fecha ON consultas_usuarios_reloj(created_at DESC);

-- =============================================================================
-- POLÍTICAS RLS EN SUPABASE (Compatible con clientes autenticados y anon DRAC)
-- =============================================================================
ALTER TABLE usuarios_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculaciones_usuario_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_usuarios_reloj ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas_usuarios_reloj ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión de usuarios_reloj DRAC"
    ON usuarios_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión de vinculaciones_usuario_reloj DRAC"
    ON vinculaciones_usuario_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión de historial_usuarios_reloj DRAC"
    ON historial_usuarios_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir gestión de consultas_usuarios_reloj DRAC"
    ON consultas_usuarios_reloj FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
