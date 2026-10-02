/* Supabase Auth (email + password) and the members allow-list – docs/SPEC.md §2.3.
   Only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY reach the browser; row-level security protects the data. */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { lsGet, lsSet } from '../core/state';
import type { Who } from '../core/types';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error('This build has no Supabase settings (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  // implicit flow: a reset link opened on another device than the one that asked for it still works
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  return client;
}

export type Membership = { person: Who } | 'not-member' | 'unknown';
/** The member row for the signed-in email. Remembered per user on the device so the app can open offline. */
export async function membership(session: Session): Promise<Membership> {
  const email = (session.user.email || '').toLowerCase();
  const key = 'pn_member:' + session.user.id;
  try {
    const { data, error } = await supabase().from('members').select('email, person');
    if (error) throw error;
    const row = (data || []).find(r => String(r.email).toLowerCase() === email);
    if (!row) { lsSet(key, ''); return 'not-member'; }
    lsSet(key, row.person);
    return { person: row.person as Who };
  } catch (e) {
    const cached = lsGet(key);
    return cached === 'P' || cached === 'M' ? { person: cached } : 'unknown';
  }
}

export const appUrl = () => location.origin + import.meta.env.BASE_URL;

export function authMessage(e: any): string {
  const m = String(e?.message || e || '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You’re offline – connect to the internet and try again.';
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(m)) return 'This email hasn’t been confirmed yet.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries – wait a few minutes and try again.';
  if (/should be different/i.test(m)) return 'Choose a password you haven’t used here before.';
  if (/password/i.test(m) && /(short|least|weak)/i.test(m)) return 'That password is too short or too simple.';
  if (/failed to fetch|network/i.test(m)) return 'Couldn’t reach the server – check your connection.';
  return m || 'Something went wrong.';
}
