import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Role } from '../common/enums/role.enum';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Favorite } from './favorite.schema';
import { Listing, ListingDocument } from './listing.schema';

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<Favorite>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    ownerId: string,
    role: Role,
    dto: CreateListingDto,
    files: Express.Multer.File[] = [],
  ): Promise<ListingDocument> {
    const uploadedImages = await this.uploadListingImages(files);

    const payload: Partial<Listing> = {
      ...dto,
      images: uploadedImages,
      owner: new Types.ObjectId(ownerId),
      status: dto.status ?? ListingStatus.DRAFT,
      verificationStatus: VerificationStatus.UNVERIFIED,
    };

    if (role === Role.AGENT) {
      payload.agent = new Types.ObjectId(ownerId);
    }

    return this.listingModel.create(payload);
  }

  async findById(id: string): Promise<ListingDocument> {
    const listing = await this.listingModel
      .findById(id)
      .populate('owner', 'firstName lastName email phone kycStatus avatarUrl')
      .populate('agent', 'firstName lastName email phone agentStatus avatarUrl');

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  async myListings(ownerId: string, status?: ListingStatus) {
    const filter: Record<string, unknown> = {
      $or: [{ owner: ownerId }, { agent: ownerId }],
    };
    if (status) filter.status = status;
    return this.listingModel.find(filter).sort({ updatedAt: -1 });
  }

  async update(
    id: string,
    userId: string,
    role: Role,
    dto: UpdateListingDto,
    files: Express.Multer.File[] = [],
  ): Promise<ListingDocument> {
    const listing = await this.findOwned(id, userId, role);
    Object.assign(listing, dto);

    if (files.length) {
      const uploadedImages = await this.uploadListingImages(files);
      listing.images.push(...uploadedImages);
    }

    return listing.save();
  }

  async remove(id: string, userId: string, role: Role): Promise<{ message: string }> {
    const listing = await this.findOwned(id, userId, role);

    const cloudinaryIds = [
      ...listing.images.map((image) => image.publicId),
      ...listing.ownershipDocs.map((doc) => doc.publicId),
    ].filter(Boolean);

    await Promise.all(
      cloudinaryIds.map((publicId) =>
        this.cloudinaryService.deleteAsset(publicId).catch(() => undefined),
      ),
    );

    await listing.deleteOne();
    return { message: 'Listing deleted' };
  }

  async uploadImages(
    id: string,
    userId: string,
    role: Role,
    files: Express.Multer.File[],
  ): Promise<ListingDocument> {
    const listing = await this.findOwned(id, userId, role);
    listing.images.push(...(await this.uploadListingImages(files)));
    return listing.save();
  }

  private async uploadListingImages(files: Express.Multer.File[]) {
    if (!files.length) return [];

    const uploads = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file, 'listings')),
    );

    return uploads.map((upload) => ({
      url: upload.secure_url,
      publicId: upload.public_id,
    }));
  }

  async uploadOwnershipDocs(
    id: string,
    userId: string,
    role: Role,
    files: Express.Multer.File[],
    labels?: string[],
  ): Promise<ListingDocument> {
    const listing = await this.findOwned(id, userId, role);
    const uploads = await Promise.all(
      files.map((file) =>
        this.cloudinaryService.uploadImage(file, 'listings/ownership'),
      ),
    );
    listing.ownershipDocs.push(
      ...uploads.map((upload, i) => ({
        url: upload.secure_url,
        publicId: upload.public_id,
        label: labels?.[i] || files[i].originalname,
      })),
    );
    return listing.save();
  }

  async publish(id: string, userId: string, role: Role): Promise<ListingDocument> {
    const listing = await this.findOwned(id, userId, role);
    listing.status = ListingStatus.ACTIVE;
    return listing.save();
  }

  async addFavorite(userId: string, listingId: string) {
    await this.findById(listingId);
    try {
      return await this.favoriteModel.create({
        user: new Types.ObjectId(userId),
        listing: new Types.ObjectId(listingId),
      });
    } catch {
      throw new ConflictException('Listing already favorited');
    }
  }

  async removeFavorite(userId: string, listingId: string) {
    const result = await this.favoriteModel.findOneAndDelete({
      user: userId,
      listing: listingId,
    });
    if (!result) {
      throw new NotFoundException('Favorite not found');
    }
    return { message: 'Removed from favorites' };
  }

  async myFavorites(userId: string) {
    return this.favoriteModel
      .find({ user: userId })
      .populate({
        path: 'listing',
        populate: [
          { path: 'owner', select: 'firstName lastName' },
          { path: 'agent', select: 'firstName lastName' },
        ],
      })
      .sort({ createdAt: -1 });
  }

  async search(query: SearchListingsDto) {
    const {
      q,
      propertyType,
      purpose,
      category,
      city,
      state,
      lga,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      status,
      verificationStatus,
      page = 1,
      limit = 20,
    } = query;

    const filter: Record<string, unknown> = {};

    if (q) {
      filter.$text = { $search: q };
    }
    if (propertyType) filter.propertyType = propertyType;
    if (purpose) filter.purpose = purpose;
    if (category) filter.category = category;
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (state) filter['location.state'] = new RegExp(state, 'i');
    if (lga) filter['location.lga'] = new RegExp(lga, 'i');
    if (bedrooms !== undefined) filter.bedrooms = { $gte: bedrooms };
    if (bathrooms !== undefined) filter.bathrooms = { $gte: bathrooms };
    if (status) {
      filter.status = status;
    } else {
      filter.status = ListingStatus.ACTIVE;
    }
    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (minPrice !== undefined) price.$gte = minPrice;
      if (maxPrice !== undefined) price.$lte = maxPrice;
      filter.price = price;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'firstName lastName kycStatus avatarUrl')
        .populate('agent', 'firstName lastName agentStatus avatarUrl'),
      this.listingModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async setVerificationStatus(
    id: string,
    status: VerificationStatus,
  ): Promise<ListingDocument> {
    const listing = await this.listingModel.findByIdAndUpdate(
      id,
      { verificationStatus: status },
      { new: true },
    );
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  async setStatus(id: string, status: ListingStatus): Promise<ListingDocument> {
    const listing = await this.listingModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  private async findOwned(
    id: string,
    userId: string,
    role: Role,
  ): Promise<ListingDocument> {
    const listing = await this.listingModel.findById(id);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const isOwner = listing.owner.toString() === userId;
    const isAgent = listing.agent?.toString() === userId;
    if (role !== Role.ADMIN && !isOwner && !isAgent) {
      throw new ForbiddenException('You cannot modify this listing');
    }

    return listing;
  }
}
