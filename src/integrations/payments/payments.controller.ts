import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BookingsService } from '../../bookings/bookings.service';
import { EscrowService } from '../../escrow/escrow.service';
import { PaymentProvider } from './payment-provider.enum';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly escrowService: EscrowService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('providers')
  @ApiOperation({ summary: 'Which payment providers are configured' })
  providers() {
    return {
      paystack: {
        configured: this.payments.paystack.isConfigured(),
        publicKey: this.payments.paystack.isConfigured()
          ? this.payments.paystack.getPublicKey()
          : undefined,
        useFor: ['inspection_fees', 'optional_escrow_collect'],
      },
      atarapay: {
        configured: this.payments.atarapay.isConfigured(),
        useFor: ['escrow_hold_release'],
        docs: 'https://plugins.atarapay.com/docs/',
      },
      note: 'Prefer AtaraPay for property escrow. Paystack does not hold third-party escrow. Missing keys do not block the rest of the API.',
    };
  }

  @Get('atarapay/callback')
  @Post('atarapay/callback')
  @ApiOperation({
    summary: 'AtaraPay redirect callback after buyer pays',
    description:
      'Configure this URL in AtaraPay seller Settings → Callback URL, or pass it as callback_url on checkout.',
  })
  async atarapayCallback(
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    if (!this.payments.atarapay.isConfigured()) {
      return res.status(503).json({
        ok: false,
        message:
          'AtaraPay is not configured yet. Set ATARAPAY_PUBLIC_KEY and ATARAPAY_PRIVATE_KEY.',
      });
    }
    const payload = { ...query, ...body };
    const result = await this.escrowService.handleAtaraPayCallback(payload);
    if (result.redirect) {
      return res.redirect(result.redirect);
    }
    return res.json(result);
  }

  @Post('atarapay/webhook')
  @ApiOperation({
    summary: 'AtaraPay order status notifications (accept/reject/deliver/cancel)',
  })
  async atarapayWebhook(@Body() body: Record<string, any>) {
    if (!this.payments.atarapay.isConfigured()) {
      this.logger.warn('AtaraPay webhook received but keys are not configured');
      return {
        ok: false,
        message: 'AtaraPay is not configured',
      };
    }
    const escrow = await this.escrowService.handleAtaraPayNotification(body);
    return {
      ok: true,
      escrowId: (escrow as any).id ?? (escrow as any)._id,
      status: (escrow as any).status,
    };
  }

  @Post('paystack/webhook')
  @ApiOperation({ summary: 'Paystack charge.success webhook' })
  async paystackWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string,
    @Body() body: Record<string, any>,
  ) {
    if (!this.payments.paystack.isConfigured()) {
      this.logger.warn('Paystack webhook received but keys are not configured');
      return { ok: false, message: 'Paystack is not configured' };
    }

    const raw =
      req.rawBody ||
      Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    if (!this.payments.paystack.verifyWebhookSignature(raw, signature)) {
      this.logger.warn('Paystack webhook signature mismatch');
      return { ok: false };
    }

    const event = body.event as string;
    const data = body.data ?? {};
    if (event !== 'charge.success') {
      return { ok: true, ignored: event };
    }

    const reference = String(data.reference ?? '');
    const metadata = data.metadata ?? {};
    const type = String(metadata.type ?? '');

    if (type === 'booking') {
      await this.bookingsService.markPaidByProvider({
        bookingId: String(metadata.bookingId ?? ''),
        reference,
        provider: PaymentProvider.PAYSTACK,
      });
      return { ok: true, type: 'booking' };
    }

    await this.escrowService.markFundedByProvider({
      escrowId: String(metadata.escrowId ?? ''),
      provider: PaymentProvider.PAYSTACK,
      providerReference: reference,
      note: 'Paystack charge.success webhook',
    });
    return { ok: true, type: 'escrow' };
  }

  @Get('paystack/verify')
  @ApiOperation({
    summary: 'Verify a Paystack reference and apply to escrow or booking',
  })
  async verifyPaystack(@Query('reference') reference: string) {
    if (!this.payments.paystack.isConfigured()) {
      throw new ServiceUnavailableException(
        'Paystack is not configured. Set PAYSTACK_SECRET_KEY.',
      );
    }
    if (!reference?.trim()) {
      return { ok: false, message: 'reference is required' };
    }

    const verified = await this.payments.paystack.verify(reference);
    if (verified.status !== 'success') {
      return { ok: false, verified };
    }

    const type = String(verified.metadata?.type ?? '');
    if (type === 'booking') {
      const booking = await this.bookingsService.markPaidByProvider({
        bookingId: String(verified.metadata?.bookingId ?? ''),
        reference: verified.reference,
        provider: PaymentProvider.PAYSTACK,
      });
      return { ok: true, type: 'booking', booking };
    }

    const escrow = await this.escrowService.verifyPaystackPayment(reference);
    return { ok: true, type: 'escrow', escrow };
  }
}
