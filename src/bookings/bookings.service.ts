import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { PaymentProvider } from '../integrations/payments/payment-provider.enum';
import { PaymentsService } from '../integrations/payments/payments.service';
import { ListingsService } from '../listings/listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  Booking,
  BookingDocument,
  BookingPaymentStatus,
  BookingStatus,
} from './booking.schema';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    private readonly listingsService: ListingsService,
    private readonly payments: PaymentsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async create(buyerId: string, dto: CreateBookingDto): Promise<BookingDocument> {
    const listing = await this.listingsService.findById(dto.listingId);
    const ownerId = this.refId(listing.owner);
    if (ownerId === buyerId) {
      throw new BadRequestException('Cannot book inspection on your own listing');
    }

    const agentId = this.refId(listing.agent ?? listing.owner);
    const fee = dto.fee ?? listing.inspectionFee ?? 0;
    const booking = await this.bookingModel.create({
      listing: listing._id,
      buyer: new Types.ObjectId(buyerId),
      agent: new Types.ObjectId(agentId),
      date: new Date(dto.date),
      time: dto.time,
      inspectionType: dto.inspectionType,
      note: dto.note,
      fee,
      status: BookingStatus.PENDING,
      paymentStatus: BookingPaymentStatus.UNPAID,
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.create({
          userId: agentId,
          title: 'New inspection booking',
          body: `Someone booked an inspection for ${listing.title}`,
          type: 'booking_created',
          data: { bookingId: booking.id, listingId: listing.id },
        });
      } catch {
        // ignore notification failures
      }
    }

    return booking;
  }

  async myBookings(userId: string) {
    const user = new Types.ObjectId(userId);
    return this.bookingModel
      .find({
        $or: [{ buyer: user }, { agent: user }],
      })
      .sort({ date: -1 })
      .populate('listing', 'title price location images currency')
      .populate('buyer', 'firstName lastName email phone avatarUrl')
      .populate('agent', 'firstName lastName email phone avatarUrl');
  }

  async findById(id: string, userId: string, role: Role): Promise<BookingDocument> {
    const booking = await this.bookingModel
      .findById(id)
      .populate('listing', 'title price location images')
      .populate('buyer', 'firstName lastName email phone')
      .populate('agent', 'firstName lastName email phone');
    if (!booking) throw new NotFoundException('Booking not found');

    const isParty =
      booking.buyer.toString() === userId ||
      booking.agent?.toString() === userId ||
      (booking.listing as any)?.owner?.toString?.() === userId;
    if (role !== Role.ADMIN && !isParty) {
      const raw = await this.bookingModel.findById(id);
      if (
        !raw ||
        (raw.buyer.toString() !== userId && raw.agent?.toString() !== userId)
      ) {
        throw new ForbiddenException('Not a party to this booking');
      }
    }
    return booking;
  }

  async payInspectionFee(
    id: string,
    userId: string,
    role: Role,
    callbackUrl?: string,
  ) {
    const booking = await this.getOwnedBooking(id, userId, role, 'buyer');
    if (booking.fee <= 0) {
      throw new BadRequestException('This booking has no inspection fee');
    }
    if (
      booking.paymentStatus === BookingPaymentStatus.PAID ||
      booking.paymentStatus === BookingPaymentStatus.MARKED_PAID
    ) {
      throw new BadRequestException('Booking is already paid');
    }

    this.payments.paystack.assertConfigured();
    const populated = await this.bookingModel
      .findById(id)
      .populate('buyer', 'email firstName lastName');
    const buyer = populated?.buyer as unknown as User;
    if (!buyer?.email) {
      throw new BadRequestException('Buyer email is required to pay');
    }

    const reference = `hs_booking_${booking.id}_${Date.now()}`;
    const init = await this.payments.paystack.initialize({
      email: buyer.email,
      amountNaira: booking.fee,
      reference,
      callbackUrl:
        callbackUrl || this.payments.paystackBookingCallbackUrl(booking.id),
      metadata: {
        type: 'booking',
        bookingId: booking.id,
      },
    });

    booking.paymentProvider = PaymentProvider.PAYSTACK;
    booking.paymentReference = init.reference;
    booking.paymentStatus = BookingPaymentStatus.PENDING;
    await booking.save();

    return {
      bookingId: booking.id,
      provider: PaymentProvider.PAYSTACK,
      amount: booking.fee,
      authorizationUrl: init.authorizationUrl,
      accessCode: init.accessCode,
      reference: init.reference,
      publicKey: this.payments.paystack.getPublicKey(),
    };
  }

  async markPaidByProvider(input: {
    bookingId: string;
    reference: string;
    provider: PaymentProvider;
  }): Promise<BookingDocument | null> {
    let booking: BookingDocument | null = null;
    if (input.bookingId && Types.ObjectId.isValid(input.bookingId)) {
      booking = await this.bookingModel.findById(input.bookingId);
    }
    if (!booking && input.reference) {
      booking = await this.bookingModel.findOne({
        paymentReference: input.reference,
      });
    }
    if (!booking) return null;

    if (
      booking.paymentStatus === BookingPaymentStatus.PAID ||
      booking.paymentStatus === BookingPaymentStatus.MARKED_PAID
    ) {
      return booking;
    }

    booking.paymentStatus = BookingPaymentStatus.PAID;
    booking.paymentProvider = input.provider;
    booking.paymentReference = input.reference;
    booking.paidAt = new Date();
    return booking.save();
  }

  async confirm(id: string, userId: string, role: Role) {
    const booking = await this.getOwnedBooking(id, userId, role, 'agent');
    booking.status = BookingStatus.CONFIRMED;
    if (booking.paymentStatus === BookingPaymentStatus.UNPAID) {
      booking.paymentStatus = BookingPaymentStatus.MARKED_PAID;
    }
    await booking.save();

    if (this.notificationsService) {
      await this.notificationsService.create({
        userId: this.refId(booking.buyer),
        title: 'Inspection confirmed',
        body: 'Your property inspection has been confirmed.',
        type: 'booking_confirmed',
        data: { bookingId: booking.id },
      });
    }
    return booking;
  }

  async cancel(id: string, userId: string, role: Role) {
    const booking = await this.getOwnedBooking(id, userId, role, 'any');
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel a ${booking.status} booking`);
    }
    booking.status = BookingStatus.CANCELLED;
    return booking.save();
  }

  private refId(
    ref: Types.ObjectId | { _id?: Types.ObjectId } | string | null | undefined,
  ): string {
    if (!ref) return '';
    if (typeof ref === 'string') return ref;
    if (typeof ref === 'object' && '_id' in ref && ref._id) {
      return ref._id.toString();
    }
    return ref.toString();
  }

  private async getOwnedBooking(
    id: string,
    userId: string,
    role: Role,
    who: 'agent' | 'buyer' | 'any',
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    if (role === Role.ADMIN) return booking;

    if (who === 'agent') {
      if (booking.agent?.toString() !== userId) {
        throw new ForbiddenException('Only the agent/owner can confirm');
      }
    } else if (who === 'buyer') {
      if (booking.buyer.toString() !== userId) {
        throw new ForbiddenException('Only the buyer can pay for this booking');
      }
    } else {
      const isParty =
        booking.buyer.toString() === userId ||
        booking.agent?.toString() === userId;
      if (!isParty) throw new ForbiddenException('Not a party to this booking');
    }
    return booking;
  }
}
