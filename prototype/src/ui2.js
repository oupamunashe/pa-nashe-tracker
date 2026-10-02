/* ===================== UI · accounts, plan, year, milestones, more ===================== */
function accRow(r) {
  const a = r.a; const liab = isLiab(a);
  const goalPct = a.goal && r.known ? Math.max(0, Math.min(1, r.bal / a.goal)) : null;
  const val = a.t === 'bank' && a.track === false ? '<span class="faint small">not tracked</span>'
    : r.known ? `<span class="${liab ? (r.bal > 0.004 ? 'neg' : 'pos') : (r.bal < -0.004 ? 'neg' : '')}">${fmt(r.bal)}</span>` : '<span class="chip warn">Set balance</span>';
  return `<li class="li" data-a="openacc" data-id="${r.id}">
    <div class="avatar ${a.ow || 'J'}">${a.ow === 'J' ? 'PM' : pname(a.ow)[0]}</div>
    <div class="grow"><div class="t">${esc(a.n)}</div>
      <div class="s">${esc(a.bank || ACC_TYPES[a.t] || '')}${r.needsCheck ? ' · <span class="chip warn">confirm balance</span>' : ''}${a.closed ? ' · closed' : ''}</div>
      ${goalPct !== null ? `<div class="progress-mini" style="max-width:220px"><span style="width:${goalPct * 100}%"></span></div>` : ''}</div>
    <div class="v">${val}${a.goal ? `<small>goal ${fmt0(a.goal)}</small>` : liab && a.limit ? `<small>limit ${fmt0(a.limit)}</small>` : ''}</div></li>`;
}
function viewAccounts() {
  const B = balances(); const all = Object.values(B).filter(r => !r.a.closed || S.ui.showClosed);
  const by = t => all.filter(r => r.a.t === t).sort((x, y) => (x.a.n || '').localeCompare(y.a.n || ''));
  const physical = all.filter(r => r.a.t === 'savings' && r.known && !r.needsCheck), debts = all.filter(r => isLiab(r.a) && r.known && !r.needsCheck);
  const unS = all.filter(r => r.a.t === 'savings' && r.needsCheck).length, unD = all.filter(r => isLiab(r.a) && r.needsCheck && !r.a.closed).length;
  const totS = sum(physical, r => r.bal), totD = sum(debts, r => r.bal);
  const checks = all.filter(r => r.needsCheck);
  const block = (t, title, hint) => { const rs = by(t); if (!rs.length) return ''; return `<section class="panel flush"><div class="sec-h">${title}<span class="tot small muted">${hint || ''}</span></div><ul class="list">${rs.map(accRow).join('')}</ul></section>`; };
  return `<div class="stack">
    <div class="pagehead"><div><h1>Accounts</h1><p class="muted">Balances update from your budget, captured spends and imported statements.</p></div>
      <div class="row wrap"><button class="btn" data-a="transfer">Move money</button><button class="btn" data-a="import">Import statement</button><button class="btn" data-a="newacc">${I.plus}New account</button></div></div>
    <div class="kpis">
      <div class="kpi"><span>Savings</span><b>${fmt0(totS)}</b>${unS ? `<span>+ ${unS} to confirm</span>` : ''}</div>
      <div class="kpi"><span>Debt owed</span><b class="neg">${fmt0(totD)}</b>${unD ? `<span>+ ${unD} to confirm</span>` : ''}</div>
      <div class="kpi"><span>Owed to you (business)</span><b>${fmt0(sum(by('lent').filter(r => r.known), r => r.bal))}</b></div>
      <div class="kpi"><span>Balances to confirm</span><b class="${checks.length ? 'neg' : 'pos'}">${checks.length}</b></div>
    </div>
    ${checks.length ? `<div class="notice"><b>Confirm ${checks.length} balance${checks.length > 1 ? 's' : ''}.</b> The spreadsheet didn’t hold enough to know these for sure. Open each one and use <b>Check balance</b> with the figure from your banking app.</div>` : ''}
    ${block('savings', 'Savings & investments', 'actual accounts')}
    ${block('goal', 'Goals', 'money set aside inside other accounts')}
    ${block('credit', 'Credit & store accounts', 'amount owing')}
    ${block('loan', 'Loans', 'amount owing')}
    ${block('lent', 'Money lent out')}
    ${block('bank', 'Everyday accounts', 'used for “paid from”')}
    <button class="btn ghost small" data-a="toggleclosed">${S.ui.showClosed ? 'Hide' : 'Show'} closed accounts</button>
  </div>`;
}
function viewAccount() {
  const id = S.ui.acc, r = balances()[id]; if (!r) { S.ui.view = 'accounts'; return viewAccounts(); }
  const a = r.a, liab = isLiab(a);
  const limit = S.ui.accLimit || 60;
  const ev = r.ev.slice(0, limit);
  return `<div class="stack">
    <button class="btn ghost sm" data-a="nav" data-v="accounts">${I.back}Accounts</button>
    <div class="pagehead"><div><h1>${esc(a.n)}</h1><p class="muted">${esc(ACC_TYPES[a.t] || '')}${a.bank ? ' · ' + esc(a.bank) : ''} · <span class="chip ${a.ow || 'J'}">${a.ow === 'J' ? 'Joint' : esc(pname(a.ow))}</span></p></div>
      <div class="row wrap">${a.t !== 'bank' || a.track !== false ? `<button class="btn primary" data-a="check" data-id="${id}">Check balance</button>` : ''}
        <button class="btn" data-a="transfer">Move money</button><button class="btn" data-a="ledger" data-id="${id}">Add entry</button><button class="btn" data-a="import" data-id="${id}">Import statement</button><button class="btn" data-a="editacc" data-id="${id}">Edit</button></div></div>
    <section class="panel"><div class="row between wrap">
      <div><div class="small muted">${liab ? 'Amount owing' : a.t === 'lent' ? 'Owed to you' : 'Balance'}</div>
        <div style="font-family:var(--font-d);font-size:2.2rem;font-weight:750" class="amt">${r.known ? fmt(r.bal) : 'Not set'}</div>
        ${!r.known ? `<div class="small muted">Movements since ${fmtDate(a.od)}: ${fmt(r.delta)} (${liab ? 'positive = owing went up' : 'positive = money in'})</div>` : ''}
        ${r.lastCheck ? `<div class="small muted">Last confirmed ${fmtDate(r.lastCheck.d)} at ${fmt(r.lastCheck.bal)}</div>` : ''}</div>
      ${a.goal ? `<div style="min-width:220px"><div class="row between small"><span>Goal ${fmt0(a.goal)}${a.gd ? ' by ' + fmtDate(a.gd) : ''}</span><b>${r.known ? pct(r.bal / a.goal) : '–'}</b></div>${hbar(r.known ? r.bal / a.goal : 0, 0)}</div>` : ''}
      ${liab && a.limit && r.known ? `<div style="min-width:220px"><div class="row between small"><span>Used of ${fmt0(a.limit)} limit</span><b>${pct(r.bal / a.limit)}</b></div>${hbar(r.bal / a.limit, 0, 'var(--bad)')}<div class="small muted" style="margin-top:4px">Available ${fmt(a.limit - r.bal)}</div></div>` : ''}
    </div>
    ${r.needsCheck ? `<div class="notice" style="margin-top:12px">${esc(a.chk)}</div>` : ''}
    ${a.note ? `<p class="small muted" style="margin:12px 0 0">${esc(a.note)}</p>` : ''}
    ${a.held ? `<p class="small muted" style="margin:6px 0 0">Held in: ${esc(a.held)}</p>` : ''}
    ${a.bf === false ? `<p class="small muted" style="margin:6px 0 0">This balance follows the bank statement, so budget lines linked to it are shown in the budget but don’t move it twice.</p>` : ''}
    </section>
    <section class="panel flush"><div class="sec-h">History<span class="tot small muted">${r.ev.length} entries</span></div>
      ${ev.length ? `<ul class="list">${ev.map(e => `<li class="li" ${e.lid ? `data-a="ledgerentry" data-k="${e.mo}" data-id="${e.lid}"` : e.tid ? `data-a="txn" data-k="${e.mo}" data-id="${e.tid}"` : ''}>
        <div class="grow"><div class="t">${esc(e.ty === 'check' ? 'Balance confirmed' : e.ds || '')}</div><div class="s">${fmtDate(e.d)} · ${esc({ budget: 'from budget', paid: 'paid from this account', statement: 'statement', ledger: 'ledger', plan: 'plan sheet' }[e.src] || e.src || '')}${e.ty === 'check' && e.adj ? ` · adjusted ${fmt(e.adj)}` : ''}</div></div>
        <div class="v">${e.ty === 'check' ? fmt(e.bal) : `<span class="${(liab ? -e.amt : e.amt) >= 0 ? 'pos' : ''}">${e.amt > 0 ? '+' : ''}${fmt(e.amt)}</span>`}${e.run !== null && e.run !== undefined ? `<small>${fmt(e.run)}</small>` : ''}</div></li>`).join('')}</ul>
        ${r.ev.length > limit ? `<div style="padding:12px"><button class="btn sm" data-a="morehist">Show more</button></div>` : ''}`
        : '<div class="empty" style="margin:0 14px 14px">No movements yet.</div>'}
    </section>
  </div>`;
}

