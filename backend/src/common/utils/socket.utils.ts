import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { UserEntity } from '@/user/dto/user-response.dto';

/**
 * Type for socket with authenticated user
 */
export type AuthenticatedSocket = Socket & {
  handshake: {
    user: UserEntity;
  };
};

/**
 * Type for socket with optional user (before auth verification)
 */
export type OptionalAuthSocket = Socket & {
  handshake: {
    user?: UserEntity;
  };
};

/**
 * Safely extracts the authenticated user from a socket connection.
 * Throws WsException if user is not authenticated.
 *
 * @param client - The socket client
 * @returns The authenticated user entity
 * @throws WsException if user is not attached to socket
 *
 * @example
 * ```typescript
 * @SubscribeMessage('someEvent')
 * async handleEvent(@ConnectedSocket() client: Socket) {
 *   const user = getSocketUser(client);
 *   // user is guaranteed to be defined here
 * }
 * ```
 */
export function getSocketUser(client: Socket): UserEntity {
  const handshake = client.handshake as { user?: UserEntity };
  const user = handshake.user;

  if (!user) {
    throw new WsException('User not authenticated');
  }

  return user;
}

/**
 * Safely extracts the user ID from a socket connection.
 * Throws WsException if user is not authenticated.
 *
 * @param client - The socket client
 * @returns The user ID
 * @throws WsException if user is not attached to socket
 */
export function getSocketUserId(client: Socket): string {
  return getSocketUser(client).id;
}

/**
 * Type guard to check if a socket has an authenticated user.
 *
 * @param client - The socket client
 * @returns True if user is authenticated
 */
export function isAuthenticated(client: Socket): client is AuthenticatedSocket {
  const handshake = client.handshake as { user?: UserEntity };
  return !!handshake.user;
}
