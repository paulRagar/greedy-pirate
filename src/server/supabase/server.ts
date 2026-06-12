import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
   throw new Error('Supabase URL and anon key must be set');
}

export async function getSupabaseServer() {
   const cookieStore = await cookies();

   return createServerClient(url!, anonKey!, {
      cookies: {
         getAll: () => cookieStore.getAll(),
         setAll: (toSet) => {
            try {
               toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {
               // Called from a Server Component — cookies are read-only there.
               // Middleware refreshes the session, so this is safe to ignore.
            }
         },
      },
   });
}
