import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TransitionEscrowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
