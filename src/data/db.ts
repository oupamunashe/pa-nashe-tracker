/* ---------------- database layer (from prototype core.js) ---------------- */
import { mkey, uid } from '../core/format';
import { hooks } from '../core/hooks';
import { S } from '../core/state';
import type { LedgerEntry, Txn } from '../core/types';

const queues: Record<string, Promise<unknown>> = {};
function enqueue<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const p = (queues[path] || Promise.resolve()).then(fn, fn);
  queues[path] = p.catch(() => {});
  return p;
}
export async function dbWrite(path: string, op: 'set' | 'update' | 'delete', data?: any) {
  if (!S.db) { hooks.toast('Not connected – check your internet connection.', 'bad'); throw new Error('offline'); }
  if (!S.canWrite) { hooks.toast('You have view-only access to this tracker.', 'bad'); throw new Error('readonly'); }
  return enqueue(path, async () => {
    try { await (S.db as any).doc(path)[op](data); }
    catch (e: any) {
      if (e?.code === 'invalid_argument' && /permission|write|level/i.test(e.message || '')) S.canWrite = false;
      if (e?.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); return (S.db as any).doc(path)[op](data); }
      hooks.toast('Could not save: ' + (e?.message || e?.code || 'unknown error'), 'bad');
      throw e;
    }
  });
}
// Port difference (agreed in Phase 0): a new month is created with a merge, not a full replace, so a queued
// offline "create" can never wipe entries someone else already saved to that month. Same body, same result.
export async function ensureMonth(k: string, extra: Record<string, any> = {}) {
  if (S.months[k]) return;
  const body = { y: +k.slice(0, 4), m: +k.slice(5, 7), lines: {}, txns: {}, ledger: {}, ...extra };
  S.months[k] = body as any; S.ver++;
  await dbWrite('months/' + k, 'update', body);
}
export async function saveTxn(t: Txn, id = uid(), oldMonth: string | null = null) {
  const k = t.mo;
  if (oldMonth && oldMonth !== k) await deleteTxn(oldMonth, id);
  if (!S.months[k]) await ensureMonth(k, { txns: { [id]: t } });
  else await dbWrite('months/' + k, 'update', { txns: { [id]: t } });
  return id;
}
export async function deleteTxn(k: string, id: string) { await dbWrite('months/' + k, 'update', { txns: { [id]: null } }); }
export async function saveLine(k: string, itemId: string, line: any) {
  await ensureMonth(k);
  await dbWrite('months/' + k, 'update', { lines: { [itemId]: line } });
}
export async function removeLine(k: string, itemId: string) { await dbWrite('months/' + k, 'update', { lines: { [itemId]: null } }); }
export async function saveLedger(e: LedgerEntry, id = uid()) {
  if (!e.at) e = { ...e, at: Date.now() };
  const k = mkey(e.d);
  if (!S.months[k]) await ensureMonth(k, { ledger: { [id]: e } });
  else await dbWrite('months/' + k, 'update', { ledger: { [id]: e } });
  return id;
}
export async function deleteLedger(k: string, id: string) { await dbWrite('months/' + k, 'update', { ledger: { [id]: null } }); }
export async function saveItem(id: string, item: any) { await dbWrite('config/catalog', 'update', { items: { [id]: item } }); }
export async function saveAccount(id: string, a: any) { await dbWrite('config/accounts', 'update', { accounts: { [id]: a } }); }
export async function saveMain(patch: any) { await dbWrite('config/main', 'update', patch); }
// New milestones (full = true) are also created with a merge – see ensureMonth.
export async function saveMs(id: string, patch: any, _full = false) { await dbWrite('milestones/' + id, 'update', patch); }

export function subscribe() {
  const db = S.db!;
  const onErr = (what: string) => (e: any) => { console.warn(what, e); if (e?.code === 'revoked') { S.offline = true; hooks.render(); } };
  db.collection('config').onSnapshot(snap => {
    snap.docs.forEach(d => { S.cfg[d.id] = d.exists ? d.data() : null; });
    S.loaded.config = true; S.ver++; hooks.scheduleRender();
  }, onErr('config'));
  db.collection('months').onSnapshot(snap => {
    const seen: Record<string, number> = {};
    snap.docs.forEach(d => { if (d.exists) { S.months[d.id] = d.data(); seen[d.id] = 1; } });
    Object.keys(S.months).forEach(k => { if (!seen[k]) delete S.months[k]; });
    S.loaded.months = true; S.ver++; hooks.scheduleRender();
  }, onErr('months'));
  db.collection('milestones').onSnapshot(snap => {
    S.ms = {}; snap.docs.forEach(d => { if (d.exists) S.ms[d.id] = d.data(); });
    S.loaded.ms = true; S.ver++; hooks.scheduleRender();
  }, onErr('milestones'));
}
