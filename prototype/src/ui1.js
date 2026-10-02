/* ===================== UI · shell & main views ===================== */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  acc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 15h2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M15 14.6c2.6-.4 4.6 1.1 5.4 4.4"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
  year: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1A1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.8 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
};
const NAV = [
  ['home', 'Home', 'home'], ['budget', 'Budget', 'budget'], ['people', 'Piepie & Munny', 'people'], ['accounts', 'Accounts', 'acc'],
  ['plan', 'Plan', 'plan'], ['year', 'Year view', 'year'], ['milestones', 'Milestones', 'flag'], ['more', 'More', 'cog'],
];

function shell() {
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

let renderPending = false;
function scheduleRender() {
  if (renderPending) return; renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    const ae = document.activeElement;
    if (ae && $('#main')?.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) { S.deferRender = true; return; }
    render();
    refreshSheet();
  });
}
document.addEventListener('focusout', () => { if (S.deferRender) { S.deferRender = false; setTimeout(scheduleRender, 50); } });

function ready() { return S.loaded.config && S.loaded.months && S.loaded.ms; }
function curMonth() {
  const keys = monthKeys();
  if (!S.ui.month || !keys.includes(S.ui.month)) {
    const t = mkey(todayISO());
    S.ui.month = keys.includes(t) ? t : keys.filter(k => k <= t).pop() || keys[keys.length - 1] || t;
  }
  return S.ui.month;
}

function render() {
  const v = S.ui.view;
  $$('[data-a="nav"]').forEach(b => b.setAttribute('aria-current', b.dataset.v === v || (v === 'account' && b.dataset.v === 'accounts') || (v === 'milestone' && b.dataset.v === 'milestones') || (['people', 'plan', 'year', 'milestones', 'milestone'].includes(v) && b.dataset.v === 'more' && b.closest('.tabbar')) ? 'page' : 'false'));
  const who = $('#whobtn');
  if (who) who.innerHTML = S.me ? `<span class="avatar ${S.me}" style="width:26px;height:26px;border-radius:8px">${pname(S.me)[0]}</span><span class="small">${esc(pname(S.me))}</span>` : '<span class="small">Who are you?</span>';
  const main = $('#main');
  if (S.offline && !S.db) { main.innerHTML = offlineView(); $('#monthsw').innerHTML = ''; return; }
  if (!ready()) return;
  if (!S.cfg.main || !S.cfg.catalog) { main.innerHTML = `<div class="empty"><h2>Your tracker is empty</h2><p>The data hasn’t been loaded into this tracker yet. Ask Claude to load it, then reopen this page.</p></div>`; return; }
  const k = curMonth();
  const showMonth = ['home', 'budget', 'people', 'plan'].includes(v);
  const keys = monthKeys();
  $('#monthsw').innerHTML = showMonth ? `
    <button data-a="month" data-k="${prevKey(k)}" ${keys.includes(prevKey(k)) ? '' : 'disabled'} aria-label="Previous month">‹</button>
    <span class="lbl">${mName(k)}</span>
    <button data-a="month" data-k="${nextKey(k)}" ${keys.includes(nextKey(k)) ? '' : 'disabled'} aria-label="Next month">›</button>` : '';
  const views = { home: viewHome, budget: viewBudget, people: viewPeople, accounts: viewAccounts, account: viewAccount, plan: viewPlan, year: viewYear, milestones: viewMilestones, milestone: viewMilestone, more: viewMore, items: viewItems };
  main.innerHTML = (views[v] || viewHome)(k);
  if (S.ui.scrollTop) { window.scrollTo(0, 0); S.ui.scrollTop = false; }
}
function offlineView() {
  return `<div class="loading"><div style="max-width:440px"><h2>Open this from claude.ai</h2>
  <p class="muted">The Pa-Nashe Tracker keeps your data in a shared store that only works when the page is opened from its claude.ai link while you’re signed in.</p></div></div>`;
}

