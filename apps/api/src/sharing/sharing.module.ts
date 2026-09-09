import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ModerationService } from './moderation.service';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  controllers: [SharingController],
  providers: [ModerationService, SharingService],
})
export class SharingModule {}
