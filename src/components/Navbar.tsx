import React from 'react';
import {
  Database,
  Shield,
  GitMerge,
  Cpu,
  Code2,
  LayoutDashboard,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { RoleType } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: RoleType;
  setActiveRole: (role: RoleType) => void;
  activeUserDni: string;
  setActiveUserDni: (dni: string) => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeRole,
  setActiveRole,
  setActiveUserDni,
  onResetData,
}) => {
  const handleRoleChange = (role: RoleType) => {
    setActiveRole(role);
    if (role === 'EMPLOYEE') setActiveUserDni('71234567');
    if (role === 'SUPERVISOR') setActiveUserDni('45891234');
    if (role === 'HR_ADMIN') setActiveUserDni('40123987');
    if (role === 'SECURITY_GUARD') setActiveUserDni('41987654');
  };

  const navItems = [
    { id: 'app_dashboard', label: 'Gestión de Asistencia & Personal HRMS', icon: LayoutDashboard, badge: 'Sistema Activo' },
    { id: 'architecture', label: 'Arquitectura & DDL SQL', icon: Database },
    { id: 'rbac', label: 'Matriz RBAC', icon: Shield },
    { id: 'state_machine', label: 'Máquina Estados Papeleta', icon: GitMerge },
    { id: 'zkteco_spec', label: 'Integración ZKTeco Push', icon: Cpu },
    { id: 'api_docs', label: 'Especificación REST API', icon: Code2 },
  ];

  return (
    <header className="bg-[#090A0D] border-b border-slate-800 text-slate-300 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/20">
              Σ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white tracking-tight uppercase text-sm">
                  SISTEMA DE CONTROL DE ASISTENCIA &amp; HRMS
                </h1>
                <span className="text-[10px] text-slate-500 font-mono hidden md:inline">v2.5 Enterprise</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Administración de Áreas, Personal, Turnos, Horarios, Vacaciones y ZKTeco
              </p>
            </div>
          </div>

          {/* Right Status Badge & Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Reset Button */}
            <button
              onClick={onResetData}
              className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Eliminar toda la información existente y dejar el sistema limpio"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar Sistema</span>
            </button>

            {/* Active Role Selector */}
            <div className="flex items-center gap-2 bg-[#0F1115] p-1.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1 px-1.5 text-[11px] font-semibold text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Perfil:</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRoleChange('HR_ADMIN')}
                  className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all ${
                    activeRole === 'HR_ADMIN'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title="Administrador RRHH - Control Total CRUD"
                >
                  Admin RRHH
                </button>
                <button
                  onClick={() => handleRoleChange('SUPERVISOR')}
                  className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all ${
                    activeRole === 'SUPERVISOR'
                      ? 'bg-amber-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title="Jefe Inmediato - VoBo Papeletas"
                >
                  Jefe Área
                </button>
                <button
                  onClick={() => handleRoleChange('EMPLOYEE')}
                  className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all ${
                    activeRole === 'EMPLOYEE'
                      ? 'bg-slate-700 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title="Colaborador - Vista Personal"
                >
                  Empleado
                </button>
                <button
                  onClick={() => handleRoleChange('SECURITY_GUARD')}
                  className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all ${
                    activeRole === 'SECURITY_GUARD'
                      ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title="Garita / Vigilancia - Marcaciones Reales"
                >
                  Garita
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-600 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
