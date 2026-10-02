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

test('smoke screen: add and delete an entry through the write layer', async ({ page }) => {
  await page.goto('./?synthetic');
  await loaded(page);
  await page.waitForSelector('#sm-form');
  await page.fill('#sm-amt', '12.34');
  await page.selectOption('#sm-it', 'groceries');
  await page.fill('#sm-store', 'Test Shop');
  await page.click('#sm-form button[type=submit]');
  await page.waitForSelector('text=Test Shop');
  const k = await page.evaluate(() => Object.keys((window as any).__pn.S.months).find(k => Object.values((window as any).__pn.S.months[k].txns || {}).some((t: any) => t?.store === 'Test Shop')));
  expect(k).toBeTruthy();
  await page.click('[data-a="smokedel"]');
  await page.waitForSelector('text=Test Shop', { state: 'detached' });
});
