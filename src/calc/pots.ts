/* ---------------- savings "pots": savings by how soon the money can be used ----------------
   Each savings or goal account sits in one pot. By default the pot follows the budget lines that pay into it:
   a long-term (10 yrs+) line puts it in Long-term, an intermediate (1–3 yrs) line in Medium-term, anything else
   – short-term lines, or no linked line (notice and pool savings) – in Short-term. `pot` on the account
   overrides this (Edit account → Pot).
   A pot's total counts the actual savings & investments accounts in it, like the Savings figure on Accounts.
   Goals are money set aside inside other accounts, so they are shown in their pot but not added again. */
import { sum } from '../core/format';
import { cat } from '../core/state';
import type { Account } from '../core/types';
import type { BalResult } from './balances';

export const POTS = [
  { k: 'short', n: 'Short-term', d: 'Emergency & liquid' },
  { k: 'medium', n: 'Medium-term', d: 'Reserves, 1–3 years' },
  { k: 'long', n: 'Long-term', d: 'Investments, 10 years+' },
] as const;
export type PotKey = typeof POTS[number]['k'];
export const inPots = (a: Account) => a.t === 'savings' || a.t === 'goal';

export function potOf(id: string, a: Account): PotKey | null {
  if (!inPots(a)) return null;
  if (a.pot && POTS.some(p => p.k === a.pot)) return a.pot;
  const gs = new Set(Object.values<any>(cat()).filter(it => (it.fl || []).some(f => f.a === id)).map(it => it.g));
  return gs.has('lt') ? 'long' : gs.has('it') ? 'medium' : 'short';
}

/** Per pot: its accounts (open ones, or all with `withClosed`), the savings total and the goals set aside in it. */
export function potTotals(B: Record<string, BalResult>, withClosed = false) {
  const rows = Object.values(B).filter(r => inPots(r.a) && (withClosed || !r.a.closed));
  return POTS.map(p => {
    const rs = rows.filter(r => potOf(r.id, r.a) === p.k);
    const sav = rs.filter(r => r.a.t === 'savings' && r.known && !r.needsCheck), goals = rs.filter(r => r.a.t === 'goal' && r.known);
    return { ...p, rows: rs, total: sum(sav, r => r.bal), goals: sum(goals, r => r.bal), toConfirm: rs.filter(r => r.a.t === 'savings' && r.needsCheck).length };
  });
}
