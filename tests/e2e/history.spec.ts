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
  await expect(rent.locator('td')).toHaveText(['Rent', 'R4,000', 'R3,500', '+R500', '+14%']);
  await expect(rent.locator('td').nth(3)).toHaveClass('neg');                        // spending more is shown in red
  await expect(page.locator('table.cmp thead th').first()).toHaveText('Jan');       // like for like: January only
});
