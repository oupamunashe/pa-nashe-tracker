/* Downloads, the Excel library and stored files – the production replacements for claude.ai's
   downloads/assets runtime (SPEC §2, §2.5). Toast wording kept from the prototype's saveFile(). */
import { S } from '../core/state';
import { toast } from '../ui/sheet';

let xlsxP: Promise<any> | null = null;
/** SheetJS, lazy-loaded (its own chunk; cached by the service worker for offline use). */
export function loadXLSX(): Promise<any> {
  return xlsxP || (xlsxP = import('xlsx').catch(() => { xlsxP = null; throw new Error('Could not load the Excel library'); }));
}

const touchDevice = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Save a file: the share sheet on phones (Save to Files / send), a normal download elsewhere. */
export async function saveFile(filename: string, data: Blob | string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/i.test(filename) ? 'application/json' : 'text/plain' });
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (touchDevice() && (navigator as any).canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); toast('Saved ' + filename); return; }
      catch (e: any) {
        if (e?.name === 'AbortError') return;          // closed the share sheet
        // NotAllowedError (no recent tap after a slow export) → fall back to a download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast('Saved ' + filename);
  } catch (e: any) {
    toast('Download didn’t complete: ' + (e?.message || e?.code), 'bad');
  }
}

/** Open a stored file (receipt, invoice). The window opens synchronously inside the tap so phones allow it,
    then goes to a short-lived signed link. */
export async function openFile(id: string) {
  if (!S.assets || !id) return;
  const w = window.open('', '_blank');
  try {
    const url = await S.assets.url(id);
    if (w) w.location.href = url; else location.href = url;
  } catch (e: any) {
    w?.close();
    toast('Couldn’t open the file' + (navigator.onLine === false ? ' – you’re offline.' : ': ' + (e?.message || 'unknown error')), 'bad');
  }
}
