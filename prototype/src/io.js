/* ===================== import · export · wiring ===================== */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxP;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxP || (xlsxP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = XLSX_URL; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxP = null; rej(new Error('Could not load the Excel library')); }; document.head.appendChild(s); }));
}
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
function normDate(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  const s = String(v || '').trim(); let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/))) { const mi = MONTHS.findIndex(x => x.slice(0, 3).toLowerCase() === m[2].toLowerCase()); if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
function rowsToStatement(rows) {
  const hi = rows.findIndex(r => r.some(c => /date/i.test(c)) && r.some(c => /amount|debit|credit/i.test(c)));
  if (hi < 0) throw new Error('Couldn’t find the Date and Amount columns in this file.');
  const h = rows[hi].map(c => String(c).trim());
  const f = re => h.findIndex(c => re.test(c));
  const iD = f(/value date|^date/i) >= 0 ? f(/value date|^date/i) : f(/date/i), iDs = f(/description|details|narrative|reference/i), iB = f(/beneficiary|cardholder/i), iT = f(/^type$|transaction type/i);
  const iA = f(/^amount|amount$/i), iDr = f(/debit/i), iCr = f(/credit/i);
  return rows.slice(hi + 1).map(r => {
    const d = normDate(r[iD]); if (!d) return null;
    let amt = iA >= 0 ? parseFloat(String(r[iA]).replace(/[^0-9.\-]/g, '')) : (parseFloat(String(r[iCr] || 0).replace(/[^0-9.\-]/g, '')) || 0) - Math.abs(parseFloat(String(r[iDr] || 0).replace(/[^0-9.\-]/g, '')) || 0);
    if (!isFinite(amt) || !amt) return null;
    return { d, amt: r2(amt), ty: iT >= 0 ? String(r[iT] || '').trim() : '', ds: String(r[iDs] ?? '').trim(), ben: iB >= 0 ? String(r[iB] ?? '').trim() : '' };
  }).filter(Boolean);
}
function suggestItem(text) {
  const T = text.toUpperCase();
  const hit = (main().rules || []).find(([kw]) => kw && T.includes(String(kw).toUpperCase()));
  return hit && cat()[hit[1]] ? hit[1] : null;
}
function personFromText(text) {
  const P = main().people || {}, T = ' ' + String(text || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const toks = w => [...String(P[w]?.full || '').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/), ...String(P[w]?.alias || '').toUpperCase().split(/[,\s]+/)].filter(x => x.length > 1);
  const tp = toks('P'), tm = toks('M');
  const shared = tp.filter(x => tm.includes(x));
  const hits = ['P', 'M'].filter(w => {
    const own = (w === 'P' ? tp : tm), uniq = own.filter(x => !shared.includes(x));
    if (uniq.some(x => T.includes(' ' + x + ' '))) return true;
    const given = String(P[w]?.full || '').toUpperCase().replace(/\(.*?\)/g, ' ').split(/\s+/).filter(x => x.length > 1 && !shared.includes(x));
    const ini = given.map(x => x[0]).join('');
    return !!ini && shared.some(sn => T.includes(' ' + ini + ' ' + sn + ' '));
  });
  return hits.length === 1 ? hits[0] : null;
}
function matchAccount(text, selfId) {
  const t = text.toLowerCase().replace(/^(from|to):\s*/, '').trim(); if (!t) return null;
  const A = accs();
  const exact = Object.entries(A).find(([id, a]) => id !== selfId && (a.n.toLowerCase() === t || (a.bank || '').toLowerCase().includes(t)));
  if (exact) return exact[0];
  const digits = t.match(/\d{6,}/); if (digits) { const hit = Object.entries(A).find(([id, a]) => (a.bank || '').includes(digits[0].slice(-4))); if (hit) return hit[0]; }
  const part = Object.entries(A).find(([id, a]) => id !== selfId && a.n.toLowerCase().includes(t));
  return part ? part[0] : null;
}
function classify(rows, accId) {
  const A = accs(), a = A[accId], liab = isLiab(a), B = balances();
  const ledgerHave = (B[accId]?.ev || []).filter(e => e.lid);
  const txHave = [];
  monthKeys().forEach(k => liveTxns(S.months[k]).forEach(t => { if (t.pay === accId) txHave.push(t); }));
  const used = new Set();
  return rows.map((r, i) => {
    const eff = liab ? -r.amt : r.amt;
    const text = r.ds + ' ' + r.ben;
    if (a.od && r.d < a.od) return { ...r, i, eff, st: 'before', act: 'skip', note: 'Before this account’s opening balance (' + fmtDate(a.od) + ')' };
    const dup = ledgerHave.find(e => e.d === r.d && Math.abs(e.amt - eff) < 0.01 && !used.has('l' + e.lid));
    if (dup) { used.add('l' + dup.lid); return { ...r, i, eff, st: 'dup', act: 'skip', note: 'Already in this account' }; }
    const cap = txHave.find(t => !used.has('t' + t.id) && Math.abs(t.amt - Math.abs(r.amt)) < 0.01 && Math.abs((new Date(t.d) - new Date(r.d)) / 864e5) <= 3);
    if (cap) { used.add('t' + cap.id); return { ...r, i, eff, st: 'captured', act: 'skip', note: 'Captured on ' + fmtDate(cap.d) + ' as ' + (cat()[cap.it]?.n || '') }; }
    const ty = r.ty.toLowerCase();
    if (/interest/.test(ty) || /interest/i.test(r.ds)) return { ...r, i, eff, st: 'interest', act: 'ledger', lty: 'interest' };
    if (ty === 'fee' || /\bfee\b|premium/i.test(r.ds)) return { ...r, i, eff, st: 'fee', act: 'ledger', lty: 'fee', it: suggestItem(text) };
    const other = /^(from|to):/i.test(r.ben) ? matchAccount(r.ben, accId) : null;
    if (/transfer/.test(ty) || /^(from|to):/i.test(r.ben)) return { ...r, i, eff, st: 'transfer', act: 'ledger', lty: 'transfer', other, note: other ? (r.amt < 0 ? 'To ' : 'From ') + A[other].n : r.ben };
    const it = suggestItem(text);
    if (r.amt < 0 && it) return { ...r, i, eff, st: 'spend', act: 'budget', it };
    return { ...r, i, eff, st: r.amt < 0 ? 'spend' : 'money in', act: r.amt < 0 ? 'budget' : 'ledger', it, lty: r.amt < 0 ? 'spend' : 'deposit' };
  });
}
function itemOptions(sel) {
  return `<option value="">Choose line item…</option>` + GROUPS.map(g => {
    const its = Object.entries(cat()).filter(([, it]) => it && !it.arch && it.g === g.k).sort((a, b) => (a[1].o || 0) - (b[1].o || 0));
    return its.length ? `<optgroup label="${esc(g.n)}">${its.map(([id, it]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(it.n)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function sheetImport(accId) {
  let rows = null, acc = accId || '';
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
        const a = accs()[acc]; const byMonth = {}; const newRules = [];
        for (const r of rows) {
          if (r.act === 'skip') continue;
          const mo = mkey(r.d); byMonth[mo] = byMonth[mo] || { ledger: {}, txns: {} };
          if (r.act === 'budget') {
            if (!r.it) { toast('Choose a line item for every budget entry.', 'bad'); return; }
            const t = { d: r.d, mo, it: r.it, amt: Math.abs(r.amt), store: r.ds.slice(0, 80), pay: acc, src: 'statement', at: Date.now() };
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
          for (const [mo, body] of Object.entries(byMonth)) {
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

/* ---------- export ---------- */
async function saveFile(filename, data) {
  if (!S.downloads) { toast('Downloads work when the tracker is opened from claude.ai.', 'bad'); return; }
  try { await S.downloads.save({ filename, data }); toast('Saved ' + filename); }
  catch (e) { if (e?.code !== 'declined' && e?.code !== 'cancelled') toast('Download didn’t complete: ' + (e?.message || e?.code), 'bad'); }
}
function monthSheetAOA(k) {
  const mc = monthCalc(k);
  const aoa = [['', 'Planning', 'Budget', 'Actual', 'Variance', 'Notes', 'Who', pname('P'), pname('M')], ['', mName(k)]];
  const lineRowX = l => {
    const sb = shares(l, l.b, 'b');
    const v = l.k === 'in' ? l.act - l.b : l.b - l.act;
    return ['', l.it.n, l.b || null, l.act || null, r2(v) || null, l.note || '', (l.al || []).map(x => x.w).join(''), r2(sb.P) || null, r2(sb.M) || null];
  };
  SECTIONS.forEach(s => {
    const T = mc.T;
    aoa.push(['', s.n.toUpperCase(), s.k === 'in' ? T.b.earned + T.b.funding : T.b[s.k], s.k === 'in' ? T.a.income : T.a[s.k]]);
    GROUPS.filter(g => g.sec === s.k).forEach(g => {
      const ls = mc.lines.filter(l => l.g === g.k); if (!ls.length) return;
      aoa.push(['', g.n, r2(sum(ls, l => l.b)), r2(sum(ls, l => l.act))]);
      ls.forEach(l => aoa.push(lineRowX(l)));
    });
    if (s.k === 'in') Object.entries(mc.auto).forEach(([a, v]) => aoa.push(['', 'From ' + (accs()[a]?.n || a) + ' (paid directly)', null, v]));
    aoa.push([]);
  });
  aoa.push(['', 'Surplus/Deficit', mc.T.b.surplus, mc.T.a.surplus, r2(mc.T.a.surplus - mc.T.b.surplus)]);
  return aoa;
}
async function exportExcel() {
  let X; try { X = await loadXLSX(); } catch (e) { return toast(e.message, 'bad'); }
  toast('Building your workbook…');
  const wb = X.utils.book_new();
  const add = (name, aoa, widths) => { const ws = X.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name.replace(/[\[\]:*?/\\]/g, '').slice(0, 31)); };
  const years = [...new Set(monthKeys().map(k => k.slice(0, 4)))];
  years.forEach(y => {
    const Y = yearCalc(y), aoa = [['Pa-Nashe Monthly Tracker ' + y], [], ['', ...MONTHS.map(m => m.slice(0, 3).toUpperCase()), 'TOTAL']];
    SECTIONS.forEach(s => {
      aoa.push([s.n.toUpperCase()]);
      GROUPS.filter(g => g.sec === s.k).forEach(g => {
        const its = Y.items.filter(x => x.g === g.k && sum(x.a)); if (!its.length) return;
        aoa.push([g.n]); its.forEach(x => aoa.push([x.it.n, ...x.a.map(v => r2(v) || null), r2(sum(x.a))]));
      });
      aoa.push(['TOTAL ' + s.n.toUpperCase(), ...Y.tot.map(t => s.k === 'in' ? t.a.income : t.a[s.k]), r2(sum(Y.tot, t => s.k === 'in' ? t.a.income : t.a[s.k]))], []);
    });
    aoa.push(['SURPLUS / DEFICIT', ...Y.tot.map(t => t.a.surplus), r2(sum(Y.tot, t => t.a.surplus))]);
    add('Overview ' + y, aoa, [48, ...Array(13).fill(11)]);
  });
  const k = curMonth(), P = planCalc(k, main().scenario || '1');
  add('Plan ' + mShort(k) + ' ' + k.slice(0, 4), [['Scenario ' + (main().scenario || '1') + ' – ' + (main().scen?.[main().scenario || '1']?.name || '')], ['Plan base income', P.base], [],
    ['Category', 'Target %', 'Plan', 'Actual', 'Actual %', 'Over/(under)', 'Status'], ...P.rows.map(r => [r.n, r2(r.planPct * 100), r.plan, r.act, r2(r.actPct * 100), r.diff, r.status]),
    [], ['Drawdowns & loans', '', 0, P.drawn], ['Net savings', '', P.savePlan, P.net, r2(P.netRate * 100)]], [44, 10, 12, 12, 10, 12, 14]);
  monthKeys().forEach(mk => add(MONTHS[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4) + ' Budget', monthSheetAOA(mk), [2, 52, 12, 12, 12, 50, 6, 11, 11]));
  const tx = [['Date', 'Budget month', 'Line item', 'Category', 'Amount', 'Store / payee', 'Paid from', 'Paid by', 'Note', 'Source']];
  monthKeys().forEach(mk => liveTxns(S.months[mk]).sort((a, b) => (a.d || '').localeCompare(b.d || '')).forEach(t => tx.push([t.d, mk, cat()[t.it]?.n || t.it, GMAP[cat()[t.it]?.g]?.n || '', t.amt, t.store || '', accs()[t.pay]?.n || '', t.by ? pname(t.by) : '', t.note || '', t.src || ''])));
  add('Transactions', tx, [11, 10, 40, 30, 12, 26, 26, 9, 40, 9]);
  const B = balances();
  add('Accounts', [['Account', 'Type', 'Belongs to', 'Balance', 'Goal', 'Limit', 'Needs check', 'Notes'], ...Object.values(B).map(r => [r.a.n, ACC_TYPES[r.a.t], r.a.ow === 'J' ? 'Joint' : pname(r.a.ow), r.known ? r.bal : 'not set', r.a.goal || null, r.a.limit || null, r.needsCheck ? 'Yes' : '', r.a.note || ''])], [34, 26, 11, 13, 11, 10, 11, 60]);
  const led = [['Date', 'Account', 'Type', 'Description', 'Amount', 'Balance after', 'Source']];
  Object.values(B).forEach(r => [...r.ev].reverse().forEach(e => led.push([e.d, r.a.n, e.ty || e.src, e.ty === 'check' ? 'Balance confirmed' : e.ds, e.ty === 'check' ? e.bal : e.amt, e.run, e.src])));
  add('Account history', led, [11, 32, 11, 52, 12, 13, 10]);
  Object.entries(S.ms).forEach(([id]) => {
    const c = msCalc(id); if (!c) return;
    const aoa = [[c.m.n], [fmtDate(c.m.start) + (c.m.end ? ' – ' + fmtDate(c.m.end) : ''), c.m.usd ? 'R' + c.m.usd + '/US$' : ''], [], ['Line', 'Group', 'Type', 'Planned (R)', 'Actual (R)', 'Variance']];
    c.lines.forEach(l => aoa.push([l.n, l.grp || '', l.sec === 'income' ? 'Funding' : 'Cost', r2(l.bz), r2(l.az), r2(l.sec === 'income' ? l.az - l.bz : l.bz - l.az)]));
    aoa.push([], ['Payments'], ['Date', 'Line', 'Amount', 'Currency', 'Rand', 'Note']);
    c.tx.forEach(t => aoa.push([t.d, c.m.lines?.[t.l]?.n || '', t.amt, t.cur, r2(t.zar), t.note || '']));
    add('MS ' + c.m.n, aoa, [44, 22, 10, 13, 13, 30]);
  });
  const buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
  await saveFile(`Pa-Nashe Tracker ${todayISO()}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
async function backup() {
  const data = { exported: new Date().toISOString(), config: S.cfg, months: S.months, milestones: S.ms };
  await saveFile(`Pa-Nashe Tracker backup ${todayISO()}.json`, JSON.stringify(data, null, 1));
}

/* ---------- event wiring ---------- */
const ACT = {
  nav: d => { S.ui.view = d.v; S.ui.scrollTop = true; closeAll(); render(); },
  month: d => { S.ui.month = d.k; render(); },
  capture: () => sheetTxn(),
  who: () => sheetWho(),
  line: d => sheetLine(d.k, d.id),
  txn: d => sheetTxn({ k: d.k, id: d.id }),
  markpaid: (d, el, e) => { e.stopPropagation(); markPaid(d.k, d.id); },
  scen: d => saveMain({ scenario: d.s }),
  planscen: d => { S.ui.planScen = d.s; render(); },
  setdefscen: d => saveMain({ scenario: d.s }).then(() => toast('Scenario ' + d.s + ' is now the default')),
  addline: d => sheetAddLine(d.k),
  startmonth: d => startMonth(d.k),
  togglegrp: (d, el) => { const c = S.ui.collapsed || (S.ui.collapsed = {}); c[d.g] = !c[d.g]; el.parentElement.dataset.open = c[d.g] ? '0' : '1'; },
  bfilter: d => { S.ui.bfilter = d.v; render(); },
  pbasis: d => { S.ui.people = d.v; render(); },
  openacc: d => { S.ui.acc = d.id; S.ui.view = 'account'; S.ui.accLimit = 60; S.ui.scrollTop = true; render(); },
  check: d => sheetCheck(d.id),
  ledger: d => sheetLedger(d.id),
  ledgerentry: d => {
    const e = S.months[d.k]?.ledger?.[d.id]; if (!e) return;
    if (e.ty === 'check') { if (confirm('Remove this balance confirmation?')) deleteLedger(d.k, d.id).then(() => toast('Removed')); return; }
    sheetLedger(e.a, { ...e, id: d.id });
  },
  editacc: d => sheetAccount(d.id),
  newacc: () => sheetAccount(null),
  transfer: () => sheetTransfer(S.ui.view === 'account' ? S.ui.acc : ''),
  import: d => sheetImport(d.id || (S.ui.view === 'account' ? S.ui.acc : '')),
  toggleclosed: () => { S.ui.showClosed = !S.ui.showClosed; render(); },
  morehist: () => { S.ui.accLimit = (S.ui.accLimit || 60) + 100; render(); },
  ymode: d => { S.ui.yearMode = d.v; render(); },
  trend: d => sheetTrend(d.id),
  openms: d => { S.ui.msId = d.id; S.ui.view = 'milestone'; S.ui.scrollTop = true; render(); },
  newms: () => sheetMsEdit(null),
  msedit: d => sheetMsEdit(d.id),
  msline: d => sheetMsLine(d.id, d.l),
  mstxn: d => sheetMsTxn(d.id, d.t),
  export: () => exportExcel(),
  backup: () => backup(),
  settings: () => sheetSettings(),
  edititem: d => sheetItem(d.id || null),
  closesheet: () => closeSheet(),
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const fn = ACT[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el.dataset, el, e);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-a]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-a="yearsel"]')) { S.ui.year = t.value; render(); }
  if (t.matches('[data-a="msfile"]')) msAttach(t.dataset.id, t.files[0]);
  if (t.matches('[data-calc]')) {
    const v = parseFloat(t.value); if (!isFinite(v)) return;
    if (t.dataset.calc === '__base') { saveMain({ planBase: v }); return; }
    const [grp, key] = t.dataset.calc.split('.');
    saveMain({ calc: { [grp]: { [key]: v } } });
  }
  if (t.matches('[data-scen]')) {
    const [sid, b] = t.dataset.scen.split('.'); const cur = main().scen?.[sid]?.b?.[b] || [0, 0];
    const v = parseFloat(t.value); if (!isFinite(v)) return;
    saveMain({ scen: { [sid]: { b: { [b]: [v / 100, cur[1] || 0] } } } });
  }
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-a="itemsearch"]')) { S.ui.itemq = e.target.value; const pos = e.target.selectionStart; render(); const n = $('[data-a="itemsearch"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
});

/* ---------- init ---------- */
async function init() {
  const th = lsGet('pn_theme'); if (th && th !== 'auto') document.documentElement.dataset.theme = th;
  shell();
  const cl = window.claude;
  if (!cl || typeof cl.use !== 'function') { S.offline = true; render(); return; }
  const [db, user, dl, as] = await Promise.all(['db', 'user', 'downloads', 'assets'].map(n => cl.use(n).catch(() => null)));
  if (!db) { S.offline = true; render(); return; }
  Object.assign(S, { db, user, downloads: dl, assets: as });
  if (user) { try { if (await user.can('data.write') === false) S.canWrite = false; } catch (e) {} }
  subscribe();
  const wait = setInterval(() => {
    if (ready()) { clearInterval(wait); if (!S.me) sheetWho(); }
  }, 300);
  setTimeout(() => { if (!ready()) { const m = $('#main'); if (m) m.innerHTML = '<div class="loading"><div><h2>Still connecting…</h2><p class="muted">Your data is taking longer than usual to load. Check your connection; the page will fill in as soon as it arrives.</p></div></div>'; } }, 15000);
}
init();
