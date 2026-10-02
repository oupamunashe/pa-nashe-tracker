/* MemoryAdapter + the prototype's write layer, on a synthetic fixture (runs in CI). Figures below are
   derived by hand from tests/fixtures/synthetic-backup.json – fake data. */
import { beforeEach, describe, expect, it } from 'vitest';
import { balances } from '../../src/calc/balances';
import { monthCalc } from '../../src/calc/month';
import { msCalc } from '../../src/calc/milestones';
import { peopleCalc } from '../../src/calc/people';
import { personFromText } from '../../src/calc/statement';
import { S } from '../../src/core/state';
import { deleteTxn, ensureMonth, saveLine, saveMain, saveTxn } from '../../src/data/db';
import { MemoryAdapter } from '../../src/data/memory';
import { syntheticBackup } from '../helpers/private';
import { loadState, settle } from '../helpers/state';

let db: MemoryAdapter;
beforeEach(async () => { db = await loadState(syntheticBackup()); });

describe('MemoryAdapter + subscribe', () => {
  it('loads config, months and milestones into S', () => {
    expect(S.cfg.main?.planBase).toBe(10000);
    expect(Object.keys(S.months)).toEqual(['2030-01']);
    expect(Object.keys(S.ms)).toEqual(['trip']);
  });

  it('month totals, tombstones ignored', () => {
    const T = monthCalc('2030-01').T;
    expect(T.a.income).toBe(10000 + 1250.5);   // earned + automatic funding from the card
    expect(T.a.auto).toBe(1250.5);
    expect(T.a.sav).toBe(1000);
    expect(T.a.exp).toBe(5750);
    expect(T.a.surplus).toBe(4500.5);
    expect(T.b.surplus).toBe(10000 - 1000 - 7500);
  });

  it('people split on the budget basis', () => {
    const R = peopleCalc('2030-01', 'b');
    expect(R.P.inc).toBe(6000); expect(R.P.out).toBe(500 + 4000);
    expect(R.M.inc).toBe(4000); expect(R.M.out).toBe(500);
    expect(R.U.out).toBe(3500);
  });

  it('balances: budget links, paid-from on a liability, checks', () => {
    const B = balances();
    expect(B.tfsa_p.bal).toBe(600);
    expect(B.tfsa_m.bal).toBe(600);
    expect(B.card.bal).toBe(2050);         // confirmed 2000 on the 15th, then interest 50 (the spend on the 10th was before)
    expect(B.card.needsCheck).toBe(false);
    expect(B.bank_p.known).toBe(false);
  });

  it('milestone USD conversion', () => {
    const c = msCalc('trip')!;
    expect(c.exp.b).toBe(3000 + 100 * 20);
    expect(c.exp.a).toBe(50 * 20);
    expect(c.inc.a).toBe(2000);
  });

  it('personFromText with fake names', () => {
    expect(personFromText('A TESTPERSON')).toBe('P');   // initials of given names (one-letter names ignored) + surname
    expect(personFromText('From: Sammy')).toBe('M');
    expect(personFromText('TESTPERSON')).toBe(null);
  });
});

describe('writes', () => {
  it('saveTxn deep-merges into the month and keeps other entries', async () => {
    await saveTxn({ d: '2030-01-20', mo: '2030-01', it: 'groceries', amt: 100, src: 'app', by: 'P' }, 'n1');
    await settle();
    expect(Object.keys(db.store['months/2030-01'].txns)).toEqual(expect.arrayContaining(['t1', 't5', 'n1']));
    expect(monthCalc('2030-01').lines.find(l => l.id === 'groceries')!.act).toBe(1850);
  });

  it('deleteTxn stores a tombstone', async () => {
    await deleteTxn('2030-01', 't6');
    await settle();
    expect(db.store['months/2030-01'].txns.t6).toBeNull();
    expect(monthCalc('2030-01').lines.find(l => l.id === 'groceries')!.act).toBe(1250.5);
  });

  it('saveLine replaces the allocation array', async () => {
    await saveLine('2030-01', 'tfsa', { b: 1000, al: [{ w: 'M', v: 100, u: 'pct' }], rec: true, note: '' });
    await settle();
    expect(S.months['2030-01'].lines.tfsa!.al).toEqual([{ w: 'M', v: 100, u: 'pct' }]);
  });

  it('saveMain merges nested config without dropping siblings', async () => {
    await saveMain({ calc: { lavie: { rent: 1 } } });
    await saveMain({ calc: { baby: { birth: 2 } } });
    await settle();
    expect(S.cfg.main!.calc).toEqual({ lavie: { rent: 1 }, baby: { birth: 2 } });
    expect(S.cfg.main!.people!.P!.n).toBe('Piepie');
  });

  it('ensureMonth creates a new month with a merge, never a replace', async () => {
    // someone else already saved an entry to February on the server
    await db.doc('months/2030-02').update({ txns: { other: { d: '2030-02-01', mo: '2030-02', it: 'groceries', amt: 10, src: 'app' } } });
    delete S.months['2030-02'];
    await ensureMonth('2030-02', { lines: { rent: { b: 4000, rec: true } } });
    await settle();
    const doc = db.store['months/2030-02'];
    expect(doc.txns.other.amt).toBe(10);
    expect(doc.lines.rent.b).toBe(4000);
    expect(db.writes.some(w => w[0] === 'set')).toBe(false);
  });

  it('per-document writes are applied in order', async () => {
    await Promise.all([1, 2, 3].map(i => saveTxn({ d: '2030-01-0' + i, mo: '2030-01', it: 'groceries', amt: i, src: 'app' }, 'q' + i)));
    expect(db.writes.filter(w => w[0] === 'update').map(w => Object.keys(w[2].txns)[0])).toEqual(['q1', 'q2', 'q3']);
  });
});
