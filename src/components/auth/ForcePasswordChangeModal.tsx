import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  Building,
  ArrowRight,
  LogOut,
  Info,
} from 'lucide-react';
import { Employee, PasswordPolicy } from '../../types';
import {
  validatePasswordWithPolicy,
  hashPassword,
  verifyPassword,
  PasswordValidationResult,
  DEFAULT_PASSWORD_POLICY,
} from '../../utils/userAuthUtils';

interface ForcePasswordChangeModalProps {
  employee: Employee;
  policy?: PasswordPolicy;
  onPasswordChanged: (updatedEmployee: Employee) => void;
  onCancelLogout?: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  employee,
  policy = DEFAULT_PASSWORD_POLICY,
  onPasswordChanged,
  onCancelLogout,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [validationResult, setValidationResult] = useState<PasswordValidationResult>({
    valid: false,
    errors: [],
    rules: {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecial: false,
      notPrevious: true,
    },
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate new password on keystroke against system security policies
  useEffect(() => {
    let isMounted = true;
    validatePasswordWithPolicy(
      newPassword,
      policy,
      employee.password_hash,
      employee.password_salt
    ).then((res) => {
      if (isMounted) {
        setValidationResult(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [newPassword, policy, employee.password_hash, employee.password_salt]);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (employee.password_hash) {
      if (!currentPassword) {
        setErrorMessage('Debe ingresar su contraseña inicial temporal para validar su identidad.');
        return;
      }
      const isCurrentValid = await verifyPassword(
        currentPassword,
        employee.password_hash,
        employee.password_salt
      );
      if (!isCurrentValid) {
        setErrorMessage('La contraseña inicial/temporal ingresada no es correcta.');
        return;
      }
    } else {
      if (!currentPassword) {
        setErrorMessage('Debe ingresar su contraseña inicial temporal para validar su identidad.');
        return;
      }
      const isCurrentValid =
        currentPassword === 'Drac2026' ||
        currentPassword === 'Drac2026!' ||
        currentPassword === employee.dni ||
        currentPassword === '123456';
      if (!isCurrentValid) {
        setErrorMessage('La contraseña inicial/temporal ingresada no es correcta.');
        return;
      }
    }

    // Re-validate against security policies
    const res = await validatePasswordWithPolicy(
      newPassword,
      policy,
      employee.password_hash,
      employee.password_salt
    );

    if (!res.valid) {
      setErrorMessage(res.errors[0] || 'La nueva contraseña no cumple con todas las políticas de seguridad.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    setIsProcessing(true);

    try {
      // Generate new cryptographic hash with fresh salt (NEVER plaintext)
      const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);

      const updatedEmp: Employee = {
        ...employee,
        password_hash: newHash,
        password_salt: newSalt,
        password_change_required: false,
        primer_ingreso: 'COMPLETADO',
        last_password_change: new Date().toISOString(),
      };

      setSuccessMessage('Contraseña actualizada correctamente.');

      setTimeout(() => {
        setIsProcessing(false);
        onPasswordChanged(updatedEmp);
      }, 1000);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage('Ocurrió un error al procesar el cambio seguro de contraseña.');
    }
  };

  const minLength = policy.min_length || 8;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 uppercase tracking-wider">
                  Primer Ingreso Obligatorio
                </span>
                <span className="text-[11px] text-slate-400 font-mono">DRAC-SEG-01</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">Cambio Obligatorio de Contraseña</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Por política de seguridad institucional, debe establecer una nueva contraseña personal antes de acceder al sistema.
              </p>
            </div>
          </div>
        </div>

        {/* User identification badge */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-white">
              {employee.first_name} {employee.last_name}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-mono">@{employee.username || employee.dni}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-indigo-300">
            <Building className="w-3 h-3 text-indigo-400" />
            <span>{employee.dependencia_name}</span>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error de Validación:</span> {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold">{successMessage}</span> Redirigiendo al sistema...
              </div>
            </div>
          )}

          {/* Current Temporary Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Contraseña Inicial / Temporal Asignada <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                placeholder="Ingrese su contraseña temporal de inicio"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[#090A0D] border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              La credencial temporal asignada para el primer acceso al sistema.
            </span>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nueva Contraseña Personal <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                placeholder="Defina su nueva contraseña segura"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#090A0D] border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Confirmar Nueva Contraseña <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repita exactamente la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-[#090A0D] border rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none ${
                  confirmPassword && !passwordsMatch
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-800 focus:border-indigo-500'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <span className="text-[10px] text-rose-400 mt-1 block">
                Las contraseñas no coinciden.
              </span>
            )}
          </div>

          {/* Real-time Security Policies Checklist */}
          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-200">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Políticas de Seguridad Institucionales Exigidas:</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Configuración DRAC</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="flex items-center gap-2">
                {validationResult.rules.minLength ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                )}
                <span className={validationResult.rules.minLength ? 'text-emerald-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                  Mínimo {minLength} caracteres ({newPassword.length}/{minLength})
                </span>
              </div>

              {policy.require_uppercase && (
                <div className="flex items-center gap-2">
                  {validationResult.rules.hasUppercase ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span className={validationResult.rules.hasUppercase ? 'text-emerald-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                    Al menos una mayúscula (A-Z)
                  </span>
                </div>
              )}

              {policy.require_lowercase && (
                <div className="flex items-center gap-2">
                  {validationResult.rules.hasLowercase ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span className={validationResult.rules.hasLowercase ? 'text-emerald-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                    Al menos una minúscula (a-z)
                  </span>
                </div>
              )}

              {policy.require_number && (
                <div className="flex items-center gap-2">
                  {validationResult.rules.hasNumber ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span className={validationResult.rules.hasNumber ? 'text-emerald-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                    Al menos un número (0-9)
                  </span>
                </div>
              )}

              {policy.require_special_char && (
                <div className="flex items-center gap-2">
                  {validationResult.rules.hasSpecial ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span className={validationResult.rules.hasSpecial ? 'text-emerald-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                    Carácter especial (!@#$%...)
                  </span>
                </div>
              )}

              {policy.prevent_previous_password && (
                <div className="flex items-center gap-2">
                  {validationResult.rules.notPrevious ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className={validationResult.rules.notPrevious ? 'text-emerald-300 text-[11px]' : 'text-rose-400 text-[11px]'}>
                    Diferente a contraseña temporal
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 sm:col-span-2">
                {passwordsMatch ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                )}
                <span className={passwordsMatch ? 'text-emerald-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                  Confirmación idéntica
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            {onCancelLogout ? (
              <button
                type="button"
                onClick={onCancelLogout}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={!validationResult.valid || !passwordsMatch || isProcessing}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>Actualizar Contraseña e Ingresar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
