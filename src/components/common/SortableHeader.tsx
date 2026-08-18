import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortOrder = 'asc' | 'desc' | null;

export interface SortableHeaderProps {
  label: string;
  field: string;
  currentSortField: string | null;
  currentSortOrder: SortOrder;
  onSort: (field: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort,
  className = '',
  align = 'left',
}) => {
  const isSorted = currentSortField === field;

  const getAlignmentClass = () => {
    if (align === 'right') return 'justify-end text-right';
    if (align === 'center') return 'justify-center text-center';
    return 'justify-start text-left';
  };

  return (
    <th
      onClick={() => onSort(field)}
      className={`px-3.5 py-3 font-semibold text-xs cursor-pointer select-none transition-colors group hover:text-white ${
        isSorted ? 'text-indigo-400 font-bold' : 'text-slate-400'
      } ${className}`}
    >
      <div className={`flex items-center gap-1.5 ${getAlignmentClass()}`}>
        <span className="truncate">{label}</span>
        <span className="shrink-0 transition-opacity">
          {isSorted ? (
            currentSortOrder === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-300" />
          )}
        </span>
      </div>
    </th>
  );
};
