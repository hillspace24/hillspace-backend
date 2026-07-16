import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import appConfig from './config/app.config';
import { EscrowModule } from './escrow/escrow.module';
import { ListingsModule } from './listings/listings.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('app.mongodbUri'),
      }),
    }),
    CloudinaryModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    ListingsModule,
    VerificationModule,
    EscrowModule,
    BookingsModule,
    MessagesModule,
    ReportsModule,
  ],
})
export class AppModule {}
