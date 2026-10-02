/* Data model – docs/SPEC.md §3. Amounts are rand numbers; dates YYYY-MM-DD; months YYYY-MM. */
export type Who = 'P' | 'M';
export type Owner = Who | 'J';
export type SectionKey = 'in' | 'sav' | 'exp';

export interface Person { n: string; full?: string; alias?: string }
export interface Scenario { name: string; desc?: string; b: Record<string, [number, number]> }
export interface MainCfg {
  people?: Partial<Record<Who, Person>>;
  scenario?: '1' | '2' | '3';
  planBase?: number;
  scen?: Record<string, Scenario>;
  calc?: Record<string, Record<string, number>>;
  rules?: [string, string][];
  [k: string]: any;
}

export interface FundLink { a: string; s: number; x: number }
export interface Item { n: string; g: string; o?: number; pb?: string | null; rec?: boolean; arch?: boolean; fl?: FundLink[] }
export interface Catalog { items: Record<string, Item> }

export type AccType = 'savings' | 'goal' | 'credit' | 'loan' | 'bank' | 'lent';
export interface Account {
  n: string; t: AccType; ow: Owner; open: number | null; od: string | null;
  bank?: string; held?: string; goal?: number | null; gd?: string | null; limit?: number | null; rate?: number | null;
  minp?: number; due?: number; bf?: boolean; track?: boolean; note?: string; chk?: string; closed?: boolean;
}
export interface AccountsCfg { accounts: Record<string, Account> }

export interface Alloc { w: Who; v: number; u: 'amt' | 'pct'; lb?: string }
export interface Line { b: number; al?: Alloc[]; rec?: boolean; note?: string; paid?: boolean }
export interface Txn {
  d: string; mo: string; it: string; amt: number; store?: string; note?: string; pay?: string;
  by?: Who; src: 'import' | 'app' | 'statement'; at?: number; rc?: string;
}
export interface LedgerEntry {
  d: string; a: string; amt: number; ty: string; ds: string; src: string;
  bal?: number; at?: number; pair?: string; ref?: string;
}
export interface MonthDoc {
  y: number; m: number;
  lines: Record<string, Line | null>;
  txns: Record<string, Txn | null>;
  ledger: Record<string, LedgerEntry | null>;
}

export interface MsLine { n: string; sec: 'income' | 'expense'; grp?: string; b: number; cur: 'ZAR' | 'USD'; o?: number }
export interface MsTxn { d: string; l: string; amt: number; cur: 'ZAR' | 'USD'; note?: string; rc?: string }
export interface MsFile { id: string; n: string; d: string }
export interface Milestone {
  n: string; st: 'active' | 'done'; start?: string; end?: string; usd?: number | null; note?: string; o?: number;
  lines?: Record<string, MsLine | null>; txns?: Record<string, MsTxn | null>; files?: MsFile[];
}

export interface Backup {
  exported?: string;
  config: { main?: MainCfg; catalog?: Catalog; accounts?: AccountsCfg; [k: string]: any };
  months: Record<string, MonthDoc>;
  milestones: Record<string, Milestone>;
}
