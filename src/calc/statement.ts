/* ---------------- statement parsing & classification – verbatim from prototype io.js ---------------- */
import { MONTHS } from '../core/constants';
import { fmtDate, r2 } from '../core/format';
import { S, accs, cat, isLiab, main, monthKeys } from '../core/state';
import type { Who } from '../core/types';
import { balances } from './balances';
import { liveTxns, type LiveTxn } from './month';

export interface StatementRow { d: string; amt: number; ty: string; ds: string; ben: string }
export interface ClassifiedRow extends StatementRow {
  i: number; eff: number; st: string; act: 'skip' | 'ledger' | 'budget'; note?: string; lty?: string; it?: string | null; other?: string | null; userIt?: boolean;
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
export function normDate(v: unknown): string | null {
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  const s = String(v || '').trim(); let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/))) { const mm = m; const mi = MONTHS.findIndex(x => x.slice(0, 3).toLowerCase() === mm[2].toLowerCase()); if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
export function rowsToStatement(rows: any[][]): StatementRow[] {
  const hi = rows.findIndex(r => r.some(c => /date/i.test(c)) && r.some(c => /amount|debit|credit/i.test(c)));
  if (hi < 0) throw new Error('Couldn’t find the Date and Amount columns in this file.');
  const h = rows[hi].map(c => String(c).trim());
  const f = (re: RegExp) => h.findIndex(c => re.test(c));
  const iD = f(/value date|^date/i) >= 0 ? f(/value date|^date/i) : f(/date/i), iDs = f(/description|details|narrative|reference/i), iB = f(/beneficiary|cardholder/i), iT = f(/^type$|transaction type/i);
  const iA = f(/^amount|amount$/i), iDr = f(/debit/i), iCr = f(/credit/i);
  return rows.slice(hi + 1).map(r => {
    const d = normDate(r[iD]); if (!d) return null;
    const amt = iA >= 0 ? parseFloat(String(r[iA]).replace(/[^0-9.\-]/g, '')) : (parseFloat(String(r[iCr] || 0).replace(/[^0-9.\-]/g, '')) || 0) - Math.abs(parseFloat(String(r[iDr] || 0).replace(/[^0-9.\-]/g, '')) || 0);
    if (!isFinite(amt) || !amt) return null;
    return { d, amt: r2(amt), ty: iT >= 0 ? String(r[iT] || '').trim() : '', ds: String(r[iDs] ?? '').trim(), ben: iB >= 0 ? String(r[iB] ?? '').trim() : '' };
  }).filter(Boolean) as StatementRow[];
}
export function suggestItem(text: string): string | null {
  const T = text.toUpperCase();
  const hit = (main().rules || []).find(([kw]) => kw && T.includes(String(kw).toUpperCase()));
  return hit && cat()[hit[1]] ? hit[1] : null;
}
export function personFromText(text: unknown): Who | null {
  const P: any = main().people || {}, T = ' ' + String(text || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const toks = (w: Who) => [...String(P[w]?.full || '').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/), ...String(P[w]?.alias || '').toUpperCase().split(/[,\s]+/)].filter(x => x.length > 1);
  const tp = toks('P'), tm = toks('M');
  const shared = tp.filter(x => tm.includes(x));
  const hits = (['P', 'M'] as Who[]).filter(w => {
    const own = (w === 'P' ? tp : tm), uniq = own.filter(x => !shared.includes(x));
    if (uniq.some(x => T.includes(' ' + x + ' '))) return true;
    const given = String(P[w]?.full || '').toUpperCase().replace(/\(.*?\)/g, ' ').split(/\s+/).filter(x => x.length > 1 && !shared.includes(x));
    const ini = given.map(x => x[0]).join('');
    return !!ini && shared.some(sn => T.includes(' ' + ini + ' ' + sn + ' '));
  });
  return hits.length === 1 ? hits[0] : null;
}
export function matchAccount(text: string, selfId: string): string | null {
  const t = text.toLowerCase().replace(/^(from|to):\s*/, '').trim(); if (!t) return null;
  const A = accs();
  const exact = Object.entries(A).find(([id, a]) => id !== selfId && (a.n.toLowerCase() === t || (a.bank || '').toLowerCase().includes(t)));
  if (exact) return exact[0];
  const digits = t.match(/\d{6,}/); if (digits) { const hit = Object.entries(A).find(([id, a]) => (a.bank || '').includes(digits[0].slice(-4))); if (hit) return hit[0]; }
  const part = Object.entries(A).find(([id, a]) => id !== selfId && a.n.toLowerCase().includes(t));
  return part ? part[0] : null;
}
export function classify(rows: StatementRow[], accId: string): ClassifiedRow[] {
  const A = accs(), a = A[accId], liab = isLiab(a), B = balances();
  const ledgerHave = (B[accId]?.ev || []).filter(e => e.lid);
  const txHave: LiveTxn[] = [];
  monthKeys().forEach(k => liveTxns(S.months[k]).forEach(t => { if (t.pay === accId) txHave.push(t); }));
  const used = new Set<string>();
  return rows.map((r, i): ClassifiedRow => {
    const eff = liab ? -r.amt : r.amt;
    const text = r.ds + ' ' + r.ben;
    if (a.od && r.d < a.od) return { ...r, i, eff, st: 'before', act: 'skip', note: 'Before this account’s opening balance (' + fmtDate(a.od) + ')' };
    const dup = ledgerHave.find(e => e.d === r.d && Math.abs(e.amt - eff) < 0.01 && !used.has('l' + e.lid));
    if (dup) { used.add('l' + dup.lid); return { ...r, i, eff, st: 'dup', act: 'skip', note: 'Already in this account' }; }
    const cap = txHave.find(t => !used.has('t' + t.id) && Math.abs(t.amt - Math.abs(r.amt)) < 0.01 && Math.abs(((new Date(t.d) as any) - (new Date(r.d) as any)) / 864e5) <= 3);
    if (cap) { used.add('t' + cap.id); return { ...r, i, eff, st: 'captured', act: 'skip', note: 'Captured on ' + fmtDate(cap.d) + ' as ' + (cat()[cap.it]?.n || '') }; }
    const ty = r.ty.toLowerCase();
    if (/interest/.test(ty) || /interest/i.test(r.ds)) return { ...r, i, eff, st: 'interest', act: 'ledger', lty: 'interest' };
    if (ty === 'fee' || /\bfee\b|premium/i.test(r.ds)) return { ...r, i, eff, st: 'fee', act: 'ledger', lty: 'fee', it: suggestItem(text) };
    const other = /^(from|to):/i.test(r.ben) ? matchAccount(r.ben, accId) : null;
    if (/transfer/.test(ty) || /^(from|to):/i.test(r.ben)) return { ...r, i, eff, st: 'transfer', act: 'ledger', lty: 'transfer', other, note: other ? (r.amt < 0 ? 'To ' : 'From ') + A[other].n : r.ben };
    const it = suggestItem(text);
    if (r.amt < 0 && it) return { ...r, i, eff, st: 'spend', act: 'budget', it };
    return { ...r, i, eff, st: r.amt < 0 ? 'spend' : 'money in', act: r.amt < 0 ? 'budget' : 'ledger', it, lty: r.amt < 0 ? 'spend' : 'deposit' };
  });
}
