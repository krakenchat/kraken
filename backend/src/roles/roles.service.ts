import { RbacResourceType } from '@/auth/rbac-resource.decorator';
import { DatabaseService } from '@/database/database.service';
import { Injectable } from '@nestjs/common';
import { RbacActions } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private readonly database: DatabaseService) {}

  async verifyActionsForUserAndResource(
    userId: string,
    resourceId: string | undefined,
    resourceType: RbacResourceType | undefined,
    action: RbacActions[],
  ): Promise<boolean> {
    // Logic to check if the user has the required actions on the resource
    const userRoles = await this.database.userRoles.findMany({
      where: {
        userId,
        communityId: resourceId, // TODO: make this dynamic and update the model
        isInstanceRole:
          resourceId === undefined ||
          resourceType === RbacResourceType.INSTANCE,
      },
      include: {
        role: true,
      },
    });

    const roles = userRoles.map((ur) => ur.role);
    const allActions = roles.flatMap((role) => role.actions);

    // Check if the user has all the required actions
    return action.every((a) => allActions.includes(a));
  }
}
