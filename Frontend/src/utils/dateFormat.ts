const LOCALE = 'th-TH';

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(LOCALE, { dateStyle: 'medium' });
}

export function fmtTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m} น.`;
}

export function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString(LOCALE, { dateStyle: 'medium' })} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} น.`;
}
