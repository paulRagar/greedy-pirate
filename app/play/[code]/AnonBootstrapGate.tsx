'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function isTransientNetworkError(err: unknown): boolean {
   if (!err) return false;
   const msg = err instanceof Error ? err.message : String(err);
   return /networkerror|failed to fetch|fetch failed/i.test(msg);
}

/**
 * Bridges fresh visitors (no Supabase cookie) onto a private room
 * link. Renders a single tight loading state — no big card, no
 * boarding-pass chrome — so the page flows straight into the join
 * flow once the reload lands. Only swaps to a visible card when the
 * sign-in genuinely fails and the user needs to retry.
 */
export function AnonBootstrapGate({ code }: { code: string }) {
   const [error, setError] = useState<string | null>(null);
   const tries = useRef(0);

   useEffect(() => {
      let cancelled = false;
      const supabase = getSupabaseBrowser();

      const run = async () => {
         setError(null);
         while (tries.current < MAX_ATTEMPTS && !cancelled) {
            tries.current += 1;
            try {
               const existing = await supabase.auth.getUser();
               if (existing.data.user) {
                  if (!cancelled) window.location.reload();
                  return;
               }
               const { error: signInError } = await supabase.auth.signInAnonymously();
               if (signInError) throw signInError;
               if (!cancelled) window.location.reload();
               return;
            } catch (err) {
               if (cancelled) return;
               if (!isTransientNetworkError(err) || tries.current >= MAX_ATTEMPTS) {
                  setError(err instanceof Error ? err.message : 'Could not sign ye in.');
                  return;
               }
               await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * tries.current));
            }
         }
      };

      void run();
      return () => {
         cancelled = true;
      };
   }, []);

   if (error) {
      return (
         <main className='flex flex-1 flex-col items-center justify-center px-5 py-10'>
            <PiratePanel
               variant='deep'
               className='flex w-full max-w-sm flex-col items-center gap-3 text-center'
            >
               <span className='text-4xl' aria-hidden>
                  ⛵
               </span>
               <h1 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>
                  Boarding the {code}
               </h1>
               <p className='text-sm text-[color:var(--color-cream-200)]/80'>
                  Couldn&apos;t sign ye in anonymously.
               </p>
               <pre className='whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs text-[color:var(--color-coral-400)]'>
                  {error}
               </pre>
               <PirateButton
                  variant='primary'
                  size='md'
                  fullWidth
                  onClick={() => {
                     tries.current = 0;
                     window.location.reload();
                  }}
               >
                  Try again
               </PirateButton>
            </PiratePanel>
         </main>
      );
   }

   // Happy path — render nothing visible. The reload lands fast enough
   // that any spinner would be noisier than the brief blank moment.
   return <div aria-busy='true' aria-label='Boarding the ship' className='flex-1' />;
}
