import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';

/**
 * The display-name editor enforces a 2-character minimum on the
 * server. The input has a maxLength attribute that prevents going
 * over 20, so the UI-visible failure path is the minimum.
 */
test('rename rejects single-character names', async ({ contextA }) => {
   const page = await contextA.newPage();
   const home = new HomePage(page);
   await home.createRoom('private');

   const input = page.getByTestId('display-name-input');
   await input.waitFor({ state: 'visible', timeout: 5_000 });

   await input.fill('A');
   await page.getByTestId('display-name-save').click();

   await expect(page.getByTestId('display-name-error')).toContainText(/at least 2/i);
   await expect(input).toBeVisible();
});
