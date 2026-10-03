/* SupabaseAdapter on a fake Supabase client + fake IndexedDB: optimistic writes, ordering, concurrency,
   offline outbox and replay, stale echoes, refused writes. */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { QuerySnap, StoreStatus } from '../../src/data/adapter';
import { LocalStore } from '../../src/data/offline';
import { SupabaseAdapter, isTransient } from '../../src/data/supabase';
import { FakeServer, FakeSupabase } from '../helpers/fake-supabase';

const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
let server: FakeServer;
let n = 0;
const made: SupabaseAdapter[] = [];

function client(user = 'u' + ++n) {
  const sb = new FakeSupabase(server);
  const errors: string[] = [];
  const a = new SupabaseAdapter(sb as any, new LocalStore(user), m => errors.push(m));
  made.push(a);
  const last: Record<string, QuerySnap> = {};
  for (const c of ['config', 'months', 'milestones'] as const) a.collection(c).onSnapshot(s => { last[c] = s; });
  let status: StoreStatus = { online: true, pending: 0, flushing: false };
  a.onStatus(s => { status = s; });
  const doc = (path: string) => { const [c, id] = path.split('/'); return last[c]?.docs.find(d => d.id === id)?.data(); };
  return { a, sb, errors, doc, status: () => status, user };
}

beforeEach(() => {
  server = new FakeServer();
  server.rows.set('months/2030-01', { data: { y: 2030, m: 1, lines: {}, txns: { t1: { amt: 1 } }, ledger: {} }, version: 3 });
  server.rows.set('config/main', { data: { planBase: 1 }, version: 1 });
});
afterEach(() => { made.splice(0).forEach(a => a.stop()); });

