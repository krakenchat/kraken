import { IsArray, IsMongoId } from 'class-validator';

export class UpdateMembersDto {
  @IsArray()
  @IsMongoId({ each: true })
  memberIds: string[];
}
