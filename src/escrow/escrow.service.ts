import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EscrowStatus } from '../common/enums/escrow-status.enum';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { Role } from '../common/enums/role.enum';
import { PaymentProvider } from '../integrations/payments/payment-provider.enum';
import { PaymentsService } from '../integrations/payments/payments.service';
import { ListingsService } from '../listings/listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.schema';
import { CheckoutEscrowDto } from './dto/checkout-escrow.dto';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { DisputeEscrowDto } from './dto/dispute-escrow.dto';
import { FundEscrowDto } from './dto/fund-escrow.dto';
import { TransitionEscrowDto } from './dto/transition-escrow.dto';
import { Escrow, EscrowDocument } from './escrow.schema';

const TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  [EscrowStatus.INITIATED]: [EscrowStatus.FUNDED, EscrowStatus.CANCELLED],
  [EscrowStatus.FUNDED]: [
    EscrowStatus.INSPECTION,
    EscrowStatus.DISPUTED,
    EscrowStatus.REFUNDED,
  ],
  [EscrowStatus.INSPECTION]: [
    EscrowStatus.RELEASED,
    EscrowStatus.DISPUTED,
    EscrowStatus.REFUNDED,
  ],
  [EscrowStatus.DISPUTED]: [EscrowStatus.RELEASED, EscrowStatus.REFUNDED],
  [EscrowStatus.RELEASED]: [],
  [EscrowStatus.REFUNDED]: [],
  [EscrowStatus.CANCELLED]: [],
};

const REVIEW_DAYS = 5;

@Injectable()
export class EscrowService {
  constructor(
    @InjectModel(Escrow.name) private readonly escrowModel: Model<Escrow>,
    private readonly listingsService: ListingsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly payments: PaymentsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private makeRef(): string {
    return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-11);
  }

  private makeDisputeCode(): string {
    const year = new Date().getFullYear();
    const n = Math.floor(Math.random() * 90000) + 10000;
    return `DISP-${year}-${n}`;
  }

  async create(buyerId: string, dto: CreateEscrowDto): Promise<EscrowDocument> {
    const listing = await this.listingsService.findById(dto.listingId);
    const sellerId = listing.owner.toString();

    if (sellerId === buyerId) {
      throw new BadRequestException('Cannot create escrow on your own listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not available for escrow');
    }

    const escrow = await this.escrowModel.create({
      listing: listing._id,
      buyer: new Types.ObjectId(buyerId),
      seller: listing.owner,
      amount: dto.amount,
      currency: dto.currency ?? listing.currency ?? 'NGN',
      adminFee: 0,
      status: EscrowStatus.INITIATED,
      refNumber: this.makeRef(),
      paymentProvider: PaymentProvider.MANUAL,
      timeline: [
        {
          status: EscrowStatus.INITIATED,
          note: 'Offer accepted / escrow deal created',
          by: new Types.ObjectId(buyerId),
          at: new Date(),
        },
      ],
    });

    await this.listingsService.setStatus(
      listing.id,
      ListingStatus.UNDER_OFFER,
    );

    return escrow;
  }

