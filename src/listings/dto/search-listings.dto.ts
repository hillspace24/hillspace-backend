import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  ListingCategory,
  ListingPurpose,
  ListingSortBy,
  ListingStatus,
  PaymentFrequency,
  PropertyType,
  SpaceKind,
} from '../../common/enums/listing-status.enum';
import { VerificationStatus } from '../../common/enums/verification-status.enum';

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

export class SearchListingsDto {
  @ApiPropertyOptional({
    description:
      'Full-text search (Explore search bar). Matches title, description, and location text.',
    example: 'GRA Port Harcourt',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: PropertyType,
    description: 'Filter modal — property type (apartment, house, land, duplex, etc.).',
  })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @ApiPropertyOptional({
    enum: ListingPurpose,
    description: [
      'Home chips Rent / Buy.',
      '**All** → omit this param entirely (no `all` value).',
      '**Rent** → `rent`.',
      '**Buy** → `sale` (not `buy`).',
    ].join(' '),
    example: ListingPurpose.SALE,
  })
  @IsOptional()
  @IsEnum(ListingPurpose)
  purpose?: ListingPurpose;

  @ApiPropertyOptional({
    enum: ListingCategory,
    description: [
      'Explore category chips.',
      '`2_bedroom` | `3_bedroom` | `land` | `self_con` (plus `other`).',
      'Prefer this over `bedrooms` for chip filters.',
    ].join(' '),
    example: ListingCategory.TWO_BEDROOM,
  })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @ApiPropertyOptional({
    enum: SpaceKind,
    description: 'Filter modal — single unit vs estate.',
  })
  @IsOptional()
  @IsEnum(SpaceKind)
  spaceKind?: SpaceKind;

  @ApiPropertyOptional({
    enum: PaymentFrequency,
    description: 'Filter modal — rent/sale payment cadence (monthly, yearly, etc.).',
  })
  @IsOptional()
  @IsEnum(PaymentFrequency)
  paymentFrequency?: PaymentFrequency;

  @ApiPropertyOptional({
    example: 'Port Harcourt',
    description: 'Location filter (case-insensitive). Often paired with Explore header location.',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: 'Rivers',
    description: 'Location filter (case-insensitive).',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    example: 'Obio-Akpor',
    description: 'Location filter — LGA (case-insensitive).',
  })
  @IsOptional()
  @IsString()
  lga?: string;

  @ApiPropertyOptional({
    example: 1000000,
    description: 'Filter modal — minimum price (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 100000000,
    description: 'Filter modal — maximum price (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Minimum bedrooms (`>=`). For exact Explore chips prefer `category=2_bedroom` / `3_bedroom`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Minimum bathrooms (`>=`).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Filter modal — minimum area in sqm (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAreaSqm?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Filter modal — maximum area in sqm (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAreaSqm?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Filter modal — minimum area in sqft (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAreaSqft?: number;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Filter modal — maximum area in sqft (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAreaSqft?: number;

  @ApiPropertyOptional({
    example: 2000,
    description: 'Filter modal — minimum year built (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1800)
  minYearBuilt?: number;

  @ApiPropertyOptional({
    example: 2024,
    description: 'Filter modal — maximum year built (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1800)
  maxYearBuilt?: number;

  @ApiPropertyOptional({
    example: 'covered',
    description: 'Filter modal — case-insensitive substring match on parking.',
  })
  @IsOptional()
  @IsString()
  parking?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['parking', 'security'],
    description:
      'Filter modal — listing must include **all** listed amenities. Pass as repeated query keys or comma-separated.',
  })
  @IsOptional()
  @Transform(parseStringArray)
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['water', 'electricity'],
    description:
      'Filter modal — listing must include **all** listed utilities. Pass as repeated query keys or comma-separated.',
  })
  @IsOptional()
  @Transform(parseStringArray)
  @IsArray()
  @IsString({ each: true })
  utilities?: string[];

  @ApiPropertyOptional({
    example: 4.8156,
    description:
      'Nearby / geo filter — center latitude. Must be sent together with `lng` and `radiusKm`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({
    example: 7.0498,
    description:
      'Nearby / geo filter — center longitude. Must be sent together with `lat` and `radiusKm`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Nearby / geo filter — radius in km around lat/lng. Incomplete triples (missing lat, lng, or radiusKm) are ignored.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radiusKm?: number;

  @ApiPropertyOptional({
    enum: ListingStatus,
    description:
      'Listing lifecycle status. **Defaults to `active`** when omitted (Explore/Home only show live listings).',
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiPropertyOptional({
    enum: VerificationStatus,
    description: 'Optional verification filter (e.g. show only approved listings).',
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional({
    enum: ListingSortBy,
    default: ListingSortBy.NEWEST,
    description:
      'Sort order. When `q` is set, results are ranked by text score instead. Values: `newest`, `price_asc`, `price_desc`, `rating`.',
  })
  @IsOptional()
  @IsEnum(ListingSortBy)
  sortBy?: ListingSortBy;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number (1-based).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Page size.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
