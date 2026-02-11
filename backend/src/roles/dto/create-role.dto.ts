import { IsString, IsArray, ArrayMinSize, MaxLength } from 'class-validator';
import { RbacActions } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { RbacActionsValues } from '@/common/enums/swagger-enums';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  name: string;

  @ApiProperty({ enum: RbacActionsValues, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Role must have at least one permission' })
  actions: RbacActions[];
}
