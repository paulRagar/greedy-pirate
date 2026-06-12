'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { supabaseAdmin } from '@/server/supabase/admin';
import { getSupabaseServer } from '@/server/supabase/server';

const NameSchema = z
   .string()
   .trim()
   .min(1, 'Name cannot be empty')
   .max(40, 'Name must be 40 characters or fewer');

export type SetDisplayNameResult = { ok: true; name: string } | { ok: false; error: string };

export async function setDisplayName(input: string): Promise<SetDisplayNameResult> {
   const parsed = NameSchema.safeParse(input);
   if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid name' };
   }

   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) {
      return { ok: false, error: 'Not signed in' };
   }

   await db.update(users).set({ displayName: parsed.data }).where(eq(users.id, user.id));

   await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { display_name: parsed.data },
   });

   return { ok: true, name: parsed.data };
}
