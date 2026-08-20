import React, { useState, useMemo } from 'react';
import { Vacacion, VacacionTipo, Employee, RoleType } from '../../types';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  User,
  Info,
  Edit2,
  Trash2,
  X,
  Search,
  Calendar,
} from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';

interface VacationsModuleProps {
  activeView?: string;
  vacaciones: Vacacion[];
  employees: Employee[];
  activeRole: RoleType;
  onAddVacation: (vacation: Omit<Vacacion, 'id' | 'created_at'>) => void;
  onEditVacation?: (vacation: Vacacion) => void;
  onDeleteVacation?: (vacationId: string) => void;
}

export const VacationsModule: React.FC<VacationsModuleProps> = ({
  activeView,
  vacaciones,
  employees,
  activeRole,
  onAddVacation,
  onEditVacation,
  onDeleteVacation,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingVacation, setEditingVacation] = useState<Vacacion | null>(null);

  // SEARCH & MULTI-FILTER STATE
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('ALL');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // SORTING STATE
  const [sortField, setSortField] = useState<string | null>('start_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  React.useEffect(() => {
    if (!activeView) return;
    if (activeView === 'vacations_requests') {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [activeView]);

  const [selectedEmpDni, setSelectedEmpDni] = useState(employees[0]?.dni || '');
  const [tipo, setTipo] = useState<VacacionTipo>('PARCIAL');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalDays, setTotalDays] = useState(1);
  const [comments, setComments] = useState('');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterTipo !== 'ALL') count++;
    if (filterFechaDesde) count++;
    if (filterFechaHasta) count++;
    return count;
  }, [filterTipo, filterFechaDesde, filterFechaHasta]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterTipo('ALL');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const filteredVacations = useMemo(() => {
    return vacaciones.filter((v) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = v.employee_name.toLowerCase().includes(term);
        const matchDni = v.employee_dni.includes(term);
        const matchObs = (v.comments || '').toLowerCase().includes(term);
        if (!matchName && !matchDni && !matchObs) return false;
      }
      if (filterTipo !== 'ALL' && v.tipo !== filterTipo) return false;
      if (filterFechaDesde && v.start_date < filterFechaDesde) return false;
      if (filterFechaHasta && v.end_date > filterFechaHasta) return false;
      return true;
    });
  }, [vacaciones, searchTerm, filterTipo, filterFechaDesde, filterFechaHasta]);

  const sortedVacations = useMemo(() => {
    if (!sortField || !sortOrder) return filteredVacations;
    return [...filteredVacations].sort((a, b) => {
      let valA: any = a[sortField as keyof Vacacion] ?? '';
      let valB: any = b[sortField as keyof Vacacion] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredVacations, sortField, sortOrder]);

  const paginatedVacations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVacations.slice(start, start + pageSize);
  }, [sortedVacations, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setEditingVacation(null);
    setSelectedEmpDni(employees[0]?.dni || '');
    setTipo('PARCIAL');
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setTotalDays(1);
    setComments('');
    setShowModal(true);
  };

  const handleOpenEdit = (v: Vacacion) => {
    setEditingVacation(v);
    setSelectedEmpDni(v.employee_dni);
    setTipo(v.tipo);
    setStartDate(v.start_date);
    setEndDate(v.end_date);
    setTotalDays(v.total_days);
    setComments(v.comments || '');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.dni === selectedEmpDni);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado Registrado';

    if (editingVacation && onEditVacation) {
      onEditVacation({
        ...editingVacation,
        employee_dni: selectedEmpDni,
        employee_name: empName,
        tipo,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        comments,
      });
    } else {
      onAddVacation({
        employee_id: emp ? emp.id : 'emp-std-1',
        employee_dni: selectedEmpDni,
        employee_name: empName,
        tipo,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        period_year: 2026,
        status: 'APPROVED',
        approved_by_hr: 'Recursos Humanos DRAC',
        comments,
      });
    }

    setShowModal(false);
    setEditingVacation(null);
  };

  const isEditorRole =
    activeRole === 'HR_ADMIN' ||
    activeRole === 'SUPERVISOR' ||
    activeRole === 'ADMIN_GENERAL' ||
    activeRole === 'JEFE_RRHH';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Gestión de Vacaciones DRAC (Asignación Total y Fraccionada)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Las marcaciones en período vacacional autorizado se computan con estado oficial VACATION sin imputar faltas.
              </p>
            </div>
          </div>
        </div>

        {isEditorRole && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Programar Vacaciones</span>
          </button>
        )}
      </div>

      {/* Info Impact Banner */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong>Regla de Impacto en Asistencia:</strong> Durante los días marcados en vacaciones autorizadas, si el empleado no registra fichaje biométrico, el motor asigna automáticamente el estado <span className="text-indigo-400 font-mono font-bold">VACATION</span> en lugar de FALTA o TARDANZA.
        </div>
      </div>

      {/* Advanced Search & Multi-filter */}
      <AdvancedSearchFilter
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="🔍 Buscar por empleado, DNI, sustento..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      >
        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Tipo de Asignación</label>
          <select
            value={filterTipo}
            onChange={(e) => {
              setFilterTipo(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los Tipos</option>
            <option value="TOTAL_30">Total (30 días)</option>
            <option value="FRACCIONADO">Fraccionado</option>
            <option value="PARCIAL">Parcial</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Fecha Desde</label>
          <input
            type="date"
            value={filterFechaDesde}
            onChange={(e) => {
              setFilterFechaDesde(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Fecha Hasta</label>
          <input
            type="date"
            value={filterFechaHasta}
            onChange={(e) => {
              setFilterFechaHasta(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#090A0D] border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>
      </AdvancedSearchFilter>

      {/* Vacations Table */}
      <div className="bg-[#0F1115] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-[#090A0D] text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="w-[40px] px-2 py-3 text-center">#</th>
                <th className="w-[220px] px-3 py-3">
                  <SortableHeader
                    label="Empleado / DNI"
                    field="employee_name"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="w-[120px] px-3 py-3">
                  <SortableHeader
                    label="Tipo"
                    field="tipo"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="w-[180px] px-3 py-3">
                  <SortableHeader
                    label="Período de Descanso"
                    field="start_date"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="w-[80px] px-3 py-3 text-center">
                  <SortableHeader
                    label="Días"
                    field="total_days"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                    align="center"
                  />
                </th>
                <th className="w-[140px] px-3 py-3 hidden sm:table-cell">Aprobado RRHH</th>
                <th className="w-[180px] px-3 py-3">Observaciones</th>
                {isEditorRole && <th className="w-[85px] px-3 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {paginatedVacations.map((v, idx) => {
                const rowNum = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-2 py-3 text-center text-slate-500 font-mono text-[11px]">
                      {rowNum}
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{v.employee_name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">DNI: {v.employee_dni}</div>
                    </td>

                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold">
                        {v.tipo}
                      </span>
                    </td>

                    <td className="px-3 py-3 font-mono text-slate-300">
                      <span className="text-white font-bold">{v.start_date}</span> ➔ {v.end_date}
                    </td>

                    <td className="px-3 py-3 text-center font-mono font-bold text-indigo-300">
                      {v.total_days} días
                    </td>

                    <td className="px-3 py-3 text-slate-300 hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{v.approved_by_hr || 'RRHH DRAC'}</span>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-slate-400 text-[11px]">
                      <div className="truncate max-w-xs">{v.comments || 'Programación vacacional conforme'}</div>
                    </td>

                    {isEditorRole && (
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v)}
                            className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded transition-colors"
                            title="Editar período"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteVacation && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Eliminar programación vacacional de ${v.employee_name}?`)) {
                                  onDeleteVacation(v.id);
                                }
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded transition-colors"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredVacations.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No se encontraron programaciones vacacionales"
              description="Las vacaciones registradas para el personal institucional aparecerán en esta lista."
              isFiltered={activeFilterCount > 0 || Boolean(searchTerm)}
              onAction={handleResetFilters}
            />
          )}
        </div>

        {/* Reusable Pagination */}
        <DataTablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredVacations.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-400" />
                {editingVacation ? 'Editar Período Vacacional' : 'Programar Vacaciones'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Empleado</label>
                <select
                  value={selectedEmpDni}
                  onChange={(e) => setSelectedEmpDni(e.target.value)}
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.dni}>
                      {e.first_name} {e.last_name} (DNI: {e.dni}) - {e.area_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Modalidad</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as VacacionTipo)}
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                >
                  <option value="TOTAL_30">Total Completo (30 días)</option>
                  <option value="FRACCIONADO">Fraccionado (15 / 7 días)</option>
                  <option value="PARCIAL">Parcial (Días específicos)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Fecha Inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Fecha Fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Días Calendario Computables</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded font-mono focus:border-indigo-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Resolución / Documento de Aprobación</label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Ej: Resolución Directoral N° 045-2026-GR.CAJ/DRA..."
                  className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition-colors shadow-sm"
              >
                Guardar Asignación
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
