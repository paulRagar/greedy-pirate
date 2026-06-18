import type { Metadata } from 'next';
import Link from 'next/link';
import { PirateLinkButton } from '@/ui/pirate-button/PirateLinkButton';

export const metadata: Metadata = {
   title: 'How to Play Greedy Pirate — Rules & Strategy',
   description:
      'Full rules for Greedy Pirate, a free push-your-luck pirate card game for 2–10 players. Learn how to draw gold, bank your loot, dodge pirates, and win the deck.',
   alternates: { canonical: 'https://greedypirate.com/rules' },
   openGraph: {
      title: 'How to Play Greedy Pirate — Rules & Strategy',
      description:
         'Full rules for Greedy Pirate, a free push-your-luck pirate card game for 2–10 players.',
      url: 'https://greedypirate.com/rules',
   },
};

const HOW_TO_LD = {
   '@context': 'https://schema.org',
   '@type': 'HowTo',
   name: 'How to play Greedy Pirate',
   description:
      'Greedy Pirate is a push-your-luck card game for 2–10 players. On your turn, draw gold cards to build a streak. Bank the streak to keep the loot, or push your luck — but if you draw a pirate, you lose the whole streak.',
   totalTime: 'PT10M',
   step: [
      {
         '@type': 'HowToStep',
         name: 'Add players',
         text: 'Add between 2 and 10 players. Each starts with zero coins. Play passes clockwise.',
      },
      {
         '@type': 'HowToStep',
         name: 'Plunder (draw a card)',
         text: 'On your turn, draw the top card of the shared deck. Gold cards add their value to your current streak. A pirate card wipes your streak and ends your turn.',
      },
      {
         '@type': 'HowToStep',
         name: 'Bury it (bank the streak)',
         text: 'Before drawing a pirate, choose to bank your streak. The gold value is added to your safe coin total. Banking also ends your turn.',
      },
      {
         '@type': 'HowToStep',
         name: 'Win the deck',
         text: 'When the deck runs out, the player with the highest coin total wins. If the final card is gold, it auto-banks for the active player. If it is a pirate, the streak is lost.',
      },
   ],
};

const FAQ_LD = {
   '@context': 'https://schema.org',
   '@type': 'FAQPage',
   mainEntity: [
      {
         '@type': 'Question',
         name: 'How many players can play Greedy Pirate?',
         acceptedAnswer: {
            '@type': 'Answer',
            text: 'Between 2 and 10 players. Local pass-and-play is one device shared around the table. Online mode supports the same range across separate devices using a 4-character room code.',
         },
      },
      {
         '@type': 'Question',
         name: 'Is Greedy Pirate free to play?',
         acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Greedy Pirate runs in your browser with no signup required for local mode. Online rooms use anonymous accounts that you can optionally upgrade later.',
         },
      },
      {
         '@type': 'Question',
         name: 'What kind of game is Greedy Pirate?',
         acceptedAnswer: {
            '@type': 'Answer',
            text: 'It is a push-your-luck card game — the same genre as Can’t Stop, Diamant / Incan Gold, and Zombie Dice. Each turn you decide between safety (bank the streak) and greed (draw again and risk a pirate).',
         },
      },
      {
         '@type': 'Question',
         name: 'Does the game work on mobile?',
         acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Greedy Pirate is mobile-first. Touch targets are sized for thumbs and the layout is tested across phones and tablets.',
         },
      },
   ],
};

