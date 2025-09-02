import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase.from('sheds').select('*').limit(1);
  console.log('Supabase browser test:', { data, error });
})();
