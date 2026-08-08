import { Module } from '@nestjs/common';
import type { AppDatabase } from '../database/database-schema';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { DatabaseModule } from '../database/database.module';
import {
  createAppSyncEngine,
  createAppSyncStore,
  type AppSyncEngine,
  type AppSyncStore,
} from './sync-store';

export const REMELON_SYNC_STORE = Symbol('REMELON_SYNC_STORE');
export const REMELON_SYNC_ENGINE = Symbol('REMELON_SYNC_ENGINE');

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: REMELON_SYNC_STORE,
      inject: [DATABASE_CONNECTION],
      useFactory: (db: AppDatabase): AppSyncStore => createAppSyncStore(db),
    },
    {
      provide: REMELON_SYNC_ENGINE,
      inject: [REMELON_SYNC_STORE],
      useFactory: (store: AppSyncStore): AppSyncEngine =>
        createAppSyncEngine(store),
    },
  ],
  exports: [REMELON_SYNC_STORE, REMELON_SYNC_ENGINE],
})
export class SyncStoreModule {}
