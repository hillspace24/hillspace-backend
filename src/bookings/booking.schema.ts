import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

export enum InspectionType {
  PHYSICAL = 'physical',
  ONLINE = 'online',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum BookingPaymentStatus {
  UNPAID = 'unpaid',
  MARKED_PAID = 'marked_paid',
}

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'Listing', required: true, index: true })
  listing: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  buyer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  agent?: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  time: string;

  @Prop({ type: String, enum: InspectionType, required: true })
  inspectionType: InspectionType;

  @Prop()
  note?: string;

  @Prop({ min: 0, default: 0 })
  fee: number;

  @Prop({
    type: String,
    enum: BookingStatus,
    default: BookingStatus.PENDING,
    index: true,
  })
  status: BookingStatus;

  @Prop({
    type: String,
    enum: BookingPaymentStatus,
    default: BookingPaymentStatus.UNPAID,
  })
  paymentStatus: BookingPaymentStatus;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
