import React, { useState } from 'react';
import { Employee, RoleType } from '../../types';
import {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  getEmployeeAssignedRoles,
} from '../../utils/userAuthUtils';
import {
  X,
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Briefcase,
  Fingerprint,
  Calendar,
  Lock,
  Mail,
  Phone,
  MapPin,
  Check,
} from 'lucide-react';

interface UserProfileModalProps {
  employee: Employee;
  activeRole: RoleType;
  onClose: () => void;
  onUpdateEmployee: (updated: Employee) => void;
  onRecordAudit: (action: string, details: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  employee,
  activeRole,
  onClose,
  onUpdateEmployee,
  onRecordAudit,
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'PASSWORD'>('DETAILS');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const policy = validatePasswordPolicy(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isPolicyMet = policy.valid;

  const assignedRoles = getEmployeeAssignedRoles(employee);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setFormError('Debe ingresar su contraseña actual.');
      return;
    }

    if (!isPolicyMet) {
      setFormError('La nueva contraseña no cumple con las políticas de seguridad requeridas.');
      return;
    }

    if (!passwordsMatch) {
      setFormError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    if (currentPassword === newPassword) {
      setFormError('La nueva contraseña no puede ser idéntica a la contraseña actual.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Verify current password
      let isCurrentValid = false;
      if (employee.password_hash) {
        isCurrentValid = await verifyPassword(
          currentPassword,
          employee.password_hash,
          employee.password_salt
        );
      } else {
        isCurrentValid =
          currentPassword === employee.dni ||
          currentPassword === '123456' ||
          currentPassword === 'Drac2026!';
      }

      if (!isCurrentValid) {
        setFormError('La contraseña actual ingresada es incorrecta.');
        setIsSubmitting(false);
        return;
      }

      // 2. Hash new password
      const { hash, salt } = await hashPassword(newPassword);

      // 3. Update employee record
      const updated: Employee = {
        ...employee,
        password_hash: hash,
        password_salt: salt,
        password_change_required: false,
        primer_ingreso: 'COMPLETADO',
        last_password_change: new Date().toISOString(),
      };

      onUpdateEmployee(updated);
      onRecordAudit(
        'CAMBIO_CONTRASENA_PROPIA',
        `El usuario @${employee.username || employee.dni} actualizó su contraseña personal de forma segura.`
      );

      setSuccessMessage('¡Su contraseña ha sido actualizada correctamente!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setFormError('Ocurrió un error al actualizar la contraseña. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0D1017] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-black relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#11141E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">
              {employee.first_name?.[0]}
              {employee.last_name?.[0]}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>
                  {employee.first_name} {employee.last_name}
                </span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  @{employee.username || employee.dni}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {employee.position} · {employee.dependencia_name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-[#0B0D13] px-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('DETAILS');
              setFormError(null);
              setSuccessMessage(null);
            }}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'DETAILS'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Ficha del Servidor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PASSWORD');
              setFormError(null);
              setSuccessMessage(null);
            }}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'PASSWORD'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Cambiar Contraseña</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'DETAILS' ? (
            <div className="space-y-6">
              {/* Top Meta Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Código DRAC
                  </div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {employee.codigo_trabajador || 'DRAC-0000'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    DNI / Documento
                  </div>
                  <div className="text-sm font-bold text-slate-200 font-mono">
                    {employee.dni}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    PIN Biométrico ZKTeco
                  </div>
                  <div className="text-sm font-bold text-amber-400 font-mono">
                    {employee.zkteco_pin || employee.dni}
                  </div>
                </div>
              </div>

              {/* Organic Location */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Ubicación Orgánica y Dependencia</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Dependencia:</span>
                    <span className="font-medium text-slate-200">{employee.dependencia_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Dirección / Órgano:</span>
                    <span className="font-medium text-slate-200">{employee.direccion_organo_name || 'No asignada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Área / Unidad:</span>
                    <span className="font-medium text-slate-200">{employee.area_name || 'No asignada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Cargo Institucional:</span>
                    <span className="font-medium text-slate-200">{employee.position}</span>
                  </div>
                </div>
              </div>

              {/* Roles & Security Profile */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Perfiles y Roles Asignados</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {assignedRoles.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        r === activeRole
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold ring-1 ring-emerald-500/30'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700'
                      }`}
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      {r} {r === activeRole && '(Activo en sesión)'}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Los perfiles asignados determinan las acciones permitidas y la visibilidad de los módulos del sistema.
                </p>
              </div>

              {/* Contact Info */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Datos de Contacto</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Correo Electrónico:</span>
                    <span className="font-mono text-slate-200">{employee.email || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Teléfono / Celular:</span>
                    <span className="font-mono text-slate-200">{employee.phone || 'No registrado'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PASSWORD CHANGE TAB */
            <form onSubmit={handlePasswordChange} className="space-y-5">
              {successMessage && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3 text-emerald-300 text-xs animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Operación completada</span>
                    {successMessage}
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Error de validación</span>
                    {formError}
                  </div>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Contraseña Actual <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Ingrese su contraseña actual"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nueva Contraseña <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirmar Nueva Contraseña <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>

              {/* Security Checklist */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Requisitos Institucionales de Seguridad:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-2 ${policy.rules.minLength ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${policy.rules.minLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-2 ${policy.rules.hasUppercase ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${policy.rules.hasUppercase ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Al menos 1 mayúscula (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${policy.rules.hasLowercase ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${policy.rules.hasLowercase ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Al menos 1 minúscula (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${policy.rules.hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${policy.rules.hasNumber ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Al menos 1 número (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${policy.rules.hasSpecial ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${policy.rules.hasSpecial ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Al menos 1 carácter especial (@$!%*?&#)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Las contraseñas coinciden</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isPolicyMet || !passwordsMatch}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-950/50"
                >
                  {isSubmitting ? 'Guardando cambios...' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
