import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });
config({ path: '.env', override: false });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be set for drizzle-kit');

export default defineConfig({
   schema: './src/server/db/schema.ts',
   out: './src/server/db/migrations',
   dialect: 'postgresql',
   dbCredentials: { url },
   schemaFilter: ['public'],
   verbose: true,
   strict: true,
});
