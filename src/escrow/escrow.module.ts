import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PaymentsModule } from '../integrations/payments/payments.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscrowController } from './escrow.controller';
import { Escrow, EscrowSchema } from './escrow.schema';
import { EscrowService } from './escrow.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Escrow.name, schema: EscrowSchema }]),
    ListingsModule,
    CloudinaryModule,
    NotificationsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
