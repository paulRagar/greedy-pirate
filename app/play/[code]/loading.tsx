/**
 * Suspense fallback for /play/[code]. Kept intentionally minimal —
 * the join flow has its own pre-render states (AnonBootstrapGate +
 * JoinGate's modal), so a chrome-heavy skeleton here just adds
 * another flicker between identities.
 */
export default function RoomLoading() {
   return <div aria-busy='true' aria-label='Loading room' className='flex-1' />;
}
