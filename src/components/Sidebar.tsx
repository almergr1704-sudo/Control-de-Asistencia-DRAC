import React, { useState, useEffect } from 'react';
import {
  Home,
  Building2,
  Users,
  Clock,
  ClipboardList,
  Cpu,
  Palmtree,
  FileText,
  ShieldCheck,
  BarChart3,
  Lock,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCheck,
} from 'lucide-react';
import { RoleType } from '../types';
import { VIEW_TO_GROUP, isViewAllowedForRole } from '../utils/router';

export interface MenuSubItem {
  id: string;
  label: string;
  allowedRoles?: RoleType[];
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  subItems?: MenuSubItem[];
  allowedRoles?: RoleType[];
}

interface SidebarProps {
  activeView: string;
  setActiveView: (viewId: string) => void;
  activeRole: RoleType;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  activeRole,
  isOpenMobile,
  setIsOpenMobile,
}) => {
  // State for expanded accordion categories
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    inicio: true,
    org: true,
    personnel: true,
    shifts: false,
    attendance: true,
    devices: false,
    vacations: false,
    papeletas: true,
    security: activeRole === 'SECURITY_GUARD',
    reports: false,
    admin: false,
    config: false,
  });

  // Auto-expand group when activeView changes
  useEffect(() => {
    const parentGroup = VIEW_TO_GROUP[activeView];
    if (parentGroup) {
      setExpandedGroups((prev) => ({
        ...prev,
        [parentGroup]: true,
      }));
    }
  }, [activeView]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleSelectView = (viewId: string) => {
    setActiveView(viewId);
    setIsOpenMobile(false);
  };

  // Menu structure matching DRAC institutional requirements
  const menuGroups: MenuGroup[] = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: Home,
      subItems: [{ id: 'dash_overview', label: 'Dashboard Operativo' }],
    },
    {
      id: 'org',
      label: 'Organización',
      icon: Building2,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'JEFE', 'SUPERVISOR', 'DIRECTOR_GENERAL'],
      subItems: [
        { id: 'org_deps', label: 'Dependencias' },
        { id: 'org_dirs', label: 'Direcciones / Órganos' },
        { id: 'org_areas', label: 'Áreas / Oficinas' },
        { id: 'org_cargos', label: 'Cargos' },
        { id: 'org_resps', label: 'Jefes / Aprobadores' },
        { id: 'org_bulk', label: 'Carga Masiva Excel' },
      ],
    },
    {
      id: 'personnel',
      label: 'Personal',
      icon: Users,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'JEFE', 'SUPERVISOR', 'DIRECTOR_GENERAL', 'CONTROL_ASISTENCIA'],
      subItems: [
        { id: 'personnel_list', label: 'Directorio' },
        { id: 'personnel_new', label: 'Registrar Personal' },
        { id: 'personnel_assign', label: 'Asignaciones' },
        { id: 'personnel_history', label: 'Historial' },
        { id: 'personnel_encargaturas', label: 'Encargaturas Temporales' },
        { id: 'personnel_bulk', label: 'Carga Masiva Excel' },
      ],
    },
    {
      id: 'shifts',
      label: 'Horarios',
      icon: Clock,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH'],
      subItems: [
        { id: 'shifts_turnos', label: 'Turnos Laborales' },
        { id: 'shifts_horarios', label: 'Horarios Laborales' },
        { id: 'shifts_assign', label: 'Asignación de Horarios' },
      ],
    },
    {
      id: 'attendance',
      label: 'Asistencia',
      icon: ClipboardList,
      subItems: [
        { id: 'attendance_list', label: 'Control de Asistencia' },
        { id: 'attendance_punches', label: 'Marcaciones Biométricas' },
        { id: 'attendance_incidents', label: 'Incidencias & Ajustes' },
        { id: 'attendance_corrections', label: 'Correcciones / Ajustes' },
      ],
    },
    {
      id: 'devices',
      label: 'Biométricos',
      icon: Cpu,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'CONTROL_ASISTENCIA'],
      subItems: [
        { id: 'devices_list', label: 'Dispositivos ZKTeco' },
        { id: 'devices_sync', label: 'Sincronización PUSH' },
        { id: 'devices_staging', label: 'Marcaciones Recibidas' },
      ],
    },
    {
      id: 'vacations',
      label: 'Vacaciones',
      icon: Palmtree,
      subItems: [
        { id: 'vacations_new', label: 'Solicitar Vacaciones' },
        { id: 'vacations_requests', label: 'Mis Vacaciones' },
        { id: 'vacations_approvals', label: 'Aprobaciones', allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'JEFE', 'SUPERVISOR', 'CONTROL_ASISTENCIA'] },
        { id: 'vacations_history', label: 'Historial' },
      ],
    },
    {
      id: 'papeletas',
      label: 'Papeletas',
      icon: FileText,
      subItems: [
        { id: 'papeletas_new', label: 'Nueva Papeleta' },
        { id: 'papeletas_my', label: 'Mis Papeletas' },
        { id: 'papeletas_pending', label: 'Pendientes de VoBo', allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'JEFE', 'SUPERVISOR', 'DIRECTOR_GENERAL'] },
        { id: 'papeletas_approved', label: 'Aprobadas', allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'JEFE', 'SUPERVISOR', 'DIRECTOR_GENERAL'] },
        { id: 'papeletas_history', label: 'Historial General', allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'CONTROL_ASISTENCIA'] },
      ],
    },
    {
      id: 'security',
      label: 'Vigilancia',
      icon: ShieldCheck,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'VIGILANCIA', 'SECURITY_GUARD', 'JEFE_RRHH'],
      subItems: [
        { id: 'security_papeletas', label: 'Papeletas Autorizadas' },
        { id: 'security_exit', label: 'Registrar Salida Garita' },
        { id: 'security_return', label: 'Registrar Retorno Garita' },
        { id: 'security_outside', label: 'Personal Fuera DRAC' },
      ],
    },
    {
      id: 'reports',
      label: 'Reportes',
      icon: BarChart3,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN', 'JEFE_RRHH', 'JEFE', 'SUPERVISOR', 'DIRECTOR_GENERAL', 'CONTROL_ASISTENCIA'],
      subItems: [
        { id: 'reports_attendance', label: 'Reporte de Asistencia' },
        { id: 'reports_tardiness', label: 'Reporte de Tardanzas' },
        { id: 'reports_absences', label: 'Reporte de Faltas' },
        { id: 'reports_overtime', label: 'Reporte de Horas Extras' },
        { id: 'reports_vacations', label: 'Reporte de Vacaciones' },
        { id: 'reports_papeletas', label: 'Reporte de Papeletas' },
        { id: 'reports_exits', label: 'Salidas y Retornos Garita' },
      ],
    },
    {
      id: 'admin',
      label: 'Administración',
      icon: Lock,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN'],
      subItems: [
        { id: 'admin_users', label: 'Gestión de Usuarios' },
        { id: 'admin_roles', label: 'Roles y Permisos' },
        { id: 'admin_audit', label: 'Auditoría del Sistema' },
      ],
    },
    {
      id: 'config',
      label: 'Configuración',
      icon: Settings,
      allowedRoles: ['ADMIN_GENERAL', 'HR_ADMIN'],
      subItems: [{ id: 'config_system', label: 'Configuración Institucional' }],
    },
  ];

  // Filter groups by user role
  const visibleGroups = menuGroups.filter((g) => {
    if (!g.allowedRoles) return true;
    return g.allowedRoles.includes(activeRole);
  });

  const handleGroupHeaderClick = (group: MenuGroup) => {
    const validSubItems = group.subItems?.filter((sub) => {
      if (sub.allowedRoles && !sub.allowedRoles.includes(activeRole)) return false;
      return isViewAllowedForRole(sub.id, activeRole);
    });

    if (validSubItems && validSubItems.length > 0) {
      const isExpanded = expandedGroups[group.id] ?? false;
      const isAnySubActive = validSubItems.some((sub) => sub.id === activeView);

      if (!isExpanded) {
        setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
        if (!isAnySubActive && validSubItems[0]) {
          handleSelectView(validSubItems[0].id);
        }
      } else {
        if (!isAnySubActive && validSubItems[0]) {
          handleSelectView(validSubItems[0].id);
        } else {
          toggleGroup(group.id);
        }
      }
    } else {
      handleSelectView(group.id);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#090A0D] border-r border-slate-800 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#060709]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30">
              🌾
            </div>
            <div>
              <h1 className="font-extrabold text-white text-xs tracking-wider uppercase">
                DRAC CAJAMARCA
              </h1>
              <p className="text-[10px] text-indigo-400 font-medium">Control de Asistencia</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 custom-scrollbar">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.id] ?? false;

            // Filter subItems by role
            const validSubItems = group.subItems?.filter((sub) => {
              if (sub.allowedRoles && !sub.allowedRoles.includes(activeRole)) return false;
              return isViewAllowedForRole(sub.id, activeRole);
            });

            const hasSubItems = validSubItems && validSubItems.length > 0;
            const isGroupActive = validSubItems?.some((sub) => sub.id === activeView);

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Group Header Button */}
                <button
                  onClick={() => handleGroupHeaderClick(group)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                    isGroupActive
                      ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-500 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GroupIcon className={`w-4 h-4 ${isGroupActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{group.label}</span>
                  </div>
                  {hasSubItems && (
                    <div className="text-slate-500">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </div>
                  )}
                </button>

                {/* SubMenu Items */}
                {hasSubItems && isExpanded && (
                  <div className="pl-7 pr-1 py-1 space-y-0.5 border-l border-slate-800 ml-4 my-1">
                    {validSubItems.map((sub) => {
                      const isSubActive = activeView === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleSelectView(sub.id)}
                          className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded transition-all flex items-center justify-between ${
                            isSubActive
                              ? 'bg-indigo-600/25 text-indigo-300 font-bold border-l-2 border-indigo-400 pl-2'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isSubActive && <span className="text-indigo-400 font-bold">▸</span>}
                            <span>{sub.label}</span>
                          </div>
                          {isSubActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Role Badge */}
        <div className="p-3 border-t border-slate-800/80 bg-[#060709] shrink-0 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              Rol: <strong className="text-white font-medium">{activeRole}</strong>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

