import 'server-only';
import { getSupabaseServer } from '@/server/supabase/server';

function adminEmails(): Set<string> {
   const raw = process.env.ADMIN_EMAILS ?? '';
   return new Set(
      raw
         .split(',')
         .map((s) => s.trim().toLowerCase())
         .filter(Boolean),
   );
}

export type AdminUser = { id: string; email: string };

export async function getAdminUser(): Promise<AdminUser | null> {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user?.email) return null;
   const email = user.email.toLowerCase();
   if (!adminEmails().has(email)) return null;
   return { id: user.id, email };
}
