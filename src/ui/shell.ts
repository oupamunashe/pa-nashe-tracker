/* ===================== UI · shell & navigation (from prototype ui1.js) ===================== */
import { mName, nextKey, prevKey, todayISO, mkey, esc } from '../core/format';
import { hooks } from '../core/hooks';
import { S, monthKeys, pname } from '../core/state';
import type { StoreStatus } from '../data/adapter';
import { I } from './icons';
import { $, $$, refreshSheet, toast } from './sheet';
import { viewAccount, viewAccounts } from './views/accounts';
import { viewBudget } from './views/budget';
import { viewHome } from './views/home';
import { viewMilestone, viewMilestones } from './views/milestones';
import { viewItems, viewMore } from './views/more';
import { viewPeople } from './views/people';
import { viewPlan } from './views/plan';
import { viewYear } from './views/year';

export const NAV = [
  ['home', 'Home', 'home'], ['budget', 'Budget', 'budget'], ['people', 'Piepie & Munny', 'people'], ['accounts', 'Accounts', 'acc'],
  ['plan', 'Plan', 'plan'], ['year', 'Year view', 'year'], ['milestones', 'Milestones', 'flag'], ['more', 'More', 'cog'],
];

export function shell() {
  document.body.innerHTML = `
  <div class="app">
    <aside class="rail">
      <div class="brandmark"><span class="dot"></span>Pa-Nashe Tracker</div>
      <button class="capture-big" data-a="capture">${I.plus}Add a spend</button>
      <nav>${NAV.map(([v, n, ic]) => `<button data-a="nav" data-v="${v}">${I[ic]}${n}</button>`).join('')}</nav>
      <div style="margin-top:auto" class="small muted" id="railwho"></div>
    </aside>
    <div class="main-wrap">
      <header class="topbar"><div class="topbar-in">
        <div class="brandmark"><span class="dot"></span>Pa-Nashe</div>
        <span class="netchip" id="netchip">${netChip()}</span>
        <div class="monthsw" id="monthsw"></div>
        <button class="who" data-a="who" id="whobtn" aria-label="Who is using this device"></button>
      </div></header>
      <main id="main"><div class="loading"><div><div class="spin"></div>Loading your tracker…</div></div></main>
    </div>
    <nav class="tabbar">
      <button data-a="nav" data-v="home">${I.home}Home</button>
      <button data-a="nav" data-v="budget">${I.budget}Budget</button>
      <div class="cap-wrap"><button class="capture" data-a="capture" aria-label="Add a spend">${I.plus}</button>Add</div>
      <button data-a="nav" data-v="accounts">${I.acc}Accounts</button>
      <button data-a="nav" data-v="more">${I.more}More</button>
    </nav>
  </div>
  <div id="sheets"></div>`;
}

/* ---------- “Offline – N changes waiting” (SPEC §2.4) ---------- */
let net: StoreStatus = { online: true, pending: 0, flushing: false };
function netChip() {
  const n = net.pending, s = n === 1 ? '' : 's';
  if (!net.online) return `<span class="chip warn">Offline${n ? ` – ${n} change${s} waiting` : ''}</span>`;
  return n && !net.flushing ? `<span class="chip">${n} change${s} waiting</span>` : '';
}
export function setNetStatus(s: StoreStatus) { net = s; const c = $('#netchip'); if (c) c.innerHTML = netChip(); }

let renderPending = false;
export function scheduleRender() {
  if (renderPending) return; renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    const ae: any = document.activeElement;
    if (ae && $('#main')?.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) { S.deferRender = true; return; }
    render();
    refreshSheet();
  });
}
document.addEventListener('focusout', () => { if (S.deferRender) { S.deferRender = false; setTimeout(scheduleRender, 50); } });

export function ready() { return S.loaded.config && S.loaded.months && S.loaded.ms; }
export function curMonth() {
  const keys = monthKeys();
  if (!S.ui.month || !keys.includes(S.ui.month)) {
    const t = mkey(todayISO());
    S.ui.month = keys.includes(t) ? t : keys.filter(k => k <= t).pop() || keys[keys.length - 1] || t;
  }
  return S.ui.month as string;
}

export function render() {
  const v = S.ui.view;
  $$('[data-a="nav"]').forEach(b => b.setAttribute('aria-current', b.dataset.v === v || (v === 'account' && b.dataset.v === 'accounts') || (v === 'milestone' && b.dataset.v === 'milestones') || (['people', 'plan', 'year', 'milestones', 'milestone'].includes(v) && b.dataset.v === 'more' && b.closest('.tabbar')) ? 'page' : 'false'));
  const who = $('#whobtn');
  if (who) who.innerHTML = S.me ? `<span class="avatar ${S.me}" style="width:26px;height:26px;border-radius:8px">${pname(S.me)[0]}</span><span class="small">${esc(pname(S.me))}</span>` : '<span class="small">Who are you?</span>';
  const main = $('#main') as HTMLElement;
  if (!ready()) return;
  if (!S.cfg.main || !S.cfg.catalog) { main.innerHTML = `<div class="empty"><h2>Your tracker is empty</h2><p>The data hasn’t been loaded into this tracker yet. Load a backup with the seed script, then reopen this page.</p></div>`; return; }
  const k = curMonth();
  const showMonth = ['home', 'budget', 'people', 'plan'].includes(v);
  const keys = monthKeys();
  ($('#monthsw') as HTMLElement).innerHTML = showMonth ? `
    <button data-a="month" data-k="${prevKey(k)}" ${keys.includes(prevKey(k)) ? '' : 'disabled'} aria-label="Previous month">‹</button>
    <span class="lbl">${mName(k)}</span>
    <button data-a="month" data-k="${nextKey(k)}" ${keys.includes(nextKey(k)) ? '' : 'disabled'} aria-label="Next month">›</button>` : '';
  const views: Record<string, (k: string) => string> = { home: viewHome, budget: viewBudget, people: viewPeople, accounts: viewAccounts, account: viewAccount, plan: viewPlan, year: viewYear, milestones: viewMilestones, milestone: viewMilestone, more: viewMore, items: viewItems };
  main.innerHTML = (views[v] || viewHome)(k);
  if (S.ui.scrollTop) { window.scrollTo(0, 0); S.ui.scrollTop = false; }
}

hooks.render = render;
hooks.scheduleRender = scheduleRender;
hooks.toast = toast;
