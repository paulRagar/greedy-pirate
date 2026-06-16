import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/server/db/client';
import { games, userStats, users } from '@/server/db/schema';
import { getSupabaseServer } from '@/server/supabase/server';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { AccountUpgrade } from '@/client/auth/AccountUpgrade';
import { ProfileNameHeader } from './ProfileNameHeader';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect('/');

   const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
   });

   const displayName = profile?.displayName ?? 'Crewmate';

   // Anonymous users see only the sign-up gate — no stats or history yet.
   // The logbook starts tracking once they claim an account.
   if (profile?.isAnonymous) {
      return (
         <main className='flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-5 py-8 pb-[max(env(safe-area-inset-bottom),2rem)] sm:py-12'>
            <ProfileNameHeader initialName={displayName} isAnonymous size='md' />
            <p className='max-w-md text-center text-sm text-[color:var(--color-cream-200)]/75 sm:text-base'>
               Yer logbook is locked away in Davy Jones&apos; locker. Sign up to save yer voyages, doubloons,
               and wins forever.
            </p>
            <div className='w-full max-w-md'>
               <AccountUpgrade />
            </div>
         </main>
      );
   }

   const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, user.id),
   });

   const hostedGames = await db
      .select({
         id: games.id,
         deckVariant: games.deckVariant,
         mode: games.mode,
         completedAt: games.completedAt,
         createdAt: games.createdAt,
      })
      .from(games)
      .where(eq(games.hostId, user.id))
      .orderBy(desc(games.completedAt))
      .limit(25);

   const gameIds = hostedGames.map((g) => g.id);
   const seats = gameIds.length
      ? await db.query.gamePlayers.findMany({
           where: (table, { inArray }) => inArray(table.gameId, gameIds),
        })
      : [];

   const seatsByGame = seats.reduce<Record<string, typeof seats>>((acc, seat) => {
      const list = acc[seat.gameId] ?? [];
      list.push(seat);
      acc[seat.gameId] = list;
      return acc;
   }, {});

   const gamesPlayed = stats?.gamesPlayed ?? 0;
   const gamesWon = stats?.gamesWon ?? 0;
   const totalCoins = Number(stats?.totalCoinsCollected ?? 0);
   const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

   return (
      <main className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:py-10'>
         <ProfileNameHeader
            initialName={displayName}
            isAnonymous={false}
            userIdShort={user.id.slice(0, 8)}
            size='lg'
         />

         <section className='grid grid-cols-2 gap-3'>
            <Stat label='Voyages' value={gamesPlayed} tone='teal' />
            <Stat label='Won' value={gamesWon} suffix={gamesPlayed > 0 ? ` · ${winRate}%` : ''} tone='coral' />
            <Stat label='Total doubloons' value={totalCoins} tone='gold' wide />
         </section>

         <section className='flex flex-col gap-2'>
            <h2 className='pirate-display text-2xl text-[color:var(--color-gold-200)]'>Recent voyages</h2>
            {hostedGames.length === 0 ? (
               <PiratePanel variant='deep'>
                  <p className='text-sm text-[color:var(--color-cream-200)]/70'>
                     No games yet. Sail forth and plunder some treasure!
                  </p>
               </PiratePanel>
            ) : (
               <ul className='flex flex-col gap-2'>
                  {hostedGames.map((game) => {
                     const list = seatsByGame[game.id] ?? [];
                     const winner = list.find((seat) => seat.isWinner);
                     const completed = game.completedAt ?? game.createdAt;
                     return (
                        <li key={game.id}>
                           <PiratePanel variant='deep' className='flex flex-col gap-1 p-3'>
                              <div className='flex items-center justify-between gap-2 text-sm'>
                                 <div className='flex items-center gap-2'>
                                    <span className='pirate-display text-lg text-[color:var(--color-gold-200)]'>
                                       {prettyVariant(game.deckVariant)}
                                    </span>
                                    <span className='rounded-full bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider'>
                                       {game.mode}
                                    </span>
                                 </div>
                                 <time className='text-xs text-[color:var(--color-cream-200)]/60'>
                                    {formatDate(completed)}
                                 </time>
                              </div>
                              <div className='flex items-center justify-between gap-2 text-sm text-[color:var(--color-cream-200)]/80'>
                                 <span>
                                    Winner:{' '}
                                    <span className='font-semibold text-[color:var(--color-gold-300)]'>
                                       {winner?.displayName ?? '—'}
                                    </span>
                                 </span>
                                 <span className='font-semibold text-[color:var(--color-gold-300)]'>
                                    {winner?.coins ?? 0} doubloons
                                 </span>
                              </div>
                              <div className='text-xs text-[color:var(--color-cream-200)]/55'>
                                 {list.length} crewmates
                              </div>
                           </PiratePanel>
                        </li>
                     );
                  })}
               </ul>
            )}
         </section>
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
}: {
   label: string;
   value: number;
   suffix?: string;
   wide?: boolean;
   tone: keyof typeof STAT_TONE;
}) {
   return (
      <PiratePanel variant='deep' className={`flex flex-col gap-1 p-4 ${wide ? 'col-span-2' : ''}`}>
         <span className={`text-xs uppercase tracking-[0.2em] ${STAT_TONE[tone].label}`}>{label}</span>
         <span className={`pirate-display text-4xl ${STAT_TONE[tone].value}`}>
            {value}
            {suffix && <span className='ml-1 text-base text-[color:var(--color-cream-200)]/70'>{suffix}</span>}
         </span>
      </PiratePanel>
   );
}

function prettyVariant(variant: string) {
   if (variant === 'greedy') return 'Greedy';
   if (variant === 'even_greedier') return 'Even Greedier';
   if (variant === 'super_greedy') return 'Super Greedy';
   return variant;
}

function formatDate(date: Date | null) {
   if (!date) return '';
   return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
   }).format(date);
}
