'use client';

import { RainCoin } from '@/ui/effects/RainCoin';

/**
 * Full-screen celebratory gold-coin rain. Pointer-events none, sits behind
 * (or around) the win modal. Coin positions are a fixed table so SSR and
 * client render identically — no Math.random at render time.
 */

const COINS: { left: string; size: number; duration: number; delay: number; sway: number }[] = [
   { left: '4%', size: 18, duration: 3.2, delay: 0, sway: 30 },
   { left: '11%', size: 12, duration: 4.1, delay: 0.7, sway: -22 },
   { left: '18%', size: 22, duration: 2.9, delay: 1.4, sway: 18 },
   { left: '26%', size: 14, duration: 3.8, delay: 0.3, sway: -34 },
   { left: '33%', size: 10, duration: 4.5, delay: 1.9, sway: 26 },
   { left: '41%', size: 20, duration: 3.1, delay: 0.9, sway: -16 },
   { left: '48%', size: 16, duration: 3.6, delay: 2.3, sway: 32 },
   { left: '55%', size: 12, duration: 4.2, delay: 0.5, sway: -28 },
   { left: '62%', size: 24, duration: 2.8, delay: 1.6, sway: 20 },
   { left: '70%', size: 14, duration: 3.9, delay: 0.1, sway: -24 },
   { left: '77%', size: 18, duration: 3.3, delay: 2.0, sway: 28 },
   { left: '84%', size: 11, duration: 4.4, delay: 1.1, sway: -18 },
   { left: '91%', size: 20, duration: 3.0, delay: 0.6, sway: 22 },
   { left: '96%', size: 13, duration: 4.0, delay: 1.8, sway: -30 },
   { left: '7%', size: 9, duration: 4.8, delay: 2.6, sway: 16 },
   { left: '37%', size: 9, duration: 4.7, delay: 3.1, sway: -14 },
   { left: '66%', size: 10, duration: 4.6, delay: 2.8, sway: 18 },
   { left: '88%', size: 9, duration: 4.9, delay: 3.4, sway: -20 },
];

export function GoldRain({ className }: { className?: string }) {
   return (
      <div
         className={`pointer-events-none fixed inset-0 z-50 overflow-hidden ${className ?? ''}`}
         aria-hidden='true'
      >
         {COINS.map((c, i) => (
            <div
               key={i}
               className='animate-gold-rain absolute top-0'
               style={{
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  animationDuration: `${c.duration}s`,
                  animationDelay: `${c.delay}s`,
                  ['--rain-sway' as string]: `${c.sway}px`,
               }}
            >
               <RainCoin />
            </div>
         ))}
      </div>
   );
}
