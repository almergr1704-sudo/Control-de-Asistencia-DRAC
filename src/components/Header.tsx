import React, { useState } from 'react';
import {
  Menu,
  RotateCcw,
  UserCheck,
  Building,
  Shield,
  User,
  ShieldCheck,
  LogOut,
  ChevronDown,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { Employee, RoleType } from '../types';
import { getEmployeeAssignedRoles } from '../utils/userAuthUtils';

interface HeaderProps {
  activeRole: RoleType;
  setActiveRole: (role: RoleType) => void;
  currentUser?: Employee | null;
  onOpenProfile: () => void;
  onLogout: () => void;
  onResetData: () => void;
  onToggleSidebarMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRole,
  setActiveRole,
  currentUser,
  onOpenProfile,
  onLogout,
  onResetData,
  onToggleSidebarMobile,
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const roleLabels: Record<string, { label: string; icon: React.ElementType; color: string; badge: string }> = {
    ADMIN_GENERAL: { label: 'Admin General', icon: Shield, color: 'bg-indigo-600', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    TRABAJADOR: { label: 'Trabajador', icon: User, color: 'bg-slate-700', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
    JEFE: { label: 'Jefe / Director', icon: Building, color: 'bg-amber-600', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    JEFE_RRHH: { label: 'Jefe RRHH', icon: ShieldCheck, color: 'bg-blue-600', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    VIGILANCIA: { label: 'Vigilancia / Garita', icon: ShieldCheck, color: 'bg-emerald-600', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    DIRECTOR_GENERAL: { label: 'Director Regional', icon: Building, color: 'bg-purple-600', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    CONTROL_ASISTENCIA: { label: 'Control Asistencia', icon: UserCheck, color: 'bg-cyan-600', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    HR_ADMIN: { label: 'Admin RRHH', icon: Shield, color: 'bg-indigo-600', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    SUPERVISOR: { label: 'Jefe / Director', icon: Building, color: 'bg-amber-600', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    EMPLOYEE: { label: 'Trabajador', icon: User, color: 'bg-slate-700', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
    SECURITY_GUARD: { label: 'Vigilancia', icon: ShieldCheck, color: 'bg-emerald-600', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  };

  const userRoles = currentUser ? getEmployeeAssignedRoles(currentUser) : [activeRole];
  const activeConf = roleLabels[activeRole] || roleLabels.TRABAJADOR;

  return (
    <header className="bg-[#090A0D] border-b border-slate-800 text-slate-300 sticky top-0 z-30 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Hamburger + Institution Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebarMobile}
            className="md:hidden p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Abrir Menú Principal"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="font-bold text-white text-xs sm:text-sm tracking-tight uppercase flex items-center gap-2">
              <span>DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA</span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Sistema Institucional de Control de Asistencia y Gestión de Personal
            </p>
          </div>
        </div>

        {/* Right Side: Logged In User Info & Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active User Pill & Role Switcher */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* Profile Card Trigger */}
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition-all text-left cursor-pointer group"
                title="Ver mi ficha del servidor y cambiar contraseña"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {currentUser.first_name?.[0]}
                  {currentUser.last_name?.[0]}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors leading-tight">
                    {currentUser.first_name} {currentUser.last_name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <span>@{currentUser.username || currentUser.dni}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-emerald-400 font-semibold">{activeConf.label}</span>
                  </div>
                </div>
              </button>

              {/* Role Switcher if user has multiple assigned roles */}
              {userRoles.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Alternar perfil de trabajo"
                  >
                    <span className="hidden md:inline text-slate-400">Rol:</span>
                    <span className="font-semibold text-emerald-400">{activeConf.label}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showRoleDropdown && (
                    <div
                      className="absolute right-0 mt-1 w-52 bg-[#0D1017] border border-slate-700 rounded-xl shadow-xl z-50 p-1 space-y-1 animate-in fade-in duration-150"
                      onClick={() => setShowRoleDropdown(false)}
                    >
                      <div className="px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        Mis Perfiles Asignados
                      </div>
                      {userRoles.map((r) => {
                        const conf = roleLabels[r] || roleLabels.TRABAJADOR;
                        const isSelected = activeRole === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setActiveRole(r)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span>{conf.label}</span>
                            {isSelected && <span className="text-[10px] text-emerald-400">✓ Activo</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Sesión no iniciada</span>
            </div>
          )}

          {/* Logout Button */}
          {currentUser && (
            <button
              type="button"
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Cerrar sesión institucional"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline text-xs font-medium">Cerrar Sesión</span>
            </button>
          )}

          {/* Admin Reset Data Button (Available for Admin General) */}
          {(activeRole === 'ADMIN_GENERAL' || activeRole === 'HR_ADMIN') && (
            <button
              type="button"
              onClick={onResetData}
              className="p-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Limpiar base de datos local"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
