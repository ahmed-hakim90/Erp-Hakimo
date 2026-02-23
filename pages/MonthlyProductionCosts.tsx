import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, Badge, Button, KPIBox } from '../components/UI';
import { useShallowStore } from '../store/useAppStore';
import { usePermission } from '../utils/permissions';
import { monthlyProductionCostService } from '../services/monthlyProductionCostService';
import { getCurrentMonth, formatCost } from '../utils/costCalculations';
import type { MonthlyProductionCost } from '../types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const MonthlyProductionCosts: React.FC = () => {
  const {
    products,
    costCenters,
    costCenterValues,
    costAllocations,
    laborSettings,
  } = useShallowStore((s) => ({
    products: s.products,
    costCenters: s.costCenters,
    costCenterValues: s.costCenterValues,
    costAllocations: s.costAllocations,
    laborSettings: s.laborSettings,
  }));

  const { can } = usePermission();
  const canManage = can('costs.manage');
  const canClose = can('costs.closePeriod');

  const [month, setMonth] = useState(getCurrentMonth());
  const [records, setRecords] = useState<MonthlyProductionCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [closingMonth, setClosingMonth] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await monthlyProductionCostService.getByMonth(month);
      if (mountedRef.current) setRecords(data);
    } catch {
      // silently fail
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const productNameMap = new Map(products.map((p) => [p.id, p.name]));
  const productCodeMap = new Map(products.map((p) => [p.id, p.code || '']));

  const handleCalculateAll = async () => {
    if (!laborSettings) return;
    setCalculating(true);
    try {
      const productIds = products.map((p) => p.id).filter(Boolean) as string[];
      await monthlyProductionCostService.calculateAll(
        productIds,
        month,
        laborSettings.hourlyRate,
        costCenters,
        costCenterValues,
        costAllocations
      );
      await fetchRecords();
    } catch {
      // error handled silently
    } finally {
      if (mountedRef.current) setCalculating(false);
    }
  };

  const handleCloseMonth = async () => {
    setClosingMonth(true);
    try {
      const productIds = records.map((r) => r.productId);
      await monthlyProductionCostService.closeMonthForAll(productIds, month);
      await fetchRecords();
    } catch {
      // error handled silently
    } finally {
      if (mountedRef.current) {
        setClosingMonth(false);
        setConfirmClose(false);
      }
    }
  };

  const allClosed = records.length > 0 && records.every((r) => r.isClosed);
  const totalQty = records.reduce((s, r) => s + r.totalProducedQty, 0);
  const totalCost = records.reduce((s, r) => s + r.totalProductionCost, 0);
  const overallAvg = totalQty > 0 ? totalCost / totalQty : 0;

  const handleExport = () => {
    const rows = records.map((r) => ({
      'كود المنتج': productCodeMap.get(r.productId) || '',
      'اسم المنتج': productNameMap.get(r.productId) || r.productId,
      'الشهر': r.month,
      'الكمية المنتجة': r.totalProducedQty,
      'إجمالي التكلفة': r.totalProductionCost,
      'متوسط تكلفة الوحدة': r.averageUnitCost,
      'الحالة': r.isClosed ? 'مغلق' : 'مفتوح',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 30 }, { wch: 12 },
      { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تكلفة الإنتاج الشهرية');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([buf]), `تكلفة-الإنتاج-${month}.xlsx`);
  };

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-icons-round text-white text-2xl">price_check</span>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">تكلفة الإنتاج الشهرية</h2>
            <p className="text-sm text-slate-500 font-medium">حساب ومراجعة تكلفة الإنتاج لكل منتج حسب الشهر</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
          />
          {canManage && (
            <Button onClick={handleCalculateAll} disabled={calculating}>
              <span className="material-icons-round text-[18px] ml-1">calculate</span>
              {calculating ? 'جاري الحساب...' : 'حساب الكل'}
            </Button>
          )}
          {records.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <span className="material-icons-round text-[18px] ml-1">file_download</span>
              تصدير Excel
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIBox
          label="عدد المنتجات"
          value={records.length}
          icon="inventory_2"
          colorClass="bg-primary/10 text-primary"
        />
        <KPIBox
          label="إجمالي الكمية"
          value={formatCost(totalQty)}
          icon="precision_manufacturing"
          colorClass="bg-emerald-500/10 text-emerald-600"
          unit="وحدة"
        />
        <KPIBox
          label="إجمالي التكلفة"
          value={formatCost(totalCost)}
          icon="payments"
          colorClass="bg-amber-500/10 text-amber-600"
          unit="ج.م"
        />
        <KPIBox
          label="متوسط تكلفة الوحدة"
          value={formatCost(overallAvg)}
          icon="price_check"
          colorClass="bg-violet-500/10 text-violet-600"
          unit="ج.م"
        />
      </div>

      {/* Month close banner */}
      {allClosed && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
          <span className="material-icons-round text-emerald-600">lock</span>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            فترة {monthLabel} مُغلقة — لا يمكن إعادة الحساب
          </p>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <span className="material-icons-round text-5xl mb-3 block">price_check</span>
              <p className="font-semibold text-lg">لا توجد بيانات لشهر {monthLabel}</p>
              <p className="text-sm mt-1">اضغط "حساب الكل" لاحتساب التكلفة من تقارير الإنتاج</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 text-right font-bold">#</th>
                  <th className="py-3 px-4 text-right font-bold">كود المنتج</th>
                  <th className="py-3 px-4 text-right font-bold">اسم المنتج</th>
                  <th className="py-3 px-4 text-right font-bold">الكمية المنتجة</th>
                  <th className="py-3 px-4 text-right font-bold">إجمالي التكلفة</th>
                  <th className="py-3 px-4 text-right font-bold">متوسط تكلفة الوحدة</th>
                  <th className="py-3 px-4 text-center font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-400 font-mono">{i + 1}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{productCodeMap.get(r.productId) || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-white">
                      {productNameMap.get(r.productId) || r.productId}
                    </td>
                    <td className="py-3 px-4 font-mono">{formatCost(r.totalProducedQty)}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-amber-700 dark:text-amber-400">
                      {formatCost(r.totalProductionCost)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {formatCost(r.averageUnitCost)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={r.isClosed ? 'success' : 'warning'}>
                        {r.isClosed ? 'مغلق' : 'مفتوح'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 font-bold">
                  <td className="py-3 px-4" colSpan={3}>الإجمالي</td>
                  <td className="py-3 px-4 font-mono">{formatCost(totalQty)}</td>
                  <td className="py-3 px-4 font-mono text-amber-700 dark:text-amber-400">{formatCost(totalCost)}</td>
                  <td className="py-3 px-4 font-mono text-primary">{formatCost(overallAvg)}</td>
                  <td className="py-3 px-4" />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Close month button */}
      {canClose && records.length > 0 && !allClosed && (
        <div className="flex justify-end">
          {!confirmClose ? (
            <Button variant="outline" onClick={() => setConfirmClose(true)}>
              <span className="material-icons-round text-[18px] ml-1">lock</span>
              إغلاق فترة {monthLabel}
            </Button>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <span className="material-icons-round text-red-500">warning</span>
              <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
                سيتم إغلاق الفترة ولن يمكن إعادة الحساب. متأكد؟
              </p>
              <Button onClick={handleCloseMonth} disabled={closingMonth}>
                {closingMonth ? 'جاري الإغلاق...' : 'تأكيد الإغلاق'}
              </Button>
              <Button variant="outline" onClick={() => setConfirmClose(false)}>
                إلغاء
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
