import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WaitlistDocument = HydratedDocument<WaitlistEntry>;

export enum WaitlistPersona {
  RENTER = 'renter',
  BUYER = 'buyer',
  AGENT = 'agent',
  LANDLORD = 'landlord',
  DEVELOPER = 'developer',
  OTHER = 'other',
}

@Schema({ timestamps: true, collection: 'waitlist' })
export class WaitlistEntry {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, trim: true, index: true })
  city: string;

  @Prop({ type: String, enum: WaitlistPersona, required: true, index: true })
  persona: WaitlistPersona;
}

export const WaitlistSchema = SchemaFactory.createForClass(WaitlistEntry);

WaitlistSchema.index({
  fullName: 'text',
  email: 'text',
  city: 'text',
});
