export interface Channel {
  name: string;
  id: string;
  communityId: string;
  type: ChannelType;
  isPrivate: boolean;
  createdAt: string;
  position?: number;
  slowmodeSeconds?: number;
}

export enum ChannelType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
}
