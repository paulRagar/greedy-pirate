'use client';

import { useEffect, useRef, useState } from 'react';
import {
   deriveAnnouncement,
   type AnnounceSnapshot,
} from '@/client/a11y/gameAnnouncement';

/**
 * Narrates the core game loop to screen readers. Visual-only feedback (turn
 * banner, bust shake/vignette, chest burst, "deck empty" heading) has no SR
 * equivalent on its own — this hook renders an ALWAYS-MOUNTED `aria-live`
 * region whose text is the only thing that changes, so assistive tech reliably
 * voices turn changes, busts, and game-over without manual navigation.
 *
 * Diff-based like `useGameJuice`, so an optimistic update and its matching
 * broadcast (identical snapshots) announce exactly once.
 */
export function useGameAnnouncer(snap: AnnounceSnapshot) {
   const prev = useRef<AnnounceSnapshot | null>(null);
   const [message, setMessage] = useState('');
   const [assertive, setAssertive] = useState(false);

   useEffect(() => {
      const announcement = deriveAnnouncement(prev.current, snap);
      prev.current = snap;
      if (announcement) {
         setAssertive(announcement.assertive);
         setMessage(announcement.message);
      }
   }, [snap]);

   // Two regions kept permanently in the DOM (one polite, one assertive) so a
   // region exists before its content updates. We swap which one carries the
   // text rather than toggling `aria-live`, since changing politeness on a
   // live node is unreliable across screen readers.
   const announcer = (
      <>
         <div className='sr-only' aria-live='polite' aria-atomic='true' role='status'>
            {assertive ? '' : message}
         </div>
         <div className='sr-only' aria-live='assertive' aria-atomic='true' role='alert'>
            {assertive ? message : ''}
         </div>
      </>
   );

   return { announcer };
}
