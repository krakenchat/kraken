import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';
import { UserEntity } from 'src/user/dto/user-response.dto';

@Controller('auth')
export class AuthController {
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: { user: UserEntity }) {
    return new UserEntity(req.user);
  }

  @UseGuards(LocalAuthGuard)
  @Post('logout')
  logout(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return req.logout();
  }
}
