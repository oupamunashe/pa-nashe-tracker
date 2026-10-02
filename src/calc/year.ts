/* ---------------- year aggregation – verbatim from prototype core.js ---------------- */
import { GMAP, MONTHS } from '../core/constants';
import { S, cached } from '../core/state';
import type { Item } from '../core/types';
import { monthCalc } from './month';

export interface YearItem { id: string; it: Item; g: string; b: number[]; a: number[] }

export function yearCalc(y: string) {
  return cached('y:' + y, () => {
    const keys = MONTHS.map((_, i) => y + '-' + String(i + 1).padStart(2, '0'));
    const items: Record<string, YearItem> = {}; const tot: any[] = keys.map(() => ({ b: { earned: 0, funding: 0, auto: 0, sav: 0, exp: 0, income: 0, out: 0, surplus: 0 }, a: { earned: 0, funding: 0, auto: 0, sav: 0, exp: 0, income: 0, out: 0, surplus: 0 } }));
    keys.forEach((k, i) => {
      if (!S.months[k]) return;
      const mc = monthCalc(k);
      tot[i] = mc.T;
      mc.lines.forEach(l => {
        items[l.id] = items[l.id] || { id: l.id, it: l.it, g: l.g, b: Array(12).fill(0), a: Array(12).fill(0) };
        items[l.id].b[i] += l.b; items[l.id].a[i] += l.act;
      });
    });
    return { y, keys, items: Object.values(items).sort((a, b) => (GMAP[a.g]?.i ?? 99) - (GMAP[b.g]?.i ?? 99) || (a.it.o || 0) - (b.it.o || 0)), tot };
  });
}
