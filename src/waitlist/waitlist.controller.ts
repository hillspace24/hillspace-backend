import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { QueryWaitlistDto } from './dto/query-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @ApiOperation({ summary: 'Join the waitlist (public)' })
  create(@Body() dto: CreateWaitlistDto) {
    return this.waitlistService.create(dto);
  }

  @Get('count')
  @ApiOperation({ summary: 'Public waitlist signup count' })
  count() {
    return this.waitlistService.count();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List waitlist entries (admin)' })
  findAll(@Query() query: QueryWaitlistDto) {
    return this.waitlistService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get waitlist entry by id (admin)' })
  findOne(@Param('id') id: string) {
    return this.waitlistService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update waitlist entry (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateWaitlistDto) {
    return this.waitlistService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete waitlist entry (admin)' })
  remove(@Param('id') id: string) {
    return this.waitlistService.remove(id);
  }
}
