import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ description: 'Other participant user id' })
  @IsMongoId()
  participantId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  listingId?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Is the price negotiable?' })
  @IsString()
  @MinLength(1)
  body: string;
}
