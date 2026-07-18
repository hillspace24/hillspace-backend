import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RateListingDto {
  @ApiProperty({
    example: 4,
    minimum: 1,
    maximum: 5,
    description: 'Star rating from 1 to 5 (inclusive). Listing cards show ratingAvg rounded to one decimal (e.g. 4.5).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional({
    example: 'Great location and solid build quality',
    description: 'Optional short review text',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
