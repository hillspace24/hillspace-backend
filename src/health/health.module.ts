import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityMiddleware } from './activity.middleware';
import { ActivityTracker } from './activity.tracker';
import { HealthController } from './health.controller';
import { KeepAliveService } from './keep-alive.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [HealthController],
  providers: [ActivityTracker, ActivityMiddleware, KeepAliveService],
  exports: [ActivityTracker, ActivityMiddleware],
})
export class HealthModule {}
