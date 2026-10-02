/* ---------------- month calculations (verbatim from prototype core.js – do not change logic) ---------------- */
import { GMAP } from '../core/constants';
import { r2, sum } from '../core/format';
import { S, accs, cached, cat, itemKind, kindOf } from '../core/state';
import type { Account, Alloc, Item, LedgerEntry, MonthDoc, Txn } from '../core/types';

export type LiveTxn = Txn & { id: string };
export type LiveLedger = LedgerEntry & { id: string };
export interface MonthLine {
  id: string; it: Item; g: string; k: string; b: number; act: number; tx: LiveTxn[]; al: Alloc[];
  rec: boolean; paid: boolean; note: string; inMonth: boolean;
}
export interface Totals { earned: number; funding: number; sav: number; exp: number; auto: number; income: number; out: number; surplus: number }
export interface MonthCalc {
  k: string; doc: MonthDoc | { lines: Record<string, any>; txns: Record<string, any> }; lines: MonthLine[]; txns: LiveTxn[];
  auto: Record<string, number>; T: { b: Totals; a: Totals }; G: Record<string, { b: number; a: number }>;
}

export const liveTxns = (doc: any): LiveTxn[] => Object.entries(doc?.txns || {}).filter(([, t]: [string, any]) => t && t.it).map(([id, t]: [string, any]) => ({ id, ...t }));
export const liveLedger = (doc: any): LiveLedger[] => Object.entries(doc?.ledger || {}).filter(([, e]: [string, any]) => e && e.a).map(([id, e]: [string, any]) => ({ id, ...e }));
export const FUND_ACC = (a: Account | undefined) => a && ['savings', 'goal', 'credit', 'loan'].includes(a.t);

export function monthCalc(k: string): MonthCalc {
  return cached('m:' + k, () => {
    const doc: any = S.months[k] || { lines: {}, txns: {} };
    const txns = liveTxns(doc);
    const ids = new Set(Object.keys(doc.lines || {}).filter(i => doc.lines[i]));
    txns.forEach(t => ids.add(t.it));
    const lines: MonthLine[] = [...ids].map(id => {
      const it: Item = cat()[id] || { n: '(removed line item)', g: 'onceoff', o: 9999 };
      const L: any = (doc.lines || {})[id] || {};
      const tx = txns.filter(t => t.it === id).sort((a, b) => (b.d || '').localeCompare(a.d || ''));
      return { id, it, g: it.g, k: kindOf(it.g), b: +L.b || 0, act: r2(sum(tx, t => t.amt)), tx, al: L.al || [], rec: !!L.rec, paid: !!L.paid, note: L.note || '', inMonth: !!(doc.lines || {})[id] };
    }).sort((a, b) => (GMAP[a.g]?.i ?? 99) - (GMAP[b.g]?.i ?? 99) || (a.it.o || 0) - (b.it.o || 0));
    const auto: Record<string, number> = {};
    txns.forEach(t => {
      if (itemKind(t.it) === 'in' || !t.pay) return;
      const a = accs()[t.pay]; if (!FUND_ACC(a)) return;
      auto[t.pay] = r2((auto[t.pay] || 0) + (+t.amt || 0));
    });
    const T: any = { b: {}, a: {} };
    ['earned', 'funding', 'sav', 'exp'].forEach(x => { T.b[x] = 0; T.a[x] = 0; });
    const G: Record<string, { b: number; a: number }> = {};
    lines.forEach(l => {
      const key = l.k === 'in' ? l.g : l.k;
      T.b[key] += l.b; T.a[key] += l.act;
      G[l.g] = G[l.g] || { b: 0, a: 0 }; G[l.g].b += l.b; G[l.g].a += l.act;
    });
    T.a.auto = r2(sum(Object.values(auto)));
    T.b.auto = 0;
    for (const x of ['b', 'a']) {
      T[x].income = r2(T[x].earned + T[x].funding + T[x].auto);
      T[x].out = r2(T[x].sav + T[x].exp);
      T[x].surplus = r2(T[x].income - T[x].out);
    }
    return { k, doc, lines, txns, auto, T, G };
  });
}
