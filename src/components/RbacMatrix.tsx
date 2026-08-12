import React, { useState } from 'react';
import { RBAC_PERMISSIONS_MATRIX } from '../data/initialData';
import { Shield, Check, X, Lock, Info, Key, Eye, Edit3, UserCheck } from 'lucide-react';
import { RoleType } from '../types';

export const RbacMatrix: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleType>('EMPLOYEE');

  const roleDescriptions: Record<RoleType, { title: string; badge: string; desc: string; focus: string }> = {
    EMPLOYEE: {
      title: 'Perfil Personal / Empleado Standard',
      badge: 'Read-Only + Excepción Escritura Papeletas',
      desc: 'El colaborador puede visualizar exclusivamente su propia información de asistencia, turnos y papeletas. No posee acceso a datos de otros colaboradores.',
      focus: 'REGLA ESTRICTA: Solo Lectura para todas las entidades (Read-Only) salvo 1 Excepción de Escritura: Crear solicitudes de Papeleta de Salida para sí mismo.',
    },
    SUPERVISOR: {
      title: 'Perfil Jefe Inmediato / Supervisor de Área',
      badge: 'Aprobación Nivel 1 (VoBo)',
      desc: 'Responsable de supervisar la asistencia de su equipo directo y otorgar el Visto Bueno (VoBo) a las solicitudes de papeletas de salida.',
      focus: 'Lectura de equipo asignado + Escritura en VoBo de papeletas de subordinados.',
    },
    HR_ADMIN: {
      title: 'Perfil Personal / RRHH Admin',
      badge: 'Control Global & Aprobación Final',
      desc: 'Acceso total a la administración de horarios, turnos, asignación de vacaciones, aprobación final de papeletas y reportes ejecutivos.',
      focus: 'Aprobación final de papeletas + Asignación de Vacaciones Totales/Parciales + ABM de Horarios.',
    },
    SECURITY_GUARD: {
      title: 'Perfil Vigilancia / Control de Garita',
      badge: 'Operación Real Garita Puerta',
      desc: 'Operador de control de acceso físico en puerta/garita. Consulta únicamente papeletas aprobadas del día.',
      focus: 'Vista filtrada por fecha actual + Escritura de Hora Real de Salida y Hora Real de Retorno.',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Matriz de Permisos y Control de Acceso Basado en Roles (RBAC)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Definición de scopes de seguridad OWASP y matriz de acceso por entidad para Empleado, Jefe Inmediato, RRHH y Vigilancia.
            </p>
          </div>
        </div>

        {/* Role Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {(['EMPLOYEE', 'SUPERVISOR', 'HR_ADMIN', 'SECURITY_GUARD'] as RoleType[]).map((role) => {
            const isSelected = selectedRole === role;
            const info = roleDescriptions[role];
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider">{role}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <div className="text-xs font-semibold text-slate-200">{info.title.replace('Perfil ', '')}</div>
                </div>
                <div className="mt-2 text-[10px] text-indigo-300/80 font-mono line-clamp-1">{info.badge}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Role Focus Banner */}
        <div className="mt-4 p-3.5 bg-slate-950 border border-indigo-500/30 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">
                {roleDescriptions[selectedRole].title}
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 font-mono rounded">
                {roleDescriptions[selectedRole].badge}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {roleDescriptions[selectedRole].desc}
            </p>
            <div className="text-xs font-medium text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>{roleDescriptions[selectedRole].focus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RBAC Table Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
              Matriz Detallada de Permisos Granulares por Entidad
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {RBAC_PERMISSIONS_MATRIX.length} Reglas de Acceso Registradas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Acción / Permiso Granular</th>
                <th className="px-4 py-3">Descripción Técnica</th>
                <th className="px-3 py-3 text-center bg-blue-950/40 text-blue-300 border-x border-slate-800">
                  Empleado Standard
                </th>
                <th className="px-3 py-3 text-center">Jefe Inmediato</th>
                <th className="px-3 py-3 text-center">RRHH Admin</th>
                <th className="px-3 py-3 text-center">Vigilancia (Garita)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {RBAC_PERMISSIONS_MATRIX.map((item, idx) => {
                const isEmployeeOnlyException = item.action.includes('Crear Solicitud de Papeleta');
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isEmployeeOnlyException ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-indigo-300 font-mono">
                      {item.module}
                    </td>
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-1.5">
                      {isEmployeeOnlyException ? (
                        <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{item.action}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {item.description}
                    </td>

                    {/* Empleado Column (Highlighted) */}
                    <td className="px-3 py-3 text-center bg-blue-950/20 border-x border-slate-800">
                      {item.employee ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          <Check className="w-3 h-3" />
                          <span>{isEmployeeOnlyException ? 'ESCRITURA' : 'PERMITIDO'}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-medium text-[10px]">
                          <X className="w-3 h-3" />
                          <span>DENEGADO</span>
                        </div>
                      )}
                    </td>

                    {/* Supervisor */}
                    <td className="px-3 py-3 text-center">
                      {item.supervisor ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>

                    {/* HR Admin */}
                    <td className="px-3 py-3 text-center">
                      {item.hr_admin ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>

                    {/* Security Guard */}
                    <td className="px-3 py-3 text-center">
                      {item.security_guard ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
