import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/server/supabase/server';
import { fetchVoyagesForUser } from '@/server/voyages';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { VoyageCard } from '../VoyageCard';

export const dynamic = 'force-dynamic';

// Generous cap — a year of casual play stays well under this, and old voyages
// are pruned by the cleanup cron.
const MAX_VOYAGES = 100;

export default async function VoyagesPage() {
   const supabase = await getSupabaseServer();
   const {
      data: { user },
   } = await supabase.auth.getUser();
   if (!user) redirect('/');

   const voyages = await fetchVoyagesForUser(user.id, MAX_VOYAGES);

   return (
      <main className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:py-10'>
         <div className='flex items-center justify-between gap-2'>
            <h1 className='pirate-display text-3xl text-[color:var(--color-gold-200)]'>Yer logbook</h1>
            <Link
               href='/profile'
               className='rounded-lg px-2 py-1 text-sm font-semibold text-[color:var(--color-teal-300)] transition-colors hover:text-[color:var(--color-teal-200)]'
            >
               ← Profile
            </Link>
         </div>

         {voyages.length === 0 ? (
            <PiratePanel variant='deep'>
               <p className='text-sm text-[color:var(--color-cream-200)]/70'>
                  No online voyages yet. Start a room and plunder some treasure!
               </p>
            </PiratePanel>
         ) : (
            <ul className='flex flex-col gap-3'>
               {voyages.map((voyage) => (
                  <li key={voyage.id}>
                     <VoyageCard voyage={voyage} youId={user.id} detailed />
                  </li>
               ))}
            </ul>
         )}
      </main>
   );
}
