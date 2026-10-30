import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RoleType,
  Employee,
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  ResponsableDesignation,
  Turno,
  Horario,
  DispositivoZkTeco,
  MarcacionRaw,
  AsistenciaProcesada,
  PapeletaSalida,
  PapeletaAudit,
  PapeletaStatus,
  Vacacion,
  Encargatura,
  AuditLog,
  EmployeeAssignmentHistory,
  SecurityConfig,
} from './types';
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
  INITIAL_ATTENDANCE,
  INITIAL_PAPELETAS,
  INITIAL_VACACIONES,
  INITIAL_ENCARGATURAS,
  INITIAL_PAPELETA_AUDITS,
  INITIAL_AUDIT_LOGS,
} from './data/initialData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './components/auth/LoginPage';
import { UserProfileModal } from './components/auth/UserProfileModal';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';

import { OperationalDashboard } from './components/app/OperationalDashboard';
import { OrgPersonnelModule } from './components/app/OrgPersonnelModule';
import { ShiftsSchedulesModule } from './components/app/ShiftsSchedulesModule';
import { AttendanceModule } from './components/app/AttendanceModule';
import { DevicesModule } from './components/app/DevicesModule';
import { VacationsModule } from './components/app/VacationsModule';
import { PapeletasModule } from './components/app/PapeletasModule';
import { ReportsModule } from './components/app/ReportsModule';
import { AdminModule } from './components/app/AdminModule';
import { ConfigModule } from './components/app/ConfigModule';

import { ArchitectureDoc } from './components/ArchitectureDoc';
import { RbacMatrix } from './components/RbacMatrix';
import { StateMachineViewer } from './components/StateMachineViewer';
import { ZkTecoSpec } from './components/ZkTecoSpec';
import { ApiConsole } from './components/ApiConsole';

import { attendanceService } from './services/attendanceService';
import { VIEW_TO_HASH, HASH_TO_VIEW } from './utils/router';

