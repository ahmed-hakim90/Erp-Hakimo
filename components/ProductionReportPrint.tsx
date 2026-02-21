/**
 * ProductionReportPrint — Configurable printable production report.
 * Reads printTemplate settings from system_settings/global (via props).
 * Accepts data via props so it contains ZERO business logic.
 */
import React from 'react';
import type { ProductionReport, PrintTemplateSettings } from '../types';
import { DEFAULT_PRINT_TEMPLATE } from '../utils/dashboardConfig';

export interface ReportPrintRow {
  date: string;
  lineName: string;
  productName: string;
  employeeName: string;
  quantityProduced: number;
  quantityWaste: number;
  workersCount: number;
  workHours: number;
}

export interface ReportPrintProps {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  rows: ReportPrintRow[];
  totals?: {
    totalProduced: number;
    totalWaste: number;
    totalHours: number;
    totalWorkers: number;
    wasteRatio: string;
    reportsCount: number;
  };
  printSettings?: PrintTemplateSettings;
}

/**
 * Convert raw ProductionReport[] to ReportPrintRow[] using lookup fns.
 * Call this from the parent page — keeps logic out of the print component.
 */
export const mapReportsToPrintRows = (
  reports: ProductionReport[],
  lookups: {
    getLineName: (id: string) => string;
    getProductName: (id: string) => string;
    getEmployeeName: (id: string) => string;
  }
): ReportPrintRow[] =>
  reports.map((r) => ({
    date: r.date,
    lineName: lookups.getLineName(r.lineId),
    productName: lookups.getProductName(r.productId),
    employeeName: lookups.getEmployeeName(r.employeeId),
    quantityProduced: r.quantityProduced || 0,
    quantityWaste: r.quantityWaste || 0,
    workersCount: r.workersCount || 0,
    workHours: r.workHours || 0,
  }));

/**
 * Compute totals from rows.
 */
export const computePrintTotals = (rows: ReportPrintRow[], decimalPlaces = 0) => {
  const totalProduced = rows.reduce((s, r) => s + r.quantityProduced, 0);
  const totalWaste = rows.reduce((s, r) => s + r.quantityWaste, 0);
  const totalHours = rows.reduce((s, r) => s + r.workHours, 0);
  const totalWorkers = rows.reduce((s, r) => s + r.workersCount, 0);
  const total = totalProduced + totalWaste;
  const wasteRatio = total > 0 ? ((totalWaste / total) * 100).toFixed(decimalPlaces) : '0';
  return { totalProduced, totalWaste, totalHours, totalWorkers, wasteRatio, reportsCount: rows.length };
};

const PAPER_DIMENSIONS: Record<string, { width: string; minHeight: string }> = {
  a4: { width: '210mm', minHeight: '297mm' },
  a5: { width: '148mm', minHeight: '210mm' },
  thermal: { width: '80mm', minHeight: 'auto' },
};

