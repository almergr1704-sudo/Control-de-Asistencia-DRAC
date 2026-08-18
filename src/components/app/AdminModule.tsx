import React, { useState, useMemo } from 'react';
import { AuditLog, RoleType, Employee } from '../../types';
import { Shield, Lock, FileSpreadsheet, User, Key, Search, Clock, Building2, UserCheck, ShieldAlert, Filter } from 'lucide-react';
import { DataTablePagination } from '../common/DataTablePagination';
import { SortableHeader, SortOrder } from '../common/SortableHeader';
import { AdvancedSearchFilter, FilterField, FilterSelect, FilterDateRange } from '../common/AdvancedSearchFilter';
import { EmptyState } from '../common/EmptyState';

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

  // USERS TAB SEARCH, FILTER, SORT & PAGINATION
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userAreaFilter, setUserAreaFilter] = useState('ALL');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(15);
  const [userSortField, setUserSortField] = useState<string | null>('first_name');
  const [userSortOrder, setUserSortOrder] = useState<SortOrder>('asc');

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
                        label="DNI / Usuario"
                        field="dni"
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
                        label="Cargo"
                        field="cargo_name"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Rol Asignado"
                        field="role"
                        currentField={userSortField}
                        currentOrder={userSortOrder}
                        onSort={handleUserSort}
                      />
                      <th className="p-3 text-slate-400">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {paginatedUsers.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-mono text-indigo-400 font-bold">{emp.dni}</td>
                        <td className="p-3 font-bold text-white">{emp.first_name} {emp.last_name}</td>
                        <td className="p-3 text-slate-400">{emp.area_name || 'Sin Asignar'}</td>
                        <td className="p-3 text-slate-400">{emp.cargo_name || 'Servidor Público'}</td>
                        <td className="p-3 font-semibold text-indigo-300">
                          <span className="px-2 py-0.5 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-bold">
                            {emp.role}
                          </span>
                        </td>
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
    </div>
  );
};
