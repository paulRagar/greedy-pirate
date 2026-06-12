export default function RoomLoading() {
   return (
      <main className='flex min-h-0 flex-1 flex-col gap-2 px-4 pt-2' aria-busy='true' aria-label='Loading room'>
         {/* score ribbon */}
         <div className='flex justify-center gap-2 py-1'>
            {Array.from({ length: 3 }).map((_, i) => (
               <div key={i} className='skeleton-shimmer h-11 w-24 rounded-full' style={{ opacity: 1 - i * 0.2 }} />
            ))}
         </div>

         {/* status banner */}
         <div className='flex min-h-[56px] flex-col items-center gap-2'>
            <div className='skeleton-shimmer h-8 w-56 rounded-lg' />
            <div className='skeleton-shimmer h-4 w-36 rounded' />
         </div>

         {/* card region */}
         <div className='flex min-h-0 flex-1 items-center justify-center'>
            <div className='skeleton-shimmer aspect-[3/4] h-full max-h-[346px] rounded-2xl' />
         </div>

         {/* action bar */}
         <div className='mt-auto flex gap-3 pt-2 safe-bottom'>
            <div className='skeleton-shimmer h-16 flex-1 rounded-2xl' />
            <div className='skeleton-shimmer h-16 flex-1 rounded-2xl' />
         </div>

         <p className='pirate-display animate-pulse pb-2 text-center text-xl text-[color:var(--color-gold-300)]/80'>
            Rowing out to the ship…
         </p>
      </main>
   );
}
