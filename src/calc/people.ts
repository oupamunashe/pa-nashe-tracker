/* ---------------- allocation (Piepie / Munny) – verbatim from prototype core.js ---------------- */
import { r2, sum } from '../core/format';
import { accs, cached } from '../core/state';
import { monthCalc } from './month';

export interface PersonCalc { inc: number; out: number; left: number; lines: { l: any; v: number }[] }

export function shares(line: { al?: any[]; b?: number }, total: number, basis: string) {
  // basis 'b' uses rand amounts as entered; 'a' scales rand amounts to the actual
  const out: Record<string, number> = { P: 0, M: 0, U: 0 };
  if (!total) return out;
  const al = line.al || [];
  if (!al.length) { out.U = total; return out; }
  const amtTotal = sum(al.filter(x => x.u === 'amt'), x => x.v);
  const scale = basis === 'a' && line.b ? total / line.b : 1;
  let used = 0;
  al.forEach(x => {
    const v = x.u === 'pct' ? total * (+x.v || 0) / 100 : (+x.v || 0) * (basis === 'a' ? scale : 1);
    out[x.w] = (out[x.w] || 0) + v; used += v;
  });
  if (basis === 'b' && amtTotal && !al.some(x => x.u === 'pct')) used = amtTotal;
  out.U = r2(total - used);
  if (Math.abs(out.U) < 0.01) out.U = 0;
  return out;
}
export function peopleCalc(k: string, basis: string): Record<'P' | 'M' | 'U', PersonCalc> {
  return cached('p:' + k + basis, () => {
    const mc = monthCalc(k);
    const R: any = { P: { inc: 0, out: 0, lines: [] }, M: { inc: 0, out: 0, lines: [] }, U: { inc: 0, out: 0, lines: [] } };
    mc.lines.forEach(l => {
      const tot = basis === 'b' ? l.b : l.act;
      if (!tot) return;
      const sh = shares(l, tot, basis);
      ['P', 'M', 'U'].forEach(w => {
        if (!sh[w]) return;
        if (l.k === 'in') R[w].inc += sh[w]; else R[w].out += sh[w];
        R[w].lines.push({ l, v: r2(sh[w]) });
      });
    });
    if (basis === 'a') Object.entries(mc.auto).forEach(([aid, v]) => {
      const w = accs()[aid]?.ow; const who = w === 'P' || w === 'M' ? w : 'U';
      R[who].inc += v; R[who].lines.push({ l: { it: { n: 'Paid from ' + (accs()[aid]?.n || aid) + ' (auto)' }, k: 'in', id: 'auto-' + aid }, v });
    });
    Object.values(R).forEach((x: any) => { x.inc = r2(x.inc); x.out = r2(x.out); x.left = r2(x.inc - x.out); });
    return R;
  });
}
