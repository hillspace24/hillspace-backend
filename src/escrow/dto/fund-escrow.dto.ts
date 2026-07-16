import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FundEscrowDto {
  @ApiProperty({
    example: 'TRF-20260711-001',
    description: 'Bank transfer / future payment gateway reference',
  })
  @IsString()
  fundingReference: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
