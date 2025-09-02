// src/pages/api/upload.ts
import { supabase } from '../../lib/supabaseClient';

export async function post({ request }) {
  const form = await request.formData();
  const file = form.get('file') as File;
  const path = `projects/${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage.from('projects').upload(path, file);
  if (error) return new Response(error.message, { status: 400 });

  return new Response(JSON.stringify({ path }), { status: 200 });
}
