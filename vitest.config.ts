import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
   resolve: {
      alias: {
         '@/game': path.resolve(__dirname, './src/game'),
         '@/server': path.resolve(__dirname, './src/server'),
         '@/client': path.resolve(__dirname, './src/client'),
         '@/ui': path.resolve(__dirname, './src/ui'),
         '@/lib': path.resolve(__dirname, './src/lib'),
      },
   },
   test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
   },
});
