import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { QueryWaitlistDto } from './dto/query-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { WaitlistDocument, WaitlistEntry } from './waitlist.schema';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectModel(WaitlistEntry.name)
    private readonly waitlistModel: Model<WaitlistEntry>,
  ) {}

  async create(dto: CreateWaitlistDto): Promise<WaitlistDocument> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.waitlistModel.findOne({ email }).lean();
    if (existing) {
      throw new ConflictException('This email is already on the waitlist');
    }

    try {
      return await this.waitlistModel.create({
        ...dto,
        email,
        phone: dto.phone?.trim() || undefined,
        city: dto.city.trim(),
        fullName: dto.fullName.trim(),
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException('This email is already on the waitlist');
      }
      throw error;
    }
  }

  async findAll(query: QueryWaitlistDto) {
    const { q, city, persona, page = 1, limit = 20 } = query;
    const filter: Record<string, unknown> = {};

    if (q) {
      filter.$text = { $search: q };
    }
    if (city) {
      filter.city = new RegExp(city, 'i');
    }
    if (persona) {
      filter.persona = persona;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.waitlistModel
        .find(filter)
        .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.waitlistModel.countDocuments(filter),
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

  async findById(id: string): Promise<WaitlistDocument> {
    const entry = await this.waitlistModel.findById(id);
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    return entry;
  }

  async update(id: string, dto: UpdateWaitlistDto): Promise<WaitlistDocument> {
    const entry = await this.findById(id);

    if (dto.email && dto.email.toLowerCase().trim() !== entry.email) {
      const email = dto.email.toLowerCase().trim();
      const taken = await this.waitlistModel
        .findOne({ email, _id: { $ne: entry._id } })
        .lean();
      if (taken) {
        throw new ConflictException('This email is already on the waitlist');
      }
      entry.email = email;
    }

    if (dto.fullName !== undefined) entry.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) entry.phone = dto.phone.trim() || undefined;
    if (dto.city !== undefined) entry.city = dto.city.trim();
    if (dto.persona !== undefined) entry.persona = dto.persona;

    try {
      return await entry.save();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException('This email is already on the waitlist');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.waitlistModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Waitlist entry not found');
    }
    return { message: 'Waitlist entry deleted' };
  }

  async count(): Promise<{ total: number }> {
    const total = await this.waitlistModel.countDocuments();
    return { total };
  }
}
