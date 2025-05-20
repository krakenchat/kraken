import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebsocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  sendToRoom(room: string, event: string, payload: any) {
    console.log(`Sending to room ${room}:`, event, payload);
    if (!this.server.to(room).emit(event, payload)) {
      console.error(`Failed to send to room ${room}`);
    } else {
      console.log(`Successfully sent to room ${room}`);
    }
  }

  sendToAll(event: string, payload: any) {
    return this.server.emit(event, payload);
  }
}
