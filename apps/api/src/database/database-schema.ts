import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as authSchema from './schema';
import * as syncSchema from '../sync/schema';
import * as aiSchema from '../ai/schema';
import * as sharingSchema from '../sharing/schema';
import * as gamificationSchema from '../gamification/schema';

export const databaseSchema = {
  ...authSchema,
  ...syncSchema,
  ...aiSchema,
  ...sharingSchema,
  ...gamificationSchema,
};

export type AppDatabase = NodePgDatabase<typeof databaseSchema>;
