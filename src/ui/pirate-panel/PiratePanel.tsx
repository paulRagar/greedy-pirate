import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'deep';

const VARIANT: Record<Variant, string> = {
   deep:
      'bg-[color:var(--color-deep-800)]/85 backdrop-blur-md ' +
      'border border-[color:var(--color-surface-border)] ' +
      'text-[color:var(--color-cream-100)] ' +
      'shadow-[0_8px_24px_-8px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(255_255_255/0.06)]',
};

interface Props extends HTMLAttributes<HTMLDivElement> {
   variant?: Variant;
}

export function PiratePanel({ variant = 'deep', className, children, ...rest }: Props) {
   return (
      <div
         className={cn('rounded-2xl p-4 shadow-card sm:p-6', VARIANT[variant], className)}
         {...rest}
      >
         {children}
      </div>
   );
}
