/* Start-up: theme → (demo: MemoryAdapter) or (sign-in → membership → SupabaseAdapter) → shell → subscribe. */
import './styles/fonts.css';
import './styles/app.css';
import './styles/extra.css';
import './ui/actions';
import type { Session } from '@supabase/supabase-js';
import { membership, supabase } from './auth/auth';
import { session } from './auth/session';
import { balances } from './calc/balances';
import { monthCalc } from './calc/month';
import { msCalc } from './calc/milestones';
import { peopleCalc } from './calc/people';
import { planCalc } from './calc/plan';
import { yearCalc } from './calc/year';
import { hooks } from './core/hooks';
import { S, lsDel, lsGet } from './core/state';
import type { Who } from './core/types';
import { storeFromBackup } from './data/adapter';
import { subscribe } from './data/db';
import { MemoryAdapter, MemoryFiles } from './data/memory';
import { LocalStore, clearAllLocal } from './data/offline';
import { SupabaseAdapter, SupabaseFiles } from './data/supabase';
import { refreshSheet, toast } from './ui/sheet';
import { sheetPassword, showMessage, showPrivate, showSignIn } from './ui/signin';
import { setNetStatus, smokeRender, smokeShell } from './ui/smoke';

let renderPending = false;
hooks.toast = toast;
hooks.render = () => smokeRender();
hooks.scheduleRender = () => {
  if (renderPending) return; renderPending = true;
  requestAnimationFrame(() => { renderPending = false; smokeRender(); refreshSheet(); });
};

function stillConnecting() {
  setTimeout(() => {
    if (S.loaded.config && S.loaded.months && S.loaded.ms) return;
    const m = document.getElementById('main');
    if (m) m.innerHTML = '<div class="loading"><div><h2>Still connecting…</h2><p class="muted">Your data is taking longer than usual to load. Check your connection; the page will fill in as soon as it arrives.</p></div></div>';
  }, 15000);
}

/* ---------- demo: MemoryAdapter, no login (npm run dev:demo) ---------- */
async function startDemo() {
  const q = new URLSearchParams(location.search);
  const seed = await (await fetch('/__seed.json' + (q.has('synthetic') ? '?synthetic' : ''))).json();
  const db = new MemoryAdapter(storeFromBackup(seed));
  const me = q.get('me');
  if (me === 'P' || me === 'M') S.me = me as Who; else if (!S.me) S.me = 'P';
  Object.assign(S, { db, assets: new MemoryFiles() });
  smokeShell();
  subscribe();
  // test hooks (demo mode only – never in a production build)
  Object.assign(window as any, { __pn: { S, db, monthCalc, peopleCalc, balances, planCalc, yearCalc, msCalc } });
}

/* ---------- production: Supabase ---------- */
async function startApp() {
  let sb: ReturnType<typeof supabase>;
  try { sb = supabase(); } catch (e: any) { showMessage('Not set up yet', e.message); return; }
  let entered = false, recovery = false, inShell = false;

  async function signOut(db?: SupabaseAdapter, local?: LocalStore) {
    db?.stop();
    try { await local?.destroy(); } catch (e) {}
    await clearAllLocal();
    lsDel('pn_me');
    await sb.auth.signOut({ scope: 'local' });
    location.reload();
  }

  async function enter(s: Session) {
    if (entered) return; entered = true;
    const email = s.user.email || '';
    const m = await membership(s);
    if (m === 'not-member') { showPrivate(email, () => signOut()); return; }
    if (m === 'unknown') { showMessage('Can’t reach the tracker', 'This device is offline and hasn’t opened the tracker before. Connect to the internet and reload the page.'); return; }
    S.me = (lsGet('pn_me') as Who | null) || m.person;
    const local = new LocalStore(s.user.id);
    const db = new SupabaseAdapter(sb, local, msg => toast(msg, 'bad'));
    Object.assign(S, { db, assets: new SupabaseFiles(sb), user: { id: s.user.id, email } });
    Object.assign(session, { active: true, email, pending: () => db.pendingCount, signOut: () => signOut(db, local) });
    smokeShell(); inShell = true;
    db.onStatus(setNetStatus);
    subscribe();
    stillConnecting();
    if (recovery) sheetPassword(true);
    await db.start();
  }

  // Callbacks must not await Supabase calls directly (supabase-js holds a lock during the callback).
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY') { recovery = true; if (inShell) setTimeout(() => sheetPassword(true), 0); }
    if (ev === 'SIGNED_IN' && s) setTimeout(() => enter(s), 0);
    if (ev === 'SIGNED_OUT' && entered) location.reload();
  });
  const { data } = await sb.auth.getSession();
  if (data.session) enter(data.session);
  else if (!entered) showSignIn();
}

const th = lsGet('pn_theme'); if (th && th !== 'auto') document.documentElement.dataset.theme = th;
document.body.innerHTML = '<main id="main"><div class="loading"><div><div class="spin"></div>Loading your tracker…</div></div></main>';
if (import.meta.env.MODE === 'demo') startDemo(); else startApp();
