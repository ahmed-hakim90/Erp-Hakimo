import type { ExportImportPageControl, ExportImportSettings } from '../types';
import { DEFAULT_EXPORT_IMPORT_PAGE_CONTROL } from './dashboardConfig';

export interface ExportImportPageRegistryItem {
  key: string;
  label: string;
  path: string;
}

export const EXPORT_IMPORT_PAGE_REGISTRY: ExportImportPageRegistryItem[] = [
  { key: 'reports', label: 'صفحة التقارير', path: '/reports' },
  { key: 'products', label: 'صفحة المنتجات', path: '/products' },
];

export function getExportImportPageControl(
  settings: ExportImportSettings | null | undefined,
  pageKey: string,
): ExportImportPageControl {
  return {
    ...DEFAULT_EXPORT_IMPORT_PAGE_CONTROL,
    ...(settings?.pages?.[pageKey] ?? {}),
  };
}
