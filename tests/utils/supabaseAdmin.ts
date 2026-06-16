import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

function client(): SupabaseClient {
   if (cached) return cached;
   const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
   if (!url || !key) {
      throw new Error(
         'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — Playwright cannot seed accounts.',
      );
   }
   cached = createClient(url, key, { auth: { persistSession: false } });
   return cached;
}

/**
 * Provision an email/password account directly via the admin API,
 * skipping email confirmation. Useful for tests that need an existing
 * account to sign in with.
 *
 * Returns the auth user id. Display name (if provided) is written to
 * raw_user_meta_data so the public.users trigger picks it up.
 */
export async function createEmailUser(
   email: string,
   password: string,
   displayName?: string,
): Promise<string> {
   const sb = client();
   const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
   });
   if (error) throw error;
   if (!data.user) throw new Error('createUser returned no user');
   return data.user.id;
}

/** Best-effort teardown — keeps the local Supabase clean across runs. */
export async function deleteUser(userId: string): Promise<void> {
   const sb = client();
   await sb.auth.admin.deleteUser(userId).catch(() => undefined);
}
