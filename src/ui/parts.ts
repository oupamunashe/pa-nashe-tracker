/* ---------- small renderers shared by views and sheets (from prototype ui1.js) ---------- */
import { isHistory } from '../core/constants';
import { esc, fmt, fmt0, fmtDate, sum } from '../core/format';
import { accs, cat, itemKind, pname } from '../core/state';

export function allocChips(al) {
  if (!al || !al.length) return '';
  const tot = sum(al.filter(x => x.u === 'amt'), (x: any) => x.v);
  return al.map(x => `<span class="chip ${x.w}">${esc(pname(x.w))}${al.length > 1 ? ' ' + (x.u === 'pct' ? x.v + '%' : fmt0(x.v)) : ''}</span>`).join('');
}
export function varCls(l) {
  if (!l.b && !l.act) return '';
  if (l.k === 'in' || l.k === 'sav') return l.act >= l.b ? 'pos' : (l.act ? 'neg' : 'faint');
  return l.act > l.b + 0.004 ? 'neg' : 'pos';
}
export function lineRow(l, k) {
  const due = (l.rec || l.b) && !l.act && l.k !== 'in' && !isHistory(k);   // no “Due” on months from the old workbooks
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
/** “Against your plan”: savings are on track at or above their target share, spending at or below it. */
export function planOnTrack(c: { save?: boolean; actPct: number; planPct: number }) {
  return c.save ? c.actPct >= c.planPct : c.actPct <= c.planPct;
}
/** Bar colour for a plan category: one green for on target, one red for off target. */
export function planBarColor(c: { save?: boolean; actPct: number; planPct: number }) {
  return planOnTrack(c) ? 'var(--good)' : 'var(--bad)';
}
export function hbar(actPct, planPct, color = 'var(--brand)') {
  return `<div class="bar"><span style="width:${Math.max(0, Math.min(100, actPct * 100))}%;background:${color}"></span>${planPct ? `<i style="left:${Math.min(99.5, planPct * 100)}%"></i>` : ''}</div>`;
}
export function txnLi(t, k) {
  const it = cat()[t.it] || { n: '?' };
  const a = t.pay ? accs()[t.pay] : null;
  return `<li class="li" data-a="txn" data-k="${k}" data-id="${t.id}">
    <div class="avatar ${t.by || 'J'}">${t.by ? pname(t.by)[0] : '·'}</div>
    <div class="grow"><div class="t">${esc(t.store || it.n)}</div><div class="s">${esc(t.store ? it.n : (t.note || ''))}${a ? ' · ' + esc(a.n) : ''}</div></div>
    <div class="v ${itemKind(t.it) === 'in' ? 'pos' : ''}">${fmt(t.amt)}<small>${fmtDate(t.d)}</small></div></li>`;
}
