import { Module } from '@nestjs/common';
import type { AppDatabase } from '../database/database-schema';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { DatabaseModule } from '../database/database.module';
import { GamificationModule } from '../gamification/gamification.module';
import { GamificationService } from '../gamification/gamification.service';
import {
  createAppSyncEngine,
  createAppSyncStore,
  type AppSyncEngine,
  type AppSyncStoreBundle,
} from './sync-store';

export const REMELON_SYNC_STORE = Symbol('REMELON_SYNC_STORE');
export const REMELON_SYNC_ENGINE = Symbol('REMELON_SYNC_ENGINE');

@Module({
  imports: [DatabaseModule, GamificationModule],
  providers: [
    {
      provide: REMELON_SYNC_STORE,
      inject: [DATABASE_CONNECTION, GamificationService],
      useFactory: (
        db: AppDatabase,
        gamification: GamificationService,
      ): AppSyncStoreBundle =>
        createAppSyncStore(db, undefined, (userId) =>
          gamification.refreshAwards(userId).then(() => undefined),
        ),
    },
    {
      provide: REMELON_SYNC_ENGINE,
      inject: [REMELON_SYNC_STORE],
      useFactory: (bundle: AppSyncStoreBundle): AppSyncEngine =>
        createAppSyncEngine(bundle),
    },
  ],
  exports: [REMELON_SYNC_STORE, REMELON_SYNC_ENGINE],
})
export class SyncStoreModule {}
