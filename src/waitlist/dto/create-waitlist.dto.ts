import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { WaitlistPersona } from '../waitlist.schema';

export class CreateWaitlistDto {
  @ApiProperty({ example: 'Emeka Okafor' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'emeka@email.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+234 800 000 0000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @MinLength(2)
  city: string;

  @ApiProperty({
    enum: WaitlistPersona,
    example: WaitlistPersona.RENTER,
    description: 'I am a…',
  })
  @IsEnum(WaitlistPersona)
  persona: WaitlistPersona;
}
