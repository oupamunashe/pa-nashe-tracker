/* ---------------- utils (from prototype core.js) ---------------- */
import { MONTHS } from './constants';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const r2 = (n: unknown) => Math.round((+(n as number) || 0) * 100) / 100;
export const sum = <T>(a: T[], f: (x: T) => unknown = x => x) => a.reduce((t, x) => t + (+(f(x) as number) || 0), 0);
export function fmt(n: unknown, dp = 2) {
  const v = +(n as number) || 0;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (v < -0.004 ? '–R' : 'R') + s;
}
export const fmt0 = (n: unknown) => fmt(n, 0);
export const pct = (n: number, dp = 0) => (isFinite(n) ? (n * 100).toFixed(dp) : '0') + '%';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export const mkey = (d: unknown) => String(d).slice(0, 7);
export const mName = (k: string) => MONTHS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
export const mShort = (k: string) => MONTHS[+k.slice(5, 7) - 1].slice(0, 3);
export function nextKey(k: string) { let y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); }
export function prevKey(k: string) { let y = +k.slice(0, 4), m = +k.slice(5, 7) - 1; if (m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); }
export function fmtDate(d: string | null | undefined) { if (!d) return ''; const [y, m, dd] = d.split('-'); return +dd + ' ' + MONTHS[+m - 1].slice(0, 3) + (y !== String(new Date().getFullYear()) ? ' ' + y : ''); }
export const slug = (s: unknown) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || uid();
