import { PartialType } from '@nestjs/swagger';
import { CreateLivekitDto } from './create-livekit.dto';

export class UpdateLivekitDto extends PartialType(CreateLivekitDto) {}
