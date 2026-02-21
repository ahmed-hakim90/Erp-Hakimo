import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, Badge } from '../components/UI';
import type { FirestoreEmployee } from '../types';
import { EMPLOYMENT_TYPE_LABELS } from '../types';
import { usePermission } from '../utils/permissions';
import { employeeService } from '../modules/hr/employeeService';
import { attendanceLogService } from '../modules/hr/attendanceService';
import { leaveRequestService, leaveBalanceService } from '../modules/hr/leaveService';
import { loanService } from '../modules/hr/loanService';
import { reportService } from '../services/reportService';
import { JOB_LEVEL_LABELS, type JobLevel } from '../modules/hr/types';
import { getDocs } from 'firebase/firestore';
import { departmentsRef, jobPositionsRef, shiftsRef } from '../modules/hr/collections';
import type {
  FirestoreDepartment,
  FirestoreJobPosition,
  FirestoreShift,
  FirestoreAttendanceLog,
  FirestoreLeaveRequest,
  FirestoreLeaveBalance,
  FirestoreEmployeeLoan,
} from '../modules/hr/types';
import { LEAVE_TYPE_LABELS } from '../modules/hr/types';
import { formatNumber } from '../utils/calculations';
import type { ProductionReport } from '../types';

type ProfileTab = 'overview' | 'hierarchy' | 'attendance' | 'payroll' | 'leaves' | 'loans';

const TABS: { id: ProfileTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'hierarchy', label: 'التسلسل الوظيفي', icon: 'account_tree' },
  { id: 'attendance', label: 'الحضور', icon: 'fingerprint' },
  { id: 'payroll', label: 'الرواتب', icon: 'receipt_long' },
  { id: 'leaves', label: 'الإجازات', icon: 'beach_access' },
  { id: 'loans', label: 'السُلف', icon: 'payments' },
];

function formatTime(ts: any): string {
  if (!ts) return '—';
  const date = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatDateAr(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق',
  rejected: 'مرفوض',
};

const LOAN_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  active: 'نشطة',
  closed: 'مغلقة',
};

