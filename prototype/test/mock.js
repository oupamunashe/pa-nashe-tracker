(() => {
  const store = JSON.parse(window.__SEED__ || '{}');
  const listeners = [];
  const clone = o => JSON.parse(JSON.stringify(o));
  const merge = (a, b) => { for (const k of Object.keys(b)) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v); else a[k] = clone(v); } return a; };
  const notify = () => setTimeout(() => listeners.forEach(l => l()), 5);
  const snapDoc = (path) => ({ id: path.split('/').pop(), exists: !!store[path], data: () => store[path] ? clone(store[path]) : undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  window.__writes = [];
  const doc = path => ({
    id: path.split('/').pop(), path,
    get: async () => snapDoc(path),
    set: async d => { window.__writes.push(['set', path]); store[path] = clone(d); notify(); },
    update: async d => { window.__writes.push(['update', path, d]); if (!store[path]) throw { code: 'invalid_argument', message: 'missing doc' }; merge(store[path], d); notify(); },
    delete: async () => { delete store[path]; notify(); },
    onSnapshot: (next) => { const f = () => next(snapDoc(path)); listeners.push(f); setTimeout(f, 10); return () => {}; },
  });
  const collection = path => ({
    path, doc: id => doc(path + '/' + (id || Math.random().toString(36).slice(2))),
    onSnapshot: (next) => {
      const f = () => { const docs = Object.keys(store).filter(p => p.startsWith(path + '/') && p.split('/').length === path.split('/').length + 1).sort().map(snapDoc); next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }); };
      listeners.push(f); setTimeout(f, 30); return () => {};
    },
  });
  const db = { doc, collection };
  const user = { can: async () => true, id: async () => 'u1', me: async () => ({ id: 'u1', name: 'Test' }), isOwner: async () => true, canEdit: async () => true };
  window.__saved = [];
  const downloads = { save: async r => { window.__saved.push(r.filename); let d = r.data; if (d instanceof Blob) d = new Uint8Array(await d.arrayBuffer()); else if (typeof d === 'string') d = new TextEncoder().encode(d); let bin=''; d.forEach(c=>bin+=String.fromCharCode(c)); window.__file = btoa(bin); return { status: 'saved' }; } };
  const assets = { upload: async f => ({ id: 'a'.repeat(32), url: '/_blob/x' }) };
  window.claude = { use: async n => ({ db, user, downloads, assets }[n] || null) };
  window.__store = store;
})();
