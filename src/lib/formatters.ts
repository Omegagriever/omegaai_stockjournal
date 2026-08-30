/**
 * Defensive numerical and currency formatting utilities to prevent any TypeError: null / undefined .toFixed exceptions
 */

export function safeNumber(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

export function safeToFixed(val: unknown, digits: number = 2, fallback: string = '0.00'): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;
  return num.toFixed(digits);
}

export function formatCurrency(val: unknown, digits: number = 2): string {
  const num = safeNumber(val, 0);
  return '$' + num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(val: unknown, digits: number = 2): string {
  const num = safeNumber(val, 0);
  return num.toFixed(digits) + '%';
}
