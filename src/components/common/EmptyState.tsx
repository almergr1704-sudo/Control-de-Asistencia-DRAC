import React from 'react';
import { AlertCircle, RotateCcw, Search } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  isFiltered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Search,
  title,
  description,
  actionText,
  onAction,
  isFiltered = false,
}) => {
  return (
    <div className="p-8 sm:p-12 text-center bg-[#090A0D]/50 border-t border-slate-800/80">
      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
      {onAction && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onAction}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {isFiltered && <RotateCcw className="w-3.5 h-3.5" />}
            <span>{actionText || (isFiltered ? 'Limpiar filtros' : 'Reintentar')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const TableLoadingSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-2 border-b border-slate-800/50">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="h-4 bg-slate-800/60 rounded"
              style={{ width: `${Math.max(40, 100 / columns)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
