import React, { useState } from 'react';
import { POSTGRES_DDL_SQL } from '../data/ddlSql';
import { Copy, Check, Database, Key, Table, Layers, FileCode, Search, Sparkles } from 'lucide-react';

export const ERDViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'VISUAL_ERD' | 'DDL_SQL' | 'ARCHITECTURE_SUMMARY'>('VISUAL_ERD');
  const [searchTerm, setSearchTerm] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(POSTGRES_DDL_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tables = [
    {
      name: 'areas',
      domain: 'Organizacional',
      description: 'Estructura jerárquica padre-hijo para Áreas y Subáreas',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'code', type: 'VARCHAR(20) UNIQUE', isKey: false },
        { name: 'name', type: 'VARCHAR(100)', isKey: false },
        { name: 'parent_area_id', type: 'UUID (FK -> areas.id)', isFk: true },
        { name: 'created_at', type: 'TIMESTAMP', isKey: false },
      ],
    },
    {
      name: 'empleados',
      domain: 'Organizacional',
      description: 'Colaboradores con asignación a Área, Jefe Inmediato y RRHH',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'dni', type: 'VARCHAR(15) UNIQUE', isKey: false },
        { name: 'first_name', type: 'VARCHAR(100)', isKey: false },
        { name: 'last_name', type: 'VARCHAR(100)', isKey: false },
        { name: 'area_id', type: 'UUID (FK -> areas.id)', isFk: true },
        { name: 'subarea_id', type: 'UUID (FK -> areas.id)', isFk: true },
        { name: 'supervisor_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'hr_contact_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'role', type: 'ENUM (EMPLOYEE, SUPERVISOR, HR_ADMIN, SECURITY_GUARD)', isKey: false },
        { name: 'hire_date', type: 'DATE', isKey: false },
      ],
    },
    {
      name: 'turnos',
      domain: 'Tiempos',
      description: 'Tramos continuos de trabajo con horario de entrada, salida y minutos de tolerancia',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'code', type: 'VARCHAR(20) UNIQUE', isKey: false },
        { name: 'name', type: 'VARCHAR(100)', isKey: false },
        { name: 'start_time', type: 'TIME (e.g. 08:00)', isKey: false },
        { name: 'end_time', type: 'TIME (e.g. 13:00)', isKey: false },
        { name: 'tolerance_minutes', type: 'INT (DEFAULT 10)', isKey: false },
      ],
    },
    {
      name: 'horarios',
      domain: 'Tiempos',
      description: 'Jornada diaria del empleado con regla estricta: 1 o 2 Turnos Laborales',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'code', type: 'VARCHAR(20) UNIQUE', isKey: false },
        { name: 'name', type: 'VARCHAR(100)', isKey: false },
        { name: 'turn_count', type: 'INT CHECK (turn_count IN (1, 2))', isKey: false },
        { name: 'working_days', type: 'JSONB (["MON", "TUE", ...])', isKey: false },
      ],
    },
    {
      name: 'horario_turnos',
      domain: 'Tiempos',
      description: 'Composición relacional de Horarios con Turnos (Turno 1 y Turno 2)',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'horario_id', type: 'UUID (FK -> horarios.id)', isFk: true },
        { name: 'turno_id', type: 'UUID (FK -> turnos.id)', isFk: true },
        { name: 'turn_order', type: 'INT CHECK (turn_order IN (1, 2))', isKey: false },
      ],
    },
    {
      name: 'dispositivos_zkteco',
      domain: 'Biométricos',
      description: 'Registro CRUD de marcadores biométricos ZKTeco en red',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'serial_number', type: 'VARCHAR(50) UNIQUE', isKey: false },
        { name: 'name', type: 'VARCHAR(100)', isKey: false },
        { name: 'ip_address', type: 'VARCHAR(45)', isKey: false },
        { name: 'port', type: 'INT (DEFAULT 4370)', isKey: false },
        { name: 'protocol', type: 'ENUM (PUSH_ADMS, UDP, TCP)', isKey: false },
        { name: 'area_id', type: 'UUID (FK -> areas.id)', isFk: true },
      ],
    },
    {
      name: 'marcaciones_raw (punch_logs)',
      domain: 'Biométricos',
      description: 'Staging inmutable para fichajes recibidos por protocolo Push ADMS',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'device_id', type: 'UUID (FK -> dispositivos_zkteco.id)', isFk: true },
        { name: 'employee_dni', type: 'VARCHAR(15)', isKey: false },
        { name: 'timestamp', type: 'TIMESTAMP WITH TIME ZONE', isKey: false },
        { name: 'verify_mode', type: 'ENUM (FINGERPRINT, FACE, PALM, CARD)', isKey: false },
        { name: 'processed', type: 'BOOLEAN DEFAULT FALSE', isKey: false },
      ],
    },
    {
      name: 'papeletas_salida',
      domain: 'Permisos',
      description: 'Solicitud de permisos dentro de la jornada con workflow y control de Garita',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'code', type: 'VARCHAR(30) UNIQUE', isKey: false },
        { name: 'employee_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'supervisor_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'motivo', type: 'ENUM (PERSONAL, SALUD_MEDICA, COMISION...)', isKey: false },
        { name: 'fecha', type: 'DATE', isKey: false },
        { name: 'hora_estimada_salida', type: 'TIME', isKey: false },
        { name: 'hora_estimada_retorno', type: 'TIME', isKey: false },
        { name: 'hora_real_salida', type: 'TIME (Marcado en Garita)', isKey: false },
        { name: 'hora_real_retorno', type: 'TIME (Marcado en Garita)', isKey: false },
        { name: 'status', type: 'ENUM (PENDING_BOSS, APPROVED, COMPLETED...)', isKey: false },
      ],
    },
    {
      name: 'auditoria_papeletas',
      domain: 'Permisos',
      description: 'Trazabilidad e inmutabilidad de firmas y cambios de estado en papeletas',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'papeleta_id', type: 'UUID (FK -> papeletas_salida.id)', isFk: true },
        { name: 'previous_status', type: 'ENUM', isKey: false },
        { name: 'new_status', type: 'ENUM', isKey: false },
        { name: 'action_by_user_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'created_at', type: 'TIMESTAMP', isKey: false },
      ],
    },
    {
      name: 'vacaciones',
      domain: 'Vacaciones',
      description: 'Asignación Total (período de ley) o Parcial (fraccionada por días)',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'employee_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'tipo', type: 'ENUM (TOTAL, PARCIAL)', isKey: false },
        { name: 'start_date', type: 'DATE', isKey: false },
        { name: 'end_date', type: 'DATE', isKey: false },
        { name: 'total_days', type: 'INT', isKey: false },
      ],
    },
    {
      name: 'asistencia_procesada',
      domain: 'Consolidado',
      description: 'Cálculo final de asistencia, tardanzas por turno 1/2 y exención de papeleta/vacaciones',
      columns: [
        { name: 'id', type: 'UUID (PK)', isKey: true },
        { name: 'employee_id', type: 'UUID (FK -> empleados.id)', isFk: true },
        { name: 'fecha', type: 'DATE', isKey: false },
        { name: 't1_tardiness_minutes', type: 'INT', isKey: false },
        { name: 't2_tardiness_minutes', type: 'INT', isKey: false },
        { name: 'net_tardiness_minutes', type: 'INT', isKey: false },
        { name: 'status', type: 'ENUM (PUNCTUAL, LATE, ABSENT, VACATION...)', isKey: false },
      ],
    },
  ];

  const filteredTables = tables.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Controls & Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">
                Modelo de Base de Datos PostgreSQL (ERD & DDL)
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Esquema relacional de 11+ tablas optimizadas para alta concurrencia, inmutabilidad de logs biométricos y auditoría de papeletas.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('VISUAL_ERD')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'VISUAL_ERD'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              Diagrama ERD Interactivo
            </button>
            <button
              onClick={() => setActiveTab('DDL_SQL')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'DDL_SQL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-4 h-4" />
              Código DDL SQL
            </button>
          </div>
        </div>

        {activeTab === 'VISUAL_ERD' && (
          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar tabla, dominio o columna..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 text-white border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Visual ERD Card Grid */}
      {activeTab === 'VISUAL_ERD' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTables.map((t) => (
            <div
              key={t.name}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-mono text-sm font-bold text-white tracking-tight">
                      {t.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {t.domain}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                  {t.description}
                </p>

                <div className="border-t border-slate-800/80 pt-2 space-y-1.5">
                  {t.columns.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-800/40"
                    >
                      <div className="flex items-center gap-1.5">
                        {c.isKey ? (
                          <Key className="w-3 h-3 text-amber-400" />
                        ) : c.isFk ? (
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        )}
                        <span className="font-mono text-slate-200">{c.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{c.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Relaciones FK activas</span>
                <span className="font-mono text-indigo-400">PostgreSQL 15+</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DDL SQL Viewer & Copy */}
      {activeTab === 'DDL_SQL' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-semibold text-slate-200">
                postgres_hrms_schema.sql (11 Tables, FKs, Indexes & Triggers)
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar DDL SQL</span>
                </>
              )}
            </button>
          </div>

          <div className="p-5 overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-800">
            <pre className="font-mono text-xs text-indigo-200/90 leading-relaxed">
              {POSTGRES_DDL_SQL}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
