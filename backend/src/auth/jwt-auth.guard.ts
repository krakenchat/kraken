import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  // Support extracting JWT from WebSocket handshake
  getRequest(context: ExecutionContext): Record<string, any> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Record<string, any>>();
      return req;
    }
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient<Record<string, any>>();
      if (
        client &&
        typeof client === 'object' &&
        'handshake' in client &&
        typeof client.handshake === 'object'
      ) {
        const handshake = client.handshake as {
          headers?: Record<string, string>;
          query?: Record<string, string>;
        };
        const authHeader = handshake.headers?.authorization;
        if (
          authHeader &&
          typeof authHeader === 'string' &&
          authHeader.startsWith('Bearer ')
        ) {
          return handshake;
        }
        if (
          handshake.query?.token &&
          typeof handshake.query.token === 'string'
        ) {
          handshake.headers = handshake.headers || {};
          handshake.headers.authorization = `Bearer ${handshake.query.token}`;
          return handshake;
        }
        return handshake;
      }
      return {};
    }
    return {};
  }
}
