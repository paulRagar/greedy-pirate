'use client';

import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/client/supabase/browser';

export type UserProfile = {
   id: string;
   displayName: string;
   isAnonymous: boolean;
};

export type CurrentUserState = {
   ready: boolean;
   user: User | null;
   profile: UserProfile | null;
   error: string | null;
   retry: () => void;
   refreshProfile: () => Promise<void>;
};

import { DEFAULT_DISPLAY_NAME, isDefaultDisplayName } from '@/lib/displayName';
export { isDefaultDisplayName };

/** Window event name used to broadcast "profile changed, refetch please". */
export const PROFILE_CHANGED_EVENT = 'gp:profile-changed';

/** Fire after a successful profile mutation so every useCurrentUser refetches. */
export function emitProfileChanged() {
   if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
   }
}

export function useCurrentUser(): CurrentUserState {
   const [user, setUser] = useState<User | null>(null);
   const [profile, setProfile] = useState<UserProfile | null>(null);
   const [ready, setReady] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [attempt, setAttempt] = useState(0);

   const refreshProfile = async () => {
      const supabase = getSupabaseBrowser();
      const {
         data: { user: current },
      } = await supabase.auth.getUser();
      if (!current) {
         setProfile(null);
         return;
      }
      const { data } = await supabase
         .from('users')
         .select('id, display_name, is_anonymous')
         .eq('id', current.id)
         .maybeSingle();
      if (!data) {
         setProfile(null);
         return;
      }
      setProfile({
         id: data.id as string,
         displayName: data.display_name as string,
         isAnonymous: data.is_anonymous as boolean,
      });
   };

   useEffect(() => {
      const supabase = getSupabaseBrowser();
      let active = true;
      setReady(false);
      setError(null);

      const bootstrap = async () => {
         const MAX_ANON_ATTEMPTS = 3;
         try {
            let {
               data: { user: current },
            } = await supabase.auth.getUser();

            if (!current) {
               // Cold-network races (especially fresh incognito) sometimes
               // surface as transient "NetworkError" / "Failed to fetch"
               // before Supabase is reachable. Retry a couple times before
               // surfacing the overlay so the common case stays silent.
               let lastErr: unknown = null;
               for (let attempt = 1; attempt <= MAX_ANON_ATTEMPTS; attempt += 1) {
                  const { data, error: signInError } = await supabase.auth.signInAnonymously();
                  if (!signInError) {
                     current = data.user;
                     lastErr = null;
                     break;
                  }
                  lastErr = signInError;
                  const msg = signInError.message ?? '';
                  const transient = /networkerror|failed to fetch|fetch failed/i.test(msg);
                  if (!transient || attempt === MAX_ANON_ATTEMPTS) break;
                  await new Promise((r) => setTimeout(r, 300 * attempt));
               }
               if (lastErr) throw lastErr;
            }

            if (!active) return;
            setUser(current);
            await refreshProfile();
            if (active) setReady(true);
         } catch (err) {
            console.error('Auth bootstrap failed', err);
            if (!active) return;
            const message = err instanceof Error ? err.message : 'Could not reach the auth service.';
            setError(message);
            setReady(true);
         }
      };

      bootstrap();

      const { data: sub } = supabase.auth.onAuthStateChange(
         (_event: AuthChangeEvent, session: Session | null) => {
            setUser(session?.user ?? null);
         },
      );

      // Cross-instance profile sync. Our server-side setDisplayName mutates
      // public.users + auth.users via the admin client, which does NOT fire
      // a USER_UPDATED event in the browser. So the modal explicitly
      // dispatches a window event after a successful update and every
      // useCurrentUser instance refetches.
      const onProfileChanged = () => {
         void refreshProfile();
      };
      window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);

      return () => {
         active = false;
         sub.subscription.unsubscribe();
         window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
      };
   }, [attempt]);

   return {
      ready,
      user,
      profile,
      error,
      retry: () => setAttempt((a) => a + 1),
      refreshProfile,
   };
}

export { DEFAULT_DISPLAY_NAME };
