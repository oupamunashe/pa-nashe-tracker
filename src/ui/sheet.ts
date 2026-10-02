/* ===================== sheets, toasts, small DOM helpers (verbatim from prototype ui3.js / core.js) ===================== */
import { esc } from '../core/format';
import { I } from './icons';

export const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector(s) as T | null;
export const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [...el.querySelectorAll(s)] as T[];

interface SheetRec { el: HTMLElement; refresh?: (el: HTMLElement) => void; onMount?: (el: HTMLElement) => void }
export interface SheetOpts { title: string; body: string; foot?: string; onMount?: (el: HTMLElement) => void; refresh?: (el: HTMLElement) => void; wide?: boolean }

const sheetStack: SheetRec[] = [];
export function openSheet({ title, body, foot = '', onMount, refresh, wide }: SheetOpts): HTMLElement {
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'max-width:900px' : ''}">
    <div class="sheet-h"><h2>${esc(title)}</h2><button class="btn ghost sm" data-a="closesheet" aria-label="Close">${I.x}</button></div>
    <div class="sheet-b">${body}</div>${foot ? `<div class="sheet-f">${foot}</div>` : ''}</div>`;
  el.addEventListener('mousedown', e => { if (e.target === el) closeSheet(); });
  sheetsRoot().appendChild(el);
  const rec = { el, refresh, onMount };
  sheetStack.push(rec);
  onMount && onMount(el);
  setTimeout(() => { const f = el.querySelector<HTMLElement>('[autofocus]'); f && f.focus(); }, 60);
  return el;
}
export function closeSheet() { const s = sheetStack.pop(); if (s) s.el.remove(); }
export function closeAll() { while (sheetStack.length) closeSheet(); }
export function refreshSheet() { const s = sheetStack[sheetStack.length - 1]; if (s && s.refresh && !s.el.contains(document.activeElement)) s.refresh(s.el); }
export const sheetCount = () => sheetStack.length;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetStack.length) closeSheet(); });

/** #sheets lives in the shell; the sign-in screen has no shell, so create it on demand. */
function sheetsRoot(): HTMLElement {
  let r = document.getElementById('sheets');
  if (!r) { r = document.createElement('div'); r.id = 'sheets'; document.body.appendChild(r); }
  return r;
}

let toastT: any;
export function toast(msg: string, cls = '') {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2800);
}
export const val = (el: ParentNode, sel: string): string => (el.querySelector(sel) as HTMLInputElement | null)?.value?.trim() ?? '';
export const num = (el: ParentNode, sel: string) => { const v = parseFloat(String(val(el, sel)).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; };
