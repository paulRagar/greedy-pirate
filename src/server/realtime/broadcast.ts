import 'server-only';
import type { PublicGameState } from '@/game/public';

const TOPIC_PREFIX = 'room';
const BROADCAST_EVENT = 'state';

export function roomTopic(code: string): string {
   return `${TOPIC_PREFIX}:${code.toUpperCase()}`;
}

export const ROOM_BROADCAST_EVENT = BROADCAST_EVENT;

type BroadcastPayload = {
   state: PublicGameState;
   actorId: string | null;
   eventType: string;
};

export async function broadcastRoomState(
   code: string,
   payload: BroadcastPayload,
): Promise<void> {
   const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
   if (!url || !key) {
      console.error('[broadcast] Missing Supabase env vars');
      return;
   }

   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 3000);
   try {
      const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            apikey: key,
            Authorization: `Bearer ${key}`,
         },
         body: JSON.stringify({
            messages: [
               {
                  topic: roomTopic(code),
                  event: BROADCAST_EVENT,
                  payload,
                  private: false,
               },
            ],
         }),
         signal: controller.signal,
      });
      if (!response.ok) {
         const body = await response.text();
         console.error(`[broadcast] failed (${response.status}): ${body}`);
      }
   } catch (err) {
      console.error('[broadcast] threw', err);
   } finally {
      clearTimeout(timer);
   }
}
