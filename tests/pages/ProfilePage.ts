import type { Page } from '@playwright/test';

export class ProfilePage {
   constructor(private readonly page: Page) {}

   async goto(): Promise<void> {
      await this.page.goto('/profile');
      await this.page.getByTestId('profile-rename').waitFor({ state: 'visible' });
   }

   async rename(name: string): Promise<void> {
      await this.page.getByTestId('profile-rename').click();
      const input = this.page.getByTestId('display-name-input');
      await input.waitFor({ state: 'visible' });
      await input.fill(name);
      await this.page.getByTestId('display-name-save').click();
      // Modal closes on success.
      await input.waitFor({ state: 'hidden' });
   }
}
