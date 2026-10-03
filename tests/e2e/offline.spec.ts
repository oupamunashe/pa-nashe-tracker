/* SPEC §2.4 end to end, on a real production build (service worker + SupabaseAdapter + IndexedDB) against a
   fake Supabase answered here. Synthetic data only, so it runs in CI as well.
   online → offline capture (chip) → reload while offline (app shell + cached data + outbox) → back online (sent). */
import { expect, test, type BrowserContext, type Route } from '@playwright/test';
import { merged } from '../../src/data/merge';
import { storeFromBackup } from '../../src/data/adapter';
import { syntheticBackup } from '../helpers/private';

const APP = 'http://localhost:5176/pa-nashe-tracker/';
const SB = 'http://fake.supabase.test';

function fakeSession() {
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'piepie@example.test', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`, token_type: 'bearer', expires_in: 3600 * 24 * 365, expires_at: exp, refresh_token: 'refresh', user };
}

/** The docs table, the two RPCs and the members list – same semantics as 0001_init.sql. */
class FakeSupabase {
  rows = new Map<string, { data: any; version: number }>();
  offline = false;
  rpcs: { name: string; body: any }[] = [];
  constructor() { for (const [p, d] of Object.entries(storeFromBackup(syntheticBackup()))) this.rows.set(p, { data: d, version: 1 }); }
  async attach(ctx: BrowserContext) {
    await ctx.route(SB + '/**', (r: Route) => this.handle(r));
  }
  private json(r: Route, body: any, status = 200) { return r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); }
  private handle(r: Route) {
    if (this.offline) return r.abort('internetdisconnected');
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname === '/rest/v1/members') return this.json(r, [{ email: 'piepie@example.test', person: 'P' }]);
    if (url.pathname === '/rest/v1/docs' && req.method() === 'GET')
      return this.json(r, [...this.rows].map(([p, x]) => ({ collection: p.split('/')[0], id: p.split('/')[1], data: x.data, version: x.version })));
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop()!, b = req.postDataJSON();
      this.rpcs.push({ name, body: b });
      const path = b.p_collection + '/' + b.p_id, cur = this.rows.get(path);
      const data = name === 'doc_set' ? b.p_data : merged(cur?.data, b.p_patch);
      this.rows.set(path, { data, version: (cur?.version || 0) + 1 });
      return this.json(r, (cur?.version || 0) + 1);
    }
    return this.json(r, {});
  }
}

test('offline: capture, reload and sync (production build, service worker)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const sb = new FakeSupabase();
  await sb.attach(ctx);
  const session = fakeSession();
  await ctx.addInitScript(s => { if (!localStorage.getItem('sb-fake-auth-token')) localStorage.setItem('sb-fake-auth-token', s); }, JSON.stringify(session));
  const page = await ctx.newPage();
  const chip = page.locator('#netchip');

  // 1. online: signed in, data loaded, service worker in control
  await page.goto(APP);
  await expect(page.locator('main h1')).toHaveText('Hi Piepie', { timeout: 15000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 });
  expect(await page.locator('link[rel="manifest"]').count()).toBe(1);
  await expect(chip).toBeEmpty();
  const manifest = await (await page.request.get(APP + 'manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Pa-Nashe Tracker', short_name: 'Pa-Nashe', theme_color: '#1C1E26', start_url: '/pa-nashe-tracker/', scope: '/pa-nashe-tracker/', display: 'standalone' });

  // 2. offline: capture a spend – shown at once, counted in the chip
  sb.offline = true; await ctx.setOffline(true);
  await page.click('.tabbar .capture');
  await page.fill('#tx-amt', '12.34');
  await page.click('[data-quick="groceries"]');
  await page.fill('#tx-store', 'Offline Shop');
  await page.click('#tx-save');
  await expect(chip).toHaveText('Offline – 1 change waiting');
  await expect(page.getByText('Offline Shop')).toBeVisible();
  expect(sb.rpcs).toHaveLength(0);
  await page.waitForTimeout(400);                       // let the IndexedDB cache settle

  // 3. reload while offline: the app shell comes from the service worker, data and outbox from IndexedDB
  await page.reload();
  await expect(page.locator('main h1')).toHaveText('Hi Piepie', { timeout: 15000 });
  await expect(page.getByText('Offline Shop')).toBeVisible();
  await expect(chip).toHaveText('Offline – 1 change waiting');
  await page.screenshot({ path: 'test-results/offline-phone.png' });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.screenshot({ path: 'test-results/offline-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });

  // 4. back online: the queued change is sent and the chip clears
  sb.offline = false; await ctx.setOffline(false);
  await expect(chip).toBeEmpty({ timeout: 15000 });
  // the chip clears as soon as sending starts, so wait for the request itself (slower CI machines)
  await expect.poll(() => sb.rpcs.filter(x => x.name === 'doc_merge').length, { timeout: 15000 }).toBe(1);
  const merges = sb.rpcs.filter(x => x.name === 'doc_merge');
  expect(merges).toHaveLength(1);
  const sent: any = Object.values(merges[0].body.p_patch.txns)[0];
  expect(sent).toMatchObject({ amt: 12.34, it: 'groceries', store: 'Offline Shop', by: 'P', src: 'app' });
  const month = merges[0].body.p_id;
  expect(Object.values(sb.rows.get('months/' + month)!.data.txns).some((t: any) => t?.store === 'Offline Shop')).toBe(true);
  // Chrome's own verdict on “Install app” (manifest, icons, service worker, scope). Last: a DevTools session
  // interferes with Playwright's offline emulation across reloads.
  const cdp = await ctx.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  await ctx.close();
});