function fmtNum(value: number, decimalPlaces: number): string {
  return value.toLocaleString('ar-EG', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export const ProductionReportPrint = React.forwardRef<HTMLDivElement, ReportPrintProps>(
  ({ title, subtitle, generatedAt, rows, totals, printSettings }, ref) => {
    const ps = { ...DEFAULT_PRINT_TEMPLATE, ...printSettings };
    const dp = ps.decimalPlaces;
    const t = totals ?? computePrintTotals(rows, dp);
    const now = generatedAt ?? new Date().toLocaleString('ar-EG');
    const paper = PAPER_DIMENSIONS[ps.paperSize] || PAPER_DIMENSIONS.a4;

    const showWaste = ps.showWaste;
    const showEmployee = ps.showEmployee;

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          fontFamily: 'Calibri, Segoe UI, Tahoma, sans-serif',
          width: paper.width,
          minHeight: paper.minHeight,
          padding: ps.paperSize === 'thermal' ? '4mm 3mm' : '12mm 15mm',
          background: '#fff',
          color: '#1e293b',
          fontSize: ps.paperSize === 'thermal' ? '8pt' : '11pt',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      >
        {/* ── Factory Header ── */}
        <div style={{ textAlign: 'center', marginBottom: ps.paperSize === 'thermal' ? '3mm' : '8mm', borderBottom: `3px solid ${ps.primaryColor}`, paddingBottom: ps.paperSize === 'thermal' ? '2mm' : '6mm' }}>
          {ps.logoUrl && (
            <img
              src={ps.logoUrl}
              alt="logo"
              style={{ maxHeight: ps.paperSize === 'thermal' ? '12mm' : '20mm', marginBottom: '2mm', objectFit: 'contain' }}
            />
          )}
          <h1 style={{ margin: 0, fontSize: ps.paperSize === 'thermal' ? '12pt' : '20pt', fontWeight: 900, color: ps.primaryColor }}>
            {ps.headerText}
          </h1>
          <p style={{ margin: '2mm 0 0', fontSize: ps.paperSize === 'thermal' ? '7pt' : '10pt', color: '#64748b', fontWeight: 600 }}>
            نظام إدارة الإنتاج — تقارير الإنتاج
          </p>
        </div>

        {/* ── Report Title ── */}
        <div style={{ marginBottom: ps.paperSize === 'thermal' ? '3mm' : '6mm' }}>
          <h2 style={{ margin: 0, fontSize: ps.paperSize === 'thermal' ? '10pt' : '16pt', fontWeight: 800, color: '#0f172a' }}>{title}</h2>
          {subtitle && <p style={{ margin: '1mm 0 0', fontSize: ps.paperSize === 'thermal' ? '7pt' : '10pt', color: '#64748b' }}>{subtitle}</p>}
          <p style={{ margin: '2mm 0 0', fontSize: ps.paperSize === 'thermal' ? '6pt' : '9pt', color: '#94a3b8' }}>تاريخ الطباعة: {now}</p>
        </div>

        {/* ── Summary Cards ── */}
        <div style={{ display: 'flex', gap: ps.paperSize === 'thermal' ? '2mm' : '4mm', marginBottom: ps.paperSize === 'thermal' ? '3mm' : '6mm', flexWrap: 'wrap' }}>
          <SummaryBox label="إجمالي الإنتاج" value={fmtNum(t.totalProduced, dp)} unit="وحدة" color={ps.primaryColor} small={ps.paperSize === 'thermal'} />
          {showWaste && (
            <>
              <SummaryBox label="إجمالي الهالك" value={fmtNum(t.totalWaste, dp)} unit="وحدة" color="#f43f5e" small={ps.paperSize === 'thermal'} />
              <SummaryBox label="نسبة الهالك" value={`${t.wasteRatio}%`} color="#f59e0b" small={ps.paperSize === 'thermal'} />
            </>
          )}
          <SummaryBox label="إجمالي الساعات" value={fmtNum(t.totalHours, dp)} unit="ساعة" color="#8b5cf6" small={ps.paperSize === 'thermal'} />
          <SummaryBox label="عدد التقارير" value={String(t.reportsCount)} color="#64748b" small={ps.paperSize === 'thermal'} />
        </div>

        {/* ── Data Table ── */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: ps.paperSize === 'thermal' ? '7pt' : '9.5pt',
            marginBottom: ps.paperSize === 'thermal' ? '3mm' : '8mm',
          }}
        >
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <Th>#</Th>
              <Th>التاريخ</Th>
              <Th>خط الإنتاج</Th>
              <Th>المنتج</Th>
              {showEmployee && <Th>الموظف</Th>}
              <Th align="center">الكمية المنتجة</Th>
              {showWaste && <Th align="center">الهالك</Th>}
              <Th align="center">عدد العمال</Th>
              <Th align="center">ساعات العمل</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <Td>{i + 1}</Td>
                <Td>{row.date}</Td>
                <Td>{row.lineName}</Td>
                <Td>{row.productName}</Td>
                {showEmployee && <Td>{row.employeeName}</Td>}
                <Td align="center" bold color="#059669">{fmtNum(row.quantityProduced, dp)}</Td>
                {showWaste && <Td align="center" bold>{fmtNum(row.quantityWaste, dp)}</Td>}
                <Td align="center">{row.workersCount}</Td>
                <Td align="center">{fmtNum(row.workHours, dp)}</Td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr style={{ background: '#e2e8f0', fontWeight: 800 }}>
              <Td colSpan={showEmployee ? 5 : 4}>الإجمالي</Td>
              <Td align="center" bold color="#059669">{fmtNum(t.totalProduced, dp)}</Td>
              {showWaste && <Td align="center" bold color="#f43f5e">{fmtNum(t.totalWaste, dp)}</Td>}
              <Td align="center">{fmtNum(t.totalWorkers, dp)}</Td>
              <Td align="center">{fmtNum(t.totalHours, dp)}</Td>
            </tr>
          </tbody>
        </table>

        {/* ── Signature Section ── */}
        {ps.paperSize !== 'thermal' && (
          <div style={{ marginTop: '15mm', display: 'flex', justifyContent: 'space-between', gap: '20mm' }}>
            <SignatureBlock label="مدير الإنتاج" />
            {showEmployee && <SignatureBlock label="موظف الخط" />}
            <SignatureBlock label="مراقب الجودة" />
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ marginTop: ps.paperSize === 'thermal' ? '3mm' : '10mm', borderTop: '1px solid #e2e8f0', paddingTop: '3mm', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: ps.paperSize === 'thermal' ? '6pt' : '8pt', color: '#94a3b8' }}>
            {ps.footerText} — {now}
          </p>
        </div>
      </div>
    );
  }
);

