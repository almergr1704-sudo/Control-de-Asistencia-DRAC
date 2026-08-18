import React, { useState } from 'react';
import { Search, Filter, X, RotateCcw, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface AdvancedSearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  activeFilterCount?: number;
  onResetFilters: () => void;
  children?: React.ReactNode;
  extraActions?: React.ReactNode;
  quickFilters?: React.ReactNode;
  className?: string;
  badgeSummary?: React.ReactNode;
}

export const AdvancedSearchFilter: React.FC<AdvancedSearchFilterProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = '🔍 Buscar por DNI, nombre, código, descripción...',
  activeFilterCount = 0,
  onResetFilters,
  children,
  extraActions,
  quickFilters,
  className = '',
  badgeSummary,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = Boolean(searchTerm.trim()) || activeFilterCount > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        {/* Quick Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-9 py-2 bg-[#090A0D] border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Buttons and Controls Group */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {quickFilters}

          {children && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all whitespace-nowrap ${
                isOpen || activeFilterCount > 0
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros avanzados</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-bold font-mono">
                  {activeFilterCount}
                </span>
              )}
              {isOpen ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-2.5 py-2 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Restablecer todos los filtros y búsqueda"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar filtros</span>
            </button>
          )}

          {extraActions}
        </div>
      </div>

      {/* Active Filter Indicator Badge Bar */}
      {(hasActiveFilters || badgeSummary) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-0.5">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
            <span>Filtros activos:</span>
          </span>
          {searchTerm.trim() && (
            <span className="px-2 py-0.5 bg-slate-800/90 border border-slate-700 rounded text-slate-200 flex items-center gap-1">
              Texto: &ldquo;{searchTerm}&rdquo;
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="hover:text-rose-400 ml-0.5"
                title="Quitar filtro de texto"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-indigo-950/70 border border-indigo-500/40 rounded text-indigo-300 font-semibold font-mono">
              {activeFilterCount} {activeFilterCount === 1 ? 'filtro avanzado' : 'filtros avanzados'}
            </span>
          )}
          {badgeSummary}
        </div>
      )}

      {/* Collapsible Advanced Filters Drawer */}
      {isOpen && children && (
        <div className="p-4 bg-[#0B0D12] border border-indigo-500/30 rounded-xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Criterios de Búsqueda y Filtrado Multifiltro</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer Todo</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */
/* REUSABLE FORM CONTROLS FOR ADVANCED FILTERS                               */
/* ========================================================================= */

export interface FilterFieldProps {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  helper?: string;
}

export const FilterField: React.FC<FilterFieldProps> = ({
  label,
  icon: Icon,
  children,
  className = '',
  helper,
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-indigo-400" />}
        <span>{label}</span>
      </label>
      {children}
      {helper && <p className="text-[10px] text-slate-500 leading-tight">{helper}</p>}
    </div>
  );
};

export interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2.5 py-1.5 bg-[#090A0D] text-slate-200 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-sans transition-all"
    >
      {placeholder && <option value="ALL">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

export interface FilterDateRangeProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
}

export const FilterDateRange: React.FC<FilterDateRangeProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full px-2 py-1.5 bg-[#090A0D] text-slate-200 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 font-mono"
        />
      </div>
      <div>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full px-2 py-1.5 bg-[#090A0D] text-slate-200 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 font-mono"
        />
      </div>
    </div>
  );
};
