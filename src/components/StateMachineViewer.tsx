import React, { useState } from 'react';
import { PapeletaStatus } from '../types';
import { GitMerge, ArrowRight, CheckCircle2, XCircle, Clock, ShieldCheck, UserCheck, Play } from 'lucide-react';

export const StateMachineViewer: React.FC = () => {
  const [activeSimState, setActiveSimState] = useState<PapeletaStatus>('DRAFT');
  const [simLog, setSimLog] = useState<string[]>([
    '08:00:00 - Estado Inicial: DRAFT (Borrador por Empleado)',
  ]);

  const transitions = [
    {
      from: 'DRAFT',
      action: 'Enviar Solicitud',
      role: 'EMPLOYEE',
      to: 'PENDING_BOSS',
      condition: 'Empleado completa motivo, fecha y horas estimadas.',
    },
    {
      from: 'PENDING_BOSS',
      action: 'Otorgar VoBo',
      role: 'SUPERVISOR',
      to: 'PENDING_HR',
      condition: 'Jefe Inmediato valida carga operativa de la jornada y firma.',
    },
    {
      from: 'PENDING_BOSS',
      action: 'Rechazar Papeleta',
      role: 'SUPERVISOR',
      to: 'REJECTED',
      condition: 'Jefe Inmediato rechaza solicitud con comentario explicativo.',
    },
    {
      from: 'PENDING_HR',
      action: 'Aprobación Institucional',
      role: 'HR_ADMIN',
      to: 'APPROVED',
      condition: 'RRHH verifica saldo legal de permisos y otorga visado final.',
    },
    {
      from: 'PENDING_HR',
      action: 'Rechazar Papeleta',
      role: 'HR_ADMIN',
      to: 'REJECTED',
      condition: 'RRHH identifica inconsistencias o falta de justificación.',
    },
    {
      from: 'APPROVED',
      action: 'Marcar Salida Real',
      role: 'SECURITY_GUARD',
      to: 'IN_OUTING',
      condition: 'Vigilante registra hora física de salida en garita.',
    },
    {
      from: 'IN_OUTING',
      action: 'Marcar Retorno Real',
      role: 'SECURITY_GUARD',
      to: 'COMPLETED',
      condition: 'Vigilante registra hora física de reingreso a la empresa.',
    },
  ];

  const handleSimStep = (nextState: PapeletaStatus, actionName: string, roleName: string) => {
    setActiveSimState(nextState);
    const time = new Date().toLocaleTimeString();
    setSimLog((prev) => [
      `${time} - Transición ejecutada: [${actionName}] por [${roleName}] -> Nuevo Estado: ${nextState}`,
      ...prev,
    ]);
  };

  const handleResetSim = () => {
    setActiveSimState('DRAFT');
    setSimLog(['08:00:00 - Estado Inicial: DRAFT (Borrador por Empleado)']);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Máquina de Estados Finita (FSM) - Papeleta de Salida
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Trazabilidad estricta de aprobación en 2 niveles (Jefe Inmediato + RRHH) y control en garita por Vigilancia.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Workflow Steps */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          Flujo Secuencial Aprobatorio & Registro Garita
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative">
          {[
            { status: 'DRAFT', title: '1. Solicitud', actor: 'Empleado', color: 'border-slate-700 bg-slate-950 text-slate-300' },
            { status: 'PENDING_BOSS', title: '2. VoBo Jefe', actor: 'Jefe Inmediato', color: 'border-amber-500/50 bg-amber-950/20 text-amber-300' },
            { status: 'PENDING_HR', title: '3. Aprobación HR', actor: 'RRHH Admin', color: 'border-indigo-500/50 bg-indigo-950/20 text-indigo-300' },
            { status: 'APPROVED', title: '4. Aprobada', actor: 'Apta para Garita', color: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' },
            { status: 'IN_OUTING', title: '5. En Salida', actor: 'Garita Salida Real', color: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300' },
            { status: 'COMPLETED', title: '6. Completada', actor: 'Garita Retorno Real', color: 'border-purple-500/50 bg-purple-950/20 text-purple-300' },
          ].map((s, idx) => (
            <div key={s.status} className="flex flex-col items-center text-center">
              <div className={`w-full p-3.5 rounded-xl border font-mono text-xs font-bold ${s.color} shadow-sm`}>
                <div>{s.title}</div>
                <div className="text-[10px] font-sans text-slate-400 mt-1">{s.actor}</div>
              </div>
              {idx < 5 && (
                <ArrowRight className="w-4 h-4 text-slate-600 my-2 md:rotate-0 rotate-90" />
              )}
            </div>
          ))}
        </div>

        {/* State Transition Simulator */}
        <div className="mt-8 pt-6 border-t border-slate-800 bg-slate-950 p-5 rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm text-white">Simulador Interactivo de Transiciones de Estado</h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Estado Actual: <span className="font-mono text-emerald-400 font-bold">{activeSimState}</span>
              </p>
            </div>
            <button
              onClick={handleResetSim}
              className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
            >
              Reiniciar Simulador
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {activeSimState === 'DRAFT' && (
              <button
                onClick={() => handleSimStep('PENDING_BOSS', 'Enviar Solicitud', 'EMPLEADO')}
                className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Enviar Solicitud &rarr; PENDING_BOSS</span>
              </button>
            )}

            {activeSimState === 'PENDING_BOSS' && (
              <>
                <button
                  onClick={() => handleSimStep('PENDING_HR', 'Otorgar VoBo Jefe', 'SUPERVISOR')}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Otorgar VoBo &rarr; PENDING_HR</span>
                </button>
                <button
                  onClick={() => handleSimStep('REJECTED', 'Rechazar por Carga Operativa', 'SUPERVISOR')}
                  className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rechazar &rarr; REJECTED</span>
                </button>
              </>
            )}

            {activeSimState === 'PENDING_HR' && (
              <>
                <button
                  onClick={() => handleSimStep('APPROVED', 'Aprobación Final RRHH', 'HR_ADMIN')}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Aprobar RRHH &rarr; APPROVED</span>
                </button>
                <button
                  onClick={() => handleSimStep('REJECTED', 'Rechazar RRHH', 'HR_ADMIN')}
                  className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rechazar &rarr; REJECTED</span>
                </button>
              </>
            )}

            {activeSimState === 'APPROVED' && (
              <button
                onClick={() => handleSimStep('IN_OUTING', 'Registrar Salida Garita (10:32)', 'SECURITY_GUARD')}
                className="px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Marcar Salida Real Garita &rarr; IN_OUTING</span>
              </button>
            )}

            {activeSimState === 'IN_OUTING' && (
              <button
                onClick={() => handleSimStep('COMPLETED', 'Registrar Retorno Garita (11:55)', 'SECURITY_GUARD')}
                className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Marcar Retorno Real Garita &rarr; COMPLETED</span>
              </button>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl font-mono text-[11px] text-slate-300 space-y-1 max-h-36 overflow-y-auto">
            {simLog.map((log, idx) => (
              <div key={idx} className="text-slate-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transition Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 font-bold text-xs text-white uppercase tracking-wider">
          Tabla de Transiciones de Estado y Reglas de Negocio
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Estado Origen</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Rol Autorizado</th>
                <th className="px-4 py-3">Estado Destino</th>
                <th className="px-4 py-3">Condición de Guardián</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {transitions.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono font-bold text-indigo-300">{t.from}</td>
                  <td className="px-4 py-2.5 font-medium text-white">{t.action}</td>
                  <td className="px-4 py-2.5 font-mono text-emerald-400">{t.role}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-cyan-300">{t.to}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-[11px]">{t.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
