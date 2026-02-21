import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Badge } from '@/components/UI';
import { usePermission } from '@/utils/permissions';
import { useAppStore } from '@/store/useAppStore';
import { getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { departmentsRef, jobPositionsRef, shiftsRef, HR_COLLECTIONS } from '../collections';
import type { FirestoreDepartment, FirestoreJobPosition, FirestoreShift, JobLevel } from '../types';
import { JOB_LEVEL_LABELS } from '../types';

type OrgTab = 'departments' | 'positions' | 'shifts';

const TABS: { key: OrgTab; label: string; icon: string }[] = [
  { key: 'departments', label: 'الأقسام', icon: 'business' },
  { key: 'positions', label: 'المناصب', icon: 'work' },
  { key: 'shifts', label: 'الورديات', icon: 'schedule' },
];

const emptyDept: Omit<FirestoreDepartment, 'id' | 'createdAt'> = {
  name: '', code: '', managerId: '', isActive: true,
};

const emptyPos: Omit<FirestoreJobPosition, 'id' | 'createdAt'> = {
  title: '', departmentId: '', level: 1 as JobLevel, hasSystemAccessDefault: false, isActive: true,
};

const emptyShift: Omit<FirestoreShift, 'id'> = {
  name: '', startTime: '08:00', endTime: '16:00', breakMinutes: 60, lateGraceMinutes: 15, crossesMidnight: false, isActive: true,
};

export const Organization: React.FC = () => {
  const { can } = usePermission();
  const _rawEmployees = useAppStore((s) => s._rawEmployees);
  const canEdit = can('hrSettings.edit');

  const [tab, setTab] = useState<OrgTab>('departments');
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<FirestoreDepartment[]>([]);
  const [positions, setPositions] = useState<FirestoreJobPosition[]>([]);
  const [shifts, setShifts] = useState<FirestoreShift[]>([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState(emptyDept);
  const [posForm, setPosForm] = useState(emptyPos);
  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dSnap, pSnap, sSnap] = await Promise.all([
        getDocs(departmentsRef()),
        getDocs(jobPositionsRef()),
        getDocs(shiftsRef()),
      ]);
      setDepartments(dSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreDepartment)));
      setPositions(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreJobPosition)));
      setShifts(sSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreShift)));
    } catch (e) {
      console.error('Organization loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getDeptName = (id: string) => departments.find((d) => d.id === id)?.name ?? '—';
  const getManagerName = (id: string) => _rawEmployees.find((e) => e.id === id)?.name ?? '—';

  const deptEmployeeCount = useMemo(() => {
    const map: Record<string, number> = {};
    _rawEmployees.forEach((e) => {
      if (e.departmentId) map[e.departmentId] = (map[e.departmentId] || 0) + 1;
    });
    return map;
  }, [_rawEmployees]);

  const posCountByDept = useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach((p) => {
      if (p.departmentId) map[p.departmentId] = (map[p.departmentId] || 0) + 1;
    });
    return map;
  }, [positions]);

  // ── Open Modals ──
  const openCreate = () => {
    setEditId(null);
    if (tab === 'departments') setDeptForm({ ...emptyDept });
    if (tab === 'positions') setPosForm({ ...emptyPos });
    if (tab === 'shifts') setShiftForm({ ...emptyShift });
    setShowModal(true);
  };

  const openEditDept = (d: FirestoreDepartment) => {
    setEditId(d.id!);
    setDeptForm({ name: d.name, code: d.code, managerId: d.managerId || '', isActive: d.isActive });
    setTab('departments');
    setShowModal(true);
  };

  const openEditPos = (p: FirestoreJobPosition) => {
    setEditId(p.id!);
    setPosForm({ title: p.title, departmentId: p.departmentId, level: p.level, hasSystemAccessDefault: p.hasSystemAccessDefault, isActive: p.isActive });
    setTab('positions');
    setShowModal(true);
  };

  const openEditShift = (s: FirestoreShift) => {
    setEditId(s.id!);
    setShiftForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, lateGraceMinutes: s.lateGraceMinutes, crossesMidnight: s.crossesMidnight, isActive: s.isActive });
    setTab('shifts');
    setShowModal(true);
  };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'departments') {
        if (!deptForm.name.trim()) return;
        const data = { ...deptForm, name: deptForm.name.trim(), code: deptForm.code.trim() || deptForm.name.trim().substring(0, 3).toUpperCase() };
        if (editId) {
          await updateDoc(doc(db, HR_COLLECTIONS.DEPARTMENTS, editId), data);
        } else {
          await addDoc(departmentsRef(), { ...data, createdAt: serverTimestamp() });
        }
      } else if (tab === 'positions') {
        if (!posForm.title.trim()) return;
        const data = { ...posForm, title: posForm.title.trim() };
        if (editId) {
          await updateDoc(doc(db, HR_COLLECTIONS.JOB_POSITIONS, editId), data);
        } else {
          await addDoc(jobPositionsRef(), { ...data, createdAt: serverTimestamp() });
        }
      } else if (tab === 'shifts') {
        if (!shiftForm.name.trim()) return;
        const data = { ...shiftForm, name: shiftForm.name.trim() };
        if (editId) {
          await updateDoc(doc(db, HR_COLLECTIONS.SHIFTS, editId), data);
        } else {
          await addDoc(shiftsRef(), { ...data, createdAt: serverTimestamp() });
        }
      }
      setShowModal(false);
      await loadData();
    } catch (e) {
      console.error('Organization save error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const col = tab === 'departments' ? HR_COLLECTIONS.DEPARTMENTS : tab === 'positions' ? HR_COLLECTIONS.JOB_POSITIONS : HR_COLLECTIONS.SHIFTS;
      await deleteDoc(doc(db, col, deleteConfirmId));
      setDeleteConfirmId(null);
      await loadData();
    } catch (e) {
      console.error('Organization delete error:', e);
    }
  };

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">الهيكل التنظيمي</h1>
          <p className="text-sm text-slate-500 mt-1">إدارة الأقسام والمناصب والورديات</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={openCreate}>
            <span className="material-icons-round text-lg">add</span>
            {tab === 'departments' && 'إضافة قسم'}
            {tab === 'positions' && 'إضافة منصب'}
            {tab === 'shifts' && 'إضافة وردية'}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-2xl">business</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">الأقسام</p>
            <p className="text-xl font-black">{departments.filter((d) => d.isActive).length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-2xl">work</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">المناصب</p>
            <p className="text-xl font-black">{positions.filter((p) => p.isActive).length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-500/10 text-violet-500 rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-2xl">schedule</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">الورديات</p>
            <p className="text-xl font-black">{shifts.filter((s) => s.isActive).length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
              tab === t.key ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-icons-round text-lg">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Departments Tab ── */}
      {tab === 'departments' && (
        <Card>
          {departments.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-icons-round text-5xl text-slate-300 dark:text-slate-600">business</span>
              <p className="text-slate-500 font-bold mt-3">لا يوجد أقسام</p>
              <p className="text-xs text-slate-400 mt-1">اضغط "إضافة قسم" للبدء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                    <th className="text-right py-3 px-4 font-bold">القسم</th>
                    <th className="text-right py-3 px-4 font-bold">الرمز</th>
                    <th className="text-right py-3 px-4 font-bold">مدير القسم</th>
                    <th className="text-center py-3 px-4 font-bold">الموظفين</th>
                    <th className="text-center py-3 px-4 font-bold">المناصب</th>
                    <th className="text-center py-3 px-4 font-bold">الحالة</th>
                    {canEdit && <th className="text-center py-3 px-4 font-bold">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{d.name}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs font-mono">{d.code}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{d.managerId ? getManagerName(d.managerId) : <span className="text-slate-400">—</span>}</td>
                      <td className="py-3 px-4 text-center font-bold">{deptEmployeeCount[d.id!] || 0}</td>
                      <td className="py-3 px-4 text-center font-bold">{posCountByDept[d.id!] || 0}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'نشط' : 'معطل'}</Badge>
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditDept(d)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-primary">
                              <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button onClick={() => setDeleteConfirmId(d.id!)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
                              <span className="material-icons-round text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Positions Tab ── */}
      {tab === 'positions' && (
        <Card>
          {positions.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-icons-round text-5xl text-slate-300 dark:text-slate-600">work</span>
              <p className="text-slate-500 font-bold mt-3">لا يوجد مناصب</p>
              <p className="text-xs text-slate-400 mt-1">اضغط "إضافة منصب" للبدء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                    <th className="text-right py-3 px-4 font-bold">المنصب</th>
                    <th className="text-right py-3 px-4 font-bold">القسم</th>
                    <th className="text-center py-3 px-4 font-bold">المستوى</th>
                    <th className="text-center py-3 px-4 font-bold">دخول نظام افتراضي</th>
                    <th className="text-center py-3 px-4 font-bold">الحالة</th>
                    {canEdit && <th className="text-center py-3 px-4 font-bold">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{p.title}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{p.departmentId ? getDeptName(p.departmentId) : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">{JOB_LEVEL_LABELS[p.level]}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.hasSystemAccessDefault
                          ? <span className="material-icons-round text-emerald-500 text-lg">check_circle</span>
                          : <span className="material-icons-round text-slate-300 text-lg">cancel</span>
                        }
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'نشط' : 'معطل'}</Badge>
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditPos(p)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-primary">
                              <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button onClick={() => setDeleteConfirmId(p.id!)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
                              <span className="material-icons-round text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Shifts Tab ── */}
      {tab === 'shifts' && (
        <Card>
          {shifts.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-icons-round text-5xl text-slate-300 dark:text-slate-600">schedule</span>
              <p className="text-slate-500 font-bold mt-3">لا يوجد ورديات</p>
              <p className="text-xs text-slate-400 mt-1">اضغط "إضافة وردية" للبدء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                    <th className="text-right py-3 px-4 font-bold">الوردية</th>
                    <th className="text-center py-3 px-4 font-bold">من</th>
                    <th className="text-center py-3 px-4 font-bold">إلى</th>
                    <th className="text-center py-3 px-4 font-bold">استراحة</th>
                    <th className="text-center py-3 px-4 font-bold">سماح تأخير</th>
                    <th className="text-center py-3 px-4 font-bold">تعبر منتصف الليل</th>
                    <th className="text-center py-3 px-4 font-bold">الحالة</th>
                    {canEdit && <th className="text-center py-3 px-4 font-bold">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{s.name}</td>
                      <td className="py-3 px-4 text-center font-mono">{s.startTime}</td>
                      <td className="py-3 px-4 text-center font-mono">{s.endTime}</td>
                      <td className="py-3 px-4 text-center">{s.breakMinutes} د</td>
                      <td className="py-3 px-4 text-center">{s.lateGraceMinutes} د</td>
                      <td className="py-3 px-4 text-center">
                        {s.crossesMidnight
                          ? <span className="material-icons-round text-amber-500 text-lg">dark_mode</span>
                          : <span className="material-icons-round text-slate-300 text-lg">light_mode</span>
                        }
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'نشطة' : 'معطلة'}</Badge>
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditShift(s)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-primary">
                              <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button onClick={() => setDeleteConfirmId(s.id!)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
                              <span className="material-icons-round text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && canEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editId ? 'تعديل' : 'إضافة'}{' '}
                {tab === 'departments' && 'قسم'}
                {tab === 'positions' && 'منصب'}
                {tab === 'shifts' && 'وردية'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Department Form */}
              {tab === 'departments' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">اسم القسم *</label>
                    <input
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={deptForm.name}
                      onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                      placeholder="مثال: قسم التجميع"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">رمز القسم</label>
                    <input
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium focus:border-primary"
                      value={deptForm.code}
                      onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                      placeholder="ASM"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">مدير القسم</label>
                    <select
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                      value={deptForm.managerId}
                      onChange={(e) => setDeptForm({ ...deptForm, managerId: e.target.value })}
                    >
                      <option value="">— بدون مدير —</option>
                      {_rawEmployees.filter((e) => e.isActive !== false).map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400">نشط</label>
                    <button
                      type="button"
                      onClick={() => setDeptForm({ ...deptForm, isActive: !deptForm.isActive })}
                      className={`w-11 h-6 rounded-full transition-colors relative ${deptForm.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${deptForm.isActive ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </>
              )}

              {/* Position Form */}
              {tab === 'positions' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">اسم المنصب *</label>
                    <input
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={posForm.title}
                      onChange={(e) => setPosForm({ ...posForm, title: e.target.value })}
                      placeholder="مثال: فني تجميع"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">القسم التابع</label>
                    <select
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                      value={posForm.departmentId}
                      onChange={(e) => setPosForm({ ...posForm, departmentId: e.target.value })}
                    >
                      <option value="">— كل الأقسام —</option>
                      {departments.filter((d) => d.isActive).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">المستوى الوظيفي</label>
                    <select
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                      value={posForm.level}
                      onChange={(e) => setPosForm({ ...posForm, level: Number(e.target.value) as JobLevel })}
                    >
                      {(Object.entries(JOB_LEVEL_LABELS) as [string, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-bold text-slate-600 dark:text-slate-400">دخول نظام افتراضي</label>
                      <button
                        type="button"
                        onClick={() => setPosForm({ ...posForm, hasSystemAccessDefault: !posForm.hasSystemAccessDefault })}
                        className={`w-11 h-6 rounded-full transition-colors relative ${posForm.hasSystemAccessDefault ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${posForm.hasSystemAccessDefault ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-bold text-slate-600 dark:text-slate-400">نشط</label>
                      <button
                        type="button"
                        onClick={() => setPosForm({ ...posForm, isActive: !posForm.isActive })}
                        className={`w-11 h-6 rounded-full transition-colors relative ${posForm.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${posForm.isActive ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Shift Form */}
              {tab === 'shifts' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">اسم الوردية *</label>
                    <input
                      className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                      placeholder="مثال: الوردية الصباحية"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">وقت البداية</label>
                      <input
                        type="time"
                        className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                        value={shiftForm.startTime}
                        onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">وقت النهاية</label>
                      <input
                        type="time"
                        className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                        value={shiftForm.endTime}
                        onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">استراحة (دقيقة)</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                        value={shiftForm.breakMinutes}
                        onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">سماح تأخير (دقيقة)</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm p-3 outline-none font-medium"
                        value={shiftForm.lateGraceMinutes}
                        onChange={(e) => setShiftForm({ ...shiftForm, lateGraceMinutes: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-bold text-slate-600 dark:text-slate-400">تعبر منتصف الليل</label>
                      <button
                        type="button"
                        onClick={() => setShiftForm({ ...shiftForm, crossesMidnight: !shiftForm.crossesMidnight })}
                        className={`w-11 h-6 rounded-full transition-colors relative ${shiftForm.crossesMidnight ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${shiftForm.crossesMidnight ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-bold text-slate-600 dark:text-slate-400">نشطة</label>
                      <button
                        type="button"
                        onClick={() => setShiftForm({ ...shiftForm, isActive: !shiftForm.isActive })}
                        className={`w-11 h-6 rounded-full transition-colors relative ${shiftForm.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${shiftForm.isActive ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || (tab === 'departments' && !deptForm.name.trim()) || (tab === 'positions' && !posForm.title.trim()) || (tab === 'shifts' && !shiftForm.name.trim())}
              >
                {saving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                {editId ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-round text-3xl text-rose-500">delete_forever</span>
            </div>
            <h3 className="text-lg font-bold mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-slate-500 mb-6">هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>إلغاء</Button>
              <Button variant="danger" onClick={handleDelete}>حذف</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
