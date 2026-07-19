import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { EscrowStatus } from '../common/enums/escrow-status.enum';

export type EscrowDocument = HydratedDocument<Escrow>;

@Schema({ _id: false })
export class EscrowEvent {
  @Prop({ type: String, enum: EscrowStatus, required: true })
  status: EscrowStatus;

  @Prop()
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  by?: Types.ObjectId;

  @Prop({ default: () => new Date() })
  at: Date;
}

@Schema({ _id: false })
export class DisputeEvidence {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;
}

@Schema({ timestamps: true })
export class Escrow {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Listing', required: true, index: true })
  listing: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  buyer: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  seller: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({ min: 0, default: 0 })
  adminFee: number;

  @Prop({
    type: String,
    enum: EscrowStatus,
    default: EscrowStatus.INITIATED,
    index: true,
  })
  status: EscrowStatus;

  @Prop({ unique: true, sparse: true })
  refNumber?: string;

  @Prop()
  fundingReference?: string;

  /** Review / inspection window end (set on fund). */
  @Prop()
  reviewEndsAt?: Date;

  @Prop()
  disputeReason?: string;

  @Prop({ type: [String], default: [] })
  disputeReasons: string[];

  @Prop()
  disputeDescription?: string;

  @Prop({ type: [DisputeEvidence], default: [] })
  disputeEvidence: DisputeEvidence[];

  @Prop({ unique: true, sparse: true })
  disputeCode?: string;

  @Prop({ type: [EscrowEvent], default: [] })
  timeline: EscrowEvent[];
}

export const EscrowSchema = SchemaFactory.createForClass(Escrow);
