import type { Page } from '@playwright/test';

/**
 * The page a non-member sees when they hit /play/[code]. After the
 * anonymous bootstrap reload, a public room presents a "Board the ship"
 * CTA; a private one immediately hails the captain on mount.
 */
export class JoinGatePage {
   constructor(private readonly page: Page) {}

   async board(): Promise<void> {
      const boardCta = this.page.getByRole('button', { name: /board the ship/i });
      await boardCta.waitFor({ state: 'visible', timeout: 15_000 });
      await boardCta.click();
   }
}
