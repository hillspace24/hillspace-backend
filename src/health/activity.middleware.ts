import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ActivityTracker } from './activity.tracker';

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
  constructor(private readonly activity: ActivityTracker) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    // Keep-alive hits /api/health — do not count as real activity.
    if (!path.endsWith('/health')) {
      this.activity.touch();
    }
    next();
  }
}
