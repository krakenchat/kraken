import { IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for updating voice state
 *
 * NOTE: We only store isDeafened on the server now.
 * Media states (video, screen share, mic mute) are managed by LiveKit
 * and read directly from LiveKit participants on the frontend.
 *
 * isDeafened is custom UI state (client-side audio output muting)
 * that we want to show to other users, so we store it here.
 */
export class VoiceStateUpdateDto {
  @IsOptional()
  @IsBoolean()
  isDeafened?: boolean;
}
