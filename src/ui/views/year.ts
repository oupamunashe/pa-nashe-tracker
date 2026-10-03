/* ===================== YEAR (from prototype ui2.js) ===================== */
import { balances } from '../../calc/balances';
import { yearCalc } from '../../calc/year';
import { GROUPS, MONTHS, SECTIONS } from '../../core/constants';
import { esc, fmt0, mShort, pct, sum } from '../../core/format';
import { monthKeys, S } from '../../core/state';
import { barChart } from '../chart';

export function viewYear() {
  const years = [...new Set(monthKeys().map(k => k.slice(0, 4)))];
  const y = S.ui.year || years[years.length - 1] || String(new Date().getFullYear());
  const cy = years.includes(S.ui.cmpYear) && S.ui.cmpYear !== y ? S.ui.cmpYear : '';
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
      <div class="row wrap">${years.length > 1 ? `<select class="inp sm" data-a="yearsel" style="width:auto" aria-label="Year">${years.map(x => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <select class="inp sm" data-a="cmpyear" style="width:auto" aria-label="Compare with"><option value="">Compare with…</option>${years.filter(x => x !== y).reverse().map(x => `<option value="${x}" ${x === cy ? 'selected' : ''}>Compare with ${x}</option>`).join('')}</select>` : ''}
      <div class="seg"><button data-a="ymode" data-v="act" aria-pressed="${mode === 'act'}">Actual</button><button data-a="ymode" data-v="bud" aria-pressed="${mode !== 'act'}">Budget</button></div></div></div>
    <section class="panel chart"><div class="panel-h"><h2>Money in, saved and spent</h2>
      <div class="legend"><span><i style="background:var(--brand)"></i>Money in</span><span><i style="background:var(--good)"></i>Saved</span><span><i style="background:var(--bad)"></i>Spent</span><span><i style="background:var(--mm)"></i>Left over</span></div></div>
      ${barChart([{ n: 'Money in', c: 'var(--brand)', v: T.map(t => t[mk].income) }, { n: 'Saved', c: 'var(--good)', v: T.map(t => t[mk].sav) }, { n: 'Spent', c: 'var(--bad)', v: T.map(t => t[mk].exp) }, { n: 'Left over', c: 'var(--mm)', line: true, v: T.map(t => t[mk].surplus) }], lab, { label: 'Monthly totals' })}
    </section>
    ${cy ? compareYears(y, cy, mk, mode) : ''}
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

/* Two years side by side, like for like: only the months both years have, so a part year (2023, or the year
   in progress) is compared with the same months of the other year. Same rows as the table below. */
function compareYears(y: string, cy: string, mk: 'a' | 'b', mode: string) {
  const A = yearCalc(y), C = yearCalc(cy);
  // actuals: a month counts once it has actual entries in both years (a month budgeted ahead has none yet)
  const live = (Y, i) => !!S.months[Y.keys[i]] && (mk === 'b' || ['income', 'sav', 'exp'].some(f => Math.abs(Y.tot[i].a[f]) > 0.004));
  const idx = A.keys.map((_, i) => i).filter(i => live(A, i) && live(C, i));
  if (!idx.length) return `<section class="panel"><h2>${y} compared with ${cy}</h2><p class="muted">These two years have no months in common, so there is nothing to compare like for like.</p></section>`;
  const run = idx.every((v, j) => !j || v === idx[j - 1] + 1);
  const span = idx.length === 12 ? 'the whole year' : idx.length === 1 ? MONTHS[idx[0]].slice(0, 3) : run ? `${MONTHS[idx[0]].slice(0, 3)}–${MONTHS[idx[idx.length - 1]].slice(0, 3)}` : idx.map(i => MONTHS[i].slice(0, 3)).join(', ');
  const tot = (Y, f) => sum(idx, i => f(Y.tot[i][mk]));
  const itemSum = (Y, id) => { const x = Y.items.find(z => z.id === id); return x ? sum(idx, i => x[mk][i]) : 0; };
  // up is good for money in, saved and left over; up is bad for spent
  const chg = (a: number, c: number, upGood: boolean) => {
    const d = a - c, cls = Math.abs(d) < 0.5 ? '' : (d > 0) === upGood ? 'pos' : 'neg';
    return `<td class="${cls}">${Math.abs(d) < 0.5 ? '–' : (d > 0 ? '+' : '') + fmt0(d)}</td><td class="${cls}">${Math.abs(c) > 0.5 && Math.abs(d) >= 0.5 ? (d > 0 ? '+' : '') + pct(d / Math.abs(c)).replace('-', '–') : ''}</td>`;
  };
  const row = (label: string, a: number, c: number, upGood: boolean, attrs = '', cls = '', pad = 0) =>
    `<tr class="${cls}" ${attrs}><td style="padding-left:${pad}px">${label}</td><td>${fmt0(a)}</td><td class="muted">${fmt0(c)}</td>${chg(a, c, upGood)}</tr>`;
  let rows = '';
  SECTIONS.forEach(sec => {
    const f = t => sec.k === 'in' ? t.income : t[sec.k], up = sec.k !== 'exp';
    rows += row(sec.n, tot(A, f), tot(C, f), up, '', 'g');
    GROUPS.filter(g => g.sec === sec.k).forEach(g => {
      const up = sec.k !== 'exp' && g.k !== 'funding';   // more drawdowns and loans is not an improvement
      const ids = [...new Set([...A.items, ...C.items].filter(x => x.g === g.k).map(x => x.id))]
        .filter(id => Math.abs(itemSum(A, id)) > 0.004 || Math.abs(itemSum(C, id)) > 0.004);
      if (!ids.length) return;
      rows += row(`<b>${esc(g.n)}</b>`, sum(ids, id => itemSum(A, id)), sum(ids, id => itemSum(C, id)), up, '', '', 14);
      rows += ids.map(id => { const it = (A.items.find(x => x.id === id) || C.items.find(x => x.id === id))!.it;
        return row(esc(it.n), itemSum(A, id), itemSum(C, id), up, `data-a="trend" data-id="${id}"`, 'click', 26); }).join('');
    });
  });
  rows += row('Left over', tot(A, t => t.surplus), tot(C, t => t.surplus), true, '', 't');
  const kpi = (n: string, f, upGood: boolean) => { const a = tot(A, f), c = tot(C, f), d = a - c;
    return `<div class="kpi"><span>${n}</span><b>${fmt0(a)}</b><span>${cy}: ${fmt0(c)} · <span class="${Math.abs(d) < 0.5 ? '' : (d > 0) === upGood ? 'pos' : 'neg'}">${Math.abs(d) < 0.5 ? 'same' : (d > 0 ? '+' : '') + fmt0(d)}</span></span></div>`; };
  const lab = idx.map(i => MONTHS[i].slice(0, 3));
  return `<section class="panel"><div class="panel-h"><h2>${y} compared with ${cy}</h2><span class="small muted">${mode === 'act' ? 'Actual' : 'Budget'} · ${span}</span></div>
      <p class="small muted" style="margin:-4px 0 12px">Only months both years have${mk === 'a' ? ' actual entries for' : ''} are compared${idx.length < 12 ? `, so ${y} and ${cy} both cover ${span}` : ''}.</p>
      <div class="kpis">${kpi('Money in', t => t.income, true)}${kpi('Saved', t => t.sav, true)}${kpi('Spent', t => t.exp, false)}${kpi('Left over', t => t.surplus, true)}</div>
      <div class="chart" style="margin-top:14px"><div class="legend"><span><i style="background:var(--bad)"></i>Spent ${y}</span><span><i style="background:color-mix(in srgb,var(--bad) 40%,transparent)"></i>Spent ${cy}</span><span><i style="background:var(--mm)"></i>Left over ${y}</span><span><i style="background:var(--faint)"></i>Left over ${cy}</span></div>
      ${barChart([{ n: `Spent ${y}`, c: 'var(--bad)', v: idx.map(i => A.tot[i][mk].exp) }, { n: `Spent ${cy}`, c: 'color-mix(in srgb,var(--bad) 40%,transparent)', v: idx.map(i => C.tot[i][mk].exp) },
        { n: `Left over ${y}`, c: 'var(--mm)', line: true, v: idx.map(i => A.tot[i][mk].surplus) }, { n: `Left over ${cy}`, c: 'var(--faint)', line: true, v: idx.map(i => C.tot[i][mk].surplus) }], lab, { label: `Spent and left over by month, ${y} and ${cy}` })}</div>
    </section>
    <section class="panel flush"><div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th>${span[0].toUpperCase() + span.slice(1)}</th><th>${y}</th><th>${cy}</th><th>Change</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
