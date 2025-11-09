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
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from '@/auth/public.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import { RbacResource, RbacResourceType } from '@/auth/rbac-resource.decorator';
import { AuthenticatedRequest } from '@/types';

@Controller('users')
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
  @UseGuards(JwtAuthGuard)
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
  async getUserById(@Param('id') id: string): Promise<UserEntity> {
    const user = await this.userService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mapped = new UserEntity(user);
    return mapped;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
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
}
