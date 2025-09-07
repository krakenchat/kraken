import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MessagesService } from '@/messages/messages.service';
import { RbacGuard } from './rbac.guard';
import { UserEntity } from '@/user/dto/user-response.dto';

@Injectable()
export class MessageOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(MessageOwnershipGuard.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly rbacGuard: RbacGuard,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserEntity = request.user;
    const messageId = request.params?.id;

    // If no message ID in params, fall back to RBAC
    if (!messageId) {
      this.logger.debug('No message ID found, falling back to RBAC check');
      return this.rbacGuard.canActivate(context);
    }

    // If no user, deny access
    if (!user) {
      this.logger.debug('No user found, denying access');
      return false;
    }

    try {
      // Fetch the message to check ownership
      const message = await this.messagesService.findOne(messageId);
      
      // Allow message owners to edit/delete their own messages
      if (message.authorId === user.id) {
        this.logger.debug(`User ${user.id} is owner of message ${messageId}, allowing access`);
        return true;
      }

      this.logger.debug(`User ${user.id} is not owner of message ${messageId}, checking RBAC permissions`);
    } catch (error) {
      // If message not found, let RBAC handle the response
      this.logger.debug(`Message ${messageId} not found, falling back to RBAC check`);
    }

    // Fall back to RBAC for moderator actions
    return this.rbacGuard.canActivate(context);
  }
}