/* SupabaseAdapter – the prototype's db surface on Supabase (docs/SPEC.md §2.2, §2.4).
   - set → rpc doc_set, update → rpc doc_merge (server-side deep merge), delete → delete row.
   - Every write goes to the IndexedDB outbox first and is shown at once through a pending overlay
     (same merge rules as the server), then sent in order. Network trouble keeps it queued; it is replayed
     when the connection returns. A refused write (e.g. permissions) is dropped and reported.
   - Reads: one Realtime subscription on public.docs plus a full refetch on (re)subscribe, on `online` and
     when the app becomes visible again. Version numbers stop an older copy from replacing a newer one. */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { COLLECTIONS, type Collection, type DocSnap, type DocStore, type FileStore, type QuerySnap, type StoreStatus, type Unsub } from './adapter';
import { clone, merged } from './merge';
import type { LocalStore, OutboxEntry } from './offline';

type Listener = (s: QuerySnap) => void;
interface ServerDoc { data: any; version: number }
interface SendResult { ok: boolean; version?: number | null; transient?: boolean; error?: any }

const colOf = (path: string) => path.split('/')[0] as Collection;
const split = (path: string) => { const i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)] as const; };
const hasWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function isTransient(error: any, status?: number): boolean {
  if (browserOffline()) return true;
  const msg = String(error?.message || error || '');
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed|timed? ?out|aborted|ECONN|ENOTFOUND/i.test(msg)) return true;
  if (error?.code === 'PGRST301') return true;                       // JWT expired – refreshed automatically
  const s = status ?? error?.status;
  return s === 0 || s === 401 || s === 408 || s === 429 || (typeof s === 'number' && s >= 500);
}

export class SupabaseAdapter implements DocStore {
  private server = new Map<string, ServerDoc>();
  private pending: OutboxEntry[] = [];
  private listeners = new Map<Collection, Set<Listener>>();
  private statusFns = new Set<(s: StoreStatus) => void>();
  private waiters = new Map<number, { resolve: () => void; reject: (e: any) => void }>();
  private acked = new Map<string, number>();     // path → time of our last confirmed write (protects against a stale refetch)
  private online = !browserOffline();
  private flushing = false;
  private ready = false;
  private stopped = false;
  private channel: RealtimeChannel | null = null;
  private retryTimer: any = null;
  private retryDelay = 0;
  private notifyQ = new Set<Collection>();
  private notifyTimer: any = null;
  private persistQ = new Map<string, ServerDoc | null>();
  private persistTimer: any = null;
  private localSeq = 0;

  constructor(private sb: SupabaseClient, private local: LocalStore, private onError: (msg: string) => void = () => {}) {}

