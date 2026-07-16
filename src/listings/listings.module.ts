import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Favorite, FavoriteSchema } from './favorite.schema';
import { Listing, ListingSchema } from './listing.schema';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService, MongooseModule],
})
export class ListingsModule {}
