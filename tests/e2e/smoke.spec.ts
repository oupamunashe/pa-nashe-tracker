/* Demo mode boots in a real browser: MemoryAdapter → subscribe → calculations.
   The synthetic test runs everywhere (CI too); the reference test needs private/. */
import { expect, test } from '@playwright/test';
import { baseline, hasPrivate } from '../helpers/private';

const loaded = (page: any) => page.waitForFunction(() => { const S = (window as any).__pn?.S; return S && S.loaded.config && S.loaded.months && S.loaded.ms; });

test('demo boots on the synthetic fixture', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('./?synthetic');
  await loaded(page);
  expect(await page.evaluate(() => (window as any).__pn.monthCalc('2030-01').T.a.surplus)).toBe(4500.5);
  expect(errors).toEqual([]);
});

test('demo on the reference seed reproduces the October baseline', async ({ page }) => {
  test.skip(!hasPrivate, 'private/ not present');
  const B = baseline();
  await page.goto('./');
  await loaded(page);
  const got = await page.evaluate(() => {
    const p = (window as any).__pn;
    return { T: p.monthCalc('2026-10').T, pool: p.balances().pool_m.bal, people: p.peopleCalc('2026-10', 'b').P.left };
  });
  expect(Math.abs(got.T.a.surplus - B.months['2026-10'].surplus)).toBeLessThan(0.005);
  expect(Math.abs(got.T.b.surplus - B.months['2026-10'].budgetSurplus)).toBeLessThan(0.005);
  expect(Math.abs(got.pool - B.bal.pool_m.bal)).toBeLessThan(0.005);
  expect(Math.abs(got.people - B.people.P)).toBeLessThan(0.005);
});

test('the app works on the synthetic fixture: every screen renders, capture saves', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?synthetic&me=M');
  await loaded(page);
  await expect(page.locator('h1')).toHaveText('Hi Munny');
  for (const v of ['home', 'budget', 'people', 'accounts', 'plan', 'year', 'milestones', 'more', 'items']) {
    await page.evaluate(v => { const p = (window as any).__pn; p.closeAll(); p.S.ui.view = v; p.render(); }, v);
    await expect(page.locator('main .pagehead')).toBeVisible();
  }
  await page.click('.rail .capture-big, .tabbar .capture');
  await page.fill('#tx-amt', '12.34');
  await page.click('[data-quick="groceries"]');
  await page.click('#tx-save');
  await expect.poll(() => page.evaluate(() => (window as any).__pn.monthCalc('2030-01').lines.find((l: any) => l.id === 'groceries').act)).toBeCloseTo(1750 + 12.34, 2);
  expect(errors).toEqual([]);
});
