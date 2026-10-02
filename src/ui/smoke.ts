/* TEMPORARY (Phase 2 only): a minimal screen to prove login, Supabase, Realtime and the outbox end to end.
   Replaced by the full UI port in Phase 3. Uses the prototype's markup and classes. */
import { monthCalc } from '../calc/month';
import { esc, fmt, fmt0, fmtDate, mName, mkey, todayISO } from '../core/format';
import { S, cat, monthKeys, pname } from '../core/state';
import type { StoreStatus } from '../data/adapter';
import { deleteTxn, saveTxn } from '../data/db';
import { addActions } from './actions';
import { $, num, toast, val } from './sheet';
import { sheetSettings } from './sheets/settings';

let net: StoreStatus = { online: true, pending: 0, flushing: false };
export function setNetStatus(s: StoreStatus) { net = s; const c = $('#netchip'); if (c) c.innerHTML = chip(); }
const chip = () => !net.online ? `<span class="chip warn">Offline${net.pending ? ` – ${net.pending} change${net.pending > 1 ? 's' : ''} waiting` : ''}</span>`
  : net.pending ? `<span class="chip">Saving ${net.pending} change${net.pending > 1 ? 's' : ''}…</span>` : '';

export function smokeShell() {
  document.body.innerHTML = `<div class="app"><div class="main-wrap">
    <header class="topbar"><div class="topbar-in"><div class="brandmark" style="font-size:1.05rem"><span class="dot"></span>Pa-Nashe</div>
      <span id="netchip" class="netchip" style="margin-left:auto">${chip()}</span>
      <button class="who" data-a="settings">Settings</button></div></header>
    <main id="main"><div class="loading"><div><div class="spin"></div>Loading your tracker…</div></div></main></div></div><div id="sheets"></div>`;
  addActions({
    settings: () => sheetSettings(),
    smokedel: d => { deleteTxn(d.k as string, d.id as string).then(() => toast('Entry deleted')); },
  });
  document.addEventListener('submit', async e => {
    const f = e.target as HTMLFormElement; if (f.id !== 'sm-form') return;
    e.preventDefault();
    const amt = Math.round(num(f, '#sm-amt') * 100) / 100, it = val(f, '#sm-it');
    if (!(amt > 0) || !it) return toast('Enter an amount and choose a line item.', 'bad');
    const k = f.dataset.k as string;                       // the month on screen
    const t: any = { d: mkey(todayISO()) === k ? todayISO() : k + '-28', mo: k, it, amt, src: 'app', at: Date.now(), note: 'Smoke test' };
    const store = val(f, '#sm-store'); if (store) t.store = store; if (S.me) t.by = S.me;
    await saveTxn(t);
    toast(`Saved ${fmt(amt)} to ${cat()[it]?.n}`);
    (document.activeElement as HTMLElement | null)?.blur();
    smokeRender();
  });
}

export function smokeRender() {
  const main = $('#main'); if (!main) return;
  if (!(S.loaded.config && S.loaded.months && S.loaded.ms)) return;
  if (!S.cfg.main || !S.cfg.catalog) { main.innerHTML = `<div class="empty"><h2>Your tracker is empty</h2><p>Load a backup with the seed script, then reopen this page.</p></div>`; return; }
  const keys = monthKeys(), t = mkey(todayISO());
  const k = keys.includes(t) ? t : keys.filter(x => x <= t).pop() || keys[keys.length - 1];
  const T = monthCalc(k).T;
  const recent = monthCalc(k).txns.filter(x => x.src !== 'import').sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 8);
  const items = Object.entries(cat()).filter(([, it]) => it && !it.arch && it.g !== 'earned').sort((a, b) => a[1].n.localeCompare(b[1].n));
  const keepFocus = document.activeElement?.closest('#sm-form');
  if (keepFocus) return;   // don't redraw under someone typing
  main.innerHTML = `<div class="stack">
    <div class="notice"><b>Phase 2 smoke test.</b> Sign-in, live sync and offline saving on your real Supabase data. The full app arrives in Phase 3.</div>
    <div class="pagehead"><div><h1>Hi ${esc(pname(S.me))}</h1><p class="muted">${mName(k)} at a glance</p></div></div>
    <section class="hero"><div class="lbl">Left after savings and spending</div><div class="big amt">${fmt(T.a.surplus)}</div>
      <div class="small" style="opacity:.85">Planned: ${fmt(T.b.surplus)}</div>
      <div class="flow"><div><span>Money in</span><b class="amt">${fmt0(T.a.income)}</b></div><div><span>Saved</span><b class="amt">${fmt0(T.a.sav)}</b></div><div><span>Spent</span><b class="amt">${fmt0(T.a.exp)}</b></div></div></section>
    <section class="panel"><div class="panel-h"><h2>Add a test entry</h2></div>
      <form id="sm-form" class="f2" style="align-items:end" data-k="${k}">
        <div class="field"><label for="sm-amt">Amount</label><input id="sm-amt" class="inp num" inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label for="sm-it">Line item</label><select id="sm-it" class="inp">${items.map(([id, it]) => `<option value="${id}" ${id === 'groceries' ? 'selected' : ''}>${esc(it.n)}</option>`).join('')}</select></div>
        <div class="field"><label for="sm-store">Store or payee</label><input id="sm-store" class="inp" placeholder="e.g. Test"></div>
        <div class="field"><button class="btn primary" type="submit">Save</button></div>
      </form></section>
    <section class="panel"><div class="panel-h"><h2>Latest entries</h2></div>
      ${recent.length ? `<ul class="list" style="margin:0 -16px -16px">${recent.map(x => `<li class="li"><div class="avatar ${x.by || 'J'}">${x.by ? pname(x.by)[0] : '·'}</div>
        <div class="grow"><div class="t">${esc(x.store || cat()[x.it]?.n)}</div><div class="s">${esc(cat()[x.it]?.n || '')} · ${fmtDate(x.d)}</div></div>
        <div class="v">${fmt(x.amt)}</div>${x.note === 'Smoke test' ? `<button class="btn sm danger" data-a="smokedel" data-k="${k}" data-id="${x.id}">Delete</button>` : ''}</li>`).join('')}</ul>`
        : `<p class="muted">Nothing captured in the app for ${mName(k)} yet.</p>`}
    </section></div>`;
}
