/* ---------- settings & who (from prototype ui3.js) + signed-in account section (SPEC §2.3) ---------- */
import { session } from '../../auth/session';
import { esc } from '../../core/format';
import { hooks } from '../../core/hooks';
import { S, lsSet, main, pname } from '../../core/state';
import type { Who } from '../../core/types';
import { saveMain } from '../../data/db';
import { closeSheet, openSheet, toast } from '../sheet';
import { sheetPassword } from '../signin';

export function sheetWho() {
  openSheet({
    title: 'Who’s using this device?',
    body: `<p class="muted">New entries will be marked as paid by you. You can change it on each entry.</p>
      <div class="grid2">${['P', 'M'].map(w => `<button class="person ${w}" data-me="${w}" style="text-align:left;cursor:pointer"><div class="big">${esc(pname(w))}</div></button>`).join('')}</div>`,
    onMount: el => el.querySelectorAll<HTMLElement>('[data-me]').forEach(b => b.onclick = () => { S.me = b.dataset.me as Who; lsSet('pn_me', S.me); closeSheet(); hooks.render(); }),
  });
}

export function sheetSettings() {
  const p: any = main().people || {};
  const theme = document.documentElement.dataset.theme || 'auto';
  openSheet({
    title: 'Settings',
    body: `<h3 style="margin-bottom:8px">Names</h3>
      ${['P', 'M'].map(w => `<div class="f2"><div class="field"><label>Name in the app</label><input class="inp" data-pn="${w}.n" value="${esc(p[w]?.n || '')}"></div><div class="field"><label>Name on bank statements</label><input class="inp" data-pn="${w}.full" value="${esc(p[w]?.full || '')}"></div></div>
        <div class="field"><label>Other names that appear on statements (comma-separated)</label><input class="inp" data-pn="${w}.alias" value="${esc(p[w]?.alias || '')}"></div>`).join('')}
      <p class="small muted">Statement import uses these names to tell who paid for each row.</p>
      <h3 style="margin:8px 0">This device</h3>
      <div class="row wrap" style="margin-bottom:14px"><span>Using it:</span><b>${S.me ? esc(pname(S.me)) : 'not set'}</b><button class="btn sm" id="st-who">Change</button></div>
      <div class="field"><span class="lab">Appearance</span><div class="seg" id="st-theme">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${theme === v}">${n}</button>`).join('')}</div></div>
      ${session.active ? `<h3 style="margin:8px 0">Your sign-in</h3>
      <div class="row wrap" style="margin-bottom:10px"><span>Signed in as</span><b style="overflow-wrap:anywhere">${esc(session.email)}</b></div>
      <div class="row wrap"><button class="btn sm" id="st-pw">Change password</button><button class="btn sm danger" id="st-out">Sign out</button></div>` : ''}`,
    foot: `<button class="btn" data-a="closesheet">Close</button><button class="btn primary" id="st-save">Save names</button>`,
    onMount: el => {
      (el.querySelector('#st-who') as HTMLElement).onclick = () => { closeSheet(); sheetWho(); };
      el.querySelectorAll<HTMLElement>('#st-theme button').forEach(b => b.onclick = () => {
        const v = b.dataset.v as string; if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
        lsSet('pn_theme', v);
        el.querySelectorAll('#st-theme button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      });
      (el.querySelector('#st-save') as HTMLElement).onclick = async () => {
        const people = JSON.parse(JSON.stringify(p));
        el.querySelectorAll<HTMLInputElement>('[data-pn]').forEach(i => { const [w, f] = (i.dataset.pn as string).split('.'); people[w] = people[w] || {}; people[w][f] = i.value.trim(); });
        await saveMain({ people }); toast('Saved'); closeSheet();
      };
      const pw = el.querySelector('#st-pw') as HTMLElement | null; pw && (pw.onclick = () => sheetPassword(false));
      const out = el.querySelector('#st-out') as HTMLElement | null; out && (out.onclick = () => confirmSignOut());
    },
  });
}

function confirmSignOut() {
  const n = session.pending();
  if (!n) { session.signOut(); return; }
  openSheet({
    title: 'Sign out?',
    body: `<div class="notice"><b>${n} change${n > 1 ? 's haven’t' : ' hasn’t'} been sent yet.</b> This device is offline or still saving. Signing out now deletes ${n > 1 ? 'them' : 'it'} from this device.</div>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn danger" id="so-go">Sign out anyway</button>`,
    onMount: el => { (el.querySelector('#so-go') as HTMLElement).onclick = () => session.signOut(); },
  });
}
