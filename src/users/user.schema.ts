import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { VerificationStatus } from '../common/enums/verification-status.enum';

export type UserDocument = HydratedDocument<User>;

export enum WeekDay {
  MON = 'Mon',
  TUE = 'Tue',
  WED = 'Wed',
  THU = 'Thu',
  FRI = 'Fri',
  SAT = 'Sat',
  SUN = 'Sun',
}

@Schema({ _id: false })
export class AvailabilitySlot {
  @Prop({ type: String, enum: WeekDay, required: true })
  day: WeekDay;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;
}

@Schema({ _id: false })
export class UserSettings {
  @Prop({ default: true })
  notificationsEnabled: boolean;

  @Prop({ default: 'system' })
  theme: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  username?: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  phone: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  avatarPublicId?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ type: [AvailabilitySlot], default: [] })
  availability: AvailabilitySlot[];

  @Prop({ type: UserSettings, default: () => ({}) })
  settings: UserSettings;

  @Prop({ type: String, enum: Role, default: Role.BUYER })
  role: Role;

  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  kycStatus: VerificationStatus;

  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  agentStatus: VerificationStatus;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ select: false })
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop({ select: false })
  passwordResetToken?: string;

  @Prop({ select: false })
  resetUrlToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({ select: false })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
