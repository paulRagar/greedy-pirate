import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/server/db/client';
import { userAchievements, userStats, users } from '@/server/db/schema';
import { getSupabaseServer } from '@/server/supabase/server';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { AccountUpgrade } from '@/client/auth/AccountUpgrade';
import { AccountSettings } from '@/client/auth/AccountSettings';
import { ProfileNameHeader } from './ProfileNameHeader';
import { StatInfo } from './StatInfo';

export const dynamic = 'force-dynamic';

const AUTH_BANNERS: Record<string, { tone: 'info' | 'success' | 'error'; text: string }> = {
   'email-changed': {
      tone: 'success',
      text: 'Email change confirmed.',
   },
   'password-reset': {
      tone: 'success',
      text: 'Password reset. You are signed in.',
   },
   failed: { tone: 'error', text: 'Auth link expired or invalid. Try again.' },
   'missing-code': { tone: 'error', text: 'Auth link was incomplete.' },
};

export default async function ProfilePage({
   searchParams,
}: {
   searchParams: Promise<{ auth?: string }>;
}) {
   const params = await searchParams;
   const banner = params.auth ? AUTH_BANNERS[params.auth] : undefined;
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect('/');

   const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
   });

   const displayName = profile?.displayName ?? 'Crewmate';

   // Anonymous users get a teaser: their voyage count (the one stat that hooks
   // them) plus a locked preview of everything signing up would unlock. We do
   // not surface their other stats or PII-bearing history here.
   if (profile?.isAnonymous) {
      const anonStats = await db.query.userStats.findFirst({
         where: eq(userStats.userId, user.id),
      });
      const anonVoyages = anonStats?.gamesPlayed ?? 0;
      return (
         <main className='flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-5 py-8 pb-[max(env(safe-area-inset-bottom),2rem)] sm:py-12'>
            <ProfileNameHeader initialName={displayName} isAnonymous size='md' />

            <section className='w-full max-w-md'>
               <Stat
                  label='Voyages sailed'
                  value={anonVoyages}
                  tone='teal'
                  wide
                  info='Total games you have finished as a guest. Sign up to keep them forever.'
               />
            </section>

            <PiratePanel variant='deep' className='w-full max-w-md p-4'>
               <h2 className='pirate-display text-xl text-[color:var(--color-gold-200)]'>
                  More treasure awaits
               </h2>
               <p className='mt-1 text-sm text-[color:var(--color-cream-200)]/75'>
                  Sign up to unlock yer full logbook — wins &amp; win rate, biggest single haul, pirates
                  faced, longest streak, and a wall of achievements to plunder.
               </p>
               <ul className='mt-3 flex flex-wrap gap-2'>
                  {ACHIEVEMENTS.map((a) => (
                     <li
                        key={a.code}
                        className='flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-xs text-[color:var(--color-cream-200)]/55'
                        title={a.description}
                     >
                        <span aria-hidden className='opacity-50 grayscale'>
                           {a.icon}
                        </span>
                        {a.title}
                     </li>
                  ))}
               </ul>
            </PiratePanel>

            <div className='w-full max-w-md'>
               <AccountUpgrade />
            </div>
         </main>
      );
   }

   const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, user.id),
   });

   // NOTE: a per-voyage "Recent Voyages" logbook is deferred to GRE-34 — online
   // game rows are recycled across rounds (continuation resets status/completed_at),
   // so there's no durable per-voyage record to list until we persist a voyage
   // history snapshot at completion.

   const unlockedRows = await db.query.userAchievements.findMany({
      where: eq(userAchievements.userId, user.id),
   });
   const unlockedCodes = new Set(unlockedRows.map((row) => row.code));

   const gamesPlayed = stats?.gamesPlayed ?? 0;
   const gamesWon = stats?.gamesWon ?? 0;
   const totalCoins = Number(stats?.totalCoinsCollected ?? 0);
   const biggestHaul = stats?.biggestSingleBank ?? 0;
   const piratesFaced = stats?.totalPiratesEncountered ?? 0;
   const longestStreak = stats?.longestStreakValue ?? 0;
   const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

   return (
      <main className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:py-10'>
         {banner && (
            <div
               className={
                  banner.tone === 'success'
                     ? 'rounded-lg border border-[color:var(--color-teal-500)]/40 bg-[color:var(--color-teal-600)]/15 px-3 py-2 text-sm text-[color:var(--color-teal-200)]'
                     : banner.tone === 'error'
                     ? 'rounded-lg border border-[color:var(--color-coral-500)]/50 bg-[color:var(--color-coral-600)]/15 px-3 py-2 text-sm text-[color:var(--color-coral-200)]'
                     : 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm'
               }
            >
               {banner.text}
            </div>
         )}

         <ProfileNameHeader initialName={displayName} isAnonymous={false} size='lg' />

         {profile?.email && (
            <p className='-mt-3 text-center text-sm text-[color:var(--color-cream-200)]/65'>
               <span className='font-mono'>{profile.email}</span>
            </p>
         )}

         <section className='grid grid-cols-2 gap-3'>
            <Stat
               label='Voyages'
               value={gamesPlayed}
               tone='teal'
               info='Total games you have finished, across local and online play.'
            />
            <Stat
               label='Won'
               value={gamesWon}
               suffix={gamesPlayed > 0 ? ` · ${winRate}%` : ''}
               tone='coral'
               info='Games you finished in first place, and your overall win rate.'
            />
            <Stat
               label='Total doubloons'
               value={totalCoins}
               tone='gold'
               wide
               info='Every coin you have banked, added up across all your games.'
            />
            <Stat
               label='Biggest haul'
               value={biggestHaul}
               tone='gold'
               info='The most coins you have banked in a single turn.'
            />
            <Stat
               label='Pirates faced'
               value={piratesFaced}
               tone='coral'
               info='Pirate cards you have drawn on your own turns.'
            />
            <Stat
               label='Longest streak'
               value={longestStreak}
               tone='teal'
               wide
               info='The most cards you held in one streak before banking or busting.'
            />
         </section>

         <p className='-mt-2 text-center text-xs text-[color:var(--color-cream-200)]/50'>
            Stats and achievements count online games only — local pass-and-play voyages don&apos;t affect
            your record.
         </p>

         <section className='flex flex-col gap-2'>
            <h2 className='pirate-display text-2xl text-[color:var(--color-gold-200)]'>Achievements</h2>
            <ul className='grid grid-cols-2 gap-3'>
               {ACHIEVEMENTS.map((a) => {
                  const unlocked = unlockedCodes.has(a.code);
                  return (
                     <li key={a.code}>
                        <PiratePanel
                           variant='deep'
                           className={`flex h-full items-start gap-3 p-3 ${
                              unlocked ? '' : 'opacity-55'
                           }`}
                        >
                           <span
                              aria-hidden
                              className={`text-2xl leading-none ${unlocked ? '' : 'grayscale'}`}
                           >
                              {a.icon}
                           </span>
                           <div className='flex flex-col gap-0.5'>
                              <span className='flex items-center gap-1.5'>
                                 <span
                                    className={`text-sm font-semibold ${
                                       unlocked
                                          ? 'text-[color:var(--color-gold-300)]'
                                          : 'text-[color:var(--color-cream-200)]/70'
                                    }`}
                                 >
                                    {a.title}
                                 </span>
                                 {unlocked && (
                                    <span
                                       className='rounded-full bg-[color:var(--color-teal-600)]/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--color-teal-200)]'
                                       aria-label='Unlocked'
                                    >
                                       ✓ Unlocked
                                    </span>
                                 )}
                              </span>
                              <span className='text-xs text-[color:var(--color-cream-200)]/60'>
                                 {a.description}
                              </span>
                           </div>
                        </PiratePanel>
                     </li>
                  );
               })}
            </ul>
         </section>

         {profile?.email && <AccountSettings currentEmail={profile.email} />}
      </main>
   );
}

