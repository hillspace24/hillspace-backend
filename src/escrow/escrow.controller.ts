import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EscrowStatus } from '../common/enums/escrow-status.enum';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { DisputeEscrowDto } from './dto/dispute-escrow.dto';
import { FundEscrowDto } from './dto/fund-escrow.dto';
import { TransitionEscrowDto } from './dto/transition-escrow.dto';
import { EscrowService } from './escrow.service';

@ApiTags('Escrow')
@ApiBearerAuth('access-token')
@Controller('escrow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @Roles(Role.BUYER, Role.ADMIN)
  @ApiOperation({ summary: 'Create an escrow deal on a listing' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateEscrowDto) {
    return this.escrowService.create(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my escrow deals / transactions' })
  @ApiQuery({ name: 'status', required: false, enum: EscrowStatus })
  myDeals(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: EscrowStatus,
  ) {
    return this.escrowService.myDeals(userId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get escrow deal by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.escrowService.findByIdForUser(id, userId, role);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Payment receipt payload for an escrow deal' })
  receipt(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.escrowService.receipt(id, userId, role);
  }

  @Post(':id/fund')
  @ApiOperation({ summary: 'Mark escrow as funded (buyer, manual ref)' })
  fund(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: FundEscrowDto,
  ) {
    return this.escrowService.fund(id, userId, role, dto);
  }

  @Post(':id/inspection')
  @ApiOperation({ summary: 'Move escrow to inspection / review period' })
  startInspection(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: TransitionEscrowDto,
  ) {
    return this.escrowService.startInspection(id, userId, role, dto);
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Release escrow funds to seller' })
  release(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: TransitionEscrowDto,
  ) {
    return this.escrowService.release(id, userId, role, dto);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund escrow to buyer' })
  refund(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: TransitionEscrowDto,
  ) {
    return this.escrowService.refund(id, userId, role, dto);
  }

  @Post(':id/dispute')
  @ApiOperation({ summary: 'Open an escrow dispute with reasons + evidence' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('evidence', 8, {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  dispute(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: DisputeEscrowDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.escrowService.dispute(id, userId, role, dto, files ?? []);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an initiated escrow' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: TransitionEscrowDto,
  ) {
    return this.escrowService.cancel(id, userId, role, dto);
  }
}
