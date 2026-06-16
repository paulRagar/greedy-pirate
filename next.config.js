const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
   reactStrictMode: true,
   outputFileTracingRoot: path.join(__dirname),
   images: {
      // 75 = next/image default; 85 = home hero key art
      qualities: [75, 85],
   },
   webpack: (config) => {
      // Keep webpack's HMR file watcher off the Playwright workspace.
      // Without this, every screenshot / trace / report write the test
      // runner produces invalidates webpack and forces /choose-game (and
      // friends) to recompile, causing a loop in `playwright test --ui`.
      // Webpack's `ignored` must be all-globs (strings) or all-RegExp;
      // mixing the defaults (which include a RegExp) trips its schema
      // validator, so we replace the array outright.
      config.watchOptions = {
         ...(config.watchOptions ?? {}),
         ignored: [
            '**/.git/**',
            '**/node_modules/**',
            '**/.next/**',
            '**/tests/**',
            '**/test-results/**',
            '**/playwright-report/**',
            '**/playwright/.cache/**',
         ],
      };
      return config;
   },
};

module.exports = nextConfig;