/* ---------- small renderers ---------- */
function allocChips(al) {
  if (!al || !al.length) return '';
  const tot = sum(al.filter(x => x.u === 'amt'), x => x.v);
  return al.map(x => `<span class="chip ${x.w}">${esc(pname(x.w))}${al.length > 1 ? ' ' + (x.u === 'pct' ? x.v + '%' : fmt0(x.v)) : ''}</span>`).join('');
}
function varCls(l) {
  if (!l.b && !l.act) return '';
  if (l.k === 'in' || l.k === 'sav') return l.act >= l.b ? 'pos' : (l.act ? 'neg' : 'faint');
  return l.act > l.b + 0.004 ? 'neg' : 'pos';
}
function lineRow(l, k) {
  const due = (l.rec || l.b) && !l.act && l.k !== 'in';
  const left = l.k === 'exp' ? l.b - l.act : l.act - l.b;
  const prog = l.b ? Math.min(100, l.act / l.b * 100) : (l.act ? 100 : 0);
  const over = l.k === 'exp' && l.act > l.b + 0.004;
  return `<div class="bl" data-a="line" data-k="${k}" data-id="${l.id}" role="button" tabindex="0">
    <div class="n"><span class="t">${esc(l.it.n)}</span>
      <div class="meta">${allocChips(l.al)}${l.rec ? '<span class="chip">Monthly</span>' : ''}${due && l.rec ? '<span class="chip warn">Due</span>' : ''}${l.tx.length > 1 ? `<span class="chip">${l.tx.length} entries</span>` : ''}</div>
      ${l.k === 'exp' && l.b ? `<div class="progress-mini ${over ? 'over' : ''}"><span style="width:${prog}%"></span></div>` : ''}
    </div>
    <div class="num">${l.b ? fmt(l.b) : '<span class="faint">–</span>'}</div>
    <div class="num ${varCls(l)}">${l.act ? fmt(l.act) : '<span class="faint">–</span>'}</div>
    <div class="num only-wide ${left < -0.004 ? 'neg' : 'muted'}">${l.b || l.act ? fmt(left) : ''}</div>
  </div>`;
}
function hbar(actPct, planPct, color = 'var(--brand)') {
  return `<div class="bar"><span style="width:${Math.max(0, Math.min(100, actPct * 100))}%;background:${color}"></span>${planPct ? `<i style="left:${Math.min(99.5, planPct * 100)}%"></i>` : ''}</div>`;
}

