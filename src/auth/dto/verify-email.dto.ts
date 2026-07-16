import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'ada@hillspace.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '5484' })
  @IsString()
  otp: string;
}
