import { IsString, IsMongoId } from 'class-validator';

export class AssignInstanceRoleDto {
  @IsString()
  @IsMongoId({ message: 'Invalid user ID format' })
  userId: string;
}
