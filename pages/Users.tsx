import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { userService } from '../services/userService';
import { activityLogService } from '../services/activityLogService';
import { Card, Badge, Button, LoadingSkeleton } from '../components/UI';
import { usePermission } from '../utils/permissions';
import type { FirestoreUser, FirestoreRole } from '../types';

export const Users: React.FC = () => {
  const { can, canManageUsers } = usePermission();
  const roles = useAppStore((s) => s.roles);
  const currentUid = useAppStore((s) => s.uid);
  const currentEmail = useAppStore((s) => s.userEmail);
  const createUser = useAppStore((s) => s.createUser);
  const resetUserPassword = useAppStore((s) => s.resetUserPassword);
  const login = useAppStore((s) => s.login);

  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<FirestoreUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [createError, setCreateError] = useState('');

  // Re-auth state (needed after creating user on client)
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [showReAuth, setShowReAuth] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const allUsers = await userService.getAll();
    setUsers(allUsers);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getRoleName = (roleId: string): string => {
    const role = roles.find((r) => r.id === roleId);
    return role?.name ?? 'غير محدد';
  };

  const getRoleColor = (roleId: string): string => {
    const role = roles.find((r) => r.id === roleId);
    return role?.color ?? 'bg-slate-100 text-slate-600';
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newDisplayName || !newRoleId) return;
    setCreateError('');
    setActionLoading('create');

    // Store current admin credentials for re-auth
    const adminEmail = currentEmail;

    const newUid = await createUser(newEmail, newPassword, newDisplayName, newRoleId);

    if (newUid) {
      // Firebase client SDK signs in as the newly created user.
      // We need to re-authenticate as the admin.
      setShowCreateModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRoleId('');
      setShowReAuth(true);
    } else {
      setCreateError('فشل إنشاء المستخدم. تحقق من البيانات.');
    }
    setActionLoading(null);
  };

  const handleReAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail || !reAuthPassword) return;
    setActionLoading('reauth');
    await login(currentEmail, reAuthPassword);
    setShowReAuth(false);
    setReAuthPassword('');
    setActionLoading(null);
    fetchUsers();
  };

  const handleToggleActive = async (user: FirestoreUser) => {
    setActionLoading(user.id!);
    await userService.toggleActive(user.id!, !user.isActive);

    if (currentUid && currentEmail) {
      activityLogService.log(
        currentUid, currentEmail,
        'TOGGLE_USER_ACTIVE',
        `${user.isActive ? 'تعطيل' : 'تفعيل'} المستخدم: ${user.displayName}`,
        { targetUserId: user.id, newStatus: !user.isActive }
      );
    }

    await fetchUsers();
    setActionLoading(null);
  };

  const handleUpdateRole = async (user: FirestoreUser, newRoleId: string) => {
    setActionLoading(user.id!);
    await userService.update(user.id!, { roleId: newRoleId });

    if (currentUid && currentEmail) {
      activityLogService.log(
        currentUid, currentEmail,
        'UPDATE_USER_ROLE',
        `تغيير دور المستخدم ${user.displayName} إلى: ${getRoleName(newRoleId)}`,
        { targetUserId: user.id, oldRoleId: user.roleId, newRoleId }
      );
    }

    await fetchUsers();
    setShowEditModal(null);
    setActionLoading(null);
  };

  const handleResetPassword = async (email: string) => {
    setActionLoading('reset-' + email);
    await resetUserPassword(email);
    alert(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${email}`);
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">إدارة المستخدمين</h2>
          <p className="text-sm text-slate-500 font-medium">إنشاء وإدارة حسابات المستخدمين والصلاحيات.</p>
        </div>
        {can('users.create') && (
          <Button onClick={() => { setShowCreateModal(true); setNewRoleId(roles[roles.length - 1]?.id ?? ''); }}>
            <span className="material-icons-round text-lg">person_add</span>
            إنشاء مستخدم
          </Button>
        )}
      </div>

      {/* Re-auth Modal */}
      {showReAuth && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">إعادة تسجيل الدخول</h3>
                <p className="text-xs text-slate-400">تم إنشاء المستخدم بنجاح. أعد تسجيل الدخول للمتابعة.</p>
              </div>
            </div>
            <form onSubmit={handleReAuth} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">كلمة المرور الخاصة بك</label>
                <input
                  type="password"
                  value={reAuthPassword}
                  onChange={(e) => setReAuthPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  placeholder="أدخل كلمة المرور"
                  required
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full" disabled={actionLoading === 'reauth'}>
                {actionLoading === 'reauth' ? 'جاري...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black">إنشاء مستخدم جديد</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-icons-round text-slate-400">close</span>
              </button>
            </div>

            {createError && (
              <div className="mb-4 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-sm font-bold text-rose-700 dark:text-rose-400">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">الاسم الكامل</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  placeholder="محمد أحمد"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  placeholder="user@example.com"
                  required
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">كلمة المرور</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  placeholder="6 أحرف على الأقل"
                  minLength={6}
                  required
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">الدور</label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  required
                >
                  <option value="">اختر الدور</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id!}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={actionLoading === 'create'} className="flex-1">
                  {actionLoading === 'create' ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                </Button>
                <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black">تعديل دور المستخدم</h3>
              <button onClick={() => setShowEditModal(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <span className="material-icons-round text-slate-400">close</span>
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-slate-500">
                <span className="font-bold text-slate-800 dark:text-white">{showEditModal.displayName}</span>
                {' '}({showEditModal.email})
              </p>
            </div>
            <div className="space-y-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleUpdateRole(showEditModal, r.id!)}
                  disabled={actionLoading === showEditModal.id}
                  className={`w-full px-4 py-3 rounded-xl text-right flex items-center gap-3 transition-all text-sm border ${
                    r.id === showEditModal.roleId
                      ? 'border-primary bg-primary/5 text-primary font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.color}`}>
                    {r.name}
                  </span>
                  {r.id === showEditModal.roleId && (
                    <span className="material-icons-round text-primary text-sm mr-auto">check</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={() => setShowEditModal(null)} className="w-full">
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <LoadingSkeleton rows={4} type="table" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">المستخدم</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">البريد الإلكتروني</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">الدور</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">الحالة</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-icons-round text-primary text-lg">person</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{user.displayName}</p>
                          <p className="text-xs text-slate-400">{user.id === currentUid ? '(أنت)' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs" dir="ltr">
                      {user.email}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${getRoleColor(user.roleId)}`}>
                        {getRoleName(user.roleId)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? 'نشط' : 'معطل'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {can('users.edit') && (
                          <button
                            onClick={() => setShowEditModal(user)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="تعديل الدور"
                          >
                            <span className="material-icons-round text-lg">edit</span>
                          </button>
                        )}
                        {can('users.edit') && user.id !== currentUid && (
                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={actionLoading === user.id}
                            className={`p-1.5 rounded-lg transition-all ${
                              user.isActive
                                ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                            title={user.isActive ? 'تعطيل' : 'تفعيل'}
                          >
                            <span className="material-icons-round text-lg">
                              {user.isActive ? 'block' : 'check_circle'}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => handleResetPassword(user.email)}
                          disabled={actionLoading === 'reset-' + user.email}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                          title="إعادة تعيين كلمة المرور"
                        >
                          <span className="material-icons-round text-lg">lock_reset</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium">
                      <span className="material-icons-round text-4xl block mb-2">group_off</span>
                      لا يوجد مستخدمين
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-400 font-bold mb-1">إجمالي المستخدمين</p>
          <p className="text-2xl font-black text-slate-800 dark:text-white">{users.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-400 font-bold mb-1">نشط</p>
          <p className="text-2xl font-black text-emerald-500">{users.filter((u) => u.isActive).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-400 font-bold mb-1">معطل</p>
          <p className="text-2xl font-black text-rose-500">{users.filter((u) => !u.isActive).length}</p>
        </div>
      </div>
    </div>
  );
};
