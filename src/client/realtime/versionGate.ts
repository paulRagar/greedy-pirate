/**
 * Pure version gate for incoming room `state` broadcasts.
 *
 * Broadcasts are independent HTTP POSTs (`ack:false`), so they can arrive
 * out of order or late. Each game-advancing broadcast carries a monotonic
 * `version` (the `game_events.seq` of the step that produced it). The client
 * tracks the highest version it has applied and drops anything that isn't
 * strictly newer.
 *
 * Versionless broadcasts (auxiliary refreshes — spectator join/leave, knock
 * resolution, host change) carry the *current* server state without advancing
 * the game, so they always apply and never move the watermark.
 */
export type VersionGateResult = {
   /** Whether the caller should apply this broadcast's `state`. */
   readonly apply: boolean;
   /** The new highest-applied version to store. */
   readonly nextVersion: number;
};

export function gateStateVersion(
   lastApplied: number,
   incoming: number | undefined,
): VersionGateResult {
   if (incoming === undefined) {
      // No version on this payload — an auxiliary refresh of current state.
      // Apply it but leave the watermark untouched so it can't suppress a
      // later genuinely-newer game step.
      return { apply: true, nextVersion: lastApplied };
   }
   if (incoming <= lastApplied) {
      return { apply: false, nextVersion: lastApplied };
   }
   return { apply: true, nextVersion: incoming };
}
