import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { User } from '@prisma/postgres-client';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: { user: Omit<User, 'hashedPassword'> }) {
    return req.user;
  }

  @UseGuards(LocalAuthGuard)
  @Post('logout')
  logout(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return req.logout();
  }
}
