import { describe, expect, it } from 'vitest';
import type { PublicGameState } from '@/game/public';
import { gateStateVersion } from './versionGate';

/**
 * Simulate the client's broadcast pipeline using the pure gate: feed a
 * sequence of (version, state) broadcasts and return the final applied state
 * plus the list of versions that were actually applied.
 */
function runBroadcasts(
   inputs: ReadonlyArray<{ version?: number; state: PublicGameState }>,
   startVersion = 0,
   startState: PublicGameState | null = null,
): { state: PublicGameState | null; applied: number } {
   let applied = startVersion;
   let state = startState;
   for (const msg of inputs) {
      const gate = gateStateVersion(applied, msg.version);
      if (gate.apply) {
         applied = gate.nextVersion;
         state = msg.state;
      }
   }
   return { state, applied };
}

function mkState(label: string): PublicGameState {
   // Only `winnerId` is read by assertions — used as a cheap identity tag.
   return { winnerId: label } as unknown as PublicGameState;
}

describe('gateStateVersion', () => {
   it('applies a strictly newer version and advances the watermark', () => {
      expect(gateStateVersion(2, 3)).toEqual({ apply: true, nextVersion: 3 });
   });

   it('drops a version equal to the watermark', () => {
      expect(gateStateVersion(3, 3)).toEqual({ apply: false, nextVersion: 3 });
   });

   it('drops a version older than the watermark', () => {
      expect(gateStateVersion(3, 2)).toEqual({ apply: false, nextVersion: 3 });
   });

   it('applies a versionless (auxiliary) broadcast without moving the watermark', () => {
      expect(gateStateVersion(3, undefined)).toEqual({ apply: true, nextVersion: 3 });
   });
});

describe('broadcast ordering via the gate', () => {
   it('out-of-order [1,3,2] settles on v3 and drops v2', () => {
      const result = runBroadcasts([
         { version: 1, state: mkState('v1') },
         { version: 3, state: mkState('v3') },
         { version: 2, state: mkState('v2') },
      ]);
      // v1 and v3 applied, v2 dropped.
      expect(result.state?.winnerId).toBe('v3');
      expect(result.applied).toBe(3);
   });

   it('keeps an optimistic BANK when a pre-bank broadcast arrives late', () => {
      // Base state v5 already applied; user banks optimistically (local only,
      // watermark stays at 5). A late re-delivery of the pre-bank v5 broadcast
      // must NOT overwrite the optimistic state.
      const optimistic = mkState('optimistic-bank');
      const result = runBroadcasts(
         [{ version: 5, state: mkState('pre-bank') }],
         5,
         optimistic,
      );
      expect(result.state?.winnerId).toBe('optimistic-bank');
   });

   it("server's confirming broadcast (v6) reconciles the optimistic state", () => {
      const optimistic = mkState('optimistic-bank');
      const result = runBroadcasts(
         [
            { version: 5, state: mkState('pre-bank') }, // late, dropped
            { version: 6, state: mkState('confirmed-bank') }, // newer, applied
         ],
         5,
         optimistic,
      );
      expect(result.state?.winnerId).toBe('confirmed-bank');
      expect(result.applied).toBe(6);
   });

   it('resume: RSC state at v8 applied, then equal-version broadcast dropped (no flicker)', () => {
      // appliedVersion was 4 before the tab backgrounded; RSC refresh fetches v8.
      const result = runBroadcasts(
         [
            { version: 8, state: mkState('rsc-refresh') }, // newer than stale 4
            { version: 8, state: mkState('first-post-resume-broadcast') }, // equal → dropped
         ],
         4,
         mkState('stale'),
      );
      expect(result.state?.winnerId).toBe('rsc-refresh');
      expect(result.applied).toBe(8);
   });
});
