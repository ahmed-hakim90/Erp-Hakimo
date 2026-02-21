import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Badge } from '@/components/UI';
import { usePermission } from '@/utils/permissions';
import { useAppStore } from '@/store/useAppStore';
import { leaveRequestService, leaveBalanceService } from '../leaveService';
import { loanService } from '../loanService';
import {
  processApprovalAction,
  canApproverAct,
  deriveFinalStatus,
} from '../approvalEngine';
import type {
  FirestoreLeaveRequest,
  FirestoreEmployeeLoan,
  ApprovalChainItem,
  ApprovalRequestType,
  ApprovalStatus,
} from '../types';
import { LEAVE_TYPE_LABELS } from '../types';

// ─── Unified approval request wrapper ───────────────────────────────────────

interface UnifiedRequest {
  id: string;
  type: ApprovalRequestType;
  employeeId: string;
  summary: string;
  detail: string;
  approvalChain: ApprovalChainItem[];
  finalStatus: ApprovalStatus;
  createdAt: any;
}

function leaveToUnified(req: FirestoreLeaveRequest): UnifiedRequest {
  return {
    id: req.id!,
    type: 'leave',
    employeeId: req.employeeId,
    summary: `إجازة ${LEAVE_TYPE_LABELS[req.leaveType]}`,
    detail: `${req.startDate} → ${req.endDate} (${req.totalDays} يوم)`,
    approvalChain: req.approvalChain,
    finalStatus: req.finalStatus,
    createdAt: req.createdAt,
  };
}

function loanToUnified(loan: FirestoreEmployeeLoan): UnifiedRequest {
  return {
    id: loan.id!,
    type: 'loan',
    employeeId: loan.employeeId,
    summary: `سلفة ${loan.loanAmount.toLocaleString('ar-EG')}`,
    detail: `${loan.totalInstallments} قسط × ${loan.installmentAmount.toLocaleString('ar-EG')} — بدء: ${loan.startMonth}`,
    approvalChain: loan.approvalChain,
    finalStatus: loan.finalStatus,
    createdAt: loan.createdAt,
  };
}

