import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { WeekDay } from '../user.schema';

class AvailabilitySlotDto {
  @ApiProperty({ enum: WeekDay, example: WeekDay.MON })
  @IsEnum(WeekDay)
  day: WeekDay;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  from: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  to: string;
}

export class SetAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];

  @ApiPropertyOptional({
    description: 'If true, apply the first slot times to all weekdays',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  repeatAllDays?: boolean;
}
