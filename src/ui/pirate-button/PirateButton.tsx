import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'treasure' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
   // PRIMARY — vibrant teal/turquoise. Default CTA across the app.
   // Dark text on bright teal => high contrast (WCAG AAA).
   primary:
      'bg-gradient-to-b from-[color:var(--color-teal-400)] to-[color:var(--color-teal-600)] ' +
      'text-[color:var(--color-abyss-900)] font-bold ' +
      'enabled:active:from-[color:var(--color-teal-300)] enabled:active:to-[color:var(--color-deep-500)] ' +
      'enabled:hover:brightness-110 ' +
      'border-2 border-[color:var(--color-teal-600)] ' +
      'shadow-[0_4px_0_0_rgb(13_77_112/0.9),0_8px_18px_-2px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-2px_0_rgb(0_0_0/0.18)] ' +
      'enabled:active:translate-y-[2px] enabled:active:shadow-[0_2px_0_0_rgb(13_77_112/0.9),0_4px_10px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-1px_0_rgb(0_0_0/0.18)]',

   // SECONDARY — vibrant coral → orchid. Alt actions, dramatic moments.
   // White text + dark text-shadow for legibility across the gradient.
   secondary:
      'bg-gradient-to-b from-[color:var(--color-coral-500)] to-[color:var(--color-orchid-600)] ' +
      'text-white font-bold ' +
      '[text-shadow:0_1px_3px_rgb(0_0_0/0.55)] ' +
      'enabled:active:from-[color:var(--color-coral-400)] enabled:active:to-[color:var(--color-orchid-500)] ' +
      'enabled:hover:brightness-110 ' +
      'border-2 border-[color:var(--color-orchid-700)] ' +
      'shadow-[0_4px_0_0_rgb(76_29_149/0.9),0_8px_18px_-2px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.22)] ' +
      'enabled:active:translate-y-[2px] enabled:active:shadow-[0_2px_0_0_rgb(76_29_149/0.9),0_4px_10px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-1px_0_rgb(0_0_0/0.22)]',

   // TERTIARY — outlined gold. Modern + pirate-cohesive. For back nav,
   // dismiss, low-priority alt actions. Distinct from filled `treasure`
   // (which is reserved for celebration moments).
   tertiary:
      'bg-transparent text-[color:var(--color-gold-300)] font-bold ' +
      'border-2 border-[color:var(--color-gold-400)]/65 ' +
      'enabled:hover:bg-[color:var(--color-gold-400)]/10 enabled:hover:border-[color:var(--color-gold-300)] enabled:hover:text-[color:var(--color-gold-200)] ' +
      'enabled:active:bg-[color:var(--color-gold-400)]/15 enabled:active:translate-y-[1px] ' +
      'shadow-[0_2px_0_0_rgb(138_77_5/0.45),0_4px_10px_-2px_rgb(0_0_0/0.35)] ' +
      'enabled:active:shadow-[0_1px_0_0_rgb(138_77_5/0.45),0_2px_6px_-2px_rgb(0_0_0/0.3)]',

   // TREASURE — filled gold. Reserved for true treasure moments
   // (win celebration, banking flourish). Don't use for plain CTAs.
   treasure:
      'bg-gradient-to-b from-[color:var(--color-gold-300)] to-[color:var(--color-gold-500)] ' +
      'text-[color:var(--color-abyss-900)] font-bold ' +
      'enabled:active:from-[color:var(--color-gold-400)] enabled:active:to-[color:var(--color-gold-600)] ' +
      'enabled:hover:brightness-110 ' +
      'border-2 border-[color:var(--color-gold-600)] ' +
      'shadow-[0_4px_0_0_rgb(138_77_5/0.9),0_8px_18px_-2px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.5),inset_0_-2px_0_rgb(0_0_0/0.18)] ' +
      'enabled:active:translate-y-[2px] enabled:active:shadow-[0_2px_0_0_rgb(138_77_5/0.9),0_4px_10px_-2px_rgb(0_0_0/0.4)]',

   ghost:
      'bg-transparent text-[color:var(--color-cream-200)] ' +
      'enabled:hover:bg-white/5 border-2 border-white/10',

   danger:
      'bg-gradient-to-b from-[color:var(--color-coral-600)] to-[color:var(--color-blood-800)] ' +
      'text-white font-bold ' +
      '[text-shadow:0_1px_2px_rgb(0_0_0/0.5)] ' +
      'enabled:active:brightness-95 ' +
      'border-2 border-black/40 shadow-md shadow-black/40',
};

// Bumped sizes for laptop + desktop readability. text-base = 16px floor.
const SIZE: Record<Size, string> = {
   sm: 'min-h-[44px] px-4 text-base gap-2',
   md: 'min-h-[54px] px-5 text-lg sm:text-xl gap-2',
   lg: 'min-h-[64px] px-6 text-xl sm:text-2xl gap-3',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: Variant;
   size?: Size;
   fullWidth?: boolean;
   loading?: boolean;
}

export const PirateButton = forwardRef<HTMLButtonElement, Props>(function PirateButton(
   {
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading = false,
      className,
      type = 'button',
      disabled,
      children,
      onClick,
      ...rest
   },
   ref,
) {
   const isDisabled = disabled || loading;
   return (
      <button
         ref={ref}
         type={type}
         aria-busy={loading || undefined}
         disabled={isDisabled}
         onClick={loading ? undefined : onClick}
         className={cn(
            'relative inline-flex items-center justify-center rounded-xl font-display tracking-wider uppercase',
            'transition-all duration-100 ease-out',
            'disabled:opacity-45 disabled:cursor-not-allowed',
            loading && 'cursor-wait disabled:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-coral-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-abyss-950)]',
            fullWidth && 'w-full',
            SIZE[size],
            VARIANT[variant],
            className,
         )}
         {...rest}
      >
         <span className={cn('inline-flex items-center justify-center gap-2', loading && 'invisible')}>
            {children}
         </span>
         {loading && (
            <span className='absolute inset-0 flex items-center justify-center' aria-hidden>
               <Spinner size={size} />
            </span>
         )}
      </button>
   );
});

function Spinner({ size }: { size: Size }) {
   const dim = size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-6 w-6' : 'h-5 w-5';
   return (
      <svg
         className={cn('animate-spin', dim)}
         viewBox='0 0 24 24'
         fill='none'
         role='status'
         aria-label='Loading'
      >
         <circle cx='12' cy='12' r='9' stroke='currentColor' strokeOpacity='0.25' strokeWidth='3' />
         <path
            d='M21 12a9 9 0 0 1-9 9'
            stroke='currentColor'
            strokeWidth='3'
            strokeLinecap='round'
         />
      </svg>
   );
}
