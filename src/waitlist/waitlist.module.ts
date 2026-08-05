import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailModule } from '../integrations/email/email.module';
import { WaitlistController } from './waitlist.controller';
import { WaitlistEntry, WaitlistSchema } from './waitlist.schema';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [
    EmailModule,
    MongooseModule.forFeature([
      { name: WaitlistEntry.name, schema: WaitlistSchema },
    ]),
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
