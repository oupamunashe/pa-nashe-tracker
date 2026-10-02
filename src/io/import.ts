/* ===================== statement import (from prototype io.js) ===================== */
import { classify, parseCSV, personFromText, rowsToStatement } from '../calc/statement';
import { GROUPS } from '../core/constants';
import { esc, fmt, fmtDate, mkey, sum, uid } from '../core/format';
import { accs, cat, main, S } from '../core/state';
import { dbWrite, ensureMonth, saveMain } from '../data/db';
import { loadXLSX } from './files';
import { closeSheet, num, openSheet, toast, val } from '../ui/sheet';
import { accOptions } from '../ui/sheets/picker';

export function itemOptions(sel) {
  return `<option value="">Choose line item…</option>` + GROUPS.map(g => {
    const its = Object.entries(cat()).filter(([, it]) => it && !it.arch && it.g === g.k).sort((a, b) => (a[1].o || 0) - (b[1].o || 0));
    return its.length ? `<optgroup label="${esc(g.n)}">${its.map(([id, it]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(it.n)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
export function sheetImport(accId) {
  let rows: any = null, acc = accId || '';
  const el = openSheet({
    title: 'Import a statement', wide: true,
    body: `<div class="f2"><div class="field"><label for="im-acc">Which account is this statement for?</label><select id="im-acc" class="inp">${accOptions(acc, a => a.t !== 'goal')}</select></div>
      <div class="field"><label for="im-file">Statement file</label><input id="im-file" type="file" class="inp" accept=".csv,.xlsx,.xls,.pdf"></div></div>
      <p class="small muted">Discovery CSV and Excel exports work today. PDF statements (FNB, African Bank) are read by Claude in Prototype 2.</p>
      <div id="im-out"></div>`,
    foot: `<span class="small muted grow" id="im-sum"></span><button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="im-go" disabled>Save selected</button>`,
    onMount: el => {
      const out = el.querySelector('#im-out'), go = el.querySelector('#im-go'), summ = el.querySelector('#im-sum');
      const draw = () => {
        if (!rows) return;
        const counts = { skip: 0, ledger: 0, budget: 0 }; rows.forEach(r => counts[r.act]++);
        summ.textContent = `${counts.budget} to budget · ${counts.ledger} to account history · ${counts.skip} skipped`;
        go.disabled = !(counts.budget + counts.ledger);
        out.innerHTML = `<div class="panel flush" style="margin-top:8px">${rows.map(r => `
          <div class="imp-row" data-r="${r.i}">
            <div class="small">${fmtDate(r.d)}</div>
            <div><div style="font-weight:600">${esc(r.ds)}</div><div class="small muted">${esc(r.ben)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
            <div class="num right ${r.amt > 0 ? 'pos' : ''}" style="font-weight:650">${fmt(r.amt)}</div>
            <select class="inp sm" data-f="act"><option value="skip" ${r.act === 'skip' ? 'selected' : ''}>Skip</option><option value="ledger" ${r.act === 'ledger' ? 'selected' : ''}>Account history only</option><option value="budget" ${r.act === 'budget' ? 'selected' : ''}>Budget entry</option></select>
            <select class="inp sm ${r.act === 'budget' ? '' : 'hide'}" data-f="it">${itemOptions(r.it)}</select>
          </div>`).join('')}</div>`;
      };
      out.addEventListener('change', e => {
        const row = e.target.closest('[data-r]'); if (!row) return; const r = rows[+row.dataset.r];
        if (e.target.dataset.f === 'act') { r.act = e.target.value; row.querySelector('[data-f="it"]').classList.toggle('hide', r.act !== 'budget'); }
        if (e.target.dataset.f === 'it') { r.userIt = r.it !== e.target.value; r.it = e.target.value; }
        const counts = { skip: 0, ledger: 0, budget: 0 }; rows.forEach(x => counts[x.act]++);
        summ.textContent = `${counts.budget} to budget · ${counts.ledger} to account history · ${counts.skip} skipped`; go.disabled = !(counts.budget + counts.ledger);
      });
      const load = async () => {
        acc = val(el, '#im-acc'); const f = el.querySelector('#im-file').files[0];
        if (!acc || !f) return;
        out.innerHTML = '<div class="loading" style="min-height:120px"><div class="spin"></div></div>';
        try {
          let table;
          if (/\.pdf$/i.test(f.name)) throw new Error('PDF statements arrive in Prototype 2. For Discovery, download the CSV or Excel version instead.');
          if (/\.csv$/i.test(f.name)) table = parseCSV(await f.text());
          else { const X = await loadXLSX(); const wb = X.read(await f.arrayBuffer(), { cellDates: true }); table = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }); }
          rows = classify(rowsToStatement(table).sort((a, b) => a.d.localeCompare(b.d)), acc);
          if (!rows.length) throw new Error('No transactions found in this file.');
          draw();
        } catch (e) { rows = null; out.innerHTML = `<div class="notice" style="margin-top:8px">${esc(e.message || e)}</div>`; go.disabled = true; summ.textContent = ''; }
      };
      el.querySelector('#im-file').addEventListener('change', load);
      el.querySelector('#im-acc').addEventListener('change', load);
      go.onclick = async () => {
        const a = accs()[acc]; const byMonth: any = {}; const newRules: any[] = [];
        for (const r of rows) {
          if (r.act === 'skip') continue;
          const mo = mkey(r.d); byMonth[mo] = byMonth[mo] || { ledger: {}, txns: {} };
          if (r.act === 'budget') {
            if (!r.it) { toast('Choose a line item for every budget entry.', 'bad'); return; }
            const t: any = { d: r.d, mo, it: r.it, amt: Math.abs(r.amt), store: r.ds.slice(0, 80), pay: acc, src: 'statement', at: Date.now() };
            const who = personFromText(r.ben + ' ' + r.ds) || ((a.ow === 'P' || a.ow === 'M') ? a.ow : null); if (who) t.by = who;
            byMonth[mo].txns[uid()] = t;
            if (r.userIt) { const kw = r.ds.toUpperCase().replace(/[^A-Z ]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' '); if (kw.length > 2) newRules.push([kw, r.it]); }
          } else {
            const e = { d: r.d, at: Date.now() + r.i, a: acc, amt: r.eff, ty: r.lty || (r.eff >= 0 ? 'deposit' : 'withdrawal'), ds: r.ds + (r.ben ? ' · ' + r.ben : ''), src: 'statement' };
            byMonth[mo].ledger[uid()] = e;
          }
        }
        go.disabled = true; go.textContent = 'Saving…';
        try {
          for (const [mo, body] of Object.entries<any>(byMonth)) {
            if (!S.months[mo]) await ensureMonth(mo, body);
            else await dbWrite('months/' + mo, 'update', body);
          }
          if (newRules.length) await saveMain({ rules: [...(main().rules || []), ...newRules.filter(([k]) => !(main().rules || []).some(r => r[0] === k))] });
          toast('Statement saved'); closeSheet();
        } catch (e) { go.disabled = false; go.textContent = 'Save selected'; }
      };
    },
  });
}
