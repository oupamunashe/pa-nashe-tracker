/* ---------- event wiring (from prototype io.js): one delegated listener, actions looked up by data-a ---------- */
import { closeSheet } from './sheet';

type Action = (d: DOMStringMap, el: HTMLElement, e: Event) => void;
export const ACT: Record<string, Action> = {
  closesheet: () => closeSheet(),
};
export function addActions(more: Record<string, Action>) { Object.assign(ACT, more); }

document.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const fn = ACT[el.dataset.a as string]; if (!fn) return;
  e.preventDefault(); fn(el.dataset, el, e);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).matches?.('[role="button"][data-a]')) { e.preventDefault(); (e.target as HTMLElement).click(); }
});
