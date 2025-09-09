import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDmGroupDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;
}