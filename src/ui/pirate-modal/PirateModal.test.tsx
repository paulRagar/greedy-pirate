// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PirateModal } from './PirateModal';
import { VictoryModal } from '@/ui/game-room/VictoryModal';

describe('PirateModal accessible name', () => {
   it('labels the dialog with its visible title', () => {
      render(
         <PirateModal open title='Pass the Wheel'>
            <p>body</p>
         </PirateModal>,
      );
      expect(screen.getByRole('dialog', { name: 'Pass the Wheel' })).toBeInTheDocument();
   });

   it('falls back to ariaLabel when there is no visible title', () => {
      render(
         <PirateModal open ariaLabel='Anne wins'>
            <p>body</p>
         </PirateModal>,
      );
      expect(screen.getByRole('dialog', { name: 'Anne wins' })).toBeInTheDocument();
   });
});

describe('VictoryModal accessible name', () => {
   it('announces the winner as the dialog name', () => {
      render(
         <VictoryModal
            open
            winner={{ id: 'a', name: 'Anne', coins: 30 }}
            ranked={[{ id: 'a', name: 'Anne', coins: 30 }]}
            actions={null}
         />,
      );
      expect(screen.getByRole('dialog', { name: 'Anne wins' })).toBeInTheDocument();
   });
});
