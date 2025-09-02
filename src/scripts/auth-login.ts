// src/scripts/auth-login.ts
import { supabase } from '../lib/supabaseClient';

// If you have "isolatedModules": true and want to silence TS "script file" warnings,
// keep this at TOP LEVEL (not inside a block). Otherwise, you can remove it.
export {};

const form = document.getElementById('login-form') as HTMLFormElement | null;
const statusEl = document.getElementById('login-status') as HTMLElement | null;
const btn = document.getElementById('login-btn') as HTMLButtonElement | null;
const pwd = document.getElementById('login-password') as HTMLInputElement | null;
const caps = document.getElementById('caps') as HTMLElement | null;
const cooldownEl = document.getElementById('cooldown') as HTMLElement | null;

// If the form isn't on this page, quietly bail out.
if (!form) {
  console.warn('Login form not found; auth-login.ts loaded on a page without the form.');
  // Just stop executing without exporting anything.
  // (No top-level return in modules; just end of file execution here.)
}

// Show/hide password
document.querySelectorAll<HTMLButtonElement>('.peek').forEach((b) => {
  b.addEventListener('click', () => {
    const target = document.getElementById(b.dataset.target!) as HTMLInputElement | null;
    if (!target) return;
    const isPwd = target.type === 'password';
    target.type = isPwd ? 'text' : 'password';
    b.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
  });
});

// Caps Lock hint
const capsHandler = (e: KeyboardEvent) => {
  const isCaps = e.getModifierState && e.getModifierState('CapsLock');
  if (caps) caps.hidden = !isCaps;
};
pwd?.addEventListener('keydown', capsHandler);
pwd?.addEventListener('keyup', capsHandler);

// Simple client rate limiting
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const LS_KEY = 'login-attempts';
const LS_LOCK = 'login-locked-until';
const getAttempts = () => parseInt(localStorage.getItem(LS_KEY) || '0', 10);
const setAttempts = (n: number) => localStorage.setItem(LS_KEY, String(n));
const lockUntil = (ts: number) => localStorage.setItem(LS_LOCK, String(ts));
const lockedUntil = () => parseInt(localStorage.getItem(LS_LOCK) || '0', 10);

function updateLockUI() {
  const until = lockedUntil();
  const now = Date.now();
  const locked = !!until && until > now;
  if (btn) btn.disabled = locked;
  if (cooldownEl) {
    cooldownEl.hidden = !locked;
    if (locked) {
      const secs = Math.max(0, Math.ceil((until - now) / 1000));
      cooldownEl.textContent = `Too many attempts. Try again in ${secs}s.`;
    }
  }
  return locked;
}
function startCooldown() {
  lockUntil(Date.now() + LOCK_MS);
  const iv = setInterval(() => {
    if (!updateLockUI()) clearInterval(iv);
  }, 500);
  updateLockUI();
}
updateLockUI();

// If already logged in, bounce to redirect target
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const params = new URLSearchParams(location.search);
      location.replace(params.get('redirect') ?? '/dashboard');
    }
  } catch {
    // ignore — just means no session yet
  }
})();

// Submit
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!statusEl || !btn || !form) return;

  statusEl.textContent = '';
  statusEl.className = 'status';

  if (updateLockUI()) return;

  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  const redirectTo = String(fd.get('redirectTo') || '/dashboard');

  btn.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const friendly = (error.message === 'Invalid login credentials')
        ? 'Email does not exist or password is incorrect'
        : error.message;

      statusEl.textContent = friendly;
      statusEl.classList.add('error');

      const attempts = getAttempts() + 1;
      setAttempts(attempts);
      if (attempts >= MAX_ATTEMPTS) {
        setAttempts(0);
        startCooldown();
      }
      return;
    }

    setAttempts(0);
    statusEl.textContent = 'Signed in. Redirecting…';
    statusEl.classList.add('ok');
    window.location.replace(redirectTo);
  } catch {
    statusEl.textContent = 'Something went wrong. Please try again.';
    statusEl.classList.add('error');
  } finally {
    if (!updateLockUI()) btn.disabled = false;
  }
});
