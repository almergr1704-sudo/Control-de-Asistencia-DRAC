import React, { useState, useMemo, useEffect } from 'react';
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
  FileText,
  Clock,
  ShieldCheck,
  Palmtree,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { normalizePersonName } from '../../utils/nameUtils';

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

  useEffect(() => {
    if (reportType) setActiveReport(reportType);
  }, [reportType]);

  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState('');

  const reportTitles: Record<typeof activeReport, string> = {
    ATTENDANCE: 'Reporte Consolidado de Asistencia General',
    TARDINESS: 'Reporte Consolidado de Tardanzas y Minutos de Tolerancia',
    ABSENCES: 'Reporte de Faltas e Inasistencias Injustificadas',
    OVERTIME: 'Reporte de Horas Extras y Permanencia Extraordinaria',
    VACATIONS: 'Reporte Consolidado de Solicitudes y Vacaciones Tomadas',
    PAPELETAS: 'Reporte Institucional de Papeletas de Salida',
    EXITS: 'Reporte de Control de Garita — Salidas y Retornos Reales',
  };

  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const employeeLookup = useMemo(() => {
    const byId = new Map<string, Employee>();
    const byDni = new Map<string, Employee>();
    for (const e of employees) {
      if (e.id) byId.set(e.id, e);
      if (e.dni) byDni.set(String(e.dni).trim(), e);
    }
    return { byId, byDni };
  }, [employees]);

  const resolveOfficial = (
    empId?: string | null,
    empDni?: string | null,
    fallback?: { name?: string; area?: string; dependencia?: string; direccion?: string; cargo?: string; codigo?: string | null }
  ) => {
    const emp =
      (empId ? employeeLookup.byId.get(empId) : undefined) ||
      (empDni ? employeeLookup.byDni.get(String(empDni).trim()) : undefined);
    return {
      dni: emp?.dni || empDni || '—',
      codigoDrac: emp?.codigo_trabajador || fallback?.codigo || '—',
      fullName: emp
        ? normalizePersonName(`${emp.first_name || ''} ${emp.last_name || ''}`.trim())
        : normalizePersonName(fallback?.name || 'Pendiente de Identificación'),
      dependencia: emp?.dependencia_name || fallback?.dependencia || '—',
      direccion: emp?.direccion_organo_name || fallback?.direccion || '',
      area: emp?.area_name || fallback?.area || '—',
      cargo: emp?.position || fallback?.cargo || '—',
    };
  };

  const inRange = (dateStr?: string | null) => {
    if (!dateStr) return true;
    const d = dateStr.substring(0, 10);
    if (dateStart && d < dateStart) return false;
    if (dateEnd && d > dateEnd) return false;
    return true;
  };

  const matchesSearchTerm = (official: ReturnType<typeof resolveOfficial>, extra = '') => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [
      official.fullName,
      official.dni,
      official.codigoDrac,
      official.dependencia,
      official.direccion,
      official.area,
      official.cargo,
      extra,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  };

  const filteredAttendance = useMemo(
    () =>
      attendance.filter((a) => {
        if (!inRange(a.fecha)) return false;
        const off = resolveOfficial(a.employee_id, a.employee_dni, {
          name: a.employee_name,
          area: a.area_name,
          dependencia: a.dependencia_name,
          direccion: a.direccion_organo_name,
          cargo: a.cargo_name,
          codigo: a.employee_codigo_drac,
        });
        return matchesSearchTerm(off, a.fecha);
      }),
    [attendance, dateStart, dateEnd, searchTerm, employeeLookup]
  );

  const filteredTardiness = useMemo(
    () => filteredAttendance.filter((a) => a.status === 'LATE' || (a.net_tardiness_minutes || 0) > 0),
    [filteredAttendance]
  );

  const filteredAbsences = useMemo(
    () => filteredAttendance.filter((a) => a.status === 'ABSENT'),
    [filteredAttendance]
  );

  const filteredOvertime = useMemo(
    () => filteredAttendance.filter((a) => (a.overtime_minutes || 0) > 0),
    [filteredAttendance]
  );

  const filteredVacaciones = useMemo(
    () =>
      vacaciones.filter((v) => {
        if (dateStart && v.end_date < dateStart) return false;
        if (dateEnd && v.start_date > dateEnd) return false;
        const off = resolveOfficial(v.employee_id, v.employee_dni, {
          name: v.employee_name,
          area: v.area_name,
          dependencia: v.dependencia_name,
          direccion: v.direccion_organo_name,
          cargo: v.position,
        });
        return matchesSearchTerm(off, v.code || '');
      }),
    [vacaciones, dateStart, dateEnd, searchTerm, employeeLookup]
  );

  const filteredPapeletas = useMemo(
    () =>
      papeletas.filter((p) => {
        if (!inRange(p.fecha)) return false;
        const off = resolveOfficial(p.employee_id, p.employee_dni, {
          name: p.employee_name,
          area: p.area_name,
          dependencia: p.dependencia_name,
          direccion: p.direccion_organo_name,
        });
        return matchesSearchTerm(off, `${p.code || ''} ${p.destino || ''}`);
      }),
    [papeletas, dateStart, dateEnd, searchTerm, employeeLookup]
  );

  const filteredExits = useMemo(
    () =>
      filteredPapeletas.filter(
        (p) =>
          Boolean(p.hora_real_salida || p.hora_real_retorno) ||
          p.status === 'SALIDA_EFECTUADA' ||
          p.status === 'RETORNO_REGISTRADO' ||
          p.status === 'IN_OUTING' ||
          p.status === 'COMPLETED'
      ),
    [filteredPapeletas]
  );

  const handleExportCSV = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeReport === 'ATTENDANCE' || activeReport === 'TARDINESS' || activeReport === 'ABSENCES' || activeReport === 'OVERTIME') {
      const source =
        activeReport === 'TARDINESS'
          ? filteredTardiness
          : activeReport === 'ABSENCES'
          ? filteredAbsences
          : activeReport === 'OVERTIME'
          ? filteredOvertime
          : filteredAttendance;
      headers = [
        'Fecha',
        'Codigo_DRAC',
        'DNI',
        'Trabajador_Oficial',
        'Dependencia',
        'Direccion_Organo',
        'Area_Oficina',
        'Cargo',
        'T1_Ent',
        'T1_Sal',
        'T2_Ent',
        'T2_Sal',
        'Horas_Efectivas',
        'Tardanza_Min',
        'Horas_Extras_Min',
        'Estado',
      ];
      rows = source.map((a) => {
        const off = resolveOfficial(a.employee_id, a.employee_dni, {
          name: a.employee_name,
          area: a.area_name,
          dependencia: a.dependencia_name,
          direccion: a.direccion_organo_name,
          cargo: a.cargo_name,
          codigo: a.employee_codigo_drac,
        });
        const eff =
          a.total_effective_hours !== undefined
            ? a.total_effective_hours
            : (a.t1_effective_hours || 0) + (a.t2_effective_hours || 0);
        return [
          a.fecha,
          off.codigoDrac,
          off.dni,
          off.fullName,
          off.dependencia,
          off.direccion,
          off.area,
          off.cargo,
          a.t1_real_in || '--:--',
          a.t1_real_out || '--:--',
          a.t2_real_in || '--:--',
          a.t2_real_out || '--:--',
          eff.toFixed(2),
          a.net_tardiness_minutes ?? a.total_tardiness_minutes ?? 0,
          a.overtime_minutes ?? 0,
          a.status,
        ].map(esc);
      });
    } else if (activeReport === 'VACATIONS') {
      headers = [
        'Codigo',
        'Codigo_DRAC',
        'DNI',
        'Trabajador_Oficial',
        'Dependencia',
        'Area_Oficina',
        'Cargo',
        'Tipo',
        'Fecha_Inicio',
        'Fecha_Fin',
        'Dias',
        'Periodo',
        'Estado',
      ];
      rows = filteredVacaciones.map((v) => {
        const off = resolveOfficial(v.employee_id, v.employee_dni, {
          name: v.employee_name,
          area: v.area_name,
          dependencia: v.dependencia_name,
          direccion: v.direccion_organo_name,
          cargo: v.position,
        });
        return [
          v.code || v.id,
          off.codigoDrac,
          off.dni,
          off.fullName,
          off.dependencia,
          off.area,
          off.cargo,
          v.tipo,
          v.start_date,
          v.end_date,
          v.total_days || v.dias_solicitados || 0,
          v.period_year,
          v.status,
        ].map(esc);
      });
    } else {
      const source = activeReport === 'EXITS' ? filteredExits : filteredPapeletas;
      headers = [
        'Codigo',
        'Codigo_DRAC',
        'DNI',
        'Trabajador_Oficial',
        'Dependencia',
        'Area_Oficina',
        'Cargo',
        'Fecha',
        'Motivo',
        'Destino',
        'Hora_Est_Salida',
        'Hora_Est_Retorno',
        'Hora_Real_Salida',
        'Hora_Real_Retorno',
        'Estado',
      ];
      rows = source.map((p) => {
        const off = resolveOfficial(p.employee_id, p.employee_dni, {
          name: p.employee_name,
          area: p.area_name,
          dependencia: p.dependencia_name,
          direccion: p.direccion_organo_name,
        });
        return [
          p.code,
          off.codigoDrac,
          off.dni,
          off.fullName,
          off.dependencia,
          off.area,
          off.cargo,
          p.fecha,
          p.motivo || p.type || 'Papeleta',
          p.destino || p.descripcion || '',
          p.hora_estimada_salida || p.start_time || '--:--',
          p.hora_estimada_retorno || p.end_time || '--:--',
          p.hora_real_salida || '--:--',
          p.hora_real_retorno || '--:--',
          p.status,
        ].map(esc);
      });
    }

    if (rows.length === 0) {
      setExportNotice(`No hay registros en "${reportTitles[activeReport]}" para el rango ${dateStart} a ${dateEnd}.`);
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }

    const csvString = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drac_reporte_${activeReport.toLowerCase()}_${dateStart}_a_${dateEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exportado "${reportTitles[activeReport]}" (${rows.length} registro(s)) en formato CSV UTF-8.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {exportNotice && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-xl text-xs text-indigo-200 flex items-center justify-between gap-2">
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-slate-400 hover:text-white font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

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
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {rep.label}
          </button>
        ))}
      </div>

      {/* Filter and Export Bar */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>{reportTitles[activeReport]}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Reportes institucionales DRAC enriquecidos con datos oficiales del Directorio Institucional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Trabajador, DNI, Cód. DRAC, Área..."
              className="pl-8 pr-3 py-1.5 bg-[#060709] border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>

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
            {filteredAttendance.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
                <span className="text-[11px] text-slate-500">No hay datos de asistencia procesados en el rango.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Cód. DRAC / DNI</th>
                      <th className="p-3">Trabajador Oficial</th>
                      <th className="p-3">Dependencia / Área / Cargo</th>
                      <th className="p-3">T1 Real (Ent / Sal)</th>
                      <th className="p-3">T2 Real (Ent / Sal)</th>
                      <th className="p-3 text-center">Horas Efectivas</th>
                      <th className="p-3 text-center">Tardanza</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                    {filteredAttendance.map((a) => {
                      const off = resolveOfficial(a.employee_id, a.employee_dni, {
                        name: a.employee_name,
                        area: a.area_name,
                        dependencia: a.dependencia_name,
                        direccion: a.direccion_organo_name,
                        cargo: a.cargo_name,
                        codigo: a.employee_codigo_drac,
                      });
                      const eff =
                        a.total_effective_hours !== undefined
                          ? a.total_effective_hours
                          : (a.t1_effective_hours || 0) + (a.t2_effective_hours || 0);

                      return (
                        <tr key={a.id} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-400 font-bold whitespace-nowrap">{a.fecha}</td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-cyan-400 font-bold">{off.codigoDrac}</div>
                            <div className="text-[10px] text-slate-400">DNI: {off.dni}</div>
                          </td>
                          <td className="p-3 text-white font-bold font-sans">{off.fullName}</td>
                          <td className="p-3 font-sans">
                            <div className="text-slate-200">{off.dependencia}</div>
                            <div className="text-[10px] text-slate-400">{[off.direccion, off.area].filter(Boolean).join(' · ')}</div>
                            <div className="text-[10px] text-indigo-300 font-semibold">{off.cargo}</div>
                          </td>
                          <td className="p-3 text-emerald-400 font-bold whitespace-nowrap">
                            {a.t1_real_in || '--:--'} - {a.t1_real_out || '--:--'}
                          </td>
                          <td className="p-3 text-emerald-400 font-bold whitespace-nowrap">
                            {a.t2_scheduled_in ? `${a.t2_real_in || '--:--'} - ${a.t2_real_out || '--:--'}` : '-'}
                          </td>
                          <td className="p-3 text-center text-emerald-300 font-bold whitespace-nowrap">
                            {eff > 0 ? `${eff.toFixed(1)} hrs` : '0.0 hrs'}
                          </td>
                          <td className="p-3 text-center text-amber-400 font-bold whitespace-nowrap">
                            {a.net_tardiness_minutes ?? a.total_tardiness_minutes ?? 0} min
                          </td>
                          <td className="p-3 whitespace-nowrap">
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
            {filteredTardiness.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
                <span className="text-[11px] text-slate-500">No se registran tardanzas en el periodo seleccionado.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Cód. DRAC / DNI</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Dependencia / Área / Cargo</th>
                      <th className="p-3">Hora Programada</th>
                      <th className="p-3">Hora Marcada</th>
                      <th className="p-3">Minutos Tardanza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                    {filteredTardiness.map((a) => {
                      const off = resolveOfficial(a.employee_id, a.employee_dni, {
                        name: a.employee_name,
                        area: a.area_name,
                        dependencia: a.dependencia_name,
                        cargo: a.cargo_name,
                        codigo: a.employee_codigo_drac,
                      });
                      return (
                        <tr key={a.id} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-400 font-bold whitespace-nowrap">{a.fecha}</td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-cyan-400 font-bold">{off.codigoDrac}</div>
                            <div className="text-[10px] text-slate-400">DNI: {off.dni}</div>
                          </td>
                          <td className="p-3 text-white font-bold font-sans">{off.fullName}</td>
                          <td className="p-3 font-sans">
                            <div className="text-slate-200">{off.dependencia}</div>
                            <div className="text-[10px] text-slate-400">{off.area} · {off.cargo}</div>
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{a.t1_scheduled_in || '--:--'}</td>
                          <td className="p-3 text-amber-400 font-bold whitespace-nowrap">{a.t1_real_in || '--:--'}</td>
                          <td className="p-3 text-rose-400 font-bold whitespace-nowrap">{a.net_tardiness_minutes} min</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === 'ABSENCES' && (
          <div>
            {filteredAbsences.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen faltas registradas en el periodo.</p>
                <span className="text-[11px] text-slate-500">Todos los registros procesados en el rango cuentan con marcación o justificación.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Cód. DRAC / DNI</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Dependencia / Área / Cargo</th>
                      <th className="p-3">Horario</th>
                      <th className="p-3">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {filteredAbsences.map((a) => {
                      const off = resolveOfficial(a.employee_id, a.employee_dni, {
                        name: a.employee_name,
                        area: a.area_name,
                        dependencia: a.dependencia_name,
                        cargo: a.cargo_name,
                        codigo: a.employee_codigo_drac,
                      });
                      return (
                        <tr key={a.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono text-rose-300 font-bold">{a.fecha}</td>
                          <td className="p-3 font-mono">
                            <div className="text-cyan-400 font-bold">{off.codigoDrac}</div>
                            <div className="text-[10px] text-slate-400">{off.dni}</div>
                          </td>
                          <td className="p-3 text-white font-bold">{off.fullName}</td>
                          <td className="p-3">
                            <div className="text-slate-200">{off.dependencia}</div>
                            <div className="text-[10px] text-slate-400">{off.area} · {off.cargo}</div>
                          </td>
                          <td className="p-3 text-slate-400">{a.horario_name}</td>
                          <td className="p-3 text-slate-400">{a.observations || 'Inasistencia sin marcación'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === 'OVERTIME' && (
          <div>
            {filteredOvertime.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen horas extras registradas en el rango.</p>
                <span className="text-[11px] text-slate-500">Se muestran jornadas cuya permanencia excede la hora límite programada.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Cód. DRAC / DNI</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Dependencia / Área</th>
                      <th className="p-3">Salida Real</th>
                      <th className="p-3">Minutos Extras</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {filteredOvertime.map((a) => {
                      const off = resolveOfficial(a.employee_id, a.employee_dni, {
                        name: a.employee_name,
                        area: a.area_name,
                        dependencia: a.dependencia_name,
                        codigo: a.employee_codigo_drac,
                      });
                      return (
                        <tr key={a.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono text-slate-300">{a.fecha}</td>
                          <td className="p-3 font-mono">
                            <div className="text-cyan-400 font-bold">{off.codigoDrac}</div>
                            <div className="text-[10px] text-slate-400">{off.dni}</div>
                          </td>
                          <td className="p-3 text-white font-bold">{off.fullName}</td>
                          <td className="p-3 text-slate-400">{off.dependencia} · {off.area}</td>
                          <td className="p-3 font-mono text-emerald-400">{a.t2_real_out || a.t1_real_out || '--:--'}</td>
                          <td className="p-3 font-mono text-indigo-300 font-bold">{a.overtime_minutes} min</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === 'VACATIONS' && (
          <div>
            {filteredVacaciones.length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                <Palmtree className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No existen solicitudes de vacaciones en el rango.</p>
                <span className="text-[11px] text-slate-500">Ajuste el rango de fechas o los filtros de búsqueda.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Código</th>
                      <th className="p-3">Cód. DRAC / DNI</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Dependencia / Área / Cargo</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Periodo Programado</th>
                      <th className="p-3 text-center">Días</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {filteredVacaciones.map((v) => {
                      const off = resolveOfficial(v.employee_id, v.employee_dni, {
                        name: v.employee_name,
                        area: v.area_name,
                        dependencia: v.dependencia_name,
                        cargo: v.position,
                      });
                      return (
                        <tr key={v.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono text-indigo-400 font-bold">{v.code || v.id}</td>
                          <td className="p-3 font-mono">
                            <div className="text-cyan-400 font-bold">{off.codigoDrac}</div>
                            <div className="text-[10px] text-slate-400">{off.dni}</div>
                          </td>
                          <td className="p-3 text-white font-bold">{off.fullName}</td>
                          <td className="p-3">
                            <div className="text-slate-200">{off.dependencia}</div>
                            <div className="text-[10px] text-slate-400">{off.area} · {off.cargo}</div>
                          </td>
                          <td className="p-3 font-mono">{v.tipo}</td>
                          <td className="p-3 font-mono text-slate-300 whitespace-nowrap">{v.start_date} al {v.end_date}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-400">{v.total_days || v.dias_solicitados || 0}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[10px] font-bold">
                              {v.status}
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

        {(activeReport === 'PAPELETAS' || activeReport === 'EXITS') && (
          <div>
            {(activeReport === 'EXITS' ? filteredExits : filteredPapeletas).length === 0 ? (
              <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
                {activeReport === 'EXITS' ? (
                  <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                ) : (
                  <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                )}
                <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
                <span className="text-[11px] text-slate-500">
                  {activeReport === 'EXITS'
                    ? 'No hay salidas o retornos reales registrados por Garita en el rango.'
                    : 'No hay registros de papeletas de salida en el periodo.'}
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <th className="p-3">Código</th>
                      <th className="p-3">Cód. DRAC / DNI</th>
                      <th className="p-3">Servidor Público</th>
                      <th className="p-3">Dependencia / Área</th>
                      <th className="p-3">Tipo / Motivo</th>
                      <th className="p-3">Fecha / Horario Est.</th>
                      <th className="p-3">Garita Real (Sal / Ret)</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {(activeReport === 'EXITS' ? filteredExits : filteredPapeletas).map((p) => {
                      const off = resolveOfficial(p.employee_id, p.employee_dni, {
                        name: p.employee_name,
                        area: p.area_name,
                        dependencia: p.dependencia_name,
                        direccion: p.direccion_organo_name,
                      });
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/40 font-mono">
                          <td className="p-3 text-indigo-400 font-bold whitespace-nowrap">{p.code}</td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-cyan-400 font-bold">{off.codigoDrac}</div>
                            <div className="text-[10px] text-slate-400">{off.dni}</div>
                          </td>
                          <td className="p-3 text-white font-bold font-sans">{off.fullName}</td>
                          <td className="p-3 font-sans">
                            <div className="text-slate-200">{off.dependencia}</div>
                            <div className="text-[10px] text-slate-400">{off.area}</div>
                          </td>
                          <td className="p-3 text-slate-300 font-sans">
                            {p.motivo || p.type || 'Papeleta'} - {p.descripcion || p.reason || p.destino || ''}
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">
                            {p.fecha} ({p.hora_estimada_salida || p.start_time || '--:--'} - {p.hora_estimada_retorno || p.end_time || '--:--'})
                          </td>
                          <td className="p-3 text-emerald-400 font-bold whitespace-nowrap">
                            {p.hora_real_salida || '--:--'} / {p.hora_real_retorno || '--:--'}
                          </td>
                          <td className="p-3 font-sans whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[10px] font-bold">
                              {p.status}
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
      </div>
    </div>
  );
};
