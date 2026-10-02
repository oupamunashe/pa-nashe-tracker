/* A tiny stand-in for the supabase-js client: the docs table with versions, the two RPCs (same merge
   semantics as 0001_init.sql), row delete, and Realtime. Several adapters can share one FakeServer. */
import { merged } from '../../src/data/merge';

export class FakeServer {
  rows = new Map<string, { data: any; version: number }>();
  online = true;
  fail: { status: number; message: string; code?: string } | null = null;
  gate: Promise<void> | null = null;          // when set, RPCs wait for it (to observe optimistic state)
  clients = new Set<FakeSupabase>();
  calls: string[] = [];

  write(path: string, data: any, op: 'set' | 'merge') {
    const cur = this.rows.get(path);
    const row = { data: op === 'set' ? JSON.parse(JSON.stringify(data)) : merged(cur?.data, data), version: (cur?.version || 0) + 1 };
    this.rows.set(path, row);
    this.broadcast('UPDATE', path);
    return row.version;
  }
  remove(path: string) { this.rows.delete(path); this.broadcast('DELETE', path); }
  broadcast(type: 'UPDATE' | 'DELETE', path: string) {
    const [collection, id] = path.split('/');
    const row = this.rows.get(path);
    const p = type === 'DELETE' ? { eventType: 'DELETE', old: { collection, id } } : { eventType: 'UPDATE', new: { collection, id, data: row!.data, version: row!.version } };
    for (const c of this.clients) if (c.realtimeOn) setTimeout(() => c.realtimeCb?.(JSON.parse(JSON.stringify(p))), 2);
  }
}

export class FakeSupabase {
  realtimeCb: ((p: any) => void) | null = null;
  realtimeOn = true;
  constructor(public server: FakeServer) { server.clients.add(this); }

  private async net() {
    if (this.server.gate) await this.server.gate;
    if (!this.server.online) throw new TypeError('Failed to fetch');
  }
  async rpc(name: string, a: any) {
    await this.net();
    this.server.calls.push(name + ' ' + a.p_collection + '/' + a.p_id);
    if (this.server.fail) return { data: null, error: { message: this.server.fail.message, code: this.server.fail.code }, status: this.server.fail.status };
    const path = a.p_collection + '/' + a.p_id;
    const v = name === 'doc_set' ? this.server.write(path, a.p_data, 'set') : this.server.write(path, a.p_patch, 'merge');
    return { data: v, error: null, status: 200 };
  }
  from(_table: string) {
    const self = this;
    const filters: Record<string, string> = {};
    let mode: 'select' | 'delete' = 'select';
    const run = async () => {
      await self.net();
      const match = [...self.server.rows.entries()].filter(([p]) => {
        const [c, id] = p.split('/');
        return (!filters.collection || filters.collection === c) && (!filters.id || filters.id === id);
      });
      if (mode === 'delete') { match.forEach(([p]) => self.server.remove(p)); return { data: null, error: null, status: 204 }; }
      return { data: match.map(([p, r]) => { const [collection, id] = p.split('/'); return { collection, id, data: JSON.parse(JSON.stringify(r.data)), version: r.version }; }), error: null, status: 200 };
    };
    const q: any = {
      select() { mode = 'select'; return q; },
      delete() { mode = 'delete'; return q; },
      eq(k: string, v: string) { filters[k] = v; return q; },
      async maybeSingle() { const r: any = await run(); return { ...r, data: r.data?.[0] || null }; },
      then(res: any, rej: any) { return run().then(res, rej); },
    };
    return q;
  }
  channel(_name: string) {
    const self = this;
    const ch: any = {
      on(_e: string, _f: any, cb: any) { self.realtimeCb = cb; return ch; },
      subscribe(cb: any) { setTimeout(() => cb('SUBSCRIBED'), 1); return ch; },
    };
    return ch;
  }
  removeChannel() { this.realtimeOn = false; }
}
