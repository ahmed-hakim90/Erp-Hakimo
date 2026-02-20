/**
 * Centralised Permission System (Dynamic — backed by Firestore)
 *
 * Permissions are stored per-role in Firestore "roles" collection.
 * The active user's resolved permissions live in the Zustand store.
 *
 * Usage in components:
 *   const { can, canCreateReport, canManageUsers } = usePermission();
 *   {canCreateReport && <Button>Add</Button>}
 */
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

// ─── Permission Names (all known permission keys) ────────────────────────────

export type Permission =
  | 'dashboard.view'
  | 'products.view' | 'products.create' | 'products.edit' | 'products.delete'
  | 'lines.view' | 'lines.create' | 'lines.edit' | 'lines.delete'
  | 'supervisors.view' | 'supervisors.create' | 'supervisors.edit' | 'supervisors.delete'
  | 'reports.view' | 'reports.create' | 'reports.edit' | 'reports.delete'
  | 'lineStatus.view' | 'lineStatus.edit'
  | 'lineProductConfig.view'
  | 'settings.view' | 'settings.edit'
  | 'roles.view' | 'roles.manage'
  | 'users.view' | 'users.create' | 'users.edit' | 'users.delete'
  | 'activityLog.view'
  | 'quickAction.view'
  | 'costs.view' | 'costs.manage'
  | 'plans.view' | 'plans.create' | 'plans.edit'
  | 'supervisorDashboard.view'
  | 'factoryDashboard.view'
  | 'adminDashboard.view'
  | 'print' | 'export';

// ─── Permission Groups (for admin UI) ────────────────────────────────────────

export interface PermissionItem {
  key: Permission;
  label: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'dashboard',
    label: 'لوحة التحكم',
    permissions: [
      { key: 'dashboard.view', label: 'عرض لوحة التحكم' },
    ],
  },
  {
    key: 'products',
    label: 'المنتجات',
    permissions: [
      { key: 'products.view', label: 'عرض' },
      { key: 'products.create', label: 'إنشاء' },
      { key: 'products.edit', label: 'تعديل' },
      { key: 'products.delete', label: 'حذف' },
    ],
  },
  {
    key: 'lines',
    label: 'خطوط الإنتاج',
    permissions: [
      { key: 'lines.view', label: 'عرض' },
      { key: 'lines.create', label: 'إنشاء' },
      { key: 'lines.edit', label: 'تعديل' },
      { key: 'lines.delete', label: 'حذف' },
    ],
  },
  {
    key: 'supervisors',
    label: 'المشرفين',
    permissions: [
      { key: 'supervisors.view', label: 'عرض' },
      { key: 'supervisors.create', label: 'إنشاء' },
      { key: 'supervisors.edit', label: 'تعديل' },
      { key: 'supervisors.delete', label: 'حذف' },
    ],
  },
  {
    key: 'reports',
    label: 'التقارير',
    permissions: [
      { key: 'reports.view', label: 'عرض' },
      { key: 'reports.create', label: 'إنشاء' },
      { key: 'reports.edit', label: 'تعديل' },
      { key: 'reports.delete', label: 'حذف' },
    ],
  },
  {
    key: 'lineStatus',
    label: 'حالة الخطوط',
    permissions: [
      { key: 'lineStatus.view', label: 'عرض' },
      { key: 'lineStatus.edit', label: 'تعديل' },
    ],
  },
  {
    key: 'lineProductConfig',
    label: 'إعدادات المنتج-الخط',
    permissions: [
      { key: 'lineProductConfig.view', label: 'عرض' },
    ],
  },
  {
    key: 'settings',
    label: 'الإعدادات',
    permissions: [
      { key: 'settings.view', label: 'عرض' },
      { key: 'settings.edit', label: 'تعديل' },
    ],
  },
  {
    key: 'roles',
    label: 'إدارة الأدوار',
    permissions: [
      { key: 'roles.view', label: 'عرض الأدوار' },
      { key: 'roles.manage', label: 'إدارة الأدوار' },
    ],
  },
  {
    key: 'users',
    label: 'إدارة المستخدمين',
    permissions: [
      { key: 'users.view', label: 'عرض المستخدمين' },
      { key: 'users.create', label: 'إنشاء مستخدم' },
      { key: 'users.edit', label: 'تعديل مستخدم' },
      { key: 'users.delete', label: 'حذف مستخدم' },
    ],
  },
  {
    key: 'activityLog',
    label: 'سجل النشاط',
    permissions: [
      { key: 'activityLog.view', label: 'عرض سجل النشاط' },
    ],
  },
  {
    key: 'quickAction',
    label: 'إدخال سريع',
    permissions: [
      { key: 'quickAction.view', label: 'الإدخال السريع' },
    ],
  },
  {
    key: 'costs',
    label: 'إدارة التكاليف',
    permissions: [
      { key: 'costs.view', label: 'عرض التكاليف' },
      { key: 'costs.manage', label: 'إدارة التكاليف' },
    ],
  },
  {
    key: 'plans',
    label: 'خطط الإنتاج',
    permissions: [
      { key: 'plans.view', label: 'عرض الخطط' },
      { key: 'plans.create', label: 'إنشاء خطة' },
      { key: 'plans.edit', label: 'تعديل خطة' },
    ],
  },
  {
    key: 'supervisorDashboard',
    label: 'لوحة المشرف',
    permissions: [
      { key: 'supervisorDashboard.view', label: 'عرض لوحة المشرف' },
    ],
  },
  {
    key: 'factoryDashboard',
    label: 'لوحة مدير المصنع',
    permissions: [
      { key: 'factoryDashboard.view', label: 'عرض لوحة مدير المصنع' },
    ],
  },
  {
    key: 'adminDashboard',
    label: 'لوحة مدير النظام',
    permissions: [
      { key: 'adminDashboard.view', label: 'عرض لوحة مدير النظام' },
    ],
  },
  {
    key: 'special',
    label: 'صلاحيات خاصة',
    permissions: [
      { key: 'print', label: 'طباعة' },
      { key: 'export', label: 'تصدير' },
    ],
  },
];

