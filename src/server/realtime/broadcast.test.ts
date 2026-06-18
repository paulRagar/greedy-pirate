import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicGameState } from '@/game/public';

// broadcastLobbyEvent calls revalidatePath, which needs a Next request context.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import {
   broadcastKnockResolved,
   broadcastLobbyEvent,
   broadcastRoomState,
   userKnockTopic,
} from './broadcast';

// Minimal state stand-in — postBroadcast only JSON-stringifies the payload.
const fakeState = {} as PublicGameState;

type BroadcastMessage = { topic: string; event: string; private: boolean };

function lastMessage(fetchMock: ReturnType<typeof vi.fn>): BroadcastMessage {
   const [, init] = fetchMock.mock.calls.at(-1)!;
   const body = JSON.parse((init as RequestInit).body as string);
   return body.messages[0] as BroadcastMessage;
}

describe('realtime broadcast privacy', () => {
   let fetchMock: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
      fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
      vi.stubGlobal('fetch', fetchMock);
   });

   afterEach(() => {
      vi.unstubAllGlobals();
   });

   it('publishes room state on a PRIVATE room topic', async () => {
      await broadcastRoomState('abcd', {
         state: fakeState,
         spectators: [],
         actorId: null,
         eventType: 'DRAW',
      });
      const msg = lastMessage(fetchMock);
      expect(msg.topic).toBe('room:ABCD');
      expect(msg.private).toBe(true);
   });

   it('publishes knock resolution on the requester PRIVATE per-user topic', async () => {
      await broadcastKnockResolved({
         requestId: 'req-1',
         requesterId: 'user-123',
         outcome: 'approved',
      });
      const msg = lastMessage(fetchMock);
      expect(msg.topic).toBe(userKnockTopic('user-123'));
      expect(msg.topic).toBe('knock:user-123');
      expect(msg.private).toBe(true);
   });

   it('publishes lobby events on a PUBLIC channel', async () => {
      await broadcastLobbyEvent({ type: 'room_removed', code: 'ABCD' });
      const msg = lastMessage(fetchMock);
      expect(msg.topic).toBe('lobby:public');
      expect(msg.private).toBe(false);
   });
});
