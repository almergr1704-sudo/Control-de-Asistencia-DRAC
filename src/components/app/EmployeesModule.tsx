import React, { useState, useMemo } from 'react';
import { Employee } from '../../types';
import { Users, Search, Filter, ShieldCheck, Mail, Phone, Briefcase, Building2 } from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';

interface EmployeesModuleProps {
  employees: Employee[];
  activeRole: string;
}

export const EmployeesModule: React.FC<EmployeesModuleProps> = ({ employees, activeRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [regimenFilter, setRegimenFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (regimenFilter !== 'ALL' && emp.regimen_laboral !== regimenFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        const matchDni = emp.dni.includes(term);
        const matchCargo = emp.cargo.toLowerCase().includes(term);
        const matchDep = emp.dependencia_name.toLowerCase().includes(term);
        if (!fullName.includes(term) && !matchDni && !matchCargo && !matchDep) return false;
      }
      return true;
    });
  }, [employees, searchTerm, regimenFilter]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#090A0D] border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
            <Users className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Padrón Institucional de Servidores DRAC</span>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] rounded-full font-mono">
                {employees.length} Personal Enrolado
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Directorio de servidores civiles vinculados al identificador biométrico ZKTeco.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs bg-[#0F1115] border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por DNI, nombre, cargo o dependencia..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={regimenFilter}
            onChange={(e) => {
              setRegimenFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs outline-none"
          >
            <option value="ALL">Todos los Regímenes</option>
            <option value="D.L. 276">D.L. 276 (Carrera Pública)</option>
            <option value="D.L. 728">D.L. 728 (Régimen Privado)</option>
            <option value="D.L. 1057 (CAS)">D.L. 1057 (CAS)</option>
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          {filteredEmployees.length} trabajadores listados
        </span>
      </div>

      {/* Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F1115]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#090A0D] text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">DNI / PIN</th>
                <th className="py-2.5 px-3">Servidor Civil</th>
                <th className="py-2.5 px-3">Régimen Laboral</th>
                <th className="py-2.5 px-3">Cargo Institucional</th>
                <th className="py-2.5 px-3">Dependencia</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                    {emp.dni}
                    <span className="block text-[10px] text-slate-500 font-normal">PIN: {emp.zkteco_pin || emp.dni}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-white block">{emp.first_name} {emp.last_name}</span>
                    <span className="text-[11px] text-slate-400">{emp.email}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {emp.regimen_laboral}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{emp.cargo}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    <span className="block text-slate-200">{emp.dependencia_name}</span>
                    <span>{emp.area_name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {emp.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataTablePagination
          currentPage={currentPage}
          totalItems={filteredEmployees.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
