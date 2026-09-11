import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AtaraPayCheckoutFields = {
  token: string;
  email: string;
  phone_number: string;
  currency: string;
  amount: number;
  amount_fx?: string;
  customer_firstname: string;
  customer_lastname: string;
  order_product_id: string;
  order_product_name: string;
  order_product_desc?: string;
  delivery_date: string;
  delivery_location: string;
  recipient: string;
  type: number;
  is_marketplace: number;
  seller_phone?: string | null;
  callback_url: string;
  product_type: 'physical' | 'virtual';
  order_product_quantity?: number;
  order_product_weight?: number;
  order_product_dimension?: string;
};

export type AtaraPayCheckoutPayload = {
  mode: 'form_post';
  actionUrl: string;
  authorization: string;
  fields: AtaraPayCheckoutFields;
};

export type AtaraPayOrderStatus = {
  id: number | string;
  product_id?: string;
  amount_payed?: number;
  currency?: string;
  payment_ref?: string | null;
  gateway_name?: string | null;
  status?: { id?: number; title?: string; description?: string };
  payment?: {
    payment_ref?: string;
    status?: string;
    amount?: number;
    gateway_response?: string;
  };
  raw: Record<string, unknown>;
};

@Injectable()
export class AtaraPayService {
  private readonly logger = new Logger(AtaraPayService.name);
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly payUrl: string;
  private readonly apiUrl: string;
  private readonly isMarketplace: boolean;

  constructor(config: ConfigService) {
    this.publicKey = config.get<string>('app.atarapay.publicKey')?.trim() || '';
    this.privateKey =
      config.get<string>('app.atarapay.privateKey')?.trim() || '';
    this.payUrl =
      config.get<string>('app.atarapay.payUrl')?.trim() ||
      'https://pay.atarapay.com';
    this.apiUrl =
      config.get<string>('app.atarapay.apiUrl')?.trim() ||
      'https://api.atarapay.com';
    this.isMarketplace =
      config.get<boolean>('app.atarapay.isMarketplace') === true;
  }

