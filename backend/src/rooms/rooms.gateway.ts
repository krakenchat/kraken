import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { RoomsService } from './rooms.service';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseFilters,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RbacGuard } from '@/auth/rbac.guard';
import { WebsocketService } from '@/websocket/websocket.service';
import { UserService } from '@/user/user.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { ClientEvents } from '@kraken/shared';
import { WsLoggingExceptionFilter } from '@/websocket/ws-exception.filter';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { WsThrottleGuard } from '@/auth/ws-throttle.guard';
import {
  getSocketUser,
  AuthenticatedSocket,
} from '@/common/utils/socket.utils';
import { WsException } from '@nestjs/websockets';

@UseFilters(WsLoggingExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(WsThrottleGuard, WsJwtAuthGuard, RbacGuard)
export class RoomsGateway implements OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(RoomsGateway.name);
  private readonly connectionAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  static readonly RATE_LIMIT_MAX = 10;
  static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly websocketService: WebsocketService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  afterInit(server: Server) {
    this.websocketService.setServer(server);

    // Rate-limiting middleware — runs before auth
    server.use((socket, next) => {
      const ip = socket.handshake.address;
      const now = Date.now();
      const entry = this.connectionAttempts.get(ip);

      if (entry && now < entry.resetAt) {
        entry.count++;
        if (entry.count > RoomsGateway.RATE_LIMIT_MAX) {
          this.logger.warn(
            `Rate limited connection from ${ip} (${entry.count} attempts)`,
          );
          return next(new Error('RATE_LIMITED'));
        }
      } else {
        // New window or expired — reset
        this.connectionAttempts.set(ip, {
          count: 1,
          resetAt: now + RoomsGateway.RATE_LIMIT_WINDOW_MS,
        });
      }

      next();
    });

    // Auth middleware — validates JWT and attaches user before connection
    server.use(async (socket, next) => {
      try {
        let token: string | undefined =
          typeof socket.handshake.auth?.token === 'string'
            ? socket.handshake.auth.token
            : typeof socket.handshake.headers?.authorization === 'string'
              ? (socket.handshake.headers.authorization as string)
              : undefined;

        if (!token) {
          return next(new Error('AUTH_FAILED'));
        }

        if (token.startsWith('Bearer ')) {
          token = token.split('Bearer ')[1];
        }

        const payload = this.jwtService.verify<{ sub: string }>(token);
        const user = await this.userService.findById(payload.sub);

        if (!user) {
          return next(new Error('AUTH_FAILED'));
        }

        (socket.handshake as Record<string, any>).user = new UserEntity(user);
        next();
      } catch {
        next(new Error('AUTH_FAILED'));
      }
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(ClientEvents.SUBSCRIBE_ALL)
  async subscribeAll(@ConnectedSocket() client: Socket) {
    const user = getSocketUser(client);
    this.logger.debug(`User ${user.id} subscribing to all rooms`);
    return this.roomsService.joinAllUserRooms(client as AuthenticatedSocket);
  }
}