export default function RulesPage() {
   return (
      <main className='relative isolate min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-6'>
         <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }}
         />
         <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
         />

         <article className='mx-auto flex max-w-2xl flex-col gap-10 text-[color:var(--color-cream-200)]'>
            <header className='flex flex-col gap-3 text-center'>
               <h1 className='wordmark-gold pirate-display text-5xl leading-[0.95] sm:text-7xl'>
                  How to Play
               </h1>
               <p className='pirate-display text-base uppercase tracking-[0.3em] text-[color:var(--color-teal-300)]/90 sm:text-lg'>
                  Greedy Pirate rules &amp; strategy
               </p>
            </header>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>The pitch</h2>
               <p className='text-base leading-relaxed sm:text-lg'>
                  Greedy Pirate is a free, browser-based push-your-luck card game for 2–10 players. Take turns
                  drawing from a shared deck of gold and pirate cards. Build a streak, bank the loot, or push
                  your luck and lose it all to a pirate. The highest coin total when the deck runs out wins.
               </p>
               <p className='text-base leading-relaxed sm:text-lg'>
                  Think Can&rsquo;t Stop or Diamant / Incan Gold — a fast, tense risk-and-reward loop that
                  fits in ten minutes and works for families, parties, or a quick coffee-break game between
                  friends.
               </p>
            </section>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>Setup</h2>
               <ul className='list-disc space-y-2 pl-6 text-base leading-relaxed sm:text-lg'>
                  <li>2 to 10 players. Each starts with zero coins.</li>
                  <li>One shared shuffled deck of gold cards and pirate cards.</li>
                  <li>Play passes clockwise from the first player.</li>
                  <li>No signup needed for local pass-and-play.</li>
               </ul>
            </section>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>On your turn</h2>
               <ol className='list-decimal space-y-3 pl-6 text-base leading-relaxed sm:text-lg'>
                  <li>
                     <strong>Plunder</strong> — draw the top card. Gold adds to your current streak. A pirate
                     wipes the streak and ends your turn.
                  </li>
                  <li>
                     <strong>Bury it</strong> — before drawing a pirate, bank your streak. All gold in the
                     streak is added to your safe coin total. Banking ends your turn.
                  </li>
                  <li>
                     You must either draw at least once or bank an existing streak. No skipping.
                  </li>
               </ol>
            </section>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>Winning</h2>
               <p className='text-base leading-relaxed sm:text-lg'>
                  The game ends the moment the deck runs out. Highest coin total wins. If the final card
                  drawn is gold, it auto-banks for the active player and the game ends immediately. If the
                  final card is a pirate, that streak is lost — and the game still ends.
               </p>
            </section>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>Strategy notes</h2>
               <ul className='list-disc space-y-2 pl-6 text-base leading-relaxed sm:text-lg'>
                  <li>
                     Track the pirate count. The fewer pirates left in the deck, the safer your next draw.
                  </li>
                  <li>
                     A small banked streak is real coins. A big un-banked streak is a story you can&rsquo;t
                     spend.
                  </li>
                  <li>
                     When you&rsquo;re behind on the final pass through the deck, push harder. When
                     you&rsquo;re ahead, bank early.
                  </li>
                  <li>
                     Watch the leader. Pressure them to over-extend; bank quietly while they bust.
                  </li>
               </ul>
            </section>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>Modes</h2>
               <p className='text-base leading-relaxed sm:text-lg'>
                  <strong>Local</strong> — one device, pass-and-play with 2–10 friends. Pure client-side, no
                  account needed.
               </p>
               <p className='text-base leading-relaxed sm:text-lg'>
                  <strong>Online</strong> — server-authoritative multiplayer rooms across devices. Join by
                  sharing a 4-character room code. Anonymous accounts work out of the box and can be upgraded
                  later.
               </p>
            </section>

            <section className='flex flex-col gap-3'>
               <h2 className='pirate-display text-2xl text-[color:var(--color-gold-300)]'>FAQ</h2>
               <div className='space-y-4'>
                  <div>
                     <h3 className='font-semibold text-[color:var(--color-teal-200)]'>How many players?</h3>
                     <p className='text-base leading-relaxed sm:text-lg'>2 to 10, local or online.</p>
                  </div>
                  <div>
                     <h3 className='font-semibold text-[color:var(--color-teal-200)]'>Is it free?</h3>
                     <p className='text-base leading-relaxed sm:text-lg'>Yes, fully free. No ads.</p>
                  </div>
                  <div>
                     <h3 className='font-semibold text-[color:var(--color-teal-200)]'>What genre is it?</h3>
                     <p className='text-base leading-relaxed sm:text-lg'>
                        Push-your-luck card game — the same family as Can&rsquo;t Stop, Diamant / Incan Gold,
                        and Zombie Dice.
                     </p>
                  </div>
                  <div>
                     <h3 className='font-semibold text-[color:var(--color-teal-200)]'>Mobile-friendly?</h3>
                     <p className='text-base leading-relaxed sm:text-lg'>
                        Yes. Designed mobile-first; runs in any modern browser.
                     </p>
                  </div>
               </div>
            </section>

            <section className='flex flex-col items-center gap-3 pt-2'>
               <PirateLinkButton href='/choose-game' variant='primary' size='lg' fullWidth>
                  Set Sail
               </PirateLinkButton>
               <Link
                  href='/'
                  className='text-sm uppercase tracking-[0.35em] text-[color:var(--color-cream-200)]/55'
               >
                  Back to home
               </Link>
            </section>
         </article>
      </main>
   );
}
