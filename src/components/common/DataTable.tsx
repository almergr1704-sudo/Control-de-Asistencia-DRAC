import React, { useState, useMemo } from 'react';
import { SortableHeader, SortOrder } from './SortableHeader';
import { DataTablePagination } from './DataTablePagination';
import { EmptyState } from './EmptyState';
import { LucideIcon, FileSpreadsheet } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortField?: string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string;
  defaultSortField?: string | null;
  defaultSortOrder?: SortOrder;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  isFiltered?: boolean;
  onResetFilters?: () => void;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T, index: number) => string;
  footerContent?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  defaultSortField = null,
  defaultSortOrder = 'asc',
  initialPageSize = 20,
  pageSizeOptions = [10, 20, 50],
  emptyIcon = FileSpreadsheet,
  emptyTitle = 'No se encontraron registros',
  emptyDescription = 'No hay datos disponibles para mostrar con los filtros aplicados.',
  isFiltered = false,
  onResetFilters,
  isLoading = false,
  onRowClick,
  rowClassName,
  footerContent,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortField, setSortField] = useState<string | null>(defaultSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const sortedData = useMemo(() => {
    if (!sortField || !sortOrder) return data;
    return [...data].sort((a: any, b: any) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  if (isLoading) {
    return (
      <div className="p-8 text-center bg-[#090A0D] border border-slate-800 rounded-xl space-y-3">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="text-xs text-slate-400">Cargando registros institucionales...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        isFiltered={isFiltered}
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#090A0D]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-[#060709] text-slate-400 font-semibold">
              {columns.map((col) => {
                if (col.sortable) {
                  return (
                    <SortableHeader
                      key={col.key}
                      label={col.header}
                      field={col.sortField || col.key}
                      currentField={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      className={col.headerClassName}
                    />
                  );
                }
                return (
                  <th
                    key={col.key}
                    className={`p-3 text-slate-400 font-semibold whitespace-nowrap ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {paginatedData.map((item, index) => {
              const rowKey = keyExtractor(item, index);
              const customClass = rowClassName ? rowClassName(item, index) : '';
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`hover:bg-slate-900/40 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${customClass}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-3 ${col.className || ''}`}>
                      {col.render ? col.render(item, index) : item[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {footerContent && <div className="pt-1">{footerContent}</div>}

      <DataTablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={sortedData.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        pageSizeOptions={pageSizeOptions}
      />
    </div>
  );
}
