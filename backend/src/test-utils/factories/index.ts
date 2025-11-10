/**
 * Test Factories
 *
 * Provides factory functions for creating mock Prisma entities with sensible defaults.
 * Each factory supports overriding any property and includes specialized builder methods.
 *
 * Usage:
 * ```typescript
 * import { UserFactory, MessageFactory } from '@/test-utils/factories';
 *
 * const user = UserFactory.build({ username: 'testuser' });
 * const message = MessageFactory.build({ authorId: user.id });
 * ```
 */

export { UserFactory } from './user.factory';
export { MessageFactory } from './message.factory';
export { CommunityFactory } from './community.factory';
export { ChannelFactory } from './channel.factory';
export { MembershipFactory } from './membership.factory';
export { ChannelMembershipFactory } from './channel-membership.factory';
export { RoleFactory } from './role.factory';
export { DirectMessageGroupFactory } from './direct-message-group.factory';
export { FileFactory } from './file.factory';
export { RefreshTokenFactory } from './refresh-token.factory';
export { InstanceInviteFactory } from './instance-invite.factory';
export { ReadReceiptFactory } from './read-receipt.factory';
export { NotificationFactory } from './notification.factory';
export { UserNotificationSettingsFactory } from './user-notification-settings.factory';
export { ChannelNotificationOverrideFactory } from './channel-notification-override.factory';
