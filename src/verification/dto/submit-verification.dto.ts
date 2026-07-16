import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  FacialStatus,
  IdType,
  KycCategory,
  VerificationType,
} from '../verification.schema';

export class SubmitVerificationDto {
  @ApiProperty({ enum: VerificationType, example: VerificationType.KYC })
  @IsEnum(VerificationType)
  type: VerificationType;

  @ApiPropertyOptional({
    description: 'Required when type is listing',
    example: '665f1a2b3c4d5e6f7a8b9c0d',
  })
  @IsOptional()
  @IsMongoId()
  listingId?: string;

  @ApiPropertyOptional({ enum: KycCategory })
  @IsOptional()
  @IsEnum(KycCategory)
  category?: KycCategory;

  @ApiPropertyOptional({ enum: IdType })
  @IsOptional()
  @IsEnum(IdType)
  idType?: IdType;

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsOptional()
  @IsString()
  idCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officeAddress?: string;

  @ApiPropertyOptional({ enum: FacialStatus })
  @IsOptional()
  @IsEnum(FacialStatus)
  facialStatus?: FacialStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
