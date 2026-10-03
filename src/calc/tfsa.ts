/* ---------------- tax-free savings accounts: goal progress per South African tax year ----------------
   A TFSA's goal (the annual contribution limit) is measured against what went in during the active tax year,
   1 March to 28/29 February – not the lifetime balance. The balance itself is unchanged (see balances.ts).
   Counted as a contribution: money in (budget-linked payments, transfers, deposits). Not counted: growth
   (interest), balance confirmations, and withdrawals – a withdrawal doesn't give back contribution room.
   A ledger entry of type 'correction' fixes a wrongly recorded contribution and counts either way (+ or −).
   Only settled entries count (dated up to today): the budget runs a month ahead, so a month's planned
   contribution is dated the 28th and only counts from that day. */
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

/** Statutory SA annual TFSA contribution limit by the year the tax year starts in (1 March). */
export const TFSA_LIMITS: [number, number][] = [[2015, 30000], [2017, 33000], [2020, 36000], [2026, 46000]];
export const tfsaLimit = (startYear: number) => TFSA_LIMITS.filter(([y]) => y <= startYear).pop()?.[1] ?? 0;

/** Contributions dated from `from` up to and including `to` (see the rules at the top). */
export function contributionsBetween(r: BalResult, from: string, to: string) {
  return r2(sum(r.ev.filter(e => (e.d || '') >= from && (e.d || '') <= to && e.ty !== 'check' && e.ty !== 'interest' && (e.amt > 0 || e.ty === 'correction')), e => e.amt));
}

/** Settled contributions to an account in the tax year containing `today`: from 1 March up to and including today. */
export function taxYearContributions(r: BalResult, today = todayISO()) {
  return contributionsBetween(r, taxYear(today).start, today);
}

/** One tax year of a TFSA, picked by the calendar year it starts in. The current year counts settled entries
    up to today and is measured against the account's goal (or the statutory limit); a past year counts the
    whole year and is measured against that year's statutory limit. `partial` when the account's records
    start after 1 March of that year (contributions made before then aren't in the tracker). */
export function tfsaYear(r: BalResult, startYear: number, today = todayISO()) {
  const ty = taxYear(`${startYear}-06-01`), cur = taxYear(today), isCurrent = ty.start === cur.start;
  const to = isCurrent ? today : ty.end;
  const amount = contributionsBetween(r, ty.start, to);
  const limit = tfsaLimit(startYear), target = (isCurrent && r.a.goal) || limit;
  const first = r.a.od || r.ev[r.ev.length - 1]?.d || ty.start;
  return { ...ty, startYear, isCurrent, to, amount, limit, target, pct: target ? amount / target : 0, recordsFrom: first > ty.start ? first : null };
}

/** Tax years to offer for a TFSA, newest first: from the year its records start to the current one. */
export function tfsaYears(r: BalResult, today = todayISO()) {
  const first = r.a.od || r.ev[r.ev.length - 1]?.d || today;
  const a = +taxYear(first).start.slice(0, 4), b = +taxYear(today).start.slice(0, 4), out: number[] = [];
  for (let y = b; y >= a; y--) out.push(y);
  return out;
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
