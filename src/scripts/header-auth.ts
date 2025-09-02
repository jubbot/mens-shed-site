// src/scripts/header-auth.ts
import { supabaseBrowser } from '../lib/supabaseClient';

function sanitize(text: string) {
  const el = document.createElement('div');
  el.textContent = text ?? '';
  return el.innerHTML;
}

async function upgradeAuthSlot() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;
  if (slot.getAttribute('data-ssr-user') === '1') return; // already rendered server-side

  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) return;

  let name = session.user.user_metadata?.display_name || session.user.email || 'User';

  // Optionally fetch profiles.display_name if not in metadata
  if (!session.user.user_metadata?.display_name) {
    try {
      const { data, error } = await supabaseBrowser
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();
      if (!error && data?.display_name) name = data.display_name;
    } catch {
      /* ignore */
    }
  }

  slot.innerHTML = `
    <details class="user-menu">
      <summary class="user-summary">
        <i class="wt-user1" aria-hidden="true"></i>
        <span class="hello">Hello ${sanitize(name)}</span>
      </summary>
      <ul class="user-dropdown">
        <li><a href="/dashboard"><i class="wt-mountain" aria-hidden="true"></i> Dashboard</a></li>
        <li>
          <form action="/api/auth/logout" method="post">
            <button type="submit"><i class="wt-logout" aria-hidden="true"></i> Logout</button>
          </form>
        </li>
      </ul>
    </details>
  `;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', upgradeAuthSlot);
} else {
  upgradeAuthSlot();
}
