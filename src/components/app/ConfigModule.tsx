import React, { useState } from 'react';
import { Settings, Shield, Clock, Building, CheckCircle2 } from 'lucide-react';

export const ConfigModule: React.FC = () => {
  const [institutionName, setInstitutionName] = useState('Dirección Regional de Agricultura Cajamarca (DRAC)');
  const [defaultTolerance, setDefaultTolerance] = useState(10);
  const [requireGaritaReturn, setRequireGaritaReturn] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 max-w-2xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          <span>Configuración Institucional DRAC</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Parámetros globales del sistema de control de asistencia y garita de vigilancia.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configuración institucional guardada correctamente.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Nombre de la Entidad</label>
          <input
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tolerancia por Defecto (Minutos)</label>
            <input
              type="number"
              min={0}
              max={60}
              value={defaultTolerance}
              onChange={(e) => setDefaultTolerance(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Aplicado a turnos sin tolerancia específica</span>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Control de Garita Obligatorio</label>
            <select
              value={requireGaritaReturn ? 'SI' : 'NO'}
              onChange={(e) => setRequireGaritaReturn(e.target.value === 'SI')}
              className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
            >
              <option value="SI">Sí, requiere marcar salida y retorno real</option>
              <option value="NO">No, opcional</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors"
          >
            Guardar Configuración
          </button>
        </div>
      </form>
    </div>
  );
};
