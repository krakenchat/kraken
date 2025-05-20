export interface Channel {
  name: string;
  id: string;
  communityId: string;
  type: ChannelType;
}

export enum ChannelType {
  TEXT = "TEXT",
  VOICE = "VOICE",
}
