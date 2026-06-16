'use client';

import Link, { useLinkStatus, type LinkProps } from 'next/link';
import { type ReactNode } from 'react';
import { PirateButton } from './PirateButton';

type ButtonForward = Omit<
   React.ComponentPropsWithoutRef<typeof PirateButton>,
   'onClick' | 'type' | 'children' | 'loading'
>;

interface Props extends ButtonForward {
   href: LinkProps['href'];
   prefetch?: LinkProps['prefetch'];
   replace?: LinkProps['replace'];
   scroll?: LinkProps['scroll'];
   children: ReactNode;
   linkClassName?: string;
   'aria-label'?: string;
}

/**
 * Link that renders a PirateButton and shows the button's loading state
 * automatically while the destination route is being fetched/rendered.
 * Uses Next 15's `useLinkStatus` so we get a real pending signal without
 * having to convert every Link to a `router.push` + `useTransition` pair.
 */
export function PirateLinkButton({
   href,
   prefetch,
   replace,
   scroll,
   children,
   linkClassName,
   fullWidth,
   ...buttonProps
}: Props) {
   return (
      <Link
         href={href}
         prefetch={prefetch}
         replace={replace}
         scroll={scroll}
         className={linkClassName ?? (fullWidth ? 'w-full' : undefined)}
      >
         <InnerButton fullWidth={fullWidth} {...buttonProps}>
            {children}
         </InnerButton>
      </Link>
   );
}

function InnerButton({
   children,
   ...buttonProps
}: ButtonForward & { children: ReactNode }) {
   const { pending } = useLinkStatus();
   return (
      <PirateButton loading={pending} {...buttonProps}>
         {children}
      </PirateButton>
   );
}
