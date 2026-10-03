/* ===================== HOME (from prototype ui1.js) ===================== */
import { balances } from '../../calc/balances';
import { potTotals } from '../../calc/pots';
import { monthCalc } from '../../calc/month';
import { peopleCalc } from '../../calc/people';
import { planCalc } from '../../calc/plan';
import { GMAP, MONTHS, isHistory } from '../../core/constants';
import { esc, fmt, fmt0, mName, pct, sum } from '../../core/format';
import { main, pname, S } from '../../core/state';
import { allocChips, hbar, planBarColor, planOnTrack, txnLi } from '../parts';

export function viewHome(k) {
  const mc = monthCalc(k), T = mc.T, pa = peopleCalc(k, 'a');
  const sid = main().scenario || '1', pl = planCalc(k, sid);
  const outs = pa.P.out + pa.M.out + pa.U.out || 1;
  const due = isHistory(k) ? [] : mc.lines.filter(l => l.k !== 'in' && (l.rec) && !l.act && l.b);
  const over = mc.lines.filter(l => l.k === 'exp' && l.b && l.act > l.b + 1).sort((a, b) => (b.act - b.b) - (a.act - a.b)).slice(0, 4);
  const bal = balances(), checks = Object.values(bal).filter(r => r.needsCheck);
  const recent = mc.txns.filter(t => t.src !== 'import').sort((a, b) => (b.at || 0) - (a.at || 0) || (b.d || '').localeCompare(a.d || '')).slice(0, 6);
  const hi = S.me ? 'Hi ' + esc(pname(S.me)) : 'Hello';
  const lyK = (+k.slice(0, 4) - 1) + k.slice(4), ly = S.months[lyK] ? monthCalc(lyK).T.a : null, lyName = mName(lyK).replace(/^(\w{3})\w*/, '$1');   // same month last year
  return `<div class="stack">
  <div class="pagehead"><div><h1>${hi}</h1><p class="muted">${mName(k)} at a glance</p></div></div>
  <section class="hero">
    <div class="lbl">Left after savings and spending</div>
    <div class="big amt">${fmt(T.a.surplus)}</div>
    <div class="small" style="opacity:.85">Planned: ${fmt(T.b.surplus)}</div>
    <div class="flow">
      <div><span>Money in</span><b class="amt">${fmt0(T.a.income)}</b>${ly ? `<small class="ly">${esc(lyName)}: ${fmt0(ly.income)}</small>` : ''}</div>
      <div><span>Saved</span><b class="amt">${fmt0(T.a.sav)}</b>${ly ? `<small class="ly">${esc(lyName)}: ${fmt0(ly.sav)}</small>` : ''}</div>
      <div><span>Spent</span><b class="amt">${fmt0(T.a.exp)}</b>${ly ? `<small class="ly">${esc(lyName)}: ${fmt0(ly.exp)}</small>` : ''}</div>
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
        : isHistory(k) ? `<p class="muted">${mName(k)} comes from your old spreadsheet, so nothing is shown as still to pay.</p>` : `<p class="muted">Every monthly payment in ${MONTHS[+k.slice(5) - 1]} has an amount against it.</p>`}
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Against your plan</h2>
        <div class="seg">${['1', '2', '3'].map(s => `<button data-a="scen" data-s="${s}" aria-pressed="${s === sid}">${s}</button>`).join('')}</div></div>
      <p class="small muted" style="margin:-4px 0 10px">Scenario ${sid}: ${esc(main().scen?.[sid]?.name || '')}. The tick shows the target share of earned income.</p>
      ${pl.cats.map(c => `<div style="margin-bottom:10px"><div class="row between small"><span>${esc(c.n)}</span>
        <span class="amt"><b class="${planOnTrack(c) ? 'pos' : 'neg'}">${pct(c.actPct)}</b> <span class="muted">of ${pct(c.planPct)}</span></span></div>
        ${hbar(c.actPct, c.planPct, planBarColor(c))}</div>`).join('')}
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
  <section class="panel">
    <div class="panel-h"><h2>Savings pots</h2><button class="btn sm ghost" data-a="nav" data-v="accounts">See accounts</button></div>
    <div class="kpis three pots-home">${potTotals(bal).map(p => `<button class="kpi" data-a="openpot" data-p="${p.k}"><span>${esc(p.n)} · ${esc(p.d)}</span><b>${fmt0(p.total)}</b>${p.goals ? `<span>${fmt0(p.goals)} set aside for goals</span>` : ''}</button>`).join('')}</div>
  </section>
  <section class="grid2">${['P', 'M'].map(w => personMini(w, k)).join('')}</section>
  </div>`;
}
export function personMini(w, k) {
  const pb = peopleCalc(k, 'b')[w], pa = peopleCalc(k, 'a')[w];
  return `<section class="person ${w}" data-a="nav" data-v="people" style="cursor:pointer">
    <div class="row between"><h3>${esc(pname(w))}</h3><span class="small muted">planned for ${MONTHS[+k.slice(5) - 1]}</span></div>
    <div class="big ${pb.left < 0 ? 'neg' : ''}">${fmt(pb.left)}</div>
    <div class="small muted">${fmt0(pb.inc)} allocated income · ${fmt0(pb.out)} committed</div>
    <div class="small" style="margin-top:6px">So far: ${fmt0(pa.out)} paid out of ${fmt0(pa.inc)} received</div>
  </section>`;
}
