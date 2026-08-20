import React, { useState } from 'react';
import { Employee, RoleType } from '../../types';
import { authenticateUser, getEmployeeAssignedRoles } from '../../utils/userAuthUtils';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, Building2, KeyRound, CheckCircle2, ChevronRight, UserCheck, Sparkles, ShieldAlert } from 'lucide-react';

interface LoginPageProps {
  employees: Employee[];
  onLoginSuccess: (employee: Employee, selectedRole: RoleType, requiresPasswordChange: boolean) => void;
  onRecordAudit: (action: string, details: string, empDni?: string, empName?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  employees,
  onLoginSuccess,
  onRecordAudit,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMessage('Por favor ingrese su usuario o DNI y su contraseña institucional.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Client-side & database authentication check
      const result = await authenticateUser(cleanId, password, employees);

      if (!result.success || !result.employee) {
        setErrorMessage(result.message || 'Credenciales incorrectas.');
        onRecordAudit('LOGIN_FALLIDO', `Intento fallido de inicio de sesión con identificador: "${cleanId}" - Razón: ${result.message}`, cleanId);
        setIsLoading(false);
        return;
      }

      const emp = result.employee;

      // 2. Extra verification for inactive employee
      if (emp.active === false || emp.account_status === 'INACTIVE') {
        const inactiveMsg = 'Su usuario se encuentra inactivo. Comuníquese con el administrador del sistema.';
        setErrorMessage(inactiveMsg);
        onRecordAudit('LOGIN_RECHAZADO_INACTIVO', `Intento de acceso de trabajador inactivo: ${emp.first_name} ${emp.last_name} (DNI ${emp.dni})`, emp.dni, `${emp.first_name} ${emp.last_name}`);
        setIsLoading(false);
        return;
      }

      // 3. Resolve initial active role
      const assignedRoles = getEmployeeAssignedRoles(emp);
      const initialRole: RoleType = emp.role || (assignedRoles.length > 0 ? assignedRoles[0] : 'TRABAJADOR');

      // 4. Record successful login
      onRecordAudit(
        'LOGIN_EXITOSO',
        `Inicio de sesión exitoso de ${emp.first_name} ${emp.last_name} (@${emp.username || emp.dni}) con rol [${initialRole}]`,
        emp.dni,
        `${emp.first_name} ${emp.last_name}`
      );

      // 5. Trigger success callback to set session
      onLoginSuccess(emp, initialRole, Boolean(result.requiresPasswordChange));
    } catch (err: any) {
      setErrorMessage('Ocurrió un error al procesar el inicio de sesión. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemoUser = (username: string, defaultPass = 'Drac2026!') => {
    setIdentifier(username);
    setPassword(defaultPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#07080A] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Subtle institutional ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Institutional Top Ribbon */}
      <header className="relative z-10 border-b border-slate-800/80 bg-[#0B0D13]/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center">
              <div className="w-full h-full bg-[#07080A] rounded-[10px] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                Gobierno Regional Cajamarca
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                Dirección Regional de Agricultura (DRAC)
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono">Control de Asistencia v2.4</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Card Frame */}
          <div className="bg-[#0D1017] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
            {/* Header / Instructions */}
            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                Acceso al Sistema
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Ingrese con su usuario institucional único generado automáticamente o con su número de DNI.
              </p>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="leading-snug">
                  <span className="font-semibold block mb-0.5">Atención:</span>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Usuario o DNI */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Usuario o DNI <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ej: jperez o 10000007"
                    required
                    autoFocus
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Regla de usuario: inicial de nombre + apellido paterno (ej: <code className="text-slate-300">jperez</code>)
                </p>
              </div>

              {/* Contraseña */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Contraseña <span className="text-emerald-400">*</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed group active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Validando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar sesión</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access Switcher */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="w-full text-xs text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 transition-colors py-1 cursor-pointer font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>{showDemoAccounts ? 'Ocultar accesos rápidos de prueba' : 'Ver credenciales y usuarios de prueba DRAC'}</span>
              </button>

              {showDemoAccounts && (
                <div className="mt-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs animate-in fade-in duration-200">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Cuentas por Rol Institucional:</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Clave: Drac2026!</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('cmendoza')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">Carlos Mendoza</div>
                      <div className="text-[11px] text-slate-400 font-mono">@cmendoza · Admin General</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('msilva')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">María Silva</div>
                      <div className="text-[11px] text-slate-400 font-mono">@msilva · Jefe RRHH</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('fcastillo')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">Fernando Castillo</div>
                      <div className="text-[11px] text-slate-400 font-mono">@fcastillo · Jefe Administr.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('jperez')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">Juan Pérez García</div>
                      <div className="text-[11px] text-slate-400 font-mono">@jperez · Trabajador</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('atorres')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-amber-300 group-hover:text-amber-200">Ana Lucía Torres</div>
                      <div className="text-[11px] text-slate-400 font-mono">@atorres · Primer Ingreso</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('mquispe')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">Manuel Quispe</div>
                      <div className="text-[11px] text-slate-400 font-mono">@mquispe · Vigilancia</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('jmorales')}
                      className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-emerald-400">Jorge Morales</div>
                      <div className="text-[11px] text-slate-400 font-mono">@jmorales · Asistencia</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser('pgomez')}
                      className="text-left p-2 rounded-lg bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/40 hover:border-rose-600/60 transition-all group"
                    >
                      <div className="font-semibold text-rose-300 group-hover:text-rose-200">Pedro Gómez</div>
                      <div className="text-[11px] text-rose-400/80 font-mono">@pgomez · [Inactivo]</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Sistema seguro con autenticación criptográfica SHA-256</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#0B0D13]/60 py-3 px-4 text-center text-xs text-slate-400">
        <p>© 2026 Dirección Regional de Agricultura Cajamarca. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};
