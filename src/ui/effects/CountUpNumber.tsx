'use client';

import { useCountUp } from '@/client/hooks/useCountUp';
import { cn } from '@/lib/cn';

interface Props {
   value: number;
   duration?: number;
   /** Starting value for the first render — e.g. 0 for a victory tally. */
   from?: number;
   className?: string;
}

/** A number that counts up to its value, with a little scale bump while moving. */
export function CountUpNumber({ value, duration, from, className }: Props) {
   const display = useCountUp(value, duration, from);
   return (
      <span className={cn('inline-block tabular-nums', display !== value && 'animate-score-bump', className)}>
         {display}
      </span>
   );
}
