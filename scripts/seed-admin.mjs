import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const email = 'admin@mensshedtownsville.au';
const password = 'op3@eRv/W:9v"`CfB/p3';

const { data: u, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;

await supa.from('profiles').upsert({ id: u.user.id, display_name: 'Townsville Admin', role: 'admin' });
console.log('✅ MST admin created:', email);
