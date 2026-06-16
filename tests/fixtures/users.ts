import { test as base, type Browser, type BrowserContext } from '@playwright/test';

/**
 * Isolated browser contexts for multi-user flows. Each context gets
 * its own cookie jar, so Supabase's anonymous sign-in creates a
 * distinct user per context.
 */
export type MultiUser = {
   contextA: BrowserContext;
   contextB: BrowserContext;
};

export const test = base.extend<MultiUser>({
   contextA: async ({ browser }, use) => {
      const ctx = await browser.newContext();
      await use(ctx);
      await ctx.close();
   },
   contextB: async ({ browser }, use) => {
      const ctx = await browser.newContext();
      await use(ctx);
      await ctx.close();
   },
});

export async function freshContext(browser: Browser): Promise<BrowserContext> {
   return browser.newContext();
}

export { expect } from '@playwright/test';
