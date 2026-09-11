import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class CheckoutEscrowDto {
  @ApiProperty({
    enum: ['atarapay', 'paystack'],
    example: 'atarapay',
    description:
      'atarapay = true escrow hold. paystack = collect payment into merchant balance (not third-party escrow).',
  })
  @IsIn(['atarapay', 'paystack'])
  provider: 'atarapay' | 'paystack';

  @ApiPropertyOptional({
    description: 'Override success redirect URL after payment',
    example: 'https://hillspace.com.ng/escrow/success',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;

  @ApiPropertyOptional({
    description:
      'AtaraPay marketplace mode: seller phone registered on AtaraPay (required when ATARAPAY_IS_MARKETPLACE=true)',
  })
  @IsOptional()
  @IsString()
  sellerPhone?: string;
}
