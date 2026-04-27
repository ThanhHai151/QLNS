'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: Extract<keyof T, string> | 'actions';
  title: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  maxHeight?: string;
  globalSearch?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  maxHeight = '100%',
  globalSearch = '',
  className,
}: DataTableProps<T>) {
  const [colSearch, setColSearch] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

    // 1. Global Search
    if (globalSearch) {
      const lowerSearch = removeAccents(globalSearch.toLowerCase());
      result = result.filter((row) =>
        Object.values(row).some(
          (val) => val !== null && val !== undefined && removeAccents(String(val).toLowerCase()).includes(lowerSearch)
        )
      );
    }

    // 2. Per-column Search (AND condition for all populated column filters)
    const activeColFilters = Object.entries(colSearch).filter(([_, val]) => val.trim() !== '');
    if (activeColFilters.length > 0) {
      result = result.filter((row) => {
        return activeColFilters.every(([key, filterText]) => {
          const val = row[key];
          if (val === null || val === undefined) return false;
          return removeAccents(String(val).toLowerCase()).includes(removeAccents(filterText.toLowerCase()));
        });
      });
    }

    // 3. Local Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const isAsc = sortConfig.dir === 'asc';
        if (valA < valB) return isAsc ? -1 : 1;
        return isAsc ? 1 : -1;
      });
    }

    return result;
  }, [data, globalSearch, colSearch, sortConfig]);

  const toggleSort = (key: string) => {
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.dir === 'asc') {
        // Toggle to desc
        setSortConfig({ key, dir: 'desc' });
      } else {
        // Toggle to default (none)
        setSortConfig(null);
      }
    } else {
      // Toggle to asc
      setSortConfig({ key, dir: 'asc' });
    }
  };

  const handleColSearchChange = (key: string, value: string) => {
    setColSearch((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={cn("glass overflow-hidden flex flex-col w-full h-full min-h-0", className)}>
      {/* Wrapper to control overall table scrolling while fixing the header */}
      <div className="overflow-auto w-full flex-1 min-h-0 custom-scrollbar">
        <table className="data-table w-full relative">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10 shadow-sm border-b border-white/10">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="align-top">
                  <div className="flex flex-col gap-2 relative">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 justify-between select-none p-1 -m-1 rounded-md",
                        col.sortable && "cursor-pointer hover:bg-white/5 transition-colors group"
                      )}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      <span className="font-semibold">{col.title}</span>
                      {col.sortable && (
                        <span className="text-white/20 group-hover:text-white/50 transition-colors flex shrink-0 ml-2">
                          {sortConfig?.key === col.key ? (
                            sortConfig.dir === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />
                          ) : (
                            <ChevronsUpDown size={14} />
                          )}
                        </span>
                      )}
                    </div>
                    {col.searchable && (
                      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
                          placeholder={`Tìm ${col.title.toLowerCase()}...`}
                          value={colSearch[col.key] || ''}
                          onChange={(e) => handleColSearchChange(col.key, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {filteredAndSortedData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center text-white/40 py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-white/20 mb-2" />
                    <p>Không tìm thấy dữ liệu nào</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