ProductionReportPrint.displayName = 'ProductionReportPrint';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SingleReportPrint — Printable layout for ONE production report            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export interface SingleReportPrintProps {
  report: ReportPrintRow | null;
  printSettings?: PrintTemplateSettings;
}

export const SingleReportPrint = React.forwardRef<HTMLDivElement, SingleReportPrintProps>(
  ({ report, printSettings }, ref) => {
    if (!report) return <div ref={ref} />;

    const ps = { ...DEFAULT_PRINT_TEMPLATE, ...printSettings };
    const dp = ps.decimalPlaces;
    const now = new Date().toLocaleString('ar-EG');
    const total = report.quantityProduced + report.quantityWaste;
    const wasteRatio = total > 0 ? ((report.quantityWaste / total) * 100).toFixed(dp) : '0';
    const paper = PAPER_DIMENSIONS[ps.paperSize] || PAPER_DIMENSIONS.a4;

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          fontFamily: 'Calibri, Segoe UI, Tahoma, sans-serif',
          width: paper.width,
          minHeight: ps.paperSize === 'a4' ? '148mm' : paper.minHeight,
          padding: ps.paperSize === 'thermal' ? '4mm 3mm' : '12mm 15mm',
          background: '#fff',
          color: '#1e293b',
          fontSize: ps.paperSize === 'thermal' ? '8pt' : '11pt',
          lineHeight: 1.6,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: ps.paperSize === 'thermal' ? '3mm' : '8mm', borderBottom: `3px solid ${ps.primaryColor}`, paddingBottom: ps.paperSize === 'thermal' ? '2mm' : '6mm' }}>
          {ps.logoUrl && (
            <img
              src={ps.logoUrl}
              alt="logo"
              style={{ maxHeight: ps.paperSize === 'thermal' ? '12mm' : '20mm', marginBottom: '2mm', objectFit: 'contain' }}
            />
          )}
          <h1 style={{ margin: 0, fontSize: ps.paperSize === 'thermal' ? '12pt' : '20pt', fontWeight: 900, color: ps.primaryColor }}>
            {ps.headerText}
          </h1>
          <p style={{ margin: '2mm 0 0', fontSize: ps.paperSize === 'thermal' ? '7pt' : '10pt', color: '#64748b', fontWeight: 600 }}>
            تقرير انتاج
          </p>
        </div>

        {/* Report Title */}
        <div style={{ marginBottom: ps.paperSize === 'thermal' ? '3mm' : '8mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: ps.paperSize === 'thermal' ? '9pt' : '15pt', fontWeight: 800, color: '#0f172a' }}>تقرير إنتاج</h2>
            <p style={{ margin: '1mm 0 0', fontSize: ps.paperSize === 'thermal' ? '7pt' : '10pt', color: '#64748b' }}>
              {report.lineName} — {report.date}
            </p>
          </div>
          <div style={{ textAlign: 'left', fontSize: ps.paperSize === 'thermal' ? '6pt' : '9pt', color: '#94a3b8' }}>
            تاريخ الطباعة: {now}
          </div>
        </div>

        {/* Report Details */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: ps.paperSize === 'thermal' ? '7.5pt' : '10.5pt',
            marginBottom: ps.paperSize === 'thermal' ? '3mm' : '8mm',
          }}
        >
          <tbody>
            <DetailRow label="التاريخ" value={report.date} />
            <DetailRow label="خط الإنتاج" value={report.lineName} even />
            <DetailRow label="المنتج" value={report.productName} />
            {ps.showEmployee && <DetailRow label="الموظف" value={report.employeeName} even />}
            <DetailRow label="الكمية المنتجة" value={`${fmtNum(report.quantityProduced, dp)} وحدة`} highlight="#059669" />
            {ps.showWaste && (
              <>
                <DetailRow label="الهالك" value={`${fmtNum(report.quantityWaste, dp)} وحدة`} highlight="#f43f5e" even />
                <DetailRow label="نسبة الهالك" value={`${wasteRatio}%`} />
              </>
            )}
            <DetailRow label="عدد العمال" value={String(report.workersCount)} even />
            <DetailRow label="ساعات العمل" value={fmtNum(report.workHours, dp)} />
          </tbody>
        </table>

        {/* Signature Section */}
        {ps.paperSize !== 'thermal' && (
          <div style={{ marginTop: '20mm', display: 'flex', justifyContent: 'space-between', gap: '20mm' }}>
            <SignatureBlock label="مدير الإنتاج" />
            {ps.showEmployee && <SignatureBlock label="موظف الخط" />}
            <SignatureBlock label="مراقب الجودة" />
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: ps.paperSize === 'thermal' ? '3mm' : '10mm', borderTop: '1px solid #e2e8f0', paddingTop: '3mm', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: ps.paperSize === 'thermal' ? '6pt' : '8pt', color: '#94a3b8' }}>
            {ps.footerText} — {now}
          </p>
        </div>
      </div>
    );
  }
);

