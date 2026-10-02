/* ===================== BUDGET (from prototype ui1.js) ===================== */
import { monthCalc } from '../../calc/month';
import { GROUPS, MONTHS, SECTIONS } from '../../core/constants';
import { esc, fmt, fmt0, mName, nextKey, sum } from '../../core/format';
import { accs, monthKeys, S } from '../../core/state';
import { I } from '../icons';
import { lineRow } from '../parts';
import { num } from '../sheet';

export function viewBudget(k) {
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
    ${[['Money in', T.b.income, T.a.income], ['Saved', T.b.sav, T.a.sav], ['Spent', T.b.exp, T.a.exp], ['Left over', T.b.surplus, T.a.surplus]].map(([n, b, a]: any, i) =>
      `<div class="kpi"><span>${n}</span><b class="${i === 3 ? (a < 0 ? 'neg' : 'pos') : ''}">${fmt(a)}</b><span>Planned ${fmt(b)}</span></div>`).join('')}
  </div>
  <div class="row wrap" style="margin-bottom:12px"><div class="seg">
    ${[['all', 'All lines'], ['due', 'Still to pay'], ['over', 'Over budget']].map(([v, n]) => `<button data-a="bfilter" data-v="${v}" aria-pressed="${f === v}">${n}</button>`).join('')}
  </div></div>
  ${SECTIONS.map(sec).join('')}
  <section class="panel row between"><h2>Left over</h2><div class="right"><div class="amt ${T.a.surplus < 0 ? 'neg' : 'pos'}" style="font-family:var(--font-d);font-size:1.4rem;font-weight:750">${fmt(T.a.surplus)}</div><div class="small muted">Planned ${fmt(T.b.surplus)}</div></div></section>
  </div>`;
}
