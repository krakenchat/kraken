import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InviteService } from './invite.service';
import { RbacActions } from '@prisma/client';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteResponseDto } from './dto/invite-response.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacResource, RbacResourceType } from '@/auth/rbac-resource.decorator';
import { AuthenticatedRequest } from '@/types';

@Controller('invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.CREATE_INSTANCE_INVITE)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async createInvite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInviteDto,
  ): Promise<InviteResponseDto> {
    return this.inviteService.createInvite(
      req.user,
      dto.maxUses,
      dto.validUntil,
      dto.communityIds,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_INSTANCE_INVITE)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getInvites(
    @Req() req: AuthenticatedRequest,
  ): Promise<InviteResponseDto[]> {
    return this.inviteService.getInvites(req.user);
  }

  @Get('public/:code')
  async getPublicInvite(
    @Param('code') code: string,
  ): Promise<InviteResponseDto | null> {
    return this.inviteService.getInviteByCode(code);
  }

  @Get(':code')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_INSTANCE_INVITE)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getInvite(@Param('code') code: string): Promise<InviteResponseDto | null> {
    return this.inviteService.getInviteByCode(code);
  }

  @Delete(':code')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.DELETE_INSTANCE_INVITE)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async deleteInvite(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
  ): Promise<void> {
    return this.inviteService.deleteInvite(req.user, code);
  }
}
