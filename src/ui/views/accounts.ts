/* ===================== ACCOUNTS (from prototype ui2.js) ===================== */
import { goalProgress, isTfsa, tfsaYear, tfsaYears } from '../../calc/tfsa';
import { balances } from '../../calc/balances';
import { POTS, potOf, potTotals } from '../../calc/pots';
import { ACC_TYPES, MONTHS } from '../../core/constants';
import { esc, fmt, fmt0, fmtDate, pct, sum } from '../../core/format';
import { isLiab, pname, S } from '../../core/state';
import { I } from '../icons';
import { hbar } from '../parts';
import { val } from '../sheet';

export function accRow(r) {
  const a = r.a; const liab = isLiab(a);
  const gp = goalProgress(r);   // TFSA: this tax year's contributions; other goals: the balance
  const goalPct = gp && gp.known ? Math.max(0, Math.min(1, gp.pct)) : null;
  const val = a.t === 'bank' && a.track === false ? '<span class="faint small">not tracked</span>'
    : r.known ? `<span class="${liab ? (r.bal > 0.004 ? 'neg' : 'pos') : (r.bal < -0.004 ? 'neg' : '')}">${fmt(r.bal)}</span>` : '<span class="chip warn">Set balance</span>';
  return `<li class="li" data-a="openacc" data-id="${r.id}">
    <div class="avatar ${a.ow || 'J'}">${a.ow === 'J' ? 'PM' : pname(a.ow)[0]}</div>
    <div class="grow"><div class="t">${esc(a.n)}</div>
      <div class="s">${esc(a.bank || ACC_TYPES[a.t] || '')}${r.needsCheck ? ' · <span class="chip warn">confirm balance</span>' : ''}${a.closed ? ' · closed' : ''}</div>
      ${goalPct !== null ? `<div class="progress-mini" style="max-width:220px"><span style="width:${goalPct * 100}%"></span></div>` : ''}</div>
    <div class="v">${val}${a.goal ? (gp?.taxYear ? `<small>${fmt0(gp.amount)} of ${fmt0(a.goal)} in ${gp.taxYear}</small>` : `<small>goal ${fmt0(a.goal)}</small>`) : liab && a.limit ? `<small>limit ${fmt0(a.limit)}</small>` : ''}</div></li>`;
}
export function viewAccounts() {
  const B = balances(); const all = Object.values(B).filter(r => !r.a.closed || S.ui.showClosed);
  const pot = POTS.some(p => p.k === S.ui.pot) ? S.ui.pot : null;
  const by = t => all.filter(r => r.a.t === t && (!pot || potOf(r.id, r.a) === pot)).sort((x, y) => (x.a.n || '').localeCompare(y.a.n || ''));
  const physical = all.filter(r => r.a.t === 'savings' && r.known && !r.needsCheck), debts = all.filter(r => isLiab(r.a) && r.known && !r.needsCheck);
  const unS = all.filter(r => r.a.t === 'savings' && r.needsCheck).length, unD = all.filter(r => isLiab(r.a) && r.needsCheck && !r.a.closed).length;
  const totS = sum(physical, r => r.bal), totD = sum(debts, r => r.bal);
  const checks = all.filter(r => r.needsCheck);
  const block = (t, title, hint?) => { const rs = by(t); if (!rs.length) return ''; return `<section class="panel flush"><div class="sec-h">${title}<span class="tot small muted">${hint || ''}</span></div><ul class="list">${rs.map(accRow).join('')}</ul></section>`; };
  return `<div class="stack">
    <div class="pagehead"><div><h1>Accounts</h1><p class="muted">Balances update from your budget, captured spends and imported statements.</p></div>
      <div class="row wrap"><button class="btn" data-a="transfer">Move money</button><button class="btn" data-a="import">Import statement</button><button class="btn" data-a="newacc">${I.plus}New account</button></div></div>
    <div class="seg pots" role="group" aria-label="Savings pots"><button data-a="pot" data-p="" aria-pressed="${!pot}">All</button>${POTS.map(p => `<button data-a="pot" data-p="${p.k}" aria-pressed="${pot === p.k}">${p.n}</button>`).join('')}</div>
    ${pot ? potHead(B, pot) : `<div class="kpis">
      <div class="kpi"><span>Savings</span><b>${fmt0(totS)}</b>${unS ? `<span>+ ${unS} to confirm</span>` : ''}</div>
      <div class="kpi"><span>Debt owed</span><b class="neg">${fmt0(totD)}</b>${unD ? `<span>+ ${unD} to confirm</span>` : ''}</div>
      <div class="kpi"><span>Owed to you (business)</span><b>${fmt0(sum(by('lent').filter(r => r.known), r => r.bal))}</b></div>
      <div class="kpi"><span>Balances to confirm</span><b class="${checks.length ? 'neg' : 'pos'}">${checks.length}</b></div>
    </div>`}
    ${checks.length && !pot ? `<div class="notice"><b>Confirm ${checks.length} balance${checks.length > 1 ? 's' : ''}.</b> The spreadsheet didn’t hold enough to know these for sure. Open each one and use <b>Check balance</b> with the figure from your banking app.</div>` : ''}
    ${block('savings', 'Savings & investments', 'actual accounts')}
    ${block('goal', 'Goals', 'money set aside inside other accounts')}
    ${pot ? '' : `${block('credit', 'Credit & store accounts', 'amount owing')}
    ${block('loan', 'Loans', 'amount owing')}
    ${block('lent', 'Money lent out')}
    ${block('bank', 'Everyday accounts', 'used for “paid from”')}`}
    <button class="btn ghost small" data-a="toggleclosed">${S.ui.showClosed ? 'Hide' : 'Show'} closed accounts</button>
  </div>`;
}
export function viewAccount() {
  const id: any = S.ui.acc, r: any = balances()[id]; if (!r) { S.ui.view = 'accounts'; return viewAccounts(); }
  const a = r.a, liab = isLiab(a);
  const limit = S.ui.accLimit || 60;
  const ev = r.ev.slice(0, limit);
  return `<div class="stack">
    <button class="btn ghost sm" data-a="nav" data-v="accounts">${I.back}Accounts</button>
    <div class="pagehead"><div><h1>${esc(a.n)}</h1><p class="muted">${esc(ACC_TYPES[a.t] || '')}${a.bank ? ' · ' + esc(a.bank) : ''} · <span class="chip ${a.ow || 'J'}">${a.ow === 'J' ? 'Joint' : esc(pname(a.ow))}</span></p></div>
      <div class="row wrap">${a.t !== 'bank' || a.track !== false ? `<button class="btn primary" data-a="check" data-id="${id}">Check balance</button>` : ''}
        <button class="btn" data-a="transfer">Move money</button><button class="btn" data-a="ledger" data-id="${id}">Add entry</button><button class="btn" data-a="import" data-id="${id}">Import statement</button><button class="btn" data-a="editacc" data-id="${id}">Edit</button></div></div>
    <section class="panel"><div class="row between wrap">
      ${isTfsa(a) ? tfsaHead(r) : ''}
      <div><div class="small muted">${isTfsa(a) ? 'Balance (all years)' : liab ? 'Amount owing' : a.t === 'lent' ? 'Owed to you' : 'Balance'}</div>
        <div style="font-family:var(--font-d);font-size:${isTfsa(a) ? '1.4rem' : '2.2rem'};font-weight:750" class="amt acc-bal">${r.known ? fmt(r.bal) : 'Not set'}</div>
        ${!r.known ? `<div class="small muted">Movements since ${fmtDate(a.od)}: ${fmt(r.delta)} (${liab ? 'positive = owing went up' : 'positive = money in'})</div>` : ''}
        ${r.lastCheck ? `<div class="small muted">Last confirmed ${fmtDate(r.lastCheck.d)} at ${fmt(r.lastCheck.bal)}</div>` : ''}</div>
      ${a.goal && !isTfsa(a) ? (() => { const gp = goalProgress(r)!; return `<div style="min-width:220px"><div class="row between small"><span>Goal ${fmt0(a.goal)}${a.gd ? ' by ' + fmtDate(a.gd) : ''}</span><b>${gp.known ? pct(gp.pct) : '–'}</b></div>${hbar(gp.known ? gp.pct : 0, 0)}${gp.taxYear ? `<div class="small muted" style="margin-top:4px">${fmt(gp.amount)} contributed in the ${gp.taxYear} tax year (1 Mar – 28 Feb). The balance includes earlier years.</div>` : ''}</div>`; })() : ''}
      ${liab && a.limit && r.known ? `<div style="min-width:220px"><div class="row between small"><span>Used of ${fmt0(a.limit)} limit</span><b>${pct(r.bal / a.limit)}</b></div>${hbar(r.bal / a.limit, 0, 'var(--bad)')}<div class="small muted" style="margin-top:4px">Available ${fmt(a.limit - r.bal)}</div></div>` : ''}
    </div>
    ${r.needsCheck ? `<div class="notice" style="margin-top:12px">${esc(a.chk)}</div>` : ''}
    ${a.note ? `<p class="small muted" style="margin:12px 0 0">${esc(a.note)}</p>` : ''}
    ${a.held ? `<p class="small muted" style="margin:6px 0 0">Held in: ${esc(a.held)}</p>` : ''}
    ${a.bf === false ? `<p class="small muted" style="margin:6px 0 0">This balance follows the bank statement, so budget lines linked to it are shown in the budget but don’t move it twice.</p>` : ''}
    </section>
    <section class="panel flush"><div class="sec-h">History<span class="tot small muted">${r.ev.length} entries</span></div>
      ${ev.length ? `<ul class="list">${ev.map(e => `<li class="li" ${e.lid ? `data-a="ledgerentry" data-k="${e.mo}" data-id="${e.lid}"` : e.tid ? `data-a="txn" data-k="${e.mo}" data-id="${e.tid}"` : ''}>
        <div class="grow"><div class="t">${esc(e.ty === 'check' ? 'Balance confirmed' : e.ds || '')}</div><div class="s">${fmtDate(e.d)} · ${esc({ budget: 'from budget', paid: 'paid from this account', statement: 'statement', ledger: 'ledger', plan: 'plan sheet' }[e.src] || e.src || '')}${e.ty === 'check' && e.adj ? ` · adjusted ${fmt(e.adj)}` : ''}</div></div>
        <div class="v">${e.ty === 'check' ? fmt(e.bal) : `<span class="${(liab ? -e.amt : e.amt) >= 0 ? 'pos' : ''}">${e.amt > 0 ? '+' : ''}${fmt(e.amt)}</span>`}${e.run !== null && e.run !== undefined ? `<small>${fmt(e.run)}</small>` : ''}</div></li>`).join('')}</ul>
        ${r.ev.length > limit ? `<div style="padding:12px"><button class="btn sm" data-a="morehist">Show more</button></div>` : ''}`
        : '<div class="empty" style="margin:0 14px 14px">No movements yet.</div>'}
    </section>
  </div>`;
}

