import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { VerificationController } from './verification.controller';
import {
  VerificationRequest,
  VerificationRequestSchema,
} from './verification.schema';
import { VerificationService } from './verification.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VerificationRequest.name, schema: VerificationRequestSchema },
    ]),
    CloudinaryModule,
    UsersModule,
    ListingsModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