export const EmployeeProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const updateEmployee = useAppStore((s) => s.updateEmployee);

  const [employee, setEmployee] = useState<FirestoreEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  const [departments, setDepartments] = useState<FirestoreDepartment[]>([]);
  const [jobPositions, setJobPositions] = useState<FirestoreJobPosition[]>([]);
  const [shifts, setShifts] = useState<FirestoreShift[]>([]);

  const [managerChain, setManagerChain] = useState<FirestoreEmployee[]>([]);
  const [directReports, setDirectReports] = useState<FirestoreEmployee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<FirestoreAttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<FirestoreLeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<FirestoreLeaveBalance | null>(null);
  const [loans, setLoans] = useState<FirestoreEmployeeLoan[]>([]);
  const [reports, setReports] = useState<ProductionReport[]>([]);

  const [tabLoading, setTabLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  const getDepartmentName = useCallback(
    (departmentId: string) => departments.find((d) => d.id === departmentId)?.name ?? '—',
    [departments]
  );
  const getJobPositionTitle = useCallback(
    (jobPositionId: string) => jobPositions.find((p) => p.id === jobPositionId)?.title ?? '—',
    [jobPositions]
  );
  const getShiftName = useCallback(
    (shiftId: string) => shifts.find((s) => s.id === shiftId)?.name ?? '—',
    [shifts]
  );

  // Fetch employee + ref data on mount
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [emp, deptSnap, posSnap, shiftSnap] = await Promise.all([
          employeeService.getById(id),
          getDocs(departmentsRef()),
          getDocs(jobPositionsRef()),
          getDocs(shiftsRef()),
        ]);
        if (cancelled) return;
        setEmployee(emp ?? null);
        setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreDepartment)));
        setJobPositions(posSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreJobPosition)));
        setShifts(shiftSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreShift)));
      } catch (e) {
        console.error('EmployeeProfile load error:', e);
        if (!cancelled) setEmployee(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Tab-specific data
  useEffect(() => {
    if (!id || !employee) return;
    let cancelled = false;
    setTabLoading(true);
    (async () => {
      try {
        const tasks: Promise<unknown>[] = [];
        const results: { hierarchy?: FirestoreEmployee[]; directReports?: FirestoreEmployee[]; attendance?: FirestoreAttendanceLog[]; leaveReqs?: FirestoreLeaveRequest[]; balance?: FirestoreLeaveBalance | null; loansList?: FirestoreEmployeeLoan[]; reportsList?: ProductionReport[] } = {};

        if (activeTab === 'hierarchy') {
          tasks.push(
            employeeService.getHierarchy(id).then((chain) => {
              if (!cancelled) results.hierarchy = chain;
            }),
            employeeService.getByManager(id).then((reports) => {
              if (!cancelled) results.directReports = reports;
            })
          );
        } else if (activeTab === 'attendance') {
          tasks.push(
            attendanceLogService.getByEmployee(id).then((logs) => {
              if (!cancelled) results.attendance = logs;
            })
          );
        } else if (activeTab === 'leaves') {
          tasks.push(
            leaveRequestService.getByEmployee(id).then((reqs) => {
              if (!cancelled) results.leaveReqs = reqs;
            }),
            leaveBalanceService.getByEmployee(id).then((bal) => {
              if (!cancelled) results.balance = bal;
            })
          );
        } else if (activeTab === 'loans') {
          tasks.push(
            loanService.getByEmployee(id).then((list) => {
              if (!cancelled) results.loansList = list;
            })
          );
        } else if (activeTab === 'overview') {
          tasks.push(
            employeeService.getHierarchy(id).then((chain) => {
              if (!cancelled) results.hierarchy = chain;
            }),
            employeeService.getByManager(id).then((reports) => {
              if (!cancelled) results.directReports = reports;
            }),
            reportService.getByEmployee(id).then((list) => {
              if (!cancelled) results.reportsList = list;
            })
          );
        }

        await Promise.all(tasks);
        if (cancelled) return;
        if (results.hierarchy != null) setManagerChain(results.hierarchy);
        if (results.directReports != null) setDirectReports(results.directReports);
        if (results.attendance != null) setAttendanceLogs(results.attendance);
        if (results.leaveReqs != null) setLeaveRequests(results.leaveReqs);
        if (results.balance !== undefined) setLeaveBalance(results.balance);
        if (results.loansList != null) setLoans(results.loansList);
        if (results.reportsList != null) setReports(results.reportsList);
      } catch (e) {
        console.error('EmployeeProfile tab data error:', e);
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, employee, activeTab]);

  const handleToggleStatus = useCallback(async () => {
    if (!employee?.id || toggling) return;
    setToggling(true);
    try {
      await updateEmployee(employee.id, { isActive: !employee.isActive });
      setEmployee((prev) => (prev ? { ...prev, isActive: !prev.isActive } : null));
    } catch (e) {
      console.error('Toggle status error:', e);
    } finally {
      setToggling(false);
    }
  }, [employee, toggling, updateEmployee]);

  const managerName = useMemo(() => {
    if (!employee?.managerId) return '—';
    const chain = managerChain.length ? managerChain : [];
    const immediate = chain[0];
    return immediate?.name ?? '—';
  }, [employee?.managerId, managerChain]);

  const overviewKpis = useMemo(() => {
    const totalProduced = reports.reduce((s, r) => s + (r.quantityProduced ?? 0), 0);
    const totalWaste = reports.reduce((s, r) => s + (r.quantityWaste ?? 0), 0);
    const total = totalProduced + totalWaste;
    const wasteRatio = total ? (totalWaste / total) * 100 : 0;
    return {
      totalReports: reports.length,
      totalProduced,
      totalWaste,
      wasteRatio: Number(wasteRatio.toFixed(1)),
    };
  }, [reports]);

  const attendanceSummary = useMemo(() => {
    let totalDays = attendanceLogs.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let totalHours = 0;
    attendanceLogs.forEach((log) => {
      if (log.isAbsent) absent++;
      else present++;
      if (log.lateMinutes > 0) late++;
      totalHours += log.totalHours ?? 0;
    });
    return { totalDays, present, absent, late, totalHours };
  }, [attendanceLogs]);

  const activeLoans = useMemo(() => loans.filter((l) => l.status === 'active'), [loans]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto" dir="rtl">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mb-6" />
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/4 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center" dir="rtl">
        <Card>
          <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600">person_off</span>
          <h2 className="text-xl font-bold mt-4">الموظف غير موجود</h2>
          <p className="text-slate-500 mt-2">لم يتم العثور على الموظف المطلوب.</p>
          <Button className="mt-6" onClick={() => navigate('/employees')}>
            <span className="material-icons-round text-lg">arrow_back</span>
            العودة للقائمة
          </Button>
        </Card>
      </div>
    );
  }

  const levelLabel = JOB_LEVEL_LABELS[(employee.level as JobLevel) ?? 1] ?? String(employee.level);

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Back + Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary font-medium mb-4"
        >
          <span className="material-icons-round">arrow_back</span>
          العودة للموظفين
        </button>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            <Badge variant="neutral">{getDepartmentName(employee.departmentId)}</Badge>
            <Badge variant="info">{getJobPositionTitle(employee.jobPositionId)}</Badge>
            <Badge variant={employee.isActive ? 'success' : 'danger'}>
              {employee.isActive ? 'نشط' : 'غير نشط'}
            </Badge>
            <Badge variant="warning">{levelLabel}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {can('employees.edit') && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate('/employees', { state: { editId: employee.id } })}
                >
                  <span className="material-icons-round text-lg">edit</span>
                  تعديل
                </Button>
                <Button
                  variant="outline"
                  onClick={handleToggleStatus}
                  disabled={toggling}
                >
                  <span className="material-icons-round text-lg">{employee.isActive ? 'toggle_on' : 'toggle_off'}</span>
                  {employee.isActive ? 'إلغاء التفعيل' : 'تفعيل'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-icons-round text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {tabLoading && (
        <div className="flex items-center gap-2 text-slate-500 mb-4">
          <span className="material-icons-round animate-spin">progress_activity</span>
          جاري التحميل...
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { label: 'القسم', value: getDepartmentName(employee.departmentId) },
              { label: 'الوظيفة', value: getJobPositionTitle(employee.jobPositionId) },
              { label: 'المستوى', value: levelLabel },
              { label: 'نوع التوظيف', value: EMPLOYMENT_TYPE_LABELS[employee.employmentType] },
              { label: 'الراتب الأساسي', value: formatNumber(employee.baseSalary) + ' ج.م' },
              { label: 'الأجر بالساعة', value: formatNumber(employee.hourlyRate) + ' ج.م' },
              { label: 'الوردية', value: employee.shiftId ? getShiftName(employee.shiftId) : '—' },
              { label: 'المركبة', value: employee.vehicleId || '—' },
              { label: 'المدير', value: managerName },
              { label: 'الدخول للنظام', value: employee.hasSystemAccess ? 'نعم' : 'لا' },
              { label: 'الكود', value: employee.code || '—' },
            ].map((item) => (
              <Card key={item.label} className="!p-4">
                <p className="text-slate-500 text-xs font-medium mb-1">{item.label}</p>
                <p className="font-bold">{item.value}</p>
              </Card>
            ))}
          </div>
          <Card title="مؤشرات الإنتاج">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-slate-500 text-sm">إجمالي التقارير</p>
                <p className="text-xl font-bold">{formatNumber(overviewKpis.totalReports)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">إجمالي المنتج</p>
                <p className="text-xl font-bold">{formatNumber(overviewKpis.totalProduced)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">إجمالي الهالك</p>
                <p className="text-xl font-bold">{formatNumber(overviewKpis.totalWaste)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">نسبة الهالك %</p>
                <p className="text-xl font-bold">{overviewKpis.wasteRatio}%</p>
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium mb-2">آخر 10 تقارير إنتاج</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 font-bold">التاريخ</th>
                    <th className="p-3 font-bold">الكمية المنتجة</th>
                    <th className="p-3 font-bold">الهالك</th>
                    <th className="p-3 font-bold">ساعات العمل</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 10).map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{formatDateAr(r.date)}</td>
                      <td className="p-3">{formatNumber(r.quantityProduced)}</td>
                      <td className="p-3">{formatNumber(r.quantityWaste)}</td>
                      <td className="p-3">{formatNumber(r.workHours)}</td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-500">
                        لا توجد تقارير
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'hierarchy' && (
        <Card title="التسلسل الوظيفي">
          <div className="space-y-0">
            {[...managerChain].reverse().map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-r-2 border-slate-200 dark:border-slate-700 pr-4 ml-4">
                <span className="material-icons-round text-slate-400">person</span>
                <span>{m.name}</span>
                <Badge variant="neutral">{getDepartmentName(m.departmentId)}</Badge>
              </div>
            ))}
            <div className="flex items-center gap-3 py-3 pr-4 ml-4 border-r-2 border-primary bg-primary/5 rounded-lg my-2">
              <span className="material-icons-round text-primary">person</span>
              <span className="font-bold">{employee.name}</span>
              <Badge variant="info">الموظف الحالي</Badge>
            </div>
            {directReports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-r-2 border-slate-200 dark:border-slate-700 pr-4 ml-4">
                <span className="material-icons-round text-slate-400">person</span>
                <span>{r.name}</span>
                <Badge variant="neutral">{getDepartmentName(r.departmentId)}</Badge>
              </div>
            ))}
            {directReports.length === 0 && (
              <p className="text-slate-500 text-sm py-2 pr-4 ml-4">لا يوجد مرؤوسون مباشرون</p>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <Card title="ملخص الحضور">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <p className="text-slate-500 text-sm">إجمالي الأيام</p>
                <p className="text-xl font-bold">{formatNumber(attendanceSummary.totalDays)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">حاضر</p>
                <p className="text-xl font-bold text-emerald-600">{formatNumber(attendanceSummary.present)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">غائب</p>
                <p className="text-xl font-bold text-rose-600">{formatNumber(attendanceSummary.absent)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">متأخر</p>
                <p className="text-xl font-bold text-amber-600">{formatNumber(attendanceSummary.late)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">إجمالي الساعات</p>
                <p className="text-xl font-bold">{attendanceSummary.totalHours.toFixed(1)}</p>
              </div>
            </div>
          </Card>
          <Card title="سجلات الحضور">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 font-bold">التاريخ</th>
                    <th className="p-3 font-bold">دخول</th>
                    <th className="p-3 font-bold">خروج</th>
                    <th className="p-3 font-bold">الساعات</th>
                    <th className="p-3 font-bold">تأخر (د)</th>
                    <th className="p-3 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLogs.map((log) => {
                    const status = log.isAbsent ? 'غائب' : log.lateMinutes > 0 ? 'متأخر' : 'حاضر';
                    return (
                      <tr key={log.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-3">{formatDateAr(log.date)}</td>
                        <td className="p-3">{formatTime(log.checkIn)}</td>
                        <td className="p-3">{formatTime(log.checkOut)}</td>
                        <td className="p-3">{(log.totalHours ?? 0).toFixed(1)}</td>
                        <td className="p-3">{log.lateMinutes ?? 0}</td>
                        <td className="p-3">
                          <Badge variant={log.isAbsent ? 'danger' : log.lateMinutes ? 'warning' : 'success'}>
                            {status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {attendanceLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        لا توجد سجلات حضور
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'payroll' && (
        <Card title="الرواتب">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-slate-500 text-sm">الراتب الأساسي</p>
              <p className="text-xl font-bold">{formatNumber(employee.baseSalary)} ج.م</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm">نوع التوظيف</p>
              <p className="text-xl font-bold">{EMPLOYMENT_TYPE_LABELS[employee.employmentType]}</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm">الأجر بالساعة</p>
              <p className="text-xl font-bold">{formatNumber(employee.hourlyRate)} ج.م</p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            يمكنك مراجعة كشف الرواتب التفصيلي من صفحة الرواتب.
          </p>
          <Button variant="outline" onClick={() => navigate('/payroll')}>
            <span className="material-icons-round text-lg">receipt_long</span>
            صفحة الرواتب
          </Button>
        </Card>
      )}

      {activeTab === 'leaves' && (
        <div className="space-y-6">
          <Card title="رصيد الإجازات">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-500 text-sm">سنوية</p>
                <p className="text-xl font-bold">{leaveBalance ? formatNumber(leaveBalance.annualBalance) : '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">مرضية</p>
                <p className="text-xl font-bold">{leaveBalance ? formatNumber(leaveBalance.sickBalance) : '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">طارئة</p>
                <p className="text-xl font-bold">{leaveBalance ? formatNumber(leaveBalance.emergencyBalance) : '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">بدون راتب (مأخوذ)</p>
                <p className="text-xl font-bold">{leaveBalance ? formatNumber(leaveBalance.unpaidTaken) : '—'}</p>
              </div>
            </div>
          </Card>
          <Card title="طلبات الإجازة">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 font-bold">النوع</th>
                    <th className="p-3 font-bold">من</th>
                    <th className="p-3 font-bold">إلى</th>
                    <th className="p-3 font-bold">الأيام</th>
                    <th className="p-3 font-bold">الحالة</th>
                    <th className="p-3 font-bold">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((req) => (
                    <tr key={req.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{LEAVE_TYPE_LABELS[req.leaveType]}</td>
                      <td className="p-3">{formatDateAr(req.startDate)}</td>
                      <td className="p-3">{formatDateAr(req.endDate)}</td>
                      <td className="p-3">{formatNumber(req.totalDays)}</td>
                      <td className="p-3">
                        <Badge variant={req.finalStatus === 'approved' ? 'success' : req.finalStatus === 'rejected' ? 'danger' : 'warning'}>
                          {APPROVAL_STATUS_LABELS[req.finalStatus] ?? req.finalStatus}
                        </Badge>
                      </td>
                      <td className="p-3 max-w-[200px] truncate">{req.reason || '—'}</td>
                    </tr>
                  ))}
                  {leaveRequests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        لا توجد طلبات إجازة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="space-y-6">
          <Card title="السُلف">
            {activeLoans.length > 0 && (
              <div className="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                  عدد السُلف النشطة: {activeLoans.length}
                </p>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 font-bold">المبلغ</th>
                    <th className="p-3 font-bold">القسط</th>
                    <th className="p-3 font-bold">الأقساط (متبقي/إجمالي)</th>
                    <th className="p-3 font-bold">بدء الخصم</th>
                    <th className="p-3 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{formatNumber(loan.loanAmount)} ج.م</td>
                      <td className="p-3">{formatNumber(loan.installmentAmount)} ج.م</td>
                      <td className="p-3">
                        {loan.remainingInstallments} / {loan.totalInstallments}
                      </td>
                      <td className="p-3">{loan.startMonth}</td>
                      <td className="p-3">
                        <Badge variant={loan.status === 'active' ? 'success' : loan.status === 'pending' ? 'warning' : 'neutral'}>
                          {LOAN_STATUS_LABELS[loan.status] ?? loan.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {loans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        لا توجد سُلف
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
