/* Every number in private/data/baseline.json, computed from private/data/seed-reference/backup.json.
   ACCEPTANCE.md: the port must reproduce each figure to the cent. */
import { beforeAll, describe, expect, it } from 'vitest';
import { balances } from '../../src/calc/balances';
import { monthCalc } from '../../src/calc/month';
import { msCalc } from '../../src/calc/milestones';
import { peopleCalc } from '../../src/calc/people';
import { planCalc } from '../../src/calc/plan';
import { yearCalc } from '../../src/calc/year';
import { S, accs, cat } from '../../src/core/state';
import { baseline, hasPrivate, referenceBackup } from '../helpers/private';
import { loadState } from '../helpers/state';

const cent = (actual: number | null | undefined, expected: number) => expect(Math.abs((actual as number) - expected)).toBeLessThan(0.005);

describe.skipIf(!hasPrivate)('calculations match the baseline', () => {
  const B = hasPrivate ? baseline() : null;
  beforeAll(async () => { await loadState(referenceBackup()); });

  describe('month totals (monthCalc)', () => {
    for (const [k, m] of Object.entries<any>(B?.months || {})) {
      it(k, () => {
        const T = monthCalc(k).T;
        cent(T.a.income, m.income);
        cent(T.a.sav, m.sav);
        cent(T.a.exp, m.exp);
        cent(T.a.surplus, m.surplus);
        cent(T.b.surplus, m.budgetSurplus);
        cent(T.a.auto, m.auto);
      });
    }
  });

  it('people, October budget basis (peopleCalc)', () => {
    const R = peopleCalc('2026-10', 'b');
    for (const w of ['P', 'M', 'U'] as const) cent(R[w].left, B.people[w]);
  });

  describe('account balances (balances)', () => {
    for (const [id, x] of Object.entries<any>(B?.bal || {})) {
      it(id, () => {
        const r = balances()[id];
        expect(r, id).toBeTruthy();
        expect(r.known).toBe(x.known);
        expect(r.needsCheck).toBe(x.needsCheck);
        if (x.bal === null) expect(r.bal).toBeNull(); else cent(r.bal, x.bal);
      });
    }
  });

  it('plan, October, scenario 1 (planCalc)', () => {
    const P = planCalc('2026-10', '1');
    expect(P.cats.map(c => c.n)).toEqual(B.plan.cats.map((c: any) => c[0]));
    // baseline holds category figures in whole rand, as the Plan screen shows them (fmt0)
    B.plan.cats.forEach(([, plan, act]: [string, number, number], i: number) => { expect(Math.round(P.cats[i].plan)).toBe(plan); expect(Math.round(P.cats[i].act)).toBe(act); });
    cent(P.drawn, B.plan.drawn);
    cent(P.net, B.plan.net);
    cent(Math.round(P.netRate * 10000) / 100, B.plan.netRate);
  });

  it('counts', () => {
    expect(Object.keys(cat()).length).toBe(B.counts.items);
    expect(Object.keys(accs()).length).toBe(B.counts.accounts);
    expect(Object.values(balances()).filter(r => r.needsCheck).length).toBe(B.counts.checks);
  });

  it('milestones (msCalc): planned cost, spent, funding received', () => {
    for (const [n, planned, spent, funding] of B.ms as [string, number, number, number][]) {
      const id = Object.keys(S.ms).find(k => S.ms[k].n === n);
      expect(id, n).toBeTruthy();
      const c = msCalc(id!)!;
      expect(Math.round(c.exp.b)).toBe(planned);
      expect(Math.round(c.exp.a)).toBe(spent);
      expect(Math.round(c.inc.a)).toBe(funding);
    }
  });

  it('year totals agree with the months (yearCalc)', () => {
    const Y = yearCalc('2026');
    for (const [k, m] of Object.entries<any>(B.months)) cent(Y.tot[+k.slice(5) - 1].a.surplus, m.surplus);
  });
});
