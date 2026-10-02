/* ===================== line item editor (from prototype ui3.js) ===================== */
import { balances } from '../../calc/balances';
import { BUCKETS, GROUPS } from '../../core/constants';
import { esc, slug } from '../../core/format';
import { accs, cat } from '../../core/state';
import { saveItem } from '../../data/db';
import { I } from '../icons';
import { closeSheet, num, openSheet, toast, val } from '../sheet';

export function sheetItem(id) {
  const it = id ? { ...cat()[id] } : { n: '', g: 'household', fl: [] };
  let fl: any[] = (it.fl || []).map(f => ({ ...f }));
  openSheet({
    title: id ? 'Edit line item' : 'New line item',
    body: `<div class="field"><label for="it-n">Name</label><input id="it-n" class="inp" value="${esc(it.n)}"></div>
      <div class="field"><label for="it-g">Category</label><select id="it-g" class="inp">${GROUPS.map(g => `<option value="${g.k}" ${g.k === it.g ? 'selected' : ''}>${esc(g.n)}</option>`).join('')}</select></div>
      <div class="field"><label for="it-pb">Counts towards plan category</label><select id="it-pb" class="inp"><option value="">None (income)</option>${BUCKETS.map(b => `<option value="${b.k}" ${b.k === it.pb ? 'selected' : ''}>${esc(b.n)}</option>`).join('')}</select></div>
      <label class="toggle" style="margin-bottom:6px"><input type="checkbox" id="it-rec" ${it.rec ? 'checked' : ''}> Happens every month</label>
      <label class="toggle" style="margin-bottom:14px"><input type="checkbox" id="it-arch" ${it.arch ? 'checked' : ''}> Archived (hide from pickers)</label>
      <div class="lab">Linked accounts</div><p class="small muted" style="margin:2px 0 8px">When money goes to this line, these balances move automatically. For example TFSA Contributions adds half to each TFSA.</p>
      <div id="it-fl"></div><button class="btn sm" id="it-addfl">${I.plus}Link an account</button>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="it-save">Save</button>`,
    onMount: el => {
      const box = el.querySelector('#it-fl');
      const draw = () => { box.innerHTML = fl.map((f, i) => `<div class="splitrow" style="grid-template-columns:1fr 120px 76px 32px">
        <select class="inp sm" data-i="${i}" data-f="a">${Object.entries(accs()).filter(([, a]) => a.t !== 'bank').map(([aid, a]) => `<option value="${aid}" ${aid === f.a ? 'selected' : ''}>${esc(a.n)}</option>`).join('')}</select>
        <select class="inp sm" data-i="${i}" data-f="x"><option value="1" ${f.x > 0 ? 'selected' : ''}>Adds to</option><option value="-1" ${f.x < 0 ? 'selected' : ''}>Takes from</option></select>
        <input class="inp sm num" data-i="${i}" data-f="s" value="${Math.round((f.s ?? 1) * 100)}" title="Share %">
        <button class="btn sm ghost" data-i="${i}" data-f="rm" aria-label="Remove link">${I.x}</button></div>`).join(''); };
      box.onchange = e => { const i = e.target.dataset.i, f = e.target.dataset.f; if (i === undefined) return; fl[i][f] = f === 's' ? (parseFloat(e.target.value) || 0) / 100 : f === 'x' ? +e.target.value : e.target.value; };
      box.onclick = e => { const b = e.target.closest('button'); if (b?.dataset.f === 'rm') { fl.splice(+b.dataset.i, 1); draw(); } };
      el.querySelector('#it-addfl').onclick = () => { fl.push({ a: Object.keys(accs()).find(k => accs()[k].t !== 'bank'), s: 1, x: 1 }); draw(); };
      draw();
      el.querySelector('#it-save').onclick = async () => {
        const n = val(el, '#it-n'); if (!n) return toast('Give it a name.', 'bad');
        const o = { ...it, n, g: val(el, '#it-g'), pb: val(el, '#it-pb') || null, rec: el.querySelector('#it-rec').checked, arch: el.querySelector('#it-arch').checked, fl };
        if (!o.o) o.o = Math.max(0, ...Object.values(cat()).map(x => x?.o || 0)) + 1;
        let nid = id; if (!nid) { nid = slug(n); while (cat()[nid]) nid += '-x'; }
        await saveItem(nid, o); toast('Saved ' + n); closeSheet();
      };
    },
  });
}
