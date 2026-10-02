/* ---------------- plan / scenarios – verbatim from prototype core.js ---------------- */
import { BUCKETS, SUMCATS } from '../core/constants';
import { r2, sum } from '../core/format';
import { cached, main } from '../core/state';
import { monthCalc } from './month';

export function planCalc(k: string, sid: string) {
  return cached('plan:' + k + sid, () => {
    const m = main(); const sc: any = m.scen?.[sid] || { b: {} }; const base = +(m.planBase as number) || 0;
    const mc = monthCalc(k);
    const lavieRent = sum(mc.lines.filter(l => /^la vie rentals?$/i.test(l.it.n)), l => l.act);
    const actBase = r2(mc.T.a.earned - lavieRent);
    const act: Record<string, number> = {};
    BUCKETS.forEach(b => act[b.k] = 0);
    mc.lines.forEach(l => { if (l.it.pb && act[l.it.pb] !== undefined) act[l.it.pb] += l.act; });
    act.lavie -= lavieRent;
    const rows = BUCKETS.map(b => {
      const [p, fx] = sc.b?.[b.k] || [0, 0];
      const plan = r2(p * base + (+fx || 0));
      const a = r2(act[b.k]);
      let status;
      if (!actBase) status = 'No actual yet';
      else if (b.save) status = a >= plan ? 'On target' : 'Below target';
      else status = a <= plan ? 'Within plan' : 'Over plan';
      return { ...b, plan, planPct: base ? plan / base : 0, act: a, actPct: actBase ? a / actBase : 0, diff: r2(a - plan), status };
    });
    const cats = SUMCATS.map(c => {
      const rs = rows.filter(r => r.cat === c.k);
      const plan = sum(rs, r => r.plan), a = sum(rs, r => r.act);
      return { ...c, plan, act: a, planPct: base ? plan / base : 0, actPct: actBase ? a / actBase : 0, save: c.k === 'savings' };
    });
    const saved = cats[0].act, drawn = r2(mc.T.a.funding + mc.T.a.auto);
    return { base, actBase, rows, cats, planTotal: sum(rows, r => r.plan), actTotal: sum(rows, r => r.act), drawn, net: r2(saved - drawn), netRate: actBase ? (saved - drawn) / actBase : 0, savePlan: cats[0].plan, saveRate: actBase ? saved / actBase : 0 };
  });
}
export const pmt = (rate: number, n: number, pv: number) => rate ? pv * rate / (1 - Math.pow(1 + rate, -n)) : pv / n;
