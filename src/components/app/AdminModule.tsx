import React, { useState, useMemo } from 'react';
import { AuditLog, RoleType, Employee } from '../../types';
import { Shield, Lock, FileSpreadsheet, User, Key, Search, Clock, Building2, UserCheck, ShieldAlert, Filter, UserCog, Eye, EyeOff, Info, X, Edit2 } from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter, FilterField, FilterSelect, FilterDateRange } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';
import { hashPassword } from '../../utils/userAuthUtils';

interface AdminModuleProps {
  auditLogs: AuditLog[];
  employees: Employee[];
  activeRole: RoleType;
  subTab: 'USERS' | 'ROLES' | 'AUDIT';
  onEditEmployee?: (emp: Employee) => void;
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  auditLogs,
  employees,
  activeRole,
  subTab,
  onEditEmployee,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES' | 'AUDIT'>(subTab || 'USERS');

  // USERS TAB SEARCH, FILTER, SORT & PAGINATION
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userAreaFilter, setUserAreaFilter] = useState('ALL');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(15);
  const [userSortField, setUserSortField] = useState<string | null>('first_name');
  const [userSortOrder, setUserSortOrder] = useState<SortOrder>('asc');

  // Password reset modal state
  const [selectedEmpForReset, setSelectedEmpForReset] = useState<Employee | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('123456');
  const [showResetEye, setShowResetEye] = useState(false);

  // User Edit Modal State
  const [selectedEmpForEdit, setSelectedEmpForEdit] = useState<Employee | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>('TRABAJADOR');
  const [editUserActive, setEditUserActive] = useState<boolean>(true);
  const [editUserUsername, setEditUserUsername] = useState<string>('');

  // AUDIT TAB SEARCH, FILTER, SORT & PAGINATION
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditDateDesde, setAuditDateDesde] = useState('');
  const [auditDateHasta, setAuditDateHasta] = useState('');
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);
  const [auditSortField, setAuditSortField] = useState<string | null>('timestamp');
  const [auditSortOrder, setAuditSortOrder] = useState<SortOrder>('desc');

  // Unique Areas for Users Filter
  const userUniqueAreas = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.area_name) set.add(e.area_name);
    });
    return Array.from(set);
  }, [employees]);

  // Unique Modules for Audit Filter
  const auditUniqueModules = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set);
  }, [auditLogs]);

  // Unique Actions for Audit Filter
  const auditUniqueActions = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set);
  }, [auditLogs]);

  // User Filter Calculation
  const activeUserFilterCount = useMemo(() => {
    let count = 0;
    if (userRoleFilter !== 'ALL') count++;
    if (userAreaFilter !== 'ALL') count++;
    return count;
  }, [userRoleFilter, userAreaFilter]);

  const handleResetUserFilters = () => {
    setUserSearchTerm('');
    setUserRoleFilter('ALL');
    setUserAreaFilter('ALL');
    setUserCurrentPage(1);
  };

  const handleUserSort = (field: string) => {
    if (userSortField === field) {
      if (userSortOrder === 'asc') setUserSortOrder('desc');
      else if (userSortOrder === 'desc') {
        setUserSortField(null);
        setUserSortOrder(null);
      }
    } else {
      setUserSortField(field);
      setUserSortOrder('asc');
    }
    setUserCurrentPage(1);
  };

  const filteredUsers = useMemo(() => {
    return employees.filter((emp) => {
      if (userSearchTerm.trim()) {
        const term = userSearchTerm.toLowerCase().trim();
        const matchDni = emp.dni.toLowerCase().includes(term);
        const matchName = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term);
        const matchArea = (emp.area_name || '').toLowerCase().includes(term);
        const matchCargo = (emp.cargo_name || '').toLowerCase().includes(term);
        const matchRole = emp.role.toLowerCase().includes(term);
        if (!matchDni && !matchName && !matchArea && !matchCargo && !matchRole) return false;
      }
      if (userRoleFilter !== 'ALL' && emp.role !== userRoleFilter) return false;
      if (userAreaFilter !== 'ALL' && emp.area_name !== userAreaFilter) return false;
      return true;
    });
  }, [employees, userSearchTerm, userRoleFilter, userAreaFilter]);

  const sortedUsers = useMemo(() => {
    if (!userSortField || !userSortOrder) return filteredUsers;
    return [...filteredUsers].sort((a: any, b: any) => {
      let valA = a[userSortField] ?? '';
      let valB = b[userSortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, userSortField, userSortOrder]);

  const paginatedUsers = useMemo(() => {
    const start = (userCurrentPage - 1) * userPageSize;
    return sortedUsers.slice(start, start + userPageSize);
  }, [sortedUsers, userCurrentPage, userPageSize]);

  // Audit Filter Calculation
  const activeAuditFilterCount = useMemo(() => {
    let count = 0;
    if (auditModuleFilter !== 'ALL') count++;
    if (auditActionFilter !== 'ALL') count++;
    if (auditDateDesde) count++;
    if (auditDateHasta) count++;
    return count;
  }, [auditModuleFilter, auditActionFilter, auditDateDesde, auditDateHasta]);

  const handleResetAuditFilters = () => {
    setAuditSearchTerm('');
    setAuditModuleFilter('ALL');
    setAuditActionFilter('ALL');
    setAuditDateDesde('');
    setAuditDateHasta('');
    setAuditCurrentPage(1);
  };

  const handleAuditSort = (field: string) => {
    if (auditSortField === field) {
      if (auditSortOrder === 'asc') setAuditSortOrder('desc');
      else if (auditSortOrder === 'desc') {
        setAuditSortField(null);
        setAuditSortOrder(null);
      }
    } else {
      setAuditSortField(field);
      setAuditSortOrder('asc');
    }
    setAuditCurrentPage(1);
  };

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditSearchTerm.trim()) {
        const term = auditSearchTerm.toLowerCase().trim();
        const matchUser = log.user_name.toLowerCase().includes(term);
        const matchModule = log.module.toLowerCase().includes(term);
        const matchAction = log.action.toLowerCase().includes(term);
        const matchDetails = log.details.toLowerCase().includes(term);
        const matchRole = log.role.toLowerCase().includes(term);
        if (!matchUser && !matchModule && !matchAction && !matchDetails && !matchRole) return false;
      }
      if (auditModuleFilter !== 'ALL' && log.module !== auditModuleFilter) return false;
      if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
      if (auditDateDesde && log.timestamp < auditDateDesde) return false;
      if (auditDateHasta && log.timestamp > auditDateHasta + 'T23:59:59') return false;
      return true;
    });
  }, [auditLogs, auditSearchTerm, auditModuleFilter, auditActionFilter, auditDateDesde, auditDateHasta]);

  const sortedLogs = useMemo(() => {
    if (!auditSortField || !auditSortOrder) return filteredLogs;
    return [...filteredLogs].sort((a: any, b: any) => {
      let valA = a[auditSortField] ?? '';
      let valB = b[auditSortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return auditSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return auditSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, auditSortField, auditSortOrder]);

  const paginatedLogs = useMemo(() => {
    const start = (auditCurrentPage - 1) * auditPageSize;
    return sortedLogs.slice(start, start + auditPageSize);
  }, [sortedLogs, auditCurrentPage, auditPageSize]);

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
          Gestión de Usuarios DRAC ({employees.length})
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
          Auditoría de Acciones y Cambios ({auditLogs.length})
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
                Cuentas de usuario registradas vinculadas al personal DRAC con control de acceso por roles.
              </p>
            </div>
          </div>

          {/* Advanced Search & Filter */}
          <AdvancedSearchFilter
            searchTerm={userSearchTerm}
            onSearchChange={(val) => {
              setUserSearchTerm(val);
              setUserCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar usuario por DNI, nombres, área, cargo o rol..."
            activeFilterCount={activeUserFilterCount}
            onResetFilters={handleResetUserFilters}
          >
            <FilterField label="Rol del Usuario">
              <FilterSelect
                value={userRoleFilter}
                onChange={(val) => {
                  setUserRoleFilter(val);
                  setUserCurrentPage(1);
                }}
                placeholder="Todos los Roles"
                options={[
                  { value: 'ADMIN_GENERAL', label: 'ADMIN_GENERAL (Administrador General)' },
                  { value: 'JEFE_RRHH', label: 'JEFE_RRHH (Jefe de Recursos Humanos)' },
                  { value: 'DIRECTOR_GENERAL', label: 'DIRECTOR_GENERAL (Director General Regional)' },
                  { value: 'JEFE', label: 'JEFE (Jefe de Dirección / Unidad)' },
                  { value: 'VIGILANCIA', label: 'VIGILANCIA (Garita y Seguridad)' },
                  { value: 'CONTROL_ASISTENCIA', label: 'CONTROL_ASISTENCIA (Control Asistencia)' },
                  { value: 'TRABAJADOR', label: 'TRABAJADOR (Servidor Base)' },
                  { value: 'EMPLOYEE', label: 'EMPLOYEE (Empleado)' },
                ]}
              />
            </FilterField>

            <FilterField label="Área / Oficina">
              <FilterSelect
                value={userAreaFilter}
                onChange={(val) => {
                  setUserAreaFilter(val);
                  setUserCurrentPage(1);
                }}
                placeholder="Todas las Áreas"
                options={userUniqueAreas.map((area) => ({ value: area, label: area }))}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={User}
              title="No se encontraron usuarios institucionales"
              description="No hay cuentas de usuario que coincidan con los criterios de búsqueda o filtros aplicados."
              isFiltered={Boolean(userSearchTerm.trim()) || activeUserFilterCount > 0}
              onAction={handleResetUserFilters}
            />
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <SortableHeader
                        label="DNI"
                        field="dni"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Usuario (@)"
                        field="username"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Nombres y Apellidos"
                        field="first_name"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Área DRAC"
                        field="area_name"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Rol del Sistema"
                        field="role"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <th className="p-3 text-slate-400">Seguridad / 1er Ingreso</th>
                      <th className="p-3 text-slate-400">Estado</th>
                      <th className="p-3 text-right text-slate-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {paginatedUsers.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-mono text-indigo-400 font-bold">{emp.dni}</td>
                        <td className="p-3 font-mono text-slate-200">
                          <span className="text-indigo-400 font-bold">@{emp.username || (emp.first_name ? `${emp.first_name.charAt(0).toLowerCase()}${emp.last_name.split(' ')[0].toLowerCase()}` : emp.dni)}</span>
                        </td>
                        <td className="p-3 font-bold text-white">{emp.first_name} {emp.last_name}</td>
                        <td className="p-3 text-slate-400">{emp.area_name || 'Sin Asignar'}</td>
                        <td className="p-3 font-semibold text-indigo-300">
                          <span className="px-2 py-0.5 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-bold">
                            {emp.role}
                          </span>
                        </td>
                        <td className="p-3">
                          {emp.primer_ingreso === 'PENDIENTE' || emp.password_change_required ? (
                            <span className="px-2 py-0.5 text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded font-semibold inline-flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Pendiente</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded font-semibold inline-flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" />
                              <span>Completado</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                            emp.active !== false ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {emp.active !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedEmpForEdit(emp);
                                setEditUserRole(emp.role || 'TRABAJADOR');
                                setEditUserActive(emp.active !== false);
                                setEditUserUsername(emp.username || emp.dni);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded transition-colors"
                              title="Editar Perfil y Roles de Acceso"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedEmpForReset(emp);
                                setResetPasswordValue('123456');
                                setShowResetEye(false);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors"
                              title="Restablecer Contraseña Temporal y Forzar 1er Ingreso"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DataTablePagination
                currentPage={userCurrentPage}
                pageSize={userPageSize}
                totalItems={filteredUsers.length}
                onPageChange={setUserCurrentPage}
                onPageSizeChange={(newSize) => {
                  setUserPageSize(newSize);
                  setUserCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ROLES TAB */}
      {activeSubTab === 'ROLES' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Matriz General de Roles y Ámbitos Organizacionales (DRAC)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Políticas institucionales de mínimo privilegio y delimitación de alcance para la Dirección Regional de Agricultura Cajamarca.
            </p>
          </div>

          {/* Cards for 7 roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-indigo-600 text-white font-bold rounded-lg">
                  1. Administrador General
                </span>
                <span className="text-[10px] text-indigo-400 font-mono font-bold">ADMIN_GENERAL</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Toda la Entidad</div>
                <div><strong className="text-white">Alcance:</strong> Módulos, usuarios, roles, parámetros, biométricos ZKTeco y auditoría.</div>
                <div className="text-amber-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  ⚠️ Restricción: No modifica marcaciones biométricas crudas ni registros históricos cerrados sin auditoría.
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-slate-700 text-white font-bold rounded-lg">
                  2. Trabajador Base
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-bold">TRABAJADOR</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Información Personal</div>
                <div><strong className="text-white">Alcance:</strong> Consulta asistencia propia, solicita papeletas de salida y consulta saldo vacacional.</div>
                <div className="text-emerald-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  ✓ Acceso autoservicio con firma digital.
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-amber-600 text-white font-bold rounded-lg">
                  3. Jefe / Responsable
                </span>
                <span className="text-[10px] text-amber-400 font-mono font-bold">JEFE</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Su Dirección / Área</div>
                <div><strong className="text-white">Alcance:</strong> VoBo 1º nivel de papeletas del personal de su unidad y consulta asistencia de equipo.</div>
                <div className="text-amber-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  🚫 Restricción: No aprueba papeletas de personal de otras Direcciones.
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-blue-600 text-white font-bold rounded-lg">
                  4. Jefe de Recursos Humanos
                </span>
                <span className="text-[10px] text-blue-400 font-mono font-bold">JEFE_RRHH</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Toda la Entidad</div>
                <div><strong className="text-white">Alcance:</strong> VoBo 2º nivel de papeletas, gestión global de personal, legajos y aprobaciones.</div>
                <div className="text-blue-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  ✓ Autorización institucional final.
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-emerald-600 text-white font-bold rounded-lg">
                  5. Vigilancia / Garita
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">VIGILANCIA</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Garita Principal DRAC</div>
                <div><strong className="text-white">Alcance:</strong> Registro de horas reales de salida y retorno de papeletas autorizadas del día.</div>
                <div className="text-emerald-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  ✓ Soporta "Salida sin retorno" para comisiones finales.
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-purple-600 text-white font-bold rounded-lg">
                  6. Director General
                </span>
                <span className="text-[10px] text-purple-400 font-mono font-bold">DIRECTOR_GENERAL</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Toda la Entidad / Directivos</div>
                <div><strong className="text-white">Alcance:</strong> VoBo 1º nivel a papeletas de Directores Regionales y Jefes de Órganos.</div>
                <div className="text-purple-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  ✓ Nivel de aprobación superior jerárquico.
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 text-[11px] bg-cyan-600 text-white font-bold rounded-lg">
                  7. Control de Asistencia
                </span>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">CONTROL_ASISTENCIA</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div><strong className="text-white">Ámbito:</strong> Toda la Entidad</div>
                <div><strong className="text-white">Alcance:</strong> Monitoreo de tardanzas, faltas, horas trabajadas y asignación de vacaciones.</div>
                <div className="text-cyan-400 font-semibold text-[10px] pt-1 border-t border-slate-800/80">
                  ✓ Control operativo y regularizaciones.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT TAB */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-bold text-sm text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Auditoría de Registro de Actividades</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Trazabilidad completa de modificaciones, creaciones y eliminaciones en el sistema.
              </p>
            </div>
          </div>

          {/* Advanced Search & Filter */}
          <AdvancedSearchFilter
            searchTerm={auditSearchTerm}
            onSearchChange={(val) => {
              setAuditSearchTerm(val);
              setAuditCurrentPage(1);
            }}
            searchPlaceholder="🔍 Buscar evento por usuario, rol, módulo, acción o detalles..."
            activeFilterCount={activeAuditFilterCount}
            onResetFilters={handleResetAuditFilters}
          >
            <FilterField label="Módulo Afectado">
              <FilterSelect
                value={auditModuleFilter}
                onChange={(val) => {
                  setAuditModuleFilter(val);
                  setAuditCurrentPage(1);
                }}
                placeholder="Todos los Módulos"
                options={auditUniqueModules.map((mod) => ({ value: mod, label: mod }))}
              />
            </FilterField>

            <FilterField label="Tipo de Acción">
              <FilterSelect
                value={auditActionFilter}
                onChange={(val) => {
                  setAuditActionFilter(val);
                  setAuditCurrentPage(1);
                }}
                placeholder="Todas las Acciones"
                options={auditUniqueActions.map((act) => ({ value: act, label: act }))}
              />
            </FilterField>

            <FilterField label="Rango de Fecha del Evento">
              <FilterDateRange
                startDate={auditDateDesde}
                endDate={auditDateHasta}
                onStartDateChange={(val) => {
                  setAuditDateDesde(val);
                  setAuditCurrentPage(1);
                }}
                onEndDateChange={(val) => {
                  setAuditDateHasta(val);
                  setAuditCurrentPage(1);
                }}
              />
            </FilterField>
          </AdvancedSearchFilter>

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No se encontraron eventos de auditoría"
              description="No hay registros de auditoría que cumplan con los criterios de búsqueda o filtros seleccionados."
              isFiltered={Boolean(auditSearchTerm.trim()) || activeAuditFilterCount > 0}
              onAction={handleResetAuditFilters}
            />
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
                      <SortableHeader
                        label="Fecha / Hora"
                        field="timestamp"
                        currentField={auditSortField}
                        currentOrder={auditSortOrder}
                        onSort={handleAuditSort}
                      />
                      <SortableHeader
                        label="Usuario Auditor"
                        field="user_name"
                        currentField={auditSortField}
                        currentOrder={auditSortOrder}
                        onSort={handleAuditSort}
                      />
                      <SortableHeader
                        label="Módulo"
                        field="module"
                        currentField={auditSortField}
                        currentOrder={auditSortOrder}
                        onSort={handleAuditSort}
                      />
                      <SortableHeader
                        label="Acción Realizada"
                        field="action"
                        currentField={auditSortField}
                        currentOrder={auditSortOrder}
                        onSort={handleAuditSort}
                      />
                      <th className="p-3 text-slate-400">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                    {paginatedLogs.map((log) => (
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

              <DataTablePagination
                currentPage={auditCurrentPage}
                pageSize={auditPageSize}
                totalItems={filteredLogs.length}
                onPageChange={setAuditCurrentPage}
                onPageSizeChange={(newSize) => {
                  setAuditPageSize(newSize);
                  setAuditCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* MODAL: RESTABLECER CONTRASEÑA (ADMINISTRADOR) */}
      {selectedEmpForReset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Restablecer Contraseña Institucional</h3>
                  <p className="text-[11px] text-slate-400">Administración Central de Cuentas DRAC</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmpForReset(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
                  {selectedEmpForReset.first_name[0]}
                  {selectedEmpForReset.last_name[0]}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white text-xs">
                    {selectedEmpForReset.first_name} {selectedEmpForReset.last_name}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono mt-0.5">
                    <span>DNI: {selectedEmpForReset.dni}</span>
                    <span>•</span>
                    <span className="text-indigo-400 font-bold">@{selectedEmpForReset.username || selectedEmpForReset.dni}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Obligatoriedad de Cambio en Primer Ingreso</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Al redefinir la contraseña temporal del usuario, su estado volverá a <strong>"Primer Ingreso: Pendiente"</strong>. Al autenticarse, se le exigirá configurar una contraseña robusta conforme a las directivas de seguridad.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200 text-xs">
                  Nueva Contraseña Temporal
                </label>
                <div className="relative">
                  <input
                    type={showResetEye ? 'text' : 'password'}
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Ej: 123456"
                    className="w-full bg-[#060709] border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetEye(!showResetEye)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showResetEye ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedEmpForReset(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!resetPasswordValue.trim()) {
                    alert('Por favor ingrese una contraseña temporal.');
                    return;
                  }
                  const { hash, salt } = await hashPassword(resetPasswordValue.trim());
                  if (onEditEmployee) {
                    onEditEmployee({
                      ...selectedEmpForReset,
                      password_hash: hash,
                      password_salt: salt,
                      password_change_required: true,
                      primer_ingreso: 'PENDIENTE',
                      last_password_change: undefined,
                    });
                  }
                  setSelectedEmpForReset(null);
                  alert(`✅ Contraseña temporal restablecida con éxito para @${selectedEmpForReset.username || selectedEmpForReset.dni}.\nSe solicitará cambio obligatorio en su próximo inicio de sesión.`);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-600/20"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Restablecer y Forzar 1er Ingreso</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER ROLES AND STATUS MODAL */}
      {selectedEmpForEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Editar Cuenta &amp; Rol Institucional
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedEmpForEdit.first_name} {selectedEmpForEdit.last_name} • DNI: {selectedEmpForEdit.dni}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmpForEdit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onEditEmployee && selectedEmpForEdit) {
                  onEditEmployee({
                    ...selectedEmpForEdit,
                    role: editUserRole as RoleType,
                    active: editUserActive,
                    username: editUserUsername.trim() || selectedEmpForEdit.dni,
                  });
                }
                setSelectedEmpForEdit(null);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value)}
                  placeholder="Ej: jperez"
                  className="w-full bg-[#060709] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Rol del Sistema (RBAC) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value)}
                  className="w-full bg-[#060709] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ADMIN_GENERAL">ADMIN_GENERAL - Administrador General del Sistema</option>
                  <option value="JEFE_RRHH">JEFE_RRHH - Jefe de Recursos Humanos</option>
                  <option value="DIRECTOR_GENERAL">DIRECTOR_GENERAL - Director General Regional DRAC</option>
                  <option value="JEFE">JEFE - Jefe de Dirección / Unidad (Aprobador)</option>
                  <option value="CONTROL_ASISTENCIA">CONTROL_ASISTENCIA - Especialista de Asistencia</option>
                  <option value="VIGILANCIA">VIGILANCIA - Seguridad y Garita</option>
                  <option value="TRABAJADOR">TRABAJADOR - Servidor Público Base</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Estado de la Cuenta
                </label>
                <select
                  value={editUserActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setEditUserActive(e.target.value === 'ACTIVE')}
                  className="w-full bg-[#060709] border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ACTIVE">🟢 Activo (Acceso Autorizado)</option>
                  <option value="INACTIVE">🔴 Inactivo (Acceso Suspendido / Baja)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEmpForEdit(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/20"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
