import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as authSchema from './schema';
import * as syncSchema from '../sync/schema';

export const databaseSchema = {
  ...authSchema,
  ...syncSchema,
};

export type AppDatabase = NodePgDatabase<typeof databaseSchema>;
