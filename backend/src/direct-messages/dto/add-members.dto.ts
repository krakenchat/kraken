import { IsArray, IsUUID } from 'class-validator';

export class AddMembersDto {
  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];
}
