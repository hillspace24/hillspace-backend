import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AtaraPayService } from './atarapay.service';
import { PaystackService } from './paystack.service';

/**
 * Thin facade used by escrow/bookings so domain services do not depend on
 * provider wiring details.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    readonly paystack: PaystackService,
    readonly atarapay: AtaraPayService,
    private readonly config: ConfigService,
  ) {}

  backendBaseUrl(): string {
    return (
      process.env.RENDER_EXTERNAL_URL?.trim() ||
      process.env.BACKEND_URL?.trim() ||
      `http://127.0.0.1:${this.config.get<number>('app.port') ?? 3000}`
    )
      .replace(/\/$/, '')
      .replace(/\/api$/, '');
  }

  frontendBaseUrl(): string {
    return (
      process.env.FRONTEND_URL?.trim() || 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  atarapayCallbackUrl(): string {
    return `${this.backendBaseUrl()}/api/payments/atarapay/callback`;
  }

  paystackEscrowCallbackUrl(escrowId: string): string {
    return `${this.frontendBaseUrl()}/escrow/${escrowId}/payment-return`;
  }

  paystackBookingCallbackUrl(bookingId: string): string {
    return `${this.frontendBaseUrl()}/bookings/${bookingId}/payment-return`;
  }

  logProviders(): void {
    this.logger.log(
      `Payments: Paystack=${this.paystack.isConfigured() ? 'on' : 'off'}, AtaraPay=${this.atarapay.isConfigured() ? 'on' : 'off'}`,
    );
  }
}