const TYPE_CONFIG: Record<ApprovalRequestType, { label: string; icon: string; color: string }> = {
  overtime: { label: 'عمل إضافي', icon: 'schedule', color: 'text-purple-500' },
  leave: { label: 'إجازة', icon: 'beach_access', color: 'text-blue-500' },
  loan: { label: 'سلفة', icon: 'payments', color: 'text-amber-500' },
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'قيد الانتظار', variant: 'warning' },
  approved: { label: 'مُعتمد', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export const ApprovalCenter: React.FC = () => {
  const { can } = usePermission();
  const uid = useAppStore((s) => s.uid);
  const currentEmployee = useAppStore((s) => s.currentEmployee);

  const [requests, setRequests] = useState<UnifiedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ApprovalRequestType | ''>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});

  const isHR = can('approval.manage');
  const approverEmployeeId = currentEmployee?.id || uid || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leaveReqs, loanReqs] = await Promise.all([
        leaveRequestService.getAll(),
        loanService.getAll(),
      ]);

      const unified: UnifiedRequest[] = [
        ...leaveReqs.map(leaveToUnified),
        ...loanReqs.map(loanToUnified),
      ];

      unified.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setRequests(unified);
    } catch (err) {
      console.error('Error loading approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = useCallback(async (
    req: UnifiedRequest,
    action: 'approved' | 'rejected',
  ) => {
    setActionLoading(req.id);
    const notes = actionNotes[req.id] || '';

    try {
      const result = processApprovalAction(req.approvalChain, approverEmployeeId, action, notes);

      if (!result.success) {
        alert(result.error || 'حدث خطأ');
        return;
      }

      if (req.type === 'leave') {
        await leaveRequestService.updateApproval(
          req.id,
          result.updatedChain,
          result.finalStatus,
          result.finalStatus,
        );

        if (result.finalStatus === 'approved') {
          const leaveReq = await leaveRequestService.getById(req.id);
          if (leaveReq) {
            const deductResult = await leaveBalanceService.deductBalance(
              leaveReq.employeeId,
              leaveReq.leaveType,
              leaveReq.totalDays,
            );
            if (!deductResult.success) {
              alert(deductResult.error || 'رصيد إجازات غير كافٍ');
            }
          }
        }
      } else if (req.type === 'loan') {
        await loanService.updateApproval(req.id, result.updatedChain, result.finalStatus);
      }

      setActionNotes((prev) => ({ ...prev, [req.id]: '' }));
      await fetchData();
    } catch (err) {
      console.error('Approval action error:', err);
    } finally {
      setActionLoading(null);
    }
  }, [approverEmployeeId, actionNotes, fetchData]);

  const filtered = useMemo(() => {
    let result = requests;
    if (filterType) {
      result = result.filter((r) => r.type === filterType);
    }
    return result;
  }, [requests, filterType]);

  const pendingCount = useMemo(() =>
    requests.filter((r) =>
      r.finalStatus === 'pending' && canApproverAct(r.approvalChain, approverEmployeeId)
    ).length
  , [requests, approverEmployeeId]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.finalStatus === 'pending').length,
    approved: requests.filter((r) => r.finalStatus === 'approved').length,
    rejected: requests.filter((r) => r.finalStatus === 'rejected').length,
  }), [requests]);

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
            مركز الموافقات
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            مراجعة واعتماد طلبات الإجازات والسُلف
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="material-icons-round text-amber-500 text-lg">notifications_active</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {pendingCount} طلب بانتظار إجراءك
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-blue-500 text-3xl mb-2 block">inbox</span>
          <p className="text-xs text-slate-400 font-bold mb-1">إجمالي الطلبات</p>
          <p className="text-2xl font-black">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-amber-500 text-3xl mb-2 block">hourglass_top</span>
          <p className="text-xs text-slate-400 font-bold mb-1">قيد الانتظار</p>
          <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-emerald-500 text-3xl mb-2 block">check_circle</span>
          <p className="text-xs text-slate-400 font-bold mb-1">مُعتمد</p>
          <p className="text-2xl font-black text-emerald-600">{stats.approved}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <span className="material-icons-round text-rose-500 text-3xl mb-2 block">cancel</span>
          <p className="text-xs text-slate-400 font-bold mb-1">مرفوض</p>
          <p className="text-2xl font-black text-rose-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType('')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            filterType === '' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          الكل
        </button>
        {(Object.entries(TYPE_CONFIG) as [ApprovalRequestType, typeof TYPE_CONFIG.leave][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
              filterType === key ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className={`material-icons-round text-sm ${filterType === key ? 'text-white' : cfg.color}`}>
              {cfg.icon}
            </span>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <span className="material-icons-round text-5xl text-slate-300 dark:text-slate-600 mb-3 block">
              task_alt
            </span>
            <p className="text-sm font-bold text-slate-500">لا توجد طلبات</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const typeCfg = TYPE_CONFIG[req.type];
            const statusCfg = STATUS_CONFIG[req.finalStatus];
            const canAct = canApproverAct(req.approvalChain, approverEmployeeId) || isHR;
            const isProcessing = actionLoading === req.id;

            return (
              <div
                key={`${req.type}-${req.id}`}
                className={`bg-white dark:bg-slate-900 rounded-xl border ${
                  canAct && req.finalStatus === 'pending'
                    ? 'border-primary/30 shadow-lg shadow-primary/5'
                    : 'border-slate-200 dark:border-slate-800'
                } overflow-hidden`}
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        req.type === 'leave' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        req.type === 'loan' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-purple-100 dark:bg-purple-900/30'
                      }`}>
                        <span className={`material-icons-round ${typeCfg.color}`}>{typeCfg.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 dark:text-white">{req.summary}</h4>
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className="font-bold">الموظف:</span> {req.employeeId} —{' '}
                          {req.detail}
                        </p>
                      </div>
                    </div>

                    {/* Approval Chain Progress */}
                    <div className="flex items-center gap-1">
                      {req.approvalChain.map((step, i) => {
                        const stepStatus = STATUS_CONFIG[step.status];
                        return (
                          <React.Fragment key={i}>
                            {i > 0 && (
                              <div className={`w-4 h-0.5 ${
                                step.status === 'approved' ? 'bg-emerald-400' :
                                step.status === 'rejected' ? 'bg-rose-400' :
                                'bg-slate-200 dark:bg-slate-700'
                              }`} />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                step.status === 'approved' ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                step.status === 'rejected' ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                'border-slate-200 dark:border-slate-600 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                              title={`مستوى ${step.level} — ${stepStatus.label}${step.notes ? ` — ${step.notes}` : ''}`}
                            >
                              {step.status === 'approved' ? (
                                <span className="material-icons-round text-sm">check</span>
                              ) : step.status === 'rejected' ? (
                                <span className="material-icons-round text-sm">close</span>
                              ) : (
                                step.level
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {req.approvalChain.length === 0 && (
                        <span className="text-xs text-slate-400">بدون سلسلة موافقات</span>
                      )}
                    </div>
                  </div>

                  {/* Action area for current approver */}
                  {canAct && req.finalStatus === 'pending' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          placeholder="ملاحظات (اختياري)..."
                          value={actionNotes[req.id] || ''}
                          onChange={(e) => setActionNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleAction(req, 'rejected')}
                            disabled={isProcessing}
                            className="!border-rose-200 !text-rose-600 hover:!bg-rose-50 dark:!border-rose-800 dark:!text-rose-400"
                          >
                            {isProcessing && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                            <span className="material-icons-round text-sm">close</span>
                            رفض
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleAction(req, 'approved')}
                            disabled={isProcessing}
                          >
                            {isProcessing && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                            <span className="material-icons-round text-sm">check</span>
                            اعتماد
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
