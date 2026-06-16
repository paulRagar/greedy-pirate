'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/client/supabase/browser';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';

interface Props {
   /** Display-only — shown so the user sees they're boarding the right ship. */
   code: string;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function isTransientNetworkError(err: unknown): boolean {
   if (!err) return false;
   const msg = err instanceof Error ? err.message : String(err);
   return /networkerror|failed to fetch|fetch failed/i.test(msg);
}

/**
 * Bridges fresh visitors (no Supabase cookie) onto a private room link.
 * Without this, the RSC sees no user and historically redirected home —
 * dumping anyone who pasted an invite into incognito straight off the
 * landing path. Here we sign them in anonymously and reload, which lets
 * the RSC rerun with a valid session.
 */
export function AnonBootstrapGate({ code }: Props) {
   const [error, setError] = useState<string | null>(null);
   const [attempts, setAttempts] = useState(0);
   const tries = useRef(0);

   useEffect(() => {
      let cancelled = false;
      const supabase = getSupabaseBrowser();

      const run = async () => {
         setError(null);
         while (tries.current < MAX_ATTEMPTS && !cancelled) {
            tries.current += 1;
            setAttempts(tries.current);
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

   const retry = () => {
      tries.current = 0;
      setAttempts(0);
      setError(null);
      // Re-run the effect by toggling a state read inside it would be
      // cleaner, but a full reload is the most reliable way to get a
      // fresh Supabase client + cookies handshake.
      window.location.reload();
   };

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
            {error ? (
               <>
                  <p className='text-sm text-[color:var(--color-cream-200)]/80'>
                     Couldn&apos;t sign ye in anonymously.
                  </p>
                  <pre className='whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs text-[color:var(--color-coral-400)]'>
                     {error}
                  </pre>
                  <PirateButton variant='primary' size='md' fullWidth onClick={retry}>
                     Try again
                  </PirateButton>
               </>
            ) : (
               <>
                  <p className='animate-pulse text-sm text-[color:var(--color-cream-200)]/75'>
                     Hoisting yer flag…
                  </p>
                  {attempts > 1 && (
                     <p className='text-xs text-[color:var(--color-cream-200)]/55'>
                        Reconnecting (attempt {attempts}/{MAX_ATTEMPTS})…
                     </p>
                  )}
               </>
            )}
         </PiratePanel>
      </main>
   );
}
