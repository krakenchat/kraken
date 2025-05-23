import { Message } from "../types/message.type";

export interface AckPayload {
  id: string;
  [key: string]: unknown;
}

export interface ErrorPayload {
  message: string;
  code?: string | number;
  [key: string]: unknown;
}

export interface NewMessagePayload {
  message: Message;
}
export interface UpdateMessagePayload {
  message: Message;
}
export interface DeleteMessagePayload {
  id: string;
  channelId: string;
}

export type WebSocketEventPayloads = {
  newMessage: NewMessagePayload;
  updateMessage: UpdateMessagePayload;
  deleteMessage: DeleteMessagePayload;
  ack: AckPayload;
  error: ErrorPayload;
  // Add more as needed
};
