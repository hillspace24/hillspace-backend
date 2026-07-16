/** 4-digit numeric OTP for email verification / password reset (Figma). */
export function fourDigitOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
