import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  /** Figma flow: email + 4-digit OTP + new password. */
  @ApiPropertyOptional({ example: 'ada@hillspace.test' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '5484' })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  otp?: string;

  /** Legacy: `?token=` from older emails. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  token?: string;

  /** User id — use with `reset` (link flow). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string;

  /** Opaque reset segment — use with `uid`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reset?: string;

  @ApiProperty({ example: 'newPassword123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
