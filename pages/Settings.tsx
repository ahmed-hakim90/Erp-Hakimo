
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isConfigured } from '../services/firebase';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge, Button } from '../components/UI';
import {
  usePermission,
  useCurrentRole,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  checkPermission,
  type Permission,
} from '../utils/permissions';
import {
  DASHBOARD_WIDGETS,
  DASHBOARD_LABELS,
  KPI_DEFINITIONS,
  DEFAULT_ALERT_SETTINGS,
  DEFAULT_KPI_THRESHOLDS,
  DEFAULT_PRINT_TEMPLATE,
} from '../utils/dashboardConfig';
import { ProductionReportPrint, computePrintTotals } from '../components/ProductionReportPrint';
import {
  backupService,
  validateBackupFile,
  type BackupFile,
  type BackupHistoryEntry,
  type RestoreMode,
} from '../services/backupService';
import type { SystemSettings, WidgetConfig, AlertSettings, KPIThreshold, PrintTemplateSettings, PaperSize, PaperOrientation } from '../types';
import type { ReportPrintRow } from '../components/ProductionReportPrint';

type SettingsTab = 'general' | 'dashboardWidgets' | 'alertRules' | 'kpiThresholds' | 'printTemplate' | 'backup';

const TABS: { key: SettingsTab; label: string; icon: string; adminOnly: boolean }[] = [
  { key: 'general', label: 'عام', icon: 'settings', adminOnly: false },
  { key: 'dashboardWidgets', label: 'إعدادات لوحات التحكم', icon: 'dashboard_customize', adminOnly: true },
  { key: 'alertRules', label: 'قواعد التنبيهات', icon: 'notifications_active', adminOnly: true },
  { key: 'kpiThresholds', label: 'حدود المؤشرات', icon: 'tune', adminOnly: true },
  { key: 'printTemplate', label: 'إعدادات الطباعة', icon: 'print', adminOnly: true },
  { key: 'backup', label: 'النسخ الاحتياطي', icon: 'backup', adminOnly: true },
];

const RESTORE_MODES: { value: RestoreMode; label: string; icon: string; description: string; color: string }[] = [
  { value: 'merge', label: 'دمج', icon: 'merge', description: 'دمج البيانات الجديدة مع البيانات الحالية — لا يتم حذف أي شيء', color: 'emerald' },
  { value: 'replace', label: 'استبدال', icon: 'swap_horiz', description: 'استبدال المجموعات المشمولة فقط — المجموعات الأخرى تبقى', color: 'amber' },
  { value: 'full_reset', label: 'إعادة تعيين كاملة', icon: 'restart_alt', description: 'حذف كل شيء واستبداله بالنسخة الاحتياطية — عملية لا رجعة فيها', color: 'rose' },
];

const SAMPLE_ROWS: ReportPrintRow[] = [
  { date: '2026-02-21', lineName: 'خط 1', productName: 'منتج A', supervisorName: 'أحمد محمد', quantityProduced: 1200, quantityWaste: 35, workersCount: 12, workHours: 8 },
  { date: '2026-02-21', lineName: 'خط 2', productName: 'منتج B', supervisorName: 'سعيد علي', quantityProduced: 950, quantityWaste: 20, workersCount: 10, workHours: 8 },
  { date: '2026-02-21', lineName: 'خط 3', productName: 'منتج C', supervisorName: 'خالد حسن', quantityProduced: 800, quantityWaste: 15, workersCount: 8, workHours: 7.5 },
];

const ALERT_FIELDS: { key: keyof AlertSettings; label: string; icon: string; unit: string; description: string }[] = [
  { key: 'wasteThreshold', label: 'حد الهدر', icon: 'delete_sweep', unit: '%', description: 'نسبة الهدر المقبولة — تنبيه عند تجاوزها' },
  { key: 'costVarianceThreshold', label: 'حد انحراف التكلفة', icon: 'compare_arrows', unit: '%', description: 'نسبة الانحراف المقبولة عن التكلفة المعيارية' },
  { key: 'efficiencyThreshold', label: 'حد الكفاءة', icon: 'speed', unit: '%', description: 'الحد الأدنى المقبول للكفاءة — تنبيه عند الانخفاض' },
  { key: 'planDelayDays', label: 'أيام تأخر الخطة', icon: 'schedule', unit: 'يوم', description: 'عدد الأيام المسموح بتأخرها قبل التنبيه' },
  { key: 'overProductionThreshold', label: 'حد الإنتاج الزائد', icon: 'trending_up', unit: '%', description: 'نسبة تجاوز الهدف المسموحة — تنبيه عند التجاوز' },
];

