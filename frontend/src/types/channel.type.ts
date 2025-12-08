export interface Channel {
  name: string;
  id: string;
  communityId: string;
  type: ChannelType;
  isPrivate: boolean;
  description?: string;
  createdAt: string;
  position?: number;
  slowmodeSeconds?: number;
}

export enum ChannelType {
  TEXT = "TEXT",
  VOICE = "VOICE",
}