/* One pot picked on Accounts: its total and what's in it. */
function potHead(B, pot) {
  const p: any = potTotals(B, S.ui.showClosed).find(x => x.k === pot);
  return `<div class="kpis three">
      <div class="kpi"><span>${esc(p.n)} · ${esc(p.d)}</span><b>${fmt0(p.total)}</b>${p.toConfirm ? `<span>+ ${p.toConfirm} to confirm</span>` : ''}</div>
      <div class="kpi"><span>Goals set aside in this pot</span><b>${fmt0(p.goals)}</b><span>held inside accounts, not added again</span></div>
      <div class="kpi"><span>Accounts</span><b>${p.rows.length}</b></div>
    </div>`;
}

/* TFSA: the tax year's contributions lead the account card; earlier tax years can be picked to check them
   against that year's statutory limit. The lifetime balance is shown next to it. */
const dayY = (d: string) => `${+d.slice(8)} ${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)} ${d.slice(0, 4)}`;   // always with the year
function tfsaHead(r) {
  const years = tfsaYears(r), sel = years.includes(+S.ui.tfsaYear) ? +S.ui.tfsaYear : years[0], Y = tfsaYear(r, sel);
  const opt = (y, i) => `<option value="${y}" ${y === sel ? 'selected' : ''}>${y}/${y + 1}${i === 0 ? ' · Current' : i === 1 ? ' · Previous' : ''}</option>`;
  const over = Y.amount > Y.limit + 0.004;
  return `<div class="tfsa-head">
    <div class="row between wrap" style="gap:8px"><div class="small muted">Contributed in the ${Y.label} tax year${Y.isCurrent ? ' so far' : ''}</div>
      ${years.length > 1 ? `<select class="inp sm" data-a="tfsayear" aria-label="Tax year">${years.map(opt).join('')}</select>` : ''}</div>
    <div class="tfsa-amt amt">${fmt(Y.amount)}</div>
    <div class="row between small"><span>of ${fmt0(Y.target)} ${Y.isCurrent && r.a.goal ? 'goal' : 'annual limit'}</span><b>${pct(Y.pct, 1)}</b></div>
    ${hbar(Y.pct, 0, over ? 'var(--bad)' : 'var(--brand)')}
    <div class="small muted" style="margin-top:4px">${dayY(Y.start)} – ${dayY(Y.end)}${Y.isCurrent ? ' · settled entries up to today' : ''}${Y.target !== Y.limit ? ` · annual limit ${fmt0(Y.limit)}` : ''}</div>
    ${over ? `<div class="small neg" style="margin-top:4px">More than the ${fmt0(Y.limit)} annual limit – SARS taxes the excess at 40%.</div>` : ''}
    ${Y.recordsFrom ? `<div class="small muted" style="margin-top:4px">The tracker’s records for this account start on ${dayY(Y.recordsFrom)}, so contributions earlier in this tax year aren’t included.</div>` : ''}
  </div>`;
}

