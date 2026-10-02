/* ===================== line detail, mark paid, add line, start month (from prototype ui3.js) ===================== */
import { monthCalc } from '../../calc/month';
import { MONTHS } from '../../core/constants';
import { esc, fmt, mkey, mName, pct, r2, sum, todayISO } from '../../core/format';
import { cat, itemKind, monthKeys, pname, S } from '../../core/state';
import { ensureMonth, removeLine, saveLine, saveTxn } from '../../data/db';
import { I } from '../icons';
import { txnLi, varCls } from '../parts';
import { closeSheet, num, openSheet, toast, val } from '../sheet';
import { wirePicker } from './picker';
import { sheetTxn } from './txn';
import { render } from '../shell';

export function sheetLine(k, id) {
  const draw = () => {
    const mc = monthCalc(k); const l: any = mc.lines.find(x => x.id === id) || { id, it: cat()[id] || { n: '?' }, b: 0, act: 0, tx: [], al: [], k: itemKind(id), g: cat()[id]?.g };
    return { l, body: `
      <div class="kpis k3" style="margin-bottom:14px">
        <div class="kpi"><span>Budget</span><b>${fmt(l.b)}</b></div><div class="kpi"><span>Actual</span><b class="${varCls(l)}">${fmt(l.act)}</b></div>
        <div class="kpi"><span>${l.k === 'exp' ? 'Left' : 'Variance'}</span><b class="${(l.k === 'exp' ? l.b - l.act : l.act - l.b) < -0.004 ? 'neg' : ''}">${fmt(l.k === 'exp' ? l.b - l.act : l.act - l.b)}</b></div></div>
      <div class="f2"><div class="field"><label for="ln-b">Budget for ${MONTHS[+k.slice(5) - 1]}</label><input id="ln-b" class="inp num" type="text" inputmode="decimal" value="${l.b || ''}"></div>
        <div class="field" style="justify-content:flex-end"><label class="toggle"><input type="checkbox" id="ln-rec" ${l.rec ? 'checked' : ''}> Every month</label></div></div>
      <div class="lab" style="margin-bottom:6px">Who pays for this</div>
      <div class="quick"><button type="button" data-preset="P">All ${esc(pname('P'))}</button><button type="button" data-preset="M">All ${esc(pname('M'))}</button><button type="button" data-preset="half">50 / 50</button><button type="button" data-preset="none">Not allocated</button></div>
      <div id="ln-splits"></div>
      <button type="button" class="btn sm" id="ln-addsplit">${I.plus}Add a split</button>
      <p class="small muted" id="ln-rem" style="margin:8px 0 12px"></p>
      <div class="field"><label for="ln-note">Notes for ${MONTHS[+k.slice(5) - 1]}</label><textarea id="ln-note" class="inp">${esc(l.note || '')}</textarea></div>
      <div class="row between" style="margin:6px 0"><h3>Entries</h3><button class="btn sm" id="ln-addtx">${I.plus}Add entry</button></div>
      ${l.tx.length ? `<ul class="list panel flush">${l.tx.map(t => txnLi(t, k)).join('')}</ul>` : '<p class="muted small">No entries yet.</p>'}` };
  };
  const { l, body } = draw();
  let splits = (l.al || []).map(x => ({ ...x }));
  openSheet({
    title: l.it.n,
    body,
    foot: `${!l.tx.length && l.inMonth ? '<button class="btn danger" id="ln-rm">Remove from month</button>' : ''}<span class="grow"></span>
      ${l.k !== 'in' && !l.act && l.b ? '<button class="btn" id="ln-paid">Mark paid</button>' : ''}<button class="btn primary" id="ln-save">Save</button>`,
    refresh: el => { const s = el.querySelector('.sheet-b'); const y = s.scrollTop; s.innerHTML = draw().body; mount(el, true); s.scrollTop = y; },
    onMount: el => mount(el),
  });
  function mount(el, again?) {
    const box = el.querySelector('#ln-splits'), rem = el.querySelector('#ln-rem');
    const total = () => num(el, '#ln-b') || monthCalc(k).lines.find(x => x.id === id)?.act || 0;
    const drawSplits = () => {
      box.innerHTML = splits.map((s, i) => `<div class="splitrow alloc">
        <select class="inp sm" data-i="${i}" data-f="w" aria-label="Person"><option value="P" ${s.w === 'P' ? 'selected' : ''}>${esc(pname('P'))}</option><option value="M" ${s.w === 'M' ? 'selected' : ''}>${esc(pname('M'))}</option></select>
        <input class="inp sm lbl" data-i="${i}" data-f="lb" placeholder="Label, e.g. Chie’s pocket money" value="${esc(s.lb || '')}" aria-label="Label">
        <input class="inp sm num" data-i="${i}" data-f="v" inputmode="decimal" value="${s.v ?? ''}" aria-label="Amount">
        <button type="button" class="btn sm" data-i="${i}" data-f="u" title="Switch between rand and percent">${s.u === 'pct' ? '%' : 'R'}</button>
        <button type="button" class="btn sm ghost" data-i="${i}" data-f="x" aria-label="Remove split">${I.x}</button></div>`).join('');
      const t = total(); const used = sum(splits, s => s.u === 'pct' ? t * (+s.v || 0) / 100 : +s.v || 0);
      rem.textContent = !splits.length ? 'Not allocated to anyone yet.' : Math.abs(t - used) < 0.01 ? `Fully allocated: ${splits.map(s => pname(s.w) + ' ' + (s.u === 'pct' ? s.v + '%' : fmt(s.v))).join(' · ')}` : `${fmt(t - used)} ${t - used > 0 ? 'not allocated yet' : 'more than the line total'}.`;
    };
    box.oninput = e => { const i = e.target.dataset.i, f = e.target.dataset.f; if (i === undefined) return; splits[i][f] = f === 'v' ? parseFloat(e.target.value) || 0 : e.target.value; if (f !== 'lb') drawSplits(); };
    box.onchange = box.oninput;
    box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i;
      if (b.dataset.f === 'u') { splits[i].u = splits[i].u === 'pct' ? 'amt' : 'pct'; } if (b.dataset.f === 'x') splits.splice(i, 1); drawSplits(); };
    el.querySelector('#ln-addsplit').onclick = () => { const t = total(), used = sum(splits, s => s.u === 'pct' ? t * s.v / 100 : +s.v); splits.push({ w: splits.some(s => s.w === 'P') ? 'M' : 'P', v: r2(Math.max(0, t - used)), u: 'amt' }); drawSplits(); };
    el.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { const p = b.dataset.preset;
      splits = p === 'none' ? [] : p === 'half' ? [{ w: 'P', v: 50, u: 'pct' }, { w: 'M', v: 50, u: 'pct' }] : [{ w: p, v: 100, u: 'pct' }]; drawSplits(); });
    el.querySelector('#ln-b').addEventListener('input', drawSplits);
    drawSplits();
    if (again) return;
    el.querySelector('#ln-save').onclick = async () => {
      const line = { b: r2(num(el, '#ln-b')), al: splits.filter(s => +s.v).map(s => { const o: any = { w: s.w, v: r2(s.v), u: s.u || 'amt' }; if (s.lb) o.lb = s.lb; return o; }), rec: el.querySelector('#ln-rec').checked, note: val(el, '#ln-note') };
      await saveLine(k, id, line); toast('Saved ' + cat()[id]?.n); closeSheet();
    };
    const pd = el.querySelector('#ln-paid');
    pd && (pd.onclick = () => markPaid(k, id).then(closeSheet));
    const rm = el.querySelector('#ln-rm');
    rm && (rm.onclick = async () => { await removeLine(k, id); toast('Removed from ' + mName(k)); closeSheet(); });
    el.querySelector('#ln-addtx').onclick = () => sheetTxn({ it: id });
    el.querySelector('.sheet-b').addEventListener('click', e => { const li = e.target.closest('[data-a="txn"]'); if (li) { e.stopPropagation(); sheetTxn({ k: li.dataset.k, id: li.dataset.id }); } });
  }
}
export async function markPaid(k, id) {
  const l = monthCalc(k).lines.find(x => x.id === id); if (!l) return;
  const d = mkey(todayISO()) === k ? todayISO() : k + '-28';
  const by = l.al?.length === 1 ? l.al[0].w : (S.me || undefined);
  const t: any = { d, mo: k, it: id, amt: l.b, src: 'app', note: 'Marked paid', at: Date.now() }; if (by) t.by = by;
  await saveTxn(t); toast(`Marked ${l.it.n} paid · ${fmt(l.b)}`);
}
export function sheetAddLine(k) {
  const st = { it: null };
  openSheet({
    title: 'Add a line to ' + mName(k),
    body: `<input class="inp" data-search placeholder="Search line items, or type a new one" autofocus style="margin-bottom:6px"><div class="picker"></div>
      <div class="field" style="margin-top:12px"><label for="al-b">Budget</label><input id="al-b" class="inp num" inputmode="decimal" placeholder="0.00"></div>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="al-save">Add line</button>`,
    onMount: el => {
      wirePicker(el, st);
      el.querySelector('#al-save').onclick = async () => {
        if (!st.it) return toast('Choose a line item.', 'bad');
        const line: any = { b: r2(num(el, '#al-b')) }; if (cat()[st.it]?.rec) line.rec = true;
        await saveLine(k, st.it, line); toast('Added ' + cat()[st.it].n); closeSheet();
      };
    },
  });
}
export async function startMonth(nk) {
  const last = monthKeys().slice(-1)[0]; const src = S.months[last];
  if (S.months[nk]) { S.ui.month = nk; render(); return; }
  const lines = {};
  Object.entries(src?.lines || {}).forEach(([id, L]) => {
    if (!L) return; const it = cat()[id]; if (!it || it.arch) return;
    if (!(L.rec || it.rec) && (it.g === 'onceoff' || !(+L.b))) return;
    const n: any = { b: +L.b || 0 }; if (L.al?.length) n.al = L.al; if (L.rec || it.rec) n.rec = true;
    lines[id] = n;
  });
  openSheet({
    title: 'Start ' + mName(nk),
    body: `<p>This copies ${Object.keys(lines).length} lines from ${mName(last)} – budgets, who pays, and the monthly flags. Once-off lines and lines with no budget are left out.</p>
      <p class="muted small">You can change or remove any line afterwards. Monthly items will show as “Due” until you mark them paid.</p>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="sm-go">Start ${MONTHS[+nk.slice(5) - 1]}</button>`,
    onMount: el => el.querySelector('#sm-go').onclick = async () => {
      await ensureMonth(nk, { lines }); S.ui.month = nk; closeSheet(); toast(mName(nk) + ' is ready'); render();
    },
  });
}
