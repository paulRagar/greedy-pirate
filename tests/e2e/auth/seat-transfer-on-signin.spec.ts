import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';
import { LobbyPage } from '../../pages/LobbyPage';
import { createEmailUser, deleteUser } from '../../utils/supabaseAdmin';

/**
 * The seat-transfer mechanism: an anonymous player holds a seat,
 * then signs in to an existing account. The seat must survive the
 * auth switch — same room, new identity, name reflects the claimed
 * account.
 *
 * Flow:
 *   1. Provision an existing email account "Peter Pan" via admin API.
 *   2. A charters a private room. A names themselves "Captain Alpha"
 *      (closes the auto-nudge so it can't intercept clicks).
 *   3. B (anonymous) opens the room URL — JoinGate auto-knocks.
 *   4. A approves; B is seated as their auto-generated default.
 *   5. B opens the TopNav account menu and signs in as Peter Pan.
 *   6. The seat is transferred via token under the hood. A's lobby
 *      now shows "Peter Pan" without B ever re-knocking.
 */
test('signing in mid-lobby transfers the anon seat to the existing account', async ({
   contextA,
   contextB,
}) => {
   test.setTimeout(60_000);

   const pageA = await contextA.newPage();
   const pageB = await contextB.newPage();

   const home = new HomePage(pageA);
   const lobbyA = new LobbyPage(pageA);

   // Unique email per run so reruns against the same local Supabase
   // tolerate stale rows from a prior failure.
   const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
   const email = `peter-${stamp}@gp-test.local`;
   const password = 'password-1234';
   const peterId = await createEmailUser(email, password, 'Peter Pan');

   try {
      const code = await home.createRoom('private');

      // Captain sets a deterministic name via the pencil.
      await lobbyA.setName('Captain Alpha');

      // B knocks via auto-fire on JoinGate mount.
      await pageB.goto(`/play/${code}`);

      // A approves. The first knock-approve we see is B's.
      const knockApprove = pageA.getByTestId('knock-approve');
      await knockApprove.waitFor({ state: 'visible', timeout: 10_000 });
      await knockApprove.click();

      // B's tab transitions to the lobby — wait for the room code chrome.
      await pageB.getByTestId('room-code').waitFor({ state: 'visible', timeout: 10_000 });

      // Dismiss the post-admission nudge if it auto-opened — we don't
      // want it intercepting the account menu click that follows.
      const lobbyB = new LobbyPage(pageB);
      await lobbyB.dismissRenameNudgeIfOpen(3_000);

      // B opens TopNav and signs in as Peter Pan.
      await pageB.getByTestId('account-menu-trigger').click();
      await pageB.getByTestId('account-menu-auth').click();
      await pageB.getByTestId('auth-tab-signin').click();
      await pageB.getByTestId('auth-email').fill(email);
      await pageB.getByTestId('auth-password').fill(password);
      await pageB.getByTestId('auth-submit').click();

      // Verify B's own view first — B's own seat always renders
      // regardless of A's presence-filter timing. This is the assertion
      // that proves the seat was transferred end-to-end.
      await expect(
         pageB.getByTestId('crew-row').filter({ hasText: 'Peter Pan' }),
      ).toBeVisible({ timeout: 15_000 });

      // The captain's lobby converges once realtime presence rebinds
      // to the new identity. Allow a generous window.
      await expect(pageA.getByTestId('crew-row').filter({ hasText: 'Peter Pan' })).toBeVisible({
         timeout: 15_000,
      });
   } finally {
      await deleteUser(peterId);
   }
});
