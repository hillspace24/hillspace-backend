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
import { ListingsService } from '../listings/listings.service';
import { NotificationsService } from '../notifications/notifications.service';
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
      .populate('listing', 'title price status images location')
      .populate('buyer', 'firstName lastName email')
      .populate('seller', 'firstName lastName email');

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
    const filter: Record<string, unknown> = {
      $or: [{ buyer: userId }, { seller: userId }],
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
    return {
      refNumber: escrow.refNumber,
      paymentTime: (escrow as any).updatedAt ?? (escrow as any).createdAt,
      paymentMethod: escrow.fundingReference ? 'Bank Transfer' : 'Manual',
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

    const reviewEndsAt = new Date(
      Date.now() + REVIEW_DAYS * 24 * 60 * 60 * 1000,
    );

    const updated = await this.transition(
      escrow,
      EscrowStatus.FUNDED,
      userId,
      dto.note ?? 'Escrow funded',
      {
        fundingReference: dto.fundingReference,
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

  async startInspection(
    id: string,
    userId: string,
    role: Role,
    dto: TransitionEscrowDto,
  ): Promise<EscrowDocument> {
    const escrow = await this.getParticipantEscrow(id, userId, role);
    return this.transition(
      escrow,
      EscrowStatus.INSPECTION,
      userId,
      dto.note ?? 'Inspection period started',
    );
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

  /** Agent sales aggregates from released escrows + active listings. */
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
