import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OperationalDashboard } from './components/app/OperationalDashboard';
import { AttendanceModule } from './components/app/AttendanceModule';
import { PapeletasModule } from './components/app/PapeletasModule';
import { VacationsModule } from './components/app/VacationsModule';
import { ShiftsSchedulesModule } from './components/app/ShiftsSchedulesModule';
import { DevicesModule } from './components/app/DevicesModule';
import { OrgPersonnelModule } from './components/app/OrgPersonnelModule';
import { EncargaturasModule } from './components/app/EncargaturasModule';
import { ReportsModule } from './components/app/ReportsModule';
import { AdminModule } from './components/app/AdminModule';
import { ConfigModule } from './components/app/ConfigModule';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';
import { LoginPage } from './components/auth/LoginPage';
import { UserProfileModal } from './components/auth/UserProfileModal';
import { UnauthorizedView } from './components/common/UnauthorizedView';
import { getViewFromHash, VIEW_TO_HASH, isViewAllowedForRole } from './utils/router';
import { getEmployeeAssignedRoles } from './utils/userAuthUtils';

import {
  INITIAL_DEPENDENCIAS,
  INITIAL_DIRECCIONES_ORGANOS,
  INITIAL_AREAS,
  INITIAL_CARGOS,
  INITIAL_RESPONSABLES,
  INITIAL_TURNOS,
  INITIAL_HORARIOS,
  INITIAL_EMPLOYEES,
  INITIAL_DEVICES,
  INITIAL_RAW_PUNCHES,
  INITIAL_PAPELETAS,
  INITIAL_ENCARGATURAS,
  INITIAL_PAPELETA_AUDITS,
  INITIAL_VACACIONES,
  INITIAL_ATTENDANCE,
  INITIAL_AUDIT_LOGS,
} from './data/initialData';

import {
  fetchDependenciasFromSupabase,
  saveDependenciaToSupabase,
  fetchDireccionesFromSupabase,
  saveDireccionToSupabase,
  fetchAreasFromSupabase,
  saveAreaToSupabase,
  fetchCargosFromSupabase,
} from './services/organizationService';

import {
  fetchEmployeesFromSupabase,
  saveEmployeeToSupabase,
  getNextDracCodeFromPostgres,
} from './services/employeeService';
import { initiateDesktopDownload } from './utils/desktopDownloadUtils';

import {
  fetchTurnosFromSupabase,
  saveTurnoToSupabase,
  fetchHorariosFromSupabase,
  saveHorarioToSupabase,
  assignHorarioToEmployeeInSupabase,
} from './services/scheduleService';

import {
  fetchEncargaturasFromSupabase,
  saveEncargaturaToSupabase,
  deleteEncargaturaInSupabase,
  fetchVacacionesFromSupabase,
  saveVacacionToSupabase,
  deleteVacacionInSupabase,
  fetchPapeletasFromSupabase,
  savePapeletaToSupabase,
} from './services/permitsService';

import {
  fetchDevicesFromSupabase,
  saveDeviceToSupabase,
  deleteDeviceInSupabase,
  fetchRawPunchesFromSupabase,
  saveRawPunchToSupabase,
  bulkSaveRawPunchesToSupabase,
  fetchAttendanceFromSupabase,
  saveAttendanceToSupabase,
  fetchAuditLogsFromSupabase,
  logAuditEventToSupabase,
} from './services/attendanceService';

import {
  RoleType,
  Dependencia,
  DireccionOrgano,
  Cargo,
  ResponsableDesignation,
  PapeletaSalida,
  PapeletaStatus,
  PapeletaAudit,
  Vacacion,
  AsistenciaProcesada,
  Area,
  Employee,
  Encargatura,
  Turno,
  Horario,
  DispositivoZkTeco,
  MarcacionRaw,
  PunchValidationStatus,
  AutorizacionMarcacionTemporal,
  AuditLog,
  EmployeeAssignmentHistory,
  MarcacionCorrection,
  AsistenciaCorrectionLog,
} from './types';

