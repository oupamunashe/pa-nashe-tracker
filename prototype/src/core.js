/* ===================== Pa-Nashe Tracker · core ===================== */
const GROUPS = [
  { k: 'earned', n: 'Earned Income', sec: 'in' },
  { k: 'funding', n: 'Other Funding (drawdowns & loans)', sec: 'in' },
  { k: 'lt', n: 'Long-Term Savings & Investments (10yrs+)', sec: 'sav' },
  { k: 'it', n: 'Intermediate Savings & Investments (1-3yrs)', sec: 'sav' },
  { k: 'st', n: 'Short-Term Savings & Investments (0-12months)', sec: 'sav' },
  { k: 'protection', n: 'Protection and Insurances', sec: 'exp' },
  { k: 'housing', n: 'Housing Bills & Utilities', sec: 'exp' },
  { k: 'household', n: 'Household and Personal Expenses', sec: 'exp' },
  { k: 'health', n: 'Health & Wellness', sec: 'exp' },
  { k: 'debt', n: 'Debt & Repayments', sec: 'exp' },
  { k: 'onceoff', n: 'Other & Once-off Misc Expenses', sec: 'exp' },
  { k: 'family', n: 'Family & Relationships', sec: 'exp' },
  { k: 'giving', n: 'Giving', sec: 'exp' },
  { k: 'ownerloan', n: "Owner's Loan to Business", sec: 'exp' },
];
const GMAP = Object.fromEntries(GROUPS.map((g, i) => [g.k, { ...g, i }]));
const SECTIONS = [
  { k: 'in', n: 'Income' }, { k: 'sav', n: 'Savings & Investments' }, { k: 'exp', n: 'Expenses' },
];
const BUCKETS = [
  { k: 'retire', n: 'Retirement & long-term (RA, TFSA)', cat: 'savings', save: true },
  { k: 'emergency', n: 'Emergency fund (incl. La Vie reserve)', cat: 'savings', save: true },
  { k: 'goals', n: 'Goals (baby, car, stokvels, travel)', cat: 'savings', save: true },
  { k: 'sultana', n: 'Sultana home (rent, electricity, WiFi)', cat: 'house' },
  { k: 'lavie', n: 'La Vie Estate net cost', cat: 'house' },
  { k: 'household', n: 'Household and Personal', cat: 'household' },
  { k: 'protection', n: 'Protection and Insurances', cat: 'health' },
  { k: 'health', n: 'Health & Wellness', cat: 'health' },
  { k: 'debt', n: 'Debts & Repayment', cat: 'debt' },
  { k: 'family', n: 'Family & Relationships', cat: 'other' },
  { k: 'giving', n: 'Giving', cat: 'other' },
  { k: 'onceoff', n: 'Other & Once-off Misc', cat: 'other' },
  { k: 'ownerloan', n: "Owner's Loan to Business", cat: 'other' },
];
const SUMCATS = [
  { k: 'savings', n: 'Savings' }, { k: 'house', n: 'House Bills & Utilities' }, { k: 'household', n: 'Household and Personal' },
  { k: 'health', n: 'Health, Wellness & Protection' }, { k: 'debt', n: 'Debts & Repayment' }, { k: 'other', n: 'Other Expenses' },
];
const ACC_TYPES = {
  savings: 'Savings & investments', goal: 'Goal (earmarked)', credit: 'Credit card / store account',
  loan: 'Loan', bank: 'Everyday account', lent: 'Money lent out',
};
const LIAB = new Set(['credit', 'loan']);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function lsGet(k) { try { return localStorage.getItem(k) || null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const S = {
  db: null, user: null, downloads: null, assets: null,
  cfg: { main: null, catalog: null, accounts: null },
  months: {}, ms: {}, loaded: { config: false, months: false, ms: false },
  ver: 0, canWrite: true, offline: false,
  ui: { view: 'home', month: null, year: null, yearMode: 'act', acc: null, msId: null, people: 'b' },
  me: lsGet('pn_me'),
};

/* ---------------- utils ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round((+n || 0) * 100) / 100;
const sum = (a, f = x => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
function fmt(n, dp = 2) {
  n = +n || 0;
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (n < -0.004 ? '–R' : 'R') + s;
}
const fmt0 = n => fmt(n, 0);
const pct = (n, dp = 0) => (isFinite(n) ? (n * 100).toFixed(dp) : '0') + '%';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const mkey = d => String(d).slice(0, 7);
const mName = k => MONTHS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
const mShort = k => MONTHS[+k.slice(5, 7) - 1].slice(0, 3);
function nextKey(k) { let y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); }
function prevKey(k) { let y = +k.slice(0, 4), m = +k.slice(5, 7) - 1; if (m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); }
function fmtDate(d) { if (!d) return ''; const [y, m, dd] = d.split('-'); return +dd + ' ' + MONTHS[+m - 1].slice(0, 3) + (y !== String(new Date().getFullYear()) ? ' ' + y : ''); }
const slug = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || uid();
const pname = w => (S.cfg.main?.people?.[w]?.n) || (w === 'P' ? 'Piepie' : w === 'M' ? 'Munny' : 'Joint');

const cat = () => S.cfg.catalog?.items || {};
const accs = () => S.cfg.accounts?.accounts || {};
const main = () => S.cfg.main || {};
const kindOf = g => GMAP[g]?.sec || 'exp';
const itemKind = id => kindOf(cat()[id]?.g);
const monthKeys = () => Object.keys(S.months).filter(k => S.months[k]).sort();
const isLiab = a => LIAB.has(a?.t);

let memo = {};
function cached(key, fn) { if (memo.__v !== S.ver) memo = { __v: S.ver }; if (!(key in memo)) memo[key] = fn(); return memo[key]; }

/* ---------------- database layer ---------------- */
const queues = {};
function enqueue(path, fn) {
  const p = (queues[path] || Promise.resolve()).then(fn, fn);
  queues[path] = p.catch(() => {});
  return p;
}
async function dbWrite(path, op, data) {
  if (!S.db) { toast('Not connected – open this from claude.ai to save.', 'bad'); throw new Error('offline'); }
  if (!S.canWrite) { toast('You have view-only access to this tracker.', 'bad'); throw new Error('readonly'); }
  return enqueue(path, async () => {
    try { await S.db.doc(path)[op](data); }
    catch (e) {
      if (e?.code === 'invalid_argument' && /permission|write|level/i.test(e.message || '')) S.canWrite = false;
      if (e?.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); return S.db.doc(path)[op](data); }
      toast('Could not save: ' + (e?.message || e?.code || 'unknown error'), 'bad');
      throw e;
    }
  });
}
async function ensureMonth(k, extra = {}) {
  if (S.months[k]) return;
  const body = { y: +k.slice(0, 4), m: +k.slice(5, 7), lines: {}, txns: {}, ledger: {}, ...extra };
  S.months[k] = body; S.ver++;
  await dbWrite('months/' + k, 'set', body);
}
async function saveTxn(t, id = uid(), oldMonth = null) {
  const k = t.mo;
  if (oldMonth && oldMonth !== k) await deleteTxn(oldMonth, id);
  if (!S.months[k]) await ensureMonth(k, { txns: { [id]: t } });
  else await dbWrite('months/' + k, 'update', { txns: { [id]: t } });
  return id;
}
async function deleteTxn(k, id) { await dbWrite('months/' + k, 'update', { txns: { [id]: null } }); }
async function saveLine(k, itemId, line) {
  await ensureMonth(k);
  await dbWrite('months/' + k, 'update', { lines: { [itemId]: line } });
}
async function removeLine(k, itemId) { await dbWrite('months/' + k, 'update', { lines: { [itemId]: null } }); }
async function saveLedger(e, id = uid()) {
  if (!e.at) e = { ...e, at: Date.now() };
  const k = mkey(e.d);
  if (!S.months[k]) await ensureMonth(k, { ledger: { [id]: e } });
  else await dbWrite('months/' + k, 'update', { ledger: { [id]: e } });
  return id;
}
async function deleteLedger(k, id) { await dbWrite('months/' + k, 'update', { ledger: { [id]: null } }); }
async function saveItem(id, item) { await dbWrite('config/catalog', 'update', { items: { [id]: item } }); }
async function saveAccount(id, a) { await dbWrite('config/accounts', 'update', { accounts: { [id]: a } }); }
async function saveMain(patch) { await dbWrite('config/main', 'update', patch); }
async function saveMs(id, patch, full = false) { await dbWrite('milestones/' + id, full ? 'set' : 'update', patch); }

function subscribe() {
  const onErr = what => e => { console.warn(what, e); if (e?.code === 'revoked') { S.offline = true; render(); } };
  S.db.collection('config').onSnapshot(snap => {
    snap.docs.forEach(d => { S.cfg[d.id] = d.exists ? d.data() : null; });
    S.loaded.config = true; S.ver++; scheduleRender();
  }, onErr('config'));
  S.db.collection('months').onSnapshot(snap => {
    const seen = {};
    snap.docs.forEach(d => { if (d.exists) { S.months[d.id] = d.data(); seen[d.id] = 1; } });
    Object.keys(S.months).forEach(k => { if (!seen[k]) delete S.months[k]; });
    S.loaded.months = true; S.ver++; scheduleRender();
  }, onErr('months'));
  S.db.collection('milestones').onSnapshot(snap => {
    S.ms = {}; snap.docs.forEach(d => { if (d.exists) S.ms[d.id] = d.data(); });
    S.loaded.ms = true; S.ver++; scheduleRender();
  }, onErr('milestones'));
}

/* ---------------- month calculations ---------------- */
const liveTxns = doc => Object.entries(doc?.txns || {}).filter(([, t]) => t && t.it).map(([id, t]) => ({ id, ...t }));
const liveLedger = doc => Object.entries(doc?.ledger || {}).filter(([, e]) => e && e.a).map(([id, e]) => ({ id, ...e }));
const FUND_ACC = a => a && ['savings', 'goal', 'credit', 'loan'].includes(a.t);

function monthCalc(k) {
  return cached('m:' + k, () => {
    const doc = S.months[k] || { lines: {}, txns: {} };
    const txns = liveTxns(doc);
    const ids = new Set(Object.keys(doc.lines || {}).filter(i => doc.lines[i]));
    txns.forEach(t => ids.add(t.it));
    const lines = [...ids].map(id => {
      const it = cat()[id] || { n: '(removed line item)', g: 'onceoff', o: 9999 };
      const L = (doc.lines || {})[id] || {};
      const tx = txns.filter(t => t.it === id).sort((a, b) => (b.d || '').localeCompare(a.d || ''));
      return { id, it, g: it.g, k: kindOf(it.g), b: +L.b || 0, act: r2(sum(tx, t => t.amt)), tx, al: L.al || [], rec: !!L.rec, paid: !!L.paid, note: L.note || '', inMonth: !!(doc.lines || {})[id] };
    }).sort((a, b) => (GMAP[a.g]?.i ?? 99) - (GMAP[b.g]?.i ?? 99) || (a.it.o || 0) - (b.it.o || 0));
    const auto = {};
    txns.forEach(t => {
      if (itemKind(t.it) === 'in' || !t.pay) return;
      const a = accs()[t.pay]; if (!FUND_ACC(a)) return;
      auto[t.pay] = r2((auto[t.pay] || 0) + (+t.amt || 0));
    });
    const T = { b: {}, a: {} };
    ['earned', 'funding', 'sav', 'exp'].forEach(x => { T.b[x] = 0; T.a[x] = 0; });
    const G = {};
    lines.forEach(l => {
      const key = l.k === 'in' ? l.g : l.k;
      T.b[key] += l.b; T.a[key] += l.act;
      G[l.g] = G[l.g] || { b: 0, a: 0 }; G[l.g].b += l.b; G[l.g].a += l.act;
    });
    T.a.auto = r2(sum(Object.values(auto)));
    T.b.auto = 0;
    for (const x of ['b', 'a']) {
      T[x].income = r2(T[x].earned + T[x].funding + T[x].auto);
      T[x].out = r2(T[x].sav + T[x].exp);
      T[x].surplus = r2(T[x].income - T[x].out);
    }
    return { k, doc, lines, txns, auto, T, G };
  });
}

/* ---------------- allocation (Piepie / Munny) ---------------- */
function shares(line, total, basis) {
  // basis 'b' uses rand amounts as entered; 'a' scales rand amounts to the actual
  const out = { P: 0, M: 0, U: 0 };
  if (!total) return out;
  const al = line.al || [];
  if (!al.length) { out.U = total; return out; }
  const amtTotal = sum(al.filter(x => x.u === 'amt'), x => x.v);
  const scale = basis === 'a' && line.b ? total / line.b : 1;
  let used = 0;
  al.forEach(x => {
    const v = x.u === 'pct' ? total * (+x.v || 0) / 100 : (+x.v || 0) * (basis === 'a' ? scale : 1);
    out[x.w] = (out[x.w] || 0) + v; used += v;
  });
  if (basis === 'b' && amtTotal && !al.some(x => x.u === 'pct')) used = amtTotal;
  out.U = r2(total - used);
  if (Math.abs(out.U) < 0.01) out.U = 0;
  return out;
}
function peopleCalc(k, basis) {
  return cached('p:' + k + basis, () => {
    const mc = monthCalc(k);
    const R = { P: { inc: 0, out: 0, lines: [] }, M: { inc: 0, out: 0, lines: [] }, U: { inc: 0, out: 0, lines: [] } };
    mc.lines.forEach(l => {
      const tot = basis === 'b' ? l.b : l.act;
      if (!tot) return;
      const sh = shares(l, tot, basis);
      ['P', 'M', 'U'].forEach(w => {
        if (!sh[w]) return;
        if (l.k === 'in') R[w].inc += sh[w]; else R[w].out += sh[w];
        R[w].lines.push({ l, v: r2(sh[w]) });
      });
    });
    if (basis === 'a') Object.entries(mc.auto).forEach(([aid, v]) => {
      const w = accs()[aid]?.ow; const who = w === 'P' || w === 'M' ? w : 'U';
      R[who].inc += v; R[who].lines.push({ l: { it: { n: 'Paid from ' + (accs()[aid]?.n || aid) + ' (auto)' }, k: 'in', id: 'auto-' + aid }, v });
    });
    Object.values(R).forEach(x => { x.inc = r2(x.inc); x.out = r2(x.out); x.left = r2(x.inc - x.out); });
    return R;
  });
}

/* ---------------- account balances ---------------- */
function balances() {
  return cached('bal', () => {
    const A = accs(), R = {};
    Object.entries(A).forEach(([id, a]) => { R[id] = { id, a, ev: [] }; });
    for (const k of monthKeys()) {
      const doc = S.months[k];
      liveTxns(doc).forEach(t => {
        const it = cat()[t.it]; if (!it) return;
        (it.fl || []).forEach(f => {
          const a = A[f.a]; if (!a || a.bf === false) return;
          R[f.a].ev.push({ d: t.d, at: t.at || 0, amt: r2(f.x * f.s * t.amt), ds: it.n + (t.store ? ' · ' + t.store : ''), src: 'budget', mo: k, tid: t.id });
        });
        if (t.pay && A[t.pay]) {
          const a = A[t.pay]; const dir = itemKind(t.it) === 'in' ? 1 : -1;
          R[t.pay].ev.push({ d: t.d, at: t.at || 0, amt: r2((isLiab(a) ? -dir : dir) * t.amt), ds: (t.store || it.n) + (dir < 0 ? '' : ' (received)'), src: 'paid', mo: k, tid: t.id });
        }
      });
      liveLedger(doc).forEach(e => { if (R[e.a]) R[e.a].ev.push({ d: e.d, at: e.at || 0, amt: +e.amt || 0, ds: e.ds, ty: e.ty, bal: e.bal, src: e.src || 'ledger', mo: k, lid: e.id }); });
    }
    Object.values(R).forEach(r => {
      const a = r.a;
      const od = a.od || '0000';
      r.ev = r.ev.filter(e => (e.d || '') >= od).sort((x, y) => (x.d || '').localeCompare(y.d || '') || (x.at || 0) - (y.at || 0) || (x.ty === 'check') - (y.ty === 'check'));
      let known = a.open !== null && a.open !== undefined, bal = known ? +a.open : 0, delta = 0, lastCheck = null;
      r.ev.forEach(e => {
        if (e.ty === 'check') { e.adj = known ? r2(e.bal - bal) : null; bal = +e.bal; known = true; lastCheck = e; }
        else { bal = r2(bal + e.amt); delta = r2(delta + e.amt); }
        e.run = known ? r2(bal) : null;
      });
      r.known = known; r.bal = known ? r2(bal) : null; r.delta = delta; r.lastCheck = lastCheck;
      r.needsCheck = !!a.chk && !lastCheck && !a.closed;
      r.ev.reverse();
    });
    return R;
  });
}

/* ---------------- plan / scenarios ---------------- */
function planCalc(k, sid) {
  return cached('plan:' + k + sid, () => {
    const m = main(); const sc = m.scen?.[sid] || { b: {} }; const base = +m.planBase || 0;
    const mc = monthCalc(k);
    const lavieRent = sum(mc.lines.filter(l => /^la vie rentals?$/i.test(l.it.n)), l => l.act);
    const actBase = r2(mc.T.a.earned - lavieRent);
    const act = {};
    BUCKETS.forEach(b => act[b.k] = 0);
    mc.lines.forEach(l => { if (l.it.pb && act[l.it.pb] !== undefined) act[l.it.pb] += l.act; });
    act.lavie -= lavieRent;
    const rows = BUCKETS.map(b => {
      const [p, fx] = sc.b?.[b.k] || [0, 0];
      const plan = r2(p * base + (+fx || 0));
      const a = r2(act[b.k]);
      let status;
      if (!actBase) status = 'No actual yet';
      else if (b.save) status = a >= plan ? 'On target' : 'Below target';
      else status = a <= plan ? 'Within plan' : 'Over plan';
      return { ...b, plan, planPct: base ? plan / base : 0, act: a, actPct: actBase ? a / actBase : 0, diff: r2(a - plan), status };
    });
    const cats = SUMCATS.map(c => {
      const rs = rows.filter(r => r.cat === c.k);
      const plan = sum(rs, r => r.plan), a = sum(rs, r => r.act);
      return { ...c, plan, act: a, planPct: base ? plan / base : 0, actPct: actBase ? a / actBase : 0, save: c.k === 'savings' };
    });
    const saved = cats[0].act, drawn = r2(mc.T.a.funding + mc.T.a.auto);
    return { base, actBase, rows, cats, planTotal: sum(rows, r => r.plan), actTotal: sum(rows, r => r.act), drawn, net: r2(saved - drawn), netRate: actBase ? (saved - drawn) / actBase : 0, savePlan: cats[0].plan, saveRate: actBase ? saved / actBase : 0 };
  });
}
const pmt = (rate, n, pv) => rate ? pv * rate / (1 - Math.pow(1 + rate, -n)) : pv / n;

/* ---------------- year aggregation ---------------- */
function yearCalc(y) {
  return cached('y:' + y, () => {
    const keys = MONTHS.map((_, i) => y + '-' + String(i + 1).padStart(2, '0'));
    const items = {}; const tot = keys.map(() => ({ b: { earned: 0, funding: 0, auto: 0, sav: 0, exp: 0, income: 0, out: 0, surplus: 0 }, a: { earned: 0, funding: 0, auto: 0, sav: 0, exp: 0, income: 0, out: 0, surplus: 0 } }));
    keys.forEach((k, i) => {
      if (!S.months[k]) return;
      const mc = monthCalc(k);
      tot[i] = mc.T;
      mc.lines.forEach(l => {
        items[l.id] = items[l.id] || { id: l.id, it: l.it, g: l.g, b: Array(12).fill(0), a: Array(12).fill(0) };
        items[l.id].b[i] += l.b; items[l.id].a[i] += l.act;
      });
    });
    return { y, keys, items: Object.values(items).sort((a, b) => (GMAP[a.g]?.i ?? 99) - (GMAP[b.g]?.i ?? 99) || (a.it.o || 0) - (b.it.o || 0)), tot };
  });
}

/* ---------------- milestones ---------------- */
function msCalc(id) {
  return cached('ms:' + id, () => {
    const m = S.ms[id]; if (!m) return null;
    const rate = +m.usd || 0;
    const toZ = (amt, cur) => cur === 'USD' ? (+amt || 0) * rate : (+amt || 0);
    const tx = Object.entries(m.txns || {}).filter(([, t]) => t).map(([tid, t]) => ({ id: tid, ...t, zar: toZ(t.amt, t.cur) }));
    const lines = Object.entries(m.lines || {}).filter(([, l]) => l).map(([lid, l]) => {
      const lt = tx.filter(t => t.l === lid);
      return { id: lid, ...l, bz: toZ(l.b, l.cur), az: r2(sum(lt, t => t.zar)), tx: lt };
    }).sort((a, b) => (a.sec === b.sec ? 0 : a.sec === 'income' ? -1 : 1) || (a.o || 0) - (b.o || 0));
    const inc = lines.filter(l => l.sec === 'income'), exp = lines.filter(l => l.sec !== 'income');
    return { m, rate, lines, tx, inc: { b: sum(inc, l => l.bz), a: sum(inc, l => l.az) }, exp: { b: sum(exp, l => l.bz), a: sum(exp, l => l.az) } };
  });
}
