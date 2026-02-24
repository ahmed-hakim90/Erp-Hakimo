# خطة تنظيف المشروع - Pro Tech ERP ✅

## ✅ المرحلة 1: إصلاح الباج

### CostCenters.tsx
- [x] زر "تعديل" كان بيروح لصفحة التوزيع — تم إصلاحه ليستدعي `openEdit(cc)`

---

## ✅ المرحلة 2: تنظيف الكود الميت

### LineWorkerAssignment.tsx
- [x] إزالة import `BarcodeScanner`
- [x] إزالة state `showCamera`
- [x] إزالة زر الكاميرا المعمولله comment out
- [x] إزالة modal `BarcodeScanner`

### CostSettings.tsx
- [x] إزالة قسم "ملخص تكاليف اليوم" المعمولله comment out
- [x] إزالة متغيرات `todayLaborHours` و `todayLaborCost` غير المستخدمة
- [x] إزالة import `todayReports` غير المستخدم

---

## ✅ المرحلة 3: أكشنات الداشبوردات

### FactoryManagerDashboard.tsx
- [x] كروت أوامر الشغل → `onClick` للتنقل إلى `/work-orders`
- [x] كروت خطط الإنتاج → `onClick` للتنقل إلى `/production-plans`
- [x] صفوف أداء المنتجات → `onClick` للتنقل إلى `/products/${id}`
- [x] إضافة `useNavigate` import

### AdminDashboard.tsx
- [x] عناصر سجل النشاط → `onClick` للتنقل إلى `/activity-log`
- [x] صفوف مراكز التكاليف → `onClick` للتنقل إلى `/cost-centers`
- [x] صفوف أداء المنتجات → `onClick` للتنقل إلى `/products/${id}`

---

## ✅ المرحلة 4: أكشنات صفحات التفاصيل

### LineDetails.tsx
- [x] كروت أوامر العمل → `onClick` للتنقل إلى `/work-orders`
- [x] صفوف التقارير → إزالة hover effect (مفيش صفحة تفاصيل للتقرير)

### ProductDetails.tsx
- [x] صفوف التقارير → إزالة hover effect
- [x] صفوف التكلفة حسب الخط → `onClick` للتنقل إلى `/lines/${lineId}`

### EmployeeProfile.tsx
- [x] أسماء المديرين في الهرم الوظيفي → `onClick` للتنقل إلى `/employees/${id}`
- [x] أسماء المرؤوسين المباشرين → `onClick` للتنقل إلى `/employees/${id}`

---

## ✅ المرحلة 5: أكشنات باقي الصفحات

### SupervisorDetails.tsx
- [x] صفوف التقارير → إزالة hover effect

### ProductionWorkerDetails.tsx
- [x] صفوف التقارير → إزالة hover effect

### ActivityLog.tsx
- [x] عناصر السجل → إزالة hover effect

### MonthlyProductionCosts.tsx
- [x] صفوف المنتجات → `onClick` للتنقل إلى `/products/${productId}`

### ProductionPlans.tsx
- [x] أسماء المنتجات في الجدول → `onClick` للتنقل إلى `/products/${productId}`
- [x] أسماء الخطوط في الجدول → `onClick` للتنقل إلى `/lines/${lineId}`

---

## ✅ المرحلة 6: التحسينات

### Layout.tsx
- [x] اسم الشركة في الهيدر → لينك للصفحة الرئيسية `/`

### WorkOrders.tsx
- [x] كروت KPI (نشط/مكتمل) → فلتر الجدول عند الضغط

### Employees.tsx
- [x] كروت الإحصائيات (الكل/نشط/غير نشط) → فلتر الجدول عند الضغط

### Dashboard.tsx
- [x] صفوف تحليل التكاليف → `onClick` للتنقل إلى `/products/${id}`

### UI.tsx (Card component)
- [x] إضافة prop `onClick` اختياري لمكون Card

---

## الملفات المعدلة (20 ملف)

| الملف | نوع التعديل |
|-------|------------|
| `CostCenters.tsx` | إصلاح باج |
| `LineWorkerAssignment.tsx` | تنظيف كود ميت |
| `CostSettings.tsx` | تنظيف كود ميت |
| `FactoryManagerDashboard.tsx` | إضافة أكشنات |
| `AdminDashboard.tsx` | إضافة أكشنات |
| `Lines.tsx` | إضافة سيكشن خطط + أكشنات |
| `LineDetails.tsx` | إضافة/إزالة أكشنات |
| `ProductDetails.tsx` | إضافة/إزالة أكشنات |
| `EmployeeProfile.tsx` | إضافة أكشنات |
| `SupervisorDetails.tsx` | إزالة hover وهمي |
| `ProductionWorkerDetails.tsx` | إزالة hover وهمي |
| `ActivityLog.tsx` | إزالة hover وهمي |
| `MonthlyProductionCosts.tsx` | إضافة أكشنات |
| `ProductionPlans.tsx` | إضافة أكشنات |
| `Layout.tsx` | لينك الهيدر |
| `WorkOrders.tsx` | فلتر KPI |
| `Employees.tsx` | فلتر KPI |
| `Dashboard.tsx` | إضافة أكشنات |
| `UI.tsx` | تحسين Card component |
| `CLEANUP_PLAN.md` | توثيق |