SingleReportPrint.displayName = 'SingleReportPrint';

/* ─── Helper sub-components (inline styled for print isolation) ───────── */

const DetailRow: React.FC<{
  label: string;
  value: string;
  even?: boolean;
  highlight?: string;
}> = ({ label, value, even, highlight }) => (
  <tr style={{ background: even ? '#f8fafc' : '#fff' }}>
    <td
      style={{
        padding: '3mm 4mm',
        fontWeight: 700,
        color: '#475569',
        borderBottom: '1px solid #e2e8f0',
        width: '35%',
        fontSize: '10pt',
      }}
    >
      {label}
    </td>
    <td
      style={{
        padding: '3mm 4mm',
        fontWeight: highlight ? 800 : 400,
        color: highlight || '#0f172a',
        borderBottom: '1px solid #e2e8f0',
        fontSize: highlight ? '12pt' : '10.5pt',
      }}
    >
      {value}
    </td>
  </tr>
);

const SummaryBox: React.FC<{ label: string; value: string; unit?: string; color: string; small?: boolean }> = ({ label, value, unit, color, small }) => (
  <div style={{ flex: '1 1 0', minWidth: small ? '18mm' : '30mm', border: '1px solid #e2e8f0', borderRadius: '3mm', padding: small ? '1.5mm 2mm' : '3mm 4mm', textAlign: 'center' }}>
    <p style={{ margin: 0, fontSize: small ? '6pt' : '8pt', color: '#64748b', fontWeight: 600 }}>{label}</p>
    <p style={{ margin: '1mm 0 0', fontSize: small ? '10pt' : '14pt', fontWeight: 900, color }}>
      {value}
      {unit && <span style={{ fontSize: small ? '5pt' : '8pt', fontWeight: 600, marginRight: '1mm', color: '#94a3b8' }}>{unit}</span>}
    </p>
  </div>
);

const Th: React.FC<{ children: React.ReactNode; align?: string }> = ({ children, align }) => (
  <th
    style={{
      padding: '2.5mm 3mm',
      textAlign: (align || 'right') as any,
      fontWeight: 800,
      fontSize: '8.5pt',
      color: '#475569',
      borderBottom: '2px solid #cbd5e1',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; align?: string; bold?: boolean; color?: string; colSpan?: number }> = ({
  children, align, bold, color, colSpan,
}) => (
  <td
    colSpan={colSpan}
    style={{
      padding: '2mm 3mm',
      textAlign: (align || 'right') as any,
      fontWeight: bold ? 700 : 400,
      color: color || '#334155',
      borderBottom: '1px solid #e2e8f0',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </td>
);

const SignatureBlock: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ flex: 1, textAlign: 'center' }}>
    <p style={{ margin: 0, fontSize: '9pt', fontWeight: 700, color: '#475569' }}>{label}</p>
    <div style={{ marginTop: '12mm', borderBottom: '1px solid #94a3b8', width: '80%', marginLeft: 'auto', marginRight: 'auto' }} />
    <p style={{ margin: '2mm 0 0', fontSize: '8pt', color: '#94a3b8' }}>التوقيع / التاريخ</p>
  </div>
);