export default function App() {
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  // Persistent Storage Helper
  const loadStored = <T,>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(`drac_data_${key}`);
      if (!item) return fallback;
      const parsed = JSON.parse(item);
      return parsed;
    } catch {
      return fallback;
    }
  };

  // State Entities - DRAC Structure
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const stored = loadStored<Employee[]>('employees', INITIAL_EMPLOYEES);
    let list: Employee[] = [];
    if (!stored || stored.length === 0) {
      list = INITIAL_EMPLOYEES;
    } else {
      // Preserve all existing real employees while ensuring the admin account exists
      const hasAdmin = stored.some((e) => e.username === 'admin' || e.id === 'emp-01');
      if (!hasAdmin) {
        list = [INITIAL_EMPLOYEES[0], ...stored];
      } else {
        list = stored.map((e) => {
          if (e.id === 'emp-01' || e.username === 'admin') {
            return {
              ...e,
              username: 'admin',
              role: 'ADMIN_GENERAL',
              has_system_access: true,
              account_status: 'ACTIVE',
              active: true,
            };
          }
          return e;
        });
      }
    }
    return list;
  });

  // User Session Management
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const stored = localStorage.getItem('drac_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.currentUser) {
          return parsed.currentUser;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeRole, setActiveRole] = useState<RoleType>(() => {
    try {
      const stored = localStorage.getItem('drac_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.activeRole) return parsed.activeRole;
      }
    } catch {}
    return 'ADMIN_GENERAL';
  });

  const [activeUserDni, setActiveUserDni] = useState<string>(() => {
    return currentUser?.dni || '10000001';
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [activeView, setActiveView] = useState<string>(() =>
    getViewFromHash(window.location.hash, activeRole)
  );

  const handleNavigate = (viewId: string) => {
    if (!isViewAllowedForRole(viewId, activeRole)) return;
    setActiveView(viewId);
    const targetHash = VIEW_TO_HASH[viewId] || '#/dashboard';
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  const handleRoleChange = (role: RoleType) => {
    setActiveRole(role);
    if (currentUser) {
      localStorage.setItem(
        'drac_auth_session',
        JSON.stringify({
          currentUser,
          activeRole: role,
        })
      );
    }
    const allowedView = getViewFromHash(window.location.hash, role);
    setActiveView(allowedView);
    window.location.hash = VIEW_TO_HASH[allowedView] || '#/dashboard';
  };

  const handleLoginSuccess = (
    employee: Employee,
    selectedRole: RoleType,
    requiresPasswordChange: boolean
  ) => {
    setCurrentUser(employee);
    setActiveRole(selectedRole);
    setActiveUserDni(employee.dni);
    localStorage.setItem(
      'drac_auth_session',
      JSON.stringify({
        currentUser: employee,
        activeRole: selectedRole,
        loginTime: new Date().toISOString(),
      })
    );
    const targetHash = VIEW_TO_HASH['dash_overview'] || '#/dashboard';
    window.location.hash = targetHash;
    setActiveView('dash_overview');
  };

  const handleLogout = () => {
    if (currentUser) {
      const newLog: AuditLog = {
        id: `audlog-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_id: currentUser.dni,
        user_name: `${currentUser.first_name} ${currentUser.last_name}`,
        role: activeRole,
        module: 'AUTENTICACION',
        action: 'LOGOUT',
        affected_record_id: currentUser.dni,
        details: `Cierre de sesión de ${currentUser.first_name} ${currentUser.last_name} (@${currentUser.username || currentUser.dni})`,
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    }
    setCurrentUser(null);
    localStorage.removeItem('drac_auth_session');
    window.location.hash = '#/dashboard';
  };

  // Check if active user gets deactivated or changed
  useEffect(() => {
    if (currentUser) {
      const freshRecord = employees.find(
        (e) => e.id === currentUser.id || e.dni === currentUser.dni
      );
      if (freshRecord) {
        if (freshRecord.active === false || freshRecord.account_status === 'INACTIVE') {
          // Invalidate session immediately
          setCurrentUser(null);
          localStorage.removeItem('drac_auth_session');
        } else if (
          freshRecord.password_change_required !== currentUser.password_change_required ||
          freshRecord.primer_ingreso !== currentUser.primer_ingreso ||
          freshRecord.role !== currentUser.role
        ) {
          setCurrentUser(freshRecord);
        }
      }
    }
  }, [employees]);

  useEffect(() => {
    const handleHashChange = () => {
      const view = getViewFromHash(window.location.hash, activeRole);
      setActiveView(view);
    };

    window.addEventListener('hashchange', handleHashChange);

    if (!window.location.hash || window.location.hash === '#/') {
      window.location.hash = VIEW_TO_HASH[activeView] || '#/dashboard';
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [activeRole]);

  // State Entities - DRAC Structure
  const [dependencias, setDependencias] = useState<Dependencia[]>(() => {
    const raw = loadStored<Dependencia[]>('dependencias', INITIAL_DEPENDENCIAS);
    // Migración automática y merge con INITIAL_DEPENDENCIAS
    const existing = (raw || []).map((dep: any) => {
      if (dep.type === 'OFICINA_AGRARIA') {
        return { ...dep, type: 'AGENCIA_AGRARIA' as const };
      }
      return dep;
    });
    const map = new Map<string, Dependencia>();
    INITIAL_DEPENDENCIAS.forEach((d) => map.set(d.id, d));
    existing.forEach((d) => map.set(d.id, { ...(map.get(d.id) || {}), ...d }));
    return Array.from(map.values());
  });

  const [direccionesOrganos, setDireccionesOrganos] = useState<DireccionOrgano[]>(() => {
    const stored = loadStored<DireccionOrgano[]>('direccionesOrganos', INITIAL_DIRECCIONES_ORGANOS);
    const map = new Map<string, DireccionOrgano>();
    INITIAL_DIRECCIONES_ORGANOS.forEach((dir) => map.set(dir.id, dir));
    (stored || []).forEach((dir) => {
      const canonical = INITIAL_DIRECCIONES_ORGANOS.find((d) => d.id === dir.id || d.code === dir.code);
      if (canonical) {
        map.set(canonical.id, { ...canonical, ...dir });
      } else {
        map.set(dir.id, dir);
      }
    });
    return Array.from(map.values());
  });

  const [areas, setAreas] = useState<Area[]>(() => {
    const stored = loadStored<Area[]>('areas', INITIAL_AREAS);
    const map = new Map<string, Area>();
    INITIAL_AREAS.forEach((area) => map.set(area.id, area));
    (stored || []).forEach((area) => {
      const canonical = INITIAL_AREAS.find((a) => a.id === area.id || a.code === area.code);
      if (canonical) {
        map.set(canonical.id, { ...canonical, ...area });
      } else {
        map.set(area.id, area);
      }
    });
    return Array.from(map.values());
  });
  const [cargos, setCargos] = useState<Cargo[]>(() => loadStored('cargos', INITIAL_CARGOS));
  const [responsables, setResponsables] = useState<ResponsableDesignation[]>(() =>
    loadStored('responsables', INITIAL_RESPONSABLES)
  );
  const [assignmentHistory, setAssignmentHistory] = useState<EmployeeAssignmentHistory[]>(() =>
    loadStored('assignmentHistory', [])
  );
  const [turnos, setTurnos] = useState<Turno[]>(() => loadStored('turnos', INITIAL_TURNOS));
  const [horarios, setHorarios] = useState<Horario[]>(() => loadStored('horarios', INITIAL_HORARIOS));
  const [devices, setDevices] = useState<DispositivoZkTeco[]>(() =>
    loadStored('devices', INITIAL_DEVICES)
  );

  // Sync All Phases (1-5) directly from Supabase PostgreSQL (Single Source of Truth)
  useEffect(() => {
    let isMounted = true;
    async function loadCentralData() {
      try {
        const [deps, dirs, ars, crgs, emps, turns, hors, encs, vacs, paps, devs, rawPs, atts, logs] = await Promise.all([
          fetchDependenciasFromSupabase(),
          fetchDireccionesFromSupabase(),
          fetchAreasFromSupabase(),
          fetchCargosFromSupabase(),
          fetchEmployeesFromSupabase(),
          fetchTurnosFromSupabase(),
          fetchHorariosFromSupabase(),
          fetchEncargaturasFromSupabase(),
          fetchVacacionesFromSupabase(),
          fetchPapeletasFromSupabase(),
          fetchDevicesFromSupabase(),
          fetchRawPunchesFromSupabase(),
          fetchAttendanceFromSupabase(),
          fetchAuditLogsFromSupabase(),
        ]);
        if (isMounted) {
          if (deps && deps.length > 0) setDependencias(deps);
          if (dirs && dirs.length > 0) setDireccionesOrganos(dirs);
          if (ars && ars.length > 0) setAreas(ars);
          if (crgs && crgs.length > 0) setCargos(crgs);
          if (emps && emps.length > 0) setEmployees(emps);
          if (turns && turns.length > 0) setTurnos(turns);
          if (hors && hors.length > 0) setHorarios(hors);
          if (encs && encs.length > 0) setEncargaturas(encs);
          if (vacs && vacs.length > 0) setVacaciones(vacs);
          if (paps && paps.length > 0) setPapeletas(paps);
          if (devs && devs.length > 0) setDevices(devs);
          if (rawPs && rawPs.length > 0) setRawPunches(rawPs);
          if (atts && atts.length > 0) setAttendance(atts);
          if (logs && logs.length > 0) setAuditLogs(logs);
        }
      } catch (e) {
        console.warn('Conexión inicial de DRAC Cajamarca desde Supabase:', e);
      }
    }
    loadCentralData();
    return () => { isMounted = false; };
  }, []);

  const [rawPunches, setRawPunches] = useState<MarcacionRaw[]>(() =>
    loadStored('rawPunches', INITIAL_RAW_PUNCHES)
  );

  // Sync RAW punches and calculated attendance from Supabase / server
  const syncPunchesFromServer = useCallback(async () => {
    try {
      const data = await fetchRawPunchesFromSupabase();
      if (Array.isArray(data) && data.length > 0) {
        setRawPunches(data);
        return data;
      }
    } catch (err) {
      console.log('Información: sincronización de marcaciones RAW en segundo plano.');
    }
  }, []);

  const syncAttendanceFromServer = useCallback(async () => {
    try {
      const data = await fetchAttendanceFromSupabase();
      if (Array.isArray(data) && data.length > 0) {
        setAttendance(data);
      }
    } catch (err) {}
  }, []);

  useEffect(() => {
    syncPunchesFromServer();
    syncAttendanceFromServer();

    // Background polling every 3.5 seconds to catch real-time incoming ZKTeco punches
    const interval = setInterval(() => {
      syncPunchesFromServer();
      syncAttendanceFromServer();
    }, 3500);

    return () => clearInterval(interval);
  }, [syncPunchesFromServer, syncAttendanceFromServer]);

  const [punchAuthorizations, setPunchAuthorizations] = useState<AutorizacionMarcacionTemporal[]>(() =>
    loadStored('punchAuthorizations', [])
  );

  // Sync punch authorizations from server database on mount
  useEffect(() => {
    fetch('/api/punch-authorizations')
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setPunchAuthorizations(data.data);
        }
      })
      .catch((err) => {
        console.log('Información: no se pudieron sincronizar autorizaciones temporales:', err);
      });
  }, []);

  const [papeletas, setPapeletas] = useState<PapeletaSalida[]>(() =>
    loadStored('papeletas', INITIAL_PAPELETAS)
  );

  // Sync papeletas from server database on mount
  useEffect(() => {
    fetch('/api/papeletas', {
      headers: {
        'x-user-dni': activeUserDni,
        'x-user-role': activeRole,
      },
    })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setPapeletas(data.data);
        }
      })
      .catch(() => {});
  }, [activeUserDni, activeRole]);
  const [encargaturas, setEncargaturas] = useState<Encargatura[]>(() =>
    loadStored('encargaturas', INITIAL_ENCARGATURAS)
  );
  const [papeletaAudits, setPapeletaAudits] = useState<PapeletaAudit[]>(() =>
    loadStored('papeletaAudits', INITIAL_PAPELETA_AUDITS)
  );
  const [vacaciones, setVacaciones] = useState<Vacacion[]>(() =>
    loadStored('vacaciones', INITIAL_VACACIONES)
  );
  const [attendance, setAttendance] = useState<AsistenciaProcesada[]>(() =>
    loadStored('attendance', INITIAL_ATTENDANCE)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    loadStored('auditLogs', INITIAL_AUDIT_LOGS)
  );

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('drac_data_dependencias', JSON.stringify(dependencias));
      localStorage.setItem('drac_data_direccionesOrganos', JSON.stringify(direccionesOrganos));
      localStorage.setItem('drac_data_areas', JSON.stringify(areas));
      localStorage.setItem('drac_data_cargos', JSON.stringify(cargos));
      localStorage.setItem('drac_data_responsables', JSON.stringify(responsables));
      localStorage.setItem('drac_data_employees', JSON.stringify(employees));
      localStorage.setItem('drac_data_assignmentHistory', JSON.stringify(assignmentHistory));
      localStorage.setItem('drac_data_turnos', JSON.stringify(turnos));
      localStorage.setItem('drac_data_horarios', JSON.stringify(horarios));
      localStorage.setItem('drac_data_devices', JSON.stringify(devices));
      localStorage.setItem('drac_data_rawPunches', JSON.stringify(rawPunches));
      localStorage.setItem('drac_data_punchAuthorizations', JSON.stringify(punchAuthorizations));
      localStorage.setItem('drac_data_papeletas', JSON.stringify(papeletas));
      localStorage.setItem('drac_data_encargaturas', JSON.stringify(encargaturas));
      localStorage.setItem('drac_data_papeletaAudits', JSON.stringify(papeletaAudits));
      localStorage.setItem('drac_data_vacaciones', JSON.stringify(vacaciones));
      localStorage.setItem('drac_data_attendance', JSON.stringify(attendance));
      localStorage.setItem('drac_data_auditLogs', JSON.stringify(auditLogs));
    } catch {
      // Storage limits or private mode
    }
  }, [
    dependencias,
    direccionesOrganos,
    areas,
    cargos,
    responsables,
    employees,
    assignmentHistory,
    turnos,
    horarios,
    devices,
    rawPunches,
    punchAuthorizations,
    papeletas,
    encargaturas,
    papeletaAudits,
    vacaciones,
    attendance,
    auditLogs,
  ]);

  // AUDIT LOG HELPER
  const addAuditLog = (module: string, action: string, affectedRecordId: string, details: string) => {
    const roleLabel =
      activeRole === 'ADMIN_GENERAL'
        ? 'Administrador General DRAC'
        : activeRole === 'HR_ADMIN'
        ? 'Administrador de RRHH'
        : activeRole === 'JEFE_RRHH'
        ? 'Jefe de Recursos Humanos'
        : activeRole === 'DIRECTOR_GENERAL'
        ? 'Director Regional DRAC'
        : activeRole === 'JEFE' || activeRole === 'SUPERVISOR'
        ? 'Jefe de Unidad DRAC'
        : activeRole === 'VIGILANCIA' || activeRole === 'SECURITY_GUARD'
        ? 'Control de Vigilancia DRAC'
        : activeRole === 'CONTROL_ASISTENCIA'
        ? 'Operador Control de Asistencia'
        : 'Servidor Público DRAC';

    const newLog: AuditLog = {
      id: `audlog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_id: activeUserDni,
      user_name: roleLabel,
      role: activeRole,
      module,
      action,
      affected_record_id: affectedRecordId,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    // Send to Supabase and backend persistence
    logAuditEventToSupabase(newLog).catch(() => {});
  };

  // DEPENDENCIA HANDLERS
  const handleAddDependencia = async (newDep: Omit<Dependencia, 'id' | 'created_at'>) => {
    const created: Dependencia = {
      ...newDep,
      id: `dep-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setDependencias((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_DEPENDENCIA', created.id, `Nueva Dependencia DRAC: ${created.name}`);
    await saveDependenciaToSupabase(created);
  };

  const handleEditDependencia = async (updatedDep: Dependencia) => {
    setDependencias((prev) => prev.map((d) => (d.id === updatedDep.id ? updatedDep : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_DEPENDENCIA', updatedDep.id, `Actualización de Dependencia: ${updatedDep.name}`);
    await saveDependenciaToSupabase(updatedDep);
  };

  const handleDeleteDependencia = async (depId: string) => {
    let updated: Dependencia | undefined;
    setDependencias((prev) => prev.map((d) => {
      if (d.id === depId) {
        updated = { ...d, active: !d.active };
        return updated;
      }
      return d;
    }));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_DEPENDENCIA', depId, `Cambio de estado activo de Dependencia ID ${depId}`);
    if (updated) {
      await saveDependenciaToSupabase(updated);
    }
  };

  // DIRECCION / ORGANO HANDLERS
  const handleAddDireccionOrgano = async (newDir: Omit<DireccionOrgano, 'id' | 'created_at'>) => {
    const created: DireccionOrgano = {
      ...newDir,
      id: `dir-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setDireccionesOrganos((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_DIRECCION_ORGANO', created.id, `Nueva Dirección/Órgano DRAC: ${created.name}`);
    await saveDireccionToSupabase(created);
  };

  const handleEditDireccionOrgano = async (updatedDir: DireccionOrgano) => {
    setDireccionesOrganos((prev) => prev.map((d) => (d.id === updatedDir.id ? updatedDir : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_DIRECCION_ORGANO', updatedDir.id, `Actualización Dirección/Órgano: ${updatedDir.name}`);
    await saveDireccionToSupabase(updatedDir);
  };

  const handleDeleteDireccionOrgano = async (dirId: string) => {
    let updated: DireccionOrgano | undefined;
    setDireccionesOrganos((prev) => prev.map((d) => {
      if (d.id === dirId) {
        updated = { ...d, active: !d.active };
        return updated;
      }
      return d;
    }));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_DIRECCION_ORGANO', dirId, `Cambio de estado activo Dirección/Órgano ID ${dirId}`);
    if (updated) {
      await saveDireccionToSupabase(updated);
    }
  };

  // AREA HANDLERS
  const handleAddArea = async (newArea: Omit<Area, 'id' | 'created_at'>) => {
    const created: Area = {
      ...newArea,
      id: `area-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setAreas((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_AREA', created.id, `Nueva Área DRAC: ${created.name}`);
    await saveAreaToSupabase(created);
  };

  const handleEditArea = async (updatedArea: Area) => {
    setAreas((prev) => prev.map((a) => (a.id === updatedArea.id ? updatedArea : a)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_AREA', updatedArea.id, `Actualización de Área: ${updatedArea.name}`);
    await saveAreaToSupabase(updatedArea);
  };

  const handleDeleteArea = async (areaId: string) => {
    let updated: Area | undefined;
    setAreas((prev) => prev.map((a) => {
      if (a.id === areaId) {
        updated = { ...a, active: !a.active };
        return updated;
      }
      return a;
    }));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_AREA', areaId, `Cambio de estado activo Área ID ${areaId}`);
    if (updated) {
      await saveAreaToSupabase(updated);
    }
  };

  // CARGO HANDLERS
  const handleAddCargo = (newCargo: Omit<Cargo, 'id'>) => {
    const created: Cargo = {
      ...newCargo,
      id: `cargo-${Date.now()}`,
      active: true,
    };
    setCargos((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_CARGO', created.id, `Nuevo Cargo: ${created.name}`);
  };

  const handleEditCargo = (updatedCargo: Cargo) => {
    setCargos((prev) => prev.map((c) => (c.id === updatedCargo.id ? updatedCargo : c)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_CARGO', updatedCargo.id, `Actualización Cargo: ${updatedCargo.name}`);
  };

  const handleDeleteCargo = (cargoId: string) => {
    setCargos((prev) => prev.map((c) => (c.id === cargoId ? { ...c, active: !c.active } : c)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_CARGO', cargoId, `Cambio de estado activo Cargo ID ${cargoId}`);
  };

  // RESPONSABLE HANDLERS
  const handleAddResponsable = (newResp: Omit<ResponsableDesignation, 'id'>) => {
    const created: ResponsableDesignation = {
      ...newResp,
      id: `resp-${Date.now()}`,
      active: true,
    };
    setResponsables((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'DESIGNAR_RESPONSABLE', created.id, `Designación de Responsable para ${created.unit_name}`);
  };

  const handleEditResponsable = (updatedResp: ResponsableDesignation) => {
    setResponsables((prev) => prev.map((r) => (r.id === updatedResp.id ? updatedResp : r)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_RESPONSABLE', updatedResp.id, `Actualización de Designación ${updatedResp.id}`);
  };

  const handleDeleteResponsable = (respId: string) => {
    setResponsables((prev) => prev.map((r) => (r.id === respId ? { ...r, active: !r.active } : r)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_RESPONSABLE', respId, `Cambio de estado activo Responsable ID ${respId}`);
  };

  // EMPLOYEE HANDLERS (Fase 2: Persistencia Centralizada en Supabase)
  const handleAddEmployee = async (newEmpData: Omit<Employee, 'id'>) => {
    // Si no tiene código DRAC, obtener el siguiente correlativo centralizado desde PostgreSQL
    let codigoDrac = newEmpData.codigo_trabajador;
    if (!codigoDrac || codigoDrac.trim() === '') {
      codigoDrac = await getNextDracCodeFromPostgres();
    }

    const newEmp: Employee = {
      ...newEmpData,
      codigo_trabajador: codigoDrac,
      id: `emp-${Date.now()}`,
    };
    setEmployees((prev) => [...prev, newEmp]);
    addAuditLog('PERSONAL', 'CREAR_EMPLEADO', newEmp.id, `Registro de personal DRAC (${codigoDrac}): ${newEmp.first_name} ${newEmp.last_name}`);
    await saveEmployeeToSupabase(newEmp);
  };

  const handleEditEmployee = async (updatedEmp: Employee) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === updatedEmp.id ||
        (e.dni && updatedEmp.dni && e.dni === updatedEmp.dni) ||
        (e.username && updatedEmp.username && e.username.toLowerCase() === updatedEmp.username.toLowerCase())
          ? updatedEmp
          : e
      )
    );
    addAuditLog('PERSONAL', 'EDITAR_EMPLEADO', updatedEmp.id, `Actualización datos de personal: ${updatedEmp.first_name} ${updatedEmp.last_name}`);
    await saveEmployeeToSupabase(updatedEmp);
  };

  const handleDeleteEmployee = async (empId: string) => {
    let updated: Employee | undefined;
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === empId) {
          const nextActive = !e.active;
          updated = {
            ...e,
            active: nextActive,
            account_status: nextActive ? (e.has_system_access ? 'ACTIVE' : 'INACTIVE') : 'INACTIVE',
          };
          return updated;
        }
        return e;
      })
    );
    addAuditLog('PERSONAL', 'ESTADO_EMPLEADO', empId, `Cambio de estado activo/cuenta de personal ID ${empId}`);
    if (updated) {
      await saveEmployeeToSupabase(updated);
    }
  };

  // BULK IMPORT BATCH HANDLERS
  const handleBulkImportDirecciones = (
    validDirs: DireccionOrgano[],
    updateDirs: DireccionOrgano[],
    summary: any
  ) => {
    if (validDirs.length > 0) {
      setDireccionesOrganos((prev) => [...prev, ...validDirs]);
    }
    if (updateDirs.length > 0) {
      const updateMap = new Map(updateDirs.map((d) => [d.id, d]));
      setDireccionesOrganos((prev) => prev.map((d) => updateMap.get(d.id) || d));
    }
    addAuditLog(
      'ESTRUCTURA_DRAC',
      'CARGA_MASIVA_DIRECCIONES',
      `bulk-dirs-${Date.now()}`,
      `Carga masiva Excel: ${validDirs.length} nuevas Direcciones creadas, ${updateDirs.length} actualizadas.`
    );
  };

  const handleBulkImportAreas = (
    validAreas: Area[],
    updateAreas: Area[],
    summary: any
  ) => {
    if (validAreas.length > 0) {
      setAreas((prev) => [...prev, ...validAreas]);
    }
    if (updateAreas.length > 0) {
      const updateMap = new Map(updateAreas.map((a) => [a.id, a]));
      setAreas((prev) => prev.map((a) => updateMap.get(a.id) || a));
    }
    addAuditLog(
      'ESTRUCTURA_DRAC',
      'CARGA_MASIVA_AREAS',
      `bulk-areas-${Date.now()}`,
      `Carga masiva Excel: ${validAreas.length} nuevas Áreas creadas, ${updateAreas.length} actualizadas.`
    );
  };

  const handleBulkImportTrabajadores = (
    validEmps: Employee[],
    updateEmps: Employee[],
    summary: any
  ) => {
    if (validEmps.length > 0) {
      setEmployees((prev) => [...prev, ...validEmps]);
    }
    if (updateEmps.length > 0) {
      const updateMap = new Map(updateEmps.map((e) => [e.id, e]));
      setEmployees((prev) => prev.map((e) => updateMap.get(e.id) || e));
    }
    addAuditLog(
      'PERSONAL',
      'CARGA_MASIVA_TRABAJADORES',
      `bulk-emps-${Date.now()}`,
      `Carga masiva Excel: ${validEmps.length} trabajadores registrados con perfil base TRABAJADOR, ${updateEmps.length} actualizados.`
    );
  };

  const handleBulkImportEncargaturas = async (validEncs: Encargatura[]) => {
    if (validEncs.length > 0) {
      setEncargaturas((prev) => [...prev, ...validEncs]);
      addAuditLog(
        'ENCARGATURAS',
        'CARGA_MASIVA_ENCARGATURAS',
        `bulk-encs-${Date.now()}`,
        `Carga masiva Excel: ${validEncs.length} encargaturas registradas.`
      );
      for (const enc of validEncs) {
        await saveEncargaturaToSupabase(enc);
      }
    }
  };

  // ENCARGATURAS HANDLERS (Fase 4: Supabase PostgreSQL)
  const handleAddEncargatura = async (newEnc: Omit<Encargatura, 'id' | 'created_at'>) => {
    const created: Encargatura = {
      ...newEnc,
      id: `enc-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setEncargaturas((prev) => [...prev, created]);
    addAuditLog(
      'ENCARGATURAS',
      'CREAR_ENCARGATURA',
      created.id,
      `Nueva encargatura: ${created.encargado_name} asume funciones de ${created.titular_name} (${created.cargo_encargado})`
    );
    await saveEncargaturaToSupabase(created);
  };

  const handleEditEncargatura = async (updatedEnc: Encargatura) => {
    setEncargaturas((prev) => prev.map((e) => (e.id === updatedEnc.id ? updatedEnc : e)));
    addAuditLog(
      'ENCARGATURAS',
      'EDITAR_ENCARGATURA',
      updatedEnc.id,
      `Actualización de encargatura ID ${updatedEnc.id}: ${updatedEnc.encargado_name}`
    );
    await saveEncargaturaToSupabase(updatedEnc);
  };

  const handleDeleteEncargatura = async (encId: string) => {
    setEncargaturas((prev) => prev.filter((e) => e.id !== encId));
    addAuditLog('ENCARGATURAS', 'ELIMINAR_ENCARGATURA', encId, `Eliminación de encargatura ID ${encId}`);
    await deleteEncargaturaInSupabase(encId);
  };

  const handleAnularEncargatura = async (encId: string, motivo: string) => {
    let targetEnc: Encargatura | undefined;
    setEncargaturas((prev) =>
      prev.map((e) => {
        if (e.id === encId) {
          targetEnc = {
            ...e,
            status: 'ANULADA',
            anulado_at: new Date().toISOString(),
            anulado_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador DRAC',
            anulacion_motivo: motivo,
          };
          return targetEnc;
        }
        return e;
      })
    );
    addAuditLog('ENCARGATURAS', 'ANULAR_ENCARGATURA', encId, `Anulación de encargatura ID ${encId}: ${motivo}`);
    if (targetEnc) {
      await saveEncargaturaToSupabase(targetEnc);
    }
  };

  // SHIFTS / HORARIOS HANDLERS (Fase 3: Persistencia Centralizada en Supabase)
  const handleAddTurno = async (newTurno: Omit<Turno, 'id' | 'created_at'>) => {
    const created: Turno = {
      ...newTurno,
      id: `tur-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setTurnos((prev) => [...prev, created]);
    addAuditLog('HORARIOS', 'CREAR_TURNO', created.id, `Nuevo Turno: ${created.name}`);
    await saveTurnoToSupabase(created);
  };

  const handleEditTurno = async (updatedTurno: Turno) => {
    setTurnos((prev) => prev.map((t) => (t.id === updatedTurno.id ? updatedTurno : t)));
    addAuditLog('HORARIOS', 'EDITAR_TURNO', updatedTurno.id, `Actualización Turno: ${updatedTurno.name}`);
    await saveTurnoToSupabase(updatedTurno);
  };

  const handleDeleteTurno = async (turnoId: string) => {
    let updated: Turno | undefined;
    setTurnos((prev) => prev.map((t) => {
      if (t.id === turnoId) {
        updated = { ...t, active: !t.active };
        return updated;
      }
      return t;
    }));
    addAuditLog('HORARIOS', 'DESACTIVAR_TURNO', turnoId, `Cambio de estado activo Turno ID ${turnoId}`);
    if (updated) {
      await saveTurnoToSupabase(updated);
    }
  };

  const handleAddHorario = async (newHorario: Omit<Horario, 'id'>) => {
    const created: Horario = {
      ...newHorario,
      id: `hor-${Date.now()}`,
    };
    setHorarios((prev) => [...prev, created]);
    addAuditLog('HORARIOS', 'CREAR_HORARIO', created.id, `Nuevo Horario: ${created.name}`);
    await saveHorarioToSupabase(created);
  };

  const handleEditHorario = async (updatedHorario: Horario) => {
    setHorarios((prev) => prev.map((h) => (h.id === updatedHorario.id ? updatedHorario : h)));
    addAuditLog('HORARIOS', 'EDITAR_HORARIO', updatedHorario.id, `Actualización Horario: ${updatedHorario.name}`);
    await saveHorarioToSupabase(updatedHorario);
  };

  const handleDeleteHorario = async (horarioId: string) => {
    let updated: Horario | undefined;
    setHorarios((prev) => prev.map((h) => {
      if (h.id === horarioId) {
        updated = { ...h, active: !h.active };
        return updated;
      }
      return h;
    }));
    addAuditLog('HORARIOS', 'DESACTIVAR_HORARIO', horarioId, `Cambio de estado activo Horario ID ${horarioId}`);
    if (updated) {
      await saveHorarioToSupabase(updated);
    }
  };

  // DEVICE HANDLERS (Fase 5: Supabase PostgreSQL)
  const handleAddDevice = async (
    newDev: Omit<DispositivoZkTeco, 'id' | 'last_activity'>
  ): Promise<{ success: boolean; message: string; device?: DispositivoZkTeco }> => {
    let createdDevice: DispositivoZkTeco = {
      ...newDev,
      id: `dev-${Date.now()}`,
      last_activity: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      status: newDev.status || 'CONFIGURED',
      protocol: newDev.protocol || 'PUSH_ADMS',
      firmware_version: newDev.firmware_version || 'Ver 8.0.4.3-2026',
    };

    // Guardar en Supabase PostgreSQL
    await saveDeviceToSupabase(createdDevice);

    setDevices((prev) => {
      const exists = prev.some((d) => d.id === createdDevice.id || (d.serial_number && d.serial_number.toUpperCase() === createdDevice.serial_number.toUpperCase()));
      if (exists) {
        return prev.map((d) => (d.id === createdDevice.id || (d.serial_number && d.serial_number.toUpperCase() === createdDevice.serial_number.toUpperCase()) ? createdDevice : d));
      }
      return [...prev, createdDevice];
    });

    addAuditLog(
      'BIOMETRICOS',
      'REGISTRAR_DISPOSITIVO',
      createdDevice.id,
      `Nuevo Biométrico: ${createdDevice.name} (S/N: ${createdDevice.serial_number}, IP: ${createdDevice.ip_address}:${createdDevice.port}) - Dependencia: ${createdDevice.dependencia_name}`
    );

    return {
      success: true,
      message: 'Marcador registrado correctamente.',
      device: createdDevice,
    };
  };

  const handleEditDevice = async (
    updatedDev: DispositivoZkTeco
  ): Promise<{ success: boolean; message: string; device?: DispositivoZkTeco }> => {
    const prevDev = devices.find((d) => d.id === updatedDev.id);
    let savedDevice: DispositivoZkTeco = {
      ...updatedDev,
      last_activity: updatedDev.last_activity || new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
    };

    // Actualizar en Supabase PostgreSQL
    await saveDeviceToSupabase(savedDevice);

    setDevices((prev) => prev.map((d) => (d.id === savedDevice.id || (d.serial_number && d.serial_number.toUpperCase() === savedDevice.serial_number.toUpperCase()) ? savedDevice : d)));

    // Track modified fields for audit log
    const changedFields: string[] = [];
    if (prevDev) {
      if (prevDev.name !== savedDevice.name) changedFields.push(`Nombre: '${prevDev.name}' ➔ '${savedDevice.name}'`);
      if (prevDev.ip_address !== savedDevice.ip_address || prevDev.port !== savedDevice.port) {
        changedFields.push(`IP/Puerto: '${prevDev.ip_address}:${prevDev.port}' ➔ '${savedDevice.ip_address}:${savedDevice.port}'`);
      }
      if (prevDev.location_detail !== savedDevice.location_detail) {
        changedFields.push(`Ubicación: '${prevDev.location_detail}' ➔ '${savedDevice.location_detail}'`);
      }
      if (prevDev.dependencia_name !== savedDevice.dependencia_name) {
        changedFields.push(`Dependencia: '${prevDev.dependencia_name}' ➔ '${savedDevice.dependencia_name}'`);
      }
      if (prevDev.status !== savedDevice.status) {
        changedFields.push(`Estado: '${prevDev.status}' ➔ '${savedDevice.status}'`);
      }
    }

    const auditDetail = changedFields.length > 0
      ? `Actualización Biométrico ${savedDevice.name} (${savedDevice.serial_number}): [${changedFields.join(', ')}]`
      : `Actualización de Biométrico: ${savedDevice.name} (${savedDevice.serial_number})`;

    addAuditLog('BIOMETRICOS', 'EDITAR_DISPOSITIVO', savedDevice.id, auditDetail);

    return {
      success: true,
      message: 'Marcador actualizado correctamente.',
      device: savedDevice,
    };
  };

  const handleDeleteDevice = async (deviceId: string) => {
    await deleteDeviceInSupabase(deviceId);
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    addAuditLog('BIOMETRICOS', 'ELIMINAR_DISPOSITIVO', deviceId, `Eliminación de Biométrico ID ${deviceId}`);
  };

  // PUNCH AUTHORIZATION HANDLERS
  const handleAddPunchAuthorization = async (
    newAuthData: Omit<AutorizacionMarcacionTemporal, 'id' | 'created_at' | 'status'>
  ) => {
    let createdAuth: AutorizacionMarcacionTemporal = {
      ...newAuthData,
      id: `auth-${Date.now()}`,
      status: 'ACTIVA',
      created_at: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/punch-authorizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAuthData),
      });
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.data) {
          createdAuth = data.data;
        }
      }
    } catch (err: any) {
      console.warn('Sincronización offline para autorización temporal:', err);
    }

    setPunchAuthorizations((prev) => [createdAuth, ...prev]);
    addAuditLog(
      'BIOMETRICOS',
      'CREAR_AUTORIZACION_TEMPORAL',
      createdAuth.id,
      `Autorización temporal de marcación concedida a ${createdAuth.employee_name} (${createdAuth.employee_dni}) para ${createdAuth.dependencia_autorizada_name} hasta ${createdAuth.end_date}`
    );
    return createdAuth;
  };

  const handleRevokePunchAuthorization = async (authId: string, reason?: string) => {
    try {
      await fetch(`/api/punch-authorizations/${authId}/revoke`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked_reason: reason || 'Revocada administrativamente' }),
      });
    } catch (e) {
      console.error('Error al sincronizar revocación:', e);
    }
    setPunchAuthorizations((prev) =>
      prev.map((a) =>
        a.id === authId
          ? {
              ...a,
              status: 'REVOCADA',
              revoked_at: new Date().toISOString(),
              revoked_by: activeRole === 'HR_ADMIN' ? 'Jefe de Recursos Humanos' : 'Administrador DRAC',
              revoked_reason: reason || 'Revocada administrativamente',
            }
          : a
      )
    );
    addAuditLog('BIOMETRICOS', 'REVOCAR_AUTORIZACION_TEMPORAL', authId, `Revocación de autorización ID ${authId}: ${reason || 'Revocada'}`);
  };

  const handleDeletePunchAuthorization = (authId: string) => {
    setPunchAuthorizations((prev) => prev.filter((a) => a.id !== authId));
    addAuditLog('BIOMETRICOS', 'ELIMINAR_AUTORIZACION_TEMPORAL', authId, `Eliminación de registro de autorización ${authId}`);
  };

  // PUNCH VALIDATION & INGESTION HANDLER
  const handleSimulatePunch = (newPunchData: Omit<MarcacionRaw, 'id' | 'processed' | 'processed_at'>) => {
    // 1. Identificar marcador biométrico y su Dependencia
    const device = devices.find(
      (d) => d.id === newPunchData.device_id || d.serial_number === newPunchData.device_sn
    );
    const deviceDepTipo =
      device?.dependencia_tipo ||
      (device?.dependencia_id === 'dep-02' || device?.dependencia_name?.toUpperCase().includes('AGENCIA')
        ? 'AGENCIA_AGRARIA'
        : 'SEDE_CENTRAL');
    const deviceDepName = deviceDepTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';

    // 2. Identificar colaborador y su Dependencia institucional
    const employee = employees.find((e) => e.dni === newPunchData.employee_dni);
    const employeeDepTipo =
      employee?.dependencia_id === 'dep-02' ||
      employee?.dependencia_name?.toUpperCase().includes('AGENCIA')
        ? 'AGENCIA_AGRARIA'
        : 'SEDE_CENTRAL';
    const employeeDepName = employeeDepTipo === 'AGENCIA_AGRARIA' ? 'AGENCIA AGRARIA' : 'SEDE CENTRAL';

    // 3. Consultar si tiene una Autorización Temporal de Marcación Activa para esta fecha
    const punchDate =
      (newPunchData.timestamp && newPunchData.timestamp.split(' ')[0]) ||
      new Date().toISOString().split('T')[0];

    const activeAuth = punchAuthorizations.find((auth) => {
      if (auth.status !== 'ACTIVA') return false;
      if (auth.employee_dni !== newPunchData.employee_dni) return false;
      if (punchDate < auth.start_date || punchDate > auth.end_date) return false;
      // Verificar si la autorización corresponde al tipo de dependencia del marcador
      if (auth.dependencia_autorizada_tipo !== deviceDepTipo) return false;
      if (auth.device_id && device && auth.device_id !== device.id) return false;
      return true;
    });

    // 4. Comparar Dependencias: ¿Coinciden o cuenta con Excepción Autorizada?
    let validationStatus: PunchValidationStatus = 'VALIDA';
    let rejectionReason: string | undefined = undefined;

    if (deviceDepTipo === employeeDepTipo) {
      validationStatus = 'VALIDA';
    } else if (activeAuth) {
      validationStatus = 'EXCEPCION_AUTORIZADA';
    } else {
      validationStatus = 'RECHAZADA_DEPENDENCIA';
      rejectionReason = `Marcación rechazada por conflicto de dependencia: El colaborador pertenece a ${employeeDepName} e intentó registrar asistencia en el marcador '${device?.name || 'Marcador'}' configurado para ${deviceDepName}. No cuenta con Autorización Temporal activa.`;
    }

    const createdPunch: MarcacionRaw = {
      ...newPunchData,
      id: `punch-${Date.now()}`,
      device_id: device?.id || newPunchData.device_id,
      device_sn: device?.serial_number || newPunchData.device_sn,
      device_name: device?.name || newPunchData.device_name,
      device_dependencia_tipo: deviceDepTipo,
      device_dependencia_name: deviceDepName,
      employee_dni: newPunchData.employee_dni,
      employee_name: employee ? `${employee.first_name} ${employee.last_name}` : newPunchData.employee_name,
      employee_dependencia_tipo: employeeDepTipo,
      employee_dependencia_name: employeeDepName,
      processed: true,
      processed_at: new Date().toISOString(),
      validation_status: validationStatus,
      rejection_reason: rejectionReason,
      authorization_id: activeAuth?.id,
    };

    setRawPunches((prev) => [createdPunch, ...prev]);

    // Ingesta idempotente en Supabase PostgreSQL
    saveRawPunchToSupabase(createdPunch).catch((err) =>
      console.warn('Error al guardar marcacion en Supabase:', err)
    );

    if (validationStatus === 'RECHAZADA_DEPENDENCIA') {
      addAuditLog(
        'BIOMETRICOS',
        'MARCACION_RECHAZADA_DEPENDENCIA',
        createdPunch.id,
        `INCIDENCIA BIOMÉTRICA: Marcación RECHAZADA de DNI ${createdPunch.employee_dni} (${employeeDepName}) en marcador ${device?.name || 'ZK'} (${deviceDepName})`
      );
    } else if (validationStatus === 'EXCEPCION_AUTORIZADA') {
      addAuditLog(
        'BIOMETRICOS',
        'MARCACION_EXCEPCION_AUTORIZADA',
        createdPunch.id,
        `MARCACIÓN AUTORIZADA POR EXCEPCIÓN: DNI ${createdPunch.employee_dni} (${employeeDepName}) en ${device?.name} (${deviceDepName}) bajo documento ${activeAuth?.documento_autorizacion}`
      );
    } else {
      addAuditLog(
        'BIOMETRICOS',
        'MARCACION_RECIBIDA',
        createdPunch.id,
        `Marcación VÁLIDA: DNI ${createdPunch.employee_dni} en ${device?.name || 'Marcador'}`
      );
    }

    return createdPunch;
  };

  // PAPELETAS HANDLERS (Fase 4: Supabase PostgreSQL)
  const handleUpdatePapeletaStatus = async (
    papeletaId: string,
    action: PapeletaStatus | 'APPROVE_BOSS' | 'APPROVE_HR' | 'REJECT' | 'MARK_OUTING_REAL' | 'MARK_COMPLETED_REAL',
    comment?: string,
    realExitTime?: string,
    realReturnTime?: string,
    approverMetadata?: {
      boss_dni?: string;
      boss_id?: string;
      boss_name?: string;
      boss_role?: string;
      boss_function?: string;
      delegation_info?: any;
    }
  ) => {
    let targetStatus: PapeletaStatus;
    if (action === 'APPROVE_BOSS') {
      targetStatus = 'PENDING_HR';
    } else if (action === 'APPROVE_HR') {
      targetStatus = 'APPROVED';
    } else if (action === 'REJECT') {
      targetStatus = 'REJECTED';
    } else if (action === 'MARK_OUTING_REAL') {
      targetStatus = 'IN_OUTING';
    } else if (action === 'MARK_COMPLETED_REAL') {
      targetStatus = 'COMPLETED';
    } else {
      targetStatus = action as PapeletaStatus;
    }

    const nowFormatted = new Date().toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    let updatedPapeletaRecord: PapeletaSalida | undefined;

    setPapeletas((prev) =>
      prev.map((p) => {
        if (p.id !== papeletaId) return p;
        const nowIso = new Date().toISOString();
        const prevAudits = p.audits || [];

        const newAuditEntry = {
          id: `aud-${p.id}-${Date.now()}`,
          papeleta_id: p.id,
          previous_status: p.status,
          new_status: targetStatus,
          action_by_user_id: approverMetadata?.boss_id || activeUserDni,
          action_by_user_name: approverMetadata?.boss_name || (currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : activeUserDni),
          action_by_role: approverMetadata?.boss_role || activeRole,
          action_type: action,
          comment: comment || `Actualización de estado a ${targetStatus}`,
          timestamp: nowFormatted,
          metadata: approverMetadata?.delegation_info,
        };

        updatedPapeletaRecord = {
          ...p,
          status: targetStatus,
          boss_approved_at: action === 'APPROVE_BOSS' ? nowFormatted : p.boss_approved_at,
          boss_approver_dni: action === 'APPROVE_BOSS' ? approverMetadata?.boss_dni || activeUserDni : p.boss_approver_dni,
          boss_approver_name: action === 'APPROVE_BOSS' ? approverMetadata?.boss_name || (currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : undefined) : p.boss_approver_name,
          boss_approver_function: action === 'APPROVE_BOSS' ? approverMetadata?.boss_function || 'Jefe Titular' : p.boss_approver_function,
          boss_comment: action === 'APPROVE_BOSS' ? comment : p.boss_comment,
          boss_delegation_info: action === 'APPROVE_BOSS' && approverMetadata?.delegation_info ? approverMetadata.delegation_info : p.boss_delegation_info,
          hr_approved_at: action === 'APPROVE_HR' ? nowFormatted : p.hr_approved_at,
          hr_approver_dni: action === 'APPROVE_HR' ? activeUserDni : p.hr_approver_dni,
          hr_approver_name: action === 'APPROVE_HR' ? (currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Recursos Humanos') : p.hr_approver_name,
          hr_comment: action === 'APPROVE_HR' ? comment : p.hr_comment,
          rejection_reason: action === 'REJECT' ? comment : p.rejection_reason,
          rejected_at: action === 'REJECT' ? nowFormatted : p.rejected_at,
          rejected_by: action === 'REJECT' ? (currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : activeUserDni) : p.rejected_by,
          hora_real_salida: realExitTime !== undefined ? realExitTime : p.hora_real_salida,
          hora_real_retorno: realReturnTime !== undefined ? realReturnTime : p.hora_real_retorno,
          updated_at: nowIso,
          audits: [...prevAudits, newAuditEntry],
        };

        return updatedPapeletaRecord;
      })
    );

    if (updatedPapeletaRecord) {
      await savePapeletaToSupabase(updatedPapeletaRecord);
    }

    // Call backend endpoint asynchronously
    let apiEndpoint = '';
    let apiBody: any = {};
    if (action === 'APPROVE_BOSS') {
      apiEndpoint = `/api/papeletas/${papeletaId}/vobo-jefe`;
      apiBody = {
        boss_dni: approverMetadata?.boss_dni || activeUserDni,
        boss_name: approverMetadata?.boss_name,
        boss_function: approverMetadata?.boss_function,
        comment,
      };
    } else if (action === 'APPROVE_HR') {
      apiEndpoint = `/api/papeletas/${papeletaId}/aprobar-rrhh`;
      apiBody = { hr_dni: activeUserDni, comment };
    } else if (action === 'REJECT') {
      apiEndpoint = `/api/papeletas/${papeletaId}/rechazar`;
      apiBody = { reason: comment };
    } else if (action === 'MARK_OUTING_REAL') {
      apiEndpoint = `/api/papeletas/${papeletaId}/garita-salida`;
      apiBody = { hora_real_salida: realExitTime, comment };
    } else if (action === 'MARK_COMPLETED_REAL') {
      apiEndpoint = `/api/papeletas/${papeletaId}/garita-retorno`;
      apiBody = { hora_real_retorno: realReturnTime, comment };
    }

    if (apiEndpoint) {
      fetch(apiEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-dni': activeUserDni,
          'x-user-role': activeRole,
        },
        body: JSON.stringify(apiBody),
      }).catch(() => {});
    }

    addAuditLog(
      'PAPELETAS',
      `STATUS_${action}`,
      papeletaId,
      `Papeleta ID ${papeletaId} actualizada a estado: ${targetStatus}${comment ? ` - Obs: ${comment}` : ''}`
    );
  };

  const handleCreatePapeleta = async (newPapeletaData: Omit<PapeletaSalida, 'id' | 'code' | 'created_at' | 'updated_at'>) => {
    const newCode = `PAP-2026-${String(papeletas.length + 1).padStart(3, '0')}`;
    const newId = `pap-${Date.now()}`;
    const nowFormatted = new Date().toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newPapeleta: PapeletaSalida = {
      ...newPapeletaData,
      id: newId,
      code: newCode,
      status: 'PENDING_BOSS',
      origin: 'PORTAL_TRABAJADOR',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      audits: [
        {
          id: `aud-${newId}-init`,
          papeleta_id: newId,
          new_status: 'PENDING_BOSS',
          action_by_user_id: activeUserDni,
          action_by_user_name: newPapeletaData.employee_name,
          action_by_role: activeRole,
          action_type: 'SOLICITAR_PAPELETA',
          comment: 'Solicitud generada desde el Perfil del Trabajador.',
          timestamp: nowFormatted,
        },
      ],
    };

    setPapeletas((prev) => [newPapeleta, ...prev]);
    await savePapeletaToSupabase(newPapeleta);

    // Backend persistent call with strict worker identity headers
    fetch('/api/papeletas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-dni': activeUserDni,
        'x-user-role': activeRole,
      },
      body: JSON.stringify(newPapeleta),
    })
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setPapeletas((prev) => prev.map((p) => (p.id === newId ? json.data : p)));
          }
        }
      })
      .catch(() => {});

    addAuditLog('PAPELETAS', 'CREAR_PAPELETA', newId, `Nueva Papeleta registrada para DNI ${newPapeleta.employee_dni}`);
  };

  // VACATION HANDLERS (Fase 4: Supabase PostgreSQL)
  const handleAddVacation = async (newVacationData: Omit<Vacacion, 'id' | 'created_at'>) => {
    const newId = `vac-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newVac: Vacacion = {
      ...newVacationData,
      id: newId,
      code: newVacationData.code || `VAC-2026-${String(vacaciones.length + 1).padStart(3, '0')}`,
      created_at: new Date().toISOString(),
    };
    setVacaciones((prev) => [newVac, ...prev]);
    await saveVacacionToSupabase(newVac);

    // Backend persistent sync attempt with headers
    fetch('/api/vacaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-dni': activeUserDni,
        'x-user-role': activeRole,
      },
      body: JSON.stringify(newVac),
    })
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setVacaciones((prev) => prev.map((v) => (v.id === newId ? json.data : v)));
          }
        }
      })
      .catch(() => {});

    const logAction =
      newVac.origin === 'PROFILE_VACATION_REQUEST' ? 'SOLICITAR_VACACION_PERFIL' : 'PROGRAMAR_VACACION_RRHH';
    addAuditLog(
      'VACACIONES',
      logAction as any,
      newVac.id,
      `Vacaciones ${newVac.origin === 'PROFILE_VACATION_REQUEST' ? 'solicitadas' : 'programadas'} para ${newVac.employee_name} (DNI ${newVac.employee_dni}): ${newVac.start_date} al ${newVac.end_date} (${newVac.total_days} días)`
    );
  };

  const handleEditVacation = async (updatedVacation: Vacacion) => {
    setVacaciones((prev) => prev.map((v) => (v.id === updatedVacation.id ? updatedVacation : v)));
    addAuditLog(
      'VACACIONES',
      'EDITAR_VACACION' as any,
      updatedVacation.id,
      `Actualización de estado vacacional DNI ${updatedVacation.employee_dni} a ${updatedVacation.status}`
    );
    await saveVacacionToSupabase(updatedVacation);
  };

  const handleDeleteVacation = async (vacationId: string) => {
    const vac = vacaciones.find((v) => v.id === vacationId);
    setVacaciones((prev) => prev.filter((v) => v.id !== vacationId));

    await deleteVacacionInSupabase(vacationId);

    fetch(`/api/vacaciones/${vacationId}`, {
      method: 'DELETE',
    }).catch(() => {});

    if (vac) {
      addAuditLog(
        'VACACIONES',
        'ELIMINAR_VACACION' as any,
        vacationId,
        `Cancelación / Anulación de vacación para DNI ${vac.employee_dni}`
      );
    }
  };

  // ATTENDANCE RECORD EDIT HANDLER (Fase 5: Supabase PostgreSQL)
  const handleEditAttendanceRecord = async (updatedRec: AsistenciaProcesada) => {
    setAttendance((prev) => prev.map((a) => (a.id === updatedRec.id ? updatedRec : a)));
    addAuditLog('ASISTENCIA', 'AJUSTE_REGULARIZACION', updatedRec.id, `Ajuste manual de asistencia DNI ${updatedRec.employee_dni}`);
    await saveAttendanceToSupabase(updatedRec);
  };

  // RESET DATA HANDLER
  const handleResetAllData = () => {
    if (
      confirm(
        '⚠️ ATENCIÓN: ¿Está seguro de limpiar TODA la información del sistema DRAC?\n\nEsta acción dejará las listas vacías para que pueda cargar sus propios registros personalmente.'
      )
    ) {
      setDependencias([]);
      setDireccionesOrganos([]);
      setAreas([]);
      setCargos([]);
      setResponsables([]);
      setEmployees([]);
      setAssignmentHistory([]);
      setTurnos([]);
      setHorarios([]);
      setDevices([]);
      setRawPunches([]);
      setPapeletas([]);
      setPapeletaAudits([]);
      setVacaciones([]);
      setAttendance([]);
      setAuditLogs([]);

      try {
        const keys = [
          'dependencias',
          'direccionesOrganos',
          'areas',
          'cargos',
          'responsables',
          'employees',
          'assignmentHistory',
          'turnos',
          'horarios',
          'devices',
          'rawPunches',
          'papeletas',
          'papeletaAudits',
          'vacaciones',
          'attendance',
          'auditLogs',
        ];
        keys.forEach((k) => localStorage.removeItem(`drac_data_${k}`));
      } catch {
        // ignore
      }
    }
  };

  // Unauthenticated user -> Show Institutional Login Page
  if (!currentUser) {
    return (
      <LoginPage
        employees={employees}
        onLoginSuccess={handleLoginSuccess}
        onRecordAudit={(action, details, dni, name) => {
          const newLog: AuditLog = {
            id: `audlog-${Date.now()}`,
            timestamp: new Date().toISOString(),
            user_id: dni || 'ANONIMO',
            user_name: name || 'Usuario DRAC',
            role: 'ADMIN_GENERAL',
            module: 'AUTENTICACION',
            action,
            affected_record_id: dni || '-',
            details,
          };
          setAuditLogs((prev) => [newLog, ...prev]);
        }}
      />
    );
  }

  // MANDATORY SECURITY GATE: If user has pending password change, NEVER render system dashboard/modules
  const activeSessionEmp =
    employees.find((e) => e.id === currentUser.id || e.dni === currentUser.dni) || currentUser;

  const requiresPasswordChange =
    activeSessionEmp.has_system_access !== false &&
    (Boolean(activeSessionEmp.password_change_required) ||
      activeSessionEmp.primer_ingreso === 'PENDIENTE');

  if (requiresPasswordChange) {
    return (
      <ForcePasswordChangeModal
        employee={activeSessionEmp}
        onCancelLogout={handleLogout}
        onPasswordChanged={(updatedEmp) => {
          handleEditEmployee(updatedEmp);
          setCurrentUser(updatedEmp);
          localStorage.setItem(
            'drac_auth_session',
            JSON.stringify({
              currentUser: updatedEmp,
              activeRole,
            })
          );
        }}
      />
    );
  }

  const isCurrentViewAllowed = isViewAllowedForRole(activeView, activeRole);

  return (
    <div className="min-h-screen bg-[#07080A] text-slate-100 font-sans antialiased flex">
      {/* 1. Left Vertical Navigation Menu */}
      <Sidebar
        activeView={activeView}
        setActiveView={handleNavigate}
        activeRole={activeRole}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 min-w-0 md:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <Header
          activeRole={activeRole}
          setActiveRole={handleRoleChange}
          currentUser={currentUser}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
          onResetData={handleResetAllData}
          onToggleSidebarMobile={() => setIsOpenMobile(true)}
        />

        {/* Quick Access Notification Banner: Windows Desktop Installer */}
        <div id="banner-download-desktop-alert" className="bg-gradient-to-r from-emerald-950/70 via-[#0C121E] to-slate-900 border-b border-emerald-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-200">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-400">Instalador Desktop Windows:</span>
            <span className="text-slate-300 hidden sm:inline">Haga clic para descargar el sistema nativo para su PC:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="banner-btn-download-exe"
              type="button"
              onClick={() => initiateDesktopDownload('exe')}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-950/50 transition-colors cursor-pointer"
              title="Descargar instalador ejecutable para Windows"
            >
              <span>Descargar .EXE</span>
              <span className="text-[10px] text-emerald-200 font-mono">(129 MB)</span>
            </button>
            <button
              id="banner-btn-download-zip"
              type="button"
              onClick={() => initiateDesktopDownload('zip')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="Descargar paquete comprimido ZIP"
            >
              Descargar .ZIP
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-download-desktop'))}
              className="text-[11px] text-emerald-400 underline hover:text-emerald-300 ml-1 cursor-pointer"
            >
              Ver Opciones y Guía
            </button>
          </div>
        </div>

        {/* Content Workspace Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Security Guard: 403 Unauthorized View */}
          {!isCurrentViewAllowed ? (
            <UnauthorizedView
              attemptedView={activeView}
              activeRole={activeRole}
              onNavigateHome={() => handleNavigate('dash_overview')}
            />
          ) : (
            <>
              {/* DASHBOARD */}
              {activeView === 'dash_overview' && (
                <OperationalDashboard
                  attendance={attendance}
                  employees={employees}
                  papeletas={papeletas}
                  vacaciones={vacaciones}
                  activeRole={activeRole}
                  activeUserDni={activeUserDni}
                  currentUser={currentUser}
                  encargaturas={encargaturas}
                  punchAuthorizations={punchAuthorizations}
                  turnos={turnos}
                  horarios={horarios}
                  onNavigate={handleNavigate}
                />
              )}

              {/* ORGANIZACIÓN & PERSONAL */}
              {(activeView.startsWith('org_') ||
                (activeView.startsWith('personnel_') && activeView !== 'personnel_encargaturas')) && (
                <OrgPersonnelModule
                  activeView={activeView}
                  dependencias={dependencias}
                  direccionesOrganos={direccionesOrganos}
                  areas={areas}
                  cargos={cargos}
                  responsables={responsables}
                  employees={employees}
                  assignmentHistory={assignmentHistory}
                  horarios={horarios}
                  activeRole={activeRole}
                  encargaturas={encargaturas}
                  papeletas={papeletas}
                  devices={devices}
                  onAddDependencia={handleAddDependencia}
                  onEditDependencia={handleEditDependencia}
                  onDeleteDependencia={handleDeleteDependencia}
                  onAddDireccionOrgano={handleAddDireccionOrgano}
                  onEditDireccionOrgano={handleEditDireccionOrgano}
                  onDeleteDireccionOrgano={handleDeleteDireccionOrgano}
                  onAddArea={handleAddArea}
                  onEditArea={handleEditArea}
                  onDeleteArea={handleDeleteArea}
                  onAddCargo={handleAddCargo}
                  onEditCargo={handleEditCargo}
                  onDeleteCargo={handleDeleteCargo}
                  onAddResponsable={handleAddResponsable}
                  onEditResponsable={handleEditResponsable}
                  onDeleteResponsable={handleDeleteResponsable}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={handleEditEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onBulkImportDirecciones={handleBulkImportDirecciones}
                  onBulkImportAreas={handleBulkImportAreas}
                  onBulkImportTrabajadores={handleBulkImportTrabajadores}
                />
              )}

              {/* ENCARGATURAS TEMPORALES */}
              {activeView === 'personnel_encargaturas' && (
                <EncargaturasModule
                  encargaturas={encargaturas}
                  onAddEncargatura={handleAddEncargatura}
                  onEditEncargatura={handleEditEncargatura}
                  onDeleteEncargatura={handleDeleteEncargatura}
                  onAnularEncargatura={handleAnularEncargatura}
                  onBulkImportEncargaturas={handleBulkImportEncargaturas}
                  employees={employees}
                  dependencias={dependencias}
                  direccionesOrganos={direccionesOrganos}
                  areas={areas}
                  papeletas={papeletas}
                  activeRole={activeRole}
                  activeUserDni={activeUserDni}
                />
              )}

              {/* TURNOS & HORARIOS */}
              {activeView.startsWith('shifts_') && (
                <ShiftsSchedulesModule
                  activeView={activeView}
                  turnos={turnos}
                  horarios={horarios}
                  activeRole={activeRole}
                  employees={employees}
                  onEditEmployee={handleEditEmployee}
                  onAddTurno={handleAddTurno}
                  onEditTurno={handleEditTurno}
                  onDeleteTurno={handleDeleteTurno}
                  onAddHorario={handleAddHorario}
                  onEditHorario={handleEditHorario}
                  onDeleteHorario={handleDeleteHorario}
                />
              )}

              {/* ASISTENCIA */}
              {activeView.startsWith('attendance_') && (
                <AttendanceModule
                  activeView={activeView}
                  attendanceData={attendance}
                  activeRole={activeRole}
                  activeUserDni={activeUserDni}
                  onEditAttendanceRecord={handleEditAttendanceRecord}
                />
              )}

              {/* BIOMÉTRICOS ZKTECO */}
              {activeView.startsWith('devices_') && (
                <DevicesModule
                  activeView={activeView}
                  devices={devices}
                  rawPunches={rawPunches}
                  employees={employees}
                  dependencias={dependencias}
                  punchAuthorizations={punchAuthorizations}
                  activeRole={activeRole}
                  onAddDevice={handleAddDevice}
                  onEditDevice={handleEditDevice}
                  onDeleteDevice={handleDeleteDevice}
                  onSimulatePunch={handleSimulatePunch}
                  onAddPunchAuthorization={handleAddPunchAuthorization}
                  onRevokePunchAuthorization={handleRevokePunchAuthorization}
                  onDeletePunchAuthorization={handleDeletePunchAuthorization}
                  onRefreshPunches={syncPunchesFromServer}
                />
              )}

              {/* VACACIONES */}
              {activeView.startsWith('vacations_') && (
                <VacationsModule
                  activeView={activeView}
                  vacaciones={vacaciones}
                  employees={employees}
                  activeRole={activeRole}
                  activeUserDni={activeUserDni}
                  currentUser={currentUser}
                  encargaturas={encargaturas}
                  dependencias={dependencias}
                  direccionesOrganos={direccionesOrganos}
                  areas={areas}
                  cargos={cargos}
                  horarios={horarios}
                  onAddVacation={handleAddVacation}
                  onEditVacation={handleEditVacation}
                  onDeleteVacation={handleDeleteVacation}
                />
              )}

              {/* PAPELETAS & VIGILANCIA / GARITA */}
              {(activeView.startsWith('papeletas_') || activeView.startsWith('security_')) && (
                <PapeletasModule
                  activeView={activeView}
                  papeletas={papeletas}
                  papeletaAudits={papeletaAudits}
                  employees={employees}
                  activeRole={activeRole}
                  activeUserDni={activeUserDni}
                  currentUser={currentUser}
                  encargaturas={encargaturas}
                  dependencias={dependencias}
                  direccionesOrganos={direccionesOrganos}
                  areas={areas}
                  cargos={cargos}
                  onUpdatePapeletaStatus={handleUpdatePapeletaStatus}
                  onCreatePapeleta={handleCreatePapeleta}
                />
              )}

              {/* REPORTES */}
              {activeView.startsWith('reports_') && (
                <ReportsModule
                  attendance={attendance}
                  papeletas={papeletas}
                  vacaciones={vacaciones}
                  employees={employees}
                  reportType={
                    activeView === 'reports_tardiness'
                      ? 'TARDINESS'
                      : activeView === 'reports_absences'
                      ? 'ABSENCES'
                      : activeView === 'reports_overtime'
                      ? 'OVERTIME'
                      : activeView === 'reports_vacations'
                      ? 'VACATIONS'
                      : activeView === 'reports_papeletas'
                      ? 'PAPELETAS'
                      : activeView === 'reports_exits'
                      ? 'EXITS'
                      : 'ATTENDANCE'
                  }
                />
              )}

              {/* ADMINISTRACIÓN */}
              {activeView.startsWith('admin_') && (
                <AdminModule
                  auditLogs={auditLogs}
                  employees={employees}
                  activeRole={activeRole}
                  onEditEmployee={handleEditEmployee}
                  subTab={
                    activeView === 'admin_roles'
                      ? 'ROLES'
                      : activeView === 'admin_audit'
                      ? 'AUDIT'
                      : 'USERS'
                  }
                />
              )}

              {/* CONFIGURACIÓN */}
              {activeView === 'config_system' && <ConfigModule />}
            </>
          )}
        </main>
      </div>

      {/* USER PROFILE & PASSWORD MODAL */}
      {isProfileModalOpen && (
        <UserProfileModal
          employee={currentUser}
          activeRole={activeRole}
          onClose={() => setIsProfileModalOpen(false)}
          onUpdateEmployee={(updated) => {
            handleEditEmployee(updated);
            setCurrentUser(updated);
            localStorage.setItem(
              'drac_auth_session',
              JSON.stringify({
                currentUser: updated,
                activeRole,
              })
            );
          }}
          onRecordAudit={(action, details) => {
            const newLog: AuditLog = {
              id: `audlog-${Date.now()}`,
              timestamp: new Date().toISOString(),
              user_id: currentUser.dni,
              user_name: `${currentUser.first_name} ${currentUser.last_name}`,
              role: activeRole,
              module: 'SEGURIDAD',
              action,
              affected_record_id: currentUser.dni,
              details,
            };
            setAuditLogs((prev) => [newLog, ...prev]);
          }}
        />
      )}
    </div>
  );
}
