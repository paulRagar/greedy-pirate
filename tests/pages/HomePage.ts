import type { Page } from '@playwright/test';

/**
 * Walks through home → choose-game → /play/new to charter an online
 * room. Returns the 4-character room code shown in the lobby.
 *
 * The flow is deliberately driven by visible button text instead of
 * test ids so future label tweaks surface as user-facing regressions
 * not just test churn — but where the same label appears multiple
 * times (e.g. "Set Sail"), we anchor on the unique nearby element.
 */
export class HomePage {
   constructor(private readonly page: Page) {}

   async createRoom(visibility: 'public' | 'private' = 'public'): Promise<string> {
      const { page } = this;

      await page.goto('/');
      await page.getByRole('button', { name: /set sail/i }).click();

      // /choose-game
      await page.getByRole('button', { name: /charter ship/i }).click();

      // /play/new — visibility toggle + Set Sail
      const visibilityLabel = visibility === 'public' ? 'Open Voyage' : 'Sealed Hold';
      await page.getByRole('button', { name: new RegExp(visibilityLabel, 'i') }).click();
      // The lobby creator's primary CTA also reads "Set Sail" / "Hoisting".
      await page.getByRole('button', { name: /set sail|hoisting/i }).click();

      const codeEl = page.getByTestId('room-code');
      await codeEl.waitFor({ state: 'visible' });
      const code = (await codeEl.textContent())?.trim() ?? '';
      if (!/^[A-Z0-9]{4}$/.test(code)) {
         throw new Error(`Expected 4-char room code, got "${code}"`);
      }
      return code;
   }
}
