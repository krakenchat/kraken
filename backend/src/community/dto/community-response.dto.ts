export class CommunityResponseDto {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  createdAt: Date;
}
