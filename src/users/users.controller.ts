import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateSettingsDto, UpdateUserDto } from './dto/update-user.dto';
import { WeekDay } from './user.schema';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser('sub') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const upload = await this.cloudinaryService.uploadImage(file, 'avatars');
    return this.usersService.setAvatar(
      userId,
      upload.secure_url,
      upload.public_id,
    );
  }

  @Put('me/availability')
  @ApiOperation({ summary: 'Set weekly availability windows' })
  setAvailability(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    let slots = dto.slots;
    if (dto.repeatAllDays && slots.length > 0) {
      const { from, to } = slots[0];
      slots = Object.values(WeekDay).map((day) => ({ day, from, to }));
    }
    return this.usersService.setAvailability(userId, slots);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: 'Update account settings (notifications, theme)' })
  updateSettings(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(userId, dto);
  }
}
