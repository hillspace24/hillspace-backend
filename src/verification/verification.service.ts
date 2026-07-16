import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { ListingsService } from '../listings/listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import {
  FacialStatus,
  VerificationRequest,
  VerificationRequestDocument,
  VerificationType,
} from './verification.schema';

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(VerificationRequest.name)
    private readonly verificationModel: Model<VerificationRequest>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
    private readonly listingsService: ListingsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async submit(
    userId: string,
    dto: SubmitVerificationDto,
    files: Express.Multer.File[],
    selfie?: Express.Multer.File,
  ): Promise<VerificationRequestDocument> {
    if (!files?.length && !selfie) {
      throw new BadRequestException('At least one document or selfie is required');
    }

    if (dto.type === VerificationType.LISTING && !dto.listingId) {
      throw new BadRequestException('listingId is required for listing verification');
    }

    if (dto.type === VerificationType.LISTING && dto.listingId) {
      await this.listingsService.findById(dto.listingId);
    }

    const uploads = files?.length
      ? await Promise.all(
          files.map((file) =>
            this.cloudinaryService.uploadImage(file, `verification/${dto.type}`),
          ),
        )
      : [];

    let selfieUrl: string | undefined;
    let selfiePublicId: string | undefined;
    let facialStatus = dto.facialStatus ?? FacialStatus.PENDING;
    if (selfie) {
      const uploaded = await this.cloudinaryService.uploadImage(
        selfie,
        'verification/selfie',
      );
      selfieUrl = uploaded.secure_url;
      selfiePublicId = uploaded.public_id;
      facialStatus = FacialStatus.SUBMITTED;
    }

    const request = await this.verificationModel.create({
      type: dto.type,
      status: VerificationStatus.PENDING,
      requester: new Types.ObjectId(userId),
      listing: dto.listingId
        ? new Types.ObjectId(dto.listingId)
        : undefined,
      category: dto.category,
      idType: dto.idType,
      idCountry: dto.idCountry,
      fullName: dto.fullName,
      phone: dto.phone,
      residentialAddress: dto.residentialAddress,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      businessName: dto.businessName,
      registrationNumber: dto.registrationNumber,
      officeAddress: dto.officeAddress,
      selfieUrl,
      selfiePublicId,
      facialStatus,
      notes: dto.notes,
      documents: uploads.map((upload, index) => ({
        url: upload.secure_url,
        publicId: upload.public_id,
        label: files[index].originalname,
      })),
    });

    if (dto.type === VerificationType.KYC) {
      await this.usersService.setKycStatus(userId, VerificationStatus.PENDING);
    }
    if (dto.type === VerificationType.AGENT) {
      await this.usersService.setAgentStatus(userId, VerificationStatus.PENDING);
    }
    if (dto.type === VerificationType.LISTING && dto.listingId) {
      await this.listingsService.setVerificationStatus(
        dto.listingId,
        VerificationStatus.PENDING,
      );
    }

    return request;
  }

  async myRequests(userId: string) {
    return this.verificationModel
      .find({ requester: userId })
      .sort({ createdAt: -1 });
  }

  async listPending() {
    return this.verificationModel
      .find({ status: VerificationStatus.PENDING })
      .populate('requester', 'firstName lastName email role')
      .populate('listing', 'title status')
      .sort({ createdAt: 1 });
  }

  async review(
    requestId: string,
    adminId: string,
    dto: ReviewVerificationDto,
  ): Promise<VerificationRequestDocument> {
    const request = await this.verificationModel.findById(requestId);
    if (!request) {
      throw new NotFoundException('Verification request not found');
    }
    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Request already reviewed');
    }

    request.status = dto.status;
    request.reviewNotes = dto.reviewNotes;
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    await request.save();

    const requesterId = request.requester.toString();

    if (request.type === VerificationType.KYC) {
      await this.usersService.setKycStatus(requesterId, dto.status);
    }
    if (request.type === VerificationType.AGENT) {
      await this.usersService.setAgentStatus(requesterId, dto.status);
    }
    if (request.type === VerificationType.LISTING && request.listing) {
      await this.listingsService.setVerificationStatus(
        request.listing.toString(),
        dto.status,
      );
    }

    if (
      this.notificationsService &&
      dto.status === VerificationStatus.APPROVED
    ) {
      await this.notificationsService.create({
        userId: requesterId,
        title: 'Account verified',
        body: 'Your account has been successfully verified.',
        type: 'kyc_approved',
        data: { verificationId: request.id },
      });
    }

    return request;
  }
}
