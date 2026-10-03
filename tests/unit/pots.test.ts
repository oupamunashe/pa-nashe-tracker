/* Savings pots: an account's pot follows the horizon of the budget lines that pay into it, unless set by hand. */
import { describe, expect, it } from 'vitest';
import { balances } from '../../src/calc/balances';
import { potOf, potTotals } from '../../src/calc/pots';
import { accs } from '../../src/core/state';
import synthetic from '../fixtures/synthetic-backup.json';
import { loadState } from '../helpers/state';

function backup() {
  const b: any = structuredClone(synthetic);
  const A = b.config.accounts.accounts, C = b.config.catalog.items;
  Object.assign(A, {
    t_notice: { n: 'Notice savings', t: 'savings', ow: 'J', open: 300, od: '2030-01-01' },                   // no linked line → short
    t_car: { n: 'Car fund', t: 'savings', ow: 'J', open: 200, od: '2030-01-01' },
    t_goal_car: { n: 'Car goal', t: 'goal', ow: 'J', open: 150, od: '2030-01-01' },
    t_ra: { n: 'Retirement annuity', t: 'savings', ow: 'P', open: 50, od: '2030-01-01', pot: 'medium' },     // set by hand
    t_unconf: { n: 'Unconfirmed', t: 'savings', ow: 'M', open: 75, od: '2030-01-01', chk: 'confirm me' },
    t_old: { n: 'Closed', t: 'savings', ow: 'M', open: 999, od: '2030-01-01', closed: true },
    t_card: { n: 'Card', t: 'credit', ow: 'P', open: 10, od: '2030-01-01' },
  });
  Object.assign(C, {
    t_car_line: { n: 'Car savings', g: 'it', fl: [{ a: 't_car', s: 1, x: 1 }, { a: 't_goal_car', s: 1, x: 1 }] },
    t_ra_line: { n: 'RA', g: 'lt', fl: [{ a: 't_ra', s: 1, x: 1 }] },
  });
  return b;
}

describe('savings pots', () => {
  it('default pot from the linked lines; a pot set on the account wins; non-savings accounts have none', async () => {
    await loadState(backup());
    const A = accs();
    expect(potOf('tfsa_p', A.tfsa_p)).toBe('long');        // linked to a long-term line
    expect(potOf('t_car', A.t_car)).toBe('medium');
    expect(potOf('t_goal_car', A.t_goal_car)).toBe('medium');
    expect(potOf('t_notice', A.t_notice)).toBe('short');
    expect(potOf('t_ra', A.t_ra)).toBe('medium');
    expect(potOf('t_card', A.t_card)).toBeNull();
  });
  it('totals add savings accounts only; goals are shown separately; unconfirmed and closed ones are left out', async () => {
    await loadState(backup());
    const B = balances(), P = Object.fromEntries(potTotals(B).map(p => [p.k, p]));
    expect(P.short.total).toBe(300);
    expect(P.short.toConfirm).toBe(1);
    expect(P.medium.total).toBe(200 + 50);
    expect(P.medium.goals).toBe(150);
    expect(P.long.total).toBe(B.tfsa_p.bal! + B.tfsa_m.bal!);
    expect(P.short.rows.some(r => r.id === 't_old')).toBe(false);
    expect(potTotals(B, true).find(p => p.k === 'short')!.rows.some(r => r.id === 't_old')).toBe(true);
  });
});
