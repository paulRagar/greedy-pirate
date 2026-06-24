'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PirateButton } from '@/ui/pirate-button/PirateButton';
import { PiratePanel } from '@/ui/pirate-panel/PiratePanel';
import { CrewGrid } from '@/ui/game-room/CrewGrid';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/game/rules';
import { cn } from '@/lib/cn';

interface Player {
   id: string;
   name: string;
}

export default function SetupClient() {
   const router = useRouter();
   const inputRef = useRef<HTMLInputElement>(null);
   const [starting, startTransition] = useTransition();

   const [playerName, setPlayerName] = useState('');
   const [players, setPlayers] = useState<Player[]>([]);
   const [deck, setDeck] = useState<'classic' | 'cursed'>('classic');

   useEffect(() => {
      try {
         const raw = localStorage.getItem('players');
         const parsed = raw ? (JSON.parse(raw) as Player[]) : [];
         if (Array.isArray(parsed) && parsed.length) setPlayers(parsed);
      } catch {
         // ignore corrupt storage
      }
   }, []);

   const addPlayer = () => {
      const name = playerName.trim();
      if (!name || players.length >= MAX_PLAYERS) return;
      setPlayers((prev) => [...prev, { id: crypto.randomUUID(), name }]);
      setPlayerName('');
      inputRef.current?.focus();
   };

   const removePlayer = (id: string) => {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
   };

   const startGame = () => {
      localStorage.setItem('players', JSON.stringify(players));
      const href = deck === 'cursed' ? '/play-local?variant=cursed' : '/play-local';
      startTransition(() => {
         router.push(href);
      });
   };

   const canStart = players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS;

   return (
      <main className='flex min-h-0 flex-1 flex-col gap-3 px-5 pt-2 sm:gap-4'>
         <header className='flex flex-col gap-1 text-center'>
            <h1 className='wordmark-gold pirate-display text-4xl sm:text-6xl'>Muster Yer Crew</h1>
            <p className='text-sm text-[color:var(--color-cream-200)]/75'>
               {MIN_PLAYERS}–{MAX_PLAYERS} sailors. Add ye lot below.
            </p>
         </header>

         <PiratePanel variant='deep' className='flex flex-col gap-2 p-3'>
            <label htmlFor='player-name' className='text-sm font-semibold text-[color:var(--color-cream-100)]'>
               Add a crewmate
            </label>
            <div className='flex gap-2'>
               <input
                  ref={inputRef}
                  id='player-name'
                  type='text'
                  inputMode='text'
                  autoComplete='off'
                  autoCapitalize='words'
                  maxLength={24}
                  value={playerName}
                  placeholder='Name…'
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                        e.preventDefault();
                        addPlayer();
                     }
                  }}
                  className='input-pirate flex-1 text-base'
               />
               <PirateButton
                  variant='tertiary'
                  size='md'
                  onClick={addPlayer}
                  disabled={!playerName.trim() || players.length >= MAX_PLAYERS}
               >
                  + Add
               </PirateButton>
            </div>
         </PiratePanel>

         <div className='scrollbar-none min-h-0 flex-1 overflow-y-auto'>
            <CrewGrid players={players} capacity={MAX_PLAYERS} onRemove={removePlayer} />
         </div>

         <div className='mt-auto flex flex-col gap-2 pt-2 safe-bottom'>
            <div className='flex gap-2' role='radiogroup' aria-label='Deck type'>
               <DeckToggle
                  selected={deck === 'classic'}
                  onSelect={() => setDeck('classic')}
                  title='Classic'
                  subtitle='Gold & pirates'
               />
               <DeckToggle
                  selected={deck === 'cursed'}
                  onSelect={() => setDeck('cursed')}
                  title='Cursed Seas'
                  subtitle='+ special cards'
               />
            </div>
            <PirateButton
               variant='primary'
               size='lg'
               fullWidth
               onClick={startGame}
               disabled={!canStart}
               loading={starting}
            >
               Hoist the Colors!
            </PirateButton>
            {!canStart && players.length < MIN_PLAYERS && (
               <p className='mt-2 text-center text-xs text-[color:var(--color-cream-200)]/60'>
                  Need at least {MIN_PLAYERS} crewmates.
               </p>
            )}
         </div>
      </main>
   );
}

function DeckToggle({
   selected,
   onSelect,
   title,
   subtitle,
}: {
   selected: boolean;
   onSelect: () => void;
   title: string;
   subtitle: string;
}) {
   return (
      <button
         type='button'
         role='radio'
         aria-checked={selected}
         onClick={onSelect}
         className={cn(
            'flex flex-1 flex-col items-center gap-0.5 rounded-2xl border-2 px-3 py-2.5 text-center transition-all',
            selected
               ? 'border-[color:var(--color-gold-400)] bg-[color:var(--color-deep-700)]/70 shadow-[0_0_24px_-8px_rgb(255_215_120/0.55)]'
               : 'border-[color:var(--color-surface-border)] bg-[color:var(--color-abyss-900)]/40',
         )}
      >
         <span className='pirate-display text-base text-[color:var(--color-gold-300)]'>{title}</span>
         <span className='text-[11px] text-[color:var(--color-cream-200)]/70'>{subtitle}</span>
      </button>
   );
}
