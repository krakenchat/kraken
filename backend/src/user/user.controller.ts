import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/postgres-client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async register(
    @Body() dto: CreateUserDto,
  ): Promise<Omit<User, 'hashedPassword'>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword, ...created } = await this.userService.createUser(
      dto.username,
      dto.password,
      dto.email,
    );
    return created;
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}
