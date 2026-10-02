/* ---------------- account balances – verbatim from prototype core.js ---------------- */
import { r2 } from '../core/format';
import { S, accs, cached, cat, isLiab, itemKind, monthKeys } from '../core/state';
import type { Account } from '../core/types';
import { liveLedger, liveTxns } from './month';

export interface BalEvent {
  d: string; at: number; amt: number; ds: string; src: string; mo: string;
  tid?: string; lid?: string; ty?: string; bal?: number; adj?: number | null; run?: number | null;
}
export interface BalResult {
  id: string; a: Account; ev: BalEvent[];
  known: boolean; bal: number | null; delta: number; lastCheck: BalEvent | null; needsCheck: boolean;
}

export function balances(): Record<string, BalResult> {
  return cached('bal', () => {
    const A = accs(), R: Record<string, any> = {};
    Object.entries(A).forEach(([id, a]) => { R[id] = { id, a, ev: [] }; });
    for (const k of monthKeys()) {
      const doc = S.months[k];
      liveTxns(doc).forEach(t => {
        const it = cat()[t.it]; if (!it) return;
        (it.fl || []).forEach(f => {
          const a = A[f.a]; if (!a || a.bf === false) return;
          R[f.a].ev.push({ d: t.d, at: t.at || 0, amt: r2(f.x * f.s * t.amt), ds: it.n + (t.store ? ' · ' + t.store : ''), src: 'budget', mo: k, tid: t.id });
        });
        if (t.pay && A[t.pay]) {
          const a = A[t.pay]; const dir = itemKind(t.it) === 'in' ? 1 : -1;
          R[t.pay].ev.push({ d: t.d, at: t.at || 0, amt: r2((isLiab(a) ? -dir : dir) * t.amt), ds: (t.store || it.n) + (dir < 0 ? '' : ' (received)'), src: 'paid', mo: k, tid: t.id });
        }
      });
      liveLedger(doc).forEach(e => { if (R[e.a]) R[e.a].ev.push({ d: e.d, at: e.at || 0, amt: +e.amt || 0, ds: e.ds, ty: e.ty, bal: e.bal, src: e.src || 'ledger', mo: k, lid: e.id }); });
    }
    Object.values(R).forEach((r: any) => {
      const a = r.a;
      const od = a.od || '0000';
      r.ev = r.ev.filter((e: any) => (e.d || '') >= od).sort((x: any, y: any) => (x.d || '').localeCompare(y.d || '') || (x.at || 0) - (y.at || 0) || ((x.ty === 'check') as any) - ((y.ty === 'check') as any));
      let known = a.open !== null && a.open !== undefined, bal = known ? +a.open : 0, delta = 0, lastCheck = null;
      r.ev.forEach((e: any) => {
        if (e.ty === 'check') { e.adj = known ? r2(e.bal - bal) : null; bal = +e.bal; known = true; lastCheck = e; }
        else { bal = r2(bal + e.amt); delta = r2(delta + e.amt); }
        e.run = known ? r2(bal) : null;
      });
      r.known = known; r.bal = known ? r2(bal) : null; r.delta = delta; r.lastCheck = lastCheck;
      r.needsCheck = !!a.chk && !lastCheck && !a.closed;
      r.ev.reverse();
    });
    return R;
  });
}
