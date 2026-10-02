/* ---------------- app state (from prototype core.js) ---------------- */
import { GMAP, LIAB } from './constants';
import type { Account, AccountsCfg, Catalog, Item, MainCfg, Milestone, MonthDoc, Who } from './types';
import type { DocStore, FileStore } from '../data/adapter';

export function lsGet(k: string): string | null { try { return localStorage.getItem(k) || null; } catch (e) { return null; } }
export function lsSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch (e) {} }

export interface UiState {
  view: string; month: string | null; year: string | null; yearMode: string; acc: string | null; msId: string | null; people: string;
  [k: string]: any;
}
export interface State {
  db: DocStore | null; user: any; downloads: any; assets: FileStore | null;
  cfg: { main: MainCfg | null; catalog: Catalog | null; accounts: AccountsCfg | null; [k: string]: any };
  months: Record<string, MonthDoc>; ms: Record<string, Milestone>;
  loaded: { config: boolean; months: boolean; ms: boolean };
  ver: number; canWrite: boolean; offline: boolean;
  ui: UiState;
  me: Who | null;
  deferRender?: boolean;
}

export const S: State = {
  db: null, user: null, downloads: null, assets: null,
  cfg: { main: null, catalog: null, accounts: null },
  months: {}, ms: {}, loaded: { config: false, months: false, ms: false },
  ver: 0, canWrite: true, offline: false,
  ui: { view: 'home', month: null, year: null, yearMode: 'act', acc: null, msId: null, people: 'b' },
  me: lsGet('pn_me') as Who | null,
};

export const pname = (w: string | undefined | null): string => (S.cfg.main?.people?.[w as Who]?.n) || (w === 'P' ? 'Piepie' : w === 'M' ? 'Munny' : 'Joint');
export const cat = (): Record<string, Item> => S.cfg.catalog?.items || {};
export const accs = (): Record<string, Account> => S.cfg.accounts?.accounts || {};
export const main = (): MainCfg => S.cfg.main || {};
export const kindOf = (g: string | undefined) => GMAP[g as string]?.sec || 'exp';
export const itemKind = (id: string) => kindOf(cat()[id]?.g);
export const monthKeys = () => Object.keys(S.months).filter(k => S.months[k]).sort();
export const isLiab = (a: Account | undefined | null) => LIAB.has(a?.t as string);

let memo: Record<string, any> = {};
export function cached<T>(key: string, fn: () => T): T { if (memo.__v !== S.ver) memo = { __v: S.ver }; if (!(key in memo)) memo[key] = fn(); return memo[key]; }
