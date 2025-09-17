import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadFileDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
  })
  isPublic?: boolean = false;
}