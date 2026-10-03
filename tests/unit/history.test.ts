/* Historical months (Oct 2023 – Dec 2025) built from the owners' workbooks by private/tools/build_history.py.
   Every month, run through the app's own monthCalc, must reproduce the workbook's totals. Reads private/ at
   runtime; skipped without it (CI). */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { balances } from '../../src/calc/balances';
import { monthCalc } from '../../src/calc/month';
import { hasPrivate, priv, readJSON, referenceBackup } from '../helpers/private';
import { loadState } from '../helpers/state';

const has = hasPrivate && existsSync(priv('data', 'history', 'months.json')) && existsSync(priv('data', 'history', 'raw.json'));
// where a workbook's own total formula leaves rows out, the month's rows are the truth (listed in DATA-NOTES)
const SHEET_FORMULA_SLIPS: Record<string, 'income'> = { '2024-02': 'income' };

describe.skipIf(!has)('history: 2023–2025 from the workbooks', () => {
  it('each month matches the workbook totals (income, savings + spending), and account balances are untouched', async () => {
    const ref = referenceBackup();
    await loadState(ref);
    const before = Object.fromEntries(Object.entries(balances()).map(([k, r]) => [k, r.bal]));
    const b = structuredClone(ref);
    Object.assign(b.months, readJSON(priv('data', 'history', 'months.json')));
    Object.assign(b.config.catalog.items, readJSON(priv('data', 'history', 'catalog_add.json')));
    await loadState(b);
    const raw = readJSON(priv('data', 'history', 'raw.json'));
    expect(Object.keys(raw).length).toBe(27);
    for (const [k, m] of Object.entries<any>(raw)) {
      const T = monthCalc(k).T, t = m.totals;
      const sums = (sec: (r: any) => boolean, f: 'b' | 'a') => m.rows.filter(sec).reduce((s: number, r: any) => s + (r[f] || 0), 0);
      const inc = SHEET_FORMULA_SLIPS[k] === 'income' ? [sums((r: any) => r.sec === 'income', 'b'), sums((r: any) => r.sec === 'income', 'a')] : t.income;
      expect.soft(T.b.income, `${k} income budget`).toBeCloseTo(inc[0], 2);
      expect.soft(T.a.income, `${k} income actual`).toBeCloseTo(inc[1], 2);
      expect.soft(T.b.sav + T.b.exp, `${k} out budget`).toBeCloseTo(t.out[0], 2);
      expect.soft(T.a.sav + T.a.exp, `${k} out actual`).toBeCloseTo(t.out[1], 2);
    }
    expect(Object.fromEntries(Object.entries(balances()).map(([k, r]) => [k, r.bal]))).toEqual(before);
  });
});