/* ---------- PLAN ---------- */
function viewPlan(k) {
  const m = main(), sid = S.ui.planScen || m.scenario || '1', P = planCalc(k, sid), sc = m.scen?.[sid] || {};
  const C = m.calc || {};
  const stat = s => `<span class="chip ${/On target|Within/.test(s) ? 'good' : /No actual/.test(s) ? '' : 'bad'}">${s}</span>`;
  const p1 = planCalc(k, '1');
  // calculators
  const e = C.emergency || {}, lv = C.lavie || {}, bb = C.baby || {}, bg = C.big || {};
  const s1 = id => p1.rows.find(r => r.k === id)?.plan || 0;
  const essentials = s1('sultana') + s1('lavie') + s1('household') + s1('protection') + s1('health') + s1('debt') + s1('family');
  const emerContrib = s1('emergency') - (+lv.fromEmergency || 0);
  const B = balances();
  const lvCarry = (+lv.levies || 0) + (+lv.bond || 0) + (+lv.cover || 0);
  const lvTarget = lvCarry * (+lv.months || 0) + (+lv.relet || 0) * (+lv.rent || 0) * 1.15 + (+lv.touchup || 0);
  const lvMonthly = (+lv.fromEmergency || 0) + (+lv.extraBond || 0) + (+lv.escalation || 0) * (+lv.rent || 0);
  const lvBal = B.g_lavie?.bal || 0;
  const babyTarget = (+bb.birth || 0) + (+bb.essentials || 0) + (+bb.monthly || 0) * (+bb.preMonths || 0) - (+bb.gifts || 0);
  const babyGap = (+bb.leaveMonths || 0) * Math.max(0, (+bb.salary || 0) * (1 - (+bb.employerPct || 0)) - (+bb.uif || 0));
  const babyBal = Math.max(0, B.g_baby?.bal || 0);
  const carTarget = Math.max(0, (+bg.depositPct || 0) * (+bg.carPrice || 0) - (+bg.tradeIn || 0)) + (+bg.upfront || 0);
  const inst = pmt((+bg.rate || 0) / 12, 48, (+bg.carPrice || 0) * (1 - (+bg.depositPct || 0)));
  const bigBal = Math.max(0, B.g_bigpurchase?.bal || 0);
  const sprint = (sc.b?.goals?.[1]) || m.scen?.['2']?.b?.goals?.[1] || 0;
  const standFull = ((+bg.standUsd || 0) * (1 + (+bg.transferPct || 0)) + (+bg.servicesUsd || 0)) * (+bg.fx || 0) * (1 + (+bg.fxBuffer || 0));
  const standDep = (+bg.depositShare || 0) * (+bg.standUsd || 0) * (+bg.fx || 0) * (1 + (+bg.fxBuffer || 0));
  const months = (target, have, per) => per > 0 ? Math.max(0, (target - have) / per).toFixed(1) + ' months' : '–';
  const inp = (path, v, step = 'any') => `<input class="inp sm num" style="max-width:130px;text-align:right" type="number" step="${step}" inputmode="decimal" data-calc="${path}" value="${v ?? ''}">`;
  const crow = (label, input, out) => `<tr><td>${label}</td><td>${input || ''}</td><td>${out ?? ''}</td></tr>`;
  return `<div class="stack">
    <div class="pagehead"><div><h1>Plan</h1><p class="muted">How ${mName(k)} compares with your three scenarios. Scenario 1 is the everyday yardstick.</p></div>
      <div class="seg">${['1', '2', '3'].map(s => `<button data-a="planscen" data-s="${s}" aria-pressed="${s === sid}">${s} · ${esc(m.scen?.[s]?.name || '')}</button>`).join('')}</div></div>
    <section class="panel"><p style="margin:0 0 10px">${esc(sc.desc || '')}</p>
      <div class="row wrap small"><label class="lab" for="pbase">Monthly earned take-home income (plan base, excl. La Vie rent)</label>
      <input id="pbase" class="inp sm num" style="max-width:140px" type="number" data-calc="__base" value="${m.planBase || 0}">
      <span class="muted">Actual this month: ${fmt(P.actBase)}</span>
      ${sid !== (m.scenario || '1') ? `<button class="btn sm" data-a="setdefscen" data-s="${sid}">Make scenario ${sid} the default</button>` : '<span class="chip good">Default scenario</span>'}</div>
    </section>
    <section class="panel flush"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Category</th><th>Target %</th><th>Plan</th><th>Actual</th><th>Actual %</th><th>Over / (under)</th><th>Status</th></tr></thead>
      <tbody>${SUMCATS.map(c => {
        const rs = P.rows.filter(r => r.cat === c.k), cc = P.cats.find(x => x.k === c.k);
        return `<tr class="g"><td>${esc(c.n)}</td><td>${pct(cc.planPct, 1)}</td><td>${fmt0(cc.plan)}</td><td>${fmt0(cc.act)}</td><td>${pct(cc.actPct, 1)}</td><td class="${(cc.save ? cc.act >= cc.plan : cc.act <= cc.plan) ? 'pos' : 'neg'}">${fmt0(cc.act - cc.plan)}</td><td></td></tr>` +
          rs.map(r => `<tr><td style="padding-left:22px">${esc(r.n)}</td><td><input class="inp sm num" style="width:74px;text-align:right" type="number" step="0.5" data-scen="${sid}.${r.k}" value="${+((m.scen?.[sid]?.b?.[r.k]?.[0] || 0) * 100).toFixed(2)}"></td>
            <td>${fmt0(r.plan)}${(m.scen?.[sid]?.b?.[r.k]?.[1]) ? `<div class="tiny muted">incl. ${fmt0(m.scen[sid].b[r.k][1])} fixed</div>` : ''}</td><td>${fmt0(r.act)}</td><td>${pct(r.actPct, 1)}</td><td class="${(r.save ? r.act >= r.plan : r.act <= r.plan) ? 'pos' : 'neg'}">${fmt0(r.diff)}</td><td>${stat(r.status)}</td></tr>`).join('');
      }).join('')}
      <tr class="t"><td>Total</td><td>${pct(P.base ? P.planTotal / P.base : 0, 1)}</td><td>${fmt0(P.planTotal)}</td><td>${fmt0(P.actTotal)}</td><td>${pct(P.actBase ? P.actTotal / P.actBase : 0, 1)}</td><td>${fmt0(P.actTotal - P.planTotal)}</td><td>${Math.abs(P.base - P.planTotal) < 100 ? stat('Within plan').replace('Within plan', 'Plan balances') : `<span class="chip warn">${fmt0(P.base - P.planTotal)} ${P.base > P.planTotal ? 'unplanned' : 'over income'}</span>`}</td></tr>
      <tr><td>Funded by drawdowns & loans</td><td>0%</td><td>R0</td><td>${fmt0(P.drawn)}</td><td>${pct(P.actBase ? P.drawn / P.actBase : 0, 1)}</td><td class="${P.drawn ? 'neg' : 'pos'}">${fmt0(P.drawn)}</td><td>${P.drawn ? `<span class="chip bad">Drew ${fmt0(P.drawn)}</span>` : '<span class="chip good">None</span>'}</td></tr>
      <tr class="t"><td>Net savings rate (savings less drawdowns)</td><td>${pct(P.base ? P.savePlan / P.base : 0, 1)}</td><td>${fmt0(P.savePlan)}</td><td>${fmt0(P.net)}</td><td>${pct(P.netRate, 1)}</td><td class="${P.net >= P.savePlan ? 'pos' : 'neg'}">${fmt0(P.net - P.savePlan)}</td><td>${stat(P.net >= P.savePlan ? 'On target' : 'Below target')}</td></tr>
      </tbody></table></div>
      <p class="small muted" style="padding:0 14px">Edit a target % to change this scenario. Fixed rand amounts (sprint project, maxed TFSAs) can be changed in the calculators below.</p>
    </section>
    <div class="grid2">
      <section class="panel"><h2>Emergency fund</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Essential monthly costs (Scenario 1 plan)', '', fmt0(essentials))}
        ${crow('First milestone (months)', inp('emergency.m1', e.m1), fmt0(essentials * (+e.m1 || 0)))}
        ${crow('Full target (months)', inp('emergency.m2', e.m2), fmt0(essentials * (+e.m2 || 0)))}
        ${crow('Saved so far', '', fmt0(B.g_emergency?.bal || 0))}
        ${crow('Time to first milestone', '', months(essentials * (+e.m1 || 0), B.g_emergency?.bal || 0, emerContrib))}
        ${crow('Repayment freed when Money Savers ends', inp('emergency.stepUp', e.stepUp), months(essentials * (+e.m1 || 0), B.g_emergency?.bal || 0, emerContrib + (+e.stepUp || 0)))}
      </tbody></table></section>
      <section class="panel"><h2>La Vie vacancy reserve</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Rent (per month)', inp('lavie.rent', lv.rent), '')}
        ${crow('Levies + bond + cover if vacant', `${inp('lavie.levies', lv.levies)}`, fmt0(lvCarry))}
        ${crow('Bond instalment', inp('lavie.bond', lv.bond), '')}
        ${crow('Months of vacancy to cover', inp('lavie.months', lv.months), '')}
        ${crow('Turnover touch-ups', inp('lavie.touchup', lv.touchup), '')}
        ${crow('<b>Reserve target</b>', '', `<b>${fmt0(lvTarget)}</b>`)}
        ${crow('Current reserve (from the goal account)', '', `<span class="${lvBal < 0 ? 'neg' : ''}">${fmt0(lvBal)}</span>`)}
        ${crow('Monthly contribution (from emergency + extra bond + escalation)', inp('lavie.fromEmergency', lv.fromEmergency), fmt0(lvMonthly))}
        ${crow('Time to target (after the seed lump sum)', inp('lavie.seed', lv.seed), months(lvTarget - (+lv.seed || 0), lvBal, lvMonthly))}
      </tbody></table></section>
      <section class="panel"><h2>Baby Fund</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Months until the baby arrives', inp('baby.monthsLeft', bb.monthsLeft), '')}
        ${crow('Birth – hospital & specialists', inp('baby.birth', bb.birth), '')}
        ${crow('Essentials & nursery', inp('baby.essentials', bb.essentials), '')}
        ${crow('Monthly baby costs × months pre-funded', inp('baby.monthly', bb.monthly), fmt0((+bb.monthly || 0) * (+bb.preMonths || 0)))}
        ${crow('<b>Baby Fund target</b>', '', `<b>${fmt0(babyTarget)}</b>`)}
        ${crow('Parental-leave income gap', inp('baby.leaveMonths', bb.leaveMonths), fmt0(babyGap))}
        ${crow('Current Baby Fund', '', fmt0(babyBal))}
        ${crow('Needed per month to be ready', '', fmt0((+bb.monthsLeft || 0) ? Math.max(0, babyTarget - babyBal) / bb.monthsLeft : 0))}
        ${crow('Shortfall at birth at planned contribution', inp('baby.planned', bb.planned), `<span class="neg">${fmt0(Math.max(0, babyTarget - babyBal - (+bb.planned || 0) * (+bb.monthsLeft || 0)))}</span>`)}
      </tbody></table></section>
      <section class="panel"><h2>Big purchase</h2><table class="tbl" style="margin-top:8px"><tbody>
        ${crow('Everyday contribution (Scenario 1)', inp('big.everyday', bg.everyday), '')}
        ${crow('Car price', inp('big.carPrice', bg.carPrice), '')}
        ${crow('Deposit share (0.2 = 20%)', inp('big.depositPct', bg.depositPct, '0.01'), '')}
        ${crow('<b>Car savings target</b>', '', `<b>${fmt0(carTarget)}</b>`)}
        ${crow('Instalment over 48 months', inp('big.rate', bg.rate, '0.005'), `${fmt0(inst)} (${pct(m.planBase ? inst / m.planBase : 0, 1)} of income)`)}
        ${crow('Months to car target – everyday / sprint', '', months(carTarget, bigBal, +bg.everyday || 0) + ' / ' + months(carTarget, bigBal, sprint))}
        ${crow('Zimbabwe stand price (USD)', inp('big.standUsd', bg.standUsd), '')}
        ${crow('Exchange rate (R per US$)', inp('big.fx', bg.fx, '0.01'), '')}
        ${crow('Stand deposit / full cash target', '', fmt0(standDep) + ' / ' + fmt0(standFull))}
        ${crow('Months to full stand – sprint', '', months(standFull, bigBal, sprint))}
      </tbody></table></section>
    </div>
    <p class="small muted">A planning framework, not financial advice. Sources and reasoning for each target are in your 2026 spreadsheet’s Plan sheet.</p>
  </div>`;
}

