import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AiGatewayService } from './ai-gateway.service';
import { AiLimitsService } from './ai-limits.service';
import { AiQueueService } from './ai-queue.service';
import { AiWorkerService } from './ai-worker.service';
import { AiController } from './ai.controller';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  controllers: [AiController],
  providers: [
    AiGatewayService,
    AiLimitsService,
    AiQueueService,
    AiWorkerService,
  ],
  exports: [AiGatewayService, AiLimitsService, AiQueueService, AiWorkerService],
})
export class AiModule {}
