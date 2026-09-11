import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AtaraPayService } from './atarapay.service';
import { PaystackService } from './paystack.service';

/**
 * Thin facade used by escrow/bookings so domain services do not depend on
 * provider wiring details.
 *
 * Keys are optional at boot — the API stays up. Checkout / verify / webhook
 * routes that need a provider return 503 only when those endpoints are hit.
 */
@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    readonly paystack: PaystackService,
    readonly atarapay: AtaraPayService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const paystackOn = this.paystack.isConfigured();
    const ataraOn = this.atarapay.isConfigured();
    this.logger.log(
      `Payments ready (lazy): Paystack=${paystackOn ? 'on' : 'off'}, AtaraPay=${ataraOn ? 'on' : 'off'}`,
    );
    if (!paystackOn) {
      this.logger.warn(
        'Paystack keys not set — app still runs. Set PAYSTACK_SECRET_KEY before calling Paystack checkout/verify.',
      );
    }
    if (!ataraOn) {
      this.logger.warn(
        'AtaraPay keys not set — app still runs. Set ATARAPAY_PUBLIC_KEY and ATARAPAY_PRIVATE_KEY before escrow checkout.',
      );
    }
  }

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
}
