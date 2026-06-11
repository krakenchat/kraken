export { ChannelType } from '@semaphore-chat/shared';
// The API client's generated ChannelDto is the source of truth for channel
// objects returned by the backend (string-literal `type`, string dates).
export type { ChannelDto as Channel } from '../api-client/types.gen';
