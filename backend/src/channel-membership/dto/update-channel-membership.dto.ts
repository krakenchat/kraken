import { PartialType } from '@nestjs/swagger';
import { CreateChannelMembershipDto } from './create-channel-membership.dto';

// For channel memberships, updates are typically limited to role changes
// Users are either in a channel or not, so most operations are create/delete
export class UpdateChannelMembershipDto extends PartialType(
  CreateChannelMembershipDto,
) {}
