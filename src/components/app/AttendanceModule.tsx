import React, { useState, useMemo } from 'react';
import { AttendanceRecord, MarcacionRaw, Employee } from '../../types';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  Layers,
  ArrowUpDown,
  Download,
  Info,
} from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';

interface AttendanceModuleProps {
  attendance: AttendanceRecord[];
  rawPunches: MarcacionRaw[];
  employees: Employee[];
  activeRole: string;
  onRefresh?: () => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  attendance,
  rawPunches,
  employees,
  activeRole,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'punches' | 'consolidated'>('punches');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Filter raw punches
  const filteredPunches = useMemo(() => {
    return rawPunches.filter((p) => {
      if (dateFilter && p.fecha !== dateFilter && !p.timestamp.startsWith(dateFilter)) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = p.employee_name?.toLowerCase().includes(term);
        const matchDni = p.employee_dni?.includes(term);
        const matchSn = p.device_sn?.toLowerCase().includes(term);
        if (!matchName && !matchDni && !matchSn) return false;
      }
      return true;
    });
  }, [rawPunches, searchTerm, dateFilter]);

  // Filter attendance records
  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (dateFilter && a.fecha !== dateFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = a.employee_name?.toLowerCase().includes(term);
        const matchDni = a.employee_dni?.includes(term);
        if (!matchName && !matchDni) return false;
      }
      return true;
    });
  }, [attendance, searchTerm, dateFilter]);

  const paginatedPunches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPunches.slice(start, start + pageSize);
  }, [filteredPunches, currentPage, pageSize]);

  const paginatedAttendance = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAttendance.slice(start, start + pageSize);
  }, [filteredAttendance, currentPage, pageSize]);

  const exportPunchesCSV = () => {
    if (rawPunches.length === 0) return;
    const headers = ['ID', 'DNI', 'Trabajador', 'Fecha y Hora', 'Dispositivo', 'Método', 'Origen'];
    const rows = rawPunches.map((p) => [
      p.id,
      p.employee_dni,
      `"${p.employee_name}"`,
      p.timestamp,
      p.device_sn,
      p.verify_mode,
      p.source,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `marcaciones_drac_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
              <Clock className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Control de Asistencia y Marcaciones DRAC</span>
                <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 text-[11px] rounded-full font-mono">
                  {rawPunches.length} Marcaciones Reales
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Visualización estricta de marcaciones biometrizadas e informes consolidados de jornada institucional.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {rawPunches.length > 0 && (
            <button
              onClick={exportPunchesCSV}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          )}

          <button
            onClick={() => onRefresh && onRefresh()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => {
            setActiveTab('punches');
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'punches'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Marcaciones Crudas ({rawPunches.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('consolidated');
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'consolidated'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Asistencia Consolidada ({attendance.length})</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs bg-[#0F1115] border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por DNI o nombre del trabajador..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
          />

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-slate-400 hover:text-white px-2 py-1 text-xs"
              title="Limpiar fecha"
            >
              ✕
            </button>
          )}
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          {activeTab === 'punches'
            ? `${filteredPunches.length} marcaciones filtradas`
            : `${filteredAttendance.length} registros consolidados`}
        </span>
      </div>

      {/* Content */}
      {activeTab === 'punches' ? (
        filteredPunches.length === 0 ? (
          <div className="p-12 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-[#0C0D11]">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="font-bold text-sm text-slate-200">0 Marcaciones Reales Registradas</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Por política institucional estricta, no se exhiben marcaciones simuladas ni datos ficticios. Las marcaciones se registrarán automáticamente en cuanto el personal marque en el terminal físico ZKTeco G3-id o se ejecute la sincronización por red TCP/IP.
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1115]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#090A0D] text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">DNI</th>
                    <th className="py-2.5 px-3">Trabajador</th>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Dispositivo</th>
                    <th className="py-2.5 px-3">Método</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedPunches.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{p.employee_dni}</td>
                      <td className="py-2.5 px-3 text-white font-medium">{p.employee_name}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-300">{p.timestamp}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">{p.device_sn}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{p.verify_mode}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px]">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          p.punch_state === 0
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                        }`}>
                          {p.punch_state === 0 ? 'ENTRADA' : 'SALIDA'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{p.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataTablePagination
              currentPage={currentPage}
              totalItems={filteredPunches.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )
      ) : (
        filteredAttendance.length === 0 ? (
          <div className="p-12 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-[#0C0D11]">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="font-bold text-sm text-slate-200">0 Registros de Asistencia Procesados</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                El consolidador institucional de asistencia genera los cálculos de jornada, puntualidad y tardanzas únicamente en base a marcaciones reales recibidas.
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1115]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#090A0D] text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">DNI</th>
                    <th className="py-2.5 px-3">Trabajador</th>
                    <th className="py-2.5 px-3">Turno 1 (Ent/Sal)</th>
                    <th className="py-2.5 px-3">Turno 2 (Ent/Sal)</th>
                    <th className="py-2.5 px-3">Tardanza</th>
                    <th className="py-2.5 px-3">Horas Efectivas</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedAttendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-300">{a.fecha}</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-300 font-bold">{a.employee_dni}</td>
                      <td className="py-2.5 px-3 text-white">{a.employee_name}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {a.t1_real_in || '--:--'} / {a.t1_real_out || '--:--'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {a.t2_real_in || '--:--'} / {a.t2_real_out || '--:--'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-300">
                        {a.net_tardiness_minutes > 0 ? `${a.net_tardiness_minutes} min` : '0 min'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                        {a.total_effective_hours.toFixed(1)} h
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'PUNCTUAL'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : a.status === 'LATE'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataTablePagination
              currentPage={currentPage}
              totalItems={filteredAttendance.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )
      )}
    </div>
  );
};
