/* Open the app in demo mode (MemoryAdapter on the reference seed) with the clock at 2 Oct 2026, like the
   prototype's reference screenshots and flows. */
import type { Page } from '@playwright/test';

export const DAY = new Date('2026-10-02T10:00:00+02:00');
/** frozen: Date.now() never moves (stable screenshots). Otherwise the clock starts at DAY and ticks, so entries
    made one after the other get increasing `at` timestamps (same-day ordering depends on it). */
export async function openDemo(page: Page, path = './?me=P', frozen = true) {
  if (frozen) await page.clock.setFixedTime(DAY);
  else await page.clock.install({ time: DAY });
  await page.goto(path);
  await page.waitForFunction(() => { const S = (window as any).__pn?.S; return S && S.loaded.config && S.loaded.months && S.loaded.ms && document.querySelector('.pagehead'); });
  await page.evaluate(() => document.fonts.ready);
}
