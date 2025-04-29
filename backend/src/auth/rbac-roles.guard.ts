import {
  Injectable,
  CanActivate,
  ExecutionContext,
  LoggerService,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserEntity } from '@/user/dto/user-response.dto';
import { RBAC_ACTION_KEY } from './rbac-action.decorator';
import { InstanceRole, RbacActions } from '@prisma/client';
import { RolesService } from '@/roles/roles.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly rolesService: RolesService,
    private readonly logger: LoggerService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRbacActions = this.reflector.getAllAndOverride<RbacActions[]>(
      RBAC_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    this.logger.log(
      `requiredRbacActions: ${JSON.stringify(requiredRbacActions)}`,
    );

    if (!requiredRbacActions || !requiredRbacActions.length) {
      return true;
    }

    const {
      user,
      params,
    }: { user: UserEntity; params: Record<string, string> } = context
      .switchToHttp()
      .getRequest();

    this.logger.log(`user: ${JSON.stringify(user)}`);
    this.logger.log(`params: ${JSON.stringify(params)}`);

    if (!user) {
      return false;
    }
    // check if the user is an owner as an anti-lockout mechanism
    if (user.role === InstanceRole.OWNER) {
      return true;
    }

    return this.rolesService.verifyActionsForUserAndResource(
      user.id,
      params.communityId,
      requiredRbacActions,
    );
  }
}
