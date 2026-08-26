import { Injectable } from '@nestjs/common';

/** Tracks last real HTTP activity (keep-alive pings are excluded). */
@Injectable()
export class ActivityTracker {
  private lastActivityAt = Date.now();

  touch(): void {
    this.lastActivityAt = Date.now();
  }

  getLastActivityAt(): number {
    return this.lastActivityAt;
  }

  idleMs(): number {
    return Date.now() - this.lastActivityAt;
  }

  isIdle(thresholdMs: number): boolean {
    return this.idleMs() >= thresholdMs;
  }
}