  /* ---------- lifecycle ---------- */
  async start() {
    const [docs, outbox] = await Promise.all([this.local.docs().catch(() => []), this.local.outbox().catch(() => [])]);
    docs.forEach(d => this.server.set(d.path, { data: d.data, version: d.version }));
    this.pending = outbox.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    if (docs.length) { this.ready = true; COLLECTIONS.forEach(c => this.queueNotify(c)); }
    this.emitStatus();
    if (hasWindow) {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
      document.addEventListener('visibilitychange', this.onVisible);
    }
    this.channel = this.sb.channel('pn-docs')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'docs' }, (p: any) => this.onChange(p))
      .subscribe(status => { if (status === 'SUBSCRIBED') this.refresh(); });
    await this.refresh();
  }
  stop() {
    this.stopped = true;
    if (this.channel) this.sb.removeChannel(this.channel);
    if (hasWindow) {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
      document.removeEventListener('visibilitychange', this.onVisible);
    }
    clearTimeout(this.retryTimer); clearTimeout(this.notifyTimer); clearTimeout(this.persistTimer);
  }
  get pendingCount() { return this.pending.length; }

  private onOnline = () => { this.refresh(); };
  private onOffline = () => { this.setOnline(false); };
  private onVisible = () => { if (document.visibilityState === 'visible') this.refresh(); };

  /** Refetch everything, then send anything waiting. */
  async refresh() { await this.fetchAll(); this.flush(); }

  /* ---------- DocStore surface ---------- */
  doc(path: string) {
    return {
      set: (body: any) => this.write(path, 'set', body),
      update: (patch: any) => this.write(path, 'update', patch),
      delete: () => this.write(path, 'delete'),
    };
  }
  collection(name: Collection) {
    return {
      onSnapshot: (next: Listener, _error?: (e: any) => void): Unsub => {
        const set = this.listeners.get(name) || new Set<Listener>(); this.listeners.set(name, set); set.add(next);
        if (this.ready) this.queueNotify(name);
        return () => { set.delete(next); };
      },
    };
  }
  onStatus(fn: (s: StoreStatus) => void): Unsub { this.statusFns.add(fn); fn(this.status()); return () => { this.statusFns.delete(fn); }; }

  /* ---------- reads ---------- */
  private view(path: string): any {
    let d: any = this.server.get(path)?.data ?? null;
    for (const e of this.pending) {
      if (e.path !== path) continue;
      d = e.op === 'set' ? clone(e.data) : e.op === 'delete' ? null : merged(d, e.data);
    }
    return d;
  }
  private snapshot(c: Collection): QuerySnap {
    const paths = new Set<string>();
    for (const p of this.server.keys()) if (colOf(p) === c) paths.add(p);
    for (const e of this.pending) if (colOf(e.path) === c) paths.add(e.path);
    const docs: DocSnap[] = [];
    for (const p of [...paths].sort()) {
      const v = this.view(p);
      if (v) docs.push({ id: split(p)[1], exists: true, data: () => clone(v) });
    }
    return { docs };
  }
  private queueNotify(c: Collection) {
    this.notifyQ.add(c);
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      if (!this.ready || this.stopped) { this.notifyQ.clear(); return; }
      const cs = [...this.notifyQ]; this.notifyQ.clear();
      cs.forEach(c => { const snap = this.snapshot(c); this.listeners.get(c)?.forEach(l => l(snap)); });
    }, 0);
  }

  async fetchAll(): Promise<boolean> {
    if (this.stopped) return false;
    const t0 = Date.now();
    let res: any;
    try { res = await this.sb.from('docs').select('collection,id,data,version'); }
    catch (e) { res = { error: e }; }
    if (res.error) { if (isTransient(res.error, res.status)) this.setOnline(false); else console.warn('fetch', res.error); return false; }
    this.setOnline(true);
    const seen = new Set<string>();
    for (const row of res.data as any[]) {
      const path = row.collection + '/' + row.id; seen.add(path);
      this.applyServer(path, row.data, row.version);
    }
    for (const path of [...this.server.keys()]) {
      if (seen.has(path) || (this.acked.get(path) || 0) >= t0) continue;
      this.server.delete(path); this.persist(path, null); this.queueNotify(colOf(path));
    }
    this.ready = true;
    COLLECTIONS.forEach(c => this.queueNotify(c));
    return true;
  }
  private async fetchDoc(path: string) {
    const [c, id] = split(path);
    const { data, error } = await this.sb.from('docs').select('data,version').eq('collection', c).eq('id', id).maybeSingle();
    if (error) return;
    if (data) this.applyServer(path, data.data, data.version);
    else { this.server.delete(path); this.persist(path, null); this.queueNotify(colOf(path)); }
  }
  private applyServer(path: string, data: any, version: number) {
    const cur = this.server.get(path);
    if (cur && version < cur.version) return;              // an older copy never replaces a newer one
    const doc = { data, version };
    this.server.set(path, doc); this.persist(path, doc); this.queueNotify(colOf(path));
  }
  private onChange(p: any) {
    if (p.eventType === 'DELETE') {
      const path = p.old?.collection + '/' + p.old?.id;
      if (!p.old?.collection) { this.fetchAll(); return; }
      this.server.delete(path); this.persist(path, null); this.queueNotify(colOf(path));
      return;
    }
    const row = p.new || {};
    const path = row.collection + '/' + row.id;
    if (row.data === undefined || row.version === undefined) { this.fetchDoc(path); return; }   // payload trimmed – fetch it
    this.applyServer(path, row.data, row.version);
  }

  /* ---------- writes ---------- */
  private async write(path: string, op: OutboxEntry['op'], data?: any): Promise<void> {
    const e: OutboxEntry = { path, op, data: data === undefined ? undefined : clone(data), at: Date.now() };
    try { e.seq = await this.local.addOutbox(e); } catch (err) { e.seq = -(++this.localSeq); }   // IndexedDB unavailable: memory only
    this.pending.push(e);
    this.queueNotify(colOf(path)); this.emitStatus();
    return new Promise((resolve, reject) => { this.waiters.set(e.seq!, { resolve, reject }); this.flush(); });
  }
  async flush() {
    if (this.flushing || this.stopped) return;
    this.flushing = true; this.emitStatus();
    try {
      while (this.pending.length && !this.stopped) {
        const e = this.pending[0];
        const r = await this.send(e);
        if (r.ok) {
          this.pending.shift();
          this.removeOutbox(e);
          this.applyAck(e, r.version ?? null);
          this.settle(e, null);
          this.retryDelay = 0;
          this.setOnline(true);
        } else if (r.transient) {
          this.setOnline(false);
          for (const q of this.pending) this.settle(q, null);   // kept on the device; the chip shows it waiting
          this.scheduleRetry();
          break;
        } else {
          this.pending.shift();
          this.removeOutbox(e);
          const msg = r.error?.message || r.error?.code || 'unknown error';
          if (!this.settle(e, { code: r.error?.code || 'rejected', message: msg })) this.onError('Could not save: ' + msg);
          this.queueNotify(colOf(e.path));
          this.fetchDoc(e.path);
        }
      }
    } finally {
      this.flushing = false; this.emitStatus();
    }
  }
  private async send(e: OutboxEntry): Promise<SendResult> {
    const [c, id] = split(e.path);
    try {
      let res: any;
      if (e.op === 'set') res = await this.sb.rpc('doc_set', { p_collection: c, p_id: id, p_data: e.data });
      else if (e.op === 'update') res = await this.sb.rpc('doc_merge', { p_collection: c, p_id: id, p_patch: e.data });
      else res = await this.sb.from('docs').delete().eq('collection', c).eq('id', id);
      if (res.error) return { ok: false, transient: isTransient(res.error, res.status), error: res.error };
      return { ok: true, version: typeof res.data === 'number' ? res.data : res.data != null ? +res.data : null };
    } catch (err) {
      return { ok: false, transient: true, error: err };
    }
  }
  private applyAck(e: OutboxEntry, version: number | null) {
    this.acked.set(e.path, Date.now());
    if (e.op === 'delete') { this.server.delete(e.path); this.persist(e.path, null); this.queueNotify(colOf(e.path)); return; }
    const cur = this.server.get(e.path);
    if (cur && version !== null && cur.version >= version) return;   // a newer server copy (with our change) already arrived
    const data = e.op === 'set' ? clone(e.data) : merged(cur?.data, e.data);
    const doc = { data, version: version ?? (cur?.version || 0) };
    this.server.set(e.path, doc); this.persist(e.path, doc); this.queueNotify(colOf(e.path));
  }
  private settle(e: OutboxEntry, err: any): boolean {
    const w = this.waiters.get(e.seq!); if (!w) return false;
    this.waiters.delete(e.seq!);
    if (err) w.reject(err); else w.resolve();
    return true;
  }
  private removeOutbox(e: OutboxEntry) { if ((e.seq || 0) > 0) this.local.removeOutbox(e.seq!).catch(() => {}); }
  private scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryDelay = Math.min(60000, this.retryDelay ? this.retryDelay * 2 : 3000);
    this.retryTimer = setTimeout(() => this.refresh(), this.retryDelay);
  }

  /* ---------- status & persistence ---------- */
  private setOnline(v: boolean) { if (this.online !== v) { this.online = v; this.emitStatus(); } }
  private status(): StoreStatus { return { online: this.online, pending: this.pending.length, flushing: this.flushing }; }
  private emitStatus() { const s = this.status(); this.statusFns.forEach(f => f(s)); }
  private persist(path: string, doc: ServerDoc | null) {
    this.persistQ.set(path, doc);
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      const puts: any[] = [], dels: string[] = [];
      this.persistQ.forEach((d, p) => (d ? puts.push({ path: p, data: d.data, version: d.version }) : dels.push(p)));
      this.persistQ.clear();
      if (puts.length) this.local.putDocs(puts).catch(() => {});
      if (dels.length) this.local.deleteDocs(dels).catch(() => {});
    }, 200);
  }
}

/* Files: private bucket `files`, id = "<uuid>.<ext>" (SPEC §2.5). Links are short-lived signed URLs. */
export class SupabaseFiles implements FileStore {
  private urls = new Map<string, { url: string; exp: number }>();
  constructor(private sb: SupabaseClient) {}
  async upload(f: Blob & { name?: string }) {
    const ext = (f.name?.match(/\.([a-z0-9]+)$/i)?.[1] || (f.type.split('/')[1] || 'bin')).toLowerCase();
    const id = crypto.randomUUID() + '.' + ext;
    const { error } = await this.sb.storage.from('files').upload(id, f, { contentType: f.type || undefined, upsert: false });
    if (error) throw error;
    return { id };
  }
  async url(id: string) {
    const hit = this.urls.get(id);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data, error } = await this.sb.storage.from('files').createSignedUrl(id, 3600);
    if (error || !data) throw error || new Error('No link');
    this.urls.set(id, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
    return data.signedUrl;
  }
}
