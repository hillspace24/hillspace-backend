import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { WaitlistPersona } from '../waitlist.schema';

export class QueryWaitlistDto {
  @ApiPropertyOptional({ description: 'Search name, email, or city' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: WaitlistPersona })
  @IsOptional()
  @IsEnum(WaitlistPersona)
  persona?: WaitlistPersona;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
