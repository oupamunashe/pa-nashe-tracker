/* Home → “Against your plan” as rendered: every bar's colour and percentage colour follow the rule –
   savings red below target, green at/above; spending red above target, green at/below – one green, one red. */
import { expect, test, type Page } from '@playwright/test';
import { hasPrivate } from '../helpers/private';
import { openDemo } from './demo';

const RED = 'var(--bad)', GREEN = 'var(--good)';

/** Each category row of the card as drawn, next to the figures planCalc gives for it. */
async function card(page: Page) {
  return page.evaluate(() => {
    const p = (window as any).__pn;
    const k = p.S.ui.month, sid = p.S.cfg.main.scenario || '1';
    const cats = p.planCalc(k, sid).cats;
    const panel = [...document.querySelectorAll('section.panel')].find(s => s.querySelector('h2')?.textContent === 'Against your plan')!;
    const rows = [...panel.querySelectorAll(':scope > div[style*="margin-bottom:10px"]')];
    return rows.map((r, i) => ({
      name: r.querySelector('.row span')!.textContent,
      bar: (r.querySelector('.bar > span') as HTMLElement).style.background,
      text: r.querySelector('b')!.className,
      save: cats[i].save, act: cats[i].actPct, plan: cats[i].planPct, catName: cats[i].n,
    }));
  });
}
const expected = (c: { save: boolean; act: number; plan: number }) => {
  const ok = c.save ? c.act >= c.plan : c.act <= c.plan;
  return { bar: ok ? GREEN : RED, text: ok ? 'pos' : 'neg' };   // one green, one red
};
function assertRule(rows: Awaited<ReturnType<typeof card>>) {
  expect(rows).toHaveLength(6);
  for (const r of rows) {
    expect(r.name).toBe(r.catName);
    expect({ name: r.name, bar: r.bar, text: r.text }).toEqual({ name: r.name, ...expected(r) });
  }
}

test('synthetic data: savings and spending bars follow their thresholds', async ({ page }) => {
  await page.goto('./?synthetic');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Hi Piepie');
  let rows = await card(page);
  assertRule(rows);
  const savings = rows.find(r => r.save)!, house = rows.find(r => r.name === 'House Bills & Utilities')!;
  expect(savings.bar).toBe(GREEN);                 // 10% of a 10% target: on target
  expect(house.bar).toBe(GREEN);                   // 40% of 40%: at target counts as within plan

  // raise the savings target and lower the house target: both go red
  await page.evaluate(() => (window as any).__pn.db.doc('config/main').update({ scen: { '1': { b: { retire: [0.25, 0], sultana: [0.3, 0] } } } }));
  await expect.poll(async () => (await card(page)).find(r => r.save)!.bar).toBe(RED);
  rows = await card(page);
  assertRule(rows);
  expect(rows.find(r => r.name === 'House Bills & Utilities')!.bar).toBe(RED);
});

test('reference data, October: Savings below target is red', async ({ page }) => {
  test.skip(!hasPrivate, 'private/ not present');
  await page.setViewportSize({ width: 1360, height: 900 });
  await openDemo(page);
  const rows = await card(page);
  assertRule(rows);
  const s = rows.find(r => r.save)!;
  expect(s.act).toBeLessThan(s.plan);
  expect(s.bar).toBe(RED);
});
