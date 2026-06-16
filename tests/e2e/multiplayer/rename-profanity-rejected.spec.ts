import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';

/**
 * UI assertion that the profanity filter shows a generic rejection
 * instead of accepting the name. The vitest unit test covers the
 * matcher itself; this test ensures the server action's rejection
 * actually surfaces in the editor.
 *
 * Flow:
 *   1. A charters any room (private is fastest — no extra clicks).
 *   2. The auto-nudge opens.
 *   3. A submits an obvious slur. The error appears, the modal stays
 *      open, the name is NOT saved.
 *   4. A submits a clean alternative — modal closes.
 */
test('profanity in the rename modal is rejected with a generic error', async ({ contextA }) => {
   const page = await contextA.newPage();
   const home = new HomePage(page);
   await home.createRoom('private');

   const input = page.getByTestId('display-name-input');
   await input.waitFor({ state: 'visible', timeout: 5_000 });

   await input.fill('shit');
   await page.getByTestId('display-name-save').click();

   // Server rejects — modal must stay open, error visible, name not saved.
   await expect(page.getByTestId('display-name-error')).toContainText(/not allowed/i);
   await expect(input).toBeVisible();

   // Clean name clears the error and closes the modal.
   await input.fill('Cleanname');
   await page.getByTestId('display-name-save').click();
   await input.waitFor({ state: 'hidden' });
});
