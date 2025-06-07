export interface Channel {
  name: string;
  id: string;
  communityId: string;
  type: ChannelType;
  isPrivate: boolean;
  description?: string;
  createdAt: string;
}

export enum ChannelType {
  TEXT = "TEXT",
  VOICE = "VOICE",
}
