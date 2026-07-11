import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** No max length constant exists elsewhere in the codebase for message
 * content — 4000 mirrors common chat-app conventions (Discord uses 2000-4000
 * depending on tier) and is applied here per the webhooks brief. */
export const WEBHOOK_CONTENT_MAX_LENGTH = 4000;

export class ExecuteWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(WEBHOOK_CONTENT_MAX_LENGTH)
  content: string;
}
