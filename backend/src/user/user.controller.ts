import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './dto/user-response.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async register(@Body() dto: CreateUserDto): Promise<UserEntity> {
    const user = new UserEntity(
      await this.userService.createUser(dto.username, dto.password, dto.email),
    );

    return user;
  }

  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserEntity> {
    const user = await this.userService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mapped = new UserEntity(user);
    return mapped;
  }
}
