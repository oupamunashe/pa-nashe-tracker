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
  await expect(page.locator('main .amt').first()).toHaveText('R600.00');           // opening R100 + R500: lifetime
  await expect(page.getByText('R500.00 contributed in the 2029/30 tax year (1 Mar – 28 Feb). The balance includes earlier years.')).toBeVisible();
  await expect(page.locator('main .row.between.small b').first()).toHaveText('50%');

  // a month later the tax year rolls over: nothing contributed yet in 2030/31, balance unchanged
  await page.clock.setFixedTime(new Date('2030-03-02T10:00:00+02:00'));
  await page.evaluate(() => (window as any).__pn.render());
  await expect(page.getByText('R0.00 contributed in the 2030/31 tax year', { exact: false })).toBeVisible();
  await expect(page.locator('main .amt').first()).toHaveText('R600.00');
});

test('reference data: TFSA Munny', async ({ page }) => {
  test.skip(!hasPrivate, 'private/ not present');
  await openDemo(page);   // 2 Oct 2026 → tax year 2026/27
  const fmt = (n: number) => 'R' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // expected contributions computed straight from the backup: TFSA-linked entries since 1 March, times the share
  const b = referenceBackup(); let exp = 0;
  for (const m of Object.values<any>(b.months)) for (const t of Object.values<any>(m.txns || {}))
    if (t && t.d >= '2026-03-01' && t.d < '2027-03-01') for (const f of b.config.catalog.items[t.it]?.fl || []) if (f.a === 'tfsa_m') exp += f.s * t.amt;
  await page.evaluate(() => { const p = (window as any).__pn; p.S.ui.acc = 'tfsa_m'; p.S.ui.view = 'account'; p.render(); });
  await expect(page.locator('main .amt').first()).toHaveText(fmt(baseline().bal.tfsa_m.bal));   // lifetime balance unchanged
  await expect(page.getByText(`${fmt(exp)} contributed in the 2026/27 tax year`, { exact: false })).toBeVisible();
  const goal = b.config.accounts.accounts.tfsa_m.goal;
  await expect(page.locator('main .row.between.small b').first()).toHaveText(Math.round(exp / goal * 100) + '%');
  await page.screenshot({ path: 'private/test-results/tfsa-account.png' });
});