describe('SupabaseAdapter', () => {
  it('loads every document and calls the listeners', async () => {
    const c = client(); await c.a.start(); await tick();
    expect(c.doc('months/2030-01').txns.t1.amt).toBe(1);
    expect(c.doc('config/main').planBase).toBe(1);
  });

  it('shows a write immediately, before the server answers', async () => {
    const c = client(); await c.a.start(); await tick();
    let open!: () => void; server.gate = new Promise(r => { open = r; });
    const p = c.a.doc('months/2030-01').update({ txns: { t2: { amt: 2 } } });
    await tick();
    expect(c.doc('months/2030-01').txns).toEqual({ t1: { amt: 1 }, t2: { amt: 2 } });
    expect(c.status().pending).toBe(1);
    server.gate = null; open(); await p; await tick();
    expect(server.rows.get('months/2030-01')!.data.txns.t2.amt).toBe(2);
    expect(c.status().pending).toBe(0);
  });

  it('two people saving different entries at the same moment both survive', async () => {
    const A = client(), B = client();
    await Promise.all([A.a.start(), B.a.start()]); await tick();
    await Promise.all([A.a.doc('months/2030-01').update({ txns: { a1: { amt: 10 } } }), B.a.doc('months/2030-01').update({ txns: { b1: { amt: 20 } } })]);
    await tick(60);
    for (const c of [A, B]) expect(Object.keys(c.doc('months/2030-01').txns).sort()).toEqual(['a1', 'b1', 't1']);
  });

  it('sends writes in the order they were made', async () => {
    const c = client(); await c.a.start(); await tick();
    await Promise.all([
      c.a.doc('months/2030-02').update({ y: 2030, m: 2, lines: {}, txns: {}, ledger: {} }),
      c.a.doc('months/2030-02').update({ txns: { x: { amt: 1 } } }),
      c.a.doc('months/2030-02').update({ txns: { x: null } }),
    ]);
    expect(server.calls.filter(s => s.endsWith('2030-02'))).toHaveLength(3);
    expect(server.rows.get('months/2030-02')!.data.txns).toEqual({ x: null });
  });

  it('offline: the write is kept, shown, counted, and sent when the connection returns', async () => {
    const c = client(); await c.a.start(); await tick();
    server.online = false;
    await c.a.doc('months/2030-01').update({ txns: { off: { amt: 5 } } });   // resolves: kept on the device
    await c.a.doc('config/main').update({ planBase: 2 });
    await tick();
    expect(c.status()).toMatchObject({ online: false, pending: 2 });
    expect(c.doc('months/2030-01').txns.off.amt).toBe(5);
    expect(server.rows.get('months/2030-01')!.data.txns.off).toBeUndefined();
    server.online = true;
    await c.a.refresh(); await tick(60);
    expect(server.rows.get('months/2030-01')!.data.txns.off.amt).toBe(5);
    expect(server.rows.get('config/main')!.data.planBase).toBe(2);
    expect(c.status()).toMatchObject({ online: true, pending: 0 });
  });

  it('the outbox survives a restart and is replayed', async () => {
    const c = client('same-user'); await c.a.start(); await tick();
    server.online = false;
    await c.a.doc('months/2030-01').update({ txns: { saved: { amt: 7 } } });
    await tick(250);                                   // let the cache persist
    c.a.stop();
    server.online = true;
    const again = client('same-user');
    await again.a.start(); await tick(80);
    expect(server.rows.get('months/2030-01')!.data.txns.saved.amt).toBe(7);
    expect(again.status().pending).toBe(0);
  });

  it('opens from the device cache while offline', async () => {
    const c = client('cache-user'); await c.a.start(); await tick(250);
    c.a.stop();
    server.online = false;
    const again = client('cache-user');
    await again.a.start(); await tick();
    expect(again.doc('months/2030-01').txns.t1.amt).toBe(1);
    expect(again.status().online).toBe(false);
  });

  it('applies changes made on another device (Realtime)', async () => {
    const c = client(); await c.a.start(); await tick();
    server.write('months/2030-01', { txns: { other: { amt: 9 } } }, 'merge');
    await tick();
    expect(c.doc('months/2030-01').txns.other.amt).toBe(9);
  });

  it('ignores an older copy arriving after a newer one', async () => {
    const c = client(); await c.a.start(); await tick();
    (c.sb as any).realtimeCb({ eventType: 'UPDATE', new: { collection: 'months', id: '2030-01', data: { txns: { old: 1 } }, version: 2 } });
    await tick();
    expect(c.doc('months/2030-01').txns.old).toBeUndefined();
  });

  it('a document deleted elsewhere disappears on refetch', async () => {
    const c = client(); await c.a.start(); await tick();
    c.sb.realtimeOn = false;                            // missed the event
    server.rows.delete('config/main');
    await c.a.refresh(); await tick();
    expect(c.doc('config/main')).toBeUndefined();
  });

  it('a refused write is dropped and reported', async () => {
    const c = client(); await c.a.start(); await tick();
    server.fail = { status: 403, message: 'new row violates row-level security policy', code: '42501' };
    await expect(c.a.doc('config/main').update({ planBase: 99 })).rejects.toMatchObject({ code: '42501' });
    server.fail = null; await tick(40);
    expect(c.doc('config/main').planBase).toBe(1);
    expect(c.status().pending).toBe(0);
  });

  it('classifies network problems as temporary', () => {
    expect(isTransient(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransient({ message: 'x' }, 503)).toBe(true);
    expect(isTransient({ message: 'JWT expired', code: 'PGRST301' }, 401)).toBe(true);
    expect(isTransient({ message: 'violates row-level security', code: '42501' }, 403)).toBe(false);
  });
});

describe('request timeout', () => {
  it('database requests are aborted after the limit and count as temporary', async () => {
    const { timedFetch, DB_TIMEOUT_MS } = await import('../../src/auth/auth');
    expect(DB_TIMEOUT_MS).toBe(20_000);
    const seen: any[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_i: any, init: any) => { seen.push(init?.signal); return new Response('[]'); }) as any;
    try {
      await timedFetch('https://x.supabase.co/rest/v1/docs?select=id');
      await timedFetch('https://x.supabase.co/storage/v1/object/files/a.png', { method: 'POST' });
    } finally { globalThis.fetch = real; }
    expect(seen[0]).toBeInstanceOf(AbortSignal);      // database: limited
    expect(seen[1]).toBeUndefined();                  // uploads: no limit
    expect(isTransient(new DOMException('signal timed out', 'TimeoutError'))).toBe(true);
  });
});
