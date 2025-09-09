import { IsString, IsArray, ArrayMinSize, MaxLength } from 'class-validator';
import { RbacActions } from '@prisma/client';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  name: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Role must have at least one permission' })
  actions: RbacActions[];
}
