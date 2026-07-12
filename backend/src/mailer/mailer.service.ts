import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Thin wrapper around nodemailer for transactional email (currently just
 * password-reset links). Deliberately plain-text/minimal-HTML — no template
 * engine, no @nestjs-modules/mailer.
 *
 * The feature this backs (self-service password reset) is auto-disabled
 * unless SMTP is fully configured — see `isEnabled`.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | undefined;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Whether outbound email is fully configured. Requires SMTP_HOST,
   * SMTP_FROM, and PUBLIC_APP_URL (the latter is needed to build reset
   * links, so without it there's nothing useful to send).
   */
  get isEnabled(): boolean {
    return Boolean(
      this.configService.get<string>('SMTP_HOST') &&
      this.configService.get<string>('SMTP_FROM') &&
      this.configService.get<string>('PUBLIC_APP_URL'),
    );
  }

  /**
   * Parses SMTP_PORT, falling back to the default (587) and warning when
   * the value is missing or not a valid number.
   */
  private getPort(): number {
    const raw = this.configService.get<string>('SMTP_PORT');
    if (raw === undefined) {
      return 587;
    }

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      this.logger.warn(
        `Invalid SMTP_PORT value "${raw}"; falling back to default port 587`,
      );
      return 587;
    }

    return parsed;
  }

  /**
   * Builds the nodemailer transport lazily (and only once) so we don't pay
   * the connection-pool setup cost when the feature is disabled.
   */
  private getTransporter(): Transporter {
    if (!this.transporter) {
      const host = this.configService.get<string>('SMTP_HOST');
      const port = this.getPort();
      const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASS');

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
    }

    return this.transporter;
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(
        'sendPasswordResetEmail called while the mailer is disabled (SMTP_HOST/SMTP_FROM/PUBLIC_APP_URL not fully configured); no-op',
      );
      return;
    }

    const from = this.configService.get<string>('SMTP_FROM');
    const transporter = this.getTransporter();

    await transporter.sendMail({
      from,
      to,
      subject: 'Reset your Semaphore Chat password',
      text:
        'We received a request to reset your Semaphore Chat password.\n\n' +
        `Open this link to choose a new password (valid for 1 hour):\n${resetUrl}\n\n` +
        "If you didn't request this, you can safely ignore this email.",
      html:
        '<p>We received a request to reset your Semaphore Chat password.</p>' +
        `<p><a href="${resetUrl}">Click here to choose a new password</a> (valid for 1 hour).</p>` +
        "<p>If you didn't request this, you can safely ignore this email.</p>",
    });
  }
}
