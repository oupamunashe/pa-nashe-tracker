/* ===================== PEOPLE (from prototype ui1.js) ===================== */
import { peopleCalc } from '../../calc/people';
import { esc, fmt, fmt0, mName } from '../../core/format';
import { pname, S } from '../../core/state';

export function viewPeople(k) {
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
