/* ===================== capture / edit transaction (from prototype ui3.js) ===================== */
import { esc, fmt, mkey, mName, mShort, nextKey, r2, todayISO, uid } from '../../core/format';
import { cat, lsGet, lsSet, monthKeys, pname, S } from '../../core/state';
import { deleteTxn, saveTxn } from '../../data/db';
import { closeSheet, num, openSheet, toast, val } from '../sheet';
import { accOptions, pickerHTML, recentItems, wirePicker } from './picker';

export function sheetTxn({ k, id, it: presetItem }: any = {}) {
  const editing = id ? S.months[k]?.txns?.[id] : null;
  const st = { it: editing?.it || presetItem || null };
  const t: any = editing || {};
  const keys = monthKeys(); const latest = keys.slice(-1)[0];
  const mos = [...new Set([...keys, latest ? nextKey(latest) : mkey(todayISO())])];
  const defMonth = t.mo || (S.ui.view === 'budget' || S.ui.view === 'home' ? S.ui.month : null) || mkey(todayISO());
  const rec = recentItems();
  const lastPay = lsGet('pn_lastpay') || '';
  openSheet({
    title: editing ? 'Edit entry' : 'Add a spend',
    body: `
      <div class="amtbox"><span>R</span><input id="tx-amt" type="text" inputmode="decimal" placeholder="0.00" value="${editing ? t.amt : ''}" aria-label="Amount" ${editing ? '' : 'autofocus'}></div>
      <div class="lab" style="margin-bottom:6px">What was it for?</div>
      ${rec.length ? `<div class="quick">${rec.map(r => `<button type="button" data-quick="${r}" aria-pressed="${r === st.it}">${esc(cat()[r].n)}</button>`).join('')}</div>` : ''}
      <input class="inp" data-search placeholder="Search all line items, or type a new one" style="margin-bottom:6px">
      <div class="picker"></div>
      <div class="f2" style="margin-top:12px">
        <div class="field"><label for="tx-store">Store or payee</label><input id="tx-store" class="inp" placeholder="e.g. Checkers" value="${esc(t.store || '')}"></div>
        <div class="field"><label for="tx-d">Date</label><input id="tx-d" class="inp" type="date" value="${t.d || todayISO()}"></div>
      </div>
      <div class="f2">
        <div class="field"><label for="tx-pay">Paid from</label><select id="tx-pay" class="inp">${accOptions(editing ? t.pay : lastPay)}</select></div>
        <div class="field"><label for="tx-mo">Counts towards</label><select id="tx-mo" class="inp">${mos.map(m => `<option value="${m}" ${m === defMonth ? 'selected' : ''}>${mName(m)} budget</option>`).join('')}</select></div>
      </div>
      <div class="field"><span class="lab">Paid by</span><div class="seg" id="tx-by">${['P', 'M'].map(w => `<button type="button" data-w="${w}" aria-pressed="${(t.by || S.me) === w}">${esc(pname(w))}</button>`).join('')}</div></div>
      <div class="field"><label for="tx-note">Note</label><input id="tx-note" class="inp" placeholder="Optional" value="${esc(t.note || '')}"></div>
      ${S.assets ? `<div class="field"><label for="tx-rc">Receipt photo</label><input id="tx-rc" type="file" accept="image/*,application/pdf" class="inp">${t.rc ? `<a class="small" href="#" data-a="openfile" data-id="${esc(t.rc)}">View attached receipt</a>` : ''}</div>` : ''}
      ${t.src === 'import' ? '<p class="small muted">Imported from the 2026 spreadsheet as one monthly total.</p>' : t.src === 'statement' ? '<p class="small muted">Added from a bank statement.</p>' : ''}`,
    foot: `${editing ? '<button class="btn danger" id="tx-del">Delete</button><span class="grow"></span>' : ''}
      ${editing ? '' : '<button class="btn" id="tx-more">Save & add another</button>'}<button class="btn primary" id="tx-save">${editing ? 'Save changes' : 'Save'}</button>`,
    onMount: el => {
      wirePicker(el, st, null, () => el.querySelectorAll('[data-quick]').forEach(q => q.setAttribute('aria-pressed', q.dataset.quick === st.it)));
      el.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => { st.it = b.dataset.quick; el.querySelectorAll('[data-quick]').forEach(q => q.setAttribute('aria-pressed', q === b)); el.querySelector('.picker').innerHTML = pickerHTML(el.querySelector('[data-search]').value, st.it); });
      let by = t.by || S.me || '';
      el.querySelectorAll('#tx-by button').forEach(b => b.onclick = () => { by = b.dataset.w; el.querySelectorAll('#tx-by button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
      const dIn = el.querySelector('#tx-d'), moIn = el.querySelector('#tx-mo');
      dIn.addEventListener('change', () => { const m = mkey(dIn.value); if ([...moIn.options].some(o => o.value === m)) moIn.value = m; });
      const save = async again => {
        const amt = r2(num(el, '#tx-amt'));
        if (!(amt > 0)) return toast('Enter an amount above zero.', 'bad');
        if (!st.it) return toast('Choose what it was for.', 'bad');
        const nt: any = { d: dIn.value || todayISO(), mo: moIn.value, it: st.it, amt, src: t.src === 'import' ? 'import' : (t.src || 'app'), at: t.at || Date.now() };
        const store = val(el, '#tx-store'), note = val(el, '#tx-note'), pay = val(el, '#tx-pay');
        if (store) nt.store = store; if (note) nt.note = note; if (pay) nt.pay = pay; if (by) nt.by = by;
        if (t.rc) nt.rc = t.rc;
        const f = el.querySelector('#tx-rc')?.files?.[0];
        const btn = el.querySelector('#tx-save'); btn.disabled = true;
        try {
          let rcNote = '';
          if (f && S.assets) { try { const r = await S.assets.upload(f); nt.rc = r.id; } catch (e) { rcNote = ' – receipt not attached: ' + (e?.message || e?.code); toast('Receipt not attached: ' + (e?.message || e?.code), 'bad'); } }
          lsSet('pn_lastpay', pay);
          await saveTxn(nt, id || uid(), editing ? k : null);
          toast(`Saved ${fmt(amt)} to ${cat()[st.it]?.n} · ${mShort(nt.mo)}${rcNote}`, rcNote ? 'bad' : '');
          if (again) { el.querySelector('#tx-amt').value = ''; el.querySelector('#tx-store').value = ''; el.querySelector('#tx-note').value = ''; el.querySelector('#tx-amt').focus(); btn.disabled = false; }
          else closeSheet();
        } catch (e) { btn.disabled = false; }
      };
      el.querySelector('#tx-save').onclick = () => save(false);
      el.querySelector('#tx-more') && (el.querySelector('#tx-more').onclick = () => save(true));
      el.querySelector('#tx-del') && (el.querySelector('#tx-del').onclick = async () => {
        if (!confirm('Delete this entry?')) return;
        await deleteTxn(k, id); toast('Entry deleted'); closeSheet();
      });
      el.querySelector('#tx-amt').addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('[data-search]').focus(); });
    },
  });
}
