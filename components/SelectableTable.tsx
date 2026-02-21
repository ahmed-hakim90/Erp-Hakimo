import React, { useMemo, useState, useCallback } from 'react';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { BulkActionBar } from './BulkActionBar';
import type { BulkAction } from './BulkActionBar';
import type { Permission } from '../utils/permissions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TableColumn<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  headerClassName?: string;
  className?: string;
}

export interface TableBulkAction<T> {
  label: string;
  icon?: string;
  action: (items: T[]) => void;
  permission?: Permission;
  variant?: 'primary' | 'danger' | 'default';
  disabled?: boolean;
}

interface SelectableTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  getId: (item: T) => string;
  bulkActions?: TableBulkAction<T>[];
  /** Per-row action buttons (rightmost column) */
  renderActions?: (item: T) => React.ReactNode;
  actionsHeader?: string;
  emptyIcon?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  /** Optional footer content below the table */
  footer?: React.ReactNode;
  className?: string;
  /** Number of items per page. 0 = no pagination (default) */
  pageSize?: number;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function usePagination<T>(data: T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);

  const pageData = useMemo(() => {
    if (pageSize <= 0) return data;
    const start = safePage * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  const goTo = useCallback(
    (p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1))),
    [totalPages],
  );

  return { page: safePage, totalPages, pageData, goTo, hasPagination: pageSize > 0 && data.length > pageSize };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SelectableTable<T>({
  data,
  columns,
  getId,
  bulkActions = [],
  renderActions,
  actionsHeader = 'إجراءات',
  emptyIcon = 'inbox',
  emptyTitle = 'لا توجد بيانات',
  emptySubtitle,
  footer,
  className = '',
  pageSize = 0,
}: SelectableTableProps<T>) {
  const { page, totalPages, pageData, goTo, hasPagination } = usePagination(data, pageSize);

  const {
    selectedItems,
    selectedCount,
    allSelected,
    isSelected,
    toggle,
    toggleAll,
    clearAll,
  } = useBulkSelection(pageData, getId);

  const totalCols =
    columns.length + 1 + (renderActions ? 1 : 0);

  const barActions: BulkAction[] = useMemo(
    () =>
      bulkActions.map((ba) => ({
        label: ba.label,
        icon: ba.icon,
        action: () => ba.action(selectedItems),
        permission: ba.permission,
        variant: ba.variant,
        disabled: ba.disabled,
      })),
    [bulkActions, selectedItems],
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        actions={barActions}
        onClear={clearAll}
      />

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                {/* Select-all checkbox */}
                <th className="px-4 py-4 w-12">
                  <label className="flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected && pageData.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30 cursor-pointer"
                    />
                  </label>
                </th>

                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={`px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-[0.15em] ${col.headerClassName ?? ''}`}
                  >
                    {col.header}
                  </th>
                ))}

                {renderActions && (
                  <th className="px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-left">
                    {actionsHeader}
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="px-6 py-16 text-center text-slate-400">
                    <span className="material-icons-round text-5xl mb-3 block opacity-30">
                      {emptyIcon}
                    </span>
                    <p className="font-bold text-lg">{emptyTitle}</p>
                    {emptySubtitle && (
                      <p className="text-sm mt-1">{emptySubtitle}</p>
                    )}
                  </td>
                </tr>
              )}

              {pageData.map((item) => {
                const id = getId(item);
                const checked = isSelected(id);
                return (
                  <tr
                    key={id}
                    className={`transition-colors group ${
                      checked
                        ? 'bg-primary/5 dark:bg-primary/10'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-4 py-4 w-12">
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30 cursor-pointer"
                        />
                      </label>
                    </td>

                    {columns.map((col, ci) => (
                      <td
                        key={ci}
                        className={`px-5 py-4 text-sm ${col.className ?? ''}`}
                      >
                        {col.render(item)}
                      </td>
                    ))}

                    {renderActions && (
                      <td className="px-5 py-4 text-left">
                        {renderActions(item)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {hasPagination && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">
              صفحة{' '}
              <span className="text-primary">{page + 1}</span> من{' '}
              <span className="text-primary">{totalPages}</span>{' '}
              ({data.length} عنصر)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goTo(page - 1)}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-icons-round text-lg">chevron_right</span>
              </button>
              <button
                onClick={() => goTo(page + 1)}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-icons-round text-lg">chevron_left</span>
              </button>
            </div>
          </div>
        )}

        {/* Custom Footer */}
        {footer}
      </div>
    </div>
  );
}
