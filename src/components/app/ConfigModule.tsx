import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Clock,
  Building,
  CheckCircle2,
  Lock,
  KeyRound,
  ShieldAlert,
  Info,
  Sliders,
  Check,
  Database,
} from 'lucide-react';
import { PasswordPolicy, SecurityConfig } from '../../types';
import { DEFAULT_SECURITY_CONFIG } from '../../utils/userAuthUtils';
import { SupabaseSyncSection } from './SupabaseSyncSection';

interface ConfigModuleProps {
  securityConfig?: SecurityConfig;
  onSaveSecurityConfig?: (config: SecurityConfig) => void;
}

export const ConfigModule: React.FC<ConfigModuleProps> = ({
  securityConfig = DEFAULT_SECURITY_CONFIG,
  onSaveSecurityConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'INSTITUTIONAL' | 'SECURITY' | 'SUPABASE_DATABASE'>('SUPABASE_DATABASE');


  // Institutional states
  const [institutionName, setInstitutionName] = useState('Dirección Regional de Agricultura Cajamarca (DRAC)');
  const [institutionRuc, setInstitutionRuc] = useState('20453743281');
  const [defaultTolerance, setDefaultTolerance] = useState(10);
  const [requireGaritaReturn, setRequireGaritaReturn] = useState(true);

  // Security & Password Policy states
  const [minLength, setMinLength] = useState<number>(securityConfig.password_policy?.min_length || 8);
  const [requireUppercase, setRequireUppercase] = useState<boolean>(
    securityConfig.password_policy?.require_uppercase ?? true
  );
  const [requireLowercase, setRequireLowercase] = useState<boolean>(
    securityConfig.password_policy?.require_lowercase ?? true
  );
  const [requireNumber, setRequireNumber] = useState<boolean>(
    securityConfig.password_policy?.require_number ?? true
  );
  const [requireSpecialChar, setRequireSpecialChar] = useState<boolean>(
    securityConfig.password_policy?.require_special_char ?? true
  );
  const [preventPrevious, setPreventPrevious] = useState<boolean>(
    securityConfig.password_policy?.prevent_previous_password ?? true
  );
  const [forceChangeFirstLogin, setForceChangeFirstLogin] = useState<boolean>(
    securityConfig.password_policy?.force_change_first_login ?? true
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveInstitutional = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedPolicy: PasswordPolicy = {
      min_length: minLength,
      require_uppercase: requireUppercase,
      require_lowercase: requireLowercase,
      require_number: requireNumber,
      require_special_char: requireSpecialChar,
      prevent_previous_password: preventPrevious,
      force_change_first_login: forceChangeFirstLogin,
    };

    const newConfig: SecurityConfig = {
      ...securityConfig,
      password_policy: updatedPolicy,
    };

    if (onSaveSecurityConfig) {
      onSaveSecurityConfig(newConfig);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Navigation tabs */}
      <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1.5 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('SUPABASE_DATABASE')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeTab === 'SUPABASE_DATABASE'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>Base de Datos Central Supabase (Web + Desktop)</span>
        </button>
        <button
          onClick={() => setActiveTab('SECURITY')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeTab === 'SECURITY'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
          <span>Políticas de Seguridad & Contraseñas</span>
        </button>
        <button
          onClick={() => setActiveTab('INSTITUTIONAL')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
            activeTab === 'INSTITUTIONAL'
              ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-600'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-indigo-400" />
          <span>Parámetros Institucionales DRAC</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold">Guardado exitoso:</span> La configuración del sistema ha sido actualizada y aplicada inmediatamente.
          </div>
        </div>
      )}

      {/* TAB 0: SUPABASE UNIFIED POSTGRESQL DATABASE */}
      {activeTab === 'SUPABASE_DATABASE' && <SupabaseSyncSection />}


      {/* TAB 1: SECURITY & PASSWORD POLICIES */}
      {activeTab === 'SECURITY' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 uppercase">
                Seguridad de Cuentas
              </span>
            </div>
            <h2 className="font-bold text-base text-white flex items-center gap-2 mt-1">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span>Políticas de Contraseñas y Primer Ingreso</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Establezca las directivas de seguridad criptográfica aplicadas al personal de la Dirección Regional de Agricultura Cajamarca.
            </p>
          </div>

          {/* Explanation Callout: Registration vs First-Login */}
          <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Regla Institucional de Contraseña Inicial y Primer Acceso</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>1. Registro de Trabajadores:</strong> La contraseña asignada por Recursos Humanos o el Administrador durante el alta del trabajador es una <em>credencial inicial temporal</em> (puede ser definida libremente sin aplicar estas restricciones).
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>2. Primer Ingreso Obligatorio:</strong> Al acceder al sistema por primera vez, el sistema bloqueará el acceso hasta que el trabajador establezca su nueva contraseña personal, momento en el cual <strong>se aplicarán y exigirán estrictamente las reglas configuradas a continuación</strong>.
            </p>
            <p className="text-amber-300 text-[11px] leading-relaxed">
              <strong>3. Almacenamiento Seguro:</strong> Ninguna contraseña se guarda en texto plano. Se procesan mediante funciones criptográficas unidireccionales (SHA-256 + Salt dinámico).
            </p>
          </div>

          <form onSubmit={handleSaveSecurity} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Min Length */}
              <div className="bg-slate-900/40 p-4 border border-slate-800/80 rounded-xl space-y-2">
                <label className="block text-slate-200 font-bold">
                  Longitud Mínima de Contraseña
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={6}
                    max={32}
                    value={minLength}
                    onChange={(e) => setMinLength(Math.max(6, Number(e.target.value)))}
                    className="w-24 px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none font-mono font-bold text-sm"
                  />
                  <span className="text-[11px] text-slate-400">
                    caracteres (Recomendado: 8 o superior)
                  </span>
                </div>
              </div>

              {/* Force change first login */}
              <div className="bg-slate-900/40 p-4 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="block text-slate-200 font-bold">
                      Exigir Cambio en Primer Ingreso
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Obliga al trabajador a cambiar su contraseña temporal antes de acceder.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={forceChangeFirstLogin}
                    onChange={(e) => setForceChangeFirstLogin(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090A0D] text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Checklist of rules */}
            <div className="bg-slate-900/40 p-4 border border-slate-800/80 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Requisitos de Complejidad Obligatorios</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Require Uppercase */}
                <label className="flex items-center gap-3 p-2.5 bg-[#060709] border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={requireUppercase}
                    onChange={(e) => setRequireUppercase(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090A0D] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-white block text-xs">Letra Mayúscula (A-Z)</span>
                    <span className="text-[10px] text-slate-400">Exige al menos una letra en mayúscula</span>
                  </div>
                </label>

                {/* Require Lowercase */}
                <label className="flex items-center gap-3 p-2.5 bg-[#060709] border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={requireLowercase}
                    onChange={(e) => setRequireLowercase(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090A0D] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-white block text-xs">Letra Minúscula (a-z)</span>
                    <span className="text-[10px] text-slate-400">Exige al menos una letra en minúscula</span>
                  </div>
                </label>

                {/* Require Number */}
                <label className="flex items-center gap-3 p-2.5 bg-[#060709] border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={requireNumber}
                    onChange={(e) => setRequireNumber(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090A0D] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-white block text-xs">Dígito Numérico (0-9)</span>
                    <span className="text-[10px] text-slate-400">Exige al menos un carácter numérico</span>
                  </div>
                </label>

                {/* Require Special */}
                <label className="flex items-center gap-3 p-2.5 bg-[#060709] border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={requireSpecialChar}
                    onChange={(e) => setRequireSpecialChar(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090A0D] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-white block text-xs">Carácter Especial (!@#$...)</span>
                    <span className="text-[10px] text-slate-400">Exige símbolos de puntuación o seguridad</span>
                  </div>
                </label>

                {/* Prevent Previous */}
                <label className="flex items-center gap-3 p-2.5 bg-[#060709] border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={preventPrevious}
                    onChange={(e) => setPreventPrevious(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090A0D] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-white block text-xs">Impedir Reutilizar Contraseña Temporal</span>
                    <span className="text-[10px] text-slate-400">La nueva contraseña no puede ser idéntica a la credencial inicial asignada</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Shield className="w-4 h-4" />
                <span>Guardar Políticas de Seguridad</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: INSTITUTIONAL PARAMETERS */}
      {activeTab === 'INSTITUTIONAL' && (
        <div className="bg-[#090A0D] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="font-bold text-base text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-400" />
              <span>Parámetros Institucionales DRAC</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configuración de la entidad, tolerancias horarias y control de garita.
            </p>
          </div>

          <form onSubmit={handleSaveInstitutional} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nombre de la Entidad</label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">RUC Institucional</label>
              <input
                type="text"
                value={institutionRuc}
                onChange={(e) => setInstitutionRuc(e.target.value)}
                className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tolerancia por Defecto (Minutos)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={defaultTolerance}
                  onChange={(e) => setDefaultTolerance(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Aplicado a turnos sin tolerancia específica</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Control de Garita Obligatorio</label>
                <select
                  value={requireGaritaReturn ? 'SI' : 'NO'}
                  onChange={(e) => setRequireGaritaReturn(e.target.value === 'SI')}
                  className="w-full px-3 py-2 bg-[#060709] text-white border border-slate-800 rounded-lg focus:border-indigo-600 focus:outline-none"
                >
                  <option value="SI">Sí, requiere marcar salida y retorno real</option>
                  <option value="NO">No, opcional</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors"
              >
                Guardar Parámetros
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
