import { IsString, IsOptional } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class AddAttachmentDto {
  @IsOptional()
  @IsString()
  @IsObjectId()
  fileId?: string; // Optional - if not provided, just decrements pendingAttachments
}
