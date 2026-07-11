import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '@/database/database.service';
import { UserService } from '@/user/user.service';
import { MailerService } from '@/mailer/mailer.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Self-service password reset via a tokenized email link.
 *
 * Security properties (see task brief for the full requirements):
 * - `requestReset` never reveals whether the email matches an account or
 *   whether the feature is enabled — it always resolves successfully, and
 *   the controller returns an identical response either way.
 * - Only the SHA-256 hash of the reset token is ever stored or logged.
 * - `resetPassword` throws a single generic error for "not found", "expired",
 *   and "already used" so the failure mode never leaks which case applied.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userService: UserService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async requestReset(email: string): Promise<void> {
    // Feature is fully opt-in: no-op (but still "succeeds") unless SMTP is
    // configured.
    if (!this.mailerService.isEnabled) {
      return;
    }

    const user = await this.databaseService.user.findUnique({
      where: { email },
    });
    if (!user) {
      return;
    }

    // Invalidate any prior unused tokens for this user before issuing a new
    // one, so only the most recently requested link is valid.
    await this.databaseService.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.databaseService.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const publicAppUrl = this.configService.get<string>('PUBLIC_APP_URL');
    const resetUrl = `${publicAppUrl}/reset-password?token=${rawToken}`;

    try {
      // user.email is non-null here: we just looked the user up by email.
      await this.mailerService.sendPasswordResetEmail(user.email!, resetUrl);
    } catch (err) {
      // Never let mail-send errors change the HTTP response.
      this.logger.error(
        `Failed to send password reset email for user ${user.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);

    await this.databaseService.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (
        !resetToken ||
        resetToken.usedAt ||
        resetToken.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      await this.userService.resetPasswordAndRevokeSessions(
        resetToken.userId,
        newPassword,
        tx,
      );

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
    });
  }
}
