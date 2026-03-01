import {
  IsOptional,
  IsInt,
  Min,
  IsArray,
  IsDate,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsUUID('all', { each: true })
  communityIds: string[];
}
