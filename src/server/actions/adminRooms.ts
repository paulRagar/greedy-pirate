'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { games } from '@/server/db/schema';
import { getAdminUser } from '@/server/auth/admin';

export type AdminActionResult =
   | { ok: true; deleted: number }
   | { ok: false; error: string };

const DeleteRoomInput = z.object({ id: z.string().uuid() });

export async function deleteRoom(
   input: z.input<typeof DeleteRoomInput>,
): Promise<AdminActionResult> {
   const admin = await getAdminUser();
   if (!admin) return { ok: false, error: 'Not authorized' };

   const parsed = DeleteRoomInput.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   try {
      const deleted = await db
         .delete(games)
         .where(eq(games.id, parsed.data.id))
         .returning({ id: games.id });
      revalidatePath('/admin/rooms');
      return { ok: true, deleted: deleted.length };
   } catch (err) {
      console.error('deleteRoom failed', err);
      return { ok: false, error: 'Delete failed' };
   }
}

const DeleteAllInput = z.object({
   status: z.array(z.enum(['lobby', 'active', 'complete', 'abandoned'])).optional(),
});

export async function deleteAllRooms(
   input: z.input<typeof DeleteAllInput> = {},
): Promise<AdminActionResult> {
   const admin = await getAdminUser();
   if (!admin) return { ok: false, error: 'Not authorized' };

   const parsed = DeleteAllInput.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'Invalid input' };

   try {
      const deleted = parsed.data.status?.length
         ? await db
              .delete(games)
              .where(inArray(games.status, parsed.data.status))
              .returning({ id: games.id })
         : await db.delete(games).returning({ id: games.id });
      revalidatePath('/admin/rooms');
      return { ok: true, deleted: deleted.length };
   } catch (err) {
      console.error('deleteAllRooms failed', err);
      return { ok: false, error: 'Delete failed' };
   }
}
