import React, { useState } from 'react';
import { Vacacion, VacacionTipo, Employee, RoleType } from '../../types';
import { CalendarDays, Plus, CheckCircle2, User, Info, Edit2, Trash2, X } from 'lucide-react';

interface VacationsModuleProps {
  vacaciones: Vacacion[];
  employees: Employee[];
  activeRole: RoleType;
  onAddVacation: (vacation: Omit<Vacacion, 'id' | 'created_at'>) => void;
  onEditVacation?: (vacation: Vacacion) => void;
  onDeleteVacation?: (vacationId: string) => void;
}

export const VacationsModule: React.FC<VacationsModuleProps> = ({
  vacaciones,
  employees,
  activeRole,
  onAddVacation,
  onEditVacation,
  onDeleteVacation,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingVacation, setEditingVacation] = useState<Vacacion | null>(null);

  const [selectedEmpDni, setSelectedEmpDni] = useState(employees[0]?.dni || '71234567');
  const [tipo, setTipo] = useState<VacacionTipo>('PARCIAL');
  const [startDate, setStartDate] = useState('2026-08-25');
  const [endDate, setEndDate] = useState('2026-08-27');
  const [totalDays, setTotalDays] = useState(3);
  const [comments, setComments] = useState('Permiso de vacación fraccionada autorizada por RRHH.');

  const handleOpenAdd = () => {
    setEditingVacation(null);
    setSelectedEmpDni(employees[0]?.dni || '71234567');
    setTipo('PARCIAL');
    setStartDate('2026-08-25');
    setEndDate('2026-08-27');
    setTotalDays(3);
    setComments('Permiso de vacación fraccionada autorizada por RRHH.');
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
        approved_by_hr: 'María Silva (RRHH)',
        comments,
      });
    }

    setShowModal(false);
    setEditingVacation(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Gestión de Vacaciones (Asignación Total y Parcial)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Las marcaciones en período vacacional autorizado se suprimen de faltas/tardanzas en el cálculo diario de asistencia.
          </p>
        </div>

        {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Programar Vacaciones</span>
          </button>
        )}
      </div>

      {/* Info Impact Banner */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong>Regla de Impacto en Asistencia:</strong> Durante los días marcados en vacaciones autorizadas, si el empleado no registra fichaje biométrico, el motor asigna automáticamente el estado <span className="text-indigo-400 font-mono font-bold">VACATION</span> en lugar de FALTA o TARDANZA.
        </div>
      </div>

      {/* Vacations Table */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Tipo Asignación</th>
                <th className="px-4 py-3">Período de Descanso</th>
                <th className="px-4 py-3">Días Totales</th>
                <th className="px-4 py-3">Aprobado por RRHH</th>
                <th className="px-4 py-3">Observaciones / Sustento</th>
                {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
                  <th className="px-4 py-3 text-right">Acciones Admin</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {vacaciones.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{v.employee_name}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">DNI: {v.employee_dni}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border font-mono ${
                      v.tipo === 'TOTAL' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-500/10 text-slate-300 border-slate-500/20'
                    }`}>
                      {v.tipo === 'TOTAL' ? 'TOTAL (30 DÍAS LEY)' : 'PARCIAL (FRACCIONADA)'}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                    {v.start_date} al {v.end_date}
                  </td>

                  <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                    {v.total_days} días
                  </td>

                  <td className="px-4 py-3 text-emerald-500 font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{v.approved_by_hr || 'RRHH Admin'}</span>
                  </td>

                  <td className="px-4 py-3 text-slate-400 text-[11px] max-w-xs truncate">
                    {v.comments}
                  </td>

                  {(activeRole === 'HR_ADMIN' || activeRole === 'SUPERVISOR') && (
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[11px] font-semibold border border-indigo-500/30 transition-colors inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Desea cancelar las vacaciones de ${v.employee_name}?`) && onDeleteVacation) {
                            onDeleteVacation(v.id);
                          }
                        }}
                        className="px-2 py-1 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded text-[11px] font-semibold border border-rose-500/20 transition-colors inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Cancelar</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Vacation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-[#0F1115] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">
                {editingVacation ? 'Editar Registro de Vacaciones' : 'Programar Vacaciones para Empleado'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Seleccionar Empleado</label>
              <select
                value={selectedEmpDni}
                onChange={(e) => setSelectedEmpDni(e.target.value)}
                className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.dni}>
                    {e.first_name} {e.last_name} (DNI: {e.dni})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Tipo de Vacación</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as VacacionTipo)}
                className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
              >
                <option value="PARCIAL">PARCIAL (Fraccionamiento de Días)</option>
                <option value="TOTAL">TOTAL (Período Completo de Ley - 30 días)</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fecha Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono text-[11px] focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fecha Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono text-[11px] focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Cant. Días</label>
                <input
                  type="number"
                  min={1}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-[#090A0D] text-white border border-slate-800 rounded font-mono text-[11px] focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Sustento / Comentario RRHH</label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-3 py-2 bg-[#090A0D] text-white border border-slate-800 rounded focus:border-indigo-600 focus:outline-none"
              />
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
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition-colors"
              >
                {editingVacation ? 'Actualizar Vacaciones' : 'Guardar Vacaciones'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
