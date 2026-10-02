/* personFromText (ACCEPTANCE flow 12) and re-importing the original statements (flow 8). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { classify, parseCSV, personFromText, rowsToStatement } from '../../src/calc/statement';
import { hasPrivate, hasStatements, personCases, referenceBackup, statementPath, statements } from '../helpers/private';
import { loadState } from '../helpers/state';

describe.skipIf(!hasPrivate)('statement import on the reference data', () => {
  beforeAll(async () => { await loadState(referenceBackup()); });

  describe('personFromText (flow 12)', () => {
    const cases = hasPrivate ? personCases() : [];
    it('has the six cases', () => expect(cases.length).toBe(6));
    cases.forEach(([text, who], i) => it(`case ${i + 1} → ${who ?? 'none'}`, () => expect(personFromText(text)).toBe(who)));
  });

  describe.skipIf(!hasStatements)('re-importing the original statements skips every row (flow 8)', () => {
    for (const s of statements()) {
      it(`statement for ${s.acc}: ${s.rows} rows`, async () => {
        let table: any[][];
        if (s.file.endsWith('.csv')) table = parseCSV(readFileSync(statementPath(s.file), 'utf8'));
        else {
          const X = await import('xlsx');
          const wb = X.read(readFileSync(statementPath(s.file)), { cellDates: true });
          table = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        }
        const rows = classify(rowsToStatement(table).sort((a, b) => a.d.localeCompare(b.d)), s.acc);
        expect(rows.length).toBe(s.rows);
        const counts = { skip: 0, ledger: 0, budget: 0 }; rows.forEach(r => counts[r.act]++);
        expect(counts).toEqual({ skip: s.rows, ledger: 0, budget: 0 });
      });
    }
  });
});
