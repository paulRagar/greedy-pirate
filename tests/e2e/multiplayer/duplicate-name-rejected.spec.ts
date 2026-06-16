import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';

/**
 * Two crewmates in the same room can't share a display name —
 * setDisplayName rejects with a room-scoped duplicate error.
 *
 * Flow:
 *   1. A creates a private room, accepts "Buckus" via the nudge.
 *   2. B joins via knock + approve.
 *   3. B opens the rename modal and tries to take "Buckus".
 *   4. Server rejects with a duplicate-in-room message.
 */
test('duplicate name in the same room is rejected', async ({ contextA, contextB }) => {
   const pageA = await contextA.newPage();
   const pageB = await contextB.newPage();

   const home = new HomePage(pageA);
   const code = await home.createRoom('private');

   // A takes the contested name first.
   await pageA.getByTestId('display-name-input').waitFor({ state: 'visible', timeout: 5_000 });
   await pageA.getByTestId('display-name-input').fill('Buckus');
   await pageA.getByTestId('display-name-save').click();
   await pageA.getByTestId('display-name-input').waitFor({ state: 'hidden' });

   // B knocks; A approves.
   await pageB.goto(`/play/${code}`);
   const knockApprove = pageA.getByTestId('knock-approve');
   await knockApprove.waitFor({ state: 'visible', timeout: 10_000 });
   await knockApprove.click();

   // B's post-admission nudge auto-opens. Try to take "Buckus".
   await pageB.getByTestId('display-name-input').waitFor({ state: 'visible', timeout: 8_000 });
   await pageB.getByTestId('display-name-input').fill('Buckus');
   await pageB.getByTestId('display-name-save').click();

   // Server rejects with a duplicate-in-room error; modal stays open.
   await expect(pageB.getByTestId('display-name-error')).toContainText(/taken/i);
   await expect(pageB.getByTestId('display-name-input')).toBeVisible();
});
