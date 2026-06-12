/** Small glowing doubloon — used by GoldRain and ChestBurst. */
export function RainCoin() {
   return (
      <svg viewBox='0 0 20 20' className='h-full w-full drop-shadow-[0_0_8px_rgb(255_217_102/0.65)]'>
         <circle cx='10' cy='10' r='8.4' fill='var(--color-gold-400)' stroke='var(--color-gold-600)' strokeWidth='1.2' />
         <circle cx='10' cy='10' r='5.6' fill='none' stroke='var(--color-gold-600)' strokeWidth='0.8' opacity='0.6' />
         <circle cx='7.4' cy='7' r='1.6' fill='var(--color-gold-200)' opacity='0.95' />
      </svg>
   );
}
