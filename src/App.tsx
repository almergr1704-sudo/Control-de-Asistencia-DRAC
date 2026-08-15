import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OperationalDashboard } from './components/app/OperationalDashboard';
import { AttendanceModule } from './components/app/AttendanceModule';
import { PapeletasModule } from './components/app/PapeletasModule';
import { VacationsModule } from './components/app/VacationsModule';
import { ShiftsSchedulesModule } from './components/app/ShiftsSchedulesModule';
import { DevicesModule } from './components/app/DevicesModule';
import { OrgPersonnelModule } from './components/app/OrgPersonnelModule';
import { ReportsModule } from './components/app/ReportsModule';
import { AdminModule } from './components/app/AdminModule';
import { ConfigModule } from './components/app/ConfigModule';
import { getViewFromHash, VIEW_TO_HASH, isViewAllowedForRole } from './utils/router';

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
  INITIAL_PAPELETA_AUDITS,
  INITIAL_VACACIONES,
  INITIAL_ATTENDANCE,
  INITIAL_AUDIT_LOGS,
} from './data/initialData';

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
  Turno,
  Horario,
  DispositivoZkTeco,
  MarcacionRaw,
  AuditLog,
  EmployeeAssignmentHistory,
  MarcacionCorrection,
  AsistenciaCorrectionLog,
} from './types';

