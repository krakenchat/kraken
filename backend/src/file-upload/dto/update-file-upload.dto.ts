import { PartialType } from '@nestjs/swagger';
import { CreateFileUploadDto } from './create-file-upload.dto';

export class UpdateFileUploadDto extends PartialType(CreateFileUploadDto) {}
