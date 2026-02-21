import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Badge, SearchableSelect } from '@/components/UI';
import { usePermission } from '@/utils/permissions';
import { useAppStore } from '@/store/useAppStore';
import { loanService } from '../loanService';
import type {
  FirestoreEmployeeLoan,
  ApprovalStatus,
  LoanStatus,
} from '../types';

// ─── Status helpers ─────────────────────────────────────────────────────────

const APPROVAL_STATUS_CONFIG: Record<ApprovalStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'قيد الانتظار', variant: 'warning' },
  approved: { label: 'مُعتمد', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
};

const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  pending: 'بانتظار الموافقة',
  active: 'نشط',
  closed: 'مُغلق',
};

const LOAN_STATUS_VARIANT: Record<LoanStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  active: 'success',
  closed: 'neutral',
};

function formatCurrency(val: number): string {
  return val.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── Component ──────────────────────────────────────────────────────────────

export const LoanRequests: React.FC = () => {
  const { can } = usePermission();
  const uid = useAppStore((s) => s.uid);
  const currentEmployee = useAppStore((s) => s.currentEmployee);

  const [loans, setLoans] = useState<FirestoreEmployeeLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState<LoanStatus | ''>('');
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formInstallments, setFormInstallments] = useState('');
  const [formStartMonth, setFormStartMonth] = useState('');
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isHR = can('loan.manage');
  const employeeId = currentEmployee?.id || uid || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = isHR
        ? await loanService.getAll()
        : await loanService.getByEmployee(employeeId);
      setLoans(data);
    } catch (err) {
      console.error('Error loading loans:', err);
    } finally {
      setLoading(false);
    }
  }, [employeeId, isHR]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const installmentAmount = useMemo(() => {
    const amount = parseFloat(formAmount) || 0;
    const inst = parseInt(formInstallments) || 1;
    return Math.ceil((amount / inst) * 100) / 100;
  }, [formAmount, formInstallments]);

  const handleSubmit = useCallback(async () => {
    const amount = parseFloat(formAmount);
    const installments = parseInt(formInstallments);
    if (!amount || !installments || !formStartMonth) return;
    setSubmitting(true);
    try {
      await loanService.create({
        employeeId,
        loanAmount: amount,
        installmentAmount,
        totalInstallments: installments,
        remainingInstallments: installments,
        startMonth: formStartMonth,
        status: 'pending',
        approvalChain: [],
        finalStatus: 'pending',
        reason: formReason,
        createdBy: uid || '',
      });
      setShowForm(false);
      setFormAmount('');
      setFormInstallments('');
      setFormStartMonth('');
      setFormReason('');
      await fetchData();
    } catch (err) {
      console.error('Error creating loan:', err);
    } finally {
      setSubmitting(false);
    }
  }, [employeeId, uid, formAmount, formInstallments, formStartMonth, formReason, installmentAmount, fetchData]);

  const filtered = useMemo(() => {
    let result = loans;
    if (filterEmployee) {
      result = result.filter((l) => l.employeeId === filterEmployee);
    }
    if (filterStatus) {
      result = result.filter((l) => l.status === filterStatus);
    }
    return result;
  }, [loans, filterEmployee, filterStatus]);

  const uniqueEmployees = useMemo(() => {
    const ids = [...new Set(loans.map((l) => l.employeeId))];
    return ids.map((id) => ({ value: id, label: id }));
  }, [loans]);

  const stats = useMemo(() => {
    const active = loans.filter((l) => l.status === 'active');
    const totalOutstanding = active.reduce((sum, l) => sum + l.installmentAmount * l.remainingInstallments, 0);
    const totalMonthly = active.reduce((sum, l) => sum + l.installmentAmount, 0);
    return {
      total: loans.length,
      active: active.length,
      totalOutstanding,
      totalMonthly,
    };
  }, [loans]);

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
            إدارة السُلف والقروض
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            طلب سلفة ومتابعة الأقساط والموافقات
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          <span className="material-icons-round text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'إغلاق' : 'طلب سلفة'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-blue-500 text-3xl mb-2 block">receipt_long</span>
          <p className="text-xs text-slate-400 font-bold mb-1">إجمالي الطلبات</p>
          <p className="text-2xl font-black">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-emerald-500 text-3xl mb-2 block">trending_up</span>
          <p className="text-xs text-slate-400 font-bold mb-1">سلف نشطة</p>
          <p className="text-2xl font-black text-emerald-600">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-amber-500 text-3xl mb-2 block">account_balance</span>
          <p className="text-xs text-slate-400 font-bold mb-1">إجمالي المتبقي</p>
          <p className="text-2xl font-black text-amber-600">{formatCurrency(stats.totalOutstanding)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-rose-500 text-3xl mb-2 block">payments</span>
          <p className="text-xs text-slate-400 font-bold mb-1">القسط الشهري</p>
          <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.totalMonthly)}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card title="طلب سلفة جديدة">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                مبلغ السلفة
              </label>
              <input
                type="number"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="100"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                عدد الأقساط
              </label>
              <input
                type="number"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={formInstallments}
                onChange={(e) => setFormInstallments(e.target.value)}
                placeholder="12"
                min="1"
                max="60"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                شهر البداية
              </label>
              <input
                type="month"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={formStartMonth}
                onChange={(e) => setFormStartMonth(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              {installmentAmount > 0 && (
                <div className="bg-primary/10 rounded-xl p-4 w-full text-center">
                  <p className="text-xs text-primary font-bold mb-1">القسط الشهري</p>
                  <p className="text-xl font-black text-primary">{formatCurrency(installmentAmount)}</p>
                </div>
              )}
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
                placeholder="سبب طلب السلفة..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !formAmount || !formInstallments || !formStartMonth}
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
          onChange={(e) => setFilterStatus(e.target.value as LoanStatus | '')}
        >
          <option value="">جميع الحالات</option>
          <option value="pending">بانتظار الموافقة</option>
          <option value="active">نشط</option>
          <option value="closed">مُغلق</option>
        </select>
      </div>

      {/* Loans Table */}
      <Card>
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-icons-round text-5xl text-slate-300 dark:text-slate-600 mb-3 block">
              money_off
            </span>
            <p className="text-sm font-bold text-slate-500">لا توجد سُلف</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-bold">
                  {isHR && <th className="text-right py-3 px-3">الموظف</th>}
                  <th className="text-right py-3 px-3">المبلغ</th>
                  <th className="text-right py-3 px-3">القسط</th>
                  <th className="text-right py-3 px-3">الأقساط</th>
                  <th className="text-right py-3 px-3">المتبقي</th>
                  <th className="text-right py-3 px-3">شهر البداية</th>
                  <th className="text-right py-3 px-3">الحالة</th>
                  <th className="text-right py-3 px-3">الموافقة</th>
                  <th className="text-right py-3 px-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((loan) => {
                  const loanStatusVariant = LOAN_STATUS_VARIANT[loan.status];
                  const approvalCfg = APPROVAL_STATUS_CONFIG[loan.finalStatus];
                  const paidInstallments = loan.totalInstallments - loan.remainingInstallments;
                  const progress = loan.totalInstallments > 0
                    ? Math.round((paidInstallments / loan.totalInstallments) * 100)
                    : 0;
                  const isExpanded = expandedLoan === loan.id;

                  return (
                    <React.Fragment key={loan.id}>
                      <tr className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        {isHR && <td className="py-3 px-3 font-bold">{loan.employeeId}</td>}
                        <td className="py-3 px-3 font-bold">{formatCurrency(loan.loanAmount)}</td>
                        <td className="py-3 px-3">{formatCurrency(loan.installmentAmount)}</td>
                        <td className="py-3 px-3 font-mono text-xs">{loan.totalInstallments}</td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${loan.remainingInstallments === 0 ? 'text-emerald-500' : 'text-amber-600'}`}>
                            {loan.remainingInstallments}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs" dir="ltr">{loan.startMonth}</td>
                        <td className="py-3 px-3">
                          <Badge variant={loanStatusVariant}>{LOAN_STATUS_LABELS[loan.status]}</Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={approvalCfg.variant}>{approvalCfg.label}</Badge>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setExpandedLoan(isExpanded ? null : loan.id!)}
                            className="text-primary hover:text-primary/70 transition-colors"
                          >
                            <span className="material-icons-round text-sm">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={isHR ? 9 : 8} className="p-4 bg-slate-50 dark:bg-slate-800/30">
                            <div className="space-y-3">
                              {/* Progress bar */}
                              <div>
                                <div className="flex items-center justify-between text-xs font-bold mb-1">
                                  <span className="text-slate-500">التقدم في السداد</span>
                                  <span className="text-primary">{progress}%</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                                  <span>مدفوع: {paidInstallments} قسط</span>
                                  <span>متبقي: {loan.remainingInstallments} قسط</span>
                                </div>
                              </div>

                              {/* Installment Schedule Preview */}
                              {loan.status === 'active' && loan.remainingInstallments > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-slate-500 mb-2">جدول الأقساط المتبقية</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[...Array(Math.min(loan.remainingInstallments, 8))].map((_, i) => {
                                      const [y, m] = loan.startMonth.split('-').map(Number);
                                      const monthDate = new Date(y, m - 1 + paidInstallments + i);
                                      const label = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                                      return (
                                        <div key={i} className="bg-white dark:bg-slate-900 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-700">
                                          <p className="text-xs text-slate-400 font-mono" dir="ltr">{label}</p>
                                          <p className="text-sm font-bold">{formatCurrency(loan.installmentAmount)}</p>
                                        </div>
                                      );
                                    })}
                                    {loan.remainingInstallments > 8 && (
                                      <div className="bg-white dark:bg-slate-900 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                                        <p className="text-xs text-slate-400 font-bold">
                                          +{loan.remainingInstallments - 8} أقساط
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {loan.reason && (
                                <div className="text-xs text-slate-500">
                                  <span className="font-bold">السبب: </span>{loan.reason}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
