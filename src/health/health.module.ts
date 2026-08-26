import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityMiddleware } from './activity.middleware';
import { ActivityTracker } from './activity.tracker';
import { HealthController } from './health.controller';
import { KeepAliveService } from './keep-alive.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [HealthController],
  providers: [ActivityTracker, ActivityMiddleware, KeepAliveService],
})
export class HealthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActivityMiddleware).forRoutes('*');
  }
}
