import React, { useState } from 'react';
import { Cpu, Wifi, Check, Play, Zap } from 'lucide-react';
import { parseZkTecoPushBody } from '../utils/zktecoEngine';

export const ZkTecoSpec: React.FC = () => {
  const [simDeviceIp, setSimDeviceIp] = useState('192.168.1.150');
  const [simDni, setSimDni] = useState('71234567'); // Juan Perez
  const [simPunchTime, setSimPunchTime] = useState('2026-08-12 08:02:15');
  const [simVerifyMode, setSimVerifyMode] = useState('1'); // Fingerprint
  const [pushOutput, setPushOutput] = useState<string | null>(null);

  const handleSimulatePush = () => {
    const rawString = `SN=ZK-ADMS-99801&PIN=${simDni}&TIME=${simPunchTime}&VERIFY=${simVerifyMode}&STATUS=0`;
    const parsed = parseZkTecoPushBody(rawString, 'dev-1', 'Biométrico Garita Principal');

    const responseLog = `
HTTP/1.1 200 OK
Content-Type: text/plain
Server: HRMS-ZKTeco-Ingestion-Listener/1.0

OK: Record Stored in Staging Table 'marcaciones_raw'
------------------------------------------------------
[DB STAGING INMUTABLE]
ID: punch-uuid-${Math.floor(Math.random() * 10000)}
Device: ZK-ADMS-99801 (${simDeviceIp})
Employee DNI: ${parsed.employee_dni}
Timestamp: ${parsed.timestamp}
Verify Mode: ${parsed.verify_mode}
Status: UNPROCESSED (Paso a motor de cálculo de tardanzas)
Raw Payload: ${rawString}
    `;

    setPushOutput(responseLog.trim());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Estrategia de Integración Biométrica ZKTeco (Push ADMS & SDK)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Protocolo Push ADMS (HTTP Listener `/iclock/cdata.php`) y procesamiento inmutable en tabla de staging (`punch_logs`).
            </p>
          </div>
        </div>
      </div>

      {/* Protocol Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">1. Protocolo ZKTeco Push ADMS (Recomendado Enterprise)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            El reloj biométrico actúa como cliente HTTP y envía los fichajes inmediatamente al servidor tras cada marcación en tiempo real a la URL `/iclock/cdata.php`. No requiere IP pública ni apertura de puertos entrantes en la sede remota.
          </p>
          <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-cyan-300 border border-slate-800 space-y-1">
            <div>GET /iclock/cdata.php?SN=ZK-ADMS-99801&amp;options=all</div>
            <div className="text-slate-500">// Response 200: OK -&gt; Handshake Inicial</div>
            <div className="mt-2 text-indigo-300">POST /iclock/cdata.php?table=ATTLOG&amp;SN=ZK-ADMS-99801</div>
            <div className="text-emerald-400">Payload: PIN=71234567\tTIME=2026-08-12 08:02:15\tVERIFY=1</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">2. Algoritmo de Matching para Jornada Partida (2 Turnos)</h3>
          </div>
          <ul className="text-xs text-slate-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5"></span>
              <span><strong>Staging Inmutable:</strong> La marcación ingresa a <code className="text-cyan-300 font-mono">marcaciones_raw</code> sin alteraciones de hora ni eliminación.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5"></span>
              <span><strong>Match Turno 1:</strong> La primera marcación de la mañana se compara contra la hora pactada del Turno 1 (Ej. 08:00).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5"></span>
              <span><strong>Match Turno 2 (Jornada Partida):</strong> La 3ra marcación del día se evalúa contra la entrada del Turno 2 (Ej. 14:00).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5"></span>
              <span><strong>Cálculo Tolerancia:</strong> Si tardanza total &gt; minutos tolerancia (10m), se computa la diferencia neta.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Push Payload Live Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <Play className="w-4 h-4 text-cyan-400" />
          Simulador de Ingesta de Marcación HTTP ADMS Push
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">IP Dispositivo ZKTeco</label>
            <input
              type="text"
              value={simDeviceIp}
              onChange={(e) => setSimDeviceIp(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 text-white border border-slate-800 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">DNI Empleado (PIN)</label>
            <input
              type="text"
              value={simDni}
              onChange={(e) => setSimDni(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 text-white border border-slate-800 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Timestamp Fichaje</label>
            <input
              type="text"
              value={simPunchTime}
              onChange={(e) => setSimPunchTime(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 text-white border border-slate-800 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Modo de Verificación</label>
            <select
              value={simVerifyMode}
              onChange={(e) => setSimVerifyMode(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 text-white border border-slate-800 rounded-lg font-mono"
            >
              <option value="1">Huella Dactilar (Fingerprint)</option>
              <option value="15">Reconocimiento Facial (Face)</option>
              <option value="25">Reconocimiento Palma (Palm)</option>
              <option value="3">Tarjeta RFID / Proximidad</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSimulatePush}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>Enviar HTTP Push Fichaje a `/iclock/cdata.php`</span>
        </button>

        {pushOutput && (
          <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-cyan-500/30 font-mono text-xs text-cyan-200">
            <pre className="whitespace-pre-wrap">{pushOutput}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
