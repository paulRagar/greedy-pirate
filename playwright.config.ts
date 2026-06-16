import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Load the project's local env so server-action testids that depend on
// Supabase credentials (admin seeding, etc.) resolve correctly. We
// prefer .env.local; .env is the fallback when it's missing.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

/**
 * Playwright config — runs against the local Next dev server + local
 * Supabase stack. Both must be running (`npm run dev`, `npm run
 * supabase:start`) before invoking `npx playwright test`.
 *
 * Multi-user flows need two browser contexts; default workers stays low
 * so contexts don't trample each other when they share the local stack.
 */
export default defineConfig({
   testDir: './tests/e2e',
   timeout: 30_000,
   expect: { timeout: 5_000 },
   fullyParallel: false,
   workers: process.env.CI ? 2 : 1,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 1 : 0,
   reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
   use: {
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
   },
   projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
   ],
   webServer: process.env.PLAYWRIGHT_SKIP_DEV
      ? undefined
      : {
           command: 'npm run dev',
           url: 'http://localhost:3000',
           timeout: 60_000,
           reuseExistingServer: true,
        },
});
