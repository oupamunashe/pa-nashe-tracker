/* npm run check – read-only health check of the Supabase project (uses the service-role key from .env.local).
   Prints counts and settings only: no emails, keys or financial figures. */
import { loadEnv, nodeClient, requireEnv } from './env';

const env = loadEnv();
requireEnv(env, 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
const url = env.VITE_SUPABASE_URL;
const admin = nodeClient(url, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = nodeClient(url, env.VITE_SUPABASE_ANON_KEY);

const ok = (c: boolean, msg: string) => console.log((c ? '  ✓ ' : '  ✗ ') + msg);

const settings = await (await fetch(url + '/auth/v1/settings', { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } })).json();
ok(settings.disable_signup === true, 'public sign-ups are switched off');
ok(settings.external?.email === true, 'email sign-in is on');

const { data: members, error: me } = await admin.from('members').select('person');
ok(!me && !!members, 'members table readable' + (me ? ': ' + me.message : ''));
const persons = (members || []).map(m => m.person).sort().join(',');
ok(persons === 'M,P', `two members, one P and one M (found: ${persons || 'none'})`);

const { data: users } = await admin.auth.admin.listUsers();
const emails = new Set((users?.users || []).map(u => (u.email || '').toLowerCase()));
const { data: mm } = await admin.from('members').select('email');
ok((mm || []).every(m => emails.has(m.email.toLowerCase())), 'each member has a sign-in account');
ok((users?.users || []).every(u => u.email_confirmed_at), 'sign-in accounts are confirmed');

const { data: docs, error: de } = await admin.from('docs').select('collection,id');
ok(!de, 'docs table readable' + (de ? ': ' + de.message : ''));
const by = (c: string) => (docs || []).filter(d => d.collection === c).length;
console.log(`    docs: config ${by('config')} · months ${by('months')} · milestones ${by('milestones')}`);

const { data: buckets } = await admin.storage.listBuckets();
const files = buckets?.find(b => b.id === 'files');
ok(!!files && !files.public, 'private storage bucket "files" exists');
const { data: objs } = await admin.storage.from('files').list('', { limit: 1000 });
console.log(`    files in bucket: ${(objs || []).filter(o => o.id).length}`);

const { data: anonDocs } = await anon.from('docs').select('id');
ok((anonDocs || []).length === 0, 'signed-out visitors see no documents (row-level security)');
const { error: anonWrite } = await anon.rpc('doc_merge', { p_collection: 'config', p_id: '__probe', p_patch: {} });
ok(!!anonWrite, 'signed-out visitors cannot write');
