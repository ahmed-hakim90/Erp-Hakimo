import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Badge, Button, LoadingSkeleton } from '../components/UI';
import { useAppStore, useShallowStore } from '../store/useAppStore';
import {
  formatNumber,
  calculateAvgAssemblyTime,
  calculateDailyCapacity,
  calculateEstimatedDays,
  calculatePlanProgress,
} from '../utils/calculations';
import { usePermission } from '../utils/permissions';
import { reportService } from '../services/reportService';
import type { ProductionPlan, ProductionReport } from '../types';

const STATUS_CONFIG: Record<ProductionPlan['status'], { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
  planned: { label: 'مخطط', variant: 'info' },
  in_progress: { label: 'قيد التنفيذ', variant: 'warning' },
  completed: { label: 'مكتمل', variant: 'success' },
  paused: { label: 'متوقف', variant: 'neutral' },
};

export const ProductionPlans: React.FC = () => {
  const [searchParams] = useSearchParams();

  const {
    products, _rawLines, _rawProducts, productionPlans, planReports,
    todayReports, lineProductConfigs, loading, uid,
  } = useShallowStore((s) => ({
    products: s.products,
    _rawLines: s._rawLines,
    _rawProducts: s._rawProducts,
    productionPlans: s.productionPlans,
    planReports: s.planReports,
    todayReports: s.todayReports,
    lineProductConfigs: s.lineProductConfigs,
    loading: s.loading,
    uid: s.uid,
  }));

  const createProductionPlan = useAppStore((s) => s.createProductionPlan);
  const updateProductionPlan = useAppStore((s) => s.updateProductionPlan);
  const deleteProductionPlan = useAppStore((s) => s.deleteProductionPlan);
  const { can } = usePermission();

  const canCreate = can('plans.create');
  const canEdit = can('plans.edit');

  // ── Form state ──
  const [formProductId, setFormProductId] = useState(searchParams.get('productId') || '');
  const [formLineId, setFormLineId] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(Number(searchParams.get('quantity')) || 0);
  const [formStartDate, setFormStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(!!searchParams.get('productId'));

  // ── Edit modal ──
  const [editPlan, setEditPlan] = useState<ProductionPlan | null>(null);
  const [editForm, setEditForm] = useState({ plannedQuantity: 0, startDate: '', lineId: '' });
  const [editSaving, setEditSaving] = useState(false);

  // ── Status modal ──
  const [statusPlan, setStatusPlan] = useState<ProductionPlan | null>(null);
  const [newStatus, setNewStatus] = useState<ProductionPlan['status']>('planned');
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Delete confirm ──
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Reports for calculations ──
  const [productReports, setProductReports] = useState<ProductionReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    if (!formProductId) { setProductReports([]); return; }
    let cancelled = false;
    setReportsLoading(true);
    reportService.getByProduct(formProductId).then((reports) => {
      if (!cancelled) { setProductReports(reports); setReportsLoading(false); }
    }).catch(() => { if (!cancelled) setReportsLoading(false); });
    return () => { cancelled = true; };
  }, [formProductId]);

  // ── Dynamic calculations ──
  const calculations = useMemo(() => {
    if (!formProductId || !formLineId || formQuantity <= 0) return null;

    const line = _rawLines.find((l) => l.id === formLineId);
    if (!line) return null;

    const lineProductReports = productReports.filter((r) => r.lineId === formLineId);
    const reportsForCalc = lineProductReports.length > 0 ? lineProductReports : productReports;

    const config = lineProductConfigs.find(
      (c) => c.productId === formProductId && c.lineId === formLineId
    );
    const avgTime = calculateAvgAssemblyTime(reportsForCalc);
    const effectiveTime = config?.standardAssemblyTime ?? (avgTime > 0 ? avgTime : 0);

    if (effectiveTime <= 0) return { avgAssemblyTime: 0, dailyCapacity: 0, estimatedDays: 0 };

    const dailyCapacity = calculateDailyCapacity(line.maxWorkers, line.dailyWorkingHours, effectiveTime);
    const estimatedDays = calculateEstimatedDays(formQuantity, dailyCapacity);

    return { avgAssemblyTime: effectiveTime, dailyCapacity, estimatedDays };
  }, [formProductId, formLineId, formQuantity, productReports, _rawLines, lineProductConfigs]);

  const handleCreate = async () => {
    if (!formProductId || !formLineId || formQuantity <= 0 || !uid) return;
    setSaving(true);
    await createProductionPlan({
      productId: formProductId,
      lineId: formLineId,
      plannedQuantity: formQuantity,
      startDate: formStartDate,
      status: 'planned',
      createdBy: uid,
    });
    setFormProductId('');
    setFormLineId('');
    setFormQuantity(0);
    setSaving(false);
    setFormOpen(false);
  };

  const handleEdit = async () => {
    if (!editPlan?.id) return;
    setEditSaving(true);
    await updateProductionPlan(editPlan.id, {
      plannedQuantity: editForm.plannedQuantity,
      startDate: editForm.startDate,
      lineId: editForm.lineId,
    });
    setEditSaving(false);
    setEditPlan(null);
  };

  const handleStatusChange = async () => {
    if (!statusPlan?.id) return;
    setStatusSaving(true);
    await updateProductionPlan(statusPlan.id, { status: newStatus });
    setStatusSaving(false);
    setStatusPlan(null);
  };

  const handleDelete = async () => {
    if (!deletePlanId) return;
    setDeleting(true);
    await deleteProductionPlan(deletePlanId);
    setDeleting(false);
    setDeletePlanId(null);
  };

  const getActualProduced = (plan: ProductionPlan): number => {
    const key = `${plan.lineId}_${plan.productId}`;
    const historical = planReports[key] || [];
    const todayForPlan = todayReports.filter(
      (r) => r.lineId === plan.lineId && r.productId === plan.productId
    );
    const historicalIds = new Set(historical.map((r) => r.id));
    const merged = [
      ...historical,
      ...todayForPlan.filter((r) => !historicalIds.has(r.id)),
    ];
    return merged.reduce((sum, r) => sum + (r.quantityProduced || 0), 0);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">خطط الإنتاج</h2>
        <LoadingSkeleton type="table" rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">خطط الإنتاج</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">إدارة وتتبع خطط الإنتاج الرسمية</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => setFormOpen(!formOpen)}>
            <span className="material-icons-round text-sm">{formOpen ? 'close' : 'add'}</span>
            {formOpen ? 'إغلاق' : 'خطة جديدة'}
          </Button>
        )}
      </div>

      {/* ── Section 1: Create New Plan Form ── */}
      {canCreate && formOpen && (
        <Card className="border-primary/20 shadow-lg shadow-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-icons-round text-primary">add_task</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">إنشاء خطة إنتاج جديدة</h3>
              <p className="text-xs text-slate-400 font-medium">حدد المنتج والخط والكمية لحساب التقديرات تلقائياً</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">المنتج *</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                value={formProductId}
                onChange={(e) => setFormProductId(e.target.value)}
              >
                <option value="">اختر المنتج...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">خط الإنتاج *</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                value={formLineId}
                onChange={(e) => setFormLineId(e.target.value)}
              >
                <option value="">اختر الخط...</option>
                {_rawLines.map((l) => (
                  <option key={l.id} value={l.id!}>{l.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">الكمية المخططة *</label>
              <input
                type="number"
                min={1}
                className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                value={formQuantity || ''}
                onChange={(e) => setFormQuantity(Number(e.target.value))}
                placeholder="مثال: 1000"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">تاريخ البدء *</label>
              <input
                type="date"
                className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>
          </div>

          {/* Live calculations */}
          <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            {reportsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
                <span className="material-icons-round animate-spin text-lg">refresh</span>
                <span className="text-sm font-bold">جاري حساب التقديرات...</span>
              </div>
            ) : calculations ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] font-bold text-slate-400 mb-1">متوسط وقت التجميع</p>
                  <p className="text-lg font-black text-primary">
                    {calculations.avgAssemblyTime > 0 ? `${calculations.avgAssemblyTime} دقيقة/وحدة` : 'لا توجد بيانات'}
                  </p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] font-bold text-slate-400 mb-1">الطاقة اليومية للخط</p>
                  <p className="text-lg font-black text-blue-600">
                    {calculations.dailyCapacity > 0 ? `${formatNumber(calculations.dailyCapacity)} وحدة` : '—'}
                  </p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] font-bold text-slate-400 mb-1">الأيام المقدرة للإنجاز</p>
                  <p className="text-lg font-black text-emerald-600">
                    {calculations.estimatedDays > 0 ? `${calculations.estimatedDays} يوم` : '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-3">
                <span className="material-icons-round text-2xl mb-1 block opacity-40">calculate</span>
                <p className="text-xs font-bold">اختر المنتج والخط وأدخل الكمية لعرض التقديرات</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={saving || !formProductId || !formLineId || formQuantity <= 0}
            >
              {saving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
              <span className="material-icons-round text-sm">add_task</span>
              إنشاء خطة
            </Button>
          </div>
        </Card>
      )}

      {/* ── Section 2: Plans Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center shrink-0">
            <span className="material-icons-round text-blue-600 dark:text-blue-400">list_alt</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">جميع الخطط</h3>
            <p className="text-[11px] text-slate-400 font-medium">{productionPlans.length} خطة مسجلة</p>
          </div>
        </div>

        {productionPlans.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <span className="material-icons-round text-5xl mb-3 block opacity-30">event_note</span>
            <p className="font-bold text-base">لا توجد خطط إنتاج بعد</p>
            <p className="text-sm mt-1">ابدأ بإنشاء خطة جديدة لتتبع الإنتاج</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em]">المنتج</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em]">الخط</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-center">الكمية المخططة</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-center">تاريخ البدء</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-center">الحالة</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-center">التقدم</th>
                  <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-center">المتبقي</th>
                  {(canEdit || can('roles.manage')) && (
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-[0.15em] text-center">إجراءات</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productionPlans.map((plan) => {
                  const product = _rawProducts.find((p) => p.id === plan.productId);
                  const line = _rawLines.find((l) => l.id === plan.lineId);
                  const actualProduced = getActualProduced(plan);
                  const progress = calculatePlanProgress(actualProduced, plan.plannedQuantity);
                  const remaining = Math.max(plan.plannedQuantity - actualProduced, 0);
                  const statusInfo = STATUS_CONFIG[plan.status];

                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{product?.name ?? '—'}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{product?.code}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-600 dark:text-slate-400">{line?.name ?? '—'}</td>
                      <td className="px-4 py-3.5 text-center text-sm font-black text-slate-700 dark:text-slate-300">{formatNumber(plan.plannedQuantity)}</td>
                      <td className="px-4 py-3.5 text-center text-sm font-medium text-slate-500">{plan.startDate}</td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-sm font-black ${progress >= 100 ? 'text-emerald-600' : progress >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                            {progress}%
                          </span>
                          <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">{formatNumber(actualProduced)} / {formatNumber(plan.plannedQuantity)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center text-sm font-bold text-slate-500">{formatNumber(remaining)}</td>
                      {(canEdit || can('roles.manage')) && (
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditPlan(plan);
                                    setEditForm({
                                      plannedQuantity: plan.plannedQuantity,
                                      startDate: plan.startDate,
                                      lineId: plan.lineId,
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                  title="تعديل"
                                >
                                  <span className="material-icons-round text-sm">edit</span>
                                </button>
                                <button
                                  onClick={() => { setStatusPlan(plan); setNewStatus(plan.status); }}
                                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-lg transition-all"
                                  title="تغيير الحالة"
                                >
                                  <span className="material-icons-round text-sm">swap_horiz</span>
                                </button>
                              </>
                            )}
                            {can('roles.manage') && (
                              <button
                                onClick={() => setDeletePlanId(plan.id!)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-all"
                                title="حذف"
                              >
                                <span className="material-icons-round text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editPlan && canEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditPlan(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold">تعديل الخطة</h3>
              <button onClick={() => setEditPlan(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">خط الإنتاج</label>
                <select
                  className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                  value={editForm.lineId}
                  onChange={(e) => setEditForm({ ...editForm, lineId: e.target.value })}
                >
                  {_rawLines.map((l) => (
                    <option key={l.id} value={l.id!}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">الكمية المخططة</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                  value={editForm.plannedQuantity || ''}
                  onChange={(e) => setEditForm({ ...editForm, plannedQuantity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400">تاريخ البدء</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:border-primary focus:ring-primary/20 p-3.5 outline-none font-medium transition-all"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setEditPlan(null)}>إلغاء</Button>
              <Button variant="primary" onClick={handleEdit} disabled={editSaving || editForm.plannedQuantity <= 0}>
                {editSaving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Change Modal ── */}
      {statusPlan && canEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setStatusPlan(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold">تغيير حالة الخطة</h3>
              <button onClick={() => setStatusPlan(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 font-medium">
                المنتج: <span className="font-bold text-slate-800 dark:text-white">{_rawProducts.find((p) => p.id === statusPlan.productId)?.name}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(STATUS_CONFIG) as [ProductionPlan['status'], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setNewStatus(key)}
                    className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                      newStatus === key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setStatusPlan(null)}>إلغاء</Button>
              <Button variant="primary" onClick={handleStatusChange} disabled={statusSaving || newStatus === statusPlan.status}>
                {statusSaving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                تحديث الحالة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletePlanId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeletePlanId(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto">
                <span className="material-icons-round text-rose-500 text-2xl">delete_forever</span>
              </div>
              <h3 className="text-lg font-bold">حذف الخطة</h3>
              <p className="text-sm text-slate-500">هل أنت متأكد من حذف هذه الخطة؟ لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setDeletePlanId(null)}>إلغاء</Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20"
              >
                {deleting && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                <span className="material-icons-round text-sm">delete</span>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
