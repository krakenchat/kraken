import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Request,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './dto/user-response.dto';
import { Public } from 'src/auth/public.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Public()
  async register(@Body() dto: CreateUserDto): Promise<UserEntity> {
    const user = new UserEntity(
      await this.userService.createUser(dto.username, dto.password, dto.email),
    );

    return user;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @Request() req: { user: { id: string } },
  ): Promise<UserEntity> {
    const profile = await this.userService.findById(req.user.id);
    if (!profile) {
      // This should never happen but let's make the linter happy
      throw new NotFoundException('User not found');
    }

    return new UserEntity(profile);
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
}