/* ---------- HOME ---------- */
function viewHome(k) {
  const mc = monthCalc(k), T = mc.T, pa = peopleCalc(k, 'a');
  const sid = main().scenario || '1', pl = planCalc(k, sid);
  const outs = pa.P.out + pa.M.out + pa.U.out || 1;
  const due = mc.lines.filter(l => l.k !== 'in' && (l.rec) && !l.act && l.b);
  const over = mc.lines.filter(l => l.k === 'exp' && l.b && l.act > l.b + 1).sort((a, b) => (b.act - b.b) - (a.act - a.b)).slice(0, 4);
  const bal = balances(), checks = Object.values(bal).filter(r => r.needsCheck);
  const recent = mc.txns.filter(t => t.src !== 'import').sort((a, b) => (b.at || 0) - (a.at || 0) || (b.d || '').localeCompare(a.d || '')).slice(0, 6);
  const hi = S.me ? 'Hi ' + esc(pname(S.me)) : 'Hello';
  return `<div class="stack">
  <div class="pagehead"><div><h1>${hi}</h1><p class="muted">${mName(k)} at a glance</p></div></div>
  <section class="hero">
    <div class="lbl">Left after savings and spending</div>
    <div class="big amt">${fmt(T.a.surplus)}</div>
    <div class="small" style="opacity:.85">Planned: ${fmt(T.b.surplus)}</div>
    <div class="flow">
      <div><span>Money in</span><b class="amt">${fmt0(T.a.income)}</b></div>
      <div><span>Saved</span><b class="amt">${fmt0(T.a.sav)}</b></div>
      <div><span>Spent</span><b class="amt">${fmt0(T.a.exp)}</b></div>
    </div>
    <div class="split" title="Who covered this month’s outgoings">
      <span style="width:${pa.P.out / outs * 100}%;background:var(--pp)"></span>
      <span style="width:${pa.M.out / outs * 100}%;background:var(--mm)"></span>
      <span style="width:${pa.U.out / outs * 100}%;background:color-mix(in srgb,var(--brand-ink) 45%,transparent)"></span>
    </div>
    <div class="row small" style="margin-top:6px;opacity:.9;gap:14px;flex-wrap:wrap">
      <span>${esc(pname('P'))} ${fmt0(pa.P.out)}</span><span>${esc(pname('M'))} ${fmt0(pa.M.out)}</span>${pa.U.out ? `<span>Not allocated ${fmt0(pa.U.out)}</span>` : ''}
    </div>
  </section>
  <div class="grid2">
    <section class="panel">
      <div class="panel-h"><h2>Still to pay</h2><span class="small muted">${due.length ? fmt(sum(due, l => l.b)) : ''}</span></div>
      ${due.length ? `<ul class="list" style="margin:0 -16px -16px">${due.map(l => `
        <li class="li" data-a="line" data-k="${k}" data-id="${l.id}"><div class="grow"><div class="t">${esc(l.it.n)}</div><div class="s">${allocChips(l.al) || esc(GMAP[l.g]?.n || '')}</div></div>
        <div class="v">${fmt(l.b)}</div><button class="btn sm" data-a="markpaid" data-k="${k}" data-id="${l.id}">Mark paid</button></li>`).join('')}</ul>`
        : `<p class="muted">Every monthly payment in ${MONTHS[+k.slice(5) - 1]} has an amount against it.</p>`}
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Against your plan</h2>
        <div class="seg">${['1', '2', '3'].map(s => `<button data-a="scen" data-s="${s}" aria-pressed="${s === sid}">${s}</button>`).join('')}</div></div>
      <p class="small muted" style="margin:-4px 0 10px">Scenario ${sid}: ${esc(main().scen?.[sid]?.name || '')}. The tick shows the target share of earned income.</p>
      ${pl.cats.map(c => `<div style="margin-bottom:10px"><div class="row between small"><span>${esc(c.n)}</span>
        <span class="amt"><b class="${c.save ? (c.actPct >= c.planPct ? 'pos' : 'neg') : (c.actPct <= c.planPct ? 'pos' : 'neg')}">${pct(c.actPct)}</b> <span class="muted">of ${pct(c.planPct)}</span></span></div>
        ${hbar(c.actPct, c.planPct, c.save ? 'var(--good)' : (c.actPct > c.planPct ? 'var(--bad)' : 'var(--brand)'))}</div>`).join('')}
      <div class="row between small" style="margin-top:12px"><span class="muted">Net savings rate (after drawdowns)</span><b class="${pl.netRate >= (pl.savePlan / (pl.base || 1)) ? 'pos' : 'neg'}">${pct(pl.netRate, 1)}</b></div>
    </section>
  </div>
  <div class="grid2">
    <section class="panel">
      <div class="panel-h"><h2>Needs a look</h2></div>
      ${checks.length || over.length ? `<ul class="list" style="margin:0 -16px -16px">
        ${checks.length ? `<li class="li" data-a="nav" data-v="accounts"><div class="avatar J">${checks.length}</div><div class="grow"><div class="t">Balances to confirm</div><div class="s">${checks.slice(0, 3).map(r => esc(r.a.n)).join(', ')}${checks.length > 3 ? '…' : ''}</div></div></li>` : ''}
        ${over.map(l => `<li class="li" data-a="line" data-k="${k}" data-id="${l.id}"><div class="grow"><div class="t">${esc(l.it.n)}</div><div class="s">Over budget by ${fmt(l.act - l.b)}</div></div><div class="v neg">${fmt0(l.act)}<small>of ${fmt0(l.b)}</small></div></li>`).join('')}
      </ul>` : '<p class="muted">Nothing over budget and every balance is confirmed.</p>'}
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Latest entries</h2><button class="btn sm ghost" data-a="nav" data-v="budget">See budget</button></div>
      ${recent.length ? `<ul class="list" style="margin:0 -16px -16px">${recent.map(t => txnLi(t, k)).join('')}</ul>` : `<p class="muted">Nothing captured in the app for ${MONTHS[+k.slice(5) - 1]} yet. Tap <b>Add a spend</b> after your next shop.</p>`}
    </section>
  </div>
  <section class="grid2">${['P', 'M'].map(w => personMini(w, k)).join('')}</section>
  </div>`;
}
function txnLi(t, k) {
  const it = cat()[t.it] || { n: '?' };
  const a = t.pay ? accs()[t.pay] : null;
  return `<li class="li" data-a="txn" data-k="${k}" data-id="${t.id}">
    <div class="avatar ${t.by || 'J'}">${t.by ? pname(t.by)[0] : '·'}</div>
    <div class="grow"><div class="t">${esc(t.store || it.n)}</div><div class="s">${esc(t.store ? it.n : (t.note || ''))}${a ? ' · ' + esc(a.n) : ''}</div></div>
    <div class="v ${itemKind(t.it) === 'in' ? 'pos' : ''}">${fmt(t.amt)}<small>${fmtDate(t.d)}</small></div></li>`;
}
function personMini(w, k) {
  const pb = peopleCalc(k, 'b')[w], pa = peopleCalc(k, 'a')[w];
  return `<section class="person ${w}" data-a="nav" data-v="people" style="cursor:pointer">
    <div class="row between"><h3>${esc(pname(w))}</h3><span class="small muted">planned for ${MONTHS[+k.slice(5) - 1]}</span></div>
    <div class="big ${pb.left < 0 ? 'neg' : ''}">${fmt(pb.left)}</div>
    <div class="small muted">${fmt0(pb.inc)} allocated income · ${fmt0(pb.out)} committed</div>
    <div class="small" style="margin-top:6px">So far: ${fmt0(pa.out)} paid out of ${fmt0(pa.inc)} received</div>
  </section>`;
}

