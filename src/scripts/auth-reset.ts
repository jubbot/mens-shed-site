// Sends a password-reset email via Supabase
import { supabase } from '../lib/supabaseClient';

const form = document.getElementById('reset-form') as HTMLFormElement | null;
const statusEl = document.getElementById('reset-status') as HTMLElement | null;

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!statusEl) return;

  statusEl.textContent = '';
  statusEl.className = 'status';

  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim();

  const btn = form.querySelector('button') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('/reset/confirm', window.location.origin).href
    });
    if (error) throw error;
    statusEl.textContent = 'If that email exists, a reset link has been sent.';
    statusEl.classList.add('ok');
  } catch (err: any) {
    statusEl.textContent = err?.message ?? 'Could not send reset link';
    statusEl.classList.add('error');
  } finally {
    if (btn) btn.disabled = false;
  }
});
