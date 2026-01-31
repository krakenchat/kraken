import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  NotFoundException,
  UseGuards,
  Query,
  ParseIntPipe,
  Patch,
  Req,
  Delete,
  DefaultValuePipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './dto/user-response.dto';
import { AdminUserEntity } from './dto/admin-user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { Public } from '@/auth/public.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { InstanceRole, RbacActions } from '@prisma/client';
import { RbacResource, RbacResourceType } from '@/auth/rbac-resource.decorator';
import { AuthenticatedRequest } from '@/types';
import { ParseObjectIdPipe } from 'nestjs-object-id';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Public()
  async register(@Body() dto: CreateUserDto): Promise<UserEntity> {
    const user = new UserEntity(
      await this.userService.createUser(
        dto.code,
        dto.username,
        dto.password,
        dto.email,
      ),
    );

    return user;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: AuthenticatedRequest): Promise<UserEntity> {
    const profile = await this.userService.findById(req.user.id);
    if (!profile) {
      // This should never happen but let's make the linter happy
      throw new NotFoundException('User not found');
    }

    return new UserEntity(profile);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserEntity> {
    return this.userService.updateProfile(req.user.id, updateProfileDto);
  }

  @Get('username/:name')
  @UseGuards(JwtAuthGuard)
  async getUserByName(@Param('name') username: string): Promise<UserEntity> {
    const user = await this.userService.findByUsername(username);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mapped = new UserEntity(user);
    return mapped;
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_USER)
  @RbacResource({
    type: RbacResourceType.INSTANCE,
  })
  searchUsers(
    @Query('q') query: string,
    @Query('communityId') communityId?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ): Promise<UserEntity[]> {
    return this.userService.searchUsers(query, communityId, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserById(@Param('id', ParseObjectIdPipe) id: string): Promise<UserEntity> {
    const user = await this.userService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mapped = new UserEntity(user);
    return mapped;
  }

  @Get()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_USER)
  @RbacResource({
    type: RbacResourceType.INSTANCE,
  })
  findAllUsers(
    @Query('limit', ParseIntPipe) limit?: number,
    @Query('continuationToken') continuationToken?: string,
  ): Promise<{ users: UserEntity[]; continuationToken?: string }> {
    return this.userService.findAll(limit, continuationToken);
  }

  // ============================================
  // Admin User Management Endpoints
  // ============================================

  /**
   * Get all users with admin-level details (includes ban status)
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async findAllUsersAdmin(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('continuationToken') continuationToken?: string,
    @Query('banned', new DefaultValuePipe(undefined)) banned?: string,
    @Query('role') role?: InstanceRole,
    @Query('search') search?: string,
  ): Promise<{ users: AdminUserEntity[]; continuationToken?: string }> {
    const filters = {
      banned: banned === 'true' ? true : banned === 'false' ? false : undefined,
      role,
      search,
    };
    return this.userService.findAllAdmin(limit, continuationToken, filters);
  }

  /**
   * Get a single user with admin-level details
   */
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getUserByIdAdmin(@Param('id', ParseObjectIdPipe) id: string): Promise<AdminUserEntity> {
    const user = await this.userService.findByIdAdmin(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Update a user's instance role (OWNER/USER)
   */
  @Patch('admin/:id/role')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.UPDATE_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async updateUserRole(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<AdminUserEntity> {
    return this.userService.updateUserRole(id, dto.role, req.user.id);
  }

  /**
   * Ban or unban a user
   */
  @Patch('admin/:id/ban')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.BAN_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async setBanStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: BanUserDto,
  ): Promise<AdminUserEntity> {
    return this.userService.setBanStatus(id, dto.banned, req.user.id);
  }

  /**
   * Delete a user account (admin action)
   */
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.DELETE_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async deleteUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.userService.deleteUser(id, req.user.id);
    return { success: true };
  }

  // ============================================
  // User Blocking Endpoints
  // ============================================

  /**
   * Block a user
   */
  @Post('block/:userId')
  @UseGuards(JwtAuthGuard)
  async blockUser(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ): Promise<{ success: boolean }> {
    await this.userService.blockUser(req.user.id, userId);
    return { success: true };
  }

  /**
   * Unblock a user
   */
  @Delete('block/:userId')
  @UseGuards(JwtAuthGuard)
  async unblockUser(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ): Promise<{ success: boolean }> {
    await this.userService.unblockUser(req.user.id, userId);
    return { success: true };
  }

  /**
   * Get list of blocked users
   */
  @Get('blocked')
  @UseGuards(JwtAuthGuard)
  async getBlockedUsers(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserEntity[]> {
    return this.userService.getBlockedUsers(req.user.id);
  }

  /**
   * Check if a specific user is blocked
   */
  @Get('blocked/:userId')
  @UseGuards(JwtAuthGuard)
  async isUserBlocked(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ): Promise<{ blocked: boolean }> {
    const blocked = await this.userService.isUserBlocked(req.user.id, userId);
    return { blocked };
  }
}
