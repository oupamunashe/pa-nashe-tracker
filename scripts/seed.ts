/* npm run seed -- <backup.json> [--yes]
   Loads a backup (the JSON from More → Download a full backup) into Supabase with the service-role key:
   1. uploads private/data/documents/*.pdf to the private `files` bucket (stable paths → safe to re-run),
   2. rewrites the old claude.ai asset ids listed in private/DATA-NOTES.md to the new storage paths,
   3. writes config, months and milestones with doc_set (full replace per document),
   4. checks every document reads back identically.
   Asks before overwriting existing documents (--yes skips the question) and separately before deleting
   documents that are not in the backup. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadEnv, nodeClient, requireEnv } from './env';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const yes = args.includes('--yes');
if (!file) { console.error('Usage: npm run seed -- <backup.json> [--yes]'); process.exit(1); }
if (!existsSync(file)) { console.error('Not found: ' + file); process.exit(1); }

const env = loadEnv();
requireEnv(env, 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const sb = nodeClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function ask(q: string): Promise<boolean> {
  if (!process.stdin.isTTY) { console.log(q + ' (no terminal to answer – treated as "no"; use --yes to confirm)'); return false; }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(q + ' Type yes to continue: ')).trim().toLowerCase();
  rl.close();
  return a === 'yes';
}

/** RFC 4122 v5 UUID (SHA-1, fixed namespace) – the same old id always gives the same storage path. */
function uuidv5(name: string) {
  const ns = Buffer.from('6f1c2a4e8b3d4f5a9c7e1d2b3a4c5d6e', 'hex');
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name)])).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

/** The "Old asset id | File" table in private/DATA-NOTES.md. */
function assetTable(): { oldId: string; file: string }[] {
  const notes = resolve('private/DATA-NOTES.md');
  if (!existsSync(notes)) return [];
  return [...readFileSync(notes, 'utf8').matchAll(/^\|\s*([0-9a-f]{32})\s*\|\s*([^|]+?)\s*\|/gm)].map(m => ({ oldId: m[1], file: m[2] }));
}

function rewrite(v: any, map: Record<string, string>): any {
  if (typeof v === 'string') return map[v] ?? v;
  if (Array.isArray(v)) return v.map(x => rewrite(x, map));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x, map)]));
  return v;
}

const backup = JSON.parse(readFileSync(file, 'utf8'));
for (const k of ['config', 'months', 'milestones']) if (!backup[k] || typeof backup[k] !== 'object') { console.error(`Not a tracker backup: "${k}" missing.`); process.exit(1); }
console.log(`Backup ${basename(file)} (exported ${backup.exported || 'unknown'}): config ${Object.keys(backup.config).length} · months ${Object.keys(backup.months).length} · milestones ${Object.keys(backup.milestones).length}`);

// 1. files
const json = JSON.stringify(backup);
const map: Record<string, string> = {};
for (const { oldId, file: f } of assetTable()) {
  const local = resolve('private/data/documents', f);
  const used = json.includes(oldId);
  if (!existsSync(local)) { if (used) console.warn(`  ! ${f} is referenced but missing from private/data/documents`); continue; }
  const id = uuidv5(oldId) + '.pdf';
  const { error } = await sb.storage.from('files').upload(id, readFileSync(local), { contentType: 'application/pdf', upsert: true });
  if (error) { console.error(`  ✗ upload ${f}: ${error.message}`); process.exit(1); }
  map[oldId] = id;
  console.log(`  ✓ uploaded ${f}${used ? ` (${json.split(oldId).length - 1} reference${json.split(oldId).length > 2 ? 's' : ''} rewritten)` : ' (not referenced by this backup)'}`);
}
const data = rewrite(backup, map);

// 2. what is there already
const docs: [string, string, any][] = [];
for (const c of ['config', 'months', 'milestones']) for (const [id, d] of Object.entries<any>(data[c])) if (d) docs.push([c, id, d]);
const { data: existing, error: ee } = await sb.from('docs').select('collection,id');
if (ee) { console.error('Could not read the database: ' + ee.message); process.exit(1); }
const have = new Set((existing || []).map(r => r.collection + '/' + r.id));
const overwrite = docs.filter(([c, id]) => have.has(c + '/' + id));
const extra = [...have].filter(p => !docs.some(([c, id]) => c + '/' + id === p));

if (overwrite.length && !yes) {
  console.log(`\nThe database already holds ${have.size} documents; ${overwrite.length} of them will be replaced by the backup.`);
  if (!(await ask('Replace them?'))) { console.log('Nothing written.'); process.exit(0); }
}

// 3. write
let n = 0;
for (const [c, id, d] of docs) {
  const { error } = await sb.rpc('doc_set', { p_collection: c, p_id: id, p_data: d });
  if (error) { console.error(`  ✗ ${c}/${id}: ${error.message}`); process.exit(1); }
  n++;
}
console.log(`  ✓ wrote ${n} documents`);

if (extra.length) {
  console.log(`\n${extra.length} document(s) in the database are not in this backup: ${extra.join(', ')}`);
  if (await ask('Delete them so the database matches the backup exactly?')) {
    for (const p of extra) { const [c, id] = p.split('/'); await sb.from('docs').delete().eq('collection', c).eq('id', id); }
    console.log(`  ✓ deleted ${extra.length}`);
  } else console.log('  kept them');
}

// 4. verify
const { data: back } = await sb.from('docs').select('collection,id,data');
const stable = (v: any): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));
const byPath = new Map((back || []).map(r => [r.collection + '/' + r.id, r.data]));
const bad = docs.filter(([c, id, d]) => stable(byPath.get(c + '/' + id)) !== stable(d));
const missingFiles: string[] = [];
for (const id of Object.values(map)) { const { error } = await sb.storage.from('files').createSignedUrl(id, 60); if (error) missingFiles.push(id); }
const all = JSON.stringify(back);
const leftover = assetTable().filter(({ oldId }) => all.includes(oldId));
if (bad.length || missingFiles.length || leftover.length) {
  console.error(`  ✗ verification failed: ${bad.map(([c, id]) => c + '/' + id).join(', ')} ${missingFiles.join(', ')} ${leftover.map(x => 'old id for ' + x.file).join(', ')}`);
  process.exit(1);
}
console.log(`  ✓ verified: all ${docs.length} documents read back identically; ${Object.keys(map).length} files reachable; no old asset ids left`);
