// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useGameAnnouncer } from './useGameAnnouncer';
import type { AnnounceSnapshot } from '@/client/a11y/gameAnnouncement';

function Harness({ snap }: { snap: AnnounceSnapshot }) {
   const { announcer } = useGameAnnouncer(snap);
   return <div data-testid='root'>{announcer}</div>;
}

const active: AnnounceSnapshot = {
   status: 'active',
   turnIndex: 0,
   currentCardKind: null,
   currentName: 'Anne',
   winnerName: null,
   isMyTurn: true,
};

describe('useGameAnnouncer', () => {
   it('mounts the live regions on initial render', () => {
      const { container } = render(<Harness snap={active} />);
      const polite = container.querySelector('[aria-live="polite"]');
      const assertive = container.querySelector('[aria-live="assertive"]');
      expect(polite).not.toBeNull();
      expect(assertive).not.toBeNull();
   });

   it('updates the polite region text on a turn change', () => {
      const { container, rerender } = render(<Harness snap={active} />);
      const polite = container.querySelector('[aria-live="polite"]')!;
      // First active snapshot announces "Your turn."
      expect(polite.textContent).toBe('Your turn.');

      rerender(<Harness snap={{ ...active, turnIndex: 1, currentName: 'Bart', isMyTurn: false }} />);
      expect(polite.textContent).toBe('Bart is at the helm.');
   });

   it('routes a bust to the assertive region', () => {
      const gold: AnnounceSnapshot = { ...active, currentCardKind: 'gold' };
      const { container, rerender } = render(<Harness snap={gold} />);
      rerender(<Harness snap={{ ...gold, currentCardKind: 'pirate' }} />);

      const assertive = container.querySelector('[aria-live="assertive"]')!;
      expect(assertive.textContent).toBe('Pirate! Streak lost.');
   });
});
