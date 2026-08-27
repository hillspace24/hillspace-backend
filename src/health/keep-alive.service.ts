import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityTracker } from './activity.tracker';

const NINE_MINUTES_MS = 9 * 60 * 1000;

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);
  private readonly enabled: boolean;
  private readonly idleMs: number;
  private readonly targetUrl: string;
  private lastPingAt = 0;
  private inFlight = false;

  constructor(
    private readonly activity: ActivityTracker,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('app.keepAlive.enabled') ?? true;
    this.idleMs = config.get<number>('app.keepAlive.idleMs') ?? NINE_MINUTES_MS;
    this.targetUrl = this.resolveTargetUrl(config);

    if (this.enabled) {
      this.logger.log(
        `Keep-alive on: GET ${this.targetUrl} after ${Math.round(this.idleMs / 60000)}m idle`,
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!this.enabled || this.inFlight) {
      return;
    }

    const now = Date.now();
    if (!this.activity.isIdle(this.idleMs)) {
      return;
    }
    if (this.lastPingAt > 0 && now - this.lastPingAt < this.idleMs) {
      return;
    }

    this.inFlight = true;
    this.lastPingAt = now;
    try {
      const res = await fetch(this.targetUrl, {
        method: 'GET',
        headers: { 'user-agent': 'hillspace-keep-alive' },
      });
      if (!res.ok) {
        this.logger.warn(`Keep-alive ping returned ${res.status}`);
        return;
      }
      this.logger.debug(`Keep-alive ping ok (${res.status})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Keep-alive ping failed: ${message}`);
    } finally {
      this.inFlight = false;
    }
  }

  private resolveTargetUrl(config: ConfigService): string {
    const port = config.get<number>('app.port') ?? 3000;
    // Hit the local process so idle detection uses real inbound traffic without
    // depending on public DNS. RENDER_EXTERNAL_URL remains available as override.
    const base = (
      process.env.KEEP_ALIVE_URL?.trim() ||
      `http://127.0.0.1:${port}`
    )
      .replace(/\/$/, '')
      .replace(/\/api$/, '');
    return `${base}/api/health`;
  }
}
