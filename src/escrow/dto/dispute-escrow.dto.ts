import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class DisputeEscrowDto {
  @ApiPropertyOptional({
    example: 'Property condition does not match listing photos',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  reason?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Property differs from listing', 'Ownership discrepancy'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reasons?: string[];

  @ApiPropertyOptional({ example: 'Describe the issue...' })
  @IsOptional()
  @IsString()
  description?: string;
}
