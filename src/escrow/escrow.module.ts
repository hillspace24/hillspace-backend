import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
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
  ],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
