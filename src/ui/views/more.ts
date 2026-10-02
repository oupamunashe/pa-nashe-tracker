/* ===================== MORE and line items (from prototype ui2.js) ===================== */
import { GROUPS } from '../../core/constants';
import { esc } from '../../core/format';
import { accs, cat, pname, S } from '../../core/state';
import { backup } from '../../io/export';
import { I } from '../icons';

export function viewMore() {
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
    <p class="small muted">Pa-Nashe Tracker. Data is shared live between ${esc(pname('P'))} and ${esc(pname('M'))}.</p>
  </div>`;
}
export function viewItems() {
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
