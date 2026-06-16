'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { AuthErrorOverlay } from './AuthErrorOverlay';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
   const { error, retry } = useCurrentUser();
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

   return (
      <>
         {children}
         {error && <AuthErrorOverlay message={error} hint={hostHint} onRetry={retry} />}
      </>
   );
}
