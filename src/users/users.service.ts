import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  displayName(user: Pick<User, 'firstName' | 'lastName'>): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({ $or: [{ email: dto.email }, { phone: dto.phone }] })
      .lean();

    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }

    const role = dto.role === Role.ADMIN ? Role.BUYER : (dto.role ?? Role.BUYER);
    const password = await argon2.hash(dto.password);

    return this.userModel.create({
      ...dto,
      role,
      password,
      isEmailVerified: false,
    });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email })
      .select('+password +refreshTokenHash +emailVerificationToken +passwordResetToken +resetUrlToken');
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByIdWithSecrets(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .select(
        '+password +refreshTokenHash +emailVerificationToken +passwordResetToken +resetUrlToken',
      );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    if (dto.username) {
      const taken = await this.userModel
        .findOne({ username: dto.username.toLowerCase(), _id: { $ne: id } })
        .lean();
      if (taken) {
        throw new ConflictException('Username already taken');
      }
    }

    const update: Record<string, unknown> = { ...dto };
    if (dto.username) {
      update.username = dto.username.toLowerCase();
    }
    if (dto.dateOfBirth) {
      update.dateOfBirth = new Date(dto.dateOfBirth);
    }

    const user = await this.userModel.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setAvatar(
    id: string,
    avatarUrl: string,
    avatarPublicId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { avatarUrl, avatarPublicId },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setAvailability(
    id: string,
    availability: User['availability'],
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { availability },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateSettings(
    id: string,
    settings: Partial<User['settings']>,
  ): Promise<UserDocument> {
    const user = await this.findById(id);
    user.settings = {
      notificationsEnabled:
        settings.notificationsEnabled ??
        user.settings?.notificationsEnabled ??
        true,
      theme: settings.theme ?? user.settings?.theme ?? 'system',
    };
    return user.save();
  }

  async setRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    const refreshTokenHash = refreshToken
      ? await argon2.hash(refreshToken)
      : null;
    await this.userModel.findByIdAndUpdate(id, { refreshTokenHash });
  }

  async setKycStatus(
    id: string,
    status: VerificationStatus,
  ): Promise<UserDocument> {
    return this.updateStatusField(id, { kycStatus: status });
  }

  async setAgentStatus(
    id: string,
    status: VerificationStatus,
  ): Promise<UserDocument> {
    return this.updateStatusField(id, { agentStatus: status });
  }

  async findByEmailAndVerificationOtp(
    email: string,
    otp: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({
        email: email.toLowerCase(),
        emailVerificationToken: otp,
        emailVerificationExpires: { $gt: new Date() },
      })
      .select('+emailVerificationToken');
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    return user;
  }

  async setEmailVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt,
    });
  }

  async setPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      passwordResetToken: token,
      resetUrlToken: token,
      passwordResetExpires: expiresAt,
    });
  }

  async findByResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordResetToken +resetUrlToken');
  }

  async findByEmailAndResetOtp(
    email: string,
    otp: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        email: email.toLowerCase(),
        passwordResetToken: otp,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordResetToken +resetUrlToken');
  }

  async findByResetUrlParams(
    userId: string,
    resetUrlToken: string,
  ): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return this.userModel
      .findOne({
        _id: userId,
        resetUrlToken,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordResetToken +resetUrlToken');
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const password = await argon2.hash(newPassword);
    await this.userModel.findByIdAndUpdate(userId, {
      password,
      refreshTokenHash: null,
      $unset: {
        passwordResetToken: '',
        passwordResetExpires: '',
        resetUrlToken: '',
      },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { isEmailVerified: true },
      $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
    });
  }

  async deleteUnverifiedUser(userId: string, token: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+emailVerificationToken');
    if (!user) throw new NotFoundException('Account not found');
    if (user.isEmailVerified) {
      throw new BadRequestException('This account is already verified');
    }
    if (user.emailVerificationToken !== token) {
      throw new BadRequestException('Invalid or expired cancellation token');
    }
    await this.userModel.findByIdAndDelete(userId);
  }

  private async updateStatusField(
    id: string,
    update: Partial<User>,
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
