/* Sign-in, forgot / set new password, and “This tracker is private” – docs/SPEC.md §2.3.
   Built from the prototype's building blocks (panel, field, inp, btn, brandmark dot) so it matches the app. */
import { appUrl, authMessage, supabase } from '../auth/auth';
import { esc } from '../core/format';
import { closeSheet, openSheet, toast, val } from './sheet';

const frame = (inner: string) => `<main class="signin"><div class="signin-in">
  <div class="brandmark"><span class="logo" role="img" aria-label="PM"></span>Pa-Nashe Tracker</div>${inner}</div></main><div id="sheets"></div>`;

export function showSignIn(prefill = '') {
  document.body.innerHTML = frame(`
    <form class="panel" id="si-form" novalidate>
      <h1>Sign in</h1>
      <div class="field"><label for="si-email">Email</label><input id="si-email" class="inp" type="email" autocomplete="username" inputmode="email" value="${esc(prefill)}" required></div>
      <div class="field"><label for="si-pass">Password</label><input id="si-pass" class="inp" type="password" autocomplete="current-password" required></div>
      <p class="small" id="si-msg" role="status" aria-live="polite"></p>
      <button class="btn primary" id="si-go" type="submit">Sign in</button>
      <button class="btn ghost sm" id="si-forgot" type="button">Forgot password?</button>
    </form>`);
  const form = document.getElementById('si-form') as HTMLFormElement, msg = document.getElementById('si-msg')!, go = document.getElementById('si-go') as HTMLButtonElement;
  const say = (t: string, bad = true) => { msg.textContent = t; msg.className = 'small ' + (bad ? 'neg' : 'muted'); };
  (prefill ? document.getElementById('si-pass') : document.getElementById('si-email'))!.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = val(form, '#si-email'), password = (document.getElementById('si-pass') as HTMLInputElement).value;
    if (!email || !password) return say('Enter your email and password.');
    go.disabled = true; go.textContent = 'Signing in…'; say('', false);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) { go.disabled = false; go.textContent = 'Sign in'; say(authMessage(error)); }
    // success: onAuthStateChange(SIGNED_IN) in main.ts takes over
  });
  document.getElementById('si-forgot')!.addEventListener('click', async () => {
    const email = val(form, '#si-email');
    if (!email) { say('Type your email above, then tap Forgot password? again.'); (document.getElementById('si-email') as HTMLInputElement).focus(); return; }
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    if (error) say(authMessage(error));
    else say('If that email belongs to this tracker, a link to set a new password is on its way. Check your inbox.', false);
  });
}

export function showPrivate(email: string, onSignOut: () => void) {
  document.body.innerHTML = frame(`
    <section class="panel">
      <h1>This tracker is private</h1>
      <p class="muted">You’re signed in as <b>${esc(email)}</b>, which isn’t one of this tracker’s members.</p>
      <button class="btn primary" id="pv-out">Sign out</button>
    </section>`);
  document.getElementById('pv-out')!.addEventListener('click', onSignOut);
}

export function showMessage(title: string, text: string) {
  document.body.innerHTML = frame(`<section class="panel"><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p></section>`);
}

/** “Set a new password” after a reset link; also Settings → Change password. */
export function sheetPassword(recovery = false) {
  openSheet({
    title: recovery ? 'Set a new password' : 'Change password',
    body: `${recovery ? '<p class="muted">Choose the password you’ll use to sign in from now on.</p>' : ''}
      <div class="field"><label for="pw-1">New password</label><input id="pw-1" class="inp" type="password" autocomplete="new-password" autofocus></div>
      <div class="field"><label for="pw-2">Type it again</label><input id="pw-2" class="inp" type="password" autocomplete="new-password"></div>
      <p class="small muted">Use at least 8 characters.</p>`,
    foot: `<button class="btn" data-a="closesheet">Cancel</button><button class="btn primary" id="pw-save">Save password</button>`,
    onMount: el => {
      const btn = el.querySelector('#pw-save') as HTMLButtonElement;
      btn.onclick = async () => {
        const a = (el.querySelector('#pw-1') as HTMLInputElement).value, b = (el.querySelector('#pw-2') as HTMLInputElement).value;
        if (a.length < 8) return toast('Use at least 8 characters.', 'bad');
        if (a !== b) return toast('The two passwords don’t match.', 'bad');
        btn.disabled = true;
        const { error } = await supabase().auth.updateUser({ password: a });
        btn.disabled = false;
        if (error) return toast(authMessage(error), 'bad');
        toast('Password saved'); closeSheet();
      };
    },
  });
}
