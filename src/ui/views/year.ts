/* ===================== YEAR (from prototype ui2.js) ===================== */
import { balances } from '../../calc/balances';
import { yearCalc } from '../../calc/year';
import { GROUPS, SECTIONS } from '../../core/constants';
import { esc, fmt0, mShort, sum } from '../../core/format';
import { monthKeys, S } from '../../core/state';
import { barChart } from '../chart';

export function viewYear() {
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
