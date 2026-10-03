/* ===================== account sheets (from prototype ui3.js) ===================== */
import { POTS } from '../../calc/pots';
import { balances } from '../../calc/balances';
import { ACC_TYPES } from '../../core/constants';
import { esc, fmt, mkey, r2, slug, todayISO, uid } from '../../core/format';
import { accs, isLiab, pname } from '../../core/state';
import { deleteLedger, saveAccount, saveLedger } from '../../data/db';
import { closeSheet, num, openSheet, toast, val } from '../sheet';
import { accOptions } from './picker';

export function sheetLedger(accId, entry?) {
  const a = accs()[accId], liab = isLiab(a);
  const e = entry || {};
  const dirIn = e.amt === undefined ? true : e.amt >= 0;
  openSheet({
    title: (entry ? 'Edit entry · ' : 'Add entry · ') + a.n,
    body: `<div class="amtbox"><span>R</span><input id="le-amt" inputmode="decimal" placeholder="0.00" value="${e.amt !== undefined ? Math.abs(e.amt) : ''}" autofocus></div>
      <div class="field"><span class="lab">Direction</span><div class="seg" id="le-dir"><button type="button" data-v="1" aria-pressed="${dirIn}">${liab ? 'Owing goes up' : 'Money in'}</button><button type="button" data-v="-1" aria-pressed="${!dirIn}">${liab ? 'Owing goes down' : 'Money out'}</button></div></div>
      <div class="f2"><div class="field"><label for="le-ty">Type</label><select id="le-ty" class="inp">${['deposit', 'withdrawal', 'interest', 'fee', 'spend', 'repayment', 'transfer', 'correction', 'other'].map(t => `<option ${t === e.ty ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label for="le-d">Date</label><input id="le-d" class="inp" type="date" value="${e.d || todayISO()}"></div></div>
      <div class="field"><label for="le-ds">Description</label><input id="le-ds" class="inp" value="${esc(e.ds || '')}"></div>
      <p class="small muted">Use this for things the monthly budget doesn’t see: interest, bank fees, money moved in or out outside the budget.</p>`,
    foot: `${entry ? '<button class="btn danger" id="le-del">Delete</button><span class="grow"></span>' : ''}<button class="btn primary" id="le-save">Save</button>`,
    onMount: el => {
      let dir = dirIn ? 1 : -1;
      el.querySelectorAll('#le-dir button').forEach(b => b.onclick = () => { dir = +b.dataset.v; el.querySelectorAll('#le-dir button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
      el.querySelector('#le-save').onclick = async () => {
        const amt = r2(num(el, '#le-amt')); if (!(amt > 0)) return toast('Enter an amount above zero.', 'bad');
        const ne = { d: val(el, '#le-d') || todayISO(), a: accId, amt: dir * amt, ty: val(el, '#le-ty'), ds: val(el, '#le-ds'), src: 'ledger' };
        if (entry && mkey(entry.d) !== mkey(ne.d)) await deleteLedger(mkey(entry.d), entry.id);
        await saveLedger(ne, entry?.id || uid()); toast('Saved'); closeSheet();
      };
      const del = el.querySelector('#le-del');
      del && (del.onclick = async () => { if (!confirm('Delete this entry?')) return; await deleteLedger(mkey(entry.d), entry.id); toast('Deleted'); closeSheet(); });
    },
  });
}
export function sheetCheck(accId) {
  const a = accs()[accId], r = balances()[accId], liab = isLiab(a);
  openSheet({
    title: 'Check balance · ' + a.n,
    body: `<p class="muted">${liab ? 'Type what you owe today' : 'Type the balance'} from your banking app. Everything after this date builds on it, and the difference is recorded as an adjustment.</p>
      <div class="amtbox"><span>R</span><input id="ck-bal" inputmode="decimal" placeholder="0.00" autofocus></div>
      <div class="field"><label for="ck-d">As at</label><input id="ck-d" class="inp" type="date" value="${todayISO()}"></div>
      <p class="small">Currently calculated: <b>${r.known ? fmt(r.bal) : 'not set'}</b></p>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="ck-save">Confirm balance</button>`,
    onMount: el => el.querySelector('#ck-save').onclick = async () => {
      const raw = val(el, '#ck-bal'); if (raw === '') return toast('Enter the balance.', 'bad');
      const bal = r2(num(el, '#ck-bal'));
      await saveLedger({ d: val(el, '#ck-d') || todayISO(), a: accId, amt: 0, ty: 'check', bal, ds: 'Balance confirmed', src: 'check' });
      toast(a.n + ' confirmed at ' + fmt(bal)); closeSheet();
    },
  });
}
export function sheetTransfer(fromId) {
  openSheet({
    title: 'Move money between accounts',
    body: `<div class="amtbox"><span>R</span><input id="tr-amt" inputmode="decimal" placeholder="0.00" autofocus></div>
      <div class="f2"><div class="field"><label for="tr-from">From</label><select id="tr-from" class="inp">${accOptions(fromId || '')}</select></div>
      <div class="field"><label for="tr-to">To</label><select id="tr-to" class="inp">${accOptions('')}</select></div></div>
      <div class="f2"><div class="field"><label for="tr-d">Date</label><input id="tr-d" class="inp" type="date" value="${todayISO()}"></div>
      <div class="field"><label for="tr-ds">Description</label><input id="tr-ds" class="inp" placeholder="e.g. Repay credit card"></div></div>
      <p class="small muted">Moving money between your own accounts isn’t spending or income, so the budget doesn’t change. Paying the credit card from savings reduces both balances.</p>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="tr-save">Move money</button>`,
    onMount: el => el.querySelector('#tr-save').onclick = async () => {
      const amt = r2(num(el, '#tr-amt')), f = val(el, '#tr-from'), t = val(el, '#tr-to');
      if (!(amt > 0) || !f || !t || f === t) return toast('Choose two different accounts and an amount.', 'bad');
      const d = val(el, '#tr-d') || todayISO(), ds = val(el, '#tr-ds') || 'Transfer', pair = uid();
      const A = accs();
      await saveLedger({ d, a: f, amt: isLiab(A[f]) ? amt : -amt, ty: 'transfer', ds: ds + ' → ' + A[t].n, src: 'ledger', pair });
      await saveLedger({ d, a: t, amt: isLiab(A[t]) ? -amt : amt, ty: 'transfer', ds: ds + ' ← ' + A[f].n, src: 'ledger', pair });
      toast('Moved ' + fmt(amt)); closeSheet();
    },
  });
}
export function sheetAccount(id) {
  const a: any = id ? accs()[id] : { t: 'savings', ow: 'J', od: todayISO().slice(0, 4) + '-01-01', open: 0 };
  openSheet({
    title: id ? 'Edit ' + a.n : 'New account',
    body: `<div class="field"><label for="ac-n">Name</label><input id="ac-n" class="inp" value="${esc(a.n || '')}" ${id ? '' : 'autofocus'}></div>
      <div class="f2"><div class="field"><label for="ac-t">Type</label><select id="ac-t" class="inp">${Object.entries(ACC_TYPES).map(([k, n]) => `<option value="${k}" ${k === a.t ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="ac-ow">Belongs to</label><select id="ac-ow" class="inp">${[['P', pname('P')], ['M', pname('M')], ['J', 'Both of us']].map(([k, n]) => `<option value="${k}" ${k === a.ow ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
      <div class="field"><label for="ac-bank">Bank / where it’s held</label><input id="ac-bank" class="inp" value="${esc(a.bank || a.held || '')}"></div>
      <div class="f2"><div class="field"><label for="ac-open">Opening balance${isLiab(a) ? ' (owing)' : ''}</label><input id="ac-open" class="inp num" inputmode="decimal" value="${a.open ?? ''}" placeholder="Leave blank if unknown"></div>
      <div class="field"><label for="ac-od">Opening date</label><input id="ac-od" class="inp" type="date" value="${a.od || ''}"></div></div>
      <div class="f2"><div class="field"><label for="ac-goal">Goal amount</label><input id="ac-goal" class="inp num" inputmode="decimal" value="${a.goal ?? ''}"></div>
      <div class="field"><label for="ac-gd">Goal date</label><input id="ac-gd" class="inp" type="date" value="${a.gd || ''}"></div></div>
      <div class="field"><label for="ac-pot">Pot (savings and goals)</label><select id="ac-pot" class="inp"><option value="">Automatic – from the linked budget lines</option>${POTS.map(p => `<option value="${p.k}" ${a.pot === p.k ? 'selected' : ''}>${p.n} · ${p.d}</option>`).join('')}</select></div>
      <div class="f2"><div class="field"><label for="ac-lim">Credit limit</label><input id="ac-lim" class="inp num" inputmode="decimal" value="${a.limit ?? ''}"></div>
      <div class="field"><label for="ac-rate">Interest % a year</label><input id="ac-rate" class="inp num" inputmode="decimal" value="${a.rate ?? ''}"></div></div>
      <div class="field"><label for="ac-note">Notes</label><textarea id="ac-note" class="inp">${esc(a.note || '')}</textarea></div>
      <label class="toggle" style="margin-bottom:8px"><input type="checkbox" id="ac-bf" ${a.bf !== false ? 'checked' : ''}> Linked budget lines move this balance</label>
      <p class="small muted" style="margin:0 0 10px">Turn this off for accounts you keep up to date by importing statements, so nothing is counted twice.</p>
      <label class="toggle"><input type="checkbox" id="ac-closed" ${a.closed ? 'checked' : ''}> Closed</label>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="ac-save">Save account</button>`,
    onMount: el => el.querySelector('#ac-save').onclick = async () => {
      const n = val(el, '#ac-n'); if (!n) return toast('Give the account a name.', 'bad');
      const o: any = { ...a, n, t: val(el, '#ac-t'), ow: val(el, '#ac-ow'), bank: val(el, '#ac-bank'), note: val(el, '#ac-note'), bf: el.querySelector('#ac-bf').checked, closed: el.querySelector('#ac-closed').checked };
      const openRaw = val(el, '#ac-open'); o.open = openRaw === '' ? null : r2(num(el, '#ac-open'));
      o.od = val(el, '#ac-od') || null;
      ['goal', 'limit', 'rate'].forEach(f => { const v = val(el, '#ac-' + (f === 'limit' ? 'lim' : f)); o[f] = v === '' ? null : r2(parseFloat(v)); });
      o.gd = val(el, '#ac-gd') || null;
      o.pot = val(el, '#ac-pot') || null;
      if (o.t === 'bank' && o.track === undefined) o.track = false;
      const nid = id || slug(n) + '-' + Math.random().toString(36).slice(2, 5);
      await saveAccount(nid, o); toast('Saved ' + n); closeSheet();
    },
  });
}
