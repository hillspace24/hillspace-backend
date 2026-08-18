import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/hillspace',
  // Public register/login stay off until launch. Set PUBLIC_AUTH_ENABLED=true to open them.
  publicAuthEnabled:
    String(process.env.PUBLIC_AUTH_ENABLED ?? '').toLowerCase() === 'true',
  adminSeed: {
    email: process.env.ADMIN_EMAIL?.trim() || 'hillspace@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'hillspace1234!',
    firstName: process.env.ADMIN_FIRST_NAME?.trim() || 'HillSpace',
    lastName: process.env.ADMIN_LAST_NAME?.trim() || 'Admin',
    phone: process.env.ADMIN_PHONE?.trim() || '+2348000000001',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER ?? 'hillspace',
  },
}));
