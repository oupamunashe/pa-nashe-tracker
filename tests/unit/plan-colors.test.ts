/* Home → “Against your plan”: savings are on track at or above target, spending at or below it. */
import { describe, expect, it } from 'vitest';
import { planBarColor, planOnTrack } from '../../src/ui/parts';

const savings = (actPct: number, planPct: number) => ({ save: true, actPct, planPct });
const spending = (actPct: number, planPct: number) => ({ save: false, actPct, planPct });

describe('plan category colours', () => {
  it('savings below target is red (e.g. 8% of 25%)', () => {
    expect(planOnTrack(savings(0.08, 0.25))).toBe(false);
    expect(planBarColor(savings(0.08, 0.25))).toBe('var(--bad)');
  });
  it('savings at or above target is green', () => {
    expect(planBarColor(savings(0.25, 0.25))).toBe('var(--good)');
    expect(planBarColor(savings(0.30, 0.25))).toBe('var(--good)');
    expect(planOnTrack(savings(0.25, 0.25))).toBe(true);
  });
  it('spending over target is red (e.g. 34% of 32%)', () => {
    expect(planOnTrack(spending(0.34, 0.32))).toBe(false);
    expect(planBarColor(spending(0.34, 0.32))).toBe('var(--bad)');
  });
  it('spending at or under target is the same green as savings', () => {
    expect(planBarColor(spending(0.32, 0.32))).toBe('var(--good)');
    expect(planBarColor(spending(0.11, 0.15))).toBe('var(--good)');
    expect(planOnTrack(spending(0.11, 0.15))).toBe(true);
  });
  it('a category without a target: spending over 0% is red, savings at 0% is green', () => {
    expect(planBarColor(spending(0.02, 0))).toBe('var(--bad)');
    expect(planBarColor(savings(0, 0))).toBe('var(--good)');
  });
});
