import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AiGatewayService } from './ai-gateway.service';
import { AiLimitsService } from './ai-limits.service';
import { AiQueueService } from './ai-queue.service';
import { AiWorkerService } from './ai-worker.service';
import { AiController } from './ai.controller';
import { AiPlaygroundService } from './ai-playground.service';
import { ModerationService } from '../sharing/moderation.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  controllers: [AiController],
  providers: [
    AiGatewayService,
    AiLimitsService,
    AiQueueService,
    AiWorkerService,
    AiPlaygroundService,
    ModerationService,
  ],
  exports: [
    AiGatewayService,
    AiLimitsService,
    AiQueueService,
    AiWorkerService,
    ModerationService,
  ],
})
export class AiModule {}
