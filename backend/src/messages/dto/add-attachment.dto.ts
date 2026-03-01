import { IsString, IsOptional, IsUUID } from 'class-validator';

export class AddAttachmentDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  fileId?: string; // Optional - if not provided, just decrements pendingAttachments
}
