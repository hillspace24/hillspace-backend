import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ListingCategory,
  ListingPurpose,
  ListingStatus,
  PaymentFrequency,
  PropertyType,
  SpaceKind,
} from '../../common/enums/listing-status.enum';

/** Parse JSON strings / single values from multipart form-data. */
function parseJsonField({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseStringArray({ value }: { value: unknown }) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return value.includes(',')
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [value];
}

class LocationDto {
  @ApiProperty({ example: '12 Admiralty Way' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  state: string;

  @ApiPropertyOptional({ example: 'Eti-Osa' })
  @IsOptional()
  @IsString()
  lga?: string;

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 6.431 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 3.421 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class CreateListingDto {
  @ApiProperty({ example: '4-bed duplex in Lekki' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Spacious duplex with BQ and parking' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: SpaceKind, example: SpaceKind.SINGLE_UNIT })
  @IsOptional()
  @IsEnum(SpaceKind)
  spaceKind?: SpaceKind;

  @ApiProperty({ enum: PropertyType, example: PropertyType.DUPLEX })
  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @ApiProperty({ enum: ListingPurpose, example: ListingPurpose.SALE })
  @IsEnum(ListingPurpose)
  purpose: ListingPurpose;

  @ApiPropertyOptional({ enum: ListingCategory })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @ApiProperty({ example: 85000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: PaymentFrequency })
  @IsOptional()
  @IsEnum(PaymentFrequency)
  paymentFrequency?: PaymentFrequency;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  inspectionFee?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 320 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqm?: number;

  @ApiPropertyOptional({ example: 1800 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqft?: number;

  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearBuilt?: number;

  @ApiPropertyOptional({ example: '1 Indoor' })
  @IsOptional()
  @IsString()
  parking?: string;

  @ApiProperty({
    type: LocationDto,
    description:
      'For multipart/form-data, send as a JSON string, e.g. {"address":"...","city":"...","state":"..."}',
  })
  @Transform(parseJsonField)
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiPropertyOptional({ type: [String], example: ['parking', 'security'] })
  @IsOptional()
  @Transform(parseStringArray)
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Security', 'Water Supply', 'Parking', 'Electricity'],
  })
  @IsOptional()
  @Transform(parseStringArray)
  @IsArray()
  @IsString({ each: true })
  utilities?: string[];

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
