export function isISODateString(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(s);
}

export function isBRDateString(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(s);
}

export function toISODate(input: unknown): string | null {
  if (input == null) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (isISODateString(s)) {
      // Keep only YYYY-MM-DD
      const [datePart] = s.split('T');
      return datePart.split(' ')[0];
    }
    if (isBRDateString(s)) {
      const [dd, mm, yyyy] = s.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return toISODate(d);
  }
  return null;
}

export function formatISODate(value: unknown, locale: string = 'pt-BR'): string {
  const iso = toISODate(value);
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  // Fast path without timezone issues
  return `${d}/${m}/${y}`;
}

export function ensureDateInputValue(value: unknown): string {
  return toISODate(value) ?? '';
}

export function formatDateTime(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || isBRDateString(s)) {
      return formatISODate(s);
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return formatDateTime(d);
  }
  return formatISODate(value);
}

