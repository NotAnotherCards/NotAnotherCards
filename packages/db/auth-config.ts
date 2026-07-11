import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

// Only used by the better-auth CLI to generate src/schema/auth.ts,
// never actually connects to a db. If the api adds better-auth plugins
// they need to be mirrored here and the schema regenerated (see README).
const db = drizzle('postgresql://placeholder@localhost:5432/placeholder');

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
});
