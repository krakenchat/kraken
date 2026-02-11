import { IsEnum } from 'class-validator';
import { InstanceRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { InstanceRoleValues } from '@/common/enums/swagger-enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: InstanceRoleValues })
  @IsEnum(InstanceRole)
  role: InstanceRole;
}
