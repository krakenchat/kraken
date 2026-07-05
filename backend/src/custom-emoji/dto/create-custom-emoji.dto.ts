import { IsString, IsUUID, Matches } from 'class-validator';

/**
 * Shortcode format for custom emojis: lowercase letters, digits and
 * underscores, 2-32 chars. Used inline as `:shortcode:`.
 */
export const CUSTOM_EMOJI_NAME_REGEX = /^[a-z0-9_]{2,32}$/;

export class CreateCustomEmojiDto {
  @IsString()
  @Matches(CUSTOM_EMOJI_NAME_REGEX, {
    message:
      'Emoji name must be 2-32 characters of lowercase letters, numbers, or underscores',
  })
  name: string;

  @IsUUID()
  fileId: string;
}
