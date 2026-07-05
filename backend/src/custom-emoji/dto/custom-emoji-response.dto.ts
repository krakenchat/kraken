/**
 * Public shape of a community custom emoji. Clients resolve `:name:` shortcodes
 * and `custom:{id}` reaction sentinels to an image via `fileId`.
 */
export class CustomEmojiDto {
  id: string;
  communityId: string;
  name: string;
  fileId: string;
  createdBy: string | null;
  createdAt: Date;
}
