/* TFSA goal bars measure this tax year's contributions; the balance shows the lifetime amount. */
import { expect, test } from '@playwright/test';
import { baseline, hasPrivate, referenceBackup } from '../helpers/private';
import { openDemo } from './demo';

test('synthetic: TFSA page and row show tax-year contributions, balance stays lifetime', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-02-01T10:00:00+02:00'));   // tax year 2029/30
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.view = 'accounts'; p.render(); });
  const row = page.locator('[data-a="openacc"][data-id="tfsa_p"]');
  await expect(row.locator('.v small')).toHaveText('R500 of R1,000 in 2029/30');   // half of the R1,000 contribution
  await row.click();
  await expect(page.locator('main h1')).toHaveText('TFSA Piepie');
  await expect(page.locator('main .acc-bal')).toHaveText('R600.00');               // opening R100 + R500: lifetime
  await expect(page.locator('main .tfsa-amt')).toHaveText('R500.00');               // this tax year leads the card
  await expect(page.locator('.tfsa-head')).toContainText('Contributed in the 2029/30 tax year so far');
  await expect(page.locator('.tfsa-head .row.between.small')).toHaveText('of R1,000 goal50.0%');
  await expect(page.locator('main .acc-bal').locator('xpath=..')).toContainText('Balance (all years)');

  // a month later the tax year rolls over: nothing contributed yet in 2030/31, balance unchanged
  await page.clock.setFixedTime(new Date('2030-03-02T10:00:00+02:00'));
  await page.evaluate(() => (window as any).__pn.render());
  await expect(page.locator('.tfsa-head')).toContainText('Contributed in the 2030/31 tax year so far');
  await expect(page.locator('main .tfsa-amt')).toHaveText('R0.00');
  await expect(page.locator('main .acc-bal')).toHaveText('R600.00');
});

test('reference data: TFSA Munny', async ({ page }) => {
  test.skip(!hasPrivate, 'private/ not present');
  await openDemo(page);   // 2 Oct 2026 → tax year 2026/27
  const fmt = (n: number) => 'R' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // expected contributions computed straight from the backup: TFSA-linked entries since 1 March, times the share
  const b = referenceBackup(); let exp = 0;
  for (const m of Object.values<any>(b.months)) for (const t of Object.values<any>(m.txns || {}))
    if (t && t.d >= '2026-03-01' && t.d <= '2026-10-02') for (const f of b.config.catalog.items[t.it]?.fl || []) if (f.a === 'tfsa_m') exp += f.s * t.amt;
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.acc = 'tfsa_m'; p.S.ui.view = 'account'; p.render(); });
  await expect(page.locator('main .acc-bal')).toHaveText(fmt(baseline().bal.tfsa_m.bal));   // lifetime balance unchanged
  await expect(page.locator('main .tfsa-amt')).toHaveText(fmt(exp));
  const goal = b.config.accounts.accounts.tfsa_m.goal;
  await expect(page.locator('.tfsa-head .row.between.small b')).toHaveText((exp / goal * 100).toFixed(1) + '%');
  await page.screenshot({ path: 'private/test-results/tfsa-account.png' });
});

test('synthetic: a correction entered on the account page lowers balance and tax-year contributions', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-02-01T10:00:00+02:00'));
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.acc = 'tfsa_p'; p.S.ui.view = 'account'; p.render(); });
  await page.click('[data-a="ledger"]');
  await page.fill('#le-amt', '200');
  await page.click('#le-dir button[data-v="-1"]');
  await page.selectOption('#le-ty', 'correction');
  await page.fill('#le-d', '2030-01-28');
  await page.fill('#le-ds', 'January contribution was R300, not R500');
  await page.click('#le-save');
  await expect(page.locator('main .acc-bal')).toHaveText('R400.00');
  await expect(page.locator('main .tfsa-amt')).toHaveText('R300.00');
  await expect(page.getByText('January contribution was R300, not R500')).toBeVisible();
});

test('synthetic: an earlier tax year can be picked and is measured against that year\'s statutory limit', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-10-01T10:00:00+02:00'));   // tax year 2030/31; records start Jan 2030
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.acc = 'tfsa_p'; p.S.ui.view = 'account'; p.render(); });
  const sel = page.locator('[data-a="tfsayear"]');
  await expect(sel.locator('option')).toHaveText(['2030/2031 · Current', '2029/2030 · Previous']);
  await expect(page.locator('.tfsa-head')).toContainText('Contributed in the 2030/31 tax year so far');
  await sel.selectOption('2029');
  await expect(page.locator('.tfsa-head')).toContainText('Contributed in the 2029/30 tax year');
  await expect(page.locator('main .tfsa-amt')).toHaveText('R500.00');
  await expect(page.locator('.tfsa-head .row.between.small')).toHaveText('of R46,000 annual limit1.1%');   // 2029/30 is after the 2026 increase
  await expect(page.locator('.tfsa-head')).toContainText('1 Mar 2029 – 28 Feb 2030');
  await expect(page.locator('.tfsa-head')).toContainText('records for this account start on 1 Jan 2030');
  await expect(page.locator('main .acc-bal')).toHaveText('R600.00');      // the balance doesn't change with the year
});
