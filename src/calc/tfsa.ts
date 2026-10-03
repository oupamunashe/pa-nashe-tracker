/* ---------------- tax-free savings accounts: goal progress per South African tax year ----------------
   A TFSA's goal (the annual contribution limit) is measured against what went in during the active tax year,
   1 March to 28/29 February – not the lifetime balance. The balance itself is unchanged (see balances.ts).
   Counted as a contribution: money in (budget-linked payments, transfers, deposits). Not counted: growth
   (interest), balance confirmations, and withdrawals – a withdrawal doesn't give back contribution room.
   A ledger entry of type 'correction' fixes a wrongly recorded contribution and counts either way (+ or −). */
import { r2, sum, todayISO } from '../core/format';
import type { Account } from '../core/types';
import type { BalResult } from './balances';

/** A TFSA by its name (“TFSA Piepie”, “Tax-free savings”) or an explicit `tfsa: true` on the account. */
export const isTfsa = (a: Account | undefined | null) => !!a && ((a as any).tfsa === true || /\bTFSA\b|tax[- ]free/i.test(a.n || ''));

/** The SA tax year containing date d (YYYY-MM-DD): from 1 March up to (not including) the next 1 March. */
export function taxYear(d: string) {
  const y = +d.slice(0, 4), m = +d.slice(5, 7);
  const s = m >= 3 ? y : y - 1;
  const leap = (s + 1) % 4 === 0 && ((s + 1) % 100 !== 0 || (s + 1) % 400 === 0);
  return { start: `${s}-03-01`, next: `${s + 1}-03-01`, end: `${s + 1}-02-${leap ? '29' : '28'}`, label: `${s}/${String(s + 1).slice(2)}` };
}

/** Contributions to an account within the tax year containing `today`. */
export function taxYearContributions(r: BalResult, today = todayISO()) {
  const { start, next } = taxYear(today);
  return r2(sum(r.ev.filter(e => (e.d || '') >= start && (e.d || '') < next && e.ty !== 'check' && e.ty !== 'interest' && (e.amt > 0 || e.ty === 'correction')), e => e.amt));
}

/** What a goal bar measures: tax-year contributions for a TFSA, otherwise the balance (as in the prototype). */
export function goalProgress(r: BalResult, today = todayISO()) {
  const a = r.a;
  if (!a.goal) return null;
  if (isTfsa(a)) {
    const amount = taxYearContributions(r, today), ty = taxYear(today);
    return { amount, pct: amount / a.goal, taxYear: ty.label, known: true };
  }
  return { amount: r.bal, pct: r.known ? (r.bal as number) / a.goal : 0, taxYear: null, known: r.known };
}
