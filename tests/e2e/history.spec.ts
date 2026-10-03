/* Earlier years: every month is in the month dropdown, Home shows the same month last year, and the Year view
   compares two years like for like. A synthetic January 2029 is added next to the fixture's January 2030. */
import { expect, test } from '@playwright/test';

test('synthetic: month dropdown, last year on Home, year-on-year comparison', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-01-20T10:00:00+02:00'));
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  await page.evaluate(() => (window as any).__pn.db.doc('months/2029-01').set({
    y: 2029, m: 1, lines: { 'salary-a': { b: 5000 }, rent: { b: 3500 }, groceries: { b: 2000 } }, ledger: {},
    txns: { x1: { d: '2029-01-28', mo: '2029-01', it: 'salary-a', amt: 5000, src: 'import' }, x2: { d: '2029-01-28', mo: '2029-01', it: 'rent', amt: 3500, src: 'import' },
      x3: { d: '2029-01-28', mo: '2029-01', it: 'groceries', amt: 1800, src: 'import' } } }));
  const cur = await page.evaluate(() => (window as any).__pn.monthCalc('2030-01').T.a);
  const fmt0 = (n: number) => (n < 0 ? '–' : '') + 'R' + Math.round(Math.abs(n)).toLocaleString('en-US');

  // Home: same month last year under each figure
  await expect(page.locator('.hero .flow .ly').first()).toHaveText('Jan 2029: R5,000');
  await expect(page.locator('.hero .flow .ly').nth(2)).toHaveText('Jan 2029: R5,300');

  // month dropdown: grouped by year, newest first; picking a month moves the whole app there
  const sel = page.locator('[data-a="monthsel"]');
  await expect(sel.locator('optgroup')).toHaveCount(2);
  await expect(sel.locator('optgroup').first()).toHaveAttribute('label', '2030');
  await sel.selectOption('2029-01');
  await expect(page.locator('.hero .big')).toHaveText('–R300.00');                  // 5,000 in − 5,300 spent
  await expect(page.locator('.monthsw button').first()).toBeDisabled();            // nothing before January 2029
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.view = 'budget'; p.render(); });
  await expect(page.locator('main h1')).toHaveText('January 2029 budget');

  // Year view: compare 2030 with 2029
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.view = 'year'; p.S.ui.year = '2030'; p.render(); });
  await page.selectOption('[data-a="cmpyear"]', '2029');
  await expect(page.locator('main h2').filter({ hasText: 'compared with' })).toHaveText('2030 compared with 2029');
  const k = page.locator('main .kpis .kpi');
  await expect(k.nth(0)).toContainText(`Money in${fmt0(cur.income)}2029: R5,000 · +${fmt0(cur.income - 5000)}`);
  await expect(k.nth(2)).toContainText(`Spent${fmt0(cur.exp)}2029: R5,300`);
  const rent = page.locator('table.cmp tr.click', { hasText: 'Rent' });
  await expect(rent.locator('td')).toHaveText(['Rent', 'R4,000', 'R3,500', '+R500', '+14.3%']);
  await expect(rent.locator('td').nth(3)).toHaveClass('yoy-bad');                    // spending more: red
  await expect(rent.locator('td').nth(3)).toHaveCSS('color', 'rgb(248, 113, 113)');  // #F87171
  const income = page.locator('table.cmp tr.g', { hasText: 'Income' }).locator('td').nth(3);
  await expect(income).toHaveClass('yoy-good');                                       // more money in: green
  await expect(income).toHaveCSS('color', 'rgb(74, 222, 128)');                       // #4ADE80
  await expect(k.nth(2).locator('.yoy-bad')).toHaveCount(1);                          // spent more than 2029
  // three indentation steps; the root rows don't touch the card edge
  const pad = (sel: string) => page.locator(`table.cmp td.${sel}`).first().evaluate(e => parseFloat(getComputedStyle(e).paddingLeft));
  const [p0, p1, p2] = [await pad('lv0'), await pad('lv1'), await pad('lv2')];
  expect(p0).toBeGreaterThanOrEqual(12); expect(p1).toBeGreaterThan(p0); expect(p2).toBeGreaterThan(p1);
  await expect(page.locator('table.cmp thead th').first()).toHaveText('Jan');       // like for like: January only

  // picked the other way round (view 2029, compare with 2030): still 2030 − 2029
  await page.selectOption('[data-a="yearsel"]', '2029');
  await page.selectOption('[data-a="cmpyear"]', '2030');
  await expect(page.locator('main h2').filter({ hasText: 'compared with' })).toHaveText('2030 compared with 2029');
  await expect(page.locator('table.cmp thead th')).toHaveText(['Jan', '2030', '2029', 'Change', '%']);
  await expect(page.locator('table.cmp tr.click', { hasText: 'Rent' }).locator('td')).toHaveText(['Rent', 'R4,000', 'R3,500', '+R500', '+14.3%']);
  const sal = page.locator('table.cmp tr.click', { hasText: 'Salary A' }).locator('td');
  await expect(sal.nth(3)).toHaveClass('yoy-good');                                   // earned more in 2030: green
});

test('synthetic: months from the old workbooks (before 2026) show nothing as due', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-01-20T10:00:00+02:00'));
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  // the same unpaid monthly line in a 2025 month and in the fixture's 2030 month
  await page.evaluate(async () => { const p = (window as any).__pn;
    await p.db.doc('months/2025-06').set({ y: 2025, m: 6, lines: { rent: { b: 3500, rec: true } }, txns: {}, ledger: {} });
    await p.db.doc('months/2030-01').update({ lines: { party: { b: 500, rec: true } } }); });
  const open = (k: string, view: string) => page.evaluate(([k, view]) => { const p = (window as any).__pn; p.S.ui.month = k; p.S.ui.view = view; p.render(); }, [k, view]);
  await open('2030-01', 'budget');
  await expect(page.locator('.bl', { hasText: 'Party' }).locator('.chip.warn', { hasText: 'Due' })).toHaveCount(1);
  await open('2025-06', 'budget');
  await expect(page.locator('main h1')).toHaveText('June 2025 budget');
  await expect(page.locator('.bl', { hasText: 'Rent' })).toHaveCount(1);
  await expect(page.locator('.chip.warn', { hasText: 'Due' })).toHaveCount(0);
  await page.click('[data-a="bfilter"][data-v="due"]');
  await expect(page.locator('.bl')).toHaveCount(0);
  await open('2025-06', 'home');
  await expect(page.locator('[data-a="markpaid"]')).toHaveCount(0);
  await expect(page.getByText('June 2025 comes from your old spreadsheet, so nothing is shown as still to pay.')).toBeVisible();
});
