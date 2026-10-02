/* Start-up. Phase 1: demo mode only (MemoryAdapter seeded from /__seed.json); the UI port follows in Phase 3. */
import { balances } from './calc/balances';
import { monthCalc } from './calc/month';
import { msCalc } from './calc/milestones';
import { peopleCalc } from './calc/people';
import { planCalc } from './calc/plan';
import { yearCalc } from './calc/year';
import { S } from './core/state';
import type { Who } from './core/types';
import { storeFromBackup } from './data/adapter';
import { subscribe } from './data/db';
import { MemoryAdapter, MemoryFiles } from './data/memory';

async function startDemo() {
  const q = new URLSearchParams(location.search);
  const seed = await (await fetch('/__seed.json' + (q.has('synthetic') ? '?synthetic' : ''))).json();
  const db = new MemoryAdapter(storeFromBackup(seed));
  const me = q.get('me');
  if (me === 'P' || me === 'M') S.me = me as Who; else if (!S.me) S.me = 'P';
  Object.assign(S, { db, assets: new MemoryFiles() });
  subscribe();
  // test hooks (demo mode only – never in a production build)
  Object.assign(window as any, { __pn: { S, db, monthCalc, peopleCalc, balances, planCalc, yearCalc, msCalc } });
}

document.body.innerHTML = '<main id="main"><div class="loading"><div><div class="spin"></div>Loading your tracker…</div></div></main>';
if (import.meta.env.MODE === 'demo') startDemo();
