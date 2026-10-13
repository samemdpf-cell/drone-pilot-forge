export function expiryStatus(expires: string | null | undefined, today: string): 'expired' | 'soon' | 'valid' | 'unknown' {
  if (!expires || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return 'unknown';
  const end = Date.parse(`${expires}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== expires || !Number.isFinite(start)) return 'unknown';
  const days = (end - start) / 86400000;
  return days < 0 ? 'expired' : days <= 30 ? 'soon' : 'valid';
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}