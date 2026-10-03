/* Savings pots: the Home summary opens Accounts filtered to that pot; the filter shows its total. */
import { expect, test } from '@playwright/test';

test('synthetic: savings pots on Home and Accounts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-02-01T10:00:00+02:00'));
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  const tfsaTotal = await page.evaluate(() => { const B = (window as any).__pn.balances(); return B.tfsa_p.bal + B.tfsa_m.bal; });
  const fmt0 = (n: number) => 'R' + Math.round(n).toLocaleString('en-US');
  const cards = page.locator('.pots-home .kpi');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(2)).toContainText('Long-term · Investments, 10 years+' + fmt0(tfsaTotal));
  await cards.nth(2).click();
  await expect(page.locator('main h1')).toHaveText('Accounts');
  await expect(page.locator('.seg.pots [aria-pressed="true"]')).toHaveText('Long-term');
  await expect(page.locator('main .kpis .kpi').first()).toContainText(fmt0(tfsaTotal));
  await expect(page.locator('[data-a="openacc"]')).toHaveCount(2);           // the two TFSAs only
  await expect(page.getByText('Credit & store accounts')).toHaveCount(0);
  await page.click('.seg.pots [data-p="short"]');
  await expect(page.locator('[data-a="openacc"]')).toHaveCount(0);
  await page.click('.seg.pots [data-p=""]');
  await expect(page.locator('main .kpis .kpi').first()).toContainText('Savings');
});
