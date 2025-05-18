import { Request } from 'express';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserEntity } from '@/user/dto/user-response.dto';
import { RBAC_ACTION_KEY } from './rbac-action.decorator';
import { InstanceRole, RbacActions } from '@prisma/client';
import { RolesService } from '@/roles/roles.service';
import {
  RBAC_RESOURCE_KEY,
  RbacResourceOptions,
  RbacResourceType,
  ResourceIdSource,
} from './rbac-resource.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);
  constructor(
    private readonly rolesService: RolesService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRbacActions = this.getRequiredRbacActions(context);
    if (!requiredRbacActions.length) return true;

    const resourceOptions = this.getResourceOptions(context);
    const resourceId = resourceOptions
      ? this.getResourceId(context, resourceOptions)
      : undefined;
    const resourceType = resourceOptions?.type;

    const user = this.getUser(context);

    this.logRbacCheck(requiredRbacActions, user, resourceId, resourceType);

    if (!user) return false;
    if (user.role === InstanceRole.OWNER) return true;

    return this.rolesService.verifyActionsForUserAndResource(
      user.id,
      resourceId,
      resourceType,
      requiredRbacActions,
    );
  }

  private getRequiredRbacActions(context: ExecutionContext): RbacActions[] {
    return (
      this.reflector.getAllAndOverride<RbacActions[]>(RBAC_ACTION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || []
    );
  }

  private getResourceOptions(
    context: ExecutionContext,
  ): RbacResourceOptions | undefined {
    return this.reflector.getAllAndOverride<RbacResourceOptions>(
      RBAC_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );
  }

  private getUser(context: ExecutionContext): UserEntity | undefined {
    const req: Request = context.switchToHttp().getRequest();
    return req.user as UserEntity | undefined;
  }

  private logRbacCheck(
    requiredRbacActions: RbacActions[],
    user: UserEntity | undefined,
    resourceId: string | undefined,
    resourceType: RbacResourceType | undefined,
  ) {
    // TODO: clean this up
    this.logger.log('RBAC Check');
    this.logger.log(
      `Required RBAC Actions: ${JSON.stringify(requiredRbacActions)}`,
    );
    this.logger.log(`User role: ${user?.role}`);
    this.logger.log(`Resource ID: ${resourceId}`);
    this.logger.log(`Resource Type: ${resourceType}`);
  }

  private getResourceId(
    context: ExecutionContext,
    resourceOptions: RbacResourceOptions,
  ): string | undefined {
    const req: Request = context.switchToHttp().getRequest();
    switch (resourceOptions.source) {
      case ResourceIdSource.BODY:
        return (req.body as Record<string, any>)?.[resourceOptions.idKey] as
          | string
          | undefined;
      case ResourceIdSource.QUERY:
        return req.query?.[resourceOptions.idKey] as string | undefined;
      case ResourceIdSource.PARAM:
      default:
        return req.params?.[resourceOptions.idKey] as string | undefined;
    }
  }
}
