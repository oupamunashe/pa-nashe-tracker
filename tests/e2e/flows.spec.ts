/* ACCEPTANCE.md §6 flows 1–13 on the MemoryAdapter (mirrors private/tests/test_flows.py).
   One page, flows run in order and build on each other, like the prototype's test. Expected figures, names,
   account names and statement files are read from private/ at runtime – nothing personal is hard-coded. */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { baseline, hasPrivate, hasStatements, personCases, priv, referenceBackup, statementPath, statements } from '../helpers/private';
import { openDemo } from './demo';

const md = hasPrivate ? readFileSync(priv('ACCEPTANCE.md'), 'utf8') : '';
const flows = md.slice(md.indexOf('## 6. Flows'));
const flowLine = (n: number) => flows.split('\n').find(l => l.startsWith(n + '. ')) || '';
const quoted = (n: number) => flowLine(n).match(/“([^”]+)”/)?.[1] || '';
const rand = (s: string) => +s.replace(/[R,–\s]/g, '');
const ev = <T = any>(page: Page, js: string): Promise<T> => page.evaluate(`(()=>{const p=window.__pn;return ${js}})()`);
const LIFE = 'life-cover-death-income-protection-severe-critic';

test.describe.serial('acceptance flows', () => {
  test.skip(!hasPrivate, 'private/ not present');
  test.use({ timezoneId: 'Africa/Johannesburg', locale: 'en-ZA', viewport: { width: 390, height: 844 } });
  let page: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Johannesburg' });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await openDemo(page, './?me=P', false);
  });
  test.afterAll(async () => { await page?.close(); });

  test('1 capture a spend', async () => {
    const g0 = await ev<number>(page, "p.monthCalc('2026-10').lines.find(l=>l.id==='groceries').act");
    await page.click('.tabbar .capture');
    await page.fill('#tx-amt', '842.50');
    await page.fill('[data-search]', 'Groc');
    await page.click('[data-pick="groceries"]');
    await page.fill('#tx-store', 'Checkers Paarl');
    await page.selectOption('#tx-pay', 'fnb_p');
    await page.click('#tx-save');
    await expect.poll(() => ev<number>(page, "p.monthCalc('2026-10').lines.find(l=>l.id==='groceries').act")).toBeCloseTo(g0 + 842.5, 2);
    expect(await ev(page, "Object.values(p.db.store['months/2026-10'].txns).some(t=>t&&t.store==='Checkers Paarl'&&t.by==='P'&&t.pay==='fnb_p')")).toBe(true);
  });

  test('2 line split text', async () => {
    await ev(page, "(p.S.ui.view='budget',p.render())");
    await page.click(`[data-a="line"][data-id="${LIFE}"]`);
    await expect(page.locator('#ln-rem')).toHaveText(quoted(2));
  });

  test('3 apply 50/50 and save', async () => {
    await page.click('[data-preset="half"]');
    await page.click('#ln-save');
    await expect.poll(() => ev(page, `JSON.stringify(p.db.store['months/2026-10'].lines['${LIFE}'].al)`)).toBe('[{"w":"P","v":50,"u":"pct"},{"w":"M","v":50,"u":"pct"}]');
  });

  test('4 mark paid from Home', async () => {
    await ev(page, "(p.S.ui.view='home',p.render())");
    const b = await ev<number>(page, "p.monthCalc('2026-10').lines.find(l=>l.id==='la-vie-estate-bond-extra').b");
    await page.click('[data-a="markpaid"]');
    await expect.poll(() => ev<number>(page, "p.monthCalc('2026-10').lines.find(l=>l.id==='la-vie-estate-bond-extra').act")).toBe(b);
  });

  test('5 start November', async () => {
    await ev(page, "(p.S.ui.view='budget',p.render())");
    await page.click('[data-a="startmonth"]');
    await page.click('#sm-go');
    await expect.poll(() => ev(page, 'p.S.ui.month')).toBe('2026-11');
    expect(await ev<number>(page, "Object.keys(p.db.store['months/2026-11'].lines).length")).toBeGreaterThan(25);
    expect(await ev<number>(page, "p.monthCalc('2026-11').lines.filter(l=>l.rec&&!l.act&&l.k!=='in').length")).toBeGreaterThan(10);
    expect(await ev(page, "'la-vie-transfer-costs' in p.db.store['months/2026-11'].lines")).toBe(false);
  });

  const checkAmt = () => rand(flowLine(6).match(/Check balance (R[\d,]+)/)![1]);
  test('6 check the credit card balance', async () => {
    await ev(page, "(p.S.ui.acc='d_cc',p.S.ui.view='account',p.render())");
    await page.click('[data-a="check"]');
    await page.fill('#ck-bal', String(checkAmt()));
    await page.click('#ck-save');
    await expect.poll(() => ev<number>(page, 'p.balances().d_cc.bal')).toBe(checkAmt());
  });

  test('7 move money, same-day order', async () => {
    const amt = rand(flowLine(7).match(/Move money (R[\d,]+)/)![1]);
    const pool0 = baseline().bal.pool_m.bal;
    await page.click('[data-a="transfer"]');
    await page.fill('#tr-amt', String(amt));
    await page.selectOption('#tr-from', 'pool_m');
    await page.selectOption('#tr-to', 'd_cc');
    await page.click('#tr-save');
    await expect.poll(() => ev<number>(page, 'p.balances().d_cc.bal')).toBeCloseTo(checkAmt() - amt, 2);
    expect(await ev<number>(page, 'p.balances().pool_m.bal')).toBeCloseTo(pool0 - amt, 2);
  });

  test('8 re-importing the original statements skips everything', async () => {
    test.skip(!hasStatements, 'statements not in private/statements');
    for (const s of statements()) {
      await ev(page, `(p.closeAll(),p.sheetImport('${s.acc}'))`);
      await page.setInputFiles('#im-file', statementPath(s.file));
      await expect(page.locator('#im-sum')).toContainText('0 to budget · 0 to account history');
      expect(await page.locator('.imp-row').count()).toBe(s.rows);
    }
    await ev(page, 'p.closeAll()');
  });

  test('9 import a new statement into the credit card', async () => {
    const who = personCases().find(([t, w]) => w === 'P' && /^[A-Z]{2} /.test(t))![0];   // “initials + surname”
    const top = referenceBackup().config.accounts.accounts.midmonth.n;
    const csv = priv('test-results', 'new_stmt.csv');
    mkdirSync(priv('test-results'), { recursive: true });
    writeFileSync(csv, `"Value Date","Value Time","Type","Description","Beneficiary or Cardholder","Amount"\n2026-10-05,10:00:00,"Google Pay","CHECKERS PAARL MALL","${who}",-412.30\n2026-10-03,00:01:00,"Interest","Interest Charged at 21.00%","",-180.00\n2026-10-04,09:00:00,"Transfer","Top up","To: ${top}",-200\n`);
    await ev(page, "p.sheetImport('d_cc')");
    await page.setInputFiles('#im-file', csv);
    await expect(page.locator('#im-sum')).toContainText('1 to budget · 2 to account history');
    const c0 = await ev<number>(page, 'p.balances().d_cc.bal');
    await page.click('#im-go');
    await expect.poll(() => ev<number>(page, 'p.balances().d_cc.bal')).toBeCloseTo(c0 + 412.3 + 180 + 200, 2);
    expect(await ev(page, "p.monthCalc('2026-10').lines.find(l=>l.id==='groceries').tx.some(t=>t.src==='statement'&&t.pay==='d_cc'&&t.by==='P')")).toBe(true);
    expect(await ev<number>(page, "p.monthCalc('2026-10').T.a.auto")).toBeGreaterThanOrEqual(412.3);
  });

  test('10 new milestone in rand and US dollars', async () => {
    const name = quoted(10), rate = flowLine(10).match(/R([\d.]+)\/US\$/)![1];
    await ev(page, "(p.S.ui.view='milestones',p.render())");
    await page.click('[data-a="newms"]');
    await page.fill('#ms-n', name);
    await page.fill('#ms-usd', rate);
    await page.click('#ms-save');
    await expect.poll(() => ev(page, 'p.S.ui.view')).toBe('milestone');
    expect(await ev(page, `Object.values(p.S.ms).some(m=>m.n===${JSON.stringify(name)})`)).toBe(true);
    await page.click('[data-a="mstxn"]');
    await page.fill('#mt-amt', '100');
    await page.selectOption('#mt-cur', 'USD');
    await page.click('#mt-save');
    await expect.poll(() => ev<number>(page, 'p.msCalc(p.S.ui.msId).exp.a')).toBeCloseTo(100 * +rate, 2);
  });

  test('11 export to Excel', async () => {
    const X = await import('xlsx');
    await ev(page, "(p.S.ui.view='more',p.render())");
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="export"]')]);
    expect(dl.suggestedFilename()).toMatch(/^Pa-Nashe Tracker \d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = X.read(readFileSync(await dl.path()));
    const months = await ev<string[]>(page, 'Object.keys(p.S.months).sort()');
    const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    expect(wb.SheetNames[0]).toBe('Overview 2026');
    expect(wb.SheetNames[1]).toMatch(/^Plan [A-Z][a-z]{2} 2026$/);
    for (const k of months) expect(wb.SheetNames).toContain(`${MN[+k.slice(5) - 1]} ${k.slice(0, 4)} Budget`);
    for (const n of ['Transactions', 'Accounts', 'Account history']) expect(wb.SheetNames).toContain(n);
    const msCount = await ev<number>(page, 'Object.keys(p.S.ms).length');
    expect(wb.SheetNames.filter(n => n.startsWith('MS '))).toHaveLength(msCount);
    const row5: any[] = (X.utils.sheet_to_json(wb.Sheets['October 2026 Budget'], { header: 1, defval: null }) as any[][])[4];
    const sal = await ev<any>(page, "(()=>{const l=p.monthCalc('2026-10').lines.find(l=>l.k==='in');return {n:l.it.n,b:l.b,a:l.act,who:l.al.map(x=>x.w).join('')}})()");
    expect(row5.slice(1, 4)).toEqual([sal.n, sal.b, sal.a]);
    expect(row5[6]).toBe(sal.who);
    expect(row5[7]).toBe(sal.b);
  });

  test('12 personFromText in the app', async () => {
    for (const [text, who] of personCases()) expect(await ev(page, `p.personFromText(${JSON.stringify(text)})`)).toBe(who);
  });

  test('13 no console errors along the way', async () => {
    expect(errors).toEqual([]);
  });
});
