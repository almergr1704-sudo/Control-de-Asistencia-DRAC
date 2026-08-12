import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, X } from 'lucide-react';

export interface DataPolicyConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  actionType: 'CREATE' | 'DEACTIVATE' | 'APPROVE' | 'REJECT' | 'ANNUL' | 'CORRECT';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isDestructive
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {isDestructive ? (
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-base leading-tight">{title}</h3>
              {entityName && <p className="text-xs opacity-80 mt-0.5">{entityName}</p>}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">{message}</p>

          {/* Principle Reminder Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-950">Política de Integridad y Trazabilidad DRAC:</strong>
              Los datos históricos no se modifican ni se eliminan; se conservan y, cuando corresponda, se crean nuevos registros o se desactivan los registros anteriores.
            </div>
          </div>

          {requireReason && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-slate-700">
                Motivo / Justificación Institucional <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Escriba la justificación detallada para el registro de auditoría..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500'
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            {confirmText || (isDestructive ? 'Confirmar Desactivación / Acción' : 'Confirmar Registro / Aprobación')}
          </button>
        </div>
      </div>
    </div>
  );
};