/* ---------- YEAR ---------- */
function barChart(series, labels, opts = {}) {
  const W = 720, H = opts.h || 220, pad = 34, n = labels.length;
  const vals = series.flatMap(s => s.v);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const y = v => H - pad - (v - min) / (max - min) * (H - pad - 14);
  const bw = (W - pad) / n, gw = bw * 0.72 / series.length;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'chart')}">`;
  [0, .25, .5, .75, 1].forEach(f => { const v = min + (max - min) * f; out += `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pad - 4}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--faint)">${Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</text>`; });
  labels.forEach((l, i) => {
    series.forEach((s, j) => {
      if (s.line) return;
      const v = s.v[i] || 0, x = pad + i * bw + bw * 0.14 + j * gw;
      out += `<rect x="${x}" y="${Math.min(y(v), y(0))}" width="${Math.max(1, gw - 2)}" height="${Math.abs(y(v) - y(0))}" rx="2" fill="${s.c}"><title>${esc(s.n)} ${esc(l)}: ${fmt0(v)}</title></rect>`;
    });
    out += `<text x="${pad + i * bw + bw / 2}" y="${H - 12}" font-size="10.5" text-anchor="middle" fill="var(--muted)">${esc(l)}</text>`;
  });
  series.filter(s => s.line).forEach(s => {
    const pts = s.v.map((v, i) => `${pad + i * bw + bw / 2},${y(v || 0)}`).join(' ');
    out += `<polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="2.5"/>` + s.v.map((v, i) => `<circle cx="${pad + i * bw + bw / 2}" cy="${y(v || 0)}" r="3.5" fill="${s.c}"><title>${esc(s.n)} ${esc(labels[i])}: ${fmt0(v)}</title></circle>`).join('');
  });
  return out + '</svg>';
}
function viewYear() {
  const years = [...new Set(monthKeys().map(k => k.slice(0, 4)))];
  const y = S.ui.year || years[years.length - 1] || String(new Date().getFullYear());
  const Y = yearCalc(y), mode = S.ui.yearMode || 'act', mk = mode === 'act' ? 'a' : 'b';
  const has = Y.keys.map(k => !!S.months[k]);
  const lab = Y.keys.map(k => mShort(k));
  const col = (vals, cls = '') => vals.map((v, i) => `<td class="${cls}">${has[i] ? (Math.abs(v) > 0.004 ? fmt0(v) : '–') : ''}</td>`).join('') + `<td class="${cls}"><b>${fmt0(sum(vals))}</b></td>`;
  const T = Y.tot;
  let rows = '';
  SECTIONS.forEach(s => {
    rows += `<tr class="g"><td>${s.n}</td>${col(Y.keys.map((_, i) => s.k === 'in' ? T[i][mk].income : T[i][mk][s.k]))}</tr>`;
    GROUPS.filter(g => g.sec === s.k).forEach(g => {
      const its = Y.items.filter(x => x.g === g.k && sum(x[mk]) !== 0);
      if (!its.length) return;
      rows += `<tr><td style="padding-left:14px;font-weight:650">${esc(g.n)}</td>${col(Y.keys.map((_, i) => sum(its, x => x[mk][i])))}</tr>`;
      rows += its.map(x => `<tr class="click" data-a="trend" data-id="${x.id}"><td style="padding-left:26px">${esc(x.it.n)}</td>${col(x[mk], 'muted')}</tr>`).join('');
    });
    if (s.k === 'in' && mode === 'act') rows += `<tr><td style="padding-left:14px">Paid from savings & credit (auto)</td>${col(T.map(t => t.a.auto || 0))}</tr>`;
  });
  rows += `<tr class="t"><td>Left over</td>${col(T.map(t => t[mk].surplus))}</tr>`;
  const lavie = Y.keys.map((_, i) => {
    const g = n => sum(Y.items.filter(x => x.it.n === n), x => x.a[i]);
    return g('La Vie Rentals') - g('La Vie Estate Levies') - g('La Vie Estate Bond') - g('FNB Home Loan Cover') - g('La Vie Municipality Tax');
  });
  const B = balances();
  return `<div class="stack">
    <div class="pagehead"><div><h1>${y} overview</h1><p class="muted">Every line item across the year. Tap a line to see its trend.</p></div>
      <div class="row wrap">${years.length > 1 ? `<select class="inp sm" data-a="yearsel" style="width:auto">${years.map(x => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('')}</select>` : ''}
      <div class="seg"><button data-a="ymode" data-v="act" aria-pressed="${mode === 'act'}">Actual</button><button data-a="ymode" data-v="bud" aria-pressed="${mode !== 'act'}">Budget</button></div></div></div>
    <section class="panel chart"><div class="panel-h"><h2>Money in, saved and spent</h2>
      <div class="legend"><span><i style="background:var(--brand)"></i>Money in</span><span><i style="background:var(--good)"></i>Saved</span><span><i style="background:var(--bad)"></i>Spent</span><span><i style="background:var(--mm)"></i>Left over</span></div></div>
      ${barChart([{ n: 'Money in', c: 'var(--brand)', v: T.map(t => t[mk].income) }, { n: 'Saved', c: 'var(--good)', v: T.map(t => t[mk].sav) }, { n: 'Spent', c: 'var(--bad)', v: T.map(t => t[mk].exp) }, { n: 'Left over', c: 'var(--mm)', line: true, v: T.map(t => t[mk].surplus) }], lab, { label: 'Monthly totals' })}
    </section>
    <section class="panel flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${mode === 'act' ? 'Actual' : 'Budget'}</th>${lab.map(l => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div class="grid3">
      <section class="panel"><h3>La Vie Estate – net position</h3><p class="small muted">Rent less levies, bond, cover and municipal tax.</p>
        <div style="font-family:var(--font-d);font-size:1.5rem;font-weight:750" class="${sum(lavie) < 0 ? 'neg' : 'pos'}">${fmt0(sum(lavie))}</div><div class="small muted">for ${y} so far</div></section>
      <section class="panel"><h3>Owner’s loan to the business</h3><p class="small muted">Advanced less repaid.</p>
        <div style="font-family:var(--font-d);font-size:1.5rem;font-weight:750">${fmt0(B.biz_loan?.bal || 0)}</div><div class="small muted">owed to you</div></section>
      <section class="panel"><h3>La Vie vacancy reserve</h3><p class="small muted">Put in less drawn.</p>
        <div style="font-family:var(--font-d);font-size:1.5rem;font-weight:750" class="${(B.g_lavie?.bal || 0) < 0 ? 'neg' : ''}">${fmt0(B.g_lavie?.bal || 0)}</div><div class="small muted">${(B.g_lavie?.bal || 0) < 0 ? 'drawn before anything was put in' : 'in the reserve'}</div></section>
    </div>
  </div>`;
}

/* ---------- MILESTONES ---------- */
function viewMilestones() {
  const list = Object.keys(S.ms).map(id => ({ id, c: msCalc(id) })).filter(x => x.c)
    .sort((a, b) => (a.c.m.st === 'done') - (b.c.m.st === 'done') || (a.c.m.o || 0) - (b.c.m.o || 0));
  return `<div class="stack">
    <div class="pagehead"><div><h1>Milestones</h1><p class="muted">Budgets for trips, celebrations and big moments, kept apart from the monthly budget.</p></div>
      <button class="btn primary" data-a="newms">${I.plus}New milestone</button></div>
    ${list.length ? `<div class="grid2">${list.map(({ id, c }) => {
      const p = c.exp.b ? c.exp.a / c.exp.b : 0;
      return `<section class="panel" data-a="openms" data-id="${id}" style="cursor:pointer">
        <div class="row between"><h2>${esc(c.m.n)}</h2><span class="chip ${c.m.st === 'done' ? '' : 'good'}">${c.m.st === 'done' ? 'Done' : 'Active'}</span></div>
        <p class="small muted" style="margin:4px 0 10px">${fmtDate(c.m.start)}${c.m.end ? ' – ' + fmtDate(c.m.end) : ''}${c.m.usd ? ' · ZAR & USD' : ''}</p>
        <div class="row between small"><span>Spent ${fmt0(c.exp.a)} of ${fmt0(c.exp.b)} planned</span><b>${pct(p)}</b></div>${hbar(p, 0, p > 1 ? 'var(--bad)' : 'var(--brand)')}
        ${c.inc.b || c.inc.a ? `<div class="small muted" style="margin-top:8px">Funding ${fmt0(c.inc.a)} received of ${fmt0(c.inc.b)}</div>` : ''}
      </section>`;
    }).join('')}</div>` : '<div class="empty">No milestones yet. Create one for your next trip or celebration.</div>'}
  </div>`;
}
function viewMilestone() {
  const id = S.ui.msId, c = msCalc(id); if (!c) return '<div class="loading"><div class="spin"></div></div>';
  const m = c.m;
  const grps = [...new Set(c.lines.map(l => l.sec + '|' + (l.grp || '')))];
  const amtCell = (z, l) => `${fmt(z)}${l && l.cur === 'USD' ? `<div class="tiny muted">$${(+l.b || 0).toLocaleString()}</div>` : ''}`;
  return `<div class="stack">
    <button class="btn ghost sm" data-a="nav" data-v="milestones">${I.back}Milestones</button>
    <div class="pagehead"><div><h1>${esc(m.n)}</h1><p class="muted">${fmtDate(m.start)}${m.end ? ' – ' + fmtDate(m.end) : ''}${m.usd ? ` · R${m.usd} per US$` : ''}</p></div>
      <div class="row wrap"><button class="btn primary" data-a="mstxn" data-id="${id}">${I.plus}Add payment</button><button class="btn" data-a="msline" data-id="${id}">Add line</button><button class="btn" data-a="msedit" data-id="${id}">Edit</button></div></div>
    ${m.note ? `<div class="notice">${esc(m.note)}</div>` : ''}
    <div class="kpis">
      <div class="kpi"><span>Planned cost</span><b>${fmt0(c.exp.b)}</b></div><div class="kpi"><span>Spent so far</span><b>${fmt0(c.exp.a)}</b></div>
      <div class="kpi"><span>Funding received</span><b>${fmt0(c.inc.a)}</b><span>of ${fmt0(c.inc.b)}</span></div>
      <div class="kpi"><span>${c.inc.a ? 'Funding less spent' : 'Still to spend'}</span><b class="${(c.inc.a ? c.inc.a - c.exp.a : c.exp.b - c.exp.a) < 0 ? 'neg' : 'pos'}">${fmt0(c.inc.a ? c.inc.a - c.exp.a : c.exp.b - c.exp.a)}</b></div>
    </div>
    <section class="panel flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Line</th><th>Planned</th><th>Actual</th><th>Variance</th></tr></thead><tbody>
      ${grps.map(gk => { const [sec, grp] = gk.split('|'); const ls = c.lines.filter(l => l.sec === sec && (l.grp || '') === grp);
        return `<tr class="g"><td>${sec === 'income' ? 'Funding' : 'Costs'}${grp ? ' · ' + esc(grp) : ''}</td><td>${fmt(sum(ls, l => l.bz))}</td><td>${fmt(sum(ls, l => l.az))}</td><td></td></tr>` +
          ls.map(l => `<tr class="click" data-a="msline" data-id="${id}" data-l="${l.id}"><td style="padding-left:20px">${esc(l.n)}</td><td>${amtCell(l.bz, l)}</td><td>${l.az ? fmt(l.az) : '–'}</td><td class="${(sec === 'income' ? l.az - l.bz : l.bz - l.az) < 0 ? 'neg' : 'muted'}">${l.bz || l.az ? fmt(sec === 'income' ? l.az - l.bz : l.bz - l.az) : ''}</td></tr>`).join(''); }).join('')}
    </tbody></table></div></section>
    <section class="panel flush"><div class="sec-h">Payments<span class="tot small muted">${c.tx.length}</span></div>
      ${c.tx.length ? `<ul class="list">${c.tx.sort((a, b) => (b.d || '').localeCompare(a.d || '')).map(t => { const l = m.lines?.[t.l];
        return `<li class="li" data-a="mstxn" data-id="${id}" data-t="${t.id}"><div class="grow"><div class="t">${esc(l?.n || '?')}</div><div class="s">${fmtDate(t.d)}${t.note ? ' · ' + esc(t.note) : ''}${t.rc ? ' · receipt' : ''}</div></div><div class="v">${fmt(t.zar)}${t.cur === 'USD' ? `<small>$${(+t.amt).toLocaleString()}</small>` : ''}</div></li>`; }).join('')}</ul>` : '<div class="empty" style="margin:0 14px 14px">No payments yet.</div>'}
    </section>
    <section class="panel"><div class="panel-h"><h2>Documents</h2>${S.assets ? `<label class="btn sm">Attach file<input type="file" accept="image/*,application/pdf" data-a="msfile" data-id="${id}" hidden></label>` : ''}</div>
      ${(m.files || []).length ? `<ul class="list" style="margin:0 -16px -16px">${m.files.map(f => `<li class="li"><a class="grow t" href="/_blob/${esc(f.id)}" target="_blank" rel="noopener">${esc(f.n)}</a><span class="s">${fmtDate(f.d)}</span></li>`).join('')}</ul>` : `<p class="muted small">${S.assets ? 'Attach invoices, quotes and proof of payment here.' : 'Attachments are available when the tracker is opened from claude.ai.'}</p>`}
    </section>
  </div>`;
}

/* ---------- MORE ---------- */
function viewMore() {
  const tile = (a, ic, t, s, extra = '') => `<button class="li" data-a="${a}" ${extra}><div class="avatar">${ic}</div><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div></button>`;
  return `<div class="stack">
    <div class="pagehead"><div><h1>More</h1></div></div>
    <section class="panel flush"><div class="list">
      ${tile('nav', I.people, 'Piepie & Munny', 'Who covers what, and each person’s surplus', 'data-v="people"')}
      ${tile('nav', I.plan, 'Plan & scenarios', 'Targets, emergency fund, La Vie reserve, Baby Fund, big purchase', 'data-v="plan"')}
      ${tile('nav', I.year, 'Year overview', 'Every line item month by month, with charts', 'data-v="year"')}
      ${tile('nav', I.flag, 'Milestones', 'Trips, celebrations and big moments', 'data-v="milestones"')}
    </div></section>
    <section class="panel flush"><div class="list">
      ${tile('import', I.acc, 'Import a bank statement', 'Discovery CSV or Excel export – review before anything is saved')}
      ${tile('export', I.up, 'Export to Excel', 'A workbook laid out like your 2026 tracker')}
      ${tile('backup', I.up, 'Download a full backup', 'Everything as one JSON file')}
    </div></section>
    <section class="panel flush"><div class="list">
      ${tile('nav', I.budget, 'Line items & categories', 'Rename, move, link to accounts, set as monthly', 'data-v="items"')}
      ${tile('settings', I.cog, 'Settings', 'Names, this device, appearance')}
    </div></section>
    <p class="small muted">Pa-Nashe Tracker · Prototype 1. Data is shared live between everyone this tracker is shared with as an editor.</p>
  </div>`;
}
function viewItems() {
  const q = (S.ui.itemq || '').toLowerCase();
  const all = Object.entries(cat()).filter(([, it]) => it && (!q || it.n.toLowerCase().includes(q)));
  return `<div class="stack">
    <button class="btn ghost sm" data-a="nav" data-v="more">${I.back}More</button>
    <div class="pagehead"><div><h1>Line items</h1><p class="muted">The fixed list you choose from when capturing. Archived items stay in history but leave the pickers.</p></div>
      <button class="btn primary" data-a="edititem" data-id="">${I.plus}New line item</button></div>
    <input class="inp" placeholder="Search line items" data-a="itemsearch" value="${esc(S.ui.itemq || '')}">
    ${GROUPS.map(g => { const its = all.filter(([, it]) => it.g === g.k).sort((a, b) => (a[1].o || 0) - (b[1].o || 0)); if (!its.length) return '';
      return `<section class="panel flush"><div class="sec-h small">${esc(g.n)}</div><ul class="list">${its.map(([id, it]) => `<li class="li" data-a="edititem" data-id="${id}"><div class="grow"><div class="t">${esc(it.n)}${it.arch ? ' <span class="chip">archived</span>' : ''}</div><div class="s">${it.rec ? 'Monthly · ' : ''}${(it.fl || []).map(f => (f.x > 0 ? '→ ' : '← ') + esc(accs()[f.a]?.n || f.a)).join(', ')}</div></div></li>`).join('')}</ul></section>`; }).join('')}
  </div>`;
}
