import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';

/**
 * Regression guard for the cold-incognito redirect bug.
 *
 * Before the AnonBootstrapGate, `/play/[code]` redirected to "/" when
 * the visitor had no session — a fresh incognito visitor who pasted
 * an invite link was bounced home and lost the room entirely. The
 * gate fixes this by signing in anonymously and reloading.
 *
 * Flow:
 *   1. A charters a private room.
 *   2. A fresh context (no cookies) navigates to /play/[code].
 *   3. The gate signs in and reloads. The visitor lands on the
 *      JoinGate with the "Board the ship" / "Hail the Captain" CTA
 *      — NOT on the home page.
 */
test('pasting an invite link in a fresh context lands in the room flow, not home', async ({
   contextA,
   contextB,
}) => {
   const pageA = await contextA.newPage();
   const pageB = await contextB.newPage();

   const home = new HomePage(pageA);
   const code = await home.createRoom('private');

   await pageB.goto(`/play/${code}`);

   // Wait through the AnonBootstrapGate reload then settle.
   await pageB.waitForLoadState('networkidle');

   // The join flow renders the "Hailin' the Captain" modal for
   // private rooms. The home page never shows it — so finding it
   // proves we landed on the room URL, not /.
   await expect(pageB.getByRole('dialog', { name: /hailin' the captain/i })).toBeVisible({
      timeout: 10_000,
   });

   // And confirm the URL really is /play/[code].
   await expect(pageB).toHaveURL(new RegExp(`/play/${code}$`));
});
