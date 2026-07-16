import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter listings (Explore)' })
  search(@Query() query: SearchListingsDto) {
    return this.listingsService.search(query);
  }

  @Get('mine')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'My listings (Published / Drafts)' })
  @ApiQuery({ name: 'status', required: false, enum: ListingStatus })
  mine(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: ListingStatus,
  ) {
    return this.listingsService.myListings(userId, status);
  }

  @Get('favorites')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List my favorite listings' })
  favorites(@CurrentUser('sub') userId: string) {
    return this.listingsService.myFavorites(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listing by id' })
  findOne(@Param('id') id: string) {
    return this.listingsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Create a listing' })
  create(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.create(userId, role, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Update a listing' })
  update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, userId, role, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a listing' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.listingsService.remove(id, userId, role);
  }

  @Post(':id/images')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Upload listing images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.listingsService.uploadImages(id, userId, role, files ?? []);
  }

  @Post(':id/ownership-docs')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Upload ownership verification documents' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('documents', 8, {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadOwnershipDocs(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.listingsService.uploadOwnershipDocs(
      id,
      userId,
      role,
      files ?? [],
    );
  }

  @Post(':id/publish')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Publish a listing (set status active)' })
  publish(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.listingsService.publish(id, userId, role);
  }

  @Post(':id/favorite')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add listing to favorites' })
  addFavorite(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.listingsService.addFavorite(userId, id);
  }

  @Delete(':id/favorite')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove listing from favorites' })
  removeFavorite(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.listingsService.removeFavorite(userId, id);
  }
}
