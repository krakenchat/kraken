import { Message } from "../../types/message.type";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MessagesState {
  messages: Message[];
  continuationToken?: string;
}

const initialState: MessagesState = {
  messages: [],
  continuationToken: undefined,
};

const MAX_MESSAGES = 1000;

const messagesSlice = createSlice({
  name: "messagesSlice",
  initialState,
  reducers: {
    appendMessages(
      state,
      action: PayloadAction<{ messages: Message[]; continuationToken?: string }>
    ) {
      // Append older messages (for pagination)
      state.messages = [...state.messages, ...action.payload.messages].slice(
        -MAX_MESSAGES
      );
      state.continuationToken = action.payload.continuationToken;
    },
    prependMessage(state, action: PayloadAction<Message>) {
      // Add new message from websocket
      state.messages = [action.payload, ...state.messages].slice(
        0,
        MAX_MESSAGES
      );
    },
    updateMessage(state, action: PayloadAction<Message>) {
      state.messages = state.messages.map((msg) =>
        msg.id === action.payload.id ? action.payload : msg
      );
    },
    deleteMessage(state, action: PayloadAction<string>) {
      state.messages = state.messages.filter(
        (msg) => msg.id !== action.payload
      );
    },
    clearMessages(state) {
      state.messages = [];
      state.continuationToken = undefined;
    },
  },
});

export const {
  appendMessages,
  prependMessage,
  updateMessage,
  deleteMessage,
  clearMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
