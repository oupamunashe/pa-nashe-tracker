/* Loads a backup into the app state the same way the app does: MemoryAdapter → subscribe() → S. */
import { S } from '../../src/core/state';
import { storeFromBackup } from '../../src/data/adapter';
import { subscribe } from '../../src/data/db';
import { MemoryAdapter } from '../../src/data/memory';

export async function loadState(backup: any): Promise<MemoryAdapter> {
  const db = new MemoryAdapter(storeFromBackup(backup));
  Object.assign(S, {
    db, cfg: { main: null, catalog: null, accounts: null }, months: {}, ms: {},
    loaded: { config: false, months: false, ms: false }, canWrite: true, offline: false,
  });
  S.ver++;
  subscribe();
  await until(() => S.loaded.config && S.loaded.months && S.loaded.ms);
  return db;
}

export async function until(cond: () => boolean, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 5));
  }
}

/** Wait for the adapter's async notify to reach S (mock timing: 5 ms). */
export const settle = () => new Promise(r => setTimeout(r, 40));
