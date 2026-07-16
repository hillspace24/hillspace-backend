import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { VerificationStatus } from '../../common/enums/verification-status.enum';

export class ReviewVerificationDto {
  @ApiProperty({
    enum: [VerificationStatus.APPROVED, VerificationStatus.REJECTED],
    example: VerificationStatus.APPROVED,
  })
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status: VerificationStatus.APPROVED | VerificationStatus.REJECTED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
