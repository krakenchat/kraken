import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InstanceInvite, RbacActions } from '@prisma/client';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac-roles.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { UserEntity } from '@/user/dto/user-response.dto';

@Controller('invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}
  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.CREATE_INVITE)
  async createInvite(
    @Request() req: { user: UserEntity },
    @Body() dto: CreateInviteDto,
  ): Promise<InstanceInvite> {
    return this.inviteService.createInvite(
      req.user,
      dto.maxUses,
      dto.validUntil,
      dto.communityIds,
    );
  }
}
