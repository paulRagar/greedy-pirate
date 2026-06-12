import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
   throw new Error('Supabase URL and anon key must be set');
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
   if (browserClient) return browserClient;
   browserClient = createBrowserClient(url!, anonKey!);
   return browserClient;
}
