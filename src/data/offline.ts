/* IndexedDB: last-known copy of every document (so the app opens offline) and the outbox of writes
   not yet confirmed by the server (replayed in order when back online) – docs/SPEC.md §2.4.
   One database per signed-in user; sign-out deletes it. */
import { deleteDB, openDB, type IDBPDatabase } from 'idb';

export interface CachedDoc { path: string; data: any; version: number }
export interface OutboxEntry { seq?: number; path: string; op: 'set' | 'update' | 'delete'; data?: any; at: number }

const dbName = (userId: string) => 'pa-nashe-' + userId;

export class LocalStore {
  private db: Promise<IDBPDatabase>;
  constructor(readonly userId: string) {
    this.db = openDB(dbName(userId), 1, {
      upgrade(db) {
        db.createObjectStore('docs', { keyPath: 'path' });
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      },
    });
  }
  async docs(): Promise<CachedDoc[]> { return (await this.db).getAll('docs'); }
  async putDocs(docs: CachedDoc[]) {
    const tx = (await this.db).transaction('docs', 'readwrite');
    await Promise.all([...docs.map(d => tx.store.put(d)), tx.done]);
  }
  async deleteDocs(paths: string[]) {
    const tx = (await this.db).transaction('docs', 'readwrite');
    await Promise.all([...paths.map(p => tx.store.delete(p)), tx.done]);
  }
  async outbox(): Promise<OutboxEntry[]> { return (await this.db).getAll('outbox'); }
  async addOutbox(e: OutboxEntry): Promise<number> { return (await (await this.db).add('outbox', e)) as number; }
  async removeOutbox(seq: number) { await (await this.db).delete('outbox', seq); }
  async destroy() { (await this.db).close(); await deleteDB(dbName(this.userId)); }
}

/** Removes every tracker database on this device (sign-out). */
export async function clearAllLocal() {
  try {
    const dbs = (await (indexedDB as any).databases?.()) || [];
    await Promise.all(dbs.filter((d: any) => d.name?.startsWith('pa-nashe-')).map((d: any) => deleteDB(d.name)));
  } catch (e) { /* older browsers: the per-user store is destroyed directly */ }
}
