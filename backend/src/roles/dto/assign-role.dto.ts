import { IsString, IsMongoId } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsMongoId({ message: 'Invalid user ID format' })
  userId: string;

  @IsString()
  @IsMongoId({ message: 'Invalid role ID format' })
  roleId: string;
}
