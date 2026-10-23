import React from 'react';
import { Cpu, Server, Wifi, ShieldCheck, Database, Radio, BookOpen, Layers } from 'lucide-react';

export const ZkTecoSpec: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">Especificación Técnica ZKTeco G3-id y Protocolo ADMS</h2>
            <p className="text-xs text-slate-400">
              Documentación técnica de hardware, protocolos de comunicación dual (TCP 4370 y HTTP PUSH) y diagrama de estados.
            </p>
          </div>
        </div>
      </div>

      {/* Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Terminal ZKTeco G3-id */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Terminal Biométrico ZKTeco G3-id</span>
          </h3>

          <div className="space-y-2 text-slate-300">
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Número de Serie Oficial:</span>
              <span className="font-mono font-bold text-white">AEH2223460040</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Dirección MAC Hardware:</span>
              <span className="font-mono text-slate-200">00:17:61:10:74:7F</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">IP LAN / Subred:</span>
              <span className="font-mono text-slate-200">192.168.1.180 / 24</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Puerto Socket TCP:</span>
              <span className="font-mono text-emerald-400 font-bold">4370</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Modalidades Biométricas:</span>
              <span className="text-slate-200">Facial (Luz Visible) + Huella SilkID + RFID</span>
            </div>
          </div>
        </div>

        {/* ADMS Protocol Architecture */}
        <div className="bg-[#0F1115] border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Arquitectura ADMS / Push Nativa DRAC</span>
          </h3>

          <div className="space-y-2 text-slate-300">
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Servicio Escucha HTTP:</span>
              <span className="font-mono text-emerald-400 font-bold">Puerto 3000</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Endpoints Principales:</span>
              <span className="font-mono text-indigo-300">/api/zkteco/push | /iclock/cdata</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Idempotencia:</span>
              <span className="text-emerald-400 font-medium">Clave compuesta SN + PIN + Timestamp</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Respuesta Servidor:</span>
              <span className="font-mono text-slate-200">HTTP 200 "OK: [N]"</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between">
              <span className="text-slate-400">Integridad de Datos:</span>
              <span className="text-emerald-400 font-medium">100% Marcaciones Reales Físicas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