/* ---------- BUDGET ---------- */
function viewBudget(k) {
  const mc = monthCalc(k), T = mc.T;
  const isLatest = monthKeys().slice(-1)[0] === k;
  const f = S.ui.bfilter || 'all';
  let lines = mc.lines;
  if (f === 'due') lines = lines.filter(l => l.k !== 'in' && !l.act && (l.b || l.rec));
  if (f === 'over') lines = lines.filter(l => l.k === 'exp' && l.act > l.b + 0.004);
  const col = S.ui.collapsed || (S.ui.collapsed = {});
  const sec = s => {
    const ls = lines.filter(l => l.k === s.k);
    const groups = GROUPS.filter(g => g.sec === s.k);
    const tb = s.k === 'in' ? T.b.earned + T.b.funding : T.b[s.k], ta = s.k === 'in' ? T.a.income : T.a[s.k];
    const autoRows = s.k === 'in' && Object.keys(mc.auto).length ? `<div class="grp"><div class="grp-h"><span class="n">Paid from savings & credit (automatic)</span><span class="num right">–</span><span class="num right">${fmt(T.a.auto)}</span></div>
      ${Object.entries(mc.auto).map(([a, v]) => `<div class="bl" style="cursor:default"><div class="n"><span class="t">From ${esc(accs()[a]?.n || a)}</span><div class="meta"><span class="chip">auto</span></div></div><div class="num faint">–</div><div class="num">${fmt(v)}</div></div>`).join('')}</div>` : '';
    return `<section class="panel flush" style="margin-bottom:14px">
      <div class="sec-h">${s.n}<span class="tot"><span class="muted small">${fmt0(tb)} planned · </span>${fmt0(ta)}</span></div>
      <div class="cols-h"><span>Line item</span><span>Budget</span><span>Actual</span><span class="only-wide">${s.k === 'exp' ? 'Left' : 'Variance'}</span></div>
      ${groups.map(g => {
        const gl = ls.filter(l => l.g === g.k); if (!gl.length) return '';
        const gb = sum(gl, l => l.b), ga = sum(gl, l => l.act), open = col[k + g.k] ? '0' : '1';
        return `<div class="grp" data-open="${open}"><div class="grp-h" data-a="togglegrp" data-g="${k + g.k}"><span class="n">${I.chev}${esc(g.n)}</span><span class="num right">${fmt(gb)}</span><span class="num right">${fmt(ga)}</span><span class="num right only-wide muted">${fmt(s.k === 'exp' ? gb - ga : ga - gb)}</span></div>
          <div class="grp-b">${gl.map(l => lineRow(l, k)).join('')}</div></div>`;
      }).join('')}${autoRows}
      ${!ls.length && !autoRows ? '<div class="empty" style="margin:0 14px 14px">No lines here.</div>' : ''}
    </section>`;
  };
  return `<div>
  <div class="pagehead"><div><h1>${mName(k)} budget</h1><p class="muted">Tap a line to see its entries, change the budget or split it between you.</p></div>
    <div class="row wrap"><button class="btn" data-a="addline" data-k="${k}">${I.plus}Add line</button>
    ${isLatest ? `<button class="btn" data-a="startmonth" data-k="${nextKey(k)}">Start ${MONTHS[+nextKey(k).slice(5) - 1]}</button>` : ''}</div></div>
  <div class="kpis" style="margin-bottom:14px">
    ${[['Money in', T.b.income, T.a.income], ['Saved', T.b.sav, T.a.sav], ['Spent', T.b.exp, T.a.exp], ['Left over', T.b.surplus, T.a.surplus]].map(([n, b, a], i) =>
      `<div class="kpi"><span>${n}</span><b class="${i === 3 ? (a < 0 ? 'neg' : 'pos') : ''}">${fmt(a)}</b><span>Planned ${fmt(b)}</span></div>`).join('')}
  </div>
  <div class="row wrap" style="margin-bottom:12px"><div class="seg">
    ${[['all', 'All lines'], ['due', 'Still to pay'], ['over', 'Over budget']].map(([v, n]) => `<button data-a="bfilter" data-v="${v}" aria-pressed="${f === v}">${n}</button>`).join('')}
  </div></div>
  ${SECTIONS.map(sec).join('')}
  <section class="panel row between"><h2>Left over</h2><div class="right"><div class="amt ${T.a.surplus < 0 ? 'neg' : 'pos'}" style="font-family:var(--font-d);font-size:1.4rem;font-weight:750">${fmt(T.a.surplus)}</div><div class="small muted">Planned ${fmt(T.b.surplus)}</div></div></section>
  </div>`;
}

