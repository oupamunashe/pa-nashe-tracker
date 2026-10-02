/* Deep merge – port of merge() in prototype/test/mock.js; mirrors public.jsonb_deep_merge in 0001_init.sql:
   objects merge key by key (recursively); arrays, scalars and null replace; null is kept (tombstone).
   `undefined` values are skipped, exactly as JSON serialisation drops them on the way to the server. */
export const clone = <T>(o: T): T => (o === undefined ? o : JSON.parse(JSON.stringify(o)));
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Merges b into a (mutates and returns a). */
export function merge(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
  for (const k of Object.keys(b)) {
    const v = b[k];
    if (v === undefined) continue;
    if (isObj(v) && isObj(a[k])) merge(a[k], v);
    else a[k] = clone(v);
  }
  return a;
}

/** Non-mutating: the document after applying patch (creates from the patch when doc is missing). */
export function merged(doc: Record<string, any> | null | undefined, patch: Record<string, any>): Record<string, any> {
  return isObj(doc) ? merge(clone(doc), patch) : merge({}, patch);
}
