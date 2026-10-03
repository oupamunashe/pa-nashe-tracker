/* ---------------- year-on-year comparison (Year view → Compare with) ----------------
   The later year is always "current" and the earlier one the base, whichever of the two was picked first,
   so a change always reads current − base: 2026 vs 2024 → R340,000 − R349,300 = –R9,300.
   Percentage = change ÷ base (by size, so a negative base – a deficit – keeps the sign of the change). */
import { r2 } from '../core/format';

/** [current, base]: the later year first. */
export const compareOrder = (a: string, b: string): [string, string] => (a >= b ? [a, b] : [b, a]);

export function yoyChange(current: number, base: number) {
  const d = r2(current - base);
  return { d, pct: Math.abs(base) > 0.5 ? d / Math.abs(base) : null };
}

/** 'good' / 'bad' / '' (no change). upGood: more is better (money in, saved, left over); false for spending,
    debt repayments and money drawn from loans or savings. */
export const yoyTone = (d: number, upGood: boolean) => (Math.abs(d) < 0.5 ? '' : (d > 0) === upGood ? 'good' : 'bad');
