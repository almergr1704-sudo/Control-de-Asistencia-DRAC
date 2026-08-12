import React, { useState } from 'react';
import { API_ENDPOINTS_SPEC, ApiEndpointDoc } from '../data/apiDocs';
import { Code2, Play, Lock, Sparkles, Check, FileJson } from 'lucide-react';

export const ApiConsole: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpointDoc>(API_ENDPOINTS_SPEC[0]);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestEndpoint = () => {
    setIsLoading(true);
    setTimeout(() => {
      setApiResponse(JSON.stringify(selectedEndpoint.response200, null, 2));
      setIsLoading(false);
    }, 400);
  };

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    POST: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    PATCH: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    PUT: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    DELETE: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Especificación de API REST / OpenAPI 3.0 & Tester Cliente
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Endpoints documentados para consultas paginadas de asistencia, workflow de papeletas, ingesta ZKTeco y vacaciones.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Endpoint List Sidebar */}
        <div className="lg:col-span-5 space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Catálogo de Endpoints Disponibles
          </h3>
          {API_ENDPOINTS_SPEC.map((ep, idx) => {
            const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedEndpoint(ep);
                  setApiResponse(null);
                }}
                className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                      methodColors[ep.method]
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-xs font-semibold truncate">{ep.path}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{ep.summary}</p>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span className="truncate">{ep.rbacScope}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Endpoint Details & Interactive Tester */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded border ${
                  methodColors[selectedEndpoint.method]
                }`}
              >
                {selectedEndpoint.method}
              </span>
              <h3 className="font-mono text-sm font-bold text-white">{selectedEndpoint.path}</h3>
            </div>

            <p className="text-xs text-slate-300 mb-4">{selectedEndpoint.description}</p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Restricciones de Scope RBAC:</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">{selectedEndpoint.rbacScope}</p>
            </div>

            {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Parámetros de Consulta (Query Params)
                </h4>
                <div className="space-y-1">
                  {selectedEndpoint.parameters.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-indigo-300 font-semibold">{p.name}</span>
                        {p.required && <span className="text-[10px] text-rose-400 font-bold">REQUERIDO</span>}
                      </div>
                      <span className="text-[11px] text-slate-400">{p.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEndpoint.requestBody && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Cuerpo de la Petición (JSON Request Body)
                </h4>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300">
                  {JSON.stringify(selectedEndpoint.requestBody, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={handleTestEndpoint}
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>{isLoading ? 'Ejecutando Petición HTTP...' : 'Probar Endpoint en Tiempo Real (Simular Request)'}</span>
            </button>

            {apiResponse && (
              <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs font-mono text-emerald-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>HTTP 200 OK</span>
                  </span>
                  <span>Content-Type: application/json</span>
                </div>
                <pre className="font-mono text-[11px] text-emerald-200/90 overflow-x-auto max-h-60">
                  {apiResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
