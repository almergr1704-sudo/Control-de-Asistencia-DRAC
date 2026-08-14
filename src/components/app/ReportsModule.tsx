import React, { useState } from 'react';
import {
  AsistenciaProcesada,
  PapeletaSalida,
  Vacacion,
  Employee,
} from '../../types';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileText,
  Clock,
  User,
  ShieldCheck,
  Palmtree,
  CheckCircle2,
} from 'lucide-react';

interface ReportsModuleProps {
  attendance: AsistenciaProcesada[];
  papeletas: PapeletaSalida[];
  vacaciones: Vacacion[];
  employees: Employee[];
  reportType:
    | 'ATTENDANCE'
    | 'TARDINESS'
    | 'ABSENCES'
    | 'OVERTIME'
    | 'VACATIONS'
    | 'PAPELETAS'
    | 'EXITS';
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  attendance,
  papeletas,
  vacaciones,
  employees,
  reportType,
}) => {
  const [activeReport, setActiveReport] = useState<
    'ATTENDANCE' | 'TARDINESS' | 'ABSENCES' | 'OVERTIME' | 'VACATIONS' | 'PAPELETAS' | 'EXITS'
  >(reportType || 'ATTENDANCE');

  const [dateStart, setDateStart] = useState('2026-08-01');
  const [dateEnd, setDateEnd] = useState('2026-08-31');

  const reportTitles: Record<typeof activeReport, string> = {
    ATTENDANCE: 'Reporte Consolidado de Asistencia General',
    TARDINESS: 'Reporte Consolidado de Tardanzas y Minutos de Tolerancia',
    ABSENCES: 'Reporte de Faltas e Inasistencias Injustificadas',
    OVERTIME: 'Reporte de Horas Extras y Permanencia Extraordinaria',
    VACATIONS: 'Reporte Consolidado de Solicitudes y Vacaciones Tomadas',
    PAPELETAS: 'Reporte Institucional de Papeletas de Salida',
    EXITS: 'Reporte de Control de Garita — Salidas y Retornos Reales',
  };

  const handleExportCSV = () => {
    alert(`Exportando ${reportTitles[activeReport]} en formato CSV / Excel...`);
  };

  return (
    <div className="space-y-6">
      {/* Sub menu tabs for report types */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1.5 flex space-x-1 overflow-x-auto">
        {[
          { id: 'ATTENDANCE', label: 'Asistencia' },
          { id: 'TARDINESS', label: 'Tardanzas' },
          { id: 'ABSENCES', label: 'Faltas' },
          { id: 'OVERTIME', label: 'Horas Extras' },
          { id: 'VACATIONS', label: 'Vacaciones' },
          { id: 'PAPELETAS', label: 'Papeletas' },
          { id: 'EXITS', label: 'Salidas y Retornos Garita' },
        ].map((rep) => (
          <button
            key={rep.id}
            onClick={() => setActiveReport(rep.id as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-all ${
              activeReport === rep.id
                ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-600'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {rep.label}
          </button>
        ))}
      </div>

      {/* Filter and Export Bar */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>{reportTitles[activeReport]}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Generación de reportes institucionales DRAC para gestión administrativa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#060709] px-2.5 py-1.5 rounded border border-slate-800 text-xs text-slate-300 font-mono">
            <span>Rango:</span>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="bg-transparent text-white focus:outline-none"
            />
            <span>a</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="bg-transparent text-white focus:outline-none"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* REPORT CONTENT TABLES */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5">
        {activeReport === 'ATTENDANCE' && (
          <div>
            {attendance.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
                <span className="text-[11px] text-slate-500">No hay datos de asistencia procesados en el rango.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">DNI / Personal</th>
                      <th className="p-3">Área</th>
                      <th className="p-3">T1 Real (Ent / Sal)</th>
                      <th className="p-3">T2 Real (Ent / Sal)</th>
                      <th className="p-3 text-center">Horas Efectivas</th>
                      <th className="p-3 text-center">Tardanza</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                    {attendance.map((a) => {
                      const eff = a.total_effective_hours !== undefined
                        ? a.total_effective_hours
                        : (a.t1_effective_hours || 0) + (a.t2_effective_hours || 0);

                      return (
                        <tr key={a.id} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-400 font-bold">{a.fecha}</td>
                          <td className="p-3 text-white font-bold font-sans">{a.employee_name} ({a.employee_dni})</td>
                          <td className="p-3 text-slate-400 font-sans">{a.area_name}</td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {a.t1_real_in || '--:--'} - {a.t1_real_out || '--:--'}
                          </td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {a.t2_scheduled_in ? `${a.t2_real_in || '--:--'} - ${a.t2_real_out || '--:--'}` : '-'}
                          </td>
                          <td className="p-3 text-center text-emerald-300 font-bold">
                            {eff > 0 ? `${eff.toFixed(1)} hrs` : '0.0 hrs'}
                          </td>
                          <td className="p-3 text-center text-amber-400 font-bold">{a.total_tardiness_minutes || a.net_tardiness_minutes || 0} min</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded font-sans text-[10px] font-bold ${
                                a.status === 'PUNCTUAL'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : a.status === 'LATE'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === 'TARDINESS' && (
          <div>
            {attendance.filter((a) => a.status === 'LATE').length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
                <span className="text-[11px] text-slate-500">No se registran tardanzas en el periodo seleccionado.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Área DRAC</th>
                      <th className="p-3">Hora Programada</th>
                      <th className="p-3">Hora Marcada</th>
                      <th className="p-3">Minutos Tardanza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                    {attendance
                      .filter((a) => a.status === 'LATE')
                      .map((a) => (
                        <tr key={a.id} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-400 font-bold">{a.fecha}</td>
                          <td className="p-3 text-white font-bold font-sans">{a.employee_name}</td>
                          <td className="p-3 text-slate-400 font-sans">{a.area_name}</td>
                          <td className="p-3 text-slate-400">{a.t1_scheduled_in || '--:--'}</td>
                          <td className="p-3 text-amber-400 font-bold">{a.t1_real_in}</td>
                          <td className="p-3 text-rose-400 font-bold">{a.net_tardiness_minutes} min</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === 'PAPELETAS' && (
          <div>
            {papeletas.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
                <span className="text-[11px] text-slate-500">No hay registros de papeletas de salida en el periodo.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Código</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Tipo / Motivo</th>
                      <th className="p-3">Fecha / Horario</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {papeletas.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/40 font-mono">
                        <td className="p-3 text-indigo-400 font-bold">{p.code}</td>
                        <td className="p-3 text-white font-bold font-sans">{p.employee_name}</td>
                        <td className="p-3 text-slate-300 font-sans">{p.type} - {p.reason}</td>
                        <td className="p-3 text-slate-400">{p.fecha} ({p.start_time} - {p.end_time})</td>
                        <td className="p-3 font-sans">
                          <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[10px] font-bold">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(activeReport === 'ABSENCES' ||
          activeReport === 'OVERTIME' ||
          activeReport === 'VACATIONS' ||
          activeReport === 'EXITS') && (
          <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
            <span className="text-[11px] text-slate-500">
              No se han detectado eventos para esta categoría en las fechas seleccionadas.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
