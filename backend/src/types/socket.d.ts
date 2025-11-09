import { Socket as SocketIOSocket } from 'socket.io';
import { UserEntity } from '@/user/dto/user-response.dto';

export type AuthenticatedSocket = SocketIOSocket & {
  handshake: {
    user: UserEntity;
  };
};

export type OptionalAuthSocket = SocketIOSocket & {
  handshake: {
    user?: UserEntity;
  };
};
