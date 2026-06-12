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

const DEFAULT_DISPLAY_NAME = 'Crewmate';

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
         try {
            let {
               data: { user: current },
            } = await supabase.auth.getUser();

            if (!current) {
               const { data, error: signInError } = await supabase.auth.signInAnonymously();
               if (signInError) throw signInError;
               current = data.user;
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
