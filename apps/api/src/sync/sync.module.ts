import { Module } from '@nestjs/common';
import { RemelonSyncModule } from '@remelondb/nestjs';
import type { Request } from 'express';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { REMELON_SYNC_STORE, SyncStoreModule } from './sync-store.module';
import {
  createAppSyncEngineConfig,
  type AppSyncStoreBundle,
} from './sync-store';

@Module({
  imports: [
    RemelonSyncModule.forRootAsync<string>({
      imports: [AuthModule, SyncStoreModule],
      inject: [AuthService, REMELON_SYNC_STORE],
      useFactory: (authService: AuthService, bundle: AppSyncStoreBundle) => ({
        ...createAppSyncEngineConfig(bundle),
        scopeFrom: (request) =>
          authService.userIdFromHeaders((request as Request).headers),
      }),
    }),
  ],
})
export class SyncModule {}
