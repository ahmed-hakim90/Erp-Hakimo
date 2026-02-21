import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Badge, SearchableSelect } from '@/components/UI';
import { usePermission } from '@/utils/permissions';
import { useAppStore } from '@/store/useAppStore';
import { leaveRequestService, leaveBalanceService } from '../leaveService';
import type {
  FirestoreLeaveRequest,
  FirestoreLeaveBalance,
  LeaveType,
  ApprovalStatus,
} from '../types';
import { LEAVE_TYPE_LABELS, DEFAULT_LEAVE_BALANCE } from '../types';

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'قيد الانتظار', variant: 'warning' },
  approved: { label: 'مُعتمد', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
};

function calculateDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

// ─── Component ──────────────────────────────────────────────────────────────

export const LeaveRequests: React.FC = () => {
  const { can } = usePermission();
  const uid = useAppStore((s) => s.uid);
  const currentEmployee = useAppStore((s) => s.currentEmployee);

  const [requests, setRequests] = useState<FirestoreLeaveRequest[]>([]);
  const [balance, setBalance] = useState<FirestoreLeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | ''>('');

  // Form state
  const [formLeaveType, setFormLeaveType] = useState<LeaveType>('annual');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formAffects, setFormAffects] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isHR = can('leave.manage');
  const employeeId = currentEmployee?.id || uid || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allRequests, bal] = await Promise.all([
        isHR ? leaveRequestService.getAll() : leaveRequestService.getByEmployee(employeeId),
        leaveBalanceService.getOrCreate(employeeId),
      ]);
      setRequests(allRequests);
      setBalance(bal);
    } catch (err) {
      console.error('Error loading leave data:', err);
    } finally {
      setLoading(false);
    }
  }, [employeeId, isHR]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formDays = useMemo(() => {
    if (!formStartDate || !formEndDate) return 0;
    return calculateDays(formStartDate, formEndDate);
  }, [formStartDate, formEndDate]);

  const handleSubmit = useCallback(async () => {
    if (!formStartDate || !formEndDate || formDays <= 0) return;
    setSubmitting(true);
    try {
      await leaveRequestService.create({
        employeeId,
        leaveType: formLeaveType,
        startDate: formStartDate,
        endDate: formEndDate,
        totalDays: formDays,
        affectsSalary: formAffects,
        status: 'pending',
        approvalChain: [],
        finalStatus: 'pending',
        reason: formReason,
        createdBy: uid || '',
      });
      setShowForm(false);
      setFormStartDate('');
      setFormEndDate('');
      setFormReason('');
      await fetchData();
    } catch (err) {
      console.error('Error creating leave request:', err);
    } finally {
      setSubmitting(false);
    }
  }, [employeeId, uid, formLeaveType, formStartDate, formEndDate, formDays, formAffects, formReason, fetchData]);

  const filtered = useMemo(() => {
    let result = requests;
    if (filterEmployee) {
      result = result.filter((r) => r.employeeId === filterEmployee);
    }
    if (filterStatus) {
      result = result.filter((r) => r.finalStatus === filterStatus);
    }
    return result;
  }, [requests, filterEmployee, filterStatus]);

  const uniqueEmployees = useMemo(() => {
    const ids = [...new Set(requests.map((r) => r.employeeId))];
    return ids.map((id) => ({ value: id, label: id }));
  }, [requests]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
            إدارة الإجازات
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            طلب إجازة ومتابعة الأرصدة وحالات الموافقة
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          <span className="material-icons-round text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'إغلاق' : 'طلب إجازة'}
        </Button>
      </div>

      {/* Balance Cards */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <span className="material-icons-round text-blue-500 text-3xl mb-2 block">beach_access</span>
            <p className="text-xs text-slate-400 font-bold mb-1">سنوية</p>
            <p className="text-2xl font-black text-blue-600">{balance.annualBalance}</p>
            <p className="text-xs text-slate-400">يوم</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <span className="material-icons-round text-rose-500 text-3xl mb-2 block">local_hospital</span>
            <p className="text-xs text-slate-400 font-bold mb-1">مرضية</p>
            <p className="text-2xl font-black text-rose-600">{balance.sickBalance}</p>
            <p className="text-xs text-slate-400">يوم</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <span className="material-icons-round text-amber-500 text-3xl mb-2 block">warning</span>
            <p className="text-xs text-slate-400 font-bold mb-1">طارئة</p>
            <p className="text-2xl font-black text-amber-600">{balance.emergencyBalance}</p>
            <p className="text-xs text-slate-400">يوم</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <span className="material-icons-round text-slate-500 text-3xl mb-2 block">money_off</span>
            <p className="text-xs text-slate-400 font-bold mb-1">بدون راتب (مأخوذة)</p>
            <p className="text-2xl font-black text-slate-600">{balance.unpaidTaken}</p>
            <p className="text-xs text-slate-400">يوم</p>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <Card title="طلب إجازة جديد">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                نوع الإجازة
              </label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={formLeaveType}
                onChange={(e) => setFormLeaveType(e.target.value as LeaveType)}
              >
                {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAffects}
                  onChange={(e) => setFormAffects(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  تؤثر على الراتب
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                تاريخ البداية
              </label>
              <input
                type="date"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                تاريخ النهاية
              </label>
              <input
                type="date"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                min={formStartDate}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                السبب
              </label>
              <textarea
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                rows={3}
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="سبب الإجازة..."
              />
            </div>
          </div>

          {formDays > 0 && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3">
              <span className="material-icons-round text-blue-500">info</span>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                مدة الإجازة: {formDays} يوم
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !formStartDate || !formEndDate || formDays <= 0}
            >
              {submitting && <span className="material-icons-round animate-spin text-sm">refresh</span>}
              <span className="material-icons-round text-sm">send</span>
              تقديم الطلب
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isHR && (
          <SearchableSelect
            options={[{ value: '', label: 'جميع الموظفين' }, ...uniqueEmployees]}
            value={filterEmployee}
            onChange={setFilterEmployee}
            placeholder="تصفية بالموظف..."
            className="sm:w-64"
          />
        )}
        <select
          className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ApprovalStatus | '')}
        >
          <option value="">جميع الحالات</option>
          <option value="pending">قيد الانتظار</option>
          <option value="approved">مُعتمد</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>

      {/* Requests Table */}
      <Card>
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-icons-round text-5xl text-slate-300 dark:text-slate-600 mb-3 block">
              event_busy
            </span>
            <p className="text-sm font-bold text-slate-500">لا توجد طلبات إجازة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-bold">
                  {isHR && <th className="text-right py-3 px-3">الموظف</th>}
                  <th className="text-right py-3 px-3">النوع</th>
                  <th className="text-right py-3 px-3">من</th>
                  <th className="text-right py-3 px-3">إلى</th>
                  <th className="text-right py-3 px-3">الأيام</th>
                  <th className="text-right py-3 px-3">تؤثر على الراتب</th>
                  <th className="text-right py-3 px-3">الحالة</th>
                  <th className="text-right py-3 px-3">مراحل الموافقة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const statusCfg = STATUS_CONFIG[req.finalStatus];
                  return (
                    <tr key={req.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      {isHR && <td className="py-3 px-3 font-bold">{req.employeeId}</td>}
                      <td className="py-3 px-3">
                        <Badge variant="info">{LEAVE_TYPE_LABELS[req.leaveType]}</Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs" dir="ltr">{req.startDate}</td>
                      <td className="py-3 px-3 font-mono text-xs" dir="ltr">{req.endDate}</td>
                      <td className="py-3 px-3 font-bold">{req.totalDays}</td>
                      <td className="py-3 px-3">
                        {req.affectsSalary
                          ? <span className="text-rose-500 font-bold">نعم</span>
                          : <span className="text-slate-400">لا</span>}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {req.approvalChain.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            req.approvalChain.map((step, i) => {
                              const stepCfg = STATUS_CONFIG[step.status];
                              return (
                                <span
                                  key={i}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                    ${step.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                      step.status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                                  title={`مستوى ${step.level} — ${stepCfg.label}`}
                                >
                                  {step.level}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
