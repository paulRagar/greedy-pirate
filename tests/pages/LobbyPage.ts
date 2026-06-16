import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Lobby/room interactions. Encapsulates the seat list, the rename
 * pencil, and the modal that follows. Tests should never touch raw
 * selectors — they should describe intent through these methods.
 */
export class LobbyPage {
   constructor(private readonly page: Page) {}

   async goto(code: string): Promise<void> {
      await this.page.goto(`/play/${code}`);
      await this.page.getByTestId('room-code').waitFor({ state: 'visible' });
   }

   /** Wait for a seat row whose displayed name matches the predicate. */
   async expectPlayerNamed(name: string | RegExp): Promise<void> {
      const row = this.playerRow(name);
      await expect(row).toBeVisible();
   }

   /** Resolves when no seat row matches the name. */
   async expectNoPlayerNamed(name: string | RegExp): Promise<void> {
      const row = this.playerRow(name);
      await expect(row).toHaveCount(0);
   }

   playerRow(name: string | RegExp): Locator {
      const filter = typeof name === 'string' ? { hasText: name } : { hasText: name };
      return this.page.getByTestId('crew-row').filter(filter);
   }

   async openRenameForSelf(): Promise<void> {
      // The pencil only renders on the user's own row. The nudge may
      // have auto-opened the modal already — if so, the pencil is
      // hidden behind it, so dismiss the nudge first.
      await this.dismissRenameNudgeIfOpen();
      await this.page.getByTestId('lobby-rename').click();
      await this.page.getByTestId('display-name-input').waitFor({ state: 'visible' });
   }

   /**
    * Submit a name through the pencil flow — opens the editor, fills,
    * and waits for the modal to close on success. Throws on a validation
    * error left visible. Use this when a test wants to set up a known
    * name deterministically without racing the post-admission nudge.
    */
   async setName(name: string): Promise<void> {
      await this.openRenameForSelf();
      await this.page.getByTestId('display-name-input').fill(name);
      await this.page.getByTestId('display-name-save').click();
      await this.page.getByTestId('display-name-input').waitFor({ state: 'hidden' });
   }

   async dismissRenameNudgeIfOpen(timeoutMs = 1_000): Promise<void> {
      const input = this.page.getByTestId('display-name-input');
      try {
         await input.waitFor({ state: 'visible', timeout: timeoutMs });
      } catch {
         return; // never opened
      }
      const cancel = this.page.getByRole('button', { name: /cancel/i }).first();
      await cancel.click();
      await input.waitFor({ state: 'hidden' });
   }

   async submitRename(name: string): Promise<void> {
      const input = this.page.getByTestId('display-name-input');
      await input.fill(name);
      await this.page.getByTestId('display-name-save').click();
   }

   async expectRenameError(text: string | RegExp): Promise<void> {
      const err = this.page.getByTestId('display-name-error');
      await expect(err).toContainText(text);
   }

   async closeRenameModal(): Promise<void> {
      await this.page.getByRole('button', { name: /cancel/i }).first().click();
   }
}