export const Settings: React.FC = () => {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const products = useAppStore((s) => s.products);
  const productionLines = useAppStore((s) => s.productionLines);
  const supervisors = useAppStore((s) => s.supervisors);
  const roles = useAppStore((s) => s.roles);
  const userPermissions = useAppStore((s) => s.userPermissions);
  const systemSettings = useAppStore((s) => s.systemSettings);
  const updateSystemSettings = useAppStore((s) => s.updateSystemSettings);

  const { can } = usePermission();
  const { roleName, roleColor, isReadOnly } = useCurrentRole();
  const isAdmin = can('roles.manage');

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const enabledCount = Object.values(userPermissions).filter(Boolean).length;

  // ── Local editable copies ──────────────────────────────────────────────────

  const [localWidgets, setLocalWidgets] = useState<Record<string, WidgetConfig[]>>(
    () => JSON.parse(JSON.stringify(systemSettings.dashboardWidgets))
  );
  const [localAlerts, setLocalAlerts] = useState<AlertSettings>(
    () => ({ ...DEFAULT_ALERT_SETTINGS, ...systemSettings.alertSettings })
  );
  const [localKPIs, setLocalKPIs] = useState<Record<string, KPIThreshold>>(
    () => ({ ...DEFAULT_KPI_THRESHOLDS, ...systemSettings.kpiThresholds })
  );
  const [localPrint, setLocalPrint] = useState<PrintTemplateSettings>(
    () => ({ ...DEFAULT_PRINT_TEMPLATE, ...systemSettings.printTemplate })
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Backup state ────────────────────────────────────────────────────────────
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{ step: string; percent: number } | null>(null);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importFile, setImportFile] = useState<BackupFile | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importValidation, setImportValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadBackupHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const history = await backupService.getHistory();
      setBackupHistory(history);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'backup' && isAdmin) {
      loadBackupHistory();
    }
  }, [activeTab, isAdmin, loadBackupHistory]);

  const userEmail = useAppStore((s) => s.userEmail);

  const handleExportFull = useCallback(async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      await backupService.exportFullBackup(userEmail || 'admin');
      setBackupMessage({ type: 'success', text: 'تم تصدير النسخة الاحتياطية الكاملة بنجاح' });
      loadBackupHistory();
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'فشل التصدير' });
    }
    setBackupLoading(false);
  }, [userEmail, loadBackupHistory]);

  const handleExportMonthly = useCallback(async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      await backupService.exportMonthlyBackup(selectedMonth, userEmail || 'admin');
      setBackupMessage({ type: 'success', text: `تم تصدير بيانات شهر ${selectedMonth} بنجاح` });
      loadBackupHistory();
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'فشل التصدير' });
    }
    setBackupLoading(false);
  }, [selectedMonth, userEmail, loadBackupHistory]);

  const handleExportSettings = useCallback(async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      await backupService.exportSettingsOnly(userEmail || 'admin');
      setBackupMessage({ type: 'success', text: 'تم تصدير الإعدادات بنجاح' });
      loadBackupHistory();
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'فشل التصدير' });
    }
    setBackupLoading(false);
  }, [userEmail, loadBackupHistory]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportFile(null);
    setImportValidation(null);
    setBackupMessage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const validation = validateBackupFile(parsed);
        setImportValidation(validation);
        if (validation.valid) {
          setImportFile(parsed as BackupFile);
        }
      } catch {
        setImportValidation({ valid: false, error: 'ملف JSON غير صالح — تأكد من صحة الملف' });
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  }, []);

  const _loadAppData = useAppStore((s) => s._loadAppData);
  const fetchSystemSettings = useAppStore((s) => s.fetchSystemSettings);

  const handleRestore = useCallback(async () => {
    if (!importFile) return;
    setShowConfirmRestore(false);
    setBackupLoading(true);
    setBackupMessage(null);

    const result = await backupService.importBackup(
      importFile,
      restoreMode,
      userEmail || 'admin',
      (step, percent) => setBackupProgress({ step, percent })
    );

    setBackupProgress(null);

    if (result.success) {
      setBackupMessage({
        type: 'success',
        text: `تمت الاستعادة بنجاح — ${result.restored} مستند`,
      });

      try {
        await _loadAppData();
        await fetchSystemSettings();
      } catch { /* ignore */ }

      setImportFile(null);
      setImportFileName('');
      setImportValidation(null);
      loadBackupHistory();
    } else {
      setBackupMessage({ type: 'error', text: result.error || 'فشلت الاستعادة' });
    }

    setBackupLoading(false);
  }, [importFile, restoreMode, userEmail, _loadAppData, fetchSystemSettings, loadBackupHistory]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isConfigured) return;
    setUploadingLogo(true);
    try {
      const fileRef = storageRef(storage, `print_settings/logo_${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setLocalPrint((prev) => ({ ...prev, logoUrl: url }));
    } catch (err) {
      console.error('Logo upload error:', err);
      setSaveMessage('فشل رفع الشعار');
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, []);

  const handleSave = useCallback(async (section: 'widgets' | 'alerts' | 'kpis' | 'print') => {
    setSaving(true);
    setSaveMessage('');
    try {
      const updated: SystemSettings = {
        ...systemSettings,
        dashboardWidgets: section === 'widgets' ? localWidgets : systemSettings.dashboardWidgets,
        alertSettings: section === 'alerts' ? localAlerts : systemSettings.alertSettings,
        kpiThresholds: section === 'kpis' ? localKPIs : systemSettings.kpiThresholds,
        printTemplate: section === 'print' ? localPrint : systemSettings.printTemplate,
      };
      await updateSystemSettings(updated);
      setSaveMessage('تم الحفظ بنجاح');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveMessage('فشل الحفظ');
    }
    setSaving(false);
  }, [systemSettings, localWidgets, localAlerts, localKPIs, localPrint, updateSystemSettings]);

  // ── Widget drag & drop ─────────────────────────────────────────────────────

  const dragItem = useRef<{ dashboardKey: string; index: number } | null>(null);
  const dragOverItem = useRef<{ dashboardKey: string; index: number } | null>(null);

  const handleDragStart = (dashboardKey: string, index: number) => {
    dragItem.current = { dashboardKey, index };
  };

  const handleDragEnter = (dashboardKey: string, index: number) => {
    dragOverItem.current = { dashboardKey, index };
  };

  const handleDragEnd = (dashboardKey: string) => {
    if (
      !dragItem.current ||
      !dragOverItem.current ||
      dragItem.current.dashboardKey !== dashboardKey ||
      dragOverItem.current.dashboardKey !== dashboardKey
    ) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const fromIdx = dragItem.current.index;
    const toIdx = dragOverItem.current.index;
    if (fromIdx === toIdx) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    setLocalWidgets((prev) => {
      const list = [...(prev[dashboardKey] || [])];
      const [removed] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, removed);
      return { ...prev, [dashboardKey]: list };
    });

    dragItem.current = null;
    dragOverItem.current = null;
  };

  const toggleWidget = (dashboardKey: string, widgetId: string) => {
    setLocalWidgets((prev) => {
      const list = (prev[dashboardKey] || []).map((w) =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      );
      return { ...prev, [dashboardKey]: list };
    });
  };

  // ── Visible tabs ───────────────────────────────────────────────────────────

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">الإعدادات</h2>
        <p className="text-sm text-slate-500 font-medium">إعدادات النظام وحالة الاتصال والصلاحيات.</p>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-icons-round text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Save feedback ─────────────────────────────────────────────────── */}
      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${
          saveMessage.includes('نجاح')
            ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
        }`}>
          <span className="material-icons-round text-lg">{saveMessage.includes('نجاح') ? 'check_circle' : 'error'}</span>
          {saveMessage}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: General ──────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'general' && (
        <>
          {/* Current Role Info */}
          <Card title="الدور الحالي والصلاحيات">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-icons-round text-primary text-3xl">shield</span>
              </div>
              <div>
                <p className="text-sm text-slate-400 font-bold mb-1">الدور الحالي</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${roleColor}`}>
                  {roleName}
                </span>
              </div>
              <div className="mr-auto flex items-center gap-2">
                {isReadOnly && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <span className="material-icons-round text-sm">lock</span>
                    قراءة فقط
                  </span>
                )}
                {can("print") && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <span className="material-icons-round text-sm">print</span>
                    طباعة
                  </span>
                )}
                {can("export") && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <span className="material-icons-round text-sm">download</span>
                    تصدير
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.key} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs font-bold text-slate-500 mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.permissions.map((perm) => (
                      <span
                        key={perm.key}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          can(perm.key)
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 line-through'
                        }`}
                      >
                        {perm.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-400 font-bold">
              {enabledCount} / {ALL_PERMISSIONS.length} صلاحية مفعلة
            </div>
          </Card>

          {/* Full Permission Matrix */}
          {can("roles.manage") && roles.length > 0 && (
            <Card title="مصفوفة الصلاحيات الكاملة">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">المورد</th>
                      {roles.map((r) => (
                        <th key={r.id} className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${r.color}`}>
                            {r.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {PERMISSION_GROUPS.map((group) => (
                      <tr key={group.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{group.label}</td>
                        {roles.map((r) => (
                          <td key={r.id} className="px-4 py-3 text-center">
                            <div className="flex flex-wrap justify-center gap-1">
                              {group.permissions.map((perm) => (
                                <span
                                  key={perm.key}
                                  className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                                    checkPermission(r.permissions, perm.key)
                                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                      : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
                                  }`}
                                  title={`${r.name} - ${group.label} - ${perm.label}`}
                                >
                                  {checkPermission(r.permissions, perm.key) ? (
                                    <span className="material-icons-round text-xs">check</span>
                                  ) : (
                                    <span className="material-icons-round text-xs">close</span>
                                  )}
                                </span>
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">
                              {group.permissions
                                .filter((p) => checkPermission(r.permissions, p.key))
                                .map((p) => p.label)
                                .join(' · ') || 'لا يوجد'}
                            </p>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* System Status */}
          <Card title="حالة النظام">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 text-center">
                <span className="material-icons-round text-primary text-3xl mb-2 block">cloud_done</span>
                <p className="text-xs text-slate-400 font-bold mb-1">اتصال Firebase</p>
                <Badge variant={isAuthenticated ? 'success' : 'danger'}>
                  {isAuthenticated ? 'متصل' : 'غير متصل'}
                </Badge>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 text-center">
                <span className="material-icons-round text-primary text-3xl mb-2 block">inventory_2</span>
                <p className="text-xs text-slate-400 font-bold mb-1">المنتجات</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{products.length}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 text-center">
                <span className="material-icons-round text-primary text-3xl mb-2 block">precision_manufacturing</span>
                <p className="text-xs text-slate-400 font-bold mb-1">خطوط الإنتاج</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{productionLines.length}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 text-center">
                <span className="material-icons-round text-primary text-3xl mb-2 block">groups</span>
                <p className="text-xs text-slate-400 font-bold mb-1">المشرفين</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{supervisors.length}</p>
              </div>
            </div>
          </Card>

          {/* Firebase Info */}
          <Card title="معلومات قاعدة البيانات">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">نوع قاعدة البيانات</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">Firebase Firestore</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">نوع المصادقة</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">بريد إلكتروني / كلمة مرور</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">نظام الصلاحيات</span>
                <span className="text-sm font-bold text-primary">ديناميكي (Firestore-backed RBAC)</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">عدد الأدوار</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{roles.length}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">الإصدار</span>
                <span className="text-sm font-bold text-primary">2.0.0</span>
              </div>
            </div>
          </Card>

          {/* Collections */}
          <Card title="هيكل البيانات (Firestore Collections)">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'roles', label: 'الأدوار', icon: 'admin_panel_settings', fields: 'name, color, permissions' },
                { name: 'users', label: 'المستخدمين', icon: 'people', fields: 'roleId' },
                { name: 'products', label: 'المنتجات', icon: 'inventory_2', fields: 'name, model, code, openingBalance' },
                { name: 'production_lines', label: 'خطوط الإنتاج', icon: 'precision_manufacturing', fields: 'name, dailyWorkingHours, maxWorkers, status' },
                { name: 'supervisors', label: 'المشرفين', icon: 'person', fields: 'name' },
                { name: 'production_reports', label: 'تقارير الإنتاج', icon: 'bar_chart', fields: 'date, lineId, productId, supervisorId, quantities...' },
                { name: 'line_status', label: 'حالة الخطوط', icon: 'monitor_heart', fields: 'lineId, currentProductId, targetTodayQty' },
                { name: 'line_product_config', label: 'إعدادات المنتج-الخط', icon: 'settings_applications', fields: 'lineId, productId, standardAssemblyTime' },
              ].map((col) => (
                <div key={col.name} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-icons-round text-primary text-lg">{col.icon}</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-white">{col.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{col.name}</p>
                  <p className="text-xs text-slate-500 mt-2">{col.fields}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: Dashboard Widget Settings ────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboardWidgets' && isAdmin && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">إعدادات عناصر لوحات التحكم</h3>
              <p className="text-sm text-slate-500">تحكم في ترتيب وظهور العناصر في كل لوحة تحكم. اسحب لإعادة الترتيب.</p>
            </div>
            <Button onClick={() => handleSave('widgets')} disabled={saving}>
              {saving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
              <span className="material-icons-round text-sm">save</span>
              حفظ التغييرات
            </Button>
          </div>

          {Object.entries(DASHBOARD_LABELS).map(([dashboardKey, dashboardLabel]) => {
            const widgetDefs = DASHBOARD_WIDGETS[dashboardKey] || [];
            const currentOrder = localWidgets[dashboardKey] || widgetDefs.map((d) => ({ id: d.id, visible: true }));

            return (
              <Card key={dashboardKey} title={dashboardLabel}>
                <div className="space-y-1">
                  {currentOrder.map((widget, index) => {
                    const def = widgetDefs.find((d) => d.id === widget.id);
                    if (!def) return null;
                    return (
                      <div
                        key={widget.id}
                        draggable
                        onDragStart={() => handleDragStart(dashboardKey, index)}
                        onDragEnter={() => handleDragEnter(dashboardKey, index)}
                        onDragEnd={() => handleDragEnd(dashboardKey)}
                        onDragOver={(e) => e.preventDefault()}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing group ${
                          widget.visible
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/30'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <span className="material-icons-round text-slate-300 dark:text-slate-600 text-lg group-hover:text-primary transition-colors">
                          drag_indicator
                        </span>
                        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-icons-round text-primary text-sm">{def.icon}</span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{def.label}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{widget.id}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </span>
                        <button
                          onClick={() => toggleWidget(dashboardKey, widget.id)}
                          className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${
                            widget.visible
                              ? 'bg-emerald-500'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                              widget.visible ? 'right-0.5' : 'right-[18px]'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: Alert Rules ──────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'alertRules' && isAdmin && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">قواعد التنبيهات</h3>
              <p className="text-sm text-slate-500">حدد الحدود التي يتم عندها إنشاء تنبيهات في لوحات التحكم.</p>
            </div>
            <Button onClick={() => handleSave('alerts')} disabled={saving}>
              {saving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
              <span className="material-icons-round text-sm">save</span>
              حفظ التغييرات
            </Button>
          </div>

          <Card>
            <div className="space-y-6">
              {ALERT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-icons-round text-primary">{field.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{field.label}</p>
                      <p className="text-xs text-slate-400 truncate">{field.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      step={field.key === 'planDelayDays' ? 1 : 0.5}
                      className="w-24 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-bold text-center py-2.5 px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={localAlerts[field.key]}
                      onChange={(e) =>
                        setLocalAlerts((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                      }
                    />
                    <span className="text-sm font-bold text-slate-400 w-10">{field.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="القيم الافتراضية">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {ALERT_FIELDS.map((field) => (
                <div key={field.key} className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs font-bold text-slate-400 mb-1">{field.label}</p>
                  <p className="text-lg font-black text-slate-600 dark:text-slate-300">
                    {DEFAULT_ALERT_SETTINGS[field.key]} {field.unit}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocalAlerts({ ...DEFAULT_ALERT_SETTINGS })}
              className="mt-4 text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-icons-round text-sm">restart_alt</span>
              إعادة تعيين للقيم الافتراضية
            </button>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: KPI Thresholds ───────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'kpiThresholds' && isAdmin && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">حدود مؤشرات الأداء</h3>
              <p className="text-sm text-slate-500">حدد قيم "جيد" و"تحذير" لكل مؤشر. تُستخدم لتلوين المؤشرات في لوحات التحكم.</p>
            </div>
            <Button onClick={() => handleSave('kpis')} disabled={saving}>
              {saving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
              <span className="material-icons-round text-sm">save</span>
              حفظ التغييرات
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-right py-3 px-4 font-bold text-slate-500 text-xs uppercase">المؤشر</th>
                    <th className="text-center py-3 px-4 font-bold text-slate-500 text-xs uppercase">الوحدة</th>
                    <th className="text-center py-3 px-4 font-bold text-slate-500 text-xs uppercase">المقياس</th>
                    <th className="text-center py-3 px-4 font-bold text-xs uppercase">
                      <span className="text-emerald-600">جيد</span>
                    </th>
                    <th className="text-center py-3 px-4 font-bold text-xs uppercase">
                      <span className="text-amber-600">تحذير</span>
                    </th>
                    <th className="text-center py-3 px-4 font-bold text-xs uppercase">
                      <span className="text-rose-600">خطر</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {KPI_DEFINITIONS.map((kpi) => {
                    const threshold = localKPIs[kpi.key] || DEFAULT_KPI_THRESHOLDS[kpi.key];
                    return (
                      <tr key={kpi.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="material-icons-round text-primary">{kpi.icon}</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{kpi.label}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-500 font-bold">{kpi.unit}</td>
                        <td className="py-4 px-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            kpi.invertedScale
                              ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400'
                          }`}>
                            {kpi.invertedScale ? 'أقل = أفضل' : 'أعلى = أفضل'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="w-20 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg text-sm font-bold text-center py-2 px-2 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            value={threshold.good}
                            onChange={(e) =>
                              setLocalKPIs((prev) => ({
                                ...prev,
                                [kpi.key]: { ...prev[kpi.key], good: Number(e.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="w-20 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-lg text-sm font-bold text-center py-2 px-2 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                            value={threshold.warning}
                            onChange={(e) =>
                              setLocalKPIs((prev) => ({
                                ...prev,
                                [kpi.key]: { ...prev[kpi.key], warning: Number(e.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-xs font-bold text-slate-400">
                            {kpi.invertedScale
                              ? `> ${threshold.warning}${kpi.unit}`
                              : `< ${threshold.warning}${kpi.unit}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Visual preview */}
          <Card title="معاينة الألوان">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {KPI_DEFINITIONS.map((kpi) => {
                const threshold = localKPIs[kpi.key] || DEFAULT_KPI_THRESHOLDS[kpi.key];
                return (
                  <div key={kpi.key} className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 text-center">{kpi.label}</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {kpi.invertedScale ? `≤ ${threshold.good}${kpi.unit}` : `≥ ${threshold.good}${kpi.unit}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          {kpi.invertedScale
                            ? `${threshold.good} — ${threshold.warning}${kpi.unit}`
                            : `${threshold.warning} — ${threshold.good}${kpi.unit}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                          {kpi.invertedScale ? `> ${threshold.warning}${kpi.unit}` : `< ${threshold.warning}${kpi.unit}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setLocalKPIs({ ...DEFAULT_KPI_THRESHOLDS })}
              className="mt-6 text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-icons-round text-sm">restart_alt</span>
              إعادة تعيين للقيم الافتراضية
            </button>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: Print Template Settings ───────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'printTemplate' && isAdmin && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">إعدادات قالب الطباعة</h3>
              <p className="text-sm text-slate-500">تخصيص مظهر التقارير المطبوعة — الشعار، الألوان، حجم الورق والمزيد.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowPreview(true)}
                className="!bg-slate-100 dark:!bg-slate-800 !text-slate-700 dark:!text-slate-300 hover:!bg-slate-200 dark:hover:!bg-slate-700"
              >
                <span className="material-icons-round text-sm">visibility</span>
                معاينة
              </Button>
              <Button onClick={() => handleSave('print')} disabled={saving}>
                {saving && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                <span className="material-icons-round text-sm">save</span>
                حفظ التغييرات
              </Button>
            </div>
          </div>

          {/* Logo & Header */}
          <Card title="الشعار والعنوان">
            <div className="space-y-6">
              {/* Logo Upload */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">image</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">شعار الشركة</p>
                    <p className="text-xs text-slate-400">يظهر أعلى التقرير المطبوع — PNG أو JPG</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {localPrint.logoUrl && (
                    <img
                      src={localPrint.logoUrl}
                      alt="logo"
                      className="w-12 h-12 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white"
                    />
                  )}
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {uploadingLogo ? (
                      <span className="material-icons-round animate-spin text-sm">refresh</span>
                    ) : (
                      <span className="material-icons-round text-sm">upload</span>
                    )}
                    {localPrint.logoUrl ? 'تغيير' : 'رفع'}
                  </button>
                  {localPrint.logoUrl && (
                    <button
                      onClick={() => setLocalPrint((p) => ({ ...p, logoUrl: '' }))}
                      className="px-3 py-2.5 rounded-xl text-sm font-bold bg-rose-50 dark:bg-rose-900/10 text-rose-600 hover:bg-rose-100 transition-all"
                    >
                      <span className="material-icons-round text-sm">delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Header Text */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">title</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">عنوان الرأس</p>
                    <p className="text-xs text-slate-400">اسم الشركة / المؤسسة في أعلى التقرير</p>
                  </div>
                </div>
                <input
                  type="text"
                  className="w-full sm:w-72 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-bold py-2.5 px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={localPrint.headerText}
                  onChange={(e) => setLocalPrint((p) => ({ ...p, headerText: e.target.value }))}
                />
              </div>

              {/* Footer Text */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">short_text</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">نص التذييل</p>
                    <p className="text-xs text-slate-400">يظهر أسفل التقرير المطبوع</p>
                  </div>
                </div>
                <input
                  type="text"
                  className="w-full sm:w-72 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-bold py-2.5 px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={localPrint.footerText}
                  onChange={(e) => setLocalPrint((p) => ({ ...p, footerText: e.target.value }))}
                />
              </div>

              {/* Primary Color */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">palette</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">اللون الرئيسي</p>
                    <p className="text-xs text-slate-400">لون العناوين والحدود في التقرير</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                    value={localPrint.primaryColor}
                    onChange={(e) => setLocalPrint((p) => ({ ...p, primaryColor: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="w-28 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-mono font-bold py-2.5 px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-center"
                    value={localPrint.primaryColor}
                    onChange={(e) => setLocalPrint((p) => ({ ...p, primaryColor: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Paper & Print Settings */}
          <Card title="الورق والطباعة">
            <div className="space-y-6">
              {/* Paper Size */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">description</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">حجم الورق</p>
                    <p className="text-xs text-slate-400">A4 / A5 / حراري</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {([['a4', 'A4'], ['a5', 'A5'], ['thermal', 'حراري']] as [PaperSize, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setLocalPrint((p) => ({ ...p, paperSize: val }))}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        localPrint.paperSize === val
                          ? 'bg-primary text-white shadow-lg shadow-primary/20'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary/30'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">crop_rotate</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">اتجاه الورق</p>
                    <p className="text-xs text-slate-400">عمودي أو أفقي</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {([['portrait', 'عمودي'], ['landscape', 'أفقي']] as [PaperOrientation, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setLocalPrint((p) => ({ ...p, orientation: val }))}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        localPrint.orientation === val
                          ? 'bg-primary text-white shadow-lg shadow-primary/20'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary/30'
                      }`}
                    >
                      <span className="material-icons-round text-sm">{val === 'portrait' ? 'stay_current_portrait' : 'stay_current_landscape'}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copies */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">content_copy</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">عدد النسخ</p>
                    <p className="text-xs text-slate-400">عدد النسخ الافتراضي عند الطباعة</p>
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-24 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-bold text-center py-2.5 px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={localPrint.copies}
                  onChange={(e) => setLocalPrint((p) => ({ ...p, copies: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                />
              </div>

              {/* Decimal Places */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">decimal_increase</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">المنازل العشرية</p>
                    <p className="text-xs text-slate-400">عدد الخانات بعد الفاصلة في الأرقام</p>
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={4}
                  className="w-24 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-bold text-center py-2.5 px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={localPrint.decimalPlaces}
                  onChange={(e) => setLocalPrint((p) => ({ ...p, decimalPlaces: Math.max(0, Math.min(4, Number(e.target.value))) }))}
                />
              </div>
            </div>
          </Card>

          {/* Toggle Settings */}
          <Card title="عناصر التقرير">
            <div className="space-y-3">
              {([
                { key: 'showWaste' as const, label: 'عرض الهالك', icon: 'delete_sweep', desc: 'إظهار عمود ونسبة الهالك في التقرير' },
                { key: 'showSupervisor' as const, label: 'عرض المشرف', icon: 'person', desc: 'إظهار اسم المشرف في التقرير' },
                { key: 'showQRCode' as const, label: 'عرض رمز QR', icon: 'qr_code', desc: 'إظهار رمز QR للتحقق من صحة التقرير' },
              ]).map((toggle) => (
                <div
                  key={toggle.key}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    localPrint[toggle.key]
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary">{toggle.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{toggle.label}</p>
                    <p className="text-xs text-slate-400">{toggle.desc}</p>
                  </div>
                  <button
                    onClick={() => setLocalPrint((p) => ({ ...p, [toggle.key]: !p[toggle.key] }))}
                    className={`w-12 h-7 rounded-full transition-all relative shrink-0 ${
                      localPrint[toggle.key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                        localPrint[toggle.key] ? 'right-0.5' : 'right-[22px]'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Reset to defaults */}
          <div className="flex justify-end">
            <button
              onClick={() => setLocalPrint({ ...DEFAULT_PRINT_TEMPLATE })}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-icons-round text-sm">restart_alt</span>
              إعادة تعيين للقيم الافتراضية
            </button>
          </div>

          {/* ── Preview Modal ── */}
          {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-icons-round text-primary">visibility</span>
                    معاينة التقرير المطبوع
                  </h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    <span className="material-icons-round text-slate-500">close</span>
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
                  <div className="shadow-2xl">
                    <ProductionReportPrint
                      title="تقرير الإنتاج اليومي — معاينة"
                      subtitle="بيانات تجريبية للمعاينة فقط"
                      rows={SAMPLE_ROWS}
                      totals={computePrintTotals(SAMPLE_ROWS)}
                      printSettings={localPrint}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: Backup & Restore ──────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'backup' && isAdmin && (
        <>
          {/* Backup status message */}
          {backupMessage && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${
              backupMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}>
              <span className="material-icons-round text-lg">
                {backupMessage.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {backupMessage.text}
              <button onClick={() => setBackupMessage(null)} className="mr-auto">
                <span className="material-icons-round text-sm opacity-60 hover:opacity-100">close</span>
              </button>
            </div>
          )}

          {/* Progress bar */}
          {backupProgress && (
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <span className="material-icons-round animate-spin text-sm">refresh</span>
                  {backupProgress.step}
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{backupProgress.percent}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900/30 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${backupProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Export Section ──────────────────────────────────────────────── */}
          <Card title="تصدير نسخة احتياطية">
            <div className="space-y-4">
              {/* Full Backup */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-primary text-xl">cloud_download</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">نسخة احتياطية كاملة</p>
                    <p className="text-xs text-slate-400">تصدير جميع البيانات — المنتجات، الخطوط، التقارير، الإعدادات، التكاليف، والمزيد</p>
                  </div>
                </div>
                <Button onClick={handleExportFull} disabled={backupLoading}>
                  {backupLoading && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                  <span className="material-icons-round text-sm">download</span>
                  تصدير كامل
                </Button>
              </div>

              {/* Monthly Backup */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-amber-600 text-xl">date_range</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">نسخة شهرية</p>
                    <p className="text-xs text-slate-400">تصدير تقارير الإنتاج وبيانات التكاليف لشهر محدد</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="month"
                    className="border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl text-sm font-bold py-2.5 px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                  <Button onClick={handleExportMonthly} disabled={backupLoading}>
                    {backupLoading && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                    <span className="material-icons-round text-sm">download</span>
                    تصدير
                  </Button>
                </div>
              </div>

              {/* Settings Only */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-violet-600 text-xl">tune</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">الإعدادات فقط</p>
                    <p className="text-xs text-slate-400">تصدير إعدادات النظام، الأدوار، وإعدادات العمالة فقط</p>
                  </div>
                </div>
                <Button onClick={handleExportSettings} disabled={backupLoading}>
                  {backupLoading && <span className="material-icons-round animate-spin text-sm">refresh</span>}
                  <span className="material-icons-round text-sm">download</span>
                  تصدير الإعدادات
                </Button>
              </div>
            </div>
          </Card>

          {/* ── Import Section ──────────────────────────────────────────────── */}
          <Card title="استعادة من نسخة احتياطية">
            <div className="space-y-6">
              {/* File Upload */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <span className="material-icons-round text-blue-600 text-xl">upload_file</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {importFileName || 'اختر ملف النسخة الاحتياطية'}
                      </p>
                      <p className="text-xs text-slate-400">ملف JSON تم تصديره من النظام</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => importInputRef.current?.click()}
                      disabled={backupLoading}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <span className="material-icons-round text-sm">folder_open</span>
                      اختيار ملف
                    </button>
                    {importFileName && (
                      <button
                        onClick={() => {
                          setImportFile(null);
                          setImportFileName('');
                          setImportValidation(null);
                        }}
                        className="px-3 py-2.5 rounded-xl text-sm font-bold bg-rose-50 dark:bg-rose-900/10 text-rose-600 hover:bg-rose-100 transition-all"
                      >
                        <span className="material-icons-round text-sm">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Validation result */}
                {importValidation && (
                  <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                    importValidation.valid
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  }`}>
                    <span className="material-icons-round text-lg mt-0.5">
                      {importValidation.valid ? 'verified' : 'error'}
                    </span>
                    {importValidation.valid && importFile ? (
                      <div className="flex-1">
                        <p className="mb-2">ملف صالح — جاهز للاستعادة</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-emerald-600/70 mb-0.5">النوع</p>
                            <p className="text-xs font-black">
                              {importFile.metadata.type === 'full' ? 'كاملة' : importFile.metadata.type === 'monthly' ? 'شهرية' : 'إعدادات'}
                            </p>
                          </div>
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-emerald-600/70 mb-0.5">المستندات</p>
                            <p className="text-xs font-black">{importFile.metadata.totalDocuments}</p>
                          </div>
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-emerald-600/70 mb-0.5">الإصدار</p>
                            <p className="text-xs font-black">{importFile.metadata.version}</p>
                          </div>
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-emerald-600/70 mb-0.5">التاريخ</p>
                            <p className="text-xs font-black">{new Date(importFile.metadata.createdAt).toLocaleDateString('ar-EG')}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {importFile.metadata.collectionsIncluded.map((c) => (
                            <span key={c} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/50 dark:bg-slate-800/50">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span>{importValidation.error}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Restore Mode Selection */}
              {importFile && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">وضع الاستعادة</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {RESTORE_MODES.map((mode) => {
                      const selected = restoreMode === mode.value;
                      const activeStyles: Record<string, string> = {
                        emerald: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10',
                        amber: 'border-amber-500 bg-amber-50 dark:bg-amber-900/10',
                        rose: 'border-rose-500 bg-rose-50 dark:bg-rose-900/10',
                      };
                      const iconStyles: Record<string, string> = {
                        emerald: 'text-emerald-600',
                        amber: 'text-amber-600',
                        rose: 'text-rose-600',
                      };
                      const labelStyles: Record<string, string> = {
                        emerald: 'text-emerald-700 dark:text-emerald-400',
                        amber: 'text-amber-700 dark:text-amber-400',
                        rose: 'text-rose-700 dark:text-rose-400',
                      };
                      return (
                        <button
                          key={mode.value}
                          onClick={() => setRestoreMode(mode.value)}
                          className={`p-4 rounded-xl border-2 text-right transition-all ${
                            selected
                              ? activeStyles[mode.color]
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`material-icons-round ${
                              selected ? iconStyles[mode.color] : 'text-slate-400'
                            }`}>
                              {mode.icon}
                            </span>
                            <span className={`text-sm font-bold ${
                              selected ? labelStyles[mode.color] : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {mode.label}
                            </span>
                            {selected && (
                              <span className={`material-icons-round ${iconStyles[mode.color]} mr-auto text-lg`}>check_circle</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{mode.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Warning for destructive modes */}
                  {restoreMode !== 'merge' && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${
                      restoreMode === 'full_reset'
                        ? 'bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        : 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    }`}>
                      <span className="material-icons-round text-lg">warning</span>
                      {restoreMode === 'full_reset'
                        ? 'تحذير: سيتم حذف جميع البيانات الحالية واستبدالها. سيتم إنشاء نسخة احتياطية تلقائية أولاً.'
                        : 'تحذير: سيتم استبدال المجموعات المشمولة. سيتم إنشاء نسخة احتياطية تلقائية أولاً.'}
                    </div>
                  )}

                  {/* Restore Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setShowConfirmRestore(true)}
                      disabled={backupLoading}
                      className={restoreMode === 'full_reset' ? '!bg-rose-600 hover:!bg-rose-700' : ''}
                    >
                      <span className="material-icons-round text-sm">restore</span>
                      بدء الاستعادة
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ── Safety Info ──────────────────────────────────────────────────── */}
          <Card title="قواعد الأمان">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons-round text-emerald-600">shield</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">نسخ تلقائي</span>
                </div>
                <p className="text-xs text-emerald-600/80">يتم إنشاء نسخة احتياطية كاملة تلقائياً قبل أي عملية استعادة</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons-round text-blue-600">verified</span>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-400">فحص الملف</span>
                </div>
                <p className="text-xs text-blue-600/80">يتم التحقق من صحة الملف والإصدار قبل السماح بالاستعادة</p>
              </div>
              <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-200 dark:border-violet-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons-round text-violet-600">sync</span>
                  <span className="text-sm font-bold text-violet-700 dark:text-violet-400">إعادة بناء تلقائي</span>
                </div>
                <p className="text-xs text-violet-600/80">بعد الاستعادة يتم إعادة حساب التكاليف وتحديث لوحات التحكم تلقائياً</p>
              </div>
            </div>
          </Card>

          {/* ── Backup History ───────────────────────────────────────────────── */}
          <Card title="سجل النسخ الاحتياطي">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                <span className="material-icons-round animate-spin">refresh</span>
                <span className="text-sm font-bold">جاري التحميل...</span>
              </div>
            ) : backupHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <span className="material-icons-round text-4xl mb-2 opacity-30">inventory_2</span>
                <p className="text-sm font-bold">لا يوجد سجل نسخ احتياطي بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backupHistory.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      entry.action === 'export'
                        ? 'bg-emerald-100 dark:bg-emerald-900/20'
                        : 'bg-blue-100 dark:bg-blue-900/20'
                    }`}>
                      <span className={`material-icons-round ${
                        entry.action === 'export'
                          ? 'text-emerald-600'
                          : 'text-blue-600'
                      }`}>
                        {entry.action === 'export' ? 'cloud_download' : 'cloud_upload'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                        {entry.action === 'export' ? 'تصدير' : 'استعادة'}
                        {' — '}
                        {entry.type === 'full' ? 'كاملة' : entry.type === 'monthly' ? `شهرية (${entry.month})` : 'إعدادات'}
                        {entry.mode && ` — ${entry.mode === 'merge' ? 'دمج' : entry.mode === 'replace' ? 'استبدال' : 'إعادة تعيين'}`}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {entry.totalDocuments} مستند · {entry.createdBy}
                        {entry.createdAt?.toDate && ` · ${entry.createdAt.toDate().toLocaleString('ar-EG')}`}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      entry.action === 'export'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {entry.action === 'export' ? 'تصدير' : 'استيراد'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Confirm Restore Modal ── */}
          {showConfirmRestore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                    restoreMode === 'full_reset'
                      ? 'bg-rose-100 dark:bg-rose-900/20'
                      : restoreMode === 'replace'
                      ? 'bg-amber-100 dark:bg-amber-900/20'
                      : 'bg-emerald-100 dark:bg-emerald-900/20'
                  }`}>
                    <span className={`material-icons-round text-3xl ${
                      restoreMode === 'full_reset'
                        ? 'text-rose-600'
                        : restoreMode === 'replace'
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}>
                      {restoreMode === 'full_reset' ? 'warning' : 'restore'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                    تأكيد الاستعادة
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {restoreMode === 'merge' && 'سيتم دمج البيانات من النسخة الاحتياطية مع البيانات الحالية.'}
                    {restoreMode === 'replace' && 'سيتم استبدال المجموعات المشمولة في النسخة الاحتياطية. البيانات الحالية في هذه المجموعات ستُحذف.'}
                    {restoreMode === 'full_reset' && 'سيتم حذف جميع البيانات الحالية واستبدالها بالنسخة الاحتياطية. هذه العملية لا يمكن التراجع عنها.'}
                  </p>
                  <p className="text-xs text-slate-400 mb-6 flex items-center justify-center gap-1">
                    <span className="material-icons-round text-xs">info</span>
                    سيتم إنشاء نسخة احتياطية تلقائية قبل البدء
                  </p>
                  <div className="flex items-center gap-3 justify-center">
                    <button
                      onClick={() => setShowConfirmRestore(false)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleRestore}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 ${
                        restoreMode === 'full_reset'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-primary hover:bg-primary/90'
                      }`}
                    >
                      <span className="material-icons-round text-sm">restore</span>
                      تأكيد الاستعادة
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
