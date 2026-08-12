import React from 'react';
import { ShieldCheck, Layers, Cpu, Database, CheckCircle2, Lock, GitBranch, Terminal } from 'lucide-react';

export const ArchitectureDoc: React.FC = () => {
  return (
    <div className="space-y-6 text-slate-200">
      {/* Executive Architecture Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Arquitectura Técnica Enterprise - HRMS Control de Asistencia &amp; WFM
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Especificación de Software en Clean Architecture, SOLID, OWASP Top 10 e Integración ZKTeco Push ADMS.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-800">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-xs font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Clean Architecture</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Desacoplamiento estricto entre Capa de Dominio (Entidades &amp; Reglas), Capa de Casos de Uso (Motor Asistencia &amp; FSM Papeleta) e Infraestructura (PostgreSQL, ZKTeco ADMS).
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>OWASP Security &amp; Audit</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Control RBAC granular, inmutabilidad de logs biométricos (<code className="text-cyan-300">marcaciones_raw</code>) y trazabilidad completa de firmas con timestamp y usuario actuante.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              <span>ZKTeco Real-Time Push</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Protocolo HTTP Push ADMS en listener `/iclock/cdata.php` con respuesta inmediata y tolerancia a fallos de red por almacenamiento local de búfer en dispositivo.
            </p>
          </div>
        </div>
      </div>

      {/* Layer Decomposition */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          Descomposición de Capas de Arquitectura (Clean Architecture)
        </h3>

        <div className="space-y-3 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-indigo-500/30">
            <h4 className="font-bold text-indigo-300 mb-1">1. Domain Layer (Capa de Dominio)</h4>
            <p className="text-slate-400 leading-relaxed">
              Contiene las reglas de negocio puras e invariantes. Define los conceptos de <strong>Áreas/Subáreas</strong> jerárquicas, <strong>Horarios de 1 ó 2 Turnos</strong> (Jornada Partida), <strong>Inmutabilidad de Fichajes</strong>, <strong>Vacaciones Totales/Parciales</strong> y la <strong>Máquina de Estados Finita (FSM) de Papeletas</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30">
            <h4 className="font-bold text-emerald-300 mb-1">2. Use Case Layer (Capa de Casos de Uso)</h4>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li><strong>ProcessAttendanceUseCase:</strong> Ejecuta el algoritmo de matching de 1 o 2 turnos, calcula tardanza neta aplicando margen de tolerancia y verifica excepciones de vacaciones/papeletas.</li>
              <li><strong>TransitionPapeletaUseCase:</strong> Valida el rol del usuario actuante (Jefe Inmediato para VoBo, RRHH para Aprobación Final, Garita para Salida/Retorno Real) y registra la traza de auditoría.</li>
              <li><strong>IngestRawPunchUseCase:</strong> Procesa el payload ZKTeco Push HTTP ADMS y lo persiste en staging inmutable.</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/30">
            <h4 className="font-bold text-cyan-300 mb-1">3. Infrastructure Layer (Capa de Infraestructura)</h4>
            <p className="text-slate-400 leading-relaxed">
              Adaptadores de base de datos PostgreSQL con Pool de conexiones, endpoints REST OpenAPI 3.0, exportador a archivos Microsoft Excel (.xlsx) e integración HTTP con dispositivos ZKTeco.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
