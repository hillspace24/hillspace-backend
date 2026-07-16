import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Book a property inspection' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'My bookings (buyer or agent)' })
  myBookings(@CurrentUser('sub') userId: string) {
    return this.bookingsService.myBookings(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.bookingsService.findById(id, userId, role);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm booking (agent/owner)' })
  confirm(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.bookingsService.confirm(id, userId, role);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.bookingsService.cancel(id, userId, role);
  }
}
