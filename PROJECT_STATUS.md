# Pro-Tech ERP — حالة المشروع

> آخر تحديث: 2026-02-21

---

## أولاً: ما تم إنجازه بالكامل

### 1. النظام الأساسي (Core)

| الملف / الوحدة | الوصف | الحالة |
|----------------|-------|--------|
| `App.tsx` | Routing + Auth flow + ProtectedRoute | مكتمل |
| `services/firebase.ts` | Firebase initialization | مكتمل |
| `store/useAppStore.ts` | Zustand store (products, lines, employees, reports, plans, costs, auth, roles, permissions) | مكتمل |
| `utils/permissions.ts` | Permission system + RBAC hooks + sidebar + route mapping | مكتمل |
| `utils/themeEngine.ts` | Dynamic theme (CSS variables) | مكتمل |
| `components/Layout.tsx` | Sidebar + header + responsive layout | مكتمل |
| `components/ProtectedRoute.tsx` | Route-level permission guard | مكتمل |
| `components/UI.tsx` | Card, Badge, Button, KPIBox, SearchableSelect, LoadingSkeleton | مكتمل |
| `components/SelectableTable.tsx` | Generic selectable table component | مكتمل |
| `components/BulkActionBar.tsx` | Bulk action toolbar | مكتمل |
| `hooks/useBulkSelection.ts` | Bulk selection hook | مكتمل |

### 2. المنتجات (Products)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Products.tsx` | قائمة + إضافة + تعديل + حذف + بحث + استيراد Excel | مكتمل |
| `pages/ProductDetails.tsx` | تفاصيل المنتج | مكتمل |
| `services/productService.ts` | CRUD كامل | مكتمل |

### 3. خطوط الإنتاج (Lines)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Lines.tsx` | قائمة + إضافة + تعديل + حذف | مكتمل |
| `pages/LineDetails.tsx` | تفاصيل الخط + حالة + تقارير | مكتمل |
| `services/lineService.ts` | CRUD كامل | مكتمل |
| `services/lineStatusService.ts` | حالة الخطوط (real-time) | مكتمل |
| `services/lineProductConfigService.ts` | إعدادات المنتج-الخط | مكتمل |

### 4. التقارير (Reports)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Reports.tsx` | قائمة + فلاتر + إضافة + تعديل + حذف + Excel import/export + PDF + طباعة + Bulk Actions | مكتمل |
| `services/reportService.ts` | CRUD كامل | مكتمل |
| `components/ProductionReportPrint.tsx` | قالب الطباعة | مكتمل |
| `utils/reportExport.ts` | تصدير التقارير | مكتمل |
| `utils/exportExcel.ts` | تصدير Excel | مكتمل |
| `utils/importExcel.ts` | استيراد Excel | مكتمل |

### 5. خطط الإنتاج (Plans)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/ProductionPlans.tsx` | إنشاء + عرض + تتبع التقدم + فلاتر | مكتمل |
| `services/productionPlanService.ts` | CRUD كامل | مكتمل |

### 6. الإدخال السريع (QuickAction)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/QuickAction.tsx` | إدخال تقرير سريع مع ربط بالخطط | مكتمل |

### 7. التكاليف (Costs)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/CostCenters.tsx` | مراكز التكلفة — CRUD | مكتمل |
| `pages/CostCenterDistribution.tsx` | توزيع التكاليف | مكتمل |
| `pages/CostSettings.tsx` | إعدادات التكاليف + العمالة | مكتمل |
| `services/costCenterService.ts` | CRUD | مكتمل |
| `services/costCenterValueService.ts` | قيم التكلفة | مكتمل |
| `services/costAllocationService.ts` | توزيع التكاليف | مكتمل |
| `services/laborSettingsService.ts` | إعدادات العمالة | مكتمل |

### 8. الموظفين (Employees)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Employees.tsx` | قائمة + فلاتر (قسم، حالة، نوع تعاقد) + إضافة + تعديل + ربط حساب + إنشاء مستخدم | مكتمل |
| `pages/EmployeeProfile.tsx` | ملف الموظف (بيانات + هيكل + حضور + رواتب + إجازات + سُلف) | مكتمل |
| `pages/EmployeeSelfService.tsx` | خدمة ذاتية للموظف | مكتمل |
| `modules/hr/employeeService.ts` | CRUD + hierarchy + getByDepartment + getByManager + getByUserId | مكتمل |

