import React, { useState, useEffect } from 'react';
import {
  DispositivoZkTeco,
  MarcacionRaw,
  AttendanceRecord,
  Employee,
  UserRole,
} from './types';
import { INITIAL_DEVICES } from './data/initialDevices';
import { INITIAL_EMPLOYEES } from './data/initialEmployees';
import { INITIAL_RAW_PUNCHES } from './data/initialRawPunches';
import { INITIAL_ATTENDANCE } from './data/initialAttendance';
import { attendanceService } from './services/attendanceService';
import { OperationalDashboard } from './components/app/OperationalDashboard';
import { AttendanceModule } from './components/app/AttendanceModule';
import { DevicesModule } from './components/app/DevicesModule';
import { AdmsPushSection } from './components/app/AdmsPushSection';
import { ShiftsSchedulesModule } from './components/app/ShiftsSchedulesModule';
import { EmployeesModule } from './components/app/EmployeesModule';
import { ZkTecoSpec } from './components/app/ZkTecoSpec';
import {
  LayoutDashboard,
  Clock,
  Cpu,
  Radio,
  Calendar,
  Users,
  BookOpen,
  ShieldCheck,
  UserCheck,
  Activity,
  Layers,
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN_GENERAL');
  const [devices, setDevices] = useState<DispositivoZkTeco[]>(INITIAL_DEVICES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [rawPunches, setRawPunches] = useState<MarcacionRaw[]>(INITIAL_RAW_PUNCHES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refresh punches and attendance from server (purges any legacy mock data in storage)
  const loadServerData = async () => {
    try {
      // Clean up legacy localStorage if it contains mock punch IDs
      if (typeof window !== 'undefined') {
        const legacyPunches = localStorage.getItem('drac_data_rawPunches') || localStorage.getItem('drac_rawPunches');
        if (legacyPunches && (legacyPunches.includes('raw-1787835') || legacyPunches.includes('fictic') || legacyPunches.includes('simul'))) {
          localStorage.removeItem('drac_data_rawPunches');
          localStorage.removeItem('drac_rawPunches');
          localStorage.removeItem('drac_data_attendance');
          localStorage.removeItem('drac_attendance');
        }
      }

      const punches = await attendanceService.getRawPunches();
      // Filter out any synthetic IDs if any existed in older cache
      const cleanPunches = punches.filter((p) => !p.id.startsWith('raw-1787835'));
      setRawPunches(cleanPunches);

      const atts = await attendanceService.getAttendanceRecords();
      setAttendance(atts);
    } catch (err) {
      console.warn('Error loading attendance data from server:', err);
    }
  };

  useEffect(() => {
    loadServerData();
    const interval = setInterval(loadServerData, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#090A0D] text-slate-100 flex flex-col">
      {/* Top Header & Navigation */}
      <header className="bg-[#0D0F14] border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white tracking-wide block">
                  DRAC CUSCO — CONTROL DE ASISTENCIA
                </span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  ZKTeco G3-id (192.168.1.180:4370)
                </span>
              </div>
            </div>

            {/* Right Header: Role switcher and clock */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col text-right font-mono text-xs">
                <span className="text-white font-bold">
                  {currentTime.toLocaleTimeString('es-PE')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {currentTime.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400 ml-1.5" />
                <select
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value as UserRole)}
                  className="bg-transparent text-slate-200 text-xs font-semibold px-2 py-0.5 outline-none cursor-pointer"
                >
                  <option value="ADMIN_GENERAL" className="bg-slate-900">Admin General</option>
                  <option value="HR_ADMIN" className="bg-slate-900">Admin RRHH</option>
                  <option value="JEFE_RRHH" className="bg-slate-900">Jefe RRHH</option>
                  <option value="CONTROL_ASISTENCIA" className="bg-slate-900">Control Asistencia</option>
                  <option value="SUPERVISOR" className="bg-slate-900">Supervisor</option>
                  <option value="TRABAJADOR" className="bg-slate-900">Servidor Civil</option>
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-800/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Panel Operativo</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'attendance'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Marcaciones & Asistencia ({rawPunches.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'devices'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Terminales ZKTeco</span>
            </button>

            <button
              onClick={() => setActiveTab('adms_push')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'adms_push'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Servidor ADMS Push</span>
            </button>

            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'shifts'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Turnos & Tolerancias (RIS)</span>
            </button>

            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'employees'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Padrón Servidores ({employees.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('spec')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'spec'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Especificación G3-id</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeTab === 'dashboard' && (
          <OperationalDashboard
            devices={devices}
            rawPunches={rawPunches}
            attendance={attendance}
            employees={employees}
            activeRole={activeRole}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceModule
            attendance={attendance}
            rawPunches={rawPunches}
            employees={employees}
            activeRole={activeRole}
            onRefresh={loadServerData}
          />
        )}

        {activeTab === 'devices' && (
          <DevicesModule
            devices={devices}
            rawPunches={rawPunches}
            employees={employees}
            activeRole={activeRole}
            onRefreshDevices={loadServerData}
            onRefreshPunches={loadServerData}
          />
        )}

        {activeTab === 'adms_push' && (
          <AdmsPushSection
            devices={devices}
            rawPunches={rawPunches}
            employees={employees}
            activeRole={activeRole}
            onRefreshDevices={loadServerData}
            onRefreshPunches={loadServerData}
          />
        )}

        {activeTab === 'shifts' && <ShiftsSchedulesModule />}

        {activeTab === 'employees' && (
          <EmployeesModule employees={employees} activeRole={activeRole} />
        )}

        {activeTab === 'spec' && <ZkTecoSpec />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#060709] py-4 text-center text-xs text-slate-500 font-mono">
        Dirección Regional de Agricultura Cusco — Sistema Integrado de Marcaciones Biométricas ZKTeco
      </footer>
    </div>
  );
};
