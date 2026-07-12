import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// migrate/push need DATABASE_URL, which lives in the root .env
config({ path: '../../.env' });

export default defineConfig({
  out: './drizzle',
  schema: './src/schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
