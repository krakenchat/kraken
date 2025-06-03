import { RbacActions } from '@prisma/client';

export class RoleDto {
  id: string;
  name: string;
  actions: RbacActions[];
  createdAt: Date;
}

export class UserRolesResponseDto {
  userId: string;
  resourceId: string | null;
  resourceType: 'COMMUNITY' | 'CHANNEL' | 'INSTANCE' | null;
  roles: RoleDto[];
}
