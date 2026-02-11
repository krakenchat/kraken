import { RbacActions } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { RbacActionsValues } from '@/common/enums/swagger-enums';

export class RoleDto {
  id: string;
  name: string;
  @ApiProperty({ enum: RbacActionsValues, isArray: true })
  actions: RbacActions[];
  createdAt: Date;
  isDefault: boolean;
}

export class UserRolesResponseDto {
  userId: string;
  resourceId: string | null;
  @ApiProperty({ enum: ['COMMUNITY', 'CHANNEL', 'INSTANCE'], nullable: true })
  resourceType: 'COMMUNITY' | 'CHANNEL' | 'INSTANCE' | null;
  roles: RoleDto[];
}