export default function App() {
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  // Active User / Role - Default to HR_ADMIN for full operational access
  const [activeRole, setActiveRole] = useState<RoleType>('HR_ADMIN');
  const [activeUserDni, setActiveUserDni] = useState<string>('40123987'); // María Silva (RRHH)

  const [activeView, setActiveView] = useState<string>(() => getViewFromHash(window.location.hash, 'HR_ADMIN'));

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
    const allowedView = getViewFromHash(window.location.hash, role);
    setActiveView(allowedView);
    window.location.hash = VIEW_TO_HASH[allowedView] || '#/dashboard';
  };

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
  const [dependencias, setDependencias] = useState<Dependencia[]>(() =>
    loadStored('dependencias', INITIAL_DEPENDENCIAS)
  );
  const [direccionesOrganos, setDireccionesOrganos] = useState<DireccionOrgano[]>(() =>
    loadStored('direccionesOrganos', INITIAL_DIRECCIONES_ORGANOS)
  );
  const [areas, setAreas] = useState<Area[]>(() => loadStored('areas', INITIAL_AREAS));
  const [cargos, setCargos] = useState<Cargo[]>(() => loadStored('cargos', INITIAL_CARGOS));
  const [responsables, setResponsables] = useState<ResponsableDesignation[]>(() =>
    loadStored('responsables', INITIAL_RESPONSABLES)
  );
  const [employees, setEmployees] = useState<Employee[]>(() =>
    loadStored('employees', INITIAL_EMPLOYEES)
  );
  const [assignmentHistory, setAssignmentHistory] = useState<EmployeeAssignmentHistory[]>(() =>
    loadStored('assignmentHistory', [])
  );
  const [turnos, setTurnos] = useState<Turno[]>(() => loadStored('turnos', INITIAL_TURNOS));
  const [horarios, setHorarios] = useState<Horario[]>(() => loadStored('horarios', INITIAL_HORARIOS));
  const [devices, setDevices] = useState<DispositivoZkTeco[]>(() =>
    loadStored('devices', INITIAL_DEVICES)
  );
  const [rawPunches, setRawPunches] = useState<MarcacionRaw[]>(() =>
    loadStored('rawPunches', INITIAL_RAW_PUNCHES)
  );
  const [papeletas, setPapeletas] = useState<PapeletaSalida[]>(() =>
    loadStored('papeletas', INITIAL_PAPELETAS)
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
      localStorage.setItem('drac_data_papeletas', JSON.stringify(papeletas));
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
    papeletas,
    papeletaAudits,
    vacaciones,
    attendance,
    auditLogs,
  ]);

  // AUDIT LOG HELPER
  const addAuditLog = (module: string, action: string, affectedRecordId: string, details: string) => {
    const newLog: AuditLog = {
      id: `audlog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_id: activeUserDni,
      user_name:
        activeRole === 'HR_ADMIN'
          ? 'Administrador DRAC'
          : activeRole === 'SUPERVISOR'
          ? 'Jefe / Director DRAC'
          : activeRole === 'SECURITY_GUARD'
          ? 'Agente Vigilancia DRAC'
          : 'Trabajador DRAC',
      role: activeRole,
      module,
      action,
      affected_record_id: affectedRecordId,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // DEPENDENCIA HANDLERS
  const handleAddDependencia = (newDep: Omit<Dependencia, 'id' | 'created_at'>) => {
    const created: Dependencia = {
      ...newDep,
      id: `dep-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setDependencias((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_DEPENDENCIA', created.id, `Nueva Dependencia DRAC: ${created.name}`);
  };

  const handleEditDependencia = (updatedDep: Dependencia) => {
    setDependencias((prev) => prev.map((d) => (d.id === updatedDep.id ? updatedDep : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_DEPENDENCIA', updatedDep.id, `Actualización de Dependencia: ${updatedDep.name}`);
  };

  const handleDeleteDependencia = (depId: string) => {
    setDependencias((prev) => prev.map((d) => (d.id === depId ? { ...d, active: !d.active } : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_DEPENDENCIA', depId, `Cambio de estado activo de Dependencia ID ${depId}`);
  };

  // DIRECCION / ORGANO HANDLERS
  const handleAddDireccionOrgano = (newDir: Omit<DireccionOrgano, 'id' | 'created_at'>) => {
    const created: DireccionOrgano = {
      ...newDir,
      id: `dir-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setDireccionesOrganos((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_DIRECCION_ORGANO', created.id, `Nueva Dirección/Órgano DRAC: ${created.name}`);
  };

  const handleEditDireccionOrgano = (updatedDir: DireccionOrgano) => {
    setDireccionesOrganos((prev) => prev.map((d) => (d.id === updatedDir.id ? updatedDir : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_DIRECCION_ORGANO', updatedDir.id, `Actualización Dirección/Órgano: ${updatedDir.name}`);
  };

  const handleDeleteDireccionOrgano = (dirId: string) => {
    setDireccionesOrganos((prev) => prev.map((d) => (d.id === dirId ? { ...d, active: !d.active } : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_DIRECCION_ORGANO', dirId, `Cambio de estado activo Dirección/Órgano ID ${dirId}`);
  };

  // AREA HANDLERS
  const handleAddArea = (newArea: Omit<Area, 'id' | 'created_at'>) => {
    const created: Area = {
      ...newArea,
      id: `area-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setAreas((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_AREA', created.id, `Nueva Área DRAC: ${created.name}`);
  };

  const handleEditArea = (updatedArea: Area) => {
    setAreas((prev) => prev.map((a) => (a.id === updatedArea.id ? updatedArea : a)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_AREA', updatedArea.id, `Actualización de Área: ${updatedArea.name}`);
  };

  const handleDeleteArea = (areaId: string) => {
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, active: !a.active } : a)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_AREA', areaId, `Cambio de estado activo Área ID ${areaId}`);
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

  // EMPLOYEE HANDLERS
  const handleAddEmployee = (newEmpData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...newEmpData,
      id: `emp-${Date.now()}`,
    };
    setEmployees((prev) => [...prev, newEmp]);
    addAuditLog('PERSONAL', 'CREAR_EMPLEADO', newEmp.id, `Registro de personal DRAC: ${newEmp.first_name} ${newEmp.last_name}`);
  };

  const handleEditEmployee = (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    addAuditLog('PERSONAL', 'EDITAR_EMPLEADO', updatedEmp.id, `Actualización datos de personal: ${updatedEmp.first_name} ${updatedEmp.last_name}`);
  };

  const handleDeleteEmployee = (empId: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === empId) {
          const nextActive = !e.active;
          return {
            ...e,
            active: nextActive,
            account_status: nextActive ? (e.has_system_access ? 'ACTIVE' : 'INACTIVE') : 'INACTIVE',
          };
        }
        return e;
      })
    );
    addAuditLog('PERSONAL', 'ESTADO_EMPLEADO', empId, `Cambio de estado activo/cuenta de personal ID ${empId}`);
  };

  // SHIFTS / HORARIOS HANDLERS
  const handleAddTurno = (newTurno: Omit<Turno, 'id' | 'created_at'>) => {
    const created: Turno = {
      ...newTurno,
      id: `tur-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setTurnos((prev) => [...prev, created]);
    addAuditLog('HORARIOS', 'CREAR_TURNO', created.id, `Nuevo Turno: ${created.name}`);
  };

  const handleEditTurno = (updatedTurno: Turno) => {
    setTurnos((prev) => prev.map((t) => (t.id === updatedTurno.id ? updatedTurno : t)));
    addAuditLog('HORARIOS', 'EDITAR_TURNO', updatedTurno.id, `Actualización Turno: ${updatedTurno.name}`);
  };

  const handleDeleteTurno = (turnoId: string) => {
    setTurnos((prev) => prev.map((t) => (t.id === turnoId ? { ...t, active: !t.active } : t)));
    addAuditLog('HORARIOS', 'DESACTIVAR_TURNO', turnoId, `Cambio de estado activo Turno ID ${turnoId}`);
  };

  const handleAddHorario = (newHorario: Omit<Horario, 'id'>) => {
    const created: Horario = {
      ...newHorario,
      id: `hor-${Date.now()}`,
    };
    setHorarios((prev) => [...prev, created]);
    addAuditLog('HORARIOS', 'CREAR_HORARIO', created.id, `Nuevo Horario: ${created.name}`);
  };

  const handleEditHorario = (updatedHorario: Horario) => {
    setHorarios((prev) => prev.map((h) => (h.id === updatedHorario.id ? updatedHorario : h)));
    addAuditLog('HORARIOS', 'EDITAR_HORARIO', updatedHorario.id, `Actualización Horario: ${updatedHorario.name}`);
  };

  const handleDeleteHorario = (horarioId: string) => {
    setHorarios((prev) => prev.map((h) => (h.id === horarioId ? { ...h, active: !h.active } : h)));
    addAuditLog('HORARIOS', 'DESACTIVAR_HORARIO', horarioId, `Cambio de estado activo Horario ID ${horarioId}`);
  };

  // DEVICE HANDLERS
  const handleAddDevice = (newDev: Omit<DispositivoZkTeco, 'id' | 'last_activity'>) => {
    const created: DispositivoZkTeco = {
      ...newDev,
      id: `dev-${Date.now()}`,
      last_activity: new Date().toLocaleString('es-PE'),
    };
    setDevices((prev) => [...prev, created]);
    addAuditLog('BIOMETRICOS', 'REGISTRAR_DISPOSITIVO', created.id, `Nuevo Biométrico: ${created.name} (${created.serial_number}) - Estado: ${created.status}`);
  };

  const handleEditDevice = (updatedDev: DispositivoZkTeco) => {
    setDevices((prev) => prev.map((d) => (d.id === updatedDev.id ? updatedDev : d)));
    addAuditLog('BIOMETRICOS', 'EDITAR_DISPOSITIVO', updatedDev.id, `Actualización Biométrico: ${updatedDev.name}`);
  };

  const handleDeleteDevice = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    addAuditLog('BIOMETRICOS', 'ELIMINAR_DISPOSITIVO', deviceId, `Eliminación de Biométrico ID ${deviceId}`);
  };

  const handleSimulatePunch = (newPunchData: Omit<MarcacionRaw, 'id' | 'processed' | 'processed_at'>) => {
    const createdPunch: MarcacionRaw = {
      ...newPunchData,
      id: `punch-${Date.now()}`,
      processed: true,
      processed_at: new Date().toISOString(),
    };
    setRawPunches((prev) => [createdPunch, ...prev]);
    addAuditLog('BIOMETRICOS', 'MARCACION_RECIBIDA', createdPunch.id, `Marcación de DNI ${createdPunch.employee_dni}`);
  };

  // PAPELETAS HANDLERS
  const handleUpdatePapeletaStatus = (
    papeletaId: string,
    action: PapeletaStatus | 'APPROVE_BOSS' | 'APPROVE_HR' | 'REJECT' | 'MARK_OUTING_REAL' | 'MARK_COMPLETED_REAL',
    comment?: string,
    realExitTime?: string,
    realReturnTime?: string
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

    setPapeletas((prev) =>
      prev.map((p) => {
        if (p.id !== papeletaId) return p;
        const now = new Date().toISOString();
        return {
          ...p,
          status: targetStatus,
          boss_approved_at: action === 'APPROVE_BOSS' ? now : p.boss_approved_at,
          boss_comment: action === 'APPROVE_BOSS' ? comment : p.boss_comment,
          hr_approved_at: action === 'APPROVE_HR' ? now : p.hr_approved_at,
          hr_comment: action === 'APPROVE_HR' ? comment : p.hr_comment,
          hora_real_salida: realExitTime !== undefined ? realExitTime : p.hora_real_salida,
          hora_real_retorno: realReturnTime !== undefined ? realReturnTime : p.hora_real_retorno,
          updated_at: now,
        };
      })
    );

    addAuditLog(
      'PAPELETAS',
      `STATUS_${action}`,
      papeletaId,
      `Papeleta ID ${papeletaId} actualizada a estado: ${targetStatus}${comment ? ` - Obs: ${comment}` : ''}`
    );
  };

  const handleCreatePapeleta = (newPapeletaData: Omit<PapeletaSalida, 'id' | 'code' | 'created_at' | 'updated_at'>) => {
    const newCode = `PAP-2026-000${papeletas.length + 1}`;
    const newId = `pap-00${papeletas.length + 1}`;

    const newPapeleta: PapeletaSalida = {
      ...newPapeletaData,
      id: newId,
      code: newCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setPapeletas((prev) => [newPapeleta, ...prev]);
    addAuditLog('PAPELETAS', 'CREAR_PAPELETA', newId, `Nueva Papeleta registrada para DNI ${newPapeleta.employee_dni}`);
  };

  // VACATION HANDLERS
  const handleAddVacation = (newVacationData: Omit<Vacacion, 'id' | 'created_at'>) => {
    const newVac: Vacacion = {
      ...newVacationData,
      id: `vac-00${vacaciones.length + 1}`,
      created_at: new Date().toISOString(),
    };
    setVacaciones((prev) => [newVac, ...prev]);
    addAuditLog('VACACIONES', 'SOLICITAR_VACACION', newVac.id, `Solicitud vacacional DNI ${newVac.employee_dni}`);
  };

  const handleEditVacation = (updatedVacation: Vacacion) => {
    setVacaciones((prev) => prev.map((v) => (v.id === updatedVacation.id ? updatedVacation : v)));
  };

  const handleDeleteVacation = (vacationId: string) => {
    setVacaciones((prev) => prev.filter((v) => v.id !== vacationId));
  };

  // ATTENDANCE RECORD EDIT HANDLER
  const handleEditAttendanceRecord = (updatedRec: AsistenciaProcesada) => {
    setAttendance((prev) => prev.map((a) => (a.id === updatedRec.id ? updatedRec : a)));
    addAuditLog('ASISTENCIA', 'AJUSTE_REGULARIZACION', updatedRec.id, `Ajuste manual de asistencia DNI ${updatedRec.employee_dni}`);
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
          activeUserDni={activeUserDni}
          setActiveUserDni={setActiveUserDni}
          onResetData={handleResetAllData}
          onToggleSidebarMobile={() => setIsOpenMobile(true)}
        />

        {/* Content Workspace Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* DASHBOARD */}
          {activeView === 'dash_overview' && (
            <OperationalDashboard
              attendance={attendance}
              employees={employees}
              papeletas={papeletas}
              vacaciones={vacaciones}
              activeRole={activeRole}
              onNavigate={handleNavigate}
            />
          )}

          {/* ORGANIZACIÓN & PERSONAL */}
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
            />
          )}

          {/* TURNOS & HORARIOS */}
          {activeView.startsWith('shifts_') && (
            <ShiftsSchedulesModule
              activeView={activeView}
              turnos={turnos}
              horarios={horarios}
              activeRole={activeRole}
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
              activeRole={activeRole}
              onAddDevice={handleAddDevice}
              onEditDevice={handleEditDevice}
              onDeleteDevice={handleDeleteDevice}
              onSimulatePunch={handleSimulatePunch}
            />
          )}

          {/* VACACIONES */}
          {activeView.startsWith('vacations_') && (
            <VacationsModule
              activeView={activeView}
              vacaciones={vacaciones}
              employees={employees}
              activeRole={activeRole}
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
        </main>
      </div>
    </div>
  );
}
