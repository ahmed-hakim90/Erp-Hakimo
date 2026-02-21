import type { ThemeSettings } from '../types';
import { DEFAULT_THEME } from './dashboardConfig';

function hexToRgbString(hex: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return '19 146 236';
  return `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}`;
}

export function applyTheme(theme?: ThemeSettings): void {
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement;

  root.style.setProperty('--color-primary', hexToRgbString(t.primaryColor));
  root.style.setProperty('--color-secondary', hexToRgbString(t.secondaryColor));
  root.style.setProperty('--color-success', hexToRgbString(t.successColor));
  root.style.setProperty('--color-warning', hexToRgbString(t.warningColor));
  root.style.setProperty('--color-danger', hexToRgbString(t.dangerColor));
  root.style.setProperty('--color-background', t.backgroundColor);

  const fontStack = `'${t.baseFontFamily}', 'Noto Sans Arabic', sans-serif`;
  root.style.setProperty('--font-family-base', fontStack);
  root.style.setProperty('--font-size-base', `${t.baseFontSize}px`);
  root.style.setProperty('--border-radius-base', `${t.borderRadius}px`);
  root.style.setProperty('--density-scale', t.density === 'compact' ? '0.8' : '1');

  if (t.darkMode === 'dark') {
    root.classList.add('dark');
  } else if (t.darkMode === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  document.body.style.backgroundColor =
    root.classList.contains('dark') ? '#101a22' : t.backgroundColor;
}

let autoCleanup: (() => void) | null = null;

export function setupAutoThemeListener(theme?: ThemeSettings): void {
  if (autoCleanup) { autoCleanup(); autoCleanup = null; }
  const t = { ...DEFAULT_THEME, ...theme };
  if (t.darkMode !== 'auto') return;

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle('dark', e.matches);
    document.body.style.backgroundColor = e.matches ? '#101a22' : t.backgroundColor;
  };
  mq.addEventListener('change', handler);
  autoCleanup = () => mq.removeEventListener('change', handler);
}
