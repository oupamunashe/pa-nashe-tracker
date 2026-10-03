/* Year-on-year comparison: change = current − base, the later year is current, % = change ÷ base. */
import { describe, expect, it } from 'vitest';
import { compareOrder, yoyChange, yoyTone } from '../../src/calc/compare';

describe('year-on-year comparison', () => {
  it('the later year is current, whichever is picked first', () => {
    expect(compareOrder('2026', '2024')).toEqual(['2026', '2024']);
    expect(compareOrder('2024', '2026')).toEqual(['2026', '2024']);
  });
  it('change = current − base, % = change ÷ base', () => {
    const a = yoyChange(340000, 349300);          // less earned than the base year
    expect(a.d).toBe(-9300); expect(a.pct!).toBeCloseTo(-0.0266, 4);
    const b = yoyChange(244000, 184400);          // more earned
    expect(b.d).toBe(59600); expect(b.pct!).toBeCloseTo(0.3232, 4);
    expect(yoyChange(500, 0)).toEqual({ d: 500, pct: null });                 // nothing in the base year: no %
    expect(yoyChange(-6869, -5953).pct!).toBeCloseTo(-916 / 5953, 6);        // a bigger deficit reads as a fall
  });
  it('green when better, red when worse', () => {
    expect(yoyTone(-9300, true)).toBe('bad');     // income down
    expect(yoyTone(59600, true)).toBe('good');    // income up
    expect(yoyTone(500, false)).toBe('bad');      // spending up
    expect(yoyTone(-500, false)).toBe('good');    // spending down
    expect(yoyTone(0.2, true)).toBe('');          // no change
  });
});
