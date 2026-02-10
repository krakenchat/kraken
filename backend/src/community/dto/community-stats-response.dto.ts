export class CommunityStatsDto {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  createdAt: Date;
  memberCount: number;
  channelCount: number;
}

export class CommunityStatsDetailDto extends CommunityStatsDto {
  messageCount: number;
}

export class CommunityStatsListResponseDto {
  communities: CommunityStatsDto[];
  continuationToken?: string;
}
