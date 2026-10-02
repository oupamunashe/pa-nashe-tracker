/* The storage surface the prototype used (claude.use('db')), kept exactly – docs/SPEC.md §2.2. */
import type { Backup } from '../core/types';

export interface DocSnap { id: string; exists: boolean; data(): any }
export interface QuerySnap { docs: DocSnap[] }
export type Unsub = () => void;
export type Collection = 'config' | 'months' | 'milestones';

export interface DocRef {
  set(body: any): Promise<void>;      // full replace (creates)
  update(patch: any): Promise<void>;  // deep merge of nested maps; arrays replaced; null stored as a tombstone
  delete(): Promise<void>;
}
export interface StoreStatus { online: boolean; pending: number; flushing: boolean }
export interface DocStore {
  doc(path: string): DocRef;
  collection(name: Collection): { onSnapshot(next: (s: QuerySnap) => void, error?: (e: any) => void): Unsub };
  onStatus?(fn: (st: StoreStatus) => void): Unsub;
}
export interface FileStore {
  upload(f: Blob & { name?: string }): Promise<{ id: string }>;
  url(id: string): Promise<string>;
}

export const COLLECTIONS: Collection[] = ['config', 'months', 'milestones'];

/** Backup JSON → flat store keyed by document path ('config/main', 'months/2026-10', …). */
export function storeFromBackup(b: Partial<Backup>): Record<string, any> {
  const s: Record<string, any> = {};
  for (const [k, v] of Object.entries(b.config || {})) s['config/' + k] = v;
  for (const [k, v] of Object.entries(b.months || {})) s['months/' + k] = v;
  for (const [k, v] of Object.entries(b.milestones || {})) s['milestones/' + k] = v;
  return s;
}
