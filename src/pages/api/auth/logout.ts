import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = getSupabaseServerClient({ request, cookies });
  await supabase.auth.signOut();
  return redirect('/?flash=loggedOut'); // 👈 triggers flash
};
