import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateConversationDto, SendMessageDto } from './dto/messages.dto';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@ApiBearerAuth('access-token')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations' })
  list(@CurrentUser('sub') userId: string) {
    return this.messagesService.listConversations(userId);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start or get a conversation' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.createConversation(userId, dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation messages' })
  getOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.messagesService.getConversation(userId, id);
  }

  @Post('conversations/:id')
  @ApiOperation({ summary: 'Send a message' })
  send(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(userId, id, dto);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.messagesService.markRead(userId, id);
  }
}
