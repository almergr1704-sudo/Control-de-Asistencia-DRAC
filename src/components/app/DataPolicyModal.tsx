import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, X } from 'lucide-react';

export interface DataPolicyConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  actionType: 'CREATE' | 'ACTIVATE' | 'DEACTIVATE' | 'APPROVE' | 'REJECT' | 'ANNUL' | 'CORRECT';
  entityName?: string;
  requireReason?: boolean;
  confirmText?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export const DataPolicyConfirmModal: React.FC<DataPolicyConfirmConfig> = ({
  isOpen,
  title,
  message,
  actionType,
  entityName,
  requireReason = false,
  confirmText,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isDestructive = actionType === 'DEACTIVATE' || actionType === 'REJECT' || actionType === 'ANNUL';
  
  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('Debe ingresar un motivo o justificación institucional obligatoria para esta acción.');
      return;
    }
    setError('');
    onConfirm(reason);
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0F1115] rounded-xl shadow-2xl border border-slate-800 max-w-lg w-full overflow-hidden text-slate-200">
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isDestructive
              ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {isDestructive ? (
              <div className="p-2 bg-rose-900/50 text-rose-300 rounded-lg border border-rose-800/80">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-emerald-900/50 text-emerald-300 rounded-lg border border-emerald-800/80">
                <CheckCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">{title}</h3>
              {entityName && <p className="text-xs text-slate-400 mt-0.5">{entityName}</p>}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed font-sans text-xs">{message}</p>

          {/* Principle Reminder Banner */}
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg flex items-start gap-2.5 text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <strong className="font-semibold block text-amber-200 mb-0.5">Regla de Integridad DRAC:</strong>
              Un dato puede editarse mientras no comprometa información histórica. Activar o desactivar no significa eliminar.
            </div>
          </div>

          {requireReason && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-slate-300">
                Motivo / Justificación Institucional <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Escriba el motivo detallado para el registro de auditoría..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-[#090A0D] text-white border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-600"
              />
              {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-3.5 bg-[#090A0D] border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 focus:ring-2 focus:ring-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-500'
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            {confirmText || (isDestructive ? 'Desactivar' : 'Activar')}
          </button>
        </div>
      </div>
    </div>
  );
};

