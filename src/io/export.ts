/* ===================== Excel export and JSON backup (from prototype io.js) ===================== */
import { balances } from '../calc/balances';
import { msCalc } from '../calc/milestones';
import { liveTxns, monthCalc } from '../calc/month';
import { shares } from '../calc/people';
import { planCalc } from '../calc/plan';
import { yearCalc } from '../calc/year';
import { ACC_TYPES, GMAP, GROUPS, MONTHS, SECTIONS } from '../core/constants';
import { fmtDate, mName, mShort, r2, sum, todayISO } from '../core/format';
import { accs, cat, main, monthKeys, pname, S } from '../core/state';
import { loadXLSX, saveFile } from './files';
import { toast } from '../ui/sheet';
import { curMonth } from '../ui/shell';

export function monthSheetAOA(k) {
  const mc = monthCalc(k);
  const aoa: any[] = [['', 'Planning', 'Budget', 'Actual', 'Variance', 'Notes', 'Who', pname('P'), pname('M')], ['', mName(k)]];
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
export async function exportExcel() {
  let X: any; try { X = await loadXLSX(); } catch (e) { return toast(e.message, 'bad'); }
  toast('Building your workbook…');
  const wb = X.utils.book_new();
  const add = (name, aoa, widths) => { const ws = X.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name.replace(/[\[\]:*?/\\]/g, '').slice(0, 31)); };
  const years = [...new Set(monthKeys().map(k => k.slice(0, 4)))];
  years.forEach(y => {
    const Y = yearCalc(y), aoa: any[] = [['Pa-Nashe Monthly Tracker ' + y], [], ['', ...MONTHS.map(m => m.slice(0, 3).toUpperCase()), 'TOTAL']];
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
  const tx: any[] = [['Date', 'Budget month', 'Line item', 'Category', 'Amount', 'Store / payee', 'Paid from', 'Paid by', 'Note', 'Source']];
  monthKeys().forEach(mk => liveTxns(S.months[mk]).sort((a, b) => (a.d || '').localeCompare(b.d || '')).forEach(t => tx.push([t.d, mk, cat()[t.it]?.n || t.it, GMAP[cat()[t.it]?.g]?.n || '', t.amt, t.store || '', accs()[t.pay as string]?.n || '', t.by ? pname(t.by) : '', t.note || '', t.src || ''])));
  add('Transactions', tx, [11, 10, 40, 30, 12, 26, 26, 9, 40, 9]);
  const B = balances();
  add('Accounts', [['Account', 'Type', 'Belongs to', 'Balance', 'Goal', 'Limit', 'Needs check', 'Notes'], ...Object.values(B).map(r => [r.a.n, ACC_TYPES[r.a.t], r.a.ow === 'J' ? 'Joint' : pname(r.a.ow), r.known ? r.bal : 'not set', r.a.goal || null, r.a.limit || null, r.needsCheck ? 'Yes' : '', r.a.note || ''])], [34, 26, 11, 13, 11, 10, 11, 60]);
  const led: any[] = [['Date', 'Account', 'Type', 'Description', 'Amount', 'Balance after', 'Source']];
  Object.values(B).forEach(r => [...r.ev].reverse().forEach(e => led.push([e.d, r.a.n, e.ty || e.src, e.ty === 'check' ? 'Balance confirmed' : e.ds, e.ty === 'check' ? e.bal : e.amt, e.run, e.src])));
  add('Account history', led, [11, 32, 11, 52, 12, 13, 10]);
  Object.entries(S.ms).forEach(([id]) => {
    const c = msCalc(id); if (!c) return;
    const aoa: any[] = [[c.m.n], [fmtDate(c.m.start) + (c.m.end ? ' – ' + fmtDate(c.m.end) : ''), c.m.usd ? 'R' + c.m.usd + '/US$' : ''], [], ['Line', 'Group', 'Type', 'Planned (R)', 'Actual (R)', 'Variance']];
    c.lines.forEach(l => aoa.push([l.n, l.grp || '', l.sec === 'income' ? 'Funding' : 'Cost', r2(l.bz), r2(l.az), r2(l.sec === 'income' ? l.az - l.bz : l.bz - l.az)]));
    aoa.push([], ['Payments'], ['Date', 'Line', 'Amount', 'Currency', 'Rand', 'Note']);
    c.tx.forEach(t => aoa.push([t.d, c.m.lines?.[t.l]?.n || '', t.amt, t.cur, r2(t.zar), t.note || '']));
    add('MS ' + c.m.n, aoa, [44, 22, 10, 13, 13, 30]);
  });
  const buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
  await saveFile(`Pa-Nashe Tracker ${todayISO()}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
export async function backup() {
  const data = { exported: new Date().toISOString(), config: S.cfg, months: S.months, milestones: S.ms };
  await saveFile(`Pa-Nashe Tracker backup ${todayISO()}.json`, JSON.stringify(data, null, 1));
}
