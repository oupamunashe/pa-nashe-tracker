/* Client-side merge must match public.jsonb_deep_merge (0001_init.sql) and the prototype's mock. */
import { describe, expect, it } from 'vitest';
import { merge, merged } from '../../src/data/merge';

describe('deep merge', () => {
  it('merges nested objects key by key', () => {
    const a = { txns: { t1: { amt: 1 } }, y: 2026 };
    merge(a, { txns: { t2: { amt: 2 } } });
    expect(a).toEqual({ txns: { t1: { amt: 1 }, t2: { amt: 2 } }, y: 2026 });
  });
  it('merges at depth without replacing sibling maps', () => {
    const a = { calc: { lavie: { rent: 1, levies: 2 }, baby: { birth: 3 } } };
    merge(a, { calc: { lavie: { rent: 9 } } });
    expect(a).toEqual({ calc: { lavie: { rent: 9, levies: 2 }, baby: { birth: 3 } } });
  });
  it('replaces arrays', () => {
    const a = { al: [{ w: 'P' }, { w: 'M' }], rules: [['A', 'x']] };
    merge(a, { al: [{ w: 'M' }] });
    expect(a.al).toEqual([{ w: 'M' }]);
  });
  it('stores null as a tombstone', () => {
    const a: any = { txns: { t1: { amt: 1 }, t2: { amt: 2 } } };
    merge(a, { txns: { t1: null } });
    expect(a.txns).toEqual({ t1: null, t2: { amt: 2 } });
    expect('t1' in a.txns).toBe(true);
  });
  it('replaces a scalar with an object and an object with a scalar', () => {
    const a: any = { x: 1, y: { z: 1 } };
    merge(a, { x: { q: 1 }, y: 5 });
    expect(a).toEqual({ x: { q: 1 }, y: 5 });
  });
  it('skips undefined values, as JSON transport would', () => {
    const a: any = { x: 1 };
    merge(a, { x: undefined, y: 2 });
    expect(a).toEqual({ x: 1, y: 2 });
  });
  it('does not share references with the patch', () => {
    const patch = { lines: { a: { al: [{ w: 'P' }] } } };
    const a: any = merge({}, patch);
    patch.lines.a.al[0].w = 'M';
    expect(a.lines.a.al[0].w).toBe('P');
  });
  it('merged() creates the document when missing and never mutates the input', () => {
    expect(merged(null, { y: 1 })).toEqual({ y: 1 });
    const doc = { a: { b: 1 } };
    const out = merged(doc, { a: { c: 2 } });
    expect(out).toEqual({ a: { b: 1, c: 2 } });
    expect(doc).toEqual({ a: { b: 1 } });
  });
});
