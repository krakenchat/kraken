import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { MembershipService } from '@/membership/membership.service';
import { IFileAccessStrategy } from './file-access-strategy.interface';

/**
 * Strategy for community-scoped files (avatars, banners, custom emojis)
 * Requires user to be a member of the community
 */
@Injectable()
export class CommunityMembershipStrategy implements IFileAccessStrategy {
  private readonly logger = new Logger(CommunityMembershipStrategy.name);

  constructor(private readonly membershipService: MembershipService) {}

  async checkAccess(
    userId: string,
    communityId: string,
    fileId: string,
  ): Promise<boolean> {
    const isMember = await this.membershipService.isMember(userId, communityId);

    if (!isMember) {
      this.logger.debug(
        `User ${userId} is not a member of community ${communityId}, denying access to file ${fileId}`,
      );
      throw new ForbiddenException(
        'You must be a member of this community to access this file',
      );
    }

    this.logger.debug(
      `User ${userId} is a member of community ${communityId}, allowing access to file ${fileId}`,
    );
    return true;
  }
}
