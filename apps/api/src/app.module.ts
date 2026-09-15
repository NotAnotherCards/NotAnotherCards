import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { AiModule } from './ai/ai.module';
import { MetricsModule } from './metrics/metrics.module';
import { SharingModule } from './sharing/sharing.module';
import { GamificationModule } from './gamification/gamification.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DatabaseModule,
    AuthModule,
    SyncModule,
    AiModule,
    MetricsModule,
    SharingModule,
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
