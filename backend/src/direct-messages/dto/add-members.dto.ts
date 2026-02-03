import { IsArray } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class AddMembersDto {
  @IsArray()
  @IsObjectId({ each: true })
  userIds: string[];
}
