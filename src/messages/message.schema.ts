import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;
export type MessageDocument = HydratedDocument<ChatMessage>;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  listing?: Types.ObjectId;

  @Prop({ default: () => new Date(), index: true })
  lastMessageAt: Date;

  @Prop()
  lastMessagePreview?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ participants: 1 });

@Schema({ _id: false })
export class MessageAttachment {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;
}

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  })
  conversation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sender: Types.ObjectId;

  @Prop({ required: true })
  body: string;

  @Prop({ type: [MessageAttachment], default: [] })
  attachments: MessageAttachment[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy: Types.ObjectId[];
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