### 9. المستخدمين والأدوار (Users & Roles)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Users.tsx` | إدارة المستخدمين — إنشاء + تعديل + إعادة تعيين كلمة سر + تفعيل | مكتمل |
| `pages/RolesManagement.tsx` | إدارة الأدوار + الصلاحيات | مكتمل |
| `services/userService.ts` | CRUD مستخدمين | مكتمل |
| `services/roleService.ts` | CRUD أدوار | مكتمل |

### 10. لوحات التحكم (Dashboards)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Dashboard.tsx` | الرئيسية — KPIs + حالة الخطوط + رسوم بيانية + widgets | مكتمل |
| `pages/AdminDashboard.tsx` | لوحة مدير النظام — KPIs + تنبيهات + أدوار + نشاط | مكتمل |
| `pages/FactoryManagerDashboard.tsx` | لوحة مدير المصنع — فترات + تكاليف + رسوم | مكتمل |
| `pages/EmployeeDashboard.tsx` | لوحة الموظف — تقاريري + خططي + KPIs | مكتمل |
| `components/EmployeeDashboardWidget.tsx` | Widget الموظف في الداشبورد الرئيسي | مكتمل |

### 11. النظام والإعدادات

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `pages/Settings.tsx` | إعدادات (عام + ثيم + تنبيهات + KPI + طباعة + نسخ احتياطي) | مكتمل |
| `pages/ActivityLog.tsx` | سجل النشاط | مكتمل |
| `pages/Login.tsx` | تسجيل الدخول | مكتمل |
| `pages/Setup.tsx` | الإعداد الأولي | مكتمل |
| `pages/PendingApproval.tsx` | صفحة انتظار التفعيل | مكتمل |
| `services/systemSettingsService.ts` | إعدادات النظام | مكتمل |
| `services/activityLogService.ts` | سجل النشاط | مكتمل |
| `services/adminService.ts` | خدمات الإدارة | مكتمل |
| `services/backupService.ts` | نسخ احتياطي (بيانات أساسية فقط) | مكتمل جزئياً |

### 12. وحدة HR — الخدمات

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `modules/hr/collections.ts` | تعريف كل الـ collections | مكتمل |
| `modules/hr/types.ts` | أنواع TypeScript صارمة لكل الـ HR | مكتمل |
| `modules/hr/attendanceService.ts` | سجلات خام + معالجة | مكتمل |
| `modules/hr/attendanceProcessor.ts` | CSV parsing + معالجة الورديات + حساب التأخير | مكتمل |
| `modules/hr/leaveService.ts` | طلبات إجازة + أرصدة + خصم | مكتمل |
| `modules/hr/loanService.ts` | سُلف + أقساط + معالجة القسط | مكتمل |
| `modules/hr/approvalEngine.ts` | محرك موافقات أساسي (legacy) | مكتمل |
| `modules/hr/hrEngine.ts` | حسابات نقية (راتب، غياب، تأخير، جزاءات، بدلات) | مكتمل |
| `modules/hr/payrollIntegration.ts` | ربط الإجازات والسُلف بالرواتب | مكتمل |
| `modules/hr/index.ts` | Public API لكل الوحدة | مكتمل |

### 13. وحدة HR — الصفحات

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `modules/hr/pages/AttendanceList.tsx` | سجل الحضور — عرض + فلاتر + تعديل | مكتمل |
| `modules/hr/pages/AttendanceImport.tsx` | استيراد الحضور — CSV + معالجة + حفظ | مكتمل جزئياً |
| `modules/hr/pages/LeaveRequests.tsx` | الإجازات — إنشاء + عرض + أرصدة | مكتمل |
| `modules/hr/pages/LoanRequests.tsx` | السُلف — إنشاء + عرض + جدول أقساط | مكتمل |
| `modules/hr/pages/ApprovalCenter.tsx` | مركز الموافقات — عرض موحد + موافقة/رفض | مكتمل |
| `modules/hr/pages/HRSettings.tsx` | إعدادات HR — 8 تبويبات | مكتمل |
| `modules/hr/pages/Payroll.tsx` | كشف الرواتب — احتساب + اعتماد + قفل + طباعة | مكتمل جزئياً |

### 14. وحدة الرواتب (Payroll Module)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `modules/hr/payroll/index.ts` | Public API | مكتمل |
| `modules/hr/payroll/types.ts` | أنواع TypeScript | مكتمل |
| `modules/hr/payroll/collections.ts` | Firestore collections | مكتمل |
| `modules/hr/payroll/payrollEngine.ts` | محرك احتساب الرواتب | مكتمل |
| `modules/hr/payroll/payrollFinalizer.ts` | اعتماد كشف الرواتب + snapshot | مكتمل |
| `modules/hr/payroll/payrollLocker.ts` | قفل الشهر نهائياً | مكتمل |
| `modules/hr/payroll/payrollAudit.ts` | سجل تدقيق الرواتب | مكتمل |
| `modules/hr/payroll/salaryStrategies/` | استراتيجيات (شهري + يومي + ساعي) | مكتمل |

