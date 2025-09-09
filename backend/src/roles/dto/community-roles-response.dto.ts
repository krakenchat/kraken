import { RoleDto } from './user-roles-response.dto';

export class CommunityRolesResponseDto {
  communityId: string;
  roles: RoleDto[];
}
