import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('app.cloudinary.cloudName'),
      api_key: this.configService.get<string>('app.cloudinary.apiKey'),
      api_secret: this.configService.get<string>('app.cloudinary.apiSecret'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    subfolder = 'images',
  ): Promise<UploadApiResponse> {
    const folder = `${this.configService.get<string>('app.cloudinary.folder')}/${subfolder}`;

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(upload);
    });
  }

  async deleteAsset(publicId: string): Promise<void> {
    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });

    // Ownership docs / non-images may be stored as raw when uploaded with resource_type auto
    if (result?.result === 'not found') {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
        invalidate: true,
      });
    }
  }
}