### 15. وحدة الإعدادات المركزية (HR Config Module)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `modules/hr/config/index.ts` | Public API | مكتمل |
| `modules/hr/config/types.ts` | أنواع TypeScript | مكتمل |
| `modules/hr/config/collections.ts` | Firestore collections | مكتمل |
| `modules/hr/config/defaults.ts` | القيم الافتراضية لكل module | مكتمل |
| `modules/hr/config/configService.ts` | CRUD + snapshot + initialization | مكتمل |
| `modules/hr/config/configAudit.ts` | سجل تدقيق التغييرات | مكتمل |

### 16. محرك الموافقات المؤسسي (Enterprise Approval Engine)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `modules/hr/approval/index.ts` | Public API | مكتمل |
| `modules/hr/approval/types.ts` | 20+ نوع TypeScript صارم | مكتمل |
| `modules/hr/approval/collections.ts` | 4 Firestore collections | مكتمل |
| `modules/hr/approval/approvalBuilder.ts` | بناء سلسلة snapshot من الهيكل الوظيفي | مكتمل |
| `modules/hr/approval/approvalEngine.ts` | createRequest, approve, reject, cancel, adminOverride, getPendingApprovals | مكتمل |
| `modules/hr/approval/approvalValidation.ts` | RBAC (موظف/مدير/HR/Admin) | مكتمل |
| `modules/hr/approval/approvalDelegation.ts` | تفويض الموافقات — CRUD + resolveDelegate | مكتمل |
| `modules/hr/approval/approvalEscalation.ts` | تصعيد تلقائي + getEscalatedRequests + isRequestOverdue | مكتمل |
| `modules/hr/approval/approvalAudit.ts` | سجل تدقيق كامل لكل إجراء | مكتمل |

### 17. أدوات مساعدة (Utils)

| الملف | الوصف | الحالة |
|-------|-------|--------|
| `utils/calculations.ts` | حسابات الإنتاج | مكتمل |
| `utils/costCalculations.ts` | حسابات التكاليف | مكتمل |
| `utils/dashboardConfig.ts` | إعدادات widgets الداشبورد | مكتمل |
| `utils/downloadTemplates.ts` | تنزيل قوالب | مكتمل |
| `modules/hr/utils/payslipGenerator.ts` | توليد كشف الراتب HTML + طباعة | مكتمل جزئياً |

---

## ثانياً: المتبقي والنواقص

### مستوى حرج — يمنع العمل في Production

| # | النقص | الملفات المتأثرة | التفاصيل |
|---|-------|------------------|----------|
| 1 | **Firestore Rules لكل collections الـ HR** | `firestore.rules` | كل الـ HR collections مش موجودة في القواعد. الـ catch-all `allow read, write: if false` بيرفض أي عملية. يعني الحضور، الإجازات، السُلف، الموافقات، الرواتب، الإعدادات — كلها هتفشل. المطلوب إضافة rules لـ: `departments`, `job_positions`, `shifts`, `hr_settings`, `penalty_rules`, `late_rules`, `allowance_types`, `attendance_raw_logs`, `attendance_logs`, `leave_requests`, `leave_balances`, `employee_loans`, `approval_requests`, `approval_settings`, `approval_delegations`, `approval_audit_logs`, `payroll_months`, `payroll_records`, `payroll_audit_logs`, `payroll_cost_summary`, `hr_config_modules`, `hr_config_audit_logs` |
| 2 | **صفحة الرواتب تستخدم بيانات تجريبية** | `modules/hr/pages/Payroll.tsx` | `DEMO_EMPLOYEES` مصفوفة hardcoded (3 موظفين وهميين) بدل بيانات Firestore الحقيقية |
| 3 | **إعدادات استيراد الحضور ثابتة** | `modules/hr/pages/AttendanceImport.tsx` | الوردية + قواعد التأخير + أيام الراحة + خريطة الأكواد كلها default values محلية — TODO لتحميلها من Firestore |

### مستوى متوسط — وظائف ناقصة

