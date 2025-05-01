import { Community } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class CreateCommunityDto implements Community {
  avatar: string | null;
  banner: string | null;
  description: string | null;
  name: string;

  @Exclude()
  id: string;

  @Exclude()
  createdAt: Date;
}
