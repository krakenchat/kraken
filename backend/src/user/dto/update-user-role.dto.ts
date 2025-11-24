import { IsEnum } from 'class-validator';
import { InstanceRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(InstanceRole)
  role: InstanceRole;
}
