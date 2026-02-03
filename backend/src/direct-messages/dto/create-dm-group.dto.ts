import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class CreateDmGroupDto {
  @IsArray()
  @IsObjectId({ each: true })
  userIds: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;
}
