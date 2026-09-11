import { Global, Module, forwardRef } from '@nestjs/common';
import { BookingsModule } from '../../bookings/bookings.module';
import { EscrowModule } from '../../escrow/escrow.module';
import { AtaraPayService } from './atarapay.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';

@Global()
@Module({
  imports: [
    forwardRef(() => EscrowModule),
    forwardRef(() => BookingsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaystackService, AtaraPayService, PaymentsService],
  exports: [PaystackService, AtaraPayService, PaymentsService],
})
export class PaymentsModule {}
