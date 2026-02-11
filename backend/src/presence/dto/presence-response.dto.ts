import { ApiProperty } from '@nestjs/swagger';

export class UserPresenceResponseDto {
  userId: string;
  isOnline: boolean;
}

export class BulkPresenceResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'boolean' } })
  presence: Record<string, boolean>;
}
