import React from 'react';
import { usePermission } from '../utils/permissions';
import type { Permission } from '../utils/permissions';

export interface BulkAction {
  label: string;
  icon?: string;
  action: () => void;
  permission?: Permission;
  variant?: 'primary' | 'danger' | 'default';
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  actions,
  onClear,
}) => {
  const { can } = usePermission();

  if (selectedCount === 0) return null;

  const visibleActions = actions.filter(
    (a) => !a.permission || can(a.permission),
  );

  const variantStyles: Record<string, string> = {
    primary:
      'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20',
    danger:
      'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/20',
    default:
      'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600',
  };

  return (
    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <span className="material-icons-round text-primary text-lg">
            checklist
          </span>
        </div>
        <span className="text-sm font-black text-primary">
          {selectedCount} محدد
        </span>
      </div>

      <div className="h-6 w-px bg-primary/20 hidden sm:block" />

      <div className="flex items-center gap-2 flex-wrap flex-1">
        {visibleActions.map((action, i) => (
          <button
            key={i}
            onClick={action.action}
            disabled={action.disabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              variantStyles[action.variant || 'default']
            }`}
          >
            {action.icon && (
              <span className="material-icons-round text-sm">
                {action.icon}
              </span>
            )}
            {action.label}
          </button>
        ))}
      </div>

      <button
        onClick={onClear}
        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-all shrink-0"
        title="إلغاء التحديد"
      >
        <span className="material-icons-round text-lg">close</span>
      </button>
    </div>
  );
};
