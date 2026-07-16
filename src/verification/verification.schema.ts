import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VerificationStatus } from '../common/enums/verification-status.enum';

export type VerificationRequestDocument = HydratedDocument<VerificationRequest>;

export enum VerificationType {
  KYC = 'kyc',
  AGENT = 'agent',
  LISTING = 'listing',
}

export enum KycCategory {
  INDIVIDUAL = 'individual',
  AGENCY = 'agency',
}

export enum IdType {
  NATIONAL_ID = 'national_id',
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
}

export enum FacialStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  SKIPPED = 'skipped',
}

@Schema({ _id: false })
export class VerificationDocumentFile {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;

  @Prop({ required: true })
  label: string;
}

@Schema({ timestamps: true })
export class VerificationRequest {
  @Prop({ type: String, enum: VerificationType, required: true, index: true })
  type: VerificationType;

  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
    index: true,
  })
  status: VerificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  requester: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  listing?: Types.ObjectId;

  @Prop({ type: String, enum: KycCategory })
  category?: KycCategory;

  @Prop({ type: String, enum: IdType })
  idType?: IdType;

  @Prop({ default: 'Nigeria' })
  idCountry?: string;

  @Prop()
  fullName?: string;

  @Prop()
  phone?: string;

  @Prop()
  residentialAddress?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop()
  businessName?: string;

  @Prop()
  registrationNumber?: string;

  @Prop()
  officeAddress?: string;

  @Prop()
  selfieUrl?: string;

  @Prop()
  selfiePublicId?: string;

  @Prop({ type: String, enum: FacialStatus, default: FacialStatus.PENDING })
  facialStatus: FacialStatus;

  @Prop({ type: [VerificationDocumentFile], default: [] })
  documents: VerificationDocumentFile[];

  @Prop()
  notes?: string;

  @Prop()
  reviewNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;
}

export const VerificationRequestSchema =
  SchemaFactory.createForClass(VerificationRequest);
