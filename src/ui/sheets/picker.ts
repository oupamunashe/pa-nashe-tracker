/* ===================== item picker & account options (from prototype ui3.js) ===================== */
import { liveTxns } from '../../calc/month';
import { BUCKETS, GROUPS } from '../../core/constants';
import { esc, slug } from '../../core/format';
import { accs, cat, itemKind, kindOf, monthKeys, S } from '../../core/state';
import { saveItem } from '../../data/db';
import { I } from '../icons';
import { closeSheet, openSheet, toast, val } from '../sheet';

export function recentItems(n = 8) {
  const counts: any = {};
  monthKeys().slice(-3).forEach(k => liveTxns(S.months[k]).forEach(t => { if (t.src !== 'import') counts[t.it] = (counts[t.it] || 0) + 1; }));
  const everyday = ['groceries', 'fuel-piepie', 'dates', 'dischem-clicks-expenses', 'miscellaneous-expenses', 'our-pocket-money', 'home-improvements', 'wife-maintenance'];
  const ranked = Object.entries<any>(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return [...new Set([...ranked, ...everyday])].filter(id => cat()[id] && !cat()[id].arch && itemKind(id) !== 'in').slice(0, n);
}
export function pickerHTML(q, selected, kinds?) {
  q = (q || '').toLowerCase();
  const items = Object.entries(cat()).filter(([, it]) => it && !it.arch && (!kinds || kinds.includes(kindOf(it.g))) && (!q || it.n.toLowerCase().includes(q)));
  let h = '';
  GROUPS.forEach(g => {
    const its = items.filter(([, it]) => it.g === g.k).sort((a, b) => (a[1].o || 0) - (b[1].o || 0));
    if (!its.length) return;
    h += `<div class="pg">${esc(g.n)}</div>` + its.map(([id, it]) => `<button type="button" data-pick="${id}" aria-selected="${id === selected}">${esc(it.n)}</button>`).join('');
  });
  if (q) h += `<button type="button" data-newitem="1" style="font-weight:700;color:var(--brand)">${I.plus} Add “${esc(q)}” as a new line item</button>`;
  return h || '<div class="empty">Nothing matches.</div>';
}
export function wirePicker(root, state, kinds?, onPick?) {
  const box = root.querySelector('.picker'), search = root.querySelector('[data-search]');
  const draw = () => { box.innerHTML = pickerHTML(search.value, state.it, kinds); };
  search.addEventListener('input', draw);
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pick) { state.it = b.dataset.pick; draw(); onPick && onPick(state.it); }
    if (b.dataset.newitem) newItemInline(search.value, kinds, id => { state.it = id; search.value = ''; draw(); onPick && onPick(id); });
  });
  draw();
}
export function newItemInline(name, kinds, done) {
  const groups = GROUPS.filter(g => !kinds || kinds.includes(g.sec));
  openSheet({
    title: 'New line item',
    body: `<div class="field"><label for="ni-n">Name</label><input id="ni-n" class="inp" value="${esc(name)}" autofocus></div>
      <div class="field"><label for="ni-g">Category</label><select id="ni-g" class="inp">${groups.map(g => `<option value="${g.k}" ${g.k === 'household' ? 'selected' : ''}>${esc(g.n)}</option>`).join('')}</select></div>
      <label class="toggle"><input type="checkbox" id="ni-r"> Happens every month</label>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="ni-save">Add line item</button>`,
    onMount: el => el.querySelector('#ni-save').onclick = async () => {
      const n = val(el, '#ni-n'); if (!n) return toast('Give the line item a name.', 'bad');
      let id = slug(n); while (cat()[id]) id = slug(n) + '-' + Math.random().toString(36).slice(2, 5);
      const g = val(el, '#ni-g');
      const it: any = { n, g, o: Math.max(0, ...Object.values(cat()).map(x => x?.o || 0)) + 1 };
      if (el.querySelector('#ni-r').checked) it.rec = true;
      const b = BUCKETS.find(b => b.k === g) || (g === 'lt' ? { k: 'retire' } : ['it', 'st'].includes(g) ? { k: 'goals' } : g === 'housing' ? { k: n.startsWith('La Vie') ? 'lavie' : 'sultana' } : null);
      if (b) it.pb = b.k;
      S.cfg.catalog!.items[id] = it; S.ver++;
      await saveItem(id, it); closeSheet(); toast('Added ' + n); done(id);
    },
  });
}
export function accOptions(sel, filter?) {
  const A = accs();
  const groups = [['bank', 'Everyday accounts'], ['credit', 'Credit & store accounts'], ['savings', 'Savings'], ['goal', 'Goals'], ['loan', 'Loans']];
  return `<option value="">Not recorded</option>` + groups.map(([t, n]) => {
    const as = Object.entries(A).filter(([, a]) => a.t === t && !a.closed && (!filter || filter(a)));
    return as.length ? `<optgroup label="${n}">${as.map(([id, a]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(a.n)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
