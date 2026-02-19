/**
 * Centralized room name construction for WebSocket rooms.
 *
 * Ensures consistent naming between:
 * - `RoomsService.joinAllUserRooms()` (initial socket connect)
 * - `RoomSubscriptionHandler` (mid-session subscription changes)
 * - Any service that sends events via `WebsocketService.sendToRoom()`
 *
 * Communities use a `community:` prefix; all other entities use raw IDs.
 */
export const RoomName = {
  user: (userId: string): string => userId,
  community: (communityId: string): string => `community:${communityId}`,
  channel: (channelId: string): string => channelId,
  dmGroup: (groupId: string): string => groupId,
  aliasGroup: (aliasGroupId: string): string => aliasGroupId,
} as const;
