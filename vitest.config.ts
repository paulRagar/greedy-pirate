import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
   plugins: [react()],
   resolve: {
      alias: {
         '@/game': path.resolve(__dirname, './src/game'),
         '@/server': path.resolve(__dirname, './src/server'),
         '@/client': path.resolve(__dirname, './src/client'),
         '@/ui': path.resolve(__dirname, './src/ui'),
         '@/lib': path.resolve(__dirname, './src/lib'),
         // Stub `server-only` so server-only modules can be unit-tested
         // in node. The guard exists for the Next bundler, not for us.
         'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
      },
   },
   test: {
      // Default node for the pure engine/lib/server tests. Component smoke
      // tests opt into jsdom per-file via a `// @vitest-environment jsdom`
      // docblock so we don't pay DOM setup cost on the pure suites.
      environment: 'node',
      setupFiles: ['./tests/setup/dom.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
   },
});
