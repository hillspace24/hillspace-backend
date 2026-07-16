import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { InspectionType } from '../booking.schema';

export class CreateBookingDto {
  @ApiProperty()
  @IsMongoId()
  listingId: string;

  @ApiProperty({ example: '2026-08-09' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '12:00' })
  @IsString()
  time: string;

  @ApiProperty({ enum: InspectionType })
  @IsEnum(InspectionType)
  inspectionType: InspectionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fee?: number;
}
