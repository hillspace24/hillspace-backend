import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyResetOtpDto {
  @ApiProperty({ example: 'ada@hillspace.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '5484', description: '4-digit OTP from email' })
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'OTP must be a 4-digit code' })
  otp: string;
}
