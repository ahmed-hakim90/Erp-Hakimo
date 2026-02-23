import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Card, Badge, LoadingSkeleton } from '../components/UI';
import { WorkOrderPrint } from '../components/ProductionReportPrint';
import type { WorkOrderPrintData } from '../components/ProductionReportPrint';
import { useAppStore, useShallowStore } from '../store/useAppStore';
import {
  formatNumber,
  formatCurrency,
  calculateWasteRatio,
  calculatePlanProgress,
  getTodayDateString,
  countUniqueDays,
} from '../utils/calculations';
import { reportService } from '../services/reportService';
import { usePermission } from '../utils/permissions';
import type { ProductionReport, WorkOrder } from '../types';

type Period = 'daily' | 'weekly' | 'monthly';

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const end = getTodayDateString();

  if (period === 'daily') {
    return { start: end, end };
  }

  if (period === 'weekly') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const y = weekAgo.getFullYear();
    const m = String(weekAgo.getMonth() + 1).padStart(2, '0');
    const d = String(weekAgo.getDate()).padStart(2, '0');
    return { start: `${y}-${m}-${d}`, end };
  }

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { start: `${y}-${m}-01`, end };
}

// ─── Period Filter ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
];

const DashboardPeriodFilter: React.FC<{
  period: Period;
  onChange: (p: Period) => void;
}> = ({ period, onChange }) => (
  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
    {PERIOD_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          period === opt.value
            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ─── Employee Dashboard ────────────────────────────────────────────────────

export const EmployeeDashboard: React.FC = () => {
  const {
    uid,
    _rawEmployees,
    _rawProducts,
    _rawLines,
    productionPlans,
    planReports,
    todayReports,
    monthlyReports,
    workOrders,
    updateWorkOrder,
    loading,
  } = useShallowStore((s) => ({
    uid: s.uid,
    _rawEmployees: s._rawEmployees,
    _rawProducts: s._rawProducts,
    _rawLines: s._rawLines,
    productionPlans: s.productionPlans,
    planReports: s.planReports,
    todayReports: s.todayReports,
    monthlyReports: s.monthlyReports,
    workOrders: s.workOrders,
    updateWorkOrder: s.updateWorkOrder,
    loading: s.loading,
  }));

  const { can } = usePermission();
  const printTemplate = useAppStore((s) => s.systemSettings.printTemplate);

  const [period, setPeriod] = useState<Period>('daily');
  const [periodReports, setPeriodReports] = useState<ProductionReport[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);

  const [woPrintData, setWoPrintData] = useState<WorkOrderPrintData | null>(null);
  const woPrintRef = useRef<HTMLDivElement>(null);
  const handleWoPrint = useReactToPrint({ contentRef: woPrintRef });

  const STATUS_LABELS: Record<string, string> = { pending: 'قيد الانتظار', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' };

  const triggerWOPrint = useCallback(async (wo: WorkOrder) => {
    const product = _rawProducts.find((p) => p.id === wo.productId);
    const line = _rawLines.find((l) => l.id === wo.lineId);
    const supervisor = _rawEmployees.find((e) => e.id === wo.supervisorId);
    setWoPrintData({
      workOrderNumber: wo.workOrderNumber,
      productName: product?.name ?? '—',
      lineName: line?.name ?? '—',
      supervisorName: supervisor?.name ?? '—',
      quantity: wo.quantity,
      producedQuantity: wo.producedQuantity,
      maxWorkers: wo.maxWorkers,
      targetDate: wo.targetDate,
      status: wo.status,
      statusLabel: STATUS_LABELS[wo.status] || wo.status,
      estimatedCost: wo.estimatedCost,
      actualCost: wo.actualCost,
      notes: wo.notes,
      showCosts: can('workOrders.viewCost'),
    });
    await new Promise((r) => setTimeout(r, 300));
    handleWoPrint();
    setTimeout(() => setWoPrintData(null), 1000);
  }, [_rawProducts, _rawLines, _rawEmployees, can, handleWoPrint]);

  const employee = useMemo(
    () => _rawEmployees.find((s) => s.userId === uid),
    [_rawEmployees, uid]
  );

  useEffect(() => {
    if (!employee?.id) return;

    if (period === 'daily') {
      setPeriodReports(todayReports.filter((r) => r.employeeId === employee.id));
      return;
    }

    if (period === 'monthly') {
      setPeriodReports(monthlyReports.filter((r) => r.employeeId === employee.id));
      return;
    }

    let cancelled = false;
    setPeriodLoading(true);
    const { start, end } = getDateRange('weekly');
    reportService.getByDateRange(start, end).then((reports) => {
      if (!cancelled) {
        setPeriodReports(reports.filter((r) => r.employeeId === employee.id));
        setPeriodLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setPeriodLoading(false);
    });
    return () => { cancelled = true; };
  }, [period, employee?.id, todayReports, monthlyReports]);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalProduction = periodReports.reduce(
      (sum, r) => sum + (r.quantityProduced || 0), 0
    );
    const totalWaste = periodReports.reduce(
      (sum, r) => sum + (r.quantityWaste || 0), 0
    );
    const wasteRatio = calculateWasteRatio(totalWaste, totalProduction + totalWaste);

    const employeeLineIds = [...new Set(periodReports.map((r) => r.lineId))];
    const activePlans = productionPlans.filter(
      (p) =>
        (p.status === 'in_progress' || p.status === 'planned') &&
        employeeLineIds.includes(p.lineId)
    );

    let totalPlannedQty = 0;
    let totalActualProduced = 0;
    activePlans.forEach((plan) => {
      totalPlannedQty += plan.plannedQuantity;
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
      totalActualProduced += merged.reduce(
        (sum, r) => sum + (r.quantityProduced || 0), 0
      );
    });

    const planAchievement = totalPlannedQty > 0
      ? Math.min(Math.round((totalActualProduced / totalPlannedQty) * 100), 100)
      : 0;
    const remaining = Math.max(totalPlannedQty - totalActualProduced, 0);

    const uniqueDays = countUniqueDays(periodReports);
    const avgPerDay = uniqueDays > 0 ? Math.round(totalProduction / uniqueDays) : totalProduction;

    return {
      totalProduction,
      totalWaste,
      wasteRatio,
      planAchievement,
      remaining,
      avgPerDay,
      uniqueDays,
    };
  }, [periodReports, productionPlans, planReports, todayReports]);

  // ── Active Plan Card ──────────────────────────────────────────────────────

  const activePlan = useMemo(() => {
    if (!employee?.id) return null;

    const employeeLineIds = [...new Set(
      [...todayReports, ...monthlyReports]
        .filter((r) => r.employeeId === employee.id)
        .map((r) => r.lineId)
    )];

    const plan = productionPlans.find(
      (p) =>
        (p.status === 'in_progress' || p.status === 'planned') &&
        employeeLineIds.includes(p.lineId)
    );

    if (!plan) return null;

    const product = _rawProducts.find((p) => p.id === plan.productId);
    const line = _rawLines.find((l) => l.id === plan.lineId);

    const key = `${plan.lineId}_${plan.productId}`;
    const historical = planReports[key] || [];
    const todayForPlan = todayReports.filter(
      (r) => r.lineId === plan.lineId && r.productId === plan.productId
    );
    const historicalIds = new Set(historical.map((r) => r.id));
    const mergedAll = [
      ...historical,
      ...todayForPlan.filter((r) => !historicalIds.has(r.id)),
    ];
    const globalProduced = mergedAll.reduce(
      (sum, r) => sum + (r.quantityProduced || 0), 0
    );

    const periodProduced = periodReports
      .filter((r) => r.productId === plan.productId && r.lineId === plan.lineId)
      .reduce((sum, r) => sum + (r.quantityProduced || 0), 0);

    const globalRemaining = Math.max(plan.plannedQuantity - globalProduced, 0);
    const progress = calculatePlanProgress(globalProduced, plan.plannedQuantity);

    return {
      productName: product?.name ?? '—',
      lineName: line?.name ?? '—',
      plannedQuantity: plan.plannedQuantity,
      periodProduced,
      globalProduced,
      globalRemaining,
      progress,
      status: plan.status,
    };
  }, [employee?.id, productionPlans, planReports, todayReports, monthlyReports, periodReports, _rawProducts, _rawLines]);

  // ── Personal Performance ──────────────────────────────────────────────────

  const performance = useMemo(() => {
    const totalHours = periodReports.reduce(
      (sum, r) => sum + (r.workHours || 0), 0
    );
    const totalProduced = periodReports.reduce(
      (sum, r) => sum + (r.quantityProduced || 0), 0
    );
    const avgPerHour = totalHours > 0 ? Number((totalProduced / totalHours).toFixed(1)) : 0;

    return {
      reportsCount: periodReports.length,
      avgPerHour,
      totalHours,
    };
  }, [periodReports]);

  // ── Alerts ────────────────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const result: { type: 'warning' | 'danger'; message: string; icon: string }[] = [];

    if (activePlan && activePlan.progress < 50 && activePlan.globalRemaining > 0) {
      result.push({
        type: 'warning',
        message: `الخطة متأخرة — تم إنجاز ${activePlan.progress}% فقط. المتبقي: ${formatNumber(activePlan.globalRemaining)} وحدة`,
        icon: 'schedule',
      });
    }

    if (kpis.wasteRatio > 5) {
      result.push({
        type: 'danger',
        message: `نسبة الهالك مرتفعة: ${kpis.wasteRatio}% — يرجى مراجعة جودة الإنتاج`,
        icon: 'warning',
      });
    }

    return result;
  }, [activePlan, kpis]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">لوحة الموظف</h2>
        <LoadingSkeleton type="card" rows={6} />
      </div>
    );
  }

  const periodLabel = period === 'daily' ? 'اليوم' : period === 'weekly' ? 'هذا الأسبوع' : 'هذا الشهر';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">
            لوحة الموظف
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
            {employee?.name ? `مرحباً ${employee.name}` : 'متابعة الأداء التشغيلي'}
          </p>
        </div>
        <DashboardPeriodFilter period={period} onChange={setPeriod} />
      </div>

      {periodLoading ? (
        <LoadingSkeleton type="card" rows={4} />
      ) : (
        <>
          {/* ── KPI Cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Total Production */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-icons-round text-2xl">inventory</span>
                </div>
                <p className="text-slate-500 text-sm font-bold">إجمالي الإنتاج ({periodLabel})</p>
              </div>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatNumber(kpis.totalProduction)}</h3>
              <span className="text-xs font-medium text-slate-400">وحدة</span>
            </div>

            {/* Plan Achievement */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  kpis.planAchievement >= 80
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : kpis.planAchievement >= 50
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                }`}>
                  <span className="material-icons-round text-2xl">flag</span>
                </div>
                <p className="text-slate-500 text-sm font-bold">تحقيق الخطة</p>
              </div>
              <h3 className={`text-2xl font-black ${
                kpis.planAchievement >= 80 ? 'text-emerald-600' : kpis.planAchievement >= 50 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {kpis.planAchievement > 0 ? `${kpis.planAchievement}%` : '—'}
              </h3>
              <span className="text-xs font-medium text-slate-400">المتبقي: {formatNumber(kpis.remaining)} وحدة</span>
            </div>

            {/* Waste % */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  kpis.wasteRatio <= 3
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : kpis.wasteRatio <= 5
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                }`}>
                  <span className="material-icons-round text-2xl">delete_sweep</span>
                </div>
                <p className="text-slate-500 text-sm font-bold">نسبة الهالك</p>
              </div>
              <h3 className={`text-2xl font-black ${
                kpis.wasteRatio <= 3 ? 'text-emerald-600' : kpis.wasteRatio <= 5 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {kpis.wasteRatio}%
              </h3>
              <span className="text-xs font-medium text-slate-400">{formatNumber(kpis.totalWaste)} وحدة هالك</span>
            </div>

            {/* Average per day — weekly/monthly only */}
            {period !== 'daily' && (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-2xl">speed</span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold">متوسط الإنتاج اليومي</p>
                </div>
                <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{formatNumber(kpis.avgPerDay)}</h3>
                <span className="text-xs font-medium text-slate-400">وحدة/يوم ({kpis.uniqueDays} يوم عمل)</span>
              </div>
            )}
          </div>

          {/* ── Main Grid: Plan + Performance | Alerts ────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Active Plan Card */}
              {activePlan ? (
                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="material-icons-round text-primary">event_note</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">الخطة النشطة الحالية</h3>
                      <Badge variant={activePlan.status === 'in_progress' ? 'warning' : 'info'}>
                        {activePlan.status === 'in_progress' ? 'قيد التنفيذ' : 'مخطط'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 mb-1">المنتج</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{activePlan.productName}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 mb-1">الكمية المخططة</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-200">{formatNumber(activePlan.plannedQuantity)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 mb-1">المُنتَج ({periodLabel})</p>
                      <p className="text-sm font-black text-blue-600">{formatNumber(activePlan.periodProduced)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 mb-1">المتبقي (إجمالي)</p>
                      <p className="text-sm font-black text-amber-600">{formatNumber(activePlan.globalRemaining)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">التقدم الإجمالي</span>
                      <span className={
                        activePlan.progress >= 80 ? 'text-emerald-600' : activePlan.progress >= 50 ? 'text-blue-600' : 'text-amber-600'
                      }>{activePlan.progress}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          activePlan.progress >= 80 ? 'bg-emerald-500' : activePlan.progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(activePlan.progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium text-center">
                      {formatNumber(activePlan.globalProduced)} من {formatNumber(activePlan.plannedQuantity)} وحدة
                    </p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="text-center py-6 text-slate-400">
                    <span className="material-icons-round text-4xl mb-2 block opacity-30">event_note</span>
                    <p className="font-bold">لا توجد خطة إنتاج نشطة حالياً</p>
                    <p className="text-sm mt-1">تواصل مع موظف الصالة لإنشاء خطة جديدة</p>
                  </div>
                </Card>
              )}

              {/* Personal Performance */}
              <Card>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                    <span className="material-icons-round text-emerald-600 dark:text-emerald-400">person</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">الأداء الشخصي</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{periodLabel}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">عدد التقارير</p>
                    <h3 className="text-2xl font-black text-primary">{performance.reportsCount}</h3>
                    <span className="text-[10px] font-medium text-slate-400">تقرير</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">متوسط الإنتاج/ساعة</p>
                    <h3 className="text-2xl font-black text-blue-600">{formatNumber(performance.avgPerHour)}</h3>
                    <span className="text-[10px] font-medium text-slate-400">وحدة/ساعة</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">إجمالي ساعات العمل</p>
                    <h3 className="text-2xl font-black text-emerald-600">{performance.totalHours}</h3>
                    <span className="text-[10px] font-medium text-slate-400">ساعة</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar: Alerts + Quick Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                    <span className="material-icons-round text-amber-600 dark:text-amber-400">notifications</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">تنبيهات</h3>
                </div>

                {alerts.length === 0 ? (
                  <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                    <span className="material-icons-round text-emerald-500 text-lg mt-0.5">check_circle</span>
                    <div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">كل شيء على ما يرام</p>
                      <p className="text-xs text-slate-500 dark:text-emerald-200/60 mt-0.5">لا توجد تنبيهات حالياً. استمر في العمل الجيد!</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-4 rounded-xl border ${
                          alert.type === 'danger'
                            ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20'
                            : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20'
                        }`}
                      >
                        <span className={`material-icons-round text-lg mt-0.5 ${
                          alert.type === 'danger' ? 'text-rose-500' : 'text-amber-500'
                        }`}>{alert.icon}</span>
                        <p className={`text-xs leading-relaxed font-medium ${
                          alert.type === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
                        }`}>{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Stats */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">ملخص سريع</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">التقارير المرسلة</span>
                    <span className="text-sm font-black text-primary">{performance.reportsCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">إجمالي الإنتاج</span>
                    <span className="text-sm font-black text-blue-600">{formatNumber(kpis.totalProduction)} وحدة</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">الهالك</span>
                    <span className={`text-sm font-black ${kpis.wasteRatio > 5 ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}`}>
                      {formatNumber(kpis.totalWaste)} وحدة ({kpis.wasteRatio}%)
                    </span>
                  </div>
                  {activePlan && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">تقدم الخطة</span>
                      <span className={`text-sm font-black ${
                        activePlan.progress >= 80 ? 'text-emerald-600' : 'text-amber-600'
                      }`}>{activePlan.progress}%</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ── Supervisor Work Orders ─────────────────────────────────────── */}
      {employee && employee.level === 2 && can('workOrders.view') && (() => {
        const myWOs = workOrders.filter(
          (w) => w.supervisorId === employee.id && (w.status === 'pending' || w.status === 'in_progress'),
        );
        if (myWOs.length === 0) return null;
        return (
          <Card className="!p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span className="material-icons-round text-primary">assignment</span>
              <h3 className="text-lg font-bold">أوامر الشغل</h3>
              <Badge variant="warning">{myWOs.length}</Badge>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {myWOs.map((wo) => {
                const product = _rawProducts.find((p) => p.id === wo.productId);
                const line = _rawLines.find((l) => l.id === wo.lineId);
                const prog = wo.quantity > 0 ? Math.min((wo.producedQuantity / wo.quantity) * 100, 100) : 0;
                return (
                  <div key={wo.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-primary">{wo.workOrderNumber}</span>
                        <Badge variant={wo.status === 'in_progress' ? 'warning' : 'info'}>
                          {wo.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار'}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{product?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">
                        {line?.name ?? '—'} · {wo.maxWorkers} عامل كحد أقصى · التسليم: {wo.targetDate}
                      </p>
                    </div>
                    <div className="sm:w-48 space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">{formatNumber(wo.producedQuantity)} / {formatNumber(wo.quantity)}</span>
                        <span className="text-primary">{prog.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${prog >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${prog}%` }} />
                      </div>
                    </div>
                    {can('workOrders.viewCost') && (
                      <div className="sm:w-28 text-left">
                        <p className="text-[10px] text-slate-400 font-bold">التكلفة</p>
                        <p className="text-sm font-bold">{formatCurrency(wo.actualCost)}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      {can('print') && (
                        <button
                          onClick={() => triggerWOPrint(wo)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
                          title="طباعة"
                        >
                          <span className="material-icons-round text-base">print</span>
                        </button>
                      )}
                      {can('workOrders.edit') && wo.status === 'pending' && (
                        <button
                          onClick={() => updateWorkOrder(wo.id!, { status: 'in_progress' })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs font-bold transition-colors"
                          title="بدء التنفيذ"
                        >
                          <span className="material-icons-round text-base">play_arrow</span>
                          بدء
                        </button>
                      )}
                      {can('workOrders.edit') && wo.status === 'in_progress' && (
                        <button
                          onClick={() => updateWorkOrder(wo.id!, { status: 'completed', completedAt: new Date().toISOString() })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-xs font-bold transition-colors"
                          title="اكتمل"
                        >
                          <span className="material-icons-round text-base">check_circle</span>
                          اكتمل
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Hidden print component */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <WorkOrderPrint ref={woPrintRef} data={woPrintData} printSettings={printTemplate} />
      </div>
    </div>
  );
};
