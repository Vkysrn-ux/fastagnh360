// lib/date-format.ts
export function formatERPDate(input: any): string {
  if (!input) return '-';
  try {
    // If input is already like YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, slice it
    const s = String(input);
    const ymd = s.slice(0, 10);
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, yyyy, mm, dd] = m;
      return `${dd}-${mm}-${yyyy}`;
    }
    // Try to parse as Date
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      return `${dd}-${mm}-${yyyy}`;
    }
  } catch {}
  return String(input);
}

