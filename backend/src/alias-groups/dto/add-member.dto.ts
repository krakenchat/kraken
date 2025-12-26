import { IsString, IsMongoId } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @IsMongoId()
  userId: string;
}
