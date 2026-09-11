import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type PaystackInitializeInput = {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  currency?: string;
};

export type PaystackInitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type PaystackVerifyResult = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
  metadata?: Record<string, unknown>;
  gatewayResponse?: string;
  raw: Record<string, unknown>;
};

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('app.paystack.secretKey')?.trim() || '';
    this.publicKey = config.get<string>('app.paystack.publicKey')?.trim() || '';
    this.baseUrl =
      config.get<string>('app.paystack.baseUrl')?.trim() ||
      'https://api.paystack.co';
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Paystack is not configured. Set PAYSTACK_SECRET_KEY.',
      );
    }
  }

  /** Amount must be sent to Paystack in kobo (NGN * 100). */
  toKobo(amountNaira: number): number {
    return Math.round(Number(amountNaira) * 100);
  }

  async initialize(
    input: PaystackInitializeInput,
  ): Promise<PaystackInitializeResult> {
    this.assertConfigured();
    const body = {
      email: input.email,
      amount: this.toKobo(input.amountNaira),
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: input.currency ?? 'NGN',
      metadata: input.metadata ?? {},
    };

    const data = await this.request<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>('POST', '/transaction/initialize', body);

    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference,
    };
  }

  async verify(reference: string): Promise<PaystackVerifyResult> {
    this.assertConfigured();
    const data = await this.request<Record<string, unknown>>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    return {
      status: String(data.status ?? ''),
      reference: String(data.reference ?? reference),
      amount: Number(data.amount ?? 0) / 100,
      currency: String(data.currency ?? 'NGN'),
      paidAt: data.paid_at ? String(data.paid_at) : undefined,
      metadata: (data.metadata as Record<string, unknown>) ?? undefined,
      gatewayResponse: data.gateway_response
        ? String(data.gateway_response)
        : undefined,
      raw: data,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    if (!this.secretKey || !signature) return false;
    const hash = createHmac('sha512', this.secretKey)
      .update(typeof rawBody === 'string' ? rawBody : rawBody)
      .digest('hex');
    try {
      return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: T;
    };

    if (!res.ok || json.status === false) {
      const message = json.message || `Paystack ${method} ${path} failed`;
      this.logger.warn(message);
      throw new ServiceUnavailableException(message);
    }

    return json.data as T;
  }
}
