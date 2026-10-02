/* ===================== trend for a line item (from prototype ui3.js) ===================== */
import { yearCalc } from '../../calc/year';
import { GMAP } from '../../core/constants';
import { esc, fmt0, mShort, sum } from '../../core/format';
import { monthKeys, S } from '../../core/state';
import { barChart } from '../chart';
import { openSheet } from '../sheet';

export function sheetTrend(id) {
  const y = S.ui.year || monthKeys().slice(-1)[0]?.slice(0, 4); const Y = yearCalc(y);
  const x = Y.items.find(i => i.id === id); if (!x) return;
  openSheet({
    title: x.it.n, wide: true,
    body: `<p class="muted small">${esc(GMAP[x.g]?.n || '')} · ${y}. Comparing across years arrives with the 2024 and 2025 import.</p>
      <div class="legend" style="margin:6px 0"><span><i style="background:var(--line)"></i>Budget</span><span><i style="background:var(--brand)"></i>Actual</span></div>
      <div class="chart">${barChart([{ n: 'Budget', c: 'var(--line)', v: x.b }, { n: 'Actual', c: 'var(--brand)', v: x.a }], Y.keys.map(mShort), { label: x.it.n + ' by month' })}</div>
      <div class="kpis" style="margin-top:12px"><div class="kpi"><span>Total actual</span><b>${fmt0(sum(x.a))}</b></div><div class="kpi"><span>Total budget</span><b>${fmt0(sum(x.b))}</b></div>
      <div class="kpi"><span>Monthly average</span><b>${fmt0(sum(x.a) / Math.max(1, x.a.filter((v, i) => S.months[Y.keys[i]]).length))}</b></div><div class="kpi"><span>Highest month</span><b>${fmt0(Math.max(...x.a))}</b></div></div>`,
  });
}
