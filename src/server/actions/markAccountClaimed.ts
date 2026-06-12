'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { getSupabaseServer } from '@/server/supabase/server';
import { revalidatePath } from 'next/cache';

export async function markAccountClaimed(): Promise<{ ok: boolean }> {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) return { ok: false };

   await db
      .update(users)
      .set({ isAnonymous: !!user.is_anonymous })
      .where(eq(users.id, user.id));

   revalidatePath('/profile');
   return { ok: true };
}
