/* ===================== UI · sheets & actions ===================== */
const sheetStack = [];
function openSheet({ title, body, foot = '', onMount, refresh, wide }) {
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'max-width:900px' : ''}">
    <div class="sheet-h"><h2>${esc(title)}</h2><button class="btn ghost sm" data-a="closesheet" aria-label="Close">${I.x}</button></div>
    <div class="sheet-b">${body}</div>${foot ? `<div class="sheet-f">${foot}</div>` : ''}</div>`;
  el.addEventListener('mousedown', e => { if (e.target === el) closeSheet(); });
  $('#sheets').appendChild(el);
  const rec = { el, refresh, onMount };
  sheetStack.push(rec);
  onMount && onMount(el);
  setTimeout(() => { const f = el.querySelector('[autofocus]'); f && f.focus(); }, 60);
  return el;
}
function closeSheet() { const s = sheetStack.pop(); if (s) s.el.remove(); }
function closeAll() { while (sheetStack.length) closeSheet(); }
function refreshSheet() { const s = sheetStack[sheetStack.length - 1]; if (s && s.refresh && !s.el.contains(document.activeElement)) s.refresh(s.el); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetStack.length) closeSheet(); });
let toastT;
function toast(msg, cls = '') {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2800);
}
const val = (el, sel) => el.querySelector(sel)?.value?.trim() ?? '';
const num = (el, sel) => { const v = parseFloat(String(val(el, sel)).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; };

/* ---------- item picker (used by capture & add line) ---------- */
function recentItems(n = 8) {
  const counts = {};
  monthKeys().slice(-3).forEach(k => liveTxns(S.months[k]).forEach(t => { if (t.src !== 'import') counts[t.it] = (counts[t.it] || 0) + 1; }));
  const everyday = ['groceries', 'fuel-piepie', 'dates', 'dischem-clicks-expenses', 'miscellaneous-expenses', 'our-pocket-money', 'home-improvements', 'wife-maintenance'];
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return [...new Set([...ranked, ...everyday])].filter(id => cat()[id] && !cat()[id].arch && itemKind(id) !== 'in').slice(0, n);
}
function pickerHTML(q, selected, kinds) {
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
function wirePicker(root, state, kinds, onPick) {
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
function newItemInline(name, kinds, done) {
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
      const it = { n, g, o: Math.max(0, ...Object.values(cat()).map(x => x?.o || 0)) + 1 };
      if (el.querySelector('#ni-r').checked) it.rec = true;
      const b = BUCKETS.find(b => b.k === g) || (g === 'lt' ? { k: 'retire' } : ['it', 'st'].includes(g) ? { k: 'goals' } : g === 'housing' ? { k: n.startsWith('La Vie') ? 'lavie' : 'sultana' } : null);
      if (b) it.pb = b.k;
      S.cfg.catalog.items[id] = it; S.ver++;
      await saveItem(id, it); closeSheet(); toast('Added ' + n); done(id);
    },
  });
}

/* ---------- capture / edit transaction ---------- */
function accOptions(sel, filter) {
  const A = accs();
  const groups = [['bank', 'Everyday accounts'], ['credit', 'Credit & store accounts'], ['savings', 'Savings'], ['goal', 'Goals'], ['loan', 'Loans']];
  return `<option value="">Not recorded</option>` + groups.map(([t, n]) => {
    const as = Object.entries(A).filter(([, a]) => a.t === t && !a.closed && (!filter || filter(a)));
    return as.length ? `<optgroup label="${n}">${as.map(([id, a]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(a.n)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function sheetTxn({ k, id, it: presetItem } = {}) {
  const editing = id ? S.months[k]?.txns?.[id] : null;
  const st = { it: editing?.it || presetItem || null };
  const t = editing || {};
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
      ${S.assets ? `<div class="field"><label for="tx-rc">Receipt photo</label><input id="tx-rc" type="file" accept="image/*,application/pdf" class="inp">${t.rc ? `<a class="small" href="/_blob/${esc(t.rc)}" target="_blank" rel="noopener">View attached receipt</a>` : ''}</div>` : ''}
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
        const nt = { d: dIn.value || todayISO(), mo: moIn.value, it: st.it, amt, src: t.src === 'import' ? 'import' : (t.src || 'app'), at: t.at || Date.now() };
        const store = val(el, '#tx-store'), note = val(el, '#tx-note'), pay = val(el, '#tx-pay');
        if (store) nt.store = store; if (note) nt.note = note; if (pay) nt.pay = pay; if (by) nt.by = by;
        if (t.rc) nt.rc = t.rc;
        const f = el.querySelector('#tx-rc')?.files?.[0];
        const btn = el.querySelector('#tx-save'); btn.disabled = true;
        try {
          if (f && S.assets) { try { const r = await S.assets.upload(f); nt.rc = r.id; } catch (e) { toast('Receipt not attached: ' + (e?.message || e?.code), 'bad'); } }
          lsSet('pn_lastpay', pay);
          await saveTxn(nt, id || uid(), editing ? k : null);
          toast(`Saved ${fmt(amt)} to ${cat()[st.it]?.n} · ${mShort(nt.mo)}`);
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

/* ---------- line detail: budget, split, entries ---------- */
function sheetLine(k, id) {
  const draw = () => {
    const mc = monthCalc(k); const l = mc.lines.find(x => x.id === id) || { id, it: cat()[id] || { n: '?' }, b: 0, act: 0, tx: [], al: [], k: itemKind(id), g: cat()[id]?.g };
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
  function mount(el, again) {
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
      const line = { b: r2(num(el, '#ln-b')), al: splits.filter(s => +s.v).map(s => { const o = { w: s.w, v: r2(s.v), u: s.u || 'amt' }; if (s.lb) o.lb = s.lb; return o; }), rec: el.querySelector('#ln-rec').checked, note: val(el, '#ln-note') };
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
async function markPaid(k, id) {
  const l = monthCalc(k).lines.find(x => x.id === id); if (!l) return;
  const d = mkey(todayISO()) === k ? todayISO() : k + '-28';
  const by = l.al?.length === 1 ? l.al[0].w : (S.me || undefined);
  const t = { d, mo: k, it: id, amt: l.b, src: 'app', note: 'Marked paid', at: Date.now() }; if (by) t.by = by;
  await saveTxn(t); toast(`Marked ${l.it.n} paid · ${fmt(l.b)}`);
}
function sheetAddLine(k) {
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
        const line = { b: r2(num(el, '#al-b')) }; if (cat()[st.it]?.rec) line.rec = true;
        await saveLine(k, st.it, line); toast('Added ' + cat()[st.it].n); closeSheet();
      };
    },
  });
}
async function startMonth(nk) {
  const last = monthKeys().slice(-1)[0]; const src = S.months[last];
  if (S.months[nk]) { S.ui.month = nk; render(); return; }
  const lines = {};
  Object.entries(src?.lines || {}).forEach(([id, L]) => {
    if (!L) return; const it = cat()[id]; if (!it || it.arch) return;
    if (!(L.rec || it.rec) && (it.g === 'onceoff' || !(+L.b))) return;
    const n = { b: +L.b || 0 }; if (L.al?.length) n.al = L.al; if (L.rec || it.rec) n.rec = true;
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
function sheetWho() {
  openSheet({
    title: 'Who’s using this device?',
    body: `<p class="muted">New entries will be marked as paid by you. You can change it on each entry.</p>
      <div class="grid2">${['P', 'M'].map(w => `<button class="person ${w}" data-me="${w}" style="text-align:left;cursor:pointer"><div class="big">${esc(pname(w))}</div></button>`).join('')}</div>`,
    onMount: el => el.querySelectorAll('[data-me]').forEach(b => b.onclick = () => { S.me = b.dataset.me; lsSet('pn_me', S.me); closeSheet(); render(); }),
  });
}

/* ---------- accounts ---------- */
function sheetLedger(accId, entry) {
  const a = accs()[accId], liab = isLiab(a);
  const e = entry || {};
  const dirIn = e.amt === undefined ? true : e.amt >= 0;
  openSheet({
    title: (entry ? 'Edit entry · ' : 'Add entry · ') + a.n,
    body: `<div class="amtbox"><span>R</span><input id="le-amt" inputmode="decimal" placeholder="0.00" value="${e.amt !== undefined ? Math.abs(e.amt) : ''}" autofocus></div>
      <div class="field"><span class="lab">Direction</span><div class="seg" id="le-dir"><button type="button" data-v="1" aria-pressed="${dirIn}">${liab ? 'Owing goes up' : 'Money in'}</button><button type="button" data-v="-1" aria-pressed="${!dirIn}">${liab ? 'Owing goes down' : 'Money out'}</button></div></div>
      <div class="f2"><div class="field"><label for="le-ty">Type</label><select id="le-ty" class="inp">${['deposit', 'withdrawal', 'interest', 'fee', 'spend', 'repayment', 'transfer', 'other'].map(t => `<option ${t === e.ty ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
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
function sheetCheck(accId) {
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
function sheetTransfer(fromId) {
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
function sheetAccount(id) {
  const a = id ? accs()[id] : { t: 'savings', ow: 'J', od: todayISO().slice(0, 4) + '-01-01', open: 0 };
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
      <div class="f2"><div class="field"><label for="ac-lim">Credit limit</label><input id="ac-lim" class="inp num" inputmode="decimal" value="${a.limit ?? ''}"></div>
      <div class="field"><label for="ac-rate">Interest % a year</label><input id="ac-rate" class="inp num" inputmode="decimal" value="${a.rate ?? ''}"></div></div>
      <div class="field"><label for="ac-note">Notes</label><textarea id="ac-note" class="inp">${esc(a.note || '')}</textarea></div>
      <label class="toggle" style="margin-bottom:8px"><input type="checkbox" id="ac-bf" ${a.bf !== false ? 'checked' : ''}> Linked budget lines move this balance</label>
      <p class="small muted" style="margin:0 0 10px">Turn this off for accounts you keep up to date by importing statements, so nothing is counted twice.</p>
      <label class="toggle"><input type="checkbox" id="ac-closed" ${a.closed ? 'checked' : ''}> Closed</label>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="ac-save">Save account</button>`,
    onMount: el => el.querySelector('#ac-save').onclick = async () => {
      const n = val(el, '#ac-n'); if (!n) return toast('Give the account a name.', 'bad');
      const o = { ...a, n, t: val(el, '#ac-t'), ow: val(el, '#ac-ow'), bank: val(el, '#ac-bank'), note: val(el, '#ac-note'), bf: el.querySelector('#ac-bf').checked, closed: el.querySelector('#ac-closed').checked };
      const openRaw = val(el, '#ac-open'); o.open = openRaw === '' ? null : r2(num(el, '#ac-open'));
      o.od = val(el, '#ac-od') || null;
      ['goal', 'limit', 'rate'].forEach(f => { const v = val(el, '#ac-' + (f === 'limit' ? 'lim' : f)); o[f] = v === '' ? null : r2(parseFloat(v)); });
      o.gd = val(el, '#ac-gd') || null;
      if (o.t === 'bank' && o.track === undefined) o.track = false;
      const nid = id || slug(n) + '-' + Math.random().toString(36).slice(2, 5);
      await saveAccount(nid, o); toast('Saved ' + n); closeSheet();
    },
  });
}

/* ---------- line item editor ---------- */
function sheetItem(id) {
  const it = id ? { ...cat()[id] } : { n: '', g: 'household', fl: [] };
  let fl = (it.fl || []).map(f => ({ ...f }));
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

/* ---------- trend for a line item ---------- */
function sheetTrend(id) {
  const y = S.ui.year || monthKeys().slice(-1)[0]?.slice(0, 4); const Y = yearCalc(y);
  const x = Y.items.find(i => i.id === id); if (!x) return;
  openSheet({
    title: x.it.n, wide: true,
    body: `<p class="muted small">${esc(GMAP[x.g]?.n || '')} · ${y}. Comparing across years arrives with the 2024 and 2025 import.</p>
      <div class="legend" style="margin:6px 0"><span><i style="background:var(--line)"></i>Budget</span><span><i style="background:var(--brand)"></i>Actual</span></div>
      <div class="chart">${barChart([{ n: 'Budget', c: 'var(--line)', v: x.b }, { n: 'Actual', c: 'var(--brand)', v: x.a }], Y.keys.map(mShort), { label: x.it.n + ' by month' })}</div>
      <div class="kpis" style="margin-top:12px"><div class="kpi"><span>Total actual</span><b>${fmt0(sum(x.a))}</b></div><div class="kpi"><span>Total budget</span><b>${fmt0(sum(x.b))}</b></div>
      <div class="kpi"><span>Monthly average</span><b>${fmt0(sum(x.a) / Math.max(1, x.a.filter((v, i) => S.months[Y.keys[i]]).length))}</b></div><div class="kpi"><span>Highest month</span><b>${fmt0(Math.max(...x.a))}</b></div></div>`,
  });
}

/* ---------- milestones ---------- */
function sheetMsEdit(id) {
  const m = id ? S.ms[id] : { n: '', st: 'active', start: todayISO(), usd: null };
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
        const tpl = { trip: [['Flights', 'Transportation'], ['Car hire', 'Transportation'], ['Accommodation', 'Stay'], ['Food & eating out', 'Stay'], ['Activities', 'Stay'], ['Gifts', 'Other']], event: [['Venue', 'Event'], ['Food & drinks', 'Event'], ['Outfits', 'Event'], ['Gifts', 'Event'], ['Travel', 'Travel']], blank: [] }[val(el, '#ms-tpl')];
        const lines = {}; tpl.forEach(([ln, g], i) => { lines['l' + (i + 1)] = { n: ln, sec: 'expense', grp: g, b: 0, cur: 'ZAR', o: i + 1 }; });
        const nid = slug(n) + '-' + Math.random().toString(36).slice(2, 5);
        const body = { ...patch, lines, txns: {}, files: [], o: 0 }; S.ms[nid] = body; S.ver++;
        await saveMs(nid, body, true);
        closeSheet(); S.ui.msId = nid; S.ui.view = 'milestone'; render(); toast('Created ' + n);
      };
      const del = el.querySelector('#ms-del');
      del && (del.onclick = async () => { if (!confirm('Delete this milestone and its payments?')) return; await S.db.doc('milestones/' + id).delete(); closeAll(); S.ui.view = 'milestones'; render(); });
    },
  });
}
function sheetMsLine(id, lid) {
  const m = S.ms[id], l = lid ? m.lines[lid] : { n: '', sec: 'expense', grp: '', b: 0, cur: 'ZAR' };
  const grps = [...new Set(Object.values(m.lines || {}).filter(Boolean).map(x => x.grp).filter(Boolean))];
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
function sheetMsTxn(id, tid, presetLine) {
  const m = S.ms[id], t = tid ? m.txns[tid] : { d: todayISO(), cur: 'ZAR', l: presetLine };
  const lines = Object.entries(m.lines || {}).filter(([, l]) => l);
  if (!lines.length) return toast('Add a line to this milestone first.', 'bad');
  openSheet({
    title: tid ? 'Edit payment' : 'Add payment · ' + m.n,
    body: `<div class="amtbox"><span>${t.cur === 'USD' ? '$' : 'R'}</span><input id="mt-amt" inputmode="decimal" placeholder="0.00" value="${t.amt ?? ''}" autofocus></div>
      <div class="field"><label for="mt-l">Line</label><select id="mt-l" class="inp">${lines.map(([lid, l]) => `<option value="${lid}" ${lid === t.l ? 'selected' : ''}>${esc(l.n)}${l.sec === 'income' ? ' (funding)' : ''}</option>`).join('')}</select></div>
      <div class="f2"><div class="field"><label for="mt-d">Date</label><input id="mt-d" type="date" class="inp" value="${t.d || todayISO()}"></div>
      <div class="field"><label for="mt-cur">Currency</label><select id="mt-cur" class="inp"><option ${t.cur !== 'USD' ? 'selected' : ''}>ZAR</option>${m.usd ? `<option ${t.cur === 'USD' ? 'selected' : ''}>USD</option>` : ''}</select></div></div>
      <div class="field"><label for="mt-note">Note</label><input id="mt-note" class="inp" value="${esc(t.note || '')}"></div>
      ${S.assets ? `<div class="field"><label for="mt-rc">Receipt</label><input id="mt-rc" type="file" accept="image/*,application/pdf" class="inp">${t.rc ? `<a class="small" href="/_blob/${esc(t.rc)}" target="_blank" rel="noopener">View receipt</a>` : ''}</div>` : ''}
      <p class="small muted">Milestone payments are tracked here. If the money also left your monthly budget, capture it there as well (for example under the trip’s line item).</p>`,
    foot: `${tid ? '<button class="btn danger" id="mt-del">Delete</button><span class="grow"></span>' : ''}<button class="btn primary" id="mt-save">Save payment</button>`,
    onMount: el => {
      const cur = el.querySelector('#mt-cur'); cur.onchange = () => el.querySelector('.amtbox span').textContent = cur.value === 'USD' ? '$' : 'R';
      el.querySelector('#mt-save').onclick = async () => {
        const amt = r2(num(el, '#mt-amt')); if (!(amt > 0)) return toast('Enter an amount above zero.', 'bad');
        const nt = { d: val(el, '#mt-d'), l: val(el, '#mt-l'), amt, cur: cur.value, note: val(el, '#mt-note') };
        if (t.rc) nt.rc = t.rc;
        const f = el.querySelector('#mt-rc')?.files?.[0];
        if (f && S.assets) { try { nt.rc = (await S.assets.upload(f)).id; } catch (e) { toast('Receipt not attached', 'bad'); } }
        await saveMs(id, { txns: { [tid || uid()]: nt } }); toast('Saved ' + fmt(amt)); closeSheet();
      };
      const del = el.querySelector('#mt-del'); del && (del.onclick = async () => { await saveMs(id, { txns: { [tid]: null } }); closeSheet(); });
    },
  });
}
async function msAttach(id, file) {
  if (!S.assets || !file) return;
  try {
    toast('Uploading ' + file.name + '…');
    const r = await S.assets.upload(file);
    const files = [...(S.ms[id].files || []), { id: r.id, n: file.name, d: todayISO() }];
    await saveMs(id, { files }); toast('Attached ' + file.name);
  } catch (e) { toast('Could not attach: ' + (e?.message || e?.code), 'bad'); }
}

/* ---------- settings ---------- */
function sheetSettings() {
  const p = main().people || {};
  const theme = document.documentElement.dataset.theme || 'auto';
  openSheet({
    title: 'Settings',
    body: `<h3 style="margin-bottom:8px">Names</h3>
      ${['P', 'M'].map(w => `<div class="f2"><div class="field"><label>Name in the app</label><input class="inp" data-pn="${w}.n" value="${esc(p[w]?.n || '')}"></div><div class="field"><label>Name on bank statements</label><input class="inp" data-pn="${w}.full" value="${esc(p[w]?.full || '')}"></div></div>
        <div class="field"><label>Other names that appear on statements (comma-separated)</label><input class="inp" data-pn="${w}.alias" value="${esc(p[w]?.alias || '')}"></div>`).join('')}
      <p class="small muted">Statement import uses these names to tell who paid for each row.</p>
      <h3 style="margin:8px 0">This device</h3>
      <div class="row wrap" style="margin-bottom:14px"><span>Using it:</span><b>${S.me ? esc(pname(S.me)) : 'not set'}</b><button class="btn sm" id="st-who">Change</button></div>
      <div class="field"><span class="lab">Appearance</span><div class="seg" id="st-theme">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${theme === v}">${n}</button>`).join('')}</div></div>`,
    foot: `<button class="btn" data-a="closesheet">Close</button><button class="btn primary" id="st-save">Save names</button>`,
    onMount: el => {
      el.querySelector('#st-who').onclick = () => { closeSheet(); sheetWho(); };
      el.querySelectorAll('#st-theme button').forEach(b => b.onclick = () => {
        const v = b.dataset.v; if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
        lsSet('pn_theme', v);
        el.querySelectorAll('#st-theme button').forEach(x => x.setAttribute('aria-pressed', x === b));
      });
      el.querySelector('#st-save').onclick = async () => {
        const people = JSON.parse(JSON.stringify(p));
        el.querySelectorAll('[data-pn]').forEach(i => { const [w, f] = i.dataset.pn.split('.'); people[w] = people[w] || {}; people[w][f] = i.value.trim(); });
        await saveMain({ people }); toast('Saved'); closeSheet();
      };
    },
  });
}
