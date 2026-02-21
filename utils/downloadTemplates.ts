import * as XLSX from 'xlsx';

export function downloadProductsTemplate() {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [
    ['اسم المنتج', 'الكود', 'الفئة', 'الرصيد الافتتاحي'],
    ['محرك H-400', 'PRD-001', 'المنتجات النهائية', 100],
    ['صمام V-200', 'PRD-002', 'المنتجات النهائية', 250],
    ['لوح معدني خام', 'PRD-003', 'المواد الخام', 500],
    ['محور دوران', 'PRD-004', 'نصف مصنع', 80],
    ['مسمار 10مم', 'PRD-005', 'المواد الخام', 2000],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, 'template_products.xlsx');
}

export function downloadReportsTemplate() {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [
    ['التاريخ', 'خط الإنتاج', 'المنتج', 'المشرف', 'الكمية المنتجة', 'الهالك', 'عدد العمال', 'ساعات العمل'],
    ['2026-02-16', 'خط 1', 'منتج أ', 'أحمد محمد', 500, 10, 8, 8],
    ['2026-02-16', 'خط 2', 'منتج ب', 'سعيد علي', 300, 5, 6, 8],
    ['2026-02-17', 'خط 1', 'منتج أ', 'أحمد محمد', 450, 8, 8, 8],
    ['2026-02-17', 'خط 3', 'منتج ج', 'محمود حسن', 600, 12, 10, 8],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
    { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, 'template_reports.xlsx');
}

export function downloadHRTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: الأقسام
  const deptAoa: (string | number)[][] = [
    ['اسم القسم', 'الرمز'],
    ['قسم الإنتاج', 'PRD'],
    ['قسم الجودة', 'QA'],
    ['قسم الصيانة', 'MNT'],
    ['قسم المخازن', 'WH'],
  ];
  const wsDept = XLSX.utils.aoa_to_sheet(deptAoa);
  wsDept['!cols'] = [{ wch: 24 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsDept, 'الأقسام');

  // Sheet 2: المناصب
  const posAoa: (string | number)[][] = [
    ['المنصب', 'القسم', 'المستوى'],
    ['مشغل آلة', 'قسم الإنتاج', 1],
    ['مشرف خط', 'قسم الإنتاج', 2],
    ['مدير الإنتاج', 'قسم الإنتاج', 3],
    ['فاحص جودة', 'قسم الجودة', 1],
    ['مشرف الجودة', 'قسم الجودة', 2],
    ['فني صيانة', 'قسم الصيانة', 1],
    ['أمين مخزن', 'قسم المخازن', 1],
  ];
  const wsPos = XLSX.utils.aoa_to_sheet(posAoa);
  wsPos['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsPos, 'المناصب');

  // Sheet 3: الموظفين
  const empAoa: (string | number)[][] = [
    ['اسم الموظف', 'الرمز', 'القسم', 'المنصب', 'المستوى', 'نوع التوظيف', 'الراتب الأساسي', 'أجر الساعة', 'الوردية'],
    ['أحمد محمد', 'EMP-001', 'قسم الإنتاج', 'مشغل آلة', 1, 'دوام كامل', 3000, 18.75, 'وردية صباحية'],
    ['سعيد علي', 'EMP-002', 'قسم الإنتاج', 'مشرف خط', 2, 'دوام كامل', 4500, 28.13, 'وردية صباحية'],
    ['خالد إبراهيم', 'EMP-003', 'قسم الجودة', 'فاحص جودة', 1, 'دوام كامل', 3200, 20, 'وردية صباحية'],
    ['محمود حسن', 'EMP-004', 'قسم الصيانة', 'فني صيانة', 1, 'عقد', 2800, 17.5, ''],
  ];
  const wsEmp = XLSX.utils.aoa_to_sheet(empAoa);
  wsEmp['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEmp, 'الموظفين');

  XLSX.writeFile(wb, 'template_hr_import.xlsx');
}
