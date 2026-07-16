import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { VerificationService } from './verification.service';

@ApiTags('Verification')
@ApiBearerAuth('access-token')
@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit KYC / agent / listing verification (docs + optional selfie)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'documents', maxCount: 8 },
        { name: 'selfie', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 8 * 1024 * 1024 },
      },
    ),
  )
  submit(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitVerificationDto,
    @UploadedFiles()
    files: {
      documents?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
  ) {
    return this.verificationService.submit(
      userId,
      dto,
      files?.documents ?? [],
      files?.selfie?.[0],
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'List my verification requests' })
  myRequests(@CurrentUser('sub') userId: string) {
    return this.verificationService.myRequests(userId);
  }

  @Get('pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List pending verification requests (admin)' })
  listPending() {
    return this.verificationService.listPending();
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a verification request (admin)' })
  review(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.review(id, adminId, dto);
  }
}
