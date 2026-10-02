/* ===================== milestone sheets (from prototype ui3.js) ===================== */
import { esc, fmt, r2, slug, todayISO, uid } from '../../core/format';
import { S } from '../../core/state';
import { saveMs } from '../../data/db';
import { closeAll, closeSheet, num, openSheet, toast, val } from '../sheet';
import { render } from '../shell';

export function sheetMsEdit(id) {
  const m: any = id ? S.ms[id] : { n: '', st: 'active', start: todayISO(), usd: null };
  openSheet({
    title: id ? 'Edit milestone' : 'New milestone',
    body: `<div class="field"><label for="ms-n">Name</label><input id="ms-n" class="inp" value="${esc(m.n)}" placeholder="e.g. Mozambique December trip" ${id ? '' : 'autofocus'}></div>
      <div class="f2"><div class="field"><label for="ms-s">Starts</label><input id="ms-s" type="date" class="inp" value="${m.start || ''}"></div><div class="field"><label for="ms-e">Ends</label><input id="ms-e" type="date" class="inp" value="${m.end || ''}"></div></div>
      ${id ? '' : `<div class="field"><label for="ms-tpl">Start with</label><select id="ms-tpl" class="inp"><option value="trip">Trip lines (flights, car hire, accommodation, food, gifts)</option><option value="event">Event lines (venue, food, outfits, gifts, travel)</option><option value="blank">No lines</option></select></div>`}
      <div class="f2"><div class="field"><label for="ms-usd">US$ exchange rate (blank = rand only)</label><input id="ms-usd" class="inp num" inputmode="decimal" value="${m.usd || ''}" placeholder="e.g. 16.50"></div>
      <div class="field"><label for="ms-st">Status</label><select id="ms-st" class="inp"><option value="active" ${m.st !== 'done' ? 'selected' : ''}>Active</option><option value="done" ${m.st === 'done' ? 'selected' : ''}>Done</option></select></div></div>
      <div class="field"><label for="ms-note">Notes</label><textarea id="ms-note" class="inp">${esc(m.note || '')}</textarea></div>`,
    foot: `${id ? '<button class="btn danger" id="ms-del">Delete</button><span class="grow"></span>' : ''}<button class="btn primary" id="ms-save">${id ? 'Save' : 'Create milestone'}</button>`,
    onMount: el => {
      el.querySelector('#ms-save').onclick = async () => {
        const n = val(el, '#ms-n'); if (!n) return toast('Give it a name.', 'bad');
        const patch = { n, start: val(el, '#ms-s'), end: val(el, '#ms-e'), usd: parseFloat(val(el, '#ms-usd')) || null, st: val(el, '#ms-st'), note: val(el, '#ms-note') };
        if (id) { await saveMs(id, patch); toast('Saved'); closeSheet(); return; }
        const tpl: any = { trip: [['Flights', 'Transportation'], ['Car hire', 'Transportation'], ['Accommodation', 'Stay'], ['Food & eating out', 'Stay'], ['Activities', 'Stay'], ['Gifts', 'Other']], event: [['Venue', 'Event'], ['Food & drinks', 'Event'], ['Outfits', 'Event'], ['Gifts', 'Event'], ['Travel', 'Travel']], blank: [] }[val(el, '#ms-tpl')];
        const lines: any = {}; tpl.forEach(([ln, g], i) => { lines['l' + (i + 1)] = { n: ln, sec: 'expense', grp: g, b: 0, cur: 'ZAR', o: i + 1 }; });
        const nid = slug(n) + '-' + Math.random().toString(36).slice(2, 5);
        const body: any = { ...patch, lines, txns: {}, files: [], o: 0 }; S.ms[nid] = body; S.ver++;
        await saveMs(nid, body, true);
        closeSheet(); S.ui.msId = nid; S.ui.view = 'milestone'; render(); toast('Created ' + n);
      };
      const del = el.querySelector('#ms-del');
      del && (del.onclick = async () => { if (!confirm('Delete this milestone and its payments?')) return; await S.db!.doc('milestones/' + id).delete(); closeAll(); S.ui.view = 'milestones'; render(); });
    },
  });
}
export function sheetMsLine(id, lid) {
  const m: any = S.ms[id], l: any = lid ? m.lines[lid] : { n: '', sec: 'expense', grp: '', b: 0, cur: 'ZAR' };
  const grps = [...new Set(Object.values<any>(m.lines || {}).filter(Boolean).map(x => x.grp).filter(Boolean))];
  openSheet({
    title: lid ? 'Edit line' : 'Add a line',
    body: `<div class="field"><label for="ml-n">Name</label><input id="ml-n" class="inp" value="${esc(l.n)}" ${lid ? '' : 'autofocus'}></div>
      <div class="f2"><div class="field"><label for="ml-sec">Type</label><select id="ml-sec" class="inp"><option value="expense" ${l.sec !== 'income' ? 'selected' : ''}>Cost</option><option value="income" ${l.sec === 'income' ? 'selected' : ''}>Funding</option></select></div>
      <div class="field"><label for="ml-grp">Group</label><input id="ml-grp" class="inp" list="ml-grps" value="${esc(l.grp || '')}"><datalist id="ml-grps">${grps.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div></div>
      <div class="f2"><div class="field"><label for="ml-b">Planned amount</label><input id="ml-b" class="inp num" inputmode="decimal" value="${l.b || ''}"></div>
      <div class="field"><label for="ml-cur">Currency</label><select id="ml-cur" class="inp"><option ${l.cur !== 'USD' ? 'selected' : ''}>ZAR</option>${m.usd ? `<option ${l.cur === 'USD' ? 'selected' : ''}>USD</option>` : ''}</select></div></div>`,
    foot: `${lid ? '<button class="btn danger" id="ml-del">Remove</button><span class="grow"></span><button class="btn" id="ml-pay">Add payment</button>' : ''}<button class="btn primary" id="ml-save">Save</button>`,
    onMount: el => {
      el.querySelector('#ml-save').onclick = async () => {
        const n = val(el, '#ml-n'); if (!n) return toast('Give the line a name.', 'bad');
        const nl = { n, sec: val(el, '#ml-sec'), grp: val(el, '#ml-grp'), b: r2(num(el, '#ml-b')), cur: val(el, '#ml-cur'), o: l.o || Object.keys(m.lines || {}).length + 1 };
        await saveMs(id, { lines: { [lid || 'l' + uid()]: nl } }); toast('Saved'); closeSheet();
      };
      const del = el.querySelector('#ml-del'); del && (del.onclick = async () => { await saveMs(id, { lines: { [lid]: null } }); closeSheet(); });
      const pay = el.querySelector('#ml-pay'); pay && (pay.onclick = () => { closeSheet(); sheetMsTxn(id, null, lid); });
    },
  });
}
export function sheetMsTxn(id, tid, presetLine?) {
  const m: any = S.ms[id], t: any = tid ? m.txns[tid] : { d: todayISO(), cur: 'ZAR', l: presetLine };
  const lines = Object.entries<any>(m.lines || {}).filter(([, l]) => l);
  if (!lines.length) return toast('Add a line to this milestone first.', 'bad');
  openSheet({
    title: tid ? 'Edit payment' : 'Add payment · ' + m.n,
    body: `<div class="amtbox"><span>${t.cur === 'USD' ? '$' : 'R'}</span><input id="mt-amt" inputmode="decimal" placeholder="0.00" value="${t.amt ?? ''}" autofocus></div>
      <div class="field"><label for="mt-l">Line</label><select id="mt-l" class="inp">${lines.map(([lid, l]) => `<option value="${lid}" ${lid === t.l ? 'selected' : ''}>${esc(l.n)}${l.sec === 'income' ? ' (funding)' : ''}</option>`).join('')}</select></div>
      <div class="f2"><div class="field"><label for="mt-d">Date</label><input id="mt-d" type="date" class="inp" value="${t.d || todayISO()}"></div>
      <div class="field"><label for="mt-cur">Currency</label><select id="mt-cur" class="inp"><option ${t.cur !== 'USD' ? 'selected' : ''}>ZAR</option>${m.usd ? `<option ${t.cur === 'USD' ? 'selected' : ''}>USD</option>` : ''}</select></div></div>
      <div class="field"><label for="mt-note">Note</label><input id="mt-note" class="inp" value="${esc(t.note || '')}"></div>
      ${S.assets ? `<div class="field"><label for="mt-rc">Receipt</label><input id="mt-rc" type="file" accept="image/*,application/pdf" class="inp">${t.rc ? `<a class="small" href="#" data-a="openfile" data-id="${esc(t.rc)}">View receipt</a>` : ''}</div>` : ''}
      <p class="small muted">Milestone payments are tracked here. If the money also left your monthly budget, capture it there as well (for example under the trip’s line item).</p>`,
    foot: `${tid ? '<button class="btn danger" id="mt-del">Delete</button><span class="grow"></span>' : ''}<button class="btn primary" id="mt-save">Save payment</button>`,
    onMount: el => {
      const cur = el.querySelector('#mt-cur'); cur.onchange = () => el.querySelector('.amtbox span').textContent = cur.value === 'USD' ? '$' : 'R';
      el.querySelector('#mt-save').onclick = async () => {
        const amt = r2(num(el, '#mt-amt')); if (!(amt > 0)) return toast('Enter an amount above zero.', 'bad');
        const nt: any = { d: val(el, '#mt-d'), l: val(el, '#mt-l'), amt, cur: cur.value, note: val(el, '#mt-note') };
        if (t.rc) nt.rc = t.rc;
        const f = el.querySelector('#mt-rc')?.files?.[0];
        if (f && S.assets) { try { nt.rc = (await S.assets.upload(f)).id; } catch (e) { toast('Receipt not attached', 'bad'); } }
        await saveMs(id, { txns: { [tid || uid()]: nt } }); toast('Saved ' + fmt(amt)); closeSheet();
      };
      const del = el.querySelector('#mt-del'); del && (del.onclick = async () => { await saveMs(id, { txns: { [tid]: null } }); closeSheet(); });
    },
  });
}
export async function msAttach(id, file) {
  if (!S.assets || !file) return;
  try {
    toast('Uploading ' + file.name + '…');
    const r = await S.assets.upload(file);
    const files = [...(S.ms[id].files || []), { id: r.id, n: file.name, d: todayISO() }];
    await saveMs(id, { files }); toast('Attached ' + file.name);
  } catch (e) { toast('Could not attach: ' + (e?.message || e?.code), 'bad'); }
}