  isConfigured(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'AtaraPay is not configured. Set ATARAPAY_PUBLIC_KEY and ATARAPAY_PRIVATE_KEY.',
      );
    }
  }

  /** Auth token for seller API calls: base64(public:private). */
  getAuthToken(): string {
    this.assertConfigured();
    return Buffer.from(`${this.publicKey}:${this.privateKey}`).toString(
      'base64',
    );
  }

  /**
   * Notification security token:
   * base64(public:private:orderId:koboAmount)
   */
  buildNotificationToken(orderId: string | number, koboAmount: number): string {
    this.assertConfigured();
    return Buffer.from(
      `${this.publicKey}:${this.privateKey}:${orderId}:${koboAmount}`,
    ).toString('base64');
  }

  verifyNotificationToken(
    token: string | undefined,
    orderId: string | number,
    koboAmount: number,
  ): boolean {
    if (!token || !this.isConfigured()) return false;
    const expected = this.buildNotificationToken(orderId, koboAmount);
    return token === expected;
  }

  /** NGN major units → kobo for AtaraPay amount field. */
  toKobo(amountNaira: number): number {
    return Math.round(Number(amountNaira) * 100);
  }

  buildCheckout(input: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    amountNaira: number;
    currency?: string;
    productId: string;
    productName: string;
    productDesc?: string;
    deliveryLocation: string;
    deliveryDate?: Date;
    callbackUrl: string;
    sellerPhone?: string | null;
    productType?: 'physical' | 'virtual';
  }): AtaraPayCheckoutPayload {
    this.assertConfigured();
    const currency = (input.currency ?? 'NGN').toUpperCase();
    const amount = this.toKobo(input.amountNaira);
    const deliveryDate = (input.deliveryDate ?? new Date(Date.now() + 7 * 864e5))
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const fields: AtaraPayCheckoutFields = {
      token: this.publicKey,
      email: input.email,
      phone_number: input.phone,
      currency,
      amount,
      customer_firstname: input.firstName,
      customer_lastname: input.lastName,
      order_product_id: input.productId,
      order_product_name: input.productName,
      order_product_desc: input.productDesc,
      delivery_date: deliveryDate,
      delivery_location: input.deliveryLocation,
      recipient: input.phone,
      type: 1,
      is_marketplace: this.isMarketplace ? 1 : 0,
      seller_phone: this.isMarketplace ? input.sellerPhone ?? null : null,
      callback_url: input.callbackUrl,
      product_type: input.productType ?? 'virtual',
      order_product_quantity: 1,
    };

    if (currency === 'USD') {
      fields.amount_fx = String(input.amountNaira);
    }

    return {
      mode: 'form_post',
      actionUrl: this.payUrl,
      authorization: `Bearer ${this.publicKey}`,
      fields,
    };
  }

  async getOrder(orderId: string | number): Promise<AtaraPayOrderStatus> {
    this.assertConfigured();
    const body = new URLSearchParams({
      authtoken: this.getAuthToken(),
      order: String(orderId),
      status: 'order',
    });

    const json = await this.postForm<{
      status?: string;
      message?: string;
      data?: Record<string, unknown>;
    }>('/api/callback/order', body);

    if (json.status !== 'success' || !json.data) {
      throw new ServiceUnavailableException(
        json.message || 'Failed to fetch AtaraPay order',
      );
    }

    const data = json.data;
    return {
      id: (data.id as number | string) ?? orderId,
      product_id: data.product_id != null ? String(data.product_id) : undefined,
      amount_payed:
        data.amount_payed != null ? Number(data.amount_payed) : undefined,
      currency: data.currency != null ? String(data.currency) : undefined,
      payment_ref:
        data.payment_ref != null ? String(data.payment_ref) : undefined,
      gateway_name:
        data.gateway_name != null ? String(data.gateway_name) : undefined,
      status: data.status as AtaraPayOrderStatus['status'],
      payment: data.payment as AtaraPayOrderStatus['payment'],
      raw: data,
    };
  }

  async markDelivered(input: {
    orderId: string | number;
    buyerPhone: string;
    buyerEmail?: string;
  }): Promise<void> {
    this.assertConfigured();
    const body = new URLSearchParams({
      authtoken: this.getAuthToken(),
      order: String(input.orderId),
      status: 'delivered',
      phone_number: input.buyerPhone,
    });
    if (input.buyerEmail) body.set('email', input.buyerEmail);

    const json = await this.postForm<{ status?: string; message?: string }>(
      '/api/callback/order',
      body,
    );
    if (json.status !== 'success') {
      this.logger.warn(
        `AtaraPay markDelivered failed for ${input.orderId}: ${json.message}`,
      );
      throw new ServiceUnavailableException(
        json.message || 'AtaraPay could not mark order delivered',
      );
    }
  }

  async cancelOrder(input: {
    orderId: string | number;
    status: 'cancelled' | 'buyer_cancel';
    comment?: string;
  }): Promise<void> {
    this.assertConfigured();
    const body = new URLSearchParams({
      authtoken: this.getAuthToken(),
      order: String(input.orderId),
      status: input.status,
    });
    if (input.comment) body.set('comment', input.comment);

    const json = await this.postForm<{ status?: string; message?: string }>(
      '/api/callback/order',
      body,
    );
    if (json.status !== 'success') {
      this.logger.warn(
        `AtaraPay cancel failed for ${input.orderId}: ${json.message}`,
      );
      throw new ServiceUnavailableException(
        json.message || 'AtaraPay could not cancel order',
      );
    }
  }

  private async postForm<T>(
    _path: string,
    body: URLSearchParams,
  ): Promise<T> {
    const finalUrl = this.resolveOrderUrl();

    const res = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const json = (await res.json().catch(() => ({}))) as T & {
      status?: string;
      message?: string;
    };

    if (!res.ok) {
      this.logger.warn(
        `AtaraPay POST ${finalUrl} → ${res.status}: ${json.message ?? ''}`,
      );
      throw new ServiceUnavailableException(
        json.message || `AtaraPay request failed (${res.status})`,
      );
    }

    return json;
  }

  private resolveOrderUrl(): string {
    const base = this.apiUrl.replace(/\/$/, '');
    // Staging: http://test-api.atarapay.com/api/callback/order
    if (base.includes('test-api.atarapay.com')) {
      return `${base}/api/callback/order`;
    }
    // Live docs: https://api.atarapay.com/api/api/callback/order
    if (base.endsWith('/api')) {
      return `${base}/api/callback/order`;
    }
    return `${base}/api/api/callback/order`;
  }
}