  async findById(id: string): Promise<EscrowDocument> {
    const escrow = await this.escrowModel
      .findById(id)
      .populate('listing', 'title price status images location currency description')
      .populate('buyer', 'firstName lastName email phone')
      .populate('seller', 'firstName lastName email phone');

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }
    return escrow;
  }

  async findByIdForUser(
    id: string,
    userId: string,
    role: Role,
  ): Promise<EscrowDocument> {
    await this.getParticipantEscrow(id, userId, role);
    return this.findById(id);
  }

  async myDeals(userId: string, status?: EscrowStatus) {
    const user = new Types.ObjectId(userId);
    const filter: Record<string, unknown> = {
      $or: [{ buyer: user }, { seller: user }],
    };
    if (status) filter.status = status;
    return this.escrowModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('listing', 'title price status images location');
  }

  async receipt(id: string, userId: string, role: Role) {
    const escrow = await this.findByIdForUser(id, userId, role);
    const buyer = escrow.buyer as any;
    const method =
      escrow.paymentProvider === PaymentProvider.ATARAPAY
        ? 'AtaraPay Escrow'
        : escrow.paymentProvider === PaymentProvider.PAYSTACK
          ? 'Paystack'
          : escrow.fundingReference
            ? 'Bank Transfer'
            : 'Manual';
    return {
      refNumber: escrow.refNumber,
      paymentTime:
        escrow.paidAt ?? (escrow as any).updatedAt ?? (escrow as any).createdAt,
      paymentMethod: method,
      paymentProvider: escrow.paymentProvider ?? PaymentProvider.MANUAL,
      providerReference: escrow.providerReference,
      senderName: buyer
        ? `${buyer.firstName ?? ''} ${buyer.lastName ?? ''}`.trim()
        : undefined,
      status: escrow.status,
      amount: escrow.amount,
      adminFee: escrow.adminFee ?? 0,
      currency: escrow.currency,
      listing: escrow.listing,
      fundingReference: escrow.fundingReference,
    };
  }

  /**
   * Start gateway checkout for an initiated escrow.
   * AtaraPay = true escrow. Paystack = collect to merchant (not third-party escrow).
   */
  async checkout(
    id: string,
    userId: string,
    role: Role,
    dto: CheckoutEscrowDto,
  ) {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    if (escrow.buyer.toString() !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('Only the buyer can pay for this escrow');
    }
    if (escrow.status !== EscrowStatus.INITIATED) {
      throw new BadRequestException(
        `Escrow must be initiated to checkout (current: ${escrow.status})`,
      );
    }

    const populated = await this.findById(id);
    const buyer = populated.buyer as unknown as User & { _id: Types.ObjectId };
    const listing = populated.listing as any;
    if (!buyer?.email || !buyer?.phone) {
      throw new BadRequestException('Buyer email and phone are required to pay');
    }

    const location = listing?.location;
    const deliveryLocation = [
      location?.address,
      location?.city,
      location?.state,
      location?.country ?? 'Nigeria',
    ]
      .filter(Boolean)
      .join(', ');

    if (dto.provider === PaymentProvider.ATARAPAY) {
      this.payments.atarapay.assertConfigured();
      const productId = escrow.refNumber || escrow.id;
      const checkout = this.payments.atarapay.buildCheckout({
        email: buyer.email,
        phone: buyer.phone,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        amountNaira: escrow.amount,
        currency: escrow.currency,
        productId,
        productName: listing?.title || `HillSpace Escrow ${productId}`,
        productDesc: listing?.description?.slice?.(0, 200) || 'Property escrow',
        deliveryLocation: deliveryLocation || 'Nigeria',
        callbackUrl: dto.callbackUrl || this.payments.atarapayCallbackUrl(),
        sellerPhone: dto.sellerPhone,
        productType: 'virtual',
      });

      escrow.paymentProvider = PaymentProvider.ATARAPAY;
      escrow.providerProductId = productId;
      await escrow.save();

      return {
        escrowId: escrow.id,
        provider: PaymentProvider.ATARAPAY,
        amount: escrow.amount,
        currency: escrow.currency,
        ...checkout,
        note:
          'POST these fields to actionUrl (Authorization header included). Funds are held in AtaraPay escrow until release/refund.',
      };
    }

    if (dto.provider === PaymentProvider.PAYSTACK) {
      this.payments.paystack.assertConfigured();
      const reference = `hs_escrow_${escrow.id}_${Date.now()}`;
      const init = await this.payments.paystack.initialize({
        email: buyer.email,
        amountNaira: escrow.amount,
        reference,
        callbackUrl:
          dto.callbackUrl ||
          this.payments.paystackEscrowCallbackUrl(escrow.id),
        metadata: {
          type: 'escrow',
          escrowId: escrow.id,
          refNumber: escrow.refNumber,
        },
        currency: escrow.currency,
      });

      escrow.paymentProvider = PaymentProvider.PAYSTACK;
      escrow.providerReference = init.reference;
      await escrow.save();

      return {
        escrowId: escrow.id,
        provider: PaymentProvider.PAYSTACK,
        amount: escrow.amount,
        currency: escrow.currency,
        authorizationUrl: init.authorizationUrl,
        accessCode: init.accessCode,
        reference: init.reference,
        publicKey: this.payments.paystack.getPublicKey(),
        note:
          'Paystack collects into the merchant balance — it is not third-party escrow. Prefer AtaraPay for true escrow until a bank partner is live.',
      };
    }

    throw new BadRequestException(
      'provider must be atarapay or paystack (use POST /fund for manual)',
    );
  }

  async fund(
    id: string,
    userId: string,
    role: Role,
    dto: FundEscrowDto,
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    if (escrow.buyer.toString() !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('Only the buyer can mark escrow as funded');
    }

    return this.applyFunded(escrow, userId, {
      fundingReference: dto.fundingReference,
      paymentProvider: PaymentProvider.MANUAL,
      note: dto.note ?? 'Escrow funded (manual)',
    });
  }

  /** Idempotent funding from Paystack/AtaraPay webhooks or verify endpoints. */
  async markFundedByProvider(input: {
    escrowId?: string;
    refNumber?: string;
    providerProductId?: string;
    provider: PaymentProvider;
    providerReference: string;
    note?: string;
  }): Promise<EscrowDocument | null> {
    const escrow = await this.findEscrowForProvider(input);
    if (!escrow) return null;
    if (escrow.status === EscrowStatus.FUNDED) {
      return escrow;
    }
    if (escrow.status !== EscrowStatus.INITIATED) {
      throw new BadRequestException(
        `Cannot fund escrow in status ${escrow.status}`,
      );
    }

    return this.applyFunded(escrow, escrow.buyer.toString(), {
      fundingReference: input.providerReference,
      providerReference: input.providerReference,
      paymentProvider: input.provider,
      paidAt: new Date(),
      note: input.note ?? `Escrow funded via ${input.provider}`,
    });
  }

  async verifyPaystackPayment(reference: string): Promise<EscrowDocument> {
    const verified = await this.payments.paystack.verify(reference);
    if (verified.status !== 'success') {
      throw new BadRequestException(
        `Paystack payment not successful (${verified.status})`,
      );
    }
    const escrowId = String(verified.metadata?.escrowId ?? '');
    const funded = await this.markFundedByProvider({
      escrowId: escrowId || undefined,
      provider: PaymentProvider.PAYSTACK,
      providerReference: verified.reference,
      note: `Paystack: ${verified.gatewayResponse ?? 'success'}`,
    });
    if (!funded) {
      throw new NotFoundException('No escrow matched this Paystack payment');
    }
    return funded;
  }

  async handleAtaraPayCallback(query: Record<string, unknown>) {
    const orderId =
      query.order ||
      query.order_id ||
      query.orderId ||
      query.id ||
      (query.data as any)?.id;
    const productId =
      query.product_id ||
      query.productId ||
      query.order_product_id ||
      (query.data as any)?.product_id;

    if (!orderId && !productId) {
      throw new BadRequestException(
        'AtaraPay callback missing order / product id',
      );
    }

    let order;
    if (orderId) {
      order = await this.payments.atarapay.getOrder(String(orderId));
    }

    const escrow = await this.findEscrowForProvider({
      providerProductId: String(productId || order?.product_id || ''),
      providerReference: orderId ? String(orderId) : undefined,
    });
    if (!escrow) {
      throw new NotFoundException('Escrow not found for AtaraPay callback');
    }

    if (orderId) {
      escrow.providerReference = String(orderId);
      await escrow.save();
    }

    const paymentOk =
      order?.payment?.status === '1' ||
      String(order?.payment?.gateway_response ?? '')
        .toLowerCase()
        .includes('success') ||
      Boolean(order?.amount_payed);

    if (paymentOk && escrow.status === EscrowStatus.INITIATED) {
      await this.applyFunded(escrow, escrow.buyer.toString(), {
        fundingReference: String(
          order?.payment?.payment_ref || orderId || escrow.refNumber,
        ),
        providerReference: String(orderId || escrow.providerReference),
        paymentProvider: PaymentProvider.ATARAPAY,
        paidAt: new Date(),
        note: 'AtaraPay payment confirmed — funds in escrow',
      });
    }

    const fresh = await this.escrowModel.findById(escrow.id);
    return {
      ok: true,
      escrowId: escrow.id,
      status: fresh?.status,
      redirect: `${this.payments.frontendBaseUrl()}/escrow/${escrow.id}`,
    };
  }

  async handleAtaraPayNotification(body: {
    status?: string;
    message?: string;
    token?: string;
    data?: Record<string, any>;
  }) {
    const data = body.data ?? {};
    const orderId = data.id;
    const amountPayed = Number(data.amount_payed ?? data.payment?.amount ?? 0);
    const kobo = amountPayed > 0 ? Math.round(amountPayed) : 0;

    if (
      body.token &&
      orderId != null &&
      kobo > 0 &&
      !this.payments.atarapay.verifyNotificationToken(
        body.token,
        orderId,
        kobo,
      )
    ) {
      throw new ForbiddenException('Invalid AtaraPay notification token');
    }

    const escrow = await this.findEscrowForProvider({
      providerReference: orderId != null ? String(orderId) : undefined,
      providerProductId:
        data.product_id != null ? String(data.product_id) : undefined,
    });
    if (!escrow) {
      throw new NotFoundException('Escrow not found for AtaraPay notification');
    }

    const statusTitle = String(
      body.status || data.status?.title || '',
    ).toLowerCase();

    if (statusTitle.includes('accept')) {
      if (
        escrow.status === EscrowStatus.FUNDED ||
        escrow.status === EscrowStatus.INSPECTION ||
        escrow.status === EscrowStatus.DISPUTED
      ) {
        return this.release(escrow.id, escrow.buyer.toString(), Role.ADMIN, {
          note: body.message || 'Buyer accepted on AtaraPay — funds released',
        });
      }
    }

    if (statusTitle.includes('reject')) {
      if (
        escrow.status === EscrowStatus.FUNDED ||
        escrow.status === EscrowStatus.INSPECTION ||
        escrow.status === EscrowStatus.DISPUTED
      ) {
        return this.refund(escrow.id, escrow.seller.toString(), Role.ADMIN, {
          note: body.message || 'Buyer rejected on AtaraPay — refunded',
        });
      }
    }

    if (statusTitle.includes('deliver')) {
      if (escrow.status === EscrowStatus.FUNDED) {
        return this.startInspection(
          escrow.id,
          escrow.seller.toString(),
          Role.ADMIN,
          { note: body.message || 'Marked delivered on AtaraPay — inspection' },
        );
      }
    }

    if (
      statusTitle.includes('cancel') &&
      escrow.status === EscrowStatus.INITIATED
    ) {
      return this.cancel(escrow.id, escrow.buyer.toString(), Role.ADMIN, {
        note: body.message || 'Cancelled on AtaraPay',
      });
    }

    if (
      (statusTitle.includes('pending') || statusTitle.includes('paid')) &&
      escrow.status === EscrowStatus.INITIATED
    ) {
      return this.applyFunded(escrow, escrow.buyer.toString(), {
        fundingReference: String(
          data.payment?.payment_ref || orderId || escrow.refNumber,
        ),
        providerReference: String(orderId || escrow.providerReference),
        paymentProvider: PaymentProvider.ATARAPAY,
        paidAt: new Date(),
        note: body.message || 'AtaraPay escrow funded',
      });
    }

    return escrow;
  }

  async startInspection(
    id: string,
    userId: string,
    role: Role,
    dto: TransitionEscrowDto,
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    const updated = await this.transition(
      escrow,
      EscrowStatus.INSPECTION,
      userId,
      dto.note ?? 'Inspection period started',
    );

    if (
      escrow.paymentProvider === PaymentProvider.ATARAPAY &&
      escrow.providerReference &&
      this.payments.atarapay.isConfigured()
    ) {
      try {
        const buyer = await this.escrowModel
          .findById(id)
          .populate('buyer', 'email phone');
        const b = buyer?.buyer as any;
        await this.payments.atarapay.markDelivered({
          orderId: escrow.providerReference,
          buyerPhone: b?.phone || '',
          buyerEmail: b?.email,
        });
      } catch {
        // Local status still moves; AtaraPay sync can be retried from dashboard.
      }
    }

    return updated;
  }

  async release(
    id: string,
    userId: string,
    role: Role,
    dto: TransitionEscrowDto,
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    if (
      role !== Role.ADMIN &&
      escrow.buyer.toString() !== userId &&
      escrow.seller.toString() !== userId
    ) {
      throw new ForbiddenException('Not allowed to release this escrow');
    }

    const updated = await this.transition(
      escrow,
      EscrowStatus.RELEASED,
      userId,
      dto.note ?? 'Funds released',
    );

    await this.listingsService.setStatus(
      escrow.listing.toString(),
      ListingStatus.SOLD,
    );

    return updated;
  }

  async refund(
    id: string,
    userId: string,
    role: Role,
    dto: TransitionEscrowDto,
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    if (role !== Role.ADMIN && escrow.seller.toString() !== userId) {
      if (escrow.status !== EscrowStatus.DISPUTED) {
        throw new ForbiddenException(
          'Only seller/admin can refund outside dispute',
        );
      }
    }

    if (
      escrow.paymentProvider === PaymentProvider.ATARAPAY &&
      escrow.providerReference &&
      this.payments.atarapay.isConfigured()
    ) {
      try {
        await this.payments.atarapay.cancelOrder({
          orderId: escrow.providerReference,
          status: 'buyer_cancel',
          comment: dto.note || 'Refunded via HillSpace',
        });
      } catch {
        // Continue local refund; ops can settle on AtaraPay dashboard if needed.
      }
    }

    const updated = await this.transition(
      escrow,
      EscrowStatus.REFUNDED,
      userId,
      dto.note,
    );

    await this.listingsService.setStatus(
      escrow.listing.toString(),
      ListingStatus.ACTIVE,
    );

    return updated;
  }

  async dispute(
    id: string,
    userId: string,
    role: Role,
    dto: DisputeEscrowDto,
    files: Express.Multer.File[] = [],
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    const reasons = dto.reasons?.length
      ? dto.reasons
      : dto.reason
        ? [dto.reason]
        : [];
    if (!reasons.length) {
      throw new BadRequestException('Provide at least one dispute reason');
    }

    const evidence = files.length
      ? await Promise.all(
          files.map((file) =>
            this.cloudinaryService.uploadImage(file, 'escrow/disputes'),
          ),
        )
      : [];

    return this.transition(
      escrow,
      EscrowStatus.DISPUTED,
      userId,
      reasons.join('; '),
      {
        disputeReason: reasons.join('; '),
        disputeReasons: reasons,
        disputeDescription: dto.description,
        disputeEvidence: evidence.map((u) => ({
          url: u.secure_url,
          publicId: u.public_id,
        })),
        disputeCode: escrow.disputeCode ?? this.makeDisputeCode(),
      },
    );
  }

  async cancel(
    id: string,
    userId: string,
    role: Role,
    dto: TransitionEscrowDto,
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    const updated = await this.transition(
      escrow,
      EscrowStatus.CANCELLED,
      userId,
      dto.note,
    );

    await this.listingsService.setStatus(
      escrow.listing.toString(),
      ListingStatus.ACTIVE,
    );

    return updated;
  }

  async salesReport(agentId: string) {
    const listings = await this.listingsService.myListings(agentId);
    const listingIds = listings.map((l) => l._id);

    const released = await this.escrowModel.find({
      listing: { $in: listingIds },
      status: EscrowStatus.RELEASED,
    });

    const grossRevenue = released.reduce((sum, e) => sum + e.amount, 0);
    const activeProperties = listings.filter(
      (l) => l.status === ListingStatus.ACTIVE,
    ).length;

    const monthly = await this.escrowModel.aggregate([
      {
        $match: {
          listing: { $in: listingIds },
          status: EscrowStatus.RELEASED,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return {
      activeProperties,
      grossRevenue,
      dealsClosed: released.length,
      monthlyBuckets: monthly,
      recentActivity: [
        ...listings.slice(0, 5).map((l) => ({
          type: 'listing',
          message: `Property ${l.status}: ${l.title}`,
          at: (l as any).updatedAt,
        })),
        ...released.slice(0, 5).map((e) => ({
          type: 'sale',
          message: `Property sold / funds released (${e.currency} ${e.amount})`,
          at: (e as any).updatedAt,
        })),
      ].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    };
  }

  private async applyFunded(
    escrow: EscrowDocument,
    actorId: string,
    extra: {
      fundingReference: string;
      providerReference?: string;
      paymentProvider: PaymentProvider;
      paidAt?: Date;
      note: string;
    },
  ): Promise<EscrowDocument> {
    const reviewEndsAt = new Date(
      Date.now() + REVIEW_DAYS * 24 * 60 * 60 * 1000,
    );

    const updated = await this.transition(
      escrow,
      EscrowStatus.FUNDED,
      actorId,
      extra.note,
      {
        fundingReference: extra.fundingReference,
        providerReference: extra.providerReference ?? escrow.providerReference,
        paymentProvider: extra.paymentProvider,
        paidAt: extra.paidAt ?? new Date(),
        reviewEndsAt,
      },
    );

    if (this.notificationsService) {
      await this.notificationsService.create({
        userId: escrow.seller.toString(),
        title: 'Escrow funded',
        body: 'Buyer payment is securely protected in escrow.',
        type: 'escrow_funded',
        data: { escrowId: escrow.id },
      });
    }

    return updated;
  }

  private async findEscrowForProvider(input: {
    escrowId?: string;
    refNumber?: string;
    providerProductId?: string;
    providerReference?: string;
  }): Promise<EscrowDocument | null> {
    if (input.escrowId && Types.ObjectId.isValid(input.escrowId)) {
      const byId = await this.escrowModel.findById(input.escrowId);
      if (byId) return byId;
    }
    const or: Record<string, unknown>[] = [];
    if (input.refNumber) or.push({ refNumber: input.refNumber });
    if (input.providerProductId) {
      or.push({ providerProductId: input.providerProductId });
      or.push({ refNumber: input.providerProductId });
    }
    if (input.providerReference) {
      or.push({ providerReference: input.providerReference });
    }
    if (!or.length) return null;
    return this.escrowModel.findOne({ $or: or });
  }

  private async getParticipantEscrow(
    id: string,
    userId: string,
    role: Role,
  ): Promise<EscrowDocument> {
    const escrow = await this.escrowModel.findById(id);
    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    const isParty =
      escrow.buyer.toString() === userId || escrow.seller.toString() === userId;
    if (role !== Role.ADMIN && !isParty) {
      throw new ForbiddenException('Not a party to this escrow');
    }

    return escrow;
  }

  private async transition(
    escrow: EscrowDocument,
    next: EscrowStatus,
    userId: string,
    note?: string,
    extra: Partial<Escrow> = {},
  ): Promise<EscrowDocument> {
    const allowed = TRANSITIONS[escrow.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Cannot move escrow from ${escrow.status} to ${next}`,
      );
    }

    escrow.status = next;
    Object.assign(escrow, extra);
    escrow.timeline.push({
      status: next,
      note,
      by: new Types.ObjectId(userId),
      at: new Date(),
    });

    return escrow.save();
  }
}
