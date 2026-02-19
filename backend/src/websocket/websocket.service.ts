import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  sendToRoom(room: string, event: string, payload: any): boolean {
    if (!this.server) {
      this.logger.error(
        'Attempted to send to room before server was initialized',
      );
      return false;
    }

    try {
      this.server.to(room).emit(event, payload);
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

  sendToAll(event: string, payload: any): boolean {
    if (!this.server) {
      this.logger.error(
        'Attempted to send to all before server was initialized',
      );
      return false;
    }

    try {
      this.server.emit(event, payload);
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
