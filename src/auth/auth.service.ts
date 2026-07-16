import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Role } from '../common/enums/role.enum';
import { fourDigitOtp } from '../common/utils/otp.util';
import { EmailService } from '../integrations/email/email.service';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestVerificationCodeDto } from './dto/request-verification-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/** Optional request metadata for login notification emails. */
export type LoginClientMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private async sendSignupVerificationMailBestEffort(
    email: string,
    name: string,
    otp: string,
    logContext: string,
    userId?: string,
  ): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail(
        email,
        name,
        otp,
        'signup',
        userId,
      );
    } catch (err) {
      this.logger.error(
        `[email] ${logContext} failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    const otp = fourDigitOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersService.setEmailVerificationToken(user.id, otp, expiresAt);

    if (this.emailService.isConfigured()) {
      await this.sendSignupVerificationMailBestEffort(
        user.email,
        this.usersService.displayName(user),
        otp,
        'signup_verification',
        user.id,
      );
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto, clientMeta?: LoginClientMeta) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified && user.role !== Role.ADMIN) {
      throw new UnauthorizedException(
        'Please verify your email with the OTP sent to your inbox.',
      );
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    if (this.emailService.isConfigured()) {
      const loggedInAtIso = new Date().toISOString();
      void this.emailService
        .sendLoginNotificationEmail(
          user.email,
          this.usersService.displayName(user),
          {
            loggedInAtIso,
            ip: clientMeta?.ip,
            userAgent: clientMeta?.userAgent,
          },
        )
        .catch((err) => {
          this.logger.error(
            `[email] login_notification failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        });
    }

    return tokens;
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('app.jwt.refreshSecret'),
      });
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }

    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (!user.refreshTokenHash) {
      throw new ForbiddenException('Access denied');
    }

    const valid = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!valid) {
      throw new ForbiddenException('Access denied');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(userId: string) {
    await this.usersService.setRefreshToken(userId, null);
    return { message: 'Logged out' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; emailWarning?: string }> {
    const message =
      'If the email exists, a 4-digit verification code has been sent.';
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { message };
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn('[email] forgotPassword: email service is not configured');
      return {
        message,
        emailWarning: 'Email service is not configured on this server.',
      };
    }
    const otp = fourDigitOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersService.setPasswordResetToken(user.id, otp, expiresAt);
    try {
      await this.emailService.sendPasswordResetOtpEmail(
        user.email,
        this.usersService.displayName(user),
        otp,
      );
    } catch (err) {
      this.logger.error(
        `[email] Password reset OTP failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return {
        message,
        emailWarning:
          'Reset code saved but the email could not be delivered. Please try again later.',
      };
    }
    return { message };
  }

  async verifyResetOtp(
    dto: VerifyResetOtpDto,
  ): Promise<{ message: string; verified: boolean }> {
    const user = await this.usersService.findByEmailAndResetOtp(
      dto.email,
      dto.otp,
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    return { message: 'Code verified. You may set a new password.', verified: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const email = dto.email?.trim().toLowerCase();
    const otp = dto.otp?.trim();
    const legacy = dto.token?.trim();
    const uid = dto.uid?.trim();
    const reset = dto.reset?.trim();
    const hasOtpFlow = !!(email && otp);
    const hasPair = !!(uid && reset);
    const hasLegacy = !!legacy;

    const modes = [hasOtpFlow, hasLegacy, hasPair].filter(Boolean).length;
    if (modes === 0) {
      throw new BadRequestException(
        'Provide email+otp, or token, or uid+reset from the reset flow.',
      );
    }
    if (modes > 1) {
      throw new BadRequestException(
        'Provide only one reset method: email+otp, token, or uid+reset.',
      );
    }

    let user = hasOtpFlow
      ? await this.usersService.findByEmailAndResetOtp(email!, otp!)
      : hasLegacy
        ? await this.usersService.findByResetToken(legacy!)
        : await this.usersService.findByResetUrlParams(uid!, reset!);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.usersService.resetPassword(user.id, dto.newPassword);
    if (this.emailService.isConfigured()) {
      try {
        await this.emailService.sendPasswordChangedEmail(
          user.email,
          this.usersService.displayName(user),
        );
      } catch (err) {
        this.logger.error(
          `[email] password_changed_notify failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
    return { message: 'Password has been reset successfully' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmailAndVerificationOtp(
      dto.email,
      dto.otp,
    );
    await this.usersService.markEmailVerified(user.id);
    return { message: 'Email verified successfully' };
  }

  async requestVerificationCode(
    dto: RequestVerificationCodeDto,
  ): Promise<{ message: string; emailWarning?: string }> {
    const message =
      'If the email exists, a verification code has been sent.';
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { message };
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        '[email] requestVerificationCode: email service is not configured',
      );
      return {
        message,
        emailWarning: 'Email service is not configured on this server.',
      };
    }
    const otp = fourDigitOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersService.setEmailVerificationToken(user.id, otp, expiresAt);
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        this.usersService.displayName(user),
        otp,
        'repeat',
      );
    } catch (err) {
      this.logger.error(
        `[email] Verification code email failed for ${dto.email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return {
        message,
        emailWarning:
          'Verification code saved but the email could not be delivered. Please try again later.',
      };
    }
    return { message };
  }

  async cancelSignup(uid: string, token: string): Promise<{ message: string }> {
    await this.usersService.deleteUnverifiedUser(uid, token);
    return { message: 'Account has been deleted successfully.' };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessExpiresIn = this.configService.getOrThrow<string>(
      'app.jwt.accessExpiresIn',
    );
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'app.jwt.refreshExpiresIn',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('app.jwt.accessSecret'),
        expiresIn: accessExpiresIn as `${number}m` | `${number}d`,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('app.jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as `${number}m` | `${number}d`,
      }),
    ]);

    await this.usersService.setRefreshToken(userId, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role },
    };
  }
}
