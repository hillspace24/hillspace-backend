import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({ timestamps: true })
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Listing', required: true, index: true })
  listing: Types.ObjectId;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
FavoriteSchema.index({ user: 1, listing: 1 }, { unique: true });
