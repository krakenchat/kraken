import { PartialType } from '@nestjs/swagger';
import { CreateMembershipDto } from './create-membership.dto';

// Note: For membership, we typically don't update memberships after creation
// This DTO exists for consistency but may not be used in practice
export class UpdateMembershipDto extends PartialType(CreateMembershipDto) {}
