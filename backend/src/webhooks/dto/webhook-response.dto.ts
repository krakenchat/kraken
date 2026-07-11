import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public webhook shape — deliberately excludes `tokenHash` and the `creator`
 * user relation. Never add the raw token or creator user object here.
 */
export class WebhookDto {
  id: string;
  name: string;
  @ApiPropertyOptional()
  avatarUrl?: string | null;
  channelId: string;
  createdAt: Date;
}

/**
 * Returned only from the create endpoint. `url` embeds the raw token and is
 * shown to the caller exactly once — it is never persisted or returned again.
 */
export class CreateWebhookResponseDto extends WebhookDto {
  url: string;
}
