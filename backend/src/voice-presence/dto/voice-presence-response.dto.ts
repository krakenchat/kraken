export class VoicePresenceUserDto {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: Date;
  isDeafened: boolean;
}

export class ChannelVoicePresenceResponseDto {
  channelId: string;
  users: VoicePresenceUserDto[];
  count: number;
}

export class DmVoicePresenceResponseDto {
  dmGroupId: string;
  users: VoicePresenceUserDto[];
  count: number;
}

export class RefreshPresenceResponseDto {
  success: boolean;
  message: string;
  channelId: string;
}

export class UserVoiceChannelsResponseDto {
  userId: string;
  voiceChannels: string[];
}
