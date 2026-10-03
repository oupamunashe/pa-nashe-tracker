/* The 32 reference states from prototype/test/screenshots.py, captured from the port on the reference seed
   with the clock at 2 Oct 2026 (like the references), at 390×844 (full page) and 1360×900.
   Output goes to private/test-results/screens/ (never committed – it shows real figures), plus
   compare.html with each shot beside its reference in private/screenshots/. */
import { expect, test } from '@playwright/test';
import { openDemo } from './demo';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { hasPrivate, priv } from '../helpers/private';

const OUT = priv('test-results', 'screens');
const VIEWPORTS = [['phone', { width: 390, height: 844 }], ['desktop', { width: 1360, height: 900 }]] as const;
const VIEWS = ['home', 'budget', 'people', 'accounts', 'plan', 'year', 'milestones', 'more', 'items'];
const STATES: [string, string][] = [
  ...VIEWS.map(v => [v, `p.closeAll();p.S.ui.view='${v}';p.render()`] as [string, string]),
  ['account', "p.closeAll();p.S.ui.acc='pool_m';p.S.ui.view='account';p.render()"],
  ['milestone', "p.closeAll();p.S.ui.msId='zim-2026';p.S.ui.view='milestone';p.render()"],
  ['sheet-capture', "p.closeAll();p.S.ui.view='budget';p.render();p.sheetTxn()"],
  ['sheet-line', "p.closeAll();p.sheetLine('2026-10','life-cover-death-income-protection-severe-critic')"],
  ['sheet-who', 'p.closeAll();p.sheetWho()'],
  ['sheet-trend', "p.closeAll();p.S.ui.view='year';p.render();p.sheetTrend('groceries')"],
  ['home-dark', "p.closeAll();document.documentElement.dataset.theme='dark';p.S.ui.view='home';p.render()"],
  ['home-light', "p.closeAll();document.documentElement.dataset.theme='light';p.S.ui.view='home';p.render()"],
];

test.describe('screens', () => {
  test.skip(!hasPrivate, 'private/ not present');
  test.use({ timezoneId: 'Africa/Johannesburg', locale: 'en-ZA' });

  for (const [name, viewport] of VIEWPORTS) {
    test(`capture ${name}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setViewportSize(viewport);
      await openDemo(page);
      for (const [state, js] of STATES) {
        await page.evaluate(`(()=>{const p=window.__pn;${js}})()`);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${OUT}/${name}-${state}.png`, fullPage: name === 'phone' && !state.startsWith('sheet') && state !== 'account' && state !== 'milestone' && !state.startsWith('home-'), animations: 'disabled' });
      }
      expect(errors).toEqual([]);
    });
  }

  test.afterAll(() => {
    if (!existsSync(OUT)) return;
    const rows = VIEWPORTS.flatMap(([n]) => STATES.map(([s]) => `${n}-${s}`));
    writeFileSync(`${OUT}/compare.html`, `<!doctype html><meta charset="utf-8"><title>Pa-Nashe port vs prototype</title>
<style>body{font:14px system-ui;margin:16px;background:#eee}h2{margin:28px 0 8px}.r{display:flex;gap:16px;align-items:flex-start}
.r div{flex:1;min-width:0}.r img{max-width:100%;border:1px solid #bbb;background:#fff}small{color:#666}</style>
<h1>Port (left) vs prototype reference (right)</h1><p>Reference shots used fallback fonts; the port uses the real Bricolage Grotesque and Figtree.</p>
${rows.map(r => `<h2>${r}</h2><div class="r"><div><small>port</small><br><img src="${r}.png"></div><div><small>prototype</small><br><img src="../../screenshots/${r}.png"></div></div>`).join('\n')}`);
  });
});
