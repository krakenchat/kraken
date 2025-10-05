import { Injectable, Logger } from '@nestjs/common';
import { IFileAccessStrategy } from './file-access-strategy.interface';

/**
 * Strategy for publicly accessible files (user avatars, banners, etc.)
 * Always grants access regardless of user authentication
 */
@Injectable()
export class PublicAccessStrategy implements IFileAccessStrategy {
  private readonly logger = new Logger(PublicAccessStrategy.name);

  checkAccess(userId: string, _: string, fileId: string): Promise<boolean> {
    this.logger.debug(
      `File ${fileId} is publicly accessible, allowing access for user ${userId}`,
    );
    return Promise.resolve(true);
  }
}
