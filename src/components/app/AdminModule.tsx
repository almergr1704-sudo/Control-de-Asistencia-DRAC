import React, { useState } from 'react';
import { AuditLog, RoleType, Employee } from '../../types';
import { Shield, Lock, FileSpreadsheet, User, Key, Search, Clock, Building2 } from 'lucide-react';

interface AdminModuleProps {
  auditLogs: AuditLog[];
  employees: Employee[];
  activeRole: RoleType;
  subTab: 'USERS' | 'ROLES' | 'AUDIT';
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  auditLogs,
  employees,
  activeRole,
  subTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES' | 'AUDIT'>(subTab || 'USERS');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub navigation */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1.5 flex space-x-1">
        <button
          onClick={() => setActiveSubTab('USERS')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all ${
            activeSubTab === 'USERS'
              ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Gestión de Usuarios DRAC
        </button>
        <button
          onClick={() => setActiveSubTab('ROLES')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all ${
            activeSubTab === 'ROLES'
              ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Roles y Permisos
        </button>
        <button
          onClick={() => setActiveSubTab('AUDIT')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all ${
            activeSubTab === 'AUDIT'
              ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Auditoría de Acciones y Cambios
        </button>
      </div>

      {/* USERS TAB */}
      {activeSubTab === 'USERS' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-bold text-sm text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>Usuarios Institucionales DRAC</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cuentas de usuario registradas vinculadas al personal DRAC.
              </p>
            </div>
          </div>

          {employees.length === 0 ? (
            <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
              <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">No existen usuarios registrados para mostrar.</p>
              <span className="text-[11px] text-slate-500">Registre personal en el módulo Organización/Personal.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                    <th className="p-3">DNI / Usuario</th>
                    <th className="p-3">Nombres y Apellidos</th>
                    <th className="p-3">Área DRAC</th>
                    <th className="p-3">Cargo</th>
                    <th className="p-3">Rol asignado</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 font-mono text-indigo-400 font-bold">{emp.dni}</td>
                      <td className="p-3 font-bold text-white">{emp.first_name} {emp.last_name}</td>
                      <td className="p-3 text-slate-400">{emp.area_name || 'Sin Asignar'}</td>
                      <td className="p-3 text-slate-400">{emp.cargo_name || 'Servidor Público'}</td>
                      <td className="p-3 font-semibold text-emerald-400">{emp.system_role || 'EMPLOYEE'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-semibold">
                          Activo
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

      {/* ROLES TAB */}
      {activeSubTab === 'ROLES' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Matriz de Roles y Permisos Institucionales</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Políticas de acceso según el perfil del usuario en la DRAC.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="px-2 py-0.5 text-[10px] bg-indigo-600 text-white font-bold rounded">
                Admin RRHH (HR_ADMIN)
              </span>
              <p className="text-xs text-slate-300">Control total sobre áreas, personal, turnos, asistencias y configuraciones.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="px-2 py-0.5 text-[10px] bg-amber-600 text-white font-bold rounded">
                Jefe de Área (SUPERVISOR)
              </span>
              <p className="text-xs text-slate-300">Aprobación de papeletas, vista de asistencia de subordinados y vacacionales.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="px-2 py-0.5 text-[10px] bg-slate-700 text-white font-bold rounded">
                Trabajador (EMPLOYEE)
              </span>
              <p className="text-xs text-slate-300">Consulta de asistencia personal, solicitud de papeletas y vacaciones.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="px-2 py-0.5 text-[10px] bg-emerald-600 text-white font-bold rounded">
                Vigilancia (SECURITY_GUARD)
              </span>
              <p className="text-xs text-slate-300">Registro de hora real de salida y retorno en Garita principal DRAC.</p>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT TAB */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-bold text-sm text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Auditoría de Registro de Actividades</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Trazabilidad completa de modificaciones, creaciones y eliminaciones en el sistema.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar en auditoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#060709] text-white border border-slate-800 rounded text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-[#060709] rounded-lg border border-slate-800/60">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">No existen registros para mostrar.</p>
              <span className="text-[11px] text-slate-500">No hay eventos auditados registrados aún.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                    <th className="p-3">Fecha / Hora</th>
                    <th className="p-3">Usuario Auditor</th>
                    <th className="p-3">Módulo</th>
                    <th className="p-3">Acción Realizada</th>
                    <th className="p-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-white whitespace-nowrap">
                        {log.user_name} ({log.role})
                      </td>
                      <td className="p-3 text-indigo-400 font-bold whitespace-nowrap">{log.module}</td>
                      <td className="p-3 text-emerald-400 font-bold whitespace-nowrap">{log.action}</td>
                      <td className="p-3 text-slate-300 max-w-xs truncate">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
