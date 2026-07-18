import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Favorite, FavoriteSchema } from './favorite.schema';
import { Listing, ListingSchema } from './listing.schema';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { Rating, RatingSchema } from './rating.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Rating.name, schema: RatingSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService, MongooseModule],
})
export class ListingsModule {}
