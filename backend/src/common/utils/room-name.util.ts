/**
 * Centralized room name construction for WebSocket rooms.
 *
 * Ensures consistent naming between:
 * - `RoomsService.joinAllUserRooms()` (initial socket connect)
 * - `RoomSubscriptionHandler` (mid-session subscription changes)
 * - Any service that sends events via `WebsocketService.sendToRoom()`
 *
 * Prefixed entities: `community:`, `user:`, `dm:`.
 * Raw IDs: channels, alias groups (used directly as room IDs).
 */
export const RoomName = {
  user: (userId: string): string => `user:${userId}`,
  community: (communityId: string): string => `community:${communityId}`,
  channel: (channelId: string): string => channelId,
  dmGroup: (groupId: string): string => `dm:${groupId}`,
  aliasGroup: (aliasGroupId: string): string => aliasGroupId,
} as const;
