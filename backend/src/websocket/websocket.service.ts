import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@semaphore-chat/shared';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);
  private server: AppServer;

  setServer(server: AppServer) {
    this.server = server;
  }

  sendToRoom<E extends keyof ServerToClientEvents>(
    room: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): boolean {
    if (!this.server) {
      this.logger.error(
        'Attempted to send to room before server was initialized',
      );
      return false;
    }

    try {
      this.server.to(room).emit(event, ...args);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send event "${event}" to room "${room}"`,
        error,
      );
      return false;
    }
  }

  /**
   * Join all sockets in `sourceRoom` to the given rooms.
   * Typically sourceRoom is a userId (every user joins their own room on connect).
   */
  joinSocketsToRoom(sourceRoom: string, rooms: string | string[]): void {
    if (!this.server) {
      this.logger.error(
        'Attempted to join sockets before server was initialized',
      );
      return;
    }

    try {
      this.server.in(sourceRoom).socketsJoin(rooms);
    } catch (error) {
      this.logger.error(
        `Failed to join sockets in "${sourceRoom}" to rooms`,
        error,
      );
    }
  }

  /**
   * Remove all sockets in `sourceRoom` from the given rooms.
   * Symmetric counterpart to `joinSocketsToRoom()`.
   */
  removeSocketsFromRoom(sourceRoom: string, rooms: string | string[]): void {
    if (!this.server) {
      this.logger.error(
        'Attempted to remove sockets before server was initialized',
      );
      return;
    }

    try {
      this.server.in(sourceRoom).socketsLeave(rooms);
    } catch (error) {
      this.logger.error(
        `Failed to remove sockets in "${sourceRoom}" from rooms`,
        error,
      );
    }
  }

  sendToAll<E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): boolean {
    if (!this.server) {
      this.logger.error(
        'Attempted to send to all before server was initialized',
      );
      return false;
    }

    try {
      this.server.emit(event, ...args);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send event "${event}" to all clients`,
        error,
      );
      return false;
    }
  }
}
