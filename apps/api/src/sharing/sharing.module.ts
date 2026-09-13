import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { ModerationExplanationService } from './moderation-explanation.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule, AiModule],
  controllers: [SharingController],
  providers: [SharingService, ModerationExplanationService],
})
export class SharingModule {}
