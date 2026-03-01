import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@/user/user.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { extractTokenFromHandshake } from '@/common/utils/socket.utils';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.debug('WsJwtAuthGuard canActivate called');

    if (context.getType() !== 'ws') return true;
    const client = context.switchToWs().getClient<Socket>();

    // Short-circuit: user already authenticated by connection middleware
    if ((client.handshake as Record<string, any>).user) {
      return true;
    }

    const token = extractTokenFromHandshake(client.handshake);
    if (!token) {
      this.logger.warn(
        'No token provided in handshake. Ensure you are passing the token in the correct format.',
      );
      client.disconnect(true);
      return false;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.userService.findById(payload.sub);
      if (!user) throw new Error('User not found');
      (client.handshake as Record<string, any>).user = new UserEntity(user);
      return true;
    } catch (error) {
      this.logger.error('JWT verification failed', error);
      client.disconnect(true);
      return false;
    }
  }
}