/** Flat list of every permission key */
export const ALL_PERMISSIONS: Permission[] =
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

// ─── Sidebar Items ───────────────────────────────────────────────────────────

export interface SidebarItem {
  path: string;
  icon: string;
  label: string;
  permission: Permission;
}

export interface SidebarGroup {
  key: string;
  label: string;
  items: SidebarItem[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    key: 'dashboards',
    label: 'لوحات التحكم',
    items: [
      { path: '/', icon: 'dashboard', label: 'الرئيسية', permission: 'dashboard.view' },
      { path: '/supervisor-dashboard', icon: 'assignment_ind', label: 'لوحة المشرف', permission: 'supervisorDashboard.view' },
      { path: '/factory-dashboard', icon: 'analytics', label: 'لوحة مدير المصنع', permission: 'factoryDashboard.view' },
      { path: '/admin-dashboard', icon: 'shield', label: 'لوحة مدير النظام', permission: 'adminDashboard.view' },
    ],
  },
  {
    key: 'production',
    label: 'الإنتاج',
    items: [
      { path: '/lines', icon: 'precision_manufacturing', label: 'خطوط الإنتاج', permission: 'lines.view' },
      { path: '/products', icon: 'inventory_2', label: 'المنتجات', permission: 'products.view' },
      { path: '/production-plans', icon: 'event_note', label: 'خطط الإنتاج', permission: 'plans.view' },
      { path: '/reports', icon: 'bar_chart', label: 'التقارير', permission: 'reports.view' },
      { path: '/quick-action', icon: 'bolt', label: 'إدخال سريع', permission: 'quickAction.view' },
    ],
  },
  {
    key: 'hr',
    label: 'فريق العمل',
    items: [
      { path: '/supervisors', icon: 'groups', label: 'المشرفين', permission: 'supervisors.view' },
      { path: '/users', icon: 'manage_accounts', label: 'المستخدمين', permission: 'users.view' },
    ],
  },
  {
    key: 'costs',
    label: 'التكاليف',
    items: [
      { path: '/cost-centers', icon: 'account_balance', label: 'مراكز التكلفة', permission: 'costs.view' },
      { path: '/cost-settings', icon: 'payments', label: 'إعدادات التكلفة', permission: 'costs.manage' },
    ],
  },
  {
    key: 'system',
    label: 'النظام',
    items: [
      { path: '/roles', icon: 'admin_panel_settings', label: 'الأدوار والصلاحيات', permission: 'roles.manage' },
      { path: '/activity-log', icon: 'history', label: 'سجل النشاط', permission: 'activityLog.view' },
      { path: '/settings', icon: 'settings', label: 'الإعدادات', permission: 'settings.view' },
    ],
  },
];

