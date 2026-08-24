import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as authSchema from './schema';
import * as syncSchema from '../sync/schema';
import * as aiSchema from '../ai/schema';

export const databaseSchema = {
  ...authSchema,
  ...syncSchema,
  ...aiSchema,
};

export type AppDatabase = NodePgDatabase<typeof databaseSchema>;
