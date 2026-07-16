import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto, SendMessageDto } from './dto/messages.dto';
import {
  ChatMessage,
  Conversation,
  ConversationDocument,
} from './message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessage>,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async listConversations(userId: string) {
    return this.conversationModel
      .find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'firstName lastName avatarUrl')
      .populate('listing', 'title price images location');
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    if (dto.participantId === userId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    const existing = await this.conversationModel.findOne({
      participants: { $all: [userId, dto.participantId], $size: 2 },
      ...(dto.listingId
        ? { listing: dto.listingId }
        : { listing: { $exists: false } }),
    });
    if (existing) return existing;

    return this.conversationModel.create({
      participants: [
        new Types.ObjectId(userId),
        new Types.ObjectId(dto.participantId),
      ],
      listing: dto.listingId
        ? new Types.ObjectId(dto.listingId)
        : undefined,
      lastMessageAt: new Date(),
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.ensureParticipant(userId, conversationId);
    const messages = await this.messageModel
      .find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate('sender', 'firstName lastName avatarUrl');
    return { conversation, messages };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.ensureParticipant(userId, conversationId);
    const message = await this.messageModel.create({
      conversation: conversation._id,
      sender: new Types.ObjectId(userId),
      body: dto.body,
      readBy: [new Types.ObjectId(userId)],
    });

    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = dto.body.slice(0, 120);
    await conversation.save();

    const others = conversation.participants
      .map((p) => p.toString())
      .filter((id) => id !== userId);

    if (this.notificationsService) {
      await Promise.all(
        others.map((uid) =>
          this.notificationsService!.create({
            userId: uid,
            title: 'New message',
            body: dto.body.slice(0, 100),
            type: 'message',
            data: { conversationId },
          }),
        ),
      );
    }

    return message;
  }

  async markRead(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);
    await this.messageModel.updateMany(
      {
        conversation: conversationId,
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: new Types.ObjectId(userId) } },
    );
    return { message: 'Conversation marked as read' };
  }

  private async ensureParticipant(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const isParty = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParty) throw new ForbiddenException('Not a participant');
    return conversation;
  }
}
