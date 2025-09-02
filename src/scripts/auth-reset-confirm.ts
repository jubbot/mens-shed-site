// Exchanges the reset link for a session, validates strength & updates password
import { supabase } from '../lib/supabaseClient';

const statusEl = document.getElementById('newpass-status') as HTMLElement | null;
const form = document.getElementById('newpass-form') as HTMLFormElement | null;
const pwd = document.getElementById('password') as HTMLInputElement | null;
const confirm = document.getElementById('confirm') as HTMLInputElement | null;
const submit = document.getElementById('submit') as HTMLButtonElement | null;
const meter = document.getElementById('meter-bar') as HTMLDivElement | null;
const hints = document.getElementById('hints') as HTMLUListElement | null;

(async () => {
  try { await supabase.auth.exchangeCodeForSession(window.location.href); } catch {}
})();

function strengthReport(val: string) {
  const reqs = [
    { ok: val.length >= 8, text: 'At least 8 characters' },
    { ok: /[a-z]/.test(val), text: 'Lowercase letter' },
    { ok: /[A-Z]/.test(val), text: 'Uppercase letter' },
    { ok: /\d/.test(val), text: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(val), text: 'Symbol' },
  ];
  const score = reqs.reduce((s, r) => s + (r.ok ? 1 : 0), 0);
  return { score, reqs };
}
function paintMeter(score: number) {
  if (!meter) return;
  const pct = Math.min(100, score * 20);
  meter.style.width = pct + '%';
  meter.style.background = score >= 4 ? '#16a34a' : score >= 3 ? '#f59e0b' : '#ef4444';
}
function renderHints(reqs: {ok:boolean;text:string}[], matches: boolean) {
  if (!hints) return;
  hints.innerHTML = '';
  const frag = document.createDocumentFragment();
  reqs.forEach(r => {
    const li = document.createElement('li');
    li.textContent = (r.ok ? '✓ ' : '• ') + r.text;
    li.style.color = r.ok ? '#065f46' : '#6b7280';
    frag.appendChild(li);
  });
  const li2 = document.createElement('li');
  li2.textContent = (matches ? '✓ ' : '• ') + 'Passwords match';
  li2.style.color = matches ? '#065f46' : '#6b7280';
  frag.appendChild(li2);
  hints.appendChild(frag);
}
function validate() {
  const p = pwd?.value ?? '';
  const c = confirm?.value ?? '';
  const { score, reqs } = strengthReport(p);
  paintMeter(score);
  const matches = !!p && p === c;
  renderHints(reqs, matches);
  if (submit) submit.disabled = !(score >= 4 && matches);
}

pwd?.addEventListener('input', validate);
confirm?.addEventListener('input', validate);
validate();

// Show/hide toggles
document.querySelectorAll<HTMLButtonElement>('.peek').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target!) as HTMLInputElement;
    const isPwd = target.type === 'password';
    target.type = isPwd ? 'text' : 'password';
    btn.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
  });
});

// Submit new password
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!statusEl || !pwd || !submit) return;

  statusEl.textContent = '';
  statusEl.className = 'status';
  submit.disabled = true;

  try {
    const { error } = await supabase.auth.updateUser({ password: pwd.value });
    if (error) throw error;
    statusEl.textContent = 'Password updated. Redirecting to dashboard…';
    statusEl.classList.add('ok');
    setTimeout(() => window.location.replace('/dashboard'), 900);
  } catch (err: any) {
    statusEl.textContent = err?.message ?? 'Could not update password';
    statusEl.classList.add('error');
    submit.disabled = false;
  }
});
