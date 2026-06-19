// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listFriends = vi.fn();
vi.mock('@/server/actions/friendActions', () => ({ listFriends: () => listFriends() }));
vi.mock('@/client/juice/haptics', () => ({ haptics: { tap: vi.fn() } }));

import { FriendsDrawer } from './FriendsDrawer';

describe('FriendsDrawer', () => {
   beforeEach(() => {
      listFriends.mockReset();
      listFriends.mockResolvedValue({ ok: true, friends: [] });
   });

   it('renders nothing when closed', () => {
      render(<FriendsDrawer open={false} onClose={() => {}} />);
      expect(screen.queryByRole('dialog')).toBeNull();
   });

   it('opens as a labelled modal dialog with three tabs', async () => {
      render(<FriendsDrawer open onClose={() => {}} />);
      expect(screen.getByRole('dialog', { name: 'Crew' })).toHaveAttribute('aria-modal', 'true');
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual(['Friends', 'Requests', 'Add']);
      expect(screen.getByRole('tab', { name: 'Friends' })).toHaveAttribute('aria-selected', 'true');
   });

   it('shows the empty state when the user has no friends', async () => {
      render(<FriendsDrawer open onClose={() => {}} />);
      expect(await screen.findByText('No crew yet')).toBeInTheDocument();
   });

   it('lists friends returned by the server', async () => {
      listFriends.mockResolvedValue({
         ok: true,
         friends: [{ userId: 'u1', displayName: 'Blackbeard', friendCode: 'AB12CD34' }],
      });
      render(<FriendsDrawer open onClose={() => {}} />);
      expect(await screen.findByText('Blackbeard')).toBeInTheDocument();
      expect(screen.getByText('AB12CD34')).toBeInTheDocument();
   });

   it('switches to the Requests tab without crashing', async () => {
      render(<FriendsDrawer open onClose={() => {}} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Requests' }));
      expect(screen.getByRole('tab', { name: 'Requests' })).toHaveAttribute('aria-selected', 'true');
   });

   it('calls onClose on Escape', async () => {
      const onClose = vi.fn();
      render(<FriendsDrawer open onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(onClose).toHaveBeenCalled());
   });
});
