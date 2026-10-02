/* ---------------- milestones – verbatim from prototype core.js ---------------- */
import { r2, sum } from '../core/format';
import { S, cached } from '../core/state';

export function msCalc(id: string) {
  return cached('ms:' + id, () => {
    const m = S.ms[id]; if (!m) return null;
    const rate = +(m.usd as number) || 0;
    const toZ = (amt: unknown, cur: unknown) => cur === 'USD' ? (+(amt as number) || 0) * rate : (+(amt as number) || 0);
    const tx = Object.entries(m.txns || {}).filter(([, t]) => t).map(([tid, t]: [string, any]) => ({ id: tid, ...t, zar: toZ(t.amt, t.cur) }));
    const lines = Object.entries(m.lines || {}).filter(([, l]) => l).map(([lid, l]: [string, any]) => {
      const lt = tx.filter(t => t.l === lid);
      return { id: lid, ...l, bz: toZ(l.b, l.cur), az: r2(sum(lt, t => t.zar)), tx: lt };
    }).sort((a, b) => ((a.sec === b.sec ? 0 : a.sec === 'income' ? -1 : 1) || (a.o || 0) - (b.o || 0)));
    const inc = lines.filter(l => l.sec === 'income'), exp = lines.filter(l => l.sec !== 'income');
    return { m, rate, lines, tx, inc: { b: sum(inc, l => l.bz), a: sum(inc, l => l.az) }, exp: { b: sum(exp, l => l.bz), a: sum(exp, l => l.az) } };
  });
}
