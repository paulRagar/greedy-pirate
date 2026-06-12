import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
   throw new Error('Supabase URL and service role key must be set');
}

export const supabaseAdmin = createClient(url, serviceKey, {
   auth: { persistSession: false, autoRefreshToken: false },
});
