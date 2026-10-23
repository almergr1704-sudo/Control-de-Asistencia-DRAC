import React, { useState } from 'react';
import { Clock, ShieldCheck, AlertTriangle, CheckCircle2, Info, Calculator } from 'lucide-react';

export const ShiftsSchedulesModule: React.FC = () => {
  // Pure in-memory calculator state (no DB persistence)
  const [calcTime, setCalcTime] = useState('08:08');
  const [calcShift, setCalcShift] = useState<'T1' | 'T2'>('T1');

  // Evaluate rule strictly in memory
  const evaluation = React.useMemo(() => {
    const [h, m] = calcTime.split(':').map(Number);
    const totalMinutes = h * 60 + m;

    if (calcShift === 'T1') {
      const scheduledMinutes = 8 * 60; // 08:00
      const toleranceMinutes = scheduledMinutes + 10; // 08:10

      if (totalMinutes <= scheduledMinutes) {
        return { status: 'PUNCTUAL', tardiness: 0, netTardiness: 0, desc: 'Puntual (Sin tardanza)' };
      } else if (totalMinutes <= toleranceMinutes) {
        return { status: 'TOLERANCE', tardiness: totalMinutes - scheduledMinutes, netTardiness: 0, desc: 'Dentro del periodo de tolerancia (10 min)' };
      } else {
        return {
          status: 'LATE',
          tardiness: totalMinutes - scheduledMinutes,
          netTardiness: totalMinutes - toleranceMinutes,
          desc: `Tardanza computada (${totalMinutes - toleranceMinutes} min netos)`,
        };
      }
    } else {
      const scheduledMinutes = 14 * 60; // 14:00
      const toleranceMinutes = scheduledMinutes + 5; // 14:05

      if (totalMinutes <= scheduledMinutes) {
        return { status: 'PUNCTUAL', tardiness: 0, netTardiness: 0, desc: 'Puntual (Sin tardanza)' };
      } else if (totalMinutes <= toleranceMinutes) {
        return { status: 'TOLERANCE', tardiness: totalMinutes - scheduledMinutes, netTardiness: 0, desc: 'Dentro del periodo de tolerancia (5 min)' };
      } else {
        return {
          status: 'LATE',
          tardiness: totalMinutes - scheduledMinutes,
          netTardiness: totalMinutes - toleranceMinutes,
          desc: `Tardanza computada (${totalMinutes - toleranceMinutes} min netos)`,
        };
      }
    }
  }, [calcTime, calcShift]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
            <Clock className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">Turnos Institucionales y Tolerancias (RIS DRAC)</h2>
            <p className="text-xs text-slate-400">
              Configuración oficial de la jornada laboral institucional en dos turnos diarios según Reglamento Interno de Servidores Civiles.
            </p>
          </div>
        </div>
      </div>

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Turno 1 */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span>Turno 1: Jornada de la Mañana</span>
              </h3>
              <span className="text-xs text-slate-400">Lunes a Viernes</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
              5.0 Horas
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Hora Programada de Entrada</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">08:00 hrs</span>
              <span className="text-[10px] text-emerald-400">Tolerancia hasta 08:10</span>
            </div>

            <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Hora Programada de Salida</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">13:00 hrs</span>
              <span className="text-[10px] text-slate-400">Inicio de refrigerio</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
            <strong className="text-slate-300 block">Regla de Marcación:</strong>
            <p className="text-[11px]">
              Marcaciones entre 08:01 y 08:10 se consideran toleradas. A partir de las 08:11 se genera descuento por tardanza efectiva.
            </p>
          </div>
        </div>

        {/* Turno 2 */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <span>Turno 2: Jornada de la Tarde</span>
              </h3>
              <span className="text-xs text-slate-400">Lunes a Viernes</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
              3.0 Horas
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Hora Programada de Retorno</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">14:00 hrs</span>
              <span className="text-[10px] text-indigo-400">Tolerancia hasta 14:05</span>
            </div>

            <div className="p-3 bg-[#090A0D] border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Hora Programada de Salida</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">17:00 hrs</span>
              <span className="text-[10px] text-slate-400">Fin de jornada diaria (8h)</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
            <strong className="text-slate-300 block">Refrigerio Institucional:</strong>
            <p className="text-[11px]">
              El intervalo de 13:00 a 14:00 hrs es tiempo de refrigerio no computable como trabajo efectivo según D.L. 276 y SERVIR.
            </p>
          </div>
        </div>
      </div>

      {/* Pure In-Memory Interactive Rule Tester (Zero Persistence) */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Calculator className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="font-bold text-sm text-white">Calculadora Pedagógica de Tolerancia RIS (En Memoria)</h3>
            <p className="text-xs text-slate-400">
              Herramienta de consulta para verificar cómo evalúa el sistema una hora de marcación. No guarda ni altera registros en la base de datos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Turno:</label>
            <select
              value={calcShift}
              onChange={(e) => setCalcShift(e.target.value as 'T1' | 'T2')}
              className="bg-slate-900 border border-slate-800 text-white rounded px-3 py-1.5 outline-none font-mono text-xs"
            >
              <option value="T1">Turno 1 (08:00 - Tol. 10m)</option>
              <option value="T2">Turno 2 (14:00 - Tol. 5m)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Hora a probar:</label>
            <input
              type="time"
              value={calcTime}
              onChange={(e) => setCalcTime(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-white rounded px-3 py-1.5 outline-none font-mono text-xs"
            />
          </div>

          <div className="p-2.5 rounded-lg border flex items-center gap-2 flex-1 min-w-[280px] bg-slate-900/60 border-slate-800">
            {evaluation.status === 'PUNCTUAL' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {evaluation.status === 'TOLERANCE' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
            {evaluation.status === 'LATE' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            <span className="text-slate-200 font-medium">{evaluation.desc}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
