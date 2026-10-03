/* ===================== Pa-Nashe Tracker · reference lists (from prototype core.js) ===================== */
import type { SectionKey } from './types';

export interface Group { k: string; n: string; sec: SectionKey }
export const GROUPS: Group[] = [
  { k: 'earned', n: 'Earned Income', sec: 'in' },
  { k: 'funding', n: 'Other Funding (drawdowns & loans)', sec: 'in' },
  { k: 'lt', n: 'Long-Term Savings & Investments (10yrs+)', sec: 'sav' },
  { k: 'it', n: 'Intermediate Savings & Investments (1-3yrs)', sec: 'sav' },
  { k: 'st', n: 'Short-Term Savings & Investments (0-12months)', sec: 'sav' },
  { k: 'protection', n: 'Protection and Insurances', sec: 'exp' },
  { k: 'housing', n: 'Housing Bills & Utilities', sec: 'exp' },
  { k: 'household', n: 'Household and Personal Expenses', sec: 'exp' },
  { k: 'health', n: 'Health & Wellness', sec: 'exp' },
  { k: 'debt', n: 'Debt & Repayments', sec: 'exp' },
  { k: 'onceoff', n: 'Other & Once-off Misc Expenses', sec: 'exp' },
  { k: 'family', n: 'Family & Relationships', sec: 'exp' },
  { k: 'giving', n: 'Giving', sec: 'exp' },
  { k: 'ownerloan', n: "Owner's Loan to Business", sec: 'exp' },
];
export const GMAP: any = Object.fromEntries(GROUPS.map((g, i) => [g.k, { ...g, i }]));
export const SECTIONS: { k: SectionKey; n: string }[] = [
  { k: 'in', n: 'Income' }, { k: 'sav', n: 'Savings & Investments' }, { k: 'exp', n: 'Expenses' },
];
export interface Bucket { k: string; n: string; cat: string; save?: boolean }
export const BUCKETS: Bucket[] = [
  { k: 'retire', n: 'Retirement & long-term (RA, TFSA)', cat: 'savings', save: true },
  { k: 'emergency', n: 'Emergency fund (incl. La Vie reserve)', cat: 'savings', save: true },
  { k: 'goals', n: 'Goals (baby, car, stokvels, travel)', cat: 'savings', save: true },
  { k: 'sultana', n: 'Sultana home (rent, electricity, WiFi)', cat: 'house' },
  { k: 'lavie', n: 'La Vie Estate net cost', cat: 'house' },
  { k: 'household', n: 'Household and Personal', cat: 'household' },
  { k: 'protection', n: 'Protection and Insurances', cat: 'health' },
  { k: 'health', n: 'Health & Wellness', cat: 'health' },
  { k: 'debt', n: 'Debts & Repayment', cat: 'debt' },
  { k: 'family', n: 'Family & Relationships', cat: 'other' },
  { k: 'giving', n: 'Giving', cat: 'other' },
  { k: 'onceoff', n: 'Other & Once-off Misc', cat: 'other' },
  { k: 'ownerloan', n: "Owner's Loan to Business", cat: 'other' },
];
export const SUMCATS = [
  { k: 'savings', n: 'Savings' }, { k: 'house', n: 'House Bills & Utilities' }, { k: 'household', n: 'Household and Personal' },
  { k: 'health', n: 'Health, Wellness & Protection' }, { k: 'debt', n: 'Debts & Repayment' }, { k: 'other', n: 'Other Expenses' },
];
export const ACC_TYPES: Record<string, string> = {
  savings: 'Savings & investments', goal: 'Goal (earmarked)', credit: 'Credit card / store account',
  loan: 'Loan', bank: 'Everyday account', lent: 'Money lent out',
};
export const LIAB = new Set(['credit', 'loan']);
/** Months before this were loaded from the old workbooks: nothing in them is still to pay. */
export const TRACKER_START = '2026-01';
export const isHistory = (k: string) => k < TRACKER_START;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
