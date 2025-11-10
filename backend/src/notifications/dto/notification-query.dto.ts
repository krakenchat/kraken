import { IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
