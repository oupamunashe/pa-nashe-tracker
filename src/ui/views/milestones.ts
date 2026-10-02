/* ===================== MILESTONES (from prototype ui2.js) ===================== */
import { msCalc } from '../../calc/milestones';
import { esc, fmt, fmt0, fmtDate, pct, sum } from '../../core/format';
import { S } from '../../core/state';
import { I } from '../icons';
import { hbar } from '../parts';

export function viewMilestones() {
  const list = Object.keys(S.ms).map(id => ({ id, c: msCalc(id) as any })).filter(x => x.c)
    .sort((a, b) => ((a.c.m.st === 'done') as any) - ((b.c.m.st === 'done') as any) || (a.c.m.o || 0) - (b.c.m.o || 0));
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
export function viewMilestone() {
  const id: any = S.ui.msId, c: any = msCalc(id); if (!c) return '<div class="loading"><div class="spin"></div></div>';
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
      ${grps.map((gk: any) => { const [sec, grp] = gk.split('|'); const ls = c.lines.filter(l => l.sec === sec && (l.grp || '') === grp);
        return `<tr class="g"><td>${sec === 'income' ? 'Funding' : 'Costs'}${grp ? ' · ' + esc(grp) : ''}</td><td>${fmt(sum(ls, l => l.bz))}</td><td>${fmt(sum(ls, l => l.az))}</td><td></td></tr>` +
          ls.map(l => `<tr class="click" data-a="msline" data-id="${id}" data-l="${l.id}"><td style="padding-left:20px">${esc(l.n)}</td><td>${amtCell(l.bz, l)}</td><td>${l.az ? fmt(l.az) : '–'}</td><td class="${(sec === 'income' ? l.az - l.bz : l.bz - l.az) < 0 ? 'neg' : 'muted'}">${l.bz || l.az ? fmt(sec === 'income' ? l.az - l.bz : l.bz - l.az) : ''}</td></tr>`).join(''); }).join('')}
    </tbody></table></div></section>
    <section class="panel flush"><div class="sec-h">Payments<span class="tot small muted">${c.tx.length}</span></div>
      ${c.tx.length ? `<ul class="list">${c.tx.sort((a, b) => (b.d || '').localeCompare(a.d || '')).map(t => { const l = m.lines?.[t.l];
        return `<li class="li" data-a="mstxn" data-id="${id}" data-t="${t.id}"><div class="grow"><div class="t">${esc(l?.n || '?')}</div><div class="s">${fmtDate(t.d)}${t.note ? ' · ' + esc(t.note) : ''}${t.rc ? ' · receipt' : ''}</div></div><div class="v">${fmt(t.zar)}${t.cur === 'USD' ? `<small>$${(+t.amt).toLocaleString()}</small>` : ''}</div></li>`; }).join('')}</ul>` : '<div class="empty" style="margin:0 14px 14px">No payments yet.</div>'}
    </section>
    <section class="panel"><div class="panel-h"><h2>Documents</h2>${S.assets ? `<label class="btn sm">Attach file<input type="file" accept="image/*,application/pdf" data-a="msfile" data-id="${id}" hidden></label>` : ''}</div>
      ${(m.files || []).length ? `<ul class="list" style="margin:0 -16px -16px">${m.files.map(f => `<li class="li"><a class="grow t" href="#" data-a="openfile" data-id="${esc(f.id)}">${esc(f.n)}</a><span class="s">${fmtDate(f.d)}</span></li>`).join('')}</ul>` : `<p class="muted small">${S.assets ? 'Attach invoices, quotes and proof of payment here.' : 'Attach invoices, quotes and proof of payment here.'}</p>`}
    </section>
  </div>`;
}
