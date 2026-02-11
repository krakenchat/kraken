import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@/types';
import {
  FriendUserDto,
  FriendshipDto,
  PendingRequestsDto,
  FriendshipStatusDto,
} from './dto/friends-response.dto';
import { SuccessResponseDto } from '@/common/dto/common-response.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  /**
   * Get all friends for the current user
   */
  @Get()
  @ApiOkResponse({ type: [FriendUserDto] })
  async getFriends(@Req() req: AuthenticatedRequest): Promise<FriendUserDto[]> {
    return this.friendsService.getFriends(req.user.id);
  }

  /**
   * Get pending friend requests (sent and received)
   */
  @Get('requests')
  @ApiOkResponse({ type: PendingRequestsDto })
  async getPendingRequests(
    @Req() req: AuthenticatedRequest,
  ): Promise<PendingRequestsDto> {
    return this.friendsService.getPendingRequests(req.user.id);
  }

  /**
   * Get friendship status with a specific user
   */
  @Get('status/:userId')
  @ApiOkResponse({ type: FriendshipStatusDto })
  async getFriendshipStatus(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<FriendshipStatusDto> {
    return this.friendsService.getFriendshipStatus(req.user.id, userId);
  }

  /**
   * Send a friend request to a user
   */
  @Post('request/:userId')
  @ApiCreatedResponse({ type: FriendshipDto })
  async sendFriendRequest(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<FriendshipDto> {
    return this.friendsService.sendFriendRequest(req.user.id, userId);
  }

  /**
   * Accept a friend request
   */
  @Post('accept/:id')
  @ApiCreatedResponse({ type: FriendshipDto })
  async acceptFriendRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ): Promise<FriendshipDto> {
    return this.friendsService.acceptFriendRequest(req.user.id, friendshipId);
  }

  /**
   * Decline a friend request
   */
  @Delete('decline/:id')
  @ApiOkResponse({ type: SuccessResponseDto })
  async declineFriendRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ): Promise<{ success: boolean }> {
    await this.friendsService.declineFriendRequest(req.user.id, friendshipId);
    return { success: true };
  }

  /**
   * Cancel a sent friend request
   */
  @Delete('cancel/:id')
  @ApiOkResponse({ type: SuccessResponseDto })
  async cancelFriendRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ): Promise<{ success: boolean }> {
    await this.friendsService.cancelFriendRequest(req.user.id, friendshipId);
    return { success: true };
  }

  /**
   * Remove a friend (unfriend)
   */
  @Delete(':id')
  @ApiOkResponse({ type: SuccessResponseDto })
  async removeFriend(
    @Req() req: AuthenticatedRequest,
    @Param('id') friendshipId: string,
  ): Promise<{ success: boolean }> {
    await this.friendsService.removeFriend(req.user.id, friendshipId);
    return { success: true };
  }
}
