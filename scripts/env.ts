/* Reads .env.local for local Node scripts (seed, check). Never used by the browser bundle. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export function loadEnv(file = '.env.local'): Record<string, string> {
  const path = resolve(file);
  if (!existsSync(path)) throw new Error(`${file} not found – copy .env.example to ${file} and fill it in.`);
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

export function requireEnv(env: Record<string, string>, ...keys: string[]) {
  const missing = keys.filter(k => !env[k] || /YOUR-|your-/.test(env[k]));
  if (missing.length) throw new Error(`Missing in .env.local: ${missing.join(', ')}`);
}

/** supabase-js client for Node 20 scripts (no native WebSocket before Node 22). */
export const nodeClient = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as any } });
