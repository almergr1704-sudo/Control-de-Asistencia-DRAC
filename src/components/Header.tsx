import React from 'react';
import {
  Menu,
  RotateCcw,
  UserCheck,
  Building,
  Shield,
  User,
  ShieldCheck,
} from 'lucide-react';
import { RoleType } from '../types';

interface HeaderProps {
  activeRole: RoleType;
  setActiveRole: (role: RoleType) => void;
  activeUserDni: string;
  setActiveUserDni: (dni: string) => void;
  onResetData: () => void;
  onToggleSidebarMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRole,
  setActiveRole,
  setActiveUserDni,
  onResetData,
  onToggleSidebarMobile,
}) => {
  const handleRoleChange = (role: RoleType) => {
    setActiveRole(role);
    if (role === 'EMPLOYEE') setActiveUserDni('71234567');
    if (role === 'SUPERVISOR') setActiveUserDni('45891234');
    if (role === 'HR_ADMIN') setActiveUserDni('40123987');
    if (role === 'SECURITY_GUARD') setActiveUserDni('41987654');
  };

  const roleLabels: Record<RoleType, { label: string; icon: React.ElementType; color: string }> = {
    HR_ADMIN: { label: 'Admin RRHH', icon: Shield, color: 'bg-indigo-600' },
    SUPERVISOR: { label: 'Jefe / Director', icon: Building, color: 'bg-amber-600' },
    EMPLOYEE: { label: 'Trabajador', icon: User, color: 'bg-slate-700' },
    SECURITY_GUARD: { label: 'Vigilancia / Garita', icon: ShieldCheck, color: 'bg-emerald-600' },
  };

  return (
    <header className="bg-[#090A0D] border-b border-slate-800 text-slate-300 sticky top-0 z-30 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Hamburger + Institution Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebarMobile}
            className="md:hidden p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Abrir Menú Principal"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="font-bold text-white text-sm tracking-tight hidden sm:block uppercase">
              DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA — DRAC
            </h1>
            <p className="text-[11px] text-slate-400">
              Sistema Institucional de Control de Asistencia y Gestión de Personal
            </p>
          </div>
        </div>

        {/* Right Side: Role Selector & Reset Button */}
        <div className="flex items-center gap-3">
          {/* System Reset Button */}
          <button
            onClick={onResetData}
            className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Eliminar datos y dejar el sistema completamente limpio"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar Sistema</span>
          </button>

          {/* Active Role Selector */}
          <div className="flex items-center gap-2 bg-[#0F1115] p-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1 px-1.5 text-[11px] font-semibold text-slate-400">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Perfil Activo:</span>
            </div>

            <div className="flex items-center gap-1">
              {(['HR_ADMIN', 'SUPERVISOR', 'EMPLOYEE', 'SECURITY_GUARD'] as RoleType[]).map((r) => {
                const conf = roleLabels[r];
                const isActive = activeRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all ${
                      isActive
                        ? `${conf.color} text-white font-semibold shadow-sm`
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
