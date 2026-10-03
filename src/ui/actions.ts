/* ---------- event wiring (from prototype io.js): one delegated listener, actions looked up by data-a ---------- */
import { S, main } from '../core/state';
import { deleteLedger, saveMain } from '../data/db';
import { backup, exportExcel } from '../io/export';
import { openFile } from '../io/files';
import { sheetImport } from '../io/import';
import { msAttach, sheetMsEdit, sheetMsLine, sheetMsTxn } from './sheets/milestone';
import { sheetAccount, sheetCheck, sheetLedger, sheetTransfer } from './sheets/accounts';
import { sheetItem } from './sheets/item';
import { markPaid, sheetAddLine, sheetLine, startMonth } from './sheets/line';
import { sheetSettings, sheetWho } from './sheets/settings';
import { sheetTrend } from './sheets/trend';
import { sheetTxn } from './sheets/txn';
import { $, closeAll, closeSheet, toast } from './sheet';
import { render } from './shell';

type Action = (d: any, el: HTMLElement, e: Event) => void;
export const ACT: Record<string, Action> = {
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
  togglegrp: (d, el) => { const c = S.ui.collapsed || (S.ui.collapsed = {}); c[d.g] = !c[d.g]; (el.parentElement as HTMLElement).dataset.open = c[d.g] ? '0' : '1'; },
  bfilter: d => { S.ui.bfilter = d.v; render(); },
  pbasis: d => { S.ui.people = d.v; render(); },
  openacc: d => { S.ui.acc = d.id; S.ui.view = 'account'; S.ui.tfsaYear = null; S.ui.accLimit = 60; S.ui.scrollTop = true; render(); },
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
  pot: d => { S.ui.pot = d.p || null; render(); },
  openpot: d => { S.ui.pot = d.p || null; S.ui.view = 'accounts'; S.ui.scrollTop = true; render(); },
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
  openfile: d => openFile(d.id),          // production: Storage signed URL instead of /_blob/<id>
};
document.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const fn = ACT[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el.dataset, el, e);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).matches?.('[role="button"][data-a]')) { e.preventDefault(); (e.target as HTMLElement).click(); }
});
document.addEventListener('change', e => {
  const t: any = e.target;
  if (t.matches('[data-a="yearsel"]')) { S.ui.year = t.value; render(); }
  if (t.matches('[data-a="monthsel"]')) { S.ui.month = t.value; render(); }
  if (t.matches('[data-a="cmpyear"]')) { S.ui.cmpYear = t.value; render(); }
  if (t.matches('[data-a="tfsayear"]')) { S.ui.tfsaYear = t.value; render(); }
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
  const t: any = e.target;
  if (t.matches('[data-a="itemsearch"]')) { S.ui.itemq = t.value; const pos = t.selectionStart; render(); const n: any = $('[data-a="itemsearch"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
});