/* ---------- PEOPLE ---------- */
function viewPeople(k) {
  const basis = S.ui.people || 'b';
  const R = peopleCalc(k, basis);
  const card = w => {
    const r = R[w];
    const inc = r.lines.filter(x => x.l.k === 'in'), out = r.lines.filter(x => x.l.k !== 'in');
    const li = x => `<li class="li" ${x.l.id && !String(x.l.id).startsWith('auto') ? `data-a="line" data-k="${k}" data-id="${x.l.id}"` : ''}><div class="grow"><div class="t">${esc(x.l.it.n)}</div></div><div class="v">${fmt(x.v)}</div></li>`;
    return `<section class="person ${w}">
      <div class="row between"><h2>${w === 'U' ? 'Not allocated yet' : esc(pname(w))}</h2></div>
      ${w !== 'U' ? `<div class="big ${r.left < 0 ? 'neg' : ''}">${fmt(r.left)}</div><div class="small muted">${basis === 'b' ? 'planned surplus' : 'surplus so far'} · ${fmt0(r.inc)} in, ${fmt0(r.out)} out</div>`
        : `<p class="small muted">Lines nobody is assigned to yet. Tap one to split it.</p><div class="small">${fmt0(r.inc)} income · ${fmt0(r.out)} outgoings</div>`}
      ${inc.length ? `<h3 style="margin:14px 0 4px">Income</h3><ul class="list" style="margin:0 -16px">${inc.map(li).join('')}</ul>` : ''}
      ${out.length ? `<h3 style="margin:14px 0 4px">Paying for</h3><ul class="list" style="margin:0 -16px">${out.sort((a, b) => b.v - a.v).map(li).join('')}</ul>` : ''}
    </section>`;
  };
  return `<div>
    <div class="pagehead"><div><h1>Piepie & Munny</h1><p class="muted">All income goes into one pool. Here’s who carries which part of ${mName(k)}.</p></div>
      <div class="seg"><button data-a="pbasis" data-v="b" aria-pressed="${basis === 'b'}">Budget</button><button data-a="pbasis" data-v="a" aria-pressed="${basis === 'a'}">Actual</button></div></div>
    <div class="grid3">${card('P')}${card('M')}${card('U')}</div>
  </div>`;
}