| # | النقص | التفاصيل |
|---|-------|----------|
| 4 | **النسخ الاحتياطي لا يشمل HR** | `backupService.ts` → `ALL_COLLECTIONS` مش فيها أي collection من HR. لو المستخدم عمل backup مش هيتحفظ بيانات الحضور أو الرواتب أو الإجازات |
| 5 | **مركز الموافقات لسه على المحرك القديم** | `ApprovalCenter.tsx` بيستخدم الـ legacy `approvalEngine.ts` مش الـ Enterprise engine الجديد. محتاج يتحدث ليستخدم `createRequest`, `approveRequest`, `rejectRequest` من `modules/hr/approval/` |
| 6 | **مفيش صفحة إدارة التفويضات** | الـ `approvalDelegationService` جاهز (CRUD + resolveDelegate) بس مفيش UI لإنشاء/عرض/إلغاء التفويضات |
| 7 | **مفيش Cloud Function للتصعيد التلقائي** | `processEscalations()` جاهزة بس محتاجة cron job أو Cloud Function يشغلها يومياً |
| 8 | **إعدادات الموافقات المؤسسية مش في HRSettings** | `approval_settings` document (maxLevels, escalationDays, autoApproveThresholds) محتاج tab في صفحة إعدادات HR أو صفحة مستقلة |
| 9 | **كشف الراتب فيه placeholders** | `payslipGenerator.ts`: "Company branding placeholder" + "Signature placeholder" + "QR code placeholder" |

### مستوى منخفض — تحسينات وتنظيف

| # | النقص | التفاصيل |
|---|-------|----------|
| 10 | **التوثيق قديم** | `learn-dev.md` و `README.md` لسه بيذكروا `Supervisors` + `SupervisorDashboard` + `supervisorService` المحذوفين |
| 11 | **QuickAction بيستخدم `supervisorId`** | اسم الفيلد لسه `supervisorId` مع إن النظام اتحول لـ `employees` |
| 12 | **مفيش Store مركزي لـ HR** | بيانات HR (حضور، إجازات، إلخ) بتتحمل في state محلي في كل صفحة مش في Zustand — ممكن يأثر لو محتاج caching |

---

## ثالثاً: وحدات مخططة ولم تُنفذ بعد

### وحدة مراقبة الجودة (Quality Control) — من `QC.md`

| المرحلة | المحتوى | الحالة |
|---------|---------|--------|
| **Phase 1** | `quality_reports` + `quality_settings` + `defect_types` collections، صفحات QualityReports + QualityInspectors + QualitySettings، حساب qualityScore، RBAC (quality.view/create/edit/resolve)، ربط بتقارير الإنتاج | لم يُنفذ |
| **Phase 2** | أنواع الفحص (Sampling/Full/Batch)، نظام الخطورة (Minor/Major/Critical)، impactScore، تنبيهات ذكية، Pareto chart + Trend chart، إجراءات تصحيحية، ربط بخطط الإنتاج | لم يُنفذ |
| **IPQC** | `inprocess_quality_checks` collection، مراقبة حية للخطوط، منطق إيقاف الخط (Quality Hold)، إشعارات للمشرف والمدير، إعدادات (defectRateThreshold, requiredChecksPerShift) | لم يُنفذ |

---

## رابعاً: ملخص بالأرقام

| الفئة | العدد |
|--------|-------|
| إجمالي الصفحات | ~25 صفحة |
| إجمالي الخدمات (Services) | ~20 service |
| وحدات HR الفرعية | 4 (core, payroll, config, approval) |
| ملفات الوحدات المنفذة | ~45+ ملف |
| Firestore collections مستخدمة | ~30+ |
| Firestore rules مغطية | ~16 collection |
| **Firestore rules ناقصة** | **~15+ collection (كل HR)** |
| TODO/DEMO في الكود | 2 حاجة حرجة |
| وحدات لم تُنفذ | 1 (Quality Control — 3 مراحل) |

---

## خامساً: ترتيب الأولويات المقترح

```
1. 🔴 إضافة Firestore Rules لكل HR collections (حرج — بدونها مفيش HR يشتغل)
2. 🔴 استبدال DEMO_EMPLOYEES في الرواتب ببيانات حقيقية
3. 🔴 تحميل إعدادات الحضور من Firestore بدل القيم الثابتة
4. 🟡 تحديث ApprovalCenter ليستخدم المحرك المؤسسي الجديد
5. 🟡 إضافة HR collections للنسخ الاحتياطي
6. 🟡 صفحة إدارة التفويضات
7. 🟡 إضافة إعدادات الموافقات المؤسسية في HRSettings
8. 🟢 تحديث التوثيق (learn-dev.md + README.md)
9. 🟢 تنظيف supervisorId → employeeId
10. 🟢 استبدال placeholders في payslipGenerator
11. 🔵 وحدة مراقبة الجودة Phase 1
12. 🔵 وحدة مراقبة الجودة Phase 2
13. 🔵 IPQC — مراقبة الجودة أثناء الإنتاج
```