export const App: React.FC = () => {
  // Navigation & View Routing State
  const [activeView, setActiveView] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const matched = HASH_TO_VIEW[window.location.hash];
      if (matched) return matched;
    }
    return 'dash_overview';
  });
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  // Authentication & Active Profile State
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('drac_employees');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (_) {}
      }
    }
    return INITIAL_EMPLOYEES;
  });

  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    return employees[0] || INITIAL_EMPLOYEES[0] || null;
  });

  const [activeRole, setActiveRole] = useState<RoleType>(() => {
    return (currentUser?.role as RoleType) || 'ADMIN_GENERAL';
  });

  // Modal States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState<boolean>(false);

  // Core Institutional Entity States
  const [dependencias, setDependencias] = useState<Dependencia[]>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('drac_dependencias');
      if (s) try { return JSON.parse(s); } catch (_) {}
    }
    return [
      {
        id: 'dep-01',
        code: 'SEDE-01',
        name: 'Sede Central - DRAC Cajamarca',
        type: 'SEDE_CENTRAL',
        ubigeo: '060101',
        address: 'Jr. Huánuco N° 100, Cajamarca',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'dep-02',
        code: 'AA-JAEN',
        name: 'Agencia Agraria Jaén',
        type: 'AGENCIA_AGRARIA',
        ubigeo: '060801',
        address: 'Calle Mariscal Castilla 420, Jaén',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'dep-03',
        code: 'AA-CHOTA',
        name: 'Agencia Agraria Chota',
        type: 'AGENCIA_AGRARIA',
        ubigeo: '060401',
        address: 'Jr. Inca Garcilaso de la Vega 210, Chota',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
    ];
  });

  const [direccionesOrganos, setDireccionesOrganos] = useState<DireccionOrgano[]>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('drac_direcciones');
      if (s) try { return JSON.parse(s); } catch (_) {}
    }
    return [
      {
        id: 'dir-01',
        code: 'DIR-ADM',
        name: 'Dirección de Administración',
        type: 'ORGANO_APOYO',
        dependencia_id: 'dep-01',
        dependencia_name: 'Sede Central - DRAC Cajamarca',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'dir-02',
        code: 'DIR-AGR',
        name: 'Dirección de Competitividad Agraria',
        type: 'DIRECCION',
        dependencia_id: 'dep-01',
        dependencia_name: 'Sede Central - DRAC Cajamarca',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'dir-03',
        code: 'DIR-INFRA',
        name: 'Dirección de Infraestructura Agraria y Riego',
        type: 'DIRECCION',
        dependencia_id: 'dep-01',
        dependencia_name: 'Sede Central - DRAC Cajamarca',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
    ];
  });

  const [areas, setAreas] = useState<Area[]>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('drac_areas');
      if (s) try { return JSON.parse(s); } catch (_) {}
    }
    return [
      {
        id: 'area-01',
        code: 'RRHH',
        name: 'Oficina de Recursos Humanos (Personal)',
        tipo: 'OFICINA',
        dependencia_id: 'dep-01',
        dependencia_name: 'Sede Central - DRAC Cajamarca',
        direccion_organo_id: 'dir-01',
        direccion_organo_name: 'Dirección de Administración',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'area-02',
        code: 'SAN-VEG',
        name: 'Área de Sanidad Vegetal',
        tipo: 'AREA',
        dependencia_id: 'dep-01',
        dependencia_name: 'Sede Central - DRAC Cajamarca',
        direccion_organo_id: 'dir-02',
        direccion_organo_name: 'Dirección de Competitividad Agraria',
        active: true,
        created_at: '2026-01-01T08:00:00Z',
      },
    ];
  });

  const [cargos, setCargos] = useState<Cargo[]>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('drac_cargos');
      if (s) try { return JSON.parse(s); } catch (_) {}
    }
    return [
      { id: 'c-01', code: 'ADM-SIS', name: 'Administrador General del Sistema', nivel_jerarquico: 'DIRECTIVO', active: true },
      { id: 'c-02', code: 'ESP-AGR', name: 'Especialista Agrícola Principal', nivel_jerarquico: 'PROFESIONAL', active: true },
      { id: 'c-03', code: 'ANA-RRHH', name: 'Analista de Recursos Humanos', nivel_jerarquico: 'PROFESIONAL', active: true },
      { id: 'c-04', code: 'TEC-MEC', name: 'Técnico de Maquinaria Agropecuaria', nivel_jerarquico: 'TECNICO', active: true },
    ];
  });

  const [responsables, setResponsables] = useState<ResponsableDesignation[]>(INITIAL_RESPONSABLES);
  const [turnos, setTurnos] = useState<Turno[]>(INITIAL_TURNOS);
  const [horarios, setHorarios] = useState<Horario[]>(INITIAL_HORARIOS);
  const [devices, setDevices] = useState<DispositivoZkTeco[]>(() => {
    return [
      {
        id: 'dev-01',
        name: 'ZKTeco G3 Sede Central (Entrada Principal)',
        serial_number: 'AEH2223460040',
        ip_address: '192.168.1.180',
        port: 7496,
        comm_key: 0,
        device_id_num: 1,
        netmask: '255.255.255.0',
        gateway: '192.168.1.1',
        platform: 'ZMN220_TFT',
        model: 'ZKTeco G3',
        protocol: 'TCP',
        location_detail: 'Entrada Principal Sede Central - DRAC Cajamarca',
        mac_address: '00:17:61:10:74:7F',
        device_type: 'FACIAL_G3',
        firmware_version: 'Ver 1.14.0-build54',
        status: 'ONLINE',
        tcp_status: 'ONLINE',
        agent_status: 'ONLINE',
        last_activity: new Date().toISOString(),
        last_sync: new Date().toISOString(),
        last_latency_ms: 18,
        log_count: 0,
        enrolled_user_count: 142,
        dependencia_id: 'dep-01',
        dependencia_name: 'SEDE CENTRAL - DRAC CAJAMARCA',
        dependencia_tipo: 'SEDE_CENTRAL',
        operator_pc: '192.168.1.33',
        push_enabled: true,
        push_server_address: '192.168.1.29',
        push_server_port: 89,
        push_endpoint: '/iclock/cdata',
        push_protocol: 'HTTP',
        push_interval: 5,
        biotime_config: {
          enabled: true,
          web_port: 89,
          db_type: 'PostgreSQL',
          db_host: '192.168.1.29',
          db_port: 7496,
          db_name: 'biotime',
          db_user: 'postgres',
        },
      },
    ];
  });

  const [rawPunches, setRawPunches] = useState<MarcacionRaw[]>(INITIAL_RAW_PUNCHES);
  const [attendance, setAttendance] = useState<AsistenciaProcesada[]>(INITIAL_ATTENDANCE);
  const [papeletas, setPapeletas] = useState<PapeletaSalida[]>(INITIAL_PAPELETAS);
  const [papeletaAudits, setPapeletaAudits] = useState<PapeletaAudit[]>(INITIAL_PAPELETA_AUDITS);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>(INITIAL_VACACIONES);
  const [encargaturas, setEncargaturas] = useState<Encargatura[]>(INITIAL_ENCARGATURAS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [assignmentHistory, setAssignmentHistory] = useState<EmployeeAssignmentHistory[]>([]);

  // Hash-based routing listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && HASH_TO_VIEW[hash]) {
        setActiveView(HASH_TO_VIEW[hash]);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when activeView changes
  const handleSelectView = (viewId: string) => {
    setActiveView(viewId);
    if (VIEW_TO_HASH[viewId]) {
      window.location.hash = VIEW_TO_HASH[viewId];
    }
  };

  // Sync data from server
  const loadServerData = useCallback(async () => {
    try {
      // 1. Punches
      const punches = await attendanceService.getRawPunches();
      if (Array.isArray(punches)) {
        setRawPunches(punches);
      }
      // 2. Attendance
      const atts = await attendanceService.getAttendanceRecords();
      if (Array.isArray(atts)) {
        setAttendance(atts);
      }
      // 3. Employees
      const resEmps = await fetch('/api/employees').then((r) => r.json()).catch(() => null);
      if (resEmps?.success && Array.isArray(resEmps.data) && resEmps.data.length > 0) {
        setEmployees((prev) => {
          const map = new Map<string, Employee>();
          INITIAL_EMPLOYEES.forEach((e) => map.set(e.dni, e));
          prev.forEach((e) => map.set(e.dni, e));
          resEmps.data.forEach((e: any) => {
            const existing = map.get(e.dni);
            map.set(e.dni, {
              id: e.id || `emp-${e.dni}`,
              codigo_trabajador: e.codigo_trabajador || `DRAC-${e.dni}`,
              dni: e.dni,
              first_name: e.first_name || '',
              last_name: e.last_name || '',
              email: e.email || '',
              phone: e.phone || '',
              dependencia_id: e.dependencia_id || 'dep-01',
              dependencia_name: e.dependencia_name || 'SEDE CENTRAL - DRAC CAJAMARCA',
              direccion_organo_name: e.direccion_organo_name || '',
              area_id: e.area_id || 'area-01',
              area_name: e.area_name || '',
              position: e.cargo || e.position || 'Servidor Público',
              regimen_laboral: (e.regimen_laboral as any) || 'D.L. 276',
              condicion_laboral: (existing?.condicion_laboral || e.condicion || 'NOMBRADO') as any,
              role: existing?.role || 'TRABAJADOR',
              assigned_roles: existing?.assigned_roles || ['TRABAJADOR'],
              has_system_access: true,
              account_status: 'ACTIVE',
              active: true,
              zkteco_pin: e.zkteco_pin || e.dni,
            });
          });
          return Array.from(map.values());
        });
      }
      // 4. Devices
      const resDevs = await fetch('/api/zkteco/devices').then((r) => r.json()).catch(() => null);
      if (resDevs?.success && Array.isArray(resDevs.data) && resDevs.data.length > 0) {
        setDevices(resDevs.data);
      }
    } catch (err) {
      console.warn('[DRAC-CAJAMARCA] Error sincronizando con backend:', err);
    }
  }, []);

  useEffect(() => {
    loadServerData();
    const interval = setInterval(loadServerData, 25000);
    return () => clearInterval(interval);
  }, [loadServerData]);

  // Record institutional audit event
  const handleRecordAudit = (action: string, details: string, empDni?: string, empName?: string) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: currentUser?.id || 'sys',
      user_name: empName || (currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Sistema'),
      module: 'SISTEMA',
      action,
      affected_record_id: empDni || 'record-01',
      details,
      employee_dni: empDni || currentUser?.dni,
      employee_name: empName || (currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Sistema'),
      role: activeRole,
      ip_address: '127.0.0.1',
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Reset system data
  const handleResetData = () => {
    if (window.confirm('¿Está seguro de reiniciar los datos del sistema institucional? Se restablecerán las configuraciones oficiales de DRAC Cajamarca.')) {
      localStorage.clear();
      setEmployees(INITIAL_EMPLOYEES);
      setCurrentUser(INITIAL_EMPLOYEES[0]);
      setActiveRole('ADMIN_GENERAL');
      setRawPunches(INITIAL_RAW_PUNCHES);
      setAttendance(INITIAL_ATTENDANCE);
      setPapeletas(INITIAL_PAPELETAS);
      setVacaciones(INITIAL_VACACIONES);
      setEncargaturas(INITIAL_ENCARGATURAS);
      handleRecordAudit('SISTEMA_REINICIO', 'Se restablecieron los datos institucionales a sus valores base.');
      loadServerData();
    }
  };

  // Login handler
  const handleLoginSuccess = (employee: Employee, selectedRole: RoleType, requiresPasswordChange: boolean) => {
    setCurrentUser(employee);
    setActiveRole(selectedRole);
    if (requiresPasswordChange) {
      setShowPasswordChangeModal(true);
    }
    handleRecordAudit('LOGIN_EXITOSO', `Inicio de sesión exitoso como ${selectedRole}`, employee.dni, `${employee.first_name} ${employee.last_name}`);
  };

  const handleLogout = () => {
    if (currentUser) {
      handleRecordAudit('LOGOUT', 'Cierre de sesión institucional', currentUser.dni, `${currentUser.first_name} ${currentUser.last_name}`);
    }
    setCurrentUser(null);
  };

  // If user is completely logged out, render Login screen
  if (!currentUser) {
    return (
      <LoginPage
        employees={employees}
        onLoginSuccess={handleLoginSuccess}
        onRecordAudit={handleRecordAudit}
      />
    );
  }

  // Derive report type from active view
  const currentReportType = useMemo(() => {
    if (activeView === 'reports_tardiness') return 'TARDINESS';
    if (activeView === 'reports_absences') return 'ABSENCES';
    if (activeView === 'reports_overtime') return 'OVERTIME';
    if (activeView === 'reports_vacations') return 'VACATIONS';
    if (activeView === 'reports_papeletas') return 'PAPELETAS';
    if (activeView === 'reports_exits') return 'EXITS';
    return 'ATTENDANCE';
  }, [activeView]);

  return (
    <div className="min-h-screen bg-[#07080A] text-slate-100 flex flex-col font-sans">
      {/* Institutional Top Header */}
      <Header
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        onResetData={handleResetData}
        onToggleSidebarMobile={() => setIsOpenMobile((prev) => !prev)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeView={activeView}
          setActiveView={handleSelectView}
          activeRole={activeRole}
          isOpenMobile={isOpenMobile}
          setIsOpenMobile={setIsOpenMobile}
        />

        {/* Main Content Area */}
        <main className="flex-1 md:pl-64 overflow-y-auto min-h-[calc(100vh-65px)] p-4 sm:p-6 lg:p-8 bg-[#090A0D]">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* VIEW ROUTER */}
            {activeView === 'dash_overview' && (
              <OperationalDashboard
                devices={devices}
                rawPunches={rawPunches}
                attendance={attendance}
                employees={employees}
                activeRole={activeRole}
                onNavigateTab={handleSelectView}
              />
            )}

            {(activeView.startsWith('org_') || activeView.startsWith('personnel_')) && (
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
                onAddDependencia={(dep) => {
                  const newDep: Dependencia = { ...dep, id: `dep-${Date.now()}`, created_at: new Date().toISOString() };
                  setDependencias((prev) => [...prev, newDep]);
                }}
                onEditDependencia={(dep) => setDependencias((prev) => prev.map((d) => (d.id === dep.id ? dep : d)))}
                onDeleteDependencia={(id) => setDependencias((prev) => prev.filter((d) => d.id !== id))}
                onAddDireccionOrgano={(dir) => {
                  const newDir: DireccionOrgano = { ...dir, id: `dir-${Date.now()}`, created_at: new Date().toISOString() };
                  setDireccionesOrganos((prev) => [...prev, newDir]);
                }}
                onEditDireccionOrgano={(dir) => setDireccionesOrganos((prev) => prev.map((d) => (d.id === dir.id ? dir : d)))}
                onDeleteDireccionOrgano={(id) => setDireccionesOrganos((prev) => prev.filter((d) => d.id !== id))}
                onAddArea={(area) => {
                  const newArea: Area = { ...area, id: `area-${Date.now()}`, created_at: new Date().toISOString() };
                  setAreas((prev) => [...prev, newArea]);
                }}
                onEditArea={(area) => setAreas((prev) => prev.map((a) => (a.id === area.id ? area : a)))}
                onDeleteArea={(id) => setAreas((prev) => prev.filter((a) => a.id !== id))}
                onAddCargo={(cargo) => {
                  const newCargo: Cargo = { ...cargo, id: `cargo-${Date.now()}` };
                  setCargos((prev) => [...prev, newCargo]);
                }}
                onEditCargo={(cargo) => setCargos((prev) => prev.map((c) => (c.id === cargo.id ? cargo : c)))}
                onDeleteCargo={(id) => setCargos((prev) => prev.filter((c) => c.id !== id))}
                onAddEmployee={(emp) => {
                  const newEmp: Employee = { ...emp, id: `emp-${Date.now()}` };
                  setEmployees((prev) => [...prev, newEmp]);
                  handleRecordAudit('CREAR_EMPLEADO', `Registro de servidor: ${newEmp.first_name} ${newEmp.last_name} (DNI ${newEmp.dni})`);
                }}
                onEditEmployee={(emp) => {
                  setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
                  if (currentUser?.id === emp.id) setCurrentUser(emp);
                  handleRecordAudit('EDITAR_EMPLEADO', `Actualización de servidor: ${emp.first_name} ${emp.last_name} (DNI ${emp.dni})`);
                }}
                onDeleteEmployee={(id) => {
                  const found = employees.find((e) => e.id === id);
                  setEmployees((prev) => prev.filter((e) => e.id !== id));
                  if (found) {
                    handleRecordAudit('ELIMINAR_EMPLEADO', `Baja de servidor: ${found.first_name} ${found.last_name} (DNI ${found.dni})`);
                  }
                }}
              />
            )}

            {activeView.startsWith('shifts_') && <ShiftsSchedulesModule />}

            {activeView.startsWith('attendance_') && (
              <AttendanceModule
                attendance={attendance}
                rawPunches={rawPunches}
                employees={employees}
                activeRole={activeRole}
                onRefresh={loadServerData}
              />
            )}

            {activeView.startsWith('devices_') && (
              <DevicesModule
                devices={devices}
                rawPunches={rawPunches}
                employees={employees}
                activeRole={activeRole}
                activeSubView={activeView}
                onRefreshDevices={loadServerData}
                onRefreshPunches={loadServerData}
              />
            )}

            {activeView.startsWith('vacations_') && (
              <VacationsModule
                activeView={activeView}
                vacaciones={vacaciones}
                employees={employees}
                activeRole={activeRole}
                activeUserDni={currentUser?.dni}
                currentUser={currentUser}
                encargaturas={encargaturas}
                dependencias={dependencias}
                direccionesOrganos={direccionesOrganos}
                areas={areas}
                cargos={cargos}
                horarios={horarios}
                onAddVacation={(v) => {
                  const newV: Vacacion = { ...v, id: `vac-${Date.now()}`, created_at: new Date().toISOString() };
                  setVacaciones((prev) => [newV, ...prev]);
                  handleRecordAudit('SOLICITAR_VACACION', `Solicitud de vacación registrada para servidor DNI ${newV.employee_dni} (${newV.dias_solicitados || newV.total_days || 0} días)`);
                }}
                onEditVacation={(v) => setVacaciones((prev) => prev.map((item) => (item.id === v.id ? v : item)))}
                onDeleteVacation={(id) => setVacaciones((prev) => prev.filter((v) => v.id !== id))}
                onApproveBoss={(id, bossData) => {
                  setVacaciones((prev) =>
                    prev.map((v) =>
                      v.id === id
                        ? { ...v, status: 'VB_JEFE', boss_approved_at: new Date().toISOString(), boss_approver_name: bossData?.boss_name }
                        : v
                    )
                  );
                  handleRecordAudit('APROBAR_VACACION_JEFE', `VoBo de jefe otorgado a solicitud de vacación ${id}`);
                }}
                onApproveHR={(id, hrData) => {
                  setVacaciones((prev) =>
                    prev.map((v) =>
                      v.id === id
                        ? { ...v, status: 'APROBADA', hr_approved_at: new Date().toISOString(), hr_approver_name: hrData?.hr_name }
                        : v
                    )
                  );
                  handleRecordAudit('APROBAR_VACACION_RRHH', `Resolución aprobatoria de RRHH para vacación ${id}`);
                }}
                onRejectVacation={(id, rejectData) => {
                  setVacaciones((prev) =>
                    prev.map((v) =>
                      v.id === id
                        ? { ...v, status: 'RECHAZADA', rejection_reason: rejectData?.reason || 'Rechazado' }
                        : v
                    )
                  );
                  handleRecordAudit('RECHAZAR_VACACION', `Vacación rechazada: ${id}`);
                }}
              />
            )}

            {(activeView.startsWith('papeletas_') || activeView.startsWith('security_')) && (
              <PapeletasModule
                activeView={activeView}
                papeletas={papeletas}
                papeletaAudits={papeletaAudits}
                employees={employees}
                activeRole={activeRole}
                activeUserDni={currentUser?.dni || '10000001'}
                currentUser={currentUser}
                encargaturas={encargaturas}
                dependencias={dependencias}
                direccionesOrganos={direccionesOrganos}
                areas={areas}
                cargos={cargos}
                onCreatePapeleta={(newP) => {
                  const created: PapeletaSalida = {
                    ...newP,
                    id: `pap-${Date.now()}`,
                    code: `PAP-2026-${String(papeletas.length + 1).padStart(3, '0')}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  setPapeletas((prev) => [created, ...prev]);
                  handleRecordAudit('CREAR_PAPELETA', `Papeleta emitida: ${created.code} para ${created.employee_name}`);
                }}
                onUpdatePapeletaStatus={(id, action, comment, salida, retorno, approverMeta) => {
                  const actStr = action as string;
                  setPapeletas((prev) =>
                    prev.map((p) => {
                      if (p.id !== id) return p;
                      const updated: PapeletaSalida = { ...p, updated_at: new Date().toISOString() };
                      if (actStr === 'APPROVE_BOSS' || actStr === 'AUTORIZADA_JEFE') {
                        updated.status = 'AUTORIZADA_JEFE';
                        updated.boss_approved_at = new Date().toISOString();
                        updated.boss_comment = comment;
                        if (approverMeta) {
                          updated.boss_approver_name = approverMeta.boss_name;
                          updated.boss_approver_dni = approverMeta.boss_dni;
                        }
                      } else if (actStr === 'APPROVE_HR' || actStr === 'VALIDADA_RRHH') {
                        updated.status = 'VALIDADA_RRHH';
                        updated.hr_approved_at = new Date().toISOString();
                        updated.hr_comment = comment;
                      } else if (actStr === 'REJECT' || actStr === 'RECHAZADA') {
                        updated.status = 'RECHAZADA';
                      } else if (actStr === 'MARK_OUTING_REAL' || actStr === 'SALIDA_EFECTUADA') {
                        updated.status = 'SALIDA_EFECTUADA';
                        updated.hora_real_salida = salida || new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
                      } else if (actStr === 'MARK_COMPLETED_REAL' || actStr === 'RETORNO_REGISTRADO') {
                        updated.status = 'RETORNO_REGISTRADO';
                        updated.hora_real_retorno = retorno || new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
                      } else {
                        updated.status = action as PapeletaStatus;
                      }
                      return updated;
                    })
                  );
                  handleRecordAudit('ACTUALIZAR_PAPELETA', `Papeleta ${id} pasó a estado: ${action}`);
                }}
              />
            )}

            {activeView.startsWith('reports_') && (
              <ReportsModule
                attendance={attendance}
                papeletas={papeletas}
                vacaciones={vacaciones}
                employees={employees}
                reportType={currentReportType}
              />
            )}

            {activeView.startsWith('admin_') && (
              <AdminModule
                auditLogs={auditLogs}
                employees={employees}
                activeRole={activeRole}
                subTab={activeView === 'admin_roles' ? 'ROLES' : activeView === 'admin_audit' ? 'AUDIT' : 'USERS'}
                onEditEmployee={(emp) => {
                  setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
                  if (currentUser?.id === emp.id) setCurrentUser(emp);
                }}
              />
            )}

            {activeView === 'config_system' && <ConfigModule />}

            {/* Technical Documentation Views */}
            {activeView === 'architecture' && <ArchitectureDoc />}
            {activeView === 'rbac' && <RbacMatrix />}
            {activeView === 'state_machine' && <StateMachineViewer />}
            {activeView === 'zkteco_spec' && <ZkTecoSpec />}
            {activeView === 'api_docs' && <ApiConsole />}
          </div>
        </main>
      </div>

      {/* Profile & Password Modals */}
      {showProfileModal && currentUser && (
        <UserProfileModal
          employee={currentUser}
          activeRole={activeRole}
          onClose={() => setShowProfileModal(false)}
          onUpdateEmployee={(updated) => {
            setCurrentUser(updated);
            setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
          onRecordAudit={(act, det) => handleRecordAudit(act, det, currentUser.dni, `${currentUser.first_name} ${currentUser.last_name}`)}
        />
      )}

      {showPasswordChangeModal && currentUser && (
        <ForcePasswordChangeModal
          employee={currentUser}
          onPasswordChanged={(updated) => {
            setCurrentUser(updated);
            setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setShowPasswordChangeModal(false);
            handleRecordAudit('CAMBIO_PASSWORD_OBLIGATORIO', 'Cambio obligatorio de contraseña de primer ingreso completado.', updated.dni);
          }}
          onCancelLogout={handleLogout}
        />
      )}
    </div>
  );
};
