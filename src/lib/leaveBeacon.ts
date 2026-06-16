/**
 * Shared key for the sessionStorage flag that suppresses the next
 * leave-room beacon. Use it whenever a client flow needs to reload the
 * page intentionally (e.g., signin seat transfer) and come back as a
 * still-seated member instead of being kicked by the unload handler.
 */
export const SKIP_LEAVE_BEACON_KEY = 'gp:skip-leave-beacon';
