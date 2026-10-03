/* TFSA goal progress per SA tax year (1 March – 28/29 February). Balances themselves are covered by calc.test.ts. */
import { describe, expect, it } from 'vitest';
import { balances, type BalResult } from '../../src/calc/balances';
import { goalProgress, isTfsa, taxYear, taxYearContributions } from '../../src/calc/tfsa';
import { S } from '../../src/core/state';
import { hasPrivate, referenceBackup } from '../helpers/private';
import { loadState } from '../helpers/state';

const acc = (over: any = {}) => ({ n: 'TFSA Test', t: 'savings', ow: 'P', open: 100, od: '2020-01-01', goal: 1000, ...over });
const res = (ev: any[], a: any = acc(), bal = 0): BalResult => ({ id: 'x', a, ev, known: true, bal, delta: 0, lastCheck: null, needsCheck: false });

describe('tax year', () => {
  it('runs from 1 March to the end of February', () => {
    expect(taxYear('2026-10-02')).toEqual({ start: '2026-03-01', next: '2027-03-01', end: '2027-02-28', label: '2026/27' });
    expect(taxYear('2026-03-01').label).toBe('2026/27');
    expect(taxYear('2026-02-28').label).toBe('2025/26');
    expect(taxYear('2026-01-15').start).toBe('2025-03-01');
  });
  it('ends on 29 February in leap years (and not in 2100)', () => {
    expect(taxYear('2027-06-01').end).toBe('2028-02-29');
    expect(taxYear('2028-02-29').label).toBe('2027/28');
    expect(taxYear('2099-06-01').end).toBe('2100-02-28');
  });
});

describe('TFSA detection', () => {
  it('by name or flag', () => {
    expect(isTfsa(acc({ n: 'TFSA Munny' }) as any)).toBe(true);
    expect(isTfsa(acc({ n: 'Tax-free savings' }) as any)).toBe(true);
    expect(isTfsa(acc({ n: 'Easy Equities', tfsa: true }) as any)).toBe(true);
    expect(isTfsa(acc({ n: 'Pool Savings Munny' }) as any)).toBe(false);
  });
});

describe('contributions in the tax year', () => {
  const ev = [
    { d: '2026-02-28', amt: 1000, src: 'budget' },                  // previous tax year
    { d: '2026-03-01', amt: 1000, src: 'budget' },                  // first day: counts
    { d: '2026-06-28', amt: 2000, src: 'budget' },
    { d: '2026-07-10', amt: 300, src: 'ledger', ty: 'transfer' },   // money moved in: counts
    { d: '2026-07-31', amt: 45.5, src: 'statement', ty: 'interest' }, // growth: not a contribution
    { d: '2026-08-01', amt: -500, src: 'ledger', ty: 'withdrawal' }, // withdrawals don't give room back
    { d: '2026-08-15', amt: 0, src: 'check', ty: 'check', bal: 99999 },
    { d: '2027-02-28', amt: 700, src: 'budget' },                   // last day: counts
    { d: '2027-03-01', amt: 900, src: 'budget' },                   // next tax year
  ].reverse();
  it('sums settled money in from 1 March up to today only', () => {
    expect(taxYearContributions(res(ev), '2026-10-02')).toBe(1000 + 2000 + 300);          // 28 Feb 2027 not yet
    expect(taxYearContributions(res(ev), '2027-02-28')).toBe(1000 + 2000 + 300 + 700);    // last day of the year
    expect(taxYearContributions(res(ev), '2026-01-10')).toBe(0);                           // 28 Feb 2026 still ahead
    expect(taxYearContributions(res(ev), '2026-02-28')).toBe(1000);
    expect(taxYearContributions(res(ev), '2027-03-05')).toBe(900);
  });
  it('a planned contribution dated the 28th counts from that day (advance budgeting)', () => {
    const planned = [{ d: '2026-10-28', amt: 1000, src: 'budget' }, { d: '2026-09-28', amt: 1000, src: 'budget' }];
    expect(taxYearContributions(res(planned), '2026-10-03')).toBe(1000);
    expect(taxYearContributions(res(planned), '2026-10-27')).toBe(1000);
    expect(taxYearContributions(res(planned), '2026-10-28')).toBe(2000);
  });
  it('TFSA goal uses the tax year; the balance is left alone', () => {
    const g = goalProgress(res(ev, acc({ goal: 10000 }), 9000), '2026-10-02')!;
    expect(g).toMatchObject({ amount: 3300, taxYear: '2026/27', known: true });
    expect(g.pct).toBeCloseTo(3300 / 10000, 10);
  });
  it('other goals still measure the balance, as in the prototype', () => {
    const r = res(ev, acc({ n: 'Baby Fund', goal: 2000 }), 500);
    expect(goalProgress(r, '2026-10-02')).toMatchObject({ amount: 500, pct: 0.25, taxYear: null });
    expect(goalProgress({ ...r, known: false, bal: null }, '2026-10-02')).toMatchObject({ known: false, pct: 0 });
    expect(goalProgress(res(ev, acc({ goal: null })), '2026-10-02')).toBeNull();
  });
});

describe.skipIf(!hasPrivate)('reference data: TFSA Piepie and TFSA Munny', () => {
  it('tax-year contributions equal the linked line-item entries in the window, split by their shares', async () => {
    await loadState(referenceBackup());
    const today = '2026-10-02', { start } = taxYear(today);
    const B = balances();
    const tfsas = Object.keys(B).filter(id => isTfsa(B[id].a));
    expect(tfsas.length).toBe(2);
    let combined = 0, linkedTotal = 0;
    for (const id of tfsas) {
      // independent sum: every budget entry whose line item is linked to this account, times its share
      let expected = 0;
      for (const m of Object.values<any>(S.months)) for (const t of Object.values<any>(m.txns || {})) {
        if (!t || t.d < start || t.d > today) continue;
        for (const f of (S.cfg.catalog!.items[t.it]?.fl || [])) if (f.a === id && f.x > 0) expected += f.s * t.amt;
      }
      const got = taxYearContributions(B[id], today);
      expect(got).toBeCloseTo(expected, 2);
      expect(got).toBeLessThan(B[id].bal as number);           // the lifetime balance stays larger
      combined += got;
    }
    for (const m of Object.values<any>(S.months)) for (const t of Object.values<any>(m.txns || {}))
      if (t && t.d >= start && t.d <= today && (S.cfg.catalog!.items[t.it]?.fl || []).some((f: any) => tfsas.includes(f.a))) linkedTotal += t.amt;
    expect(combined).toBeCloseTo(linkedTotal, 2);                // both accounts together = everything paid in this tax year
  });
});

describe('corrections', () => {
  it('a correction entry adjusts contributions in either direction; a withdrawal does not', () => {
    const ev = [
      { d: '2026-06-28', amt: 2000, src: 'budget' },
      { d: '2026-06-28', amt: -1000, src: 'ledger', ty: 'correction' },   // June was really half
      { d: '2026-07-28', amt: 500, src: 'budget' },
      { d: '2026-07-28', amt: 500, src: 'ledger', ty: 'correction' },     // July was really double
      { d: '2026-08-10', amt: -300, src: 'ledger', ty: 'withdrawal' },
    ].reverse();
    expect(taxYearContributions(res(ev), '2026-10-02')).toBe(2000 - 1000 + 500 + 500);
  });
});
