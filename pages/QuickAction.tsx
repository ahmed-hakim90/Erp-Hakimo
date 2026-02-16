import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useAppStore } from '../store/useAppStore';
import { Card, Button } from '../components/UI';
import { usePermission } from '../utils/permissions';

export const QuickAction: React.FC = () => {
  const { canCreateReport } = usePermission();
  const createReport = useAppStore((s) => s.createReport);
  const productionLines = useAppStore((s) => s.productionLines);
  const products = useAppStore((s) => s.products);
  const _rawLines = useAppStore((s) => s._rawLines);
  const _rawProducts = useAppStore((s) => s._rawProducts);
  const supervisors = useAppStore((s) => s.supervisors);
  const uid = useAppStore((s) => s.uid);

  const [lineId, setLineId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [waste, setWaste] = useState('');
  const [workers, setWorkers] = useState('');
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<any>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleSave = async () => {
    if (!lineId || !productId || !quantity || !workers || !hours || !uid) return;
    setSaving(true);

    const data = {
      supervisorId: uid,
      lineId,
      productId,
      date: today,
      quantityProduced: Number(quantity),
      quantityWaste: Number(waste) || 0,
      workersCount: Number(workers),
      workHours: Number(hours),
    };

    const id = await createReport(data);

    if (id) {
      const lineName = _rawLines.find((l) => l.id === lineId)?.name ?? lineId;
      const productName = _rawProducts.find((p) => p.id === productId)?.name ?? productId;

      setLastSavedData({
        ...data,
        id,
        lineName,
        productName,
        date: new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      });
      setSaved(true);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setLineId('');
    setProductId('');
    setQuantity('');
    setWaste('');
    setWorkers('');
    setHours('');
    setSaved(false);
    setLastSavedData(null);
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html dir="rtl"><head>
        <title>تقرير إنتاج سريع</title>
        <style>body{font-family:sans-serif;padding:40px;direction:rtl}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ddd;padding:12px;text-align:right}th{background:#f5f5f5}</style>
      </head><body>${reportRef.current.innerHTML}</body></html>
    `);
    printWin.document.close();
    printWin.print();
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير-سريع-${today}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareWhatsApp = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    if (navigator.share && navigator.canShare) {
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      const file = new File([blob], `report-${today}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'تقرير إنتاج', files: [file] });
        return;
      }
    }

    // Fallback: download then open WhatsApp
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${today}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.open(
      `https://wa.me/?text=${encodeURIComponent(`تقرير إنتاج - ${today}`)}`,
      '_blank'
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">إدخال سريع</h2>
        <p className="text-sm text-slate-500 font-medium">إدخال بيانات الإنتاج بسرعة — حفظ، طباعة، ومشاركة.</p>
      </div>

      {!saved ? (
        /* ── Entry Form ── */
        <Card title="بيانات التقرير">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">خط الإنتاج</label>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">اختر الخط</option>
                {_rawLines.map((l) => (
                  <option key={l.id} value={l.id!}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">المنتج</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">اختر المنتج</option>
                {_rawProducts.map((p) => (
                  <option key={p.id} value={p.id!}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">الكمية المنتجة</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">الهالك</label>
              <input
                type="number"
                value={waste}
                onChange={(e) => setWaste(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">عدد العمال</label>
              <input
                type="number"
                value={workers}
                onChange={(e) => setWorkers(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="0"
                min="1"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">ساعات العمل</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              onClick={handleSave}
              disabled={saving || !lineId || !productId || !quantity || !workers || !hours || !canCreateReport}
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <span className="material-icons-round text-lg">save</span>
                  حفظ
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <span className="material-icons-round text-lg">refresh</span>
              مسح
            </Button>
          </div>
        </Card>
      ) : (
        /* ── Saved Report Preview & Actions ── */
        <div className="space-y-4">
          {/* Success Banner */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="material-icons-round text-emerald-500 text-2xl">check_circle</span>
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">تم حفظ التقرير بنجاح!</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">يمكنك الآن الطباعة أو التصدير أو المشاركة.</p>
            </div>
          </div>

          {/* Report Card (for capture) */}
          <div ref={reportRef}>
            <div className="bg-white rounded-xl border border-slate-200 p-6" style={{ direction: 'rtl' }}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white">
                  <span className="material-icons-round">factory</span>
                </div>
                <div>
                  <h3 className="font-black text-lg text-primary">HAKIMO</h3>
                  <p className="text-xs text-slate-400">تقرير إنتاج سريع</p>
                </div>
                <span className="mr-auto text-sm text-slate-500 font-bold">{lastSavedData?.date}</span>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-bold text-slate-500 w-40">خط الإنتاج</td>
                    <td className="py-3 font-bold text-slate-800">{lastSavedData?.lineName}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-bold text-slate-500">المنتج</td>
                    <td className="py-3 font-bold text-slate-800">{lastSavedData?.productName}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-bold text-slate-500">الكمية المنتجة</td>
                    <td className="py-3 font-bold text-emerald-600 text-lg">{lastSavedData?.quantityProduced}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-bold text-slate-500">الهالك</td>
                    <td className="py-3 font-bold text-rose-500">{lastSavedData?.quantityWaste}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 font-bold text-slate-500">عدد العمال</td>
                    <td className="py-3 font-bold text-slate-800">{lastSavedData?.workersCount}</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-slate-500">ساعات العمل</td>
                    <td className="py-3 font-bold text-slate-800">{lastSavedData?.workHours}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePrint}>
              <span className="material-icons-round text-lg">print</span>
              طباعة
            </Button>
            <Button variant="secondary" onClick={handleExportImage}>
              <span className="material-icons-round text-lg">image</span>
              تصدير كصورة
            </Button>
            <Button variant="outline" onClick={handleShareWhatsApp}>
              <span className="material-icons-round text-lg">share</span>
              مشاركة عبر WhatsApp
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <span className="material-icons-round text-lg">add</span>
              تقرير جديد
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
