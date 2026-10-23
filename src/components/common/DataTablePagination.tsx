import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DataTablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-xs text-slate-400 border-t border-slate-800 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span>
          Mostrando <strong className="text-white">{startItem}</strong> - <strong className="text-white">{endItem}</strong> de <strong className="text-white">{totalItems}</strong> registros
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-3">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-2 py-0.5 outline-none"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
          title="Primera página"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
          title="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-2 font-mono text-[11px] text-slate-300">
          Pág. {currentPage} de {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
          title="Página siguiente"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
          title="Última página"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
