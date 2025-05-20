import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebsocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  sendToRoom(room: string, event: string, payload: any) {
    this.server.to(room).emit(event, payload);
  }

  sendToAll(event: string, payload: any) {
    return this.server.emit(event, payload);
  }
}
