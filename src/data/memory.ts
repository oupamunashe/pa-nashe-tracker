/* MemoryAdapter – port of prototype/test/mock.js. Used by unit tests, Playwright and `npm run dev:demo`.
   One intended difference from the mock: update() on a missing document creates it (doc_merge does). */
import type { Collection, DocSnap, DocStore, FileStore, QuerySnap, Unsub } from './adapter';
import { clone, merge } from './merge';

export class MemoryAdapter implements DocStore {
  store: Record<string, any>;
  writes: any[] = [];
  private listeners = new Set<() => void>();

  constructor(seed: Record<string, any> = {}) { this.store = clone(seed); }

  private notify() { setTimeout(() => this.listeners.forEach(l => l()), 5); }
  private snapDoc(path: string): DocSnap {
    return { id: path.split('/').pop() as string, exists: !!this.store[path], data: () => (this.store[path] ? clone(this.store[path]) : undefined) };
  }

  doc(path: string) {
    return {
      set: async (d: any) => { this.writes.push(['set', path]); this.store[path] = clone(d); this.notify(); },
      update: async (d: any) => { this.writes.push(['update', path, d]); this.store[path] = merge(this.store[path] || {}, d); this.notify(); },
      delete: async () => { delete this.store[path]; this.notify(); },
    };
  }

  collection(name: Collection) {
    return {
      onSnapshot: (next: (s: QuerySnap) => void): Unsub => {
        const f = () => {
          const docs = Object.keys(this.store).filter(p => p.startsWith(name + '/') && p.split('/').length === 2).sort().map(p => this.snapDoc(p));
          next({ docs });
        };
        this.listeners.add(f); setTimeout(f, 30);
        return () => { this.listeners.delete(f); };
      },
    };
  }
}

/** In-memory files: blobs kept in a map, served as object URLs. */
export class MemoryFiles implements FileStore {
  blobs = new Map<string, Blob>();
  async upload(f: Blob & { name?: string }) {
    const ext = (f.name?.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase();
    const id = crypto.randomUUID() + '.' + ext;
    this.blobs.set(id, f);
    return { id };
  }
  async url(id: string) {
    const b = this.blobs.get(id);
    return b ? URL.createObjectURL(b) : 'about:blank';
  }
}
