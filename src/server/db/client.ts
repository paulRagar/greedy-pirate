import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
   throw new Error('DATABASE_URL is not set');
}

const queryClient = postgres(connectionString, {
   prepare: false,
   max: 10,
   idle_timeout: 20,
});

export const db = drizzle(queryClient, { schema });
export { schema };