/** Flat list for backward compatibility (route matching, etc.) */
export const SIDEBAR_ITEMS: SidebarItem[] = SIDEBAR_GROUPS.flatMap((g) => g.items);

// ─── Route → Permission Mapping ──────────────────────────────────────────────

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/': 'dashboard.view',
  '/supervisor-dashboard': 'supervisorDashboard.view',
  '/products': 'products.view',
  '/products/:id': 'products.view',
  '/lines': 'lines.view',
  '/lines/:id': 'lines.view',
  '/supervisors': 'supervisors.view',
  '/supervisors/:id': 'supervisors.view',
  '/reports': 'reports.view',
  '/quick-action': 'quickAction.view',
  '/users': 'users.view',
  '/activity-log': 'activityLog.view',
  '/production-plans': 'plans.view',
  '/factory-dashboard': 'factoryDashboard.view',
  '/admin-dashboard': 'adminDashboard.view',
  '/cost-centers': 'costs.view',
  '/cost-centers/:id': 'costs.view',
  '/cost-settings': 'costs.manage',
  '/roles': 'roles.manage',
  '/settings': 'settings.view',
};

// ─── Pure Helpers ────────────────────────────────────────────────────────────

/** Check a single permission against a permissions map */
export function checkPermission(
  permissions: Record<string, boolean>,
  permission: Permission,
): boolean {
  return permissions[permission] === true;
}

/** Derive read-only status from a permissions map */
export function deriveIsReadOnly(permissions: Record<string, boolean>): boolean {
  return !Object.entries(permissions).some(
    ([key, val]) =>
      val && !key.endsWith('.view') && key !== 'print' && key !== 'export',
  );
}

// ─── Permission Guard Interface ──────────────────────────────────────────────

export interface PermissionGuards {
  can: (permission: Permission) => boolean;
  canCreateReport: boolean;
  canEditReport: boolean;
  canDeleteReport: boolean;
  canManageUsers: boolean;
  canViewActivityLog: boolean;
  canUseQuickAction: boolean;
}

// ─── React Hooks ─────────────────────────────────────────────────────────────

/** Primary hook — returns `can()` checker plus named guards */
export function usePermission(): PermissionGuards {
  const permissions = useAppStore((s) => s.userPermissions);
  return useMemo(() => {
    const can = (permission: Permission) => permissions[permission] === true;
    return {
      can,
      canCreateReport: can('reports.create'),
      canEditReport: can('reports.edit'),
      canDeleteReport: can('reports.delete'),
      canManageUsers: can('users.create') || can('users.edit'),
      canViewActivityLog: can('activityLog.view'),
      canUseQuickAction: can('quickAction.view'),
    };
  }, [permissions]);
}

/** Display hook — returns current role info for UI chrome */
export function useCurrentRole() {
  const roleName = useAppStore((s) => s.userRoleName);
  const roleColor = useAppStore((s) => s.userRoleColor);
  const permissions = useAppStore((s) => s.userPermissions);
  return useMemo(() => ({
    roleName,
    roleColor,
    isReadOnly: deriveIsReadOnly(permissions),
  }), [roleName, roleColor, permissions]);
}
