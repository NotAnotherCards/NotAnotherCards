import { Module } from '@nestjs/common';
import { RemelonSyncModule } from '@remelondb/nestjs';
import {
  ReviewEventRow,
  UserCardRow,
  UserDeckRow,
  UserProfileRow,
} from '@repo/offline-db';
import type { Request } from 'express';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { REMELON_SYNC_STORE, SyncStoreModule } from './sync-store.module';
import type { AppSyncStoreBundle } from './sync-store';

@Module({
  imports: [
    RemelonSyncModule.forRootAsync<string>({
      imports: [AuthModule, SyncStoreModule],
      inject: [AuthService, REMELON_SYNC_STORE],
      useFactory: (
        authService: AuthService,
        { store, crossValidateChanges }: AppSyncStoreBundle,
      ) => ({
        store,
        tables: {
          user_decks: UserDeckRow,
          user_cards: UserCardRow,
          review_events: ReviewEventRow,
          user_profiles: UserProfileRow,
        },
        tableOptions: { review_events: { appendOnly: true } },
        scopeFrom: (request) =>
          authService.userIdFromHeaders((request as Request).headers),
        crossValidateChanges,
      }),
    }),
  ],
})
export class SyncModule {}