const STAT_TONE = {
   teal: { label: 'text-[color:var(--color-teal-400)]', value: 'text-[color:var(--color-teal-300)]' },
   coral: { label: 'text-[color:var(--color-coral-400)]', value: 'text-[color:var(--color-coral-400)]' },
   gold: { label: 'text-[color:var(--color-gold-400)]', value: 'text-[color:var(--color-gold-300)]' },
} as const;

function Stat({
   label,
   value,
   suffix,
   wide,
   tone,
   info,
}: {
   label: string;
   value: number;
   suffix?: string;
   wide?: boolean;
   tone: keyof typeof STAT_TONE;
   info?: string;
}) {
   return (
      <PiratePanel variant='deep' className={`flex flex-col gap-1 p-4 ${wide ? 'col-span-2' : ''}`}>
         <span className='flex items-center gap-1.5'>
            <span className={`text-xs uppercase tracking-[0.2em] ${STAT_TONE[tone].label}`}>{label}</span>
            {info && <StatInfo label={label} description={info} />}
         </span>
         <span className={`pirate-display text-4xl ${STAT_TONE[tone].value}`}>
            {value}
            {suffix && <span className='ml-1 text-base text-[color:var(--color-cream-200)]/70'>{suffix}</span>}
         </span>
      </PiratePanel>
   );
}
