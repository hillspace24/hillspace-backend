import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parseSender,
  sendViaBrevo,
  upsertBrevoContact,
  verifyBrevoAccount,
  type BrevoSender,
} from './brevo.transport';
import {
  buildLoginNotificationEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildPasswordResetOtpEmail,
  buildVerificationEmail,
  buildWaitlistWelcomeEmail,
  type LoginNotificationParams,
  type VerificationVariant,
  type WaitlistWelcomeParams,
} from './templates';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private loggedReady = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Email not configured: set BREVO_API_KEY and a verified sender (BREVO_SENDER_EMAIL or BREVO_FROM).',
      );
      return;
    }
    const skip =
      String(this.configService.get<string>('EMAIL_VERIFY_ON_BOOT') ?? '').toLowerCase() ===
      'false';
    if (skip) {
      this.logReady();
      return;
    }
    try {
      await verifyBrevoAccount(this.getApiKey());
      this.logReady();
      this.logger.log('Brevo email transport verified.');
    } catch (e) {
      this.logger.error(
        `Brevo verification failed: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  private logReady(): void {
    if (this.loggedReady) {
      return;
    }
    this.loggedReady = true;
    this.logger.log('Email sends via Brevo transactional API.');
  }

  private cfgTrim(...keys: string[]): string | undefined {
    for (const key of keys) {
      const v = this.configService.get<string>(key)?.trim();
      if (v) {
        return v;
      }
    }
    return undefined;
  }

  private getApiKey(): string {
    const key = this.cfgTrim('BREVO_API_KEY', 'SENDINBLUE_API_KEY');
    if (!key) {
      throw new Error('Brevo is not configured');
    }
    return key;
  }

  private getSender(): BrevoSender {
    const sender = parseSender(
      this.cfgTrim('BREVO_FROM', 'EMAIL_FROM'),
      this.cfgTrim('BREVO_SENDER_EMAIL'),
      this.cfgTrim('BREVO_SENDER_NAME') || 'HillSpace',
    );
    if (!sender) {
      throw new Error(
        'Brevo sender is not configured: set BREVO_SENDER_EMAIL or BREVO_FROM.',
      );
    }
    return sender;
  }

  private asciiSubject(subject: string): string {
    return subject
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
  }

  async sendMail(options: {
    to: string;
    toName?: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        'Email not configured: set BREVO_API_KEY and BREVO_SENDER_EMAIL (or BREVO_FROM).',
      );
    }
    this.logReady();
    await sendViaBrevo(this.getApiKey(), this.getSender(), {
      to: options.to,
      toName: options.toName,
      subject: this.asciiSubject(options.subject),
      text: options.text,
      html: options.html,
    });
  }

  isConfigured(): boolean {
    const key = this.cfgTrim('BREVO_API_KEY', 'SENDINBLUE_API_KEY');
    const sender = parseSender(
      this.cfgTrim('BREVO_FROM', 'EMAIL_FROM'),
      this.cfgTrim('BREVO_SENDER_EMAIL'),
      this.cfgTrim('BREVO_SENDER_NAME') || 'HillSpace',
    );
    return Boolean(key && sender);
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    otp: string,
    variant: VerificationVariant = 'repeat',
    userId?: string,
  ): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(
      name,
      otp,
      variant,
      userId,
    );
    await this.sendMail({ to, toName: name, subject, html, text });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    userId: string,
    resetUrlToken: string,
  ): Promise<void> {
    const { subject, html, text } = buildPasswordResetEmail(
      name,
      userId,
      resetUrlToken,
    );
    await this.sendMail({ to, toName: name, subject, html, text });
  }

  async sendPasswordResetOtpEmail(
    to: string,
    name: string,
    otp: string,
  ): Promise<void> {
    const { subject, html, text } = buildPasswordResetOtpEmail(name, otp);
    await this.sendMail({ to, toName: name, subject, html, text });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    const { subject, html, text } = buildPasswordChangedEmail(name);
    await this.sendMail({ to, toName: name, subject, html, text });
  }

  /** After each successful login (optional IP / User-Agent from request). */
  async sendLoginNotificationEmail(
    to: string,
    name: string,
    params: LoginNotificationParams,
  ): Promise<void> {
    const { subject, html, text } = buildLoginNotificationEmail(name, params);
    await this.sendMail({ to, toName: name, subject, html, text });
  }

  async sendWaitlistWelcomeEmail(
    to: string,
    params: WaitlistWelcomeParams,
  ): Promise<void> {
    const { subject, html, text } = buildWaitlistWelcomeEmail(params);
    await this.sendMail({
      to,
      toName: params.fullName,
      subject,
      html,
      text,
    });
  }

  /**
   * Optional: add/update the waitlist signup in a Brevo contact list
   * (set BREVO_WAITLIST_LIST_ID). Failures are logged, not thrown.
   */
  async syncWaitlistContact(params: WaitlistWelcomeParams & { email: string }): Promise<void> {
    const listRaw = this.cfgTrim('BREVO_WAITLIST_LIST_ID');
    if (!listRaw) {
      return;
    }
    const listId = Number(listRaw);
    if (!Number.isFinite(listId) || listId <= 0) {
      this.logger.warn(
        `BREVO_WAITLIST_LIST_ID is invalid (${listRaw}); skipping contact sync.`,
      );
      return;
    }

    const parts = params.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? params.fullName;
    const lastName = parts.slice(1).join(' ');

    try {
      await upsertBrevoContact(this.getApiKey(), {
        email: params.email,
        listIds: [listId],
        attributes: {
          FIRSTNAME: firstName,
          ...(lastName ? { LASTNAME: lastName } : {}),
        },
      });
    } catch (err) {
      this.logger.error(
        `[email] Brevo waitlist contact sync failed for ${params.email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
