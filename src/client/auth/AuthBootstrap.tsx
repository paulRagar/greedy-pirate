'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_DISPLAY_NAME, useCurrentUser } from './useCurrentUser';
import { NamePromptModal } from './NamePromptModal';
import { AuthErrorOverlay } from './AuthErrorOverlay';

/**
 * Routes that require a real display name (anything that touches online
 * multiplayer — local play uses player-entered seat names, no profile
 * name needed). The name prompt only appears when the user lands on or
 * navigates to one of these. Anywhere else the prompt is suppressed.
 */
const NAME_REQUIRED_PATHS = ['/play/new', '/play/join'];

function pathRequiresName(pathname: string): boolean {
   if (NAME_REQUIRED_PATHS.includes(pathname)) return true;
   // /play/[code] active room — any 4-char code-style segment.
   if (/^\/play\/[A-Za-z0-9]+$/.test(pathname) && pathname !== '/play/new' && pathname !== '/play/join') {
      return true;
   }
   return false;
}

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
   const { ready, profile, error, retry, refreshProfile } = useCurrentUser();
   const pathname = usePathname();
   const [dismissed, setDismissed] = useState(false);
   const [hostHint, setHostHint] = useState<string | null>(null);

   useEffect(() => {
      if (!error) return;
      try {
         const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
         if (!supabaseUrl || typeof window === 'undefined') return;
         const supabaseHost = new URL(supabaseUrl).hostname;
         const pageHost = window.location.hostname;
         const pageIsLan = pageHost !== 'localhost' && pageHost !== '127.0.0.1';
         const supabaseIsLocalLoopback = supabaseHost === 'localhost' || supabaseHost === '127.0.0.1';
         if (pageIsLan && supabaseIsLocalLoopback) {
            setHostHint(
               `This device is viewing the app at ${pageHost} but Supabase is configured to ${supabaseHost}. Update NEXT_PUBLIC_SUPABASE_URL in .env.local to the laptop's LAN IP (e.g. http://${pageHost}:54321) and restart \`npm run dev\`.`,
            );
         } else {
            setHostHint(null);
         }
      } catch {
         setHostHint(null);
      }
   }, [error]);

   const needsName =
      ready &&
      profile &&
      profile.displayName === DEFAULT_DISPLAY_NAME &&
      !dismissed &&
      pathRequiresName(pathname);

   return (
      <>
         {children}
         {error && <AuthErrorOverlay message={error} hint={hostHint} onRetry={retry} />}
         {needsName && (
            <NamePromptModal
               onComplete={async () => {
                  setDismissed(true);
                  await refreshProfile();
               }}
            />
         )}
      </>
   );
}
