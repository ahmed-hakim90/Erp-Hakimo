/**
 * Excel Import Utility for Products — parse .xlsx/.xls into FirestoreProduct data.
 * Supports both creating new products and updating existing ones (matched by code).
 */
import * as XLSX from 'xlsx';
import type { FirestoreProduct } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ImportAction = 'create' | 'update';

export interface ParsedProductRow {
  rowIndex: number;
  action: ImportAction;
  matchedId?: string;
  name: string;
  code: string;
  model: string;
  openingBalance: number;
  chineseUnitCost: number;
  innerBoxCost: number;
  outerCartonCost: number;
  unitsPerCarton: number;
  sellingPrice: number;
  errors: string[];
  changes?: string[];
}

export interface ProductImportResult {
  rows: ParsedProductRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  newCount: number;
  updateCount: number;
}

// ─── Header mapping (Arabic → field) ────────────────────────────────────────

const HEADER_MAP: Record<string, string> = {
  'اسم المنتج': 'name',
  'المنتج': 'name',
  'الاسم': 'name',
  'اسم': 'name',
  'الكود': 'code',
  'كود': 'code',
  'كود المنتج': 'code',
  'الفئة': 'model',
  'فئة': 'model',
  'الموديل': 'model',
  'موديل': 'model',
  'الفئة / الموديل': 'model',
  'النوع': 'model',
  'الرصيد الافتتاحي': 'openingBalance',
  'رصيد افتتاحي': 'openingBalance',
  'الرصيد': 'openingBalance',
  'رصيد': 'openingBalance',
  'تكلفة الوحدة الصينية': 'chineseUnitCost',
  'الوحدة الصينية': 'chineseUnitCost',
  'تكلفة صينية': 'chineseUnitCost',
  'تكلفة العلبة الداخلية': 'innerBoxCost',
  'العلبة الداخلية': 'innerBoxCost',
  'علبة داخلية': 'innerBoxCost',
  'تكلفة الكرتونة الخارجية': 'outerCartonCost',
  'الكرتونة الخارجية': 'outerCartonCost',
  'تكلفة الكرتونة': 'outerCartonCost',
  'كرتونة': 'outerCartonCost',
  'عدد الوحدات في الكرتونة': 'unitsPerCarton',
  'وحدات/كرتونة': 'unitsPerCarton',
  'وحدات الكرتونة': 'unitsPerCarton',
  'سعر البيع': 'sellingPrice',
  'سعر بيع': 'sellingPrice',
  'سعر': 'sellingPrice',
};

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, ' ');
}

// ─── Lookup helpers ─────────────────────────────────────────────────────────

interface ProductLookup {
  byCode: Map<string, FirestoreProduct>;
  byName: Map<string, FirestoreProduct>;
}

function buildLookup(products: FirestoreProduct[]): ProductLookup {
  const byCode = new Map<string, FirestoreProduct>();
  const byName = new Map<string, FirestoreProduct>();
  for (const p of products) {
    byCode.set(p.code.trim().toLowerCase(), p);
    byName.set(p.name.trim().toLowerCase(), p);
  }
  return { byCode, byName };
}

function describeChanges(existing: FirestoreProduct, row: ParsedProductRow): string[] {
  const changes: string[] = [];
  if (existing.name !== row.name) changes.push(`الاسم: ${existing.name} ← ${row.name}`);
  if ((existing.model || '') !== row.model) changes.push(`الفئة`);
  if ((existing.openingBalance || 0) !== row.openingBalance) changes.push(`الرصيد: ${existing.openingBalance || 0} ← ${row.openingBalance}`);
  if ((existing.chineseUnitCost || 0) !== row.chineseUnitCost) changes.push(`تكلفة صينية`);
  if ((existing.innerBoxCost || 0) !== row.innerBoxCost) changes.push(`علبة داخلية`);
  if ((existing.outerCartonCost || 0) !== row.outerCartonCost) changes.push(`كرتونة خارجية`);
  if ((existing.unitsPerCarton || 0) !== row.unitsPerCarton) changes.push(`وحدات/كرتونة`);
  if ((existing.sellingPrice || 0) !== row.sellingPrice) changes.push(`سعر البيع`);
  return changes;
}

// ─── Main parse function ────────────────────────────────────────────────────

export function parseProductsExcel(
  file: File,
  existingProducts: FirestoreProduct[],
): Promise<ProductImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (jsonRows.length === 0) {
          resolve({ rows: [], totalRows: 0, validCount: 0, errorCount: 0, newCount: 0, updateCount: 0 });
          return;
        }

        const rawHeaders = Object.keys(jsonRows[0]);
        const headerMapping: Record<string, string> = {};
        for (const rawH of rawHeaders) {
          const norm = normalizeHeader(rawH);
          const mapped = HEADER_MAP[norm];
          if (mapped) headerMapping[rawH] = mapped;
        }

        const lookup = buildLookup(existingProducts);
        const seenCodes = new Set<string>();

        const rows: ParsedProductRow[] = jsonRows.map((row, idx) => {
          const errors: string[] = [];

          const getValue = (field: string): any => {
            const key = rawHeaders.find((h) => headerMapping[h] === field);
            return key ? row[key] : undefined;
          };

          const name = String(getValue('name') ?? '').trim();
          if (!name) errors.push('اسم المنتج مفقود');

          const code = String(getValue('code') ?? '').trim();
          if (!code) errors.push('الكود مفقود');
          else if (seenCodes.has(code.toLowerCase())) {
            errors.push(`الكود "${code}" مكرر في الملف`);
          }
          if (code) seenCodes.add(code.toLowerCase());

          const model = String(getValue('model') ?? '').trim();
          const openingBalance = Number(getValue('openingBalance')) || 0;
          const chineseUnitCost = Number(getValue('chineseUnitCost')) || 0;
          const innerBoxCost = Number(getValue('innerBoxCost')) || 0;
          const outerCartonCost = Number(getValue('outerCartonCost')) || 0;
          const unitsPerCarton = Number(getValue('unitsPerCarton')) || 0;
          const sellingPrice = Number(getValue('sellingPrice')) || 0;

          const existingByCode = code ? lookup.byCode.get(code.toLowerCase()) : undefined;
          const action: ImportAction = existingByCode ? 'update' : 'create';
          const matchedId = existingByCode?.id;

          const parsed: ParsedProductRow = {
            rowIndex: idx + 2,
            action,
            matchedId,
            name,
            code,
            model,
            openingBalance,
            chineseUnitCost,
            innerBoxCost,
            outerCartonCost,
            unitsPerCarton,
            sellingPrice,
            errors,
          };

          if (action === 'update' && existingByCode && errors.length === 0) {
            parsed.changes = describeChanges(existingByCode, parsed);
          }

          return parsed;
        });

        const validRows = rows.filter((r) => r.errors.length === 0);
        const newCount = validRows.filter((r) => r.action === 'create').length;
        const updateCount = validRows.filter((r) => r.action === 'update').length;

        resolve({
          rows,
          totalRows: rows.length,
          validCount: validRows.length,
          errorCount: rows.length - validRows.length,
          newCount,
          updateCount,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
    reader.readAsArrayBuffer(file);
  });
}

export function toProductData(row: ParsedProductRow): Omit<FirestoreProduct, 'id'> {
  return {
    name: row.name,
    code: row.code,
    model: row.model,
    openingBalance: row.openingBalance,
    chineseUnitCost: row.chineseUnitCost,
    innerBoxCost: row.innerBoxCost,
    outerCartonCost: row.outerCartonCost,
    unitsPerCarton: row.unitsPerCarton,
    sellingPrice: row.sellingPrice,
  };
}
