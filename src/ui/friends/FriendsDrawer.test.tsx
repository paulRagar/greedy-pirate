// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listFriends = vi.fn();
const listIncomingRequests = vi.fn();
const listOutgoingRequests = vi.fn();
const respondToFriendRequest = vi.fn();
const cancelFriendRequest = vi.fn();
const searchUsers = vi.fn();
const sendFriendRequest = vi.fn();
const getMyFriendCode = vi.fn();
vi.mock('@/server/actions/friendActions', () => ({
   listFriends: () => listFriends(),
   listIncomingRequests: () => listIncomingRequests(),
   listOutgoingRequests: () => listOutgoingRequests(),
   respondToFriendRequest: (a: unknown) => respondToFriendRequest(a),
   cancelFriendRequest: (a: unknown) => cancelFriendRequest(a),
   searchUsers: (a: unknown) => searchUsers(a),
   sendFriendRequest: (a: unknown) => sendFriendRequest(a),
   getMyFriendCode: () => getMyFriendCode(),
}));
vi.mock('@/client/juice/haptics', () => ({ haptics: { tap: vi.fn() } }));

import { FriendsDrawer } from './FriendsDrawer';
import type { FriendInbox } from '@/client/realtime/useFriendInbox';

function makeInbox(over: Partial<FriendInbox> = {}): FriendInbox {
   return {
      unread: 0,
      notice: null,
      dismissNotice: vi.fn(),
      version: 0,
      onIncomingResolved: vi.fn(),
      refreshUnread: vi.fn(),
      ...over,
   };
}

describe('FriendsDrawer', () => {
   beforeEach(() => {
      vi.clearAllMocks();
      listFriends.mockResolvedValue({ ok: true, friends: [] });
      listIncomingRequests.mockResolvedValue({ ok: true, requests: [] });
      listOutgoingRequests.mockResolvedValue({ ok: true, requests: [] });
      respondToFriendRequest.mockResolvedValue({ ok: true });
      cancelFriendRequest.mockResolvedValue({ ok: true });
      searchUsers.mockResolvedValue({ ok: true, results: [] });
      sendFriendRequest.mockResolvedValue({ ok: true, status: 'pending', requestId: 'x' });
      getMyFriendCode.mockResolvedValue({ ok: true, friendCode: 'MYCODE12' });
   });

   it('renders nothing when closed', () => {
      render(<FriendsDrawer open={false} onClose={() => {}} inbox={makeInbox()} />);
      expect(screen.queryByRole('dialog')).toBeNull();
   });

   it('opens as a labelled modal dialog with three tabs', () => {
      render(<FriendsDrawer open onClose={() => {}} inbox={makeInbox()} />);
      expect(screen.getByRole('dialog', { name: 'Crew' })).toHaveAttribute('aria-modal', 'true');
      expect(screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual([
         'Friends',
         'Requests',
         'Add',
      ]);
   });

   it('reconciles the unread badge on open', () => {
      const inbox = makeInbox({ unread: 2 });
      render(<FriendsDrawer open onClose={() => {}} inbox={inbox} />);
      expect(inbox.refreshUnread).toHaveBeenCalled();
   });

   it('honours initialTab=requests and shows the empty inbox state', async () => {
      render(<FriendsDrawer open onClose={() => {}} inbox={makeInbox()} initialTab='requests' />);
      expect(screen.getByRole('tab', { name: /Requests/ })).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByText('No pending requests')).toBeInTheDocument();
   });

   it('lists incoming requests and accepts one', async () => {
      listIncomingRequests.mockResolvedValue({
         ok: true,
         requests: [
            { requestId: 'r1', userId: 'u1', displayName: 'Anne', friendCode: 'ZZ11', createdAt: '' },
         ],
      });
      const inbox = makeInbox();
      render(<FriendsDrawer open onClose={() => {}} inbox={inbox} initialTab='requests' />);

      const accept = await screen.findByRole('button', { name: 'Accept' });
      fireEvent.click(accept);

      await waitFor(() =>
         expect(respondToFriendRequest).toHaveBeenCalledWith({ requestId: 'r1', accept: true }),
      );
      expect(inbox.onIncomingResolved).toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('Anne')).toBeNull());
   });

   it('lists friends on the Friends tab', async () => {
      listFriends.mockResolvedValue({
         ok: true,
         friends: [{ userId: 'u1', displayName: 'Blackbeard', friendCode: 'AB12CD34' }],
      });
      render(<FriendsDrawer open onClose={() => {}} inbox={makeInbox()} />);
      expect(await screen.findByText('Blackbeard')).toBeInTheDocument();
   });

   it('shows your friend code and searches + adds on the Add tab', async () => {
      searchUsers.mockResolvedValue({
         ok: true,
         results: [
            { userId: 'u9', displayName: 'Calico', friendCode: 'CJ99XX22', relationship: 'none' },
         ],
      });
      render(
         <FriendsDrawer open onClose={() => {}} inbox={makeInbox()} initialTab='add' initialQuery='CJ99XX22' />,
      );

      // Own code surfaces.
      expect(await screen.findByText('MYCODE12')).toBeInTheDocument();
      // Deep-link query auto-searches and yields a result with an Add action.
      const add = await screen.findByRole('button', { name: 'Add' });
      fireEvent.click(add);
      await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith({ toUserId: 'u9' }));
      // Row flips to Pending after a successful send.
      expect(await screen.findByText('Pending')).toBeInTheDocument();
   });

   it('calls onClose on Escape', async () => {
      const onClose = vi.fn();
      render(<FriendsDrawer open onClose={onClose} inbox={makeInbox()} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(onClose).toHaveBeenCalled());
   });
});
