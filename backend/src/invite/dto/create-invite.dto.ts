import { IsOptional, IsInt, Min, IsArray, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { IsObjectId } from 'nestjs-object-id';

export class CreateInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  validUntil?: Date;

  @IsArray()
  @IsObjectId({ each: true })
  communityIds: string[];
}
