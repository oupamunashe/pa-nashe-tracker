/* Access to the git-ignored private/ folder. Nothing financial or personal is hard-coded in tests:
   expected numbers and names are read here at runtime, and tests skip when private/ is absent (CI). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const priv = (...p: string[]) => resolve(ROOT, 'private', ...p);
// PN_NO_PRIVATE=1 simulates a checkout without private/ (as on GitHub Actions).
export const hasPrivate = !process.env.PN_NO_PRIVATE && existsSync(priv('data', 'seed-reference', 'backup.json')) && existsSync(priv('data', 'baseline.json'));

export const readJSON = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
export const referenceBackup = () => readJSON(priv('data', 'seed-reference', 'backup.json'));
export const baseline = () => readJSON(priv('data', 'baseline.json'));
export const syntheticBackup = () => readJSON(resolve(ROOT, 'tests', 'fixtures', 'synthetic-backup.json'));

/** ACCEPTANCE.md flow 12: “TEXT” → P | M | none, parsed so the names never live in the repo. */
export function personCases(): [string, 'P' | 'M' | null][] {
  const md = readFileSync(priv('ACCEPTANCE.md'), 'utf8');
  const line = md.split('\n').find(l => /^12\.\s.*personFromText/.test(l));
  if (!line) throw new Error('flow 12 not found in ACCEPTANCE.md');
  return [...line.matchAll(/“([^”]+)”\s*→\s*(P|M|none)/g)].map(m => [m[1], m[2] === 'none' ? null : (m[2] as 'P' | 'M')]);
}

/** ACCEPTANCE.md flow 8: the original statements and their row counts. File names carry account numbers,
    so they are read at runtime; each file is matched to the account whose `bank` shows its last four digits. */
export function statements(): { acc: string; file: string; rows: number }[] {
  if (!hasPrivate) return [];
  const md = readFileSync(priv('ACCEPTANCE.md'), 'utf8');
  const accounts: Record<string, any> = referenceBackup().config.accounts.accounts;
  return [...md.matchAll(/`([^`]+\.(?:csv|xlsx))`[^(]*\((\d+) rows\)/g)].map(([, file, rows]) => {
    const last4 = (file.match(/_(\d{6,})_/)?.[1] || '').slice(-4);
    const acc = Object.keys(accounts).find(id => last4 && (accounts[id].bank || '').includes(last4)) || '';
    return { acc, file, rows: +rows };
  });
}
export const statementPath = (f: string) => priv('statements', f);
export const hasStatements = hasPrivate && statements().length === 3 && statements().every(s => s.acc && existsSync(statementPath(s.file)));
