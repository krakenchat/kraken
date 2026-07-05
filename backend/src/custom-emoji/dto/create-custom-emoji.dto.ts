import { IsString, IsUUID, Matches } from 'class-validator';

/**
 * Shortcode format for custom emojis: lowercase letters, digits and
 * underscores, 2-32 chars, and must contain at least one letter (so a
 * purely numeric/underscore name like `12` or `__` is rejected). Used
 * inline as `:shortcode:`.
 */
export const CUSTOM_EMOJI_NAME_REGEX = /^(?=.*[a-z])[a-z0-9_]{2,32}$/;

export class CreateCustomEmojiDto {
  @IsString()
  @Matches(CUSTOM_EMOJI_NAME_REGEX, {
    message:
      'Emoji name must be 2-32 characters of lowercase letters, numbers, or underscores, and include at least one letter',
  })
  name: string;

  @IsUUID()
  fileId: string;
}
