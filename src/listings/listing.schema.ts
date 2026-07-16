import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  ListingCategory,
  ListingPurpose,
  ListingStatus,
  PaymentFrequency,
  PropertyType,
  SpaceKind,
} from '../common/enums/listing-status.enum';
import { VerificationStatus } from '../common/enums/verification-status.enum';

export type ListingDocument = HydratedDocument<Listing>;

@Schema({ _id: false })
export class ListingImage {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;
}

@Schema({ _id: false })
export class ListingLocation {
  @Prop({ required: true })
  address: string;

  @Prop({ required: true, index: true })
  city: string;

  @Prop({ required: true, index: true })
  state: string;

  @Prop({ index: true })
  lga?: string;

  @Prop()
  country?: string;

  @Prop({ type: Number })
  lat?: number;

  @Prop({ type: Number })
  lng?: number;
}

@Schema({ _id: false })
export class OwnershipDoc {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;

  @Prop({ required: true })
  label: string;
}

@Schema({ timestamps: true })
export class Listing {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, enum: SpaceKind, default: SpaceKind.SINGLE_UNIT })
  spaceKind: SpaceKind;

  @Prop({ type: String, enum: PropertyType, required: true, index: true })
  propertyType: PropertyType;

  @Prop({ type: String, enum: ListingPurpose, required: true, index: true })
  purpose: ListingPurpose;

  @Prop({ type: String, enum: ListingCategory, index: true })
  category?: ListingCategory;

  @Prop({ required: true, min: 0, index: true })
  price: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({ type: String, enum: PaymentFrequency, default: PaymentFrequency.YEARLY })
  paymentFrequency: PaymentFrequency;

  @Prop({ min: 0, default: 0 })
  inspectionFee: number;

  @Prop({ min: 0, default: 0 })
  bedrooms: number;

  @Prop({ min: 0, default: 0 })
  bathrooms: number;

  @Prop({ min: 0 })
  areaSqm?: number;

  @Prop({ min: 0 })
  areaSqft?: number;

  @Prop()
  yearBuilt?: number;

  @Prop()
  parking?: string;

  @Prop({ type: ListingLocation, required: true })
  location: ListingLocation;

  @Prop({ type: [ListingImage], default: [] })
  images: ListingImage[];

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ type: [String], default: [] })
  utilities: string[];

  @Prop({ type: [OwnershipDoc], default: [] })
  ownershipDocs: OwnershipDoc[];

  @Prop({ default: 0 })
  ratingAvg: number;

  @Prop({ default: 0 })
  ratingCount: number;

  @Prop({
    type: String,
    enum: ListingStatus,
    default: ListingStatus.DRAFT,
    index: true,
  })
  status: ListingStatus;

  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
    index: true,
  })
  verificationStatus: VerificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agent?: Types.ObjectId;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

ListingSchema.index({
  title: 'text',
  description: 'text',
  'location.city': 'text',
  'location.state': 'text',
  'location.lga': 'text',
  'location.address': 'text',
});
