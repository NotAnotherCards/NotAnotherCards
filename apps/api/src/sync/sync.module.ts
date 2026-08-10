import { Module } from '@nestjs/common';
import { RemelonSyncModule } from '@remelondb/nestjs';
import {
  ReviewEventRow,
  UserCardRow,
  UserDeckRow,
} from '@repo/offline-db';
import type { Request } from 'express';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import {
  REMELON_SYNC_STORE,
  SyncStoreModule,
} from './sync-store.module';
import type { AppSyncStore } from './sync-store';
import { crossValidateSyncRelationships } from './sync-validation';

@Module({
  imports: [
    RemelonSyncModule.forRootAsync<string>({
      imports: [AuthModule, SyncStoreModule],
      inject: [AuthService, REMELON_SYNC_STORE],
      useFactory: (authService: AuthService, store: AppSyncStore) => ({
        store,
        tables: {
          user_decks: UserDeckRow,
          user_cards: UserCardRow,
          review_events: ReviewEventRow,
        },
        tableOptions: { review_events: { appendOnly: true } },
        scopeFrom: (request) =>
          authService.userIdFromHeaders((request as Request).headers),
        crossValidate: crossValidateSyncRelationships,
      }),
    }),
  ],
})
export class SyncModule {}
