import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ERDViewer } from './components/ERDViewer';
import { RbacMatrix } from './components/RbacMatrix';
import { StateMachineViewer } from './components/StateMachineViewer';
import { ZkTecoSpec } from './components/ZkTecoSpec';
import { ApiConsole } from './components/ApiConsole';
import { AttendanceModule } from './components/app/AttendanceModule';
import { PapeletasModule } from './components/app/PapeletasModule';
import { VacationsModule } from './components/app/VacationsModule';
import { ShiftsSchedulesModule } from './components/app/ShiftsSchedulesModule';
import { DevicesModule } from './components/app/DevicesModule';
import { OrgPersonnelModule } from './components/app/OrgPersonnelModule';
import { ArchitectureDoc } from './components/ArchitectureDoc';

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
  const [activeTab, setActiveTab] = useState<string>('app_dashboard');
  const [appSubTab, setAppSubTab] = useState<
    'ATTENDANCE' | 'ORG_PERSONNEL' | 'PAPELETAS' | 'VACATIONS' | 'SHIFTS' | 'DEVICES'
  >('ATTENDANCE');

  // Active User / Role - Default to HR_ADMIN for full management power
  const [activeRole, setActiveRole] = useState<RoleType>('HR_ADMIN');
  const [activeUserDni, setActiveUserDni] = useState<string>('40123987'); // María Silva (RRHH)

  // State Entities - DRAC Structure
  const [dependencias, setDependencias] = useState<Dependencia[]>(INITIAL_DEPENDENCIAS);
  const [direccionesOrganos, setDireccionesOrganos] = useState<DireccionOrgano[]>(INITIAL_DIRECCIONES_ORGANOS);
  const [areas, setAreas] = useState<Area[]>(INITIAL_AREAS);
  const [cargos, setCargos] = useState<Cargo[]>(INITIAL_CARGOS);
  const [responsables, setResponsables] = useState<ResponsableDesignation[]>(INITIAL_RESPONSABLES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [assignmentHistory, setAssignmentHistory] = useState<EmployeeAssignmentHistory[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>(INITIAL_TURNOS);
  const [horarios, setHorarios] = useState<Horario[]>(INITIAL_HORARIOS);
  const [devices, setDevices] = useState<DispositivoZkTeco[]>(INITIAL_DEVICES);
  const [rawPunches, setRawPunches] = useState<MarcacionRaw[]>(INITIAL_RAW_PUNCHES);
  const [marcacionCorrections, setMarcacionCorrections] = useState<MarcacionCorrection[]>([]);
  const [asistenciaCorrections, setAsistenciaCorrections] = useState<AsistenciaCorrectionLog[]>([]);
  const [papeletas, setPapeletas] = useState<PapeletaSalida[]>(INITIAL_PAPELETAS);
  const [papeletaAudits, setPapeletaAudits] = useState<PapeletaAudit[]>(INITIAL_PAPELETA_AUDITS);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>(INITIAL_VACACIONES);
  const [attendance, setAttendance] = useState<AsistenciaProcesada[]>(INITIAL_ATTENDANCE);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // --- BENEFICIARY AUDIT LOG HELPER ---
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

  // --- DEPENDENCIA HANDLERS (DESACTIVABLE POLICY) ---
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
    // POLICY RULE: Never physically delete if historical dependencies exist; set active = false
    setDependencias((prev) => prev.map((d) => (d.id === depId ? { ...d, active: !d.active } : d)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_DEPENDENCIA', depId, `Desactivación / Cambio de estado activo de Dependencia ID ${depId}`);
  };

  // --- DIRECCION / ORGANO HANDLERS (DESACTIVABLE POLICY) ---
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
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_DIRECCION_ORGANO', dirId, `Desactivación / Cambio de estado activo de Dirección/Órgano ID ${dirId}`);
  };

  // --- CARGO HANDLERS ---
  const handleAddCargo = (newCargo: Omit<Cargo, 'id'>) => {
    const created: Cargo = {
      ...newCargo,
      id: `crg-${Date.now()}`,
      active: true,
    };
    setCargos((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_CARGO', created.id, `Nuevo Cargo DRAC: ${created.name}`);
  };

  const handleEditCargo = (updatedCargo: Cargo) => {
    setCargos((prev) => prev.map((c) => (c.id === updatedCargo.id ? updatedCargo : c)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_CARGO', updatedCargo.id, `Actualización de Cargo: ${updatedCargo.name}`);
  };

  const handleDeleteCargo = (cargoId: string) => {
    setCargos((prev) => prev.map((c) => (c.id === cargoId ? { ...c, active: !c.active } : c)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_CARGO', cargoId, `Desactivación / Cambio de estado activo de Cargo ID ${cargoId}`);
  };

  // --- RESPONSABLE DESIGNATION HANDLERS ---
  const handleAddResponsable = (newResp: Omit<ResponsableDesignation, 'id'>) => {
    const created: ResponsableDesignation = {
      ...newResp,
      id: `resp-${Date.now()}`,
      active: true,
    };
    setResponsables((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'DESIGNAR_RESPONSABLE', created.id, `Designación de ${created.title}: ${created.employee_name} para ${created.unit_name}`);
  };

  const handleEditResponsable = (updatedResp: ResponsableDesignation) => {
    setResponsables((prev) => prev.map((r) => (r.id === updatedResp.id ? updatedResp : r)));
  };

  const handleDeleteResponsable = (respId: string) => {
    setResponsables((prev) => prev.map((r) => (r.id === respId ? { ...r, active: !r.active, end_date: new Date().toISOString().split('T')[0] } : r)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_RESPONSABLE', respId, `Cierre de Designación de Jefatura/Dirección ID ${respId}`);
  };

  // --- AREA HANDLERS ---
  const handleAddArea = (newArea: Omit<Area, 'id' | 'created_at'>) => {
    const created: Area = {
      ...newArea,
      id: `area-${Date.now()}`,
      created_at: new Date().toISOString(),
      active: true,
    };
    setAreas((prev) => [...prev, created]);
    addAuditLog('ESTRUCTURA_DRAC', 'CREAR_AREA', created.id, `Nueva Área/Oficina DRAC: ${created.name}`);
  };

  const handleEditArea = (updatedArea: Area) => {
    setAreas((prev) => prev.map((a) => (a.id === updatedArea.id ? updatedArea : a)));
    addAuditLog('ESTRUCTURA_DRAC', 'EDITAR_AREA', updatedArea.id, `Actualización de Área: ${updatedArea.name}`);
  };

  const handleDeleteArea = (areaId: string) => {
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, active: !a.active } : a)));
    addAuditLog('ESTRUCTURA_DRAC', 'DESACTIVAR_AREA', areaId, `Desactivación / Cambio de estado activo de Área/Oficina ID ${areaId}`);
  };

  // --- EMPLOYEE & ASSIGNMENT HISTORY HANDLERS ---
  const handleAddEmployee = (newEmployee: Omit<Employee, 'id'>) => {
    const created: Employee = {
      ...newEmployee,
      id: `emp-${Date.now()}`,
      active: true,
    };
    setEmployees((prev) => [...prev, created]);

    // Initial Assignment Record
    const initialAssignment: EmployeeAssignmentHistory = {
      id: `assign-${Date.now()}`,
      employee_id: created.id,
      employee_dni: created.dni,
      start_date: created.hire_date || new Date().toISOString().split('T')[0],
      dependencia_id: created.dependencia_id,
      dependencia_name: created.dependencia_name,
      direccion_organo_id: created.direccion_organo_id,
      direccion_organo_name: created.direccion_organo_name,
      area_id: created.area_id,
      area_name: created.area_name,
      subarea_id: created.subarea_id,
      subarea_name: created.subarea_name,
      position: created.position,
      cargo_id: created.cargo_id,
      supervisor_id: created.supervisor_id,
      supervisor_name: created.supervisor_name,
      reason: 'Ingreso Inicial / Alta de Personal DRAC',
      created_at: new Date().toISOString(),
    };
    setAssignmentHistory((prev) => [initialAssignment, ...prev]);

    addAuditLog('PERSONAL', 'CREAR_PERSONAL', created.id, `Alta de Trabajador DRAC DNI: ${created.dni} - ${created.first_name} ${created.last_name}`);
  };

  const handleEditEmployee = (updatedEmployee: Employee) => {
    const prevEmp = employees.find((e) => e.id === updatedEmployee.id);
    
    // Check if organizational structure changed
    if (
      prevEmp &&
      (prevEmp.area_id !== updatedEmployee.area_id ||
        prevEmp.dependencia_id !== updatedEmployee.dependencia_id ||
        prevEmp.cargo_id !== updatedEmployee.cargo_id ||
        prevEmp.position !== updatedEmployee.position)
    ) {
      // Close previous assignment
      const todayStr = new Date().toISOString().split('T')[0];
      setAssignmentHistory((prev) =>
        prev.map((a) =>
          a.employee_id === updatedEmployee.id && !a.end_date
            ? { ...a, end_date: todayStr }
            : a
        )
      );

      // Create new assignment record
      const newAssignment: EmployeeAssignmentHistory = {
        id: `assign-${Date.now()}`,
        employee_id: updatedEmployee.id,
        employee_dni: updatedEmployee.dni,
        start_date: todayStr,
        dependencia_id: updatedEmployee.dependencia_id,
        dependencia_name: updatedEmployee.dependencia_name,
        direccion_organo_id: updatedEmployee.direccion_organo_id,
        direccion_organo_name: updatedEmployee.direccion_organo_name,
        area_id: updatedEmployee.area_id,
        area_name: updatedEmployee.area_name,
        subarea_id: updatedEmployee.subarea_id,
        subarea_name: updatedEmployee.subarea_name,
        position: updatedEmployee.position,
        cargo_id: updatedEmployee.cargo_id,
        supervisor_id: updatedEmployee.supervisor_id,
        supervisor_name: updatedEmployee.supervisor_name,
        reason: 'Reasignación Institucional de Área / Cargo DRAC',
        created_at: new Date().toISOString(),
      };
      setAssignmentHistory((prev) => [newAssignment, ...prev]);

      addAuditLog(
        'PERSONAL',
        'NUEVA_ASIGNACION_ORGANIZACIONAL',
        updatedEmployee.id,
        `Reasignación de ${updatedEmployee.first_name} ${updatedEmployee.last_name}: Nueva Área ${updatedEmployee.area_name}, Cargo ${updatedEmployee.position}`
      );
    } else {
      addAuditLog(
        'PERSONAL',
        'EDITAR_PERSONAL',
        updatedEmployee.id,
        `Actualización de Datos de Contacto de Trabajador DNI ${updatedEmployee.dni}`
      );
    }

    setEmployees((prev) => prev.map((e) => (e.id === updatedEmployee.id ? updatedEmployee : e)));
  };

  const handleDeleteEmployee = (employeeId: string) => {
    setEmployees((prev) => prev.map((e) => (e.id === employeeId ? { ...e, active: !e.active } : e)));
    addAuditLog('PERSONAL', 'DESACTIVAR_PERSONAL', employeeId, `Desactivación / Cambio de estado de Trabajador ID ${employeeId}`);
  };

  // --- TURNO HANDLERS ---
  const handleAddTurno = (newTurno: Omit<Turno, 'id' | 'created_at'>) => {
    const created: Turno = {
      ...newTurno,
      id: `tur-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setTurnos((prev) => [...prev, created]);
  };

  const handleEditTurno = (updatedTurno: Turno) => {
    setTurnos((prev) => prev.map((t) => (t.id === updatedTurno.id ? updatedTurno : t)));
  };

  const handleDeleteTurno = (turnoId: string) => {
    setTurnos((prev) => prev.filter((t) => t.id !== turnoId));
  };

  // --- HORARIO HANDLERS ---
  const handleAddHorario = (newHorario: Omit<Horario, 'id'>) => {
    const created: Horario = {
      ...newHorario,
      id: `hor-${Date.now()}`,
    };
    setHorarios((prev) => [...prev, created]);
  };

  const handleEditHorario = (updatedHorario: Horario) => {
    setHorarios((prev) => prev.map((h) => (h.id === updatedHorario.id ? updatedHorario : h)));
  };

  const handleDeleteHorario = (horarioId: string) => {
    setHorarios((prev) => prev.filter((h) => h.id !== horarioId));
  };

  // --- DEVICE HANDLERS ---
  const handleAddDevice = (newDevice: Omit<DispositivoZkTeco, 'id' | 'last_activity' | 'status'>) => {
    const created: DispositivoZkTeco = {
      ...newDevice,
      id: `dev-${Date.now()}`,
      last_activity: 'Justo ahora',
      status: 'ONLINE',
    };
    setDevices((prev) => [...prev, created]);
  };

  const handleEditDevice = (updatedDevice: DispositivoZkTeco) => {
    setDevices((prev) => prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)));
  };

  const handleDeleteDevice = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  // --- ATTENDANCE HANDLERS ---
  const handleEditAttendanceRecord = (updatedRecord: AsistenciaProcesada) => {
    setAttendance((prev) => prev.map((a) => (a.id === updatedRecord.id ? updatedRecord : a)));
  };

  const handleSimulatePunch = (newPunch: Omit<MarcacionRaw, 'id' | 'processed' | 'processed_at'>) => {
    const created: MarcacionRaw = {
      ...newPunch,
      id: `p-${Date.now()}`,
      processed: true,
      processed_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setRawPunches((prev) => [created, ...prev]);

    // Dynamic Attendance Log Update
    const emp = employees.find((e) => e.dni === newPunch.employee_dni);
    if (emp) {
      const todayStr = new Date().toISOString().split('T')[0];
      const realTimeStr = created.timestamp.split(' ')[1]?.substring(0, 5) || '08:00';

      setAttendance((prev) => {
        const existing = prev.find((a) => a.employee_dni === newPunch.employee_dni && a.fecha === todayStr);
        if (existing) {
          return prev.map((a) => {
            if (a.id === existing.id) {
              return {
                ...a,
                t1_real_in: newPunch.punch_type === 'CHECK_IN' ? realTimeStr : a.t1_real_in,
                t1_real_out: newPunch.punch_type === 'CHECK_OUT' ? realTimeStr : a.t1_real_out,
                status: 'PUNCTUAL',
              };
            }
            return a;
          });
        } else {
          const newAst: AsistenciaProcesada = {
            id: `ast-${Date.now()}`,
            employee_id: emp.id,
            employee_dni: emp.dni,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            area_name: emp.area_name,
            fecha: todayStr,
            horario_name: emp.schedule_name || 'Jornada Estándar',
            t1_scheduled_in: '08:00',
            t1_scheduled_out: '13:00',
            t1_real_in: newPunch.punch_type === 'CHECK_IN' ? realTimeStr : undefined,
            t1_real_out: newPunch.punch_type === 'CHECK_OUT' ? realTimeStr : undefined,
            t1_tardiness_minutes: 0,
            t2_tardiness_minutes: 0,
            total_tardiness_minutes: 0,
            tolerance_applied_minutes: 0,
            net_tardiness_minutes: 0,
            overtime_minutes: 0,
            status: 'PUNCTUAL',
            has_papeleta: false,
            is_vacation_day: false,
            observations: `Marcación registrada vía dispositivo ${newPunch.device_name || 'ZKTeco'}`,
          };
          return [newAst, ...prev];
        }
      });
    }
  };

  // --- PAPELETA WORKFLOW HANDLERS ---
  const handleUpdatePapeletaStatus = (
    papeletaId: string,
    action: 'APPROVE_BOSS' | 'APPROVE_HR' | 'REJECT' | 'MARK_OUTING_REAL' | 'MARK_COMPLETED_REAL',
    comment?: string,
    horaReal?: string
  ) => {
    setPapeletas((prev) =>
      prev.map((p) => {
        if (p.id !== papeletaId) return p;

        let nextStatus = p.status;
        let updateBossTime = p.boss_approved_at;
        let updateHrTime = p.hr_approved_at;
        let updateRealSalida = p.hora_real_salida;
        let updateRealRetorno = p.hora_real_retorno;

        if (action === 'APPROVE_BOSS') {
          nextStatus = 'PENDING_HR';
          updateBossTime = new Date().toISOString();
        } else if (action === 'APPROVE_HR') {
          nextStatus = 'APPROVED';
          updateHrTime = new Date().toISOString();
        } else if (action === 'REJECT') {
          nextStatus = 'REJECTED';
        } else if (action === 'MARK_OUTING_REAL') {
          nextStatus = 'IN_OUTING';
          updateRealSalida = horaReal || '10:32';
        } else if (action === 'MARK_COMPLETED_REAL') {
          nextStatus = 'COMPLETED';
          updateRealRetorno = horaReal || '11:55';
        }

        // Add Audit Log
        const newAudit: PapeletaAudit = {
          id: `aud-${Date.now()}`,
          papeleta_id: p.id,
          previous_status: p.status,
          new_status: nextStatus,
          action_by_user_id: activeUserDni,
          action_by_user_name:
            activeRole === 'SUPERVISOR'
              ? 'Carlos Mendoza (Jefe)'
              : activeRole === 'HR_ADMIN'
              ? 'María Silva (RRHH)'
              : activeRole === 'SECURITY_GUARD'
              ? 'Roberto Guerrero (Garita)'
              : 'Juan Pérez (Empleado)',
          action_by_role: activeRole,
          comment: comment || `Acción de workflow: ${action}`,
          timestamp: new Date().toISOString(),
        };

        setPapeletaAudits((audPrev) => [newAudit, ...audPrev]);

        return {
          ...p,
          status: nextStatus,
          boss_approved_at: updateBossTime,
          hr_approved_at: updateHrTime,
          hora_real_salida: updateRealSalida,
          hora_real_retorno: updateRealRetorno,
          updated_at: new Date().toISOString(),
        };
      })
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

    // Initial audit log
    const auditLog: PapeletaAudit = {
      id: `aud-${Date.now()}`,
      papeleta_id: newId,
      previous_status: 'DRAFT',
      new_status: 'PENDING_BOSS',
      action_by_user_id: activeUserDni,
      action_by_user_name: 'Juan Pérez Gómez',
      action_by_role: 'EMPLOYEE',
      comment: 'Solicitud de papeleta registrada por el colaborador.',
      timestamp: new Date().toISOString(),
    };

    setPapeletaAudits((prev) => [auditLog, ...prev]);
  };

  // --- VACATION HANDLERS ---
  const handleAddVacation = (newVacationData: Omit<Vacacion, 'id' | 'created_at'>) => {
    const newVac: Vacacion = {
      ...newVacationData,
      id: `vac-00${vacaciones.length + 1}`,
      created_at: new Date().toISOString(),
    };
    setVacaciones((prev) => [newVac, ...prev]);
  };

  const handleEditVacation = (updatedVacation: Vacacion) => {
    setVacaciones((prev) => prev.map((v) => (v.id === updatedVacation.id ? updatedVacation : v)));
  };

  const handleDeleteVacation = (vacationId: string) => {
    setVacaciones((prev) => prev.filter((v) => v.id !== vacationId));
  };

  const handleResetAllData = () => {
    if (confirm('⚠️ ATENCIÓN: ¿Está seguro de eliminar TODA la información institucional de la DRAC?\n\nEsta acción limpiará Dependencias, Direcciones, Áreas, Cargos, Responsables, Personal, Turnos, Horarios, Biométricos, Papeletas y Asistencias, dejando el sistema 100% limpio e inicializado listo para la configuración institucional.')) {
      setDependencias([]);
      setDireccionesOrganos([]);
      setAreas([]);
      setCargos([]);
      setResponsables([]);
      setEmployees([]);
      setTurnos([]);
      setHorarios([]);
      setDevices([]);
      setRawPunches([]);
      setPapeletas([]);
      setPapeletaAudits([]);
      setVacaciones([]);
      setAttendance([]);
      setAuditLogs([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Enterprise Header & Role Switcher */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        activeUserDni={activeUserDni}
        setActiveUserDni={setActiveUserDni}
        onResetData={handleResetAllData}
      />

      {/* Main Content Workspace Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: OPERATIONAL HRMS LIVE SYSTEM */}
        {activeTab === 'app_dashboard' && (
          <div className="space-y-6">
            {/* Operational Sub Navigation Bar */}
            <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1.5 flex space-x-1 overflow-x-auto">
              {[
                { id: 'ATTENDANCE', label: 'Control Asistencia' },
                { id: 'ORG_PERSONNEL', label: 'Estructura & Personal' },
                { id: 'PAPELETAS', label: 'Papeletas de Salida (Workflow)' },
                { id: 'VACATIONS', label: 'Gestión Vacaciones' },
                { id: 'SHIFTS', label: 'Turnos & Horarios' },
                { id: 'DEVICES', label: 'Biométricos ZKTeco & Staging' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setAppSubTab(sub.id as any)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-all ${
                    appSubTab === sub.id
                      ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Sub-views */}
            {appSubTab === 'ATTENDANCE' && (
              <AttendanceModule
                attendanceData={attendance}
                activeRole={activeRole}
                activeUserDni={activeUserDni}
                onEditAttendanceRecord={handleEditAttendanceRecord}
              />
            )}

            {appSubTab === 'ORG_PERSONNEL' && (
              <OrgPersonnelModule
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

            {appSubTab === 'PAPELETAS' && (
              <PapeletasModule
                papeletas={papeletas}
                papeletaAudits={papeletaAudits}
                employees={employees}
                activeRole={activeRole}
                activeUserDni={activeUserDni}
                onUpdatePapeletaStatus={handleUpdatePapeletaStatus}
                onCreatePapeleta={handleCreatePapeleta}
              />
            )}

            {appSubTab === 'VACATIONS' && (
              <VacationsModule
                vacaciones={vacaciones}
                employees={employees}
                activeRole={activeRole}
                onAddVacation={handleAddVacation}
                onEditVacation={handleEditVacation}
                onDeleteVacation={handleDeleteVacation}
              />
            )}

            {appSubTab === 'SHIFTS' && (
              <ShiftsSchedulesModule
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

            {appSubTab === 'DEVICES' && (
              <DevicesModule
                devices={devices}
                rawPunches={rawPunches}
                employees={employees}
                activeRole={activeRole}
                onAddDevice={handleAddDevice}
                onEditDevice={handleEditDevice}
                onDeleteDevice={handleDeleteDevice}
                onSimulatePunch={handleSimulatePunch}
              />
            )}
          </div>
        )}

        {/* TAB 2: ARCHITECTURE & DDL SQL */}
        {activeTab === 'architecture' && (
          <div className="space-y-8">
            <ArchitectureDoc />
            <ERDViewer />
          </div>
        )}

        {/* TAB 3: RBAC MATRIX */}
        {activeTab === 'rbac' && <RbacMatrix />}

        {/* TAB 4: STATE MACHINE */}
        {activeTab === 'state_machine' && <StateMachineViewer />}

        {/* TAB 5: ZKTECO SPEC */}
        {activeTab === 'zkteco_spec' && <ZkTecoSpec />}

        {/* TAB 6: API DOCS */}
        {activeTab === 'api_docs' && <ApiConsole />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#090A0D] py-4 mt-12 px-6 flex flex-col md:flex-row items-center justify-between text-[10px] text-slate-500 font-mono gap-2">
        <div>DB SCHEMA: POSTGRESQL (PUBLIC) | PK CLUSTERED | INDEXED: EMP_ID, TIMESTAMP_UTC</div>
        <div>REST API v1 | OWASP SECURED | HRMS ENTERPRISE EDITION</div>
      </footer>
    </div>
  );
}
