import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, Home } from 'lucide-react';
import { RoleType } from '../../types';

interface UnauthorizedViewProps {
  attemptedView: string;
  activeRole: RoleType;
  onNavigateHome: () => void;
}

export const UnauthorizedView: React.FC<UnauthorizedViewProps> = ({
  attemptedView,
  activeRole,
  onNavigateHome,
}) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full text-center bg-[#0D1017] border border-rose-500/20 rounded-2xl p-8 shadow-2xl space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-1">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Acceso No Autorizado
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Su perfil actual (<span className="font-semibold text-rose-300">{activeRole}</span>) no cuenta con los permisos requeridos para acceder a la ruta o módulo solicitado.
          </p>
        </div>

        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-left text-xs font-mono text-slate-400 space-y-1">
          <div>
            <span className="text-slate-400">Ruta solicitada:</span> <span className="text-slate-200">{attemptedView}</span>
          </div>
          <div>
            <span className="text-slate-400">Validación de seguridad:</span> <span className="text-rose-400 font-semibold">RECHAZADA (403 Forbidden)</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Regresar a mi panel principal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
