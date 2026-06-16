import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';
import { LobbyPage } from '../../pages/LobbyPage';
import { ProfilePage } from '../../pages/ProfilePage';

/**
 * Regression guard for the knock-snapshot bug.
 *
 * Previously, `respondToJoinRequest` seated approved players with the
 * displayName captured at knock time. If the requester renamed before
 * the captain hit approve, the seat showed a stale name. The captain
 * should always see the requester's CURRENT name on the seat.
 *
 * B opens /profile in a SECOND tab so the original /play/[code] tab
 * keeps B's presence on the room channel. Without that, A's lobby
 * filters out players who aren't currently connected — true to
 * production but it would mask the assertion under test.
 */
test('seating an approved knocker uses their current name, not the snapshot', async ({
   contextA,
   contextB,
}) => {
   const pageA = await contextA.newPage();
   const pageB = await contextB.newPage();

   const home = new HomePage(pageA);
   const lobbyA = new LobbyPage(pageA);

   const code = await home.createRoom('private');

   // Captain picks a deterministic name via the pencil so the post-
   // admission nudge can't intercept later clicks on the knock inbox.
   await lobbyA.setName('Captain Alpha');

   // B opens the room — private rooms auto-knock on mount.
   await pageB.goto(`/play/${code}`);

   const knockApprove = pageA.getByTestId('knock-approve');
   await knockApprove.waitFor({ state: 'visible', timeout: 10_000 });

   // Rename in a second tab so pageB's room channel presence stays
   // alive while we patch the display name. The context fixture closes
   // every page at the end of the test, so we deliberately don't close
   // this tab here — closing it mid-run can truncate Playwright's
   // trace artifacts when running under `playwright test --ui`.
   const profileTab = await contextB.newPage();
   const profileB = new ProfilePage(profileTab);
   await profileB.goto();
   await profileB.rename('Buckus');

   await knockApprove.click();

   await lobbyA.expectPlayerNamed('Buckus');
   await lobbyA.expectNoPlayerNamed(/Crewmate #\d+/);
});
