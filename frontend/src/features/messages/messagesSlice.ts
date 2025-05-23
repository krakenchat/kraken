import { Message } from "../../types/message.type";
import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";

interface ChannelMessages {
  messages: Message[];
  continuationToken?: string;
}

interface MessagesState {
  byChannelId: {
    [channelId: string]: ChannelMessages;
  };
}

const initialState: MessagesState = {
  byChannelId: {},
};

const MAX_MESSAGES = 1000;

const messagesSlice = createSlice({
  name: "messagesSlice",
  initialState,
  reducers: {
    setMessages(
      state,
      action: PayloadAction<{
        channelId: string;
        messages: Message[];
        continuationToken?: string;
      }>
    ) {
      const { channelId, messages, continuationToken } = action.payload;
      // Replace all messages for this channel (used for initial loads)
      state.byChannelId[channelId] = {
        messages: messages.slice(-MAX_MESSAGES),
        continuationToken,
      };
    },
    appendMessages(
      state,
      action: PayloadAction<{
        channelId: string;
        messages: Message[];
        continuationToken?: string;
      }>
    ) {
      const { channelId, messages, continuationToken } = action.payload;
      const existing = state.byChannelId[channelId]?.messages || [];

      // Create a Set of existing message IDs for fast lookup
      const existingIds = new Set(existing.map((msg) => msg.id));

      // Filter out messages that already exist
      const newMessages = messages.filter((msg) => !existingIds.has(msg.id));

      state.byChannelId[channelId] = {
        messages: [...existing, ...newMessages].slice(-MAX_MESSAGES),
        continuationToken,
      };
    },
    prependMessage(
      state,
      action: PayloadAction<{ channelId: string; message: Message }>
    ) {
      console.log("Prepend message", action.payload);
      const { channelId, message } = action.payload;
      const existing = state.byChannelId[channelId]?.messages || [];

      // Check if message already exists
      const messageExists = existing.some((msg) => msg.id === message.id);
      if (messageExists) {
        console.log("Message already exists, skipping prepend");
        return;
      }

      state.byChannelId[channelId] = {
        ...state.byChannelId[channelId],
        messages: [message, ...existing].slice(0, MAX_MESSAGES),
      };
    },
    updateMessage(
      state,
      action: PayloadAction<{ channelId: string; message: Message }>
    ) {
      const { channelId, message } = action.payload;
      const existing = state.byChannelId[channelId]?.messages || [];
      state.byChannelId[channelId] = {
        ...state.byChannelId[channelId],
        messages: existing.map((msg) =>
          msg.id === message.id ? message : msg
        ),
      };
    },
    deleteMessage(
      state,
      action: PayloadAction<{ channelId: string; id: string }>
    ) {
      const { channelId, id } = action.payload;
      const existing = state.byChannelId[channelId]?.messages || [];
      state.byChannelId[channelId] = {
        ...state.byChannelId[channelId],
        messages: existing.filter((msg) => msg.id !== id),
      };
    },
    clearMessages(state, action: PayloadAction<{ channelId: string }>) {
      const { channelId } = action.payload;
      delete state.byChannelId[channelId];
    },
  },
});

// Memoized selector for messages by channelId
export const makeSelectMessagesByChannel = () =>
  createSelector(
    [
      (state: RootState) => state.messages.byChannelId,
      (_: RootState, channelId: string) => channelId,
    ],
    (byChannelId, channelId) => byChannelId[channelId]?.messages || []
  );

export const {
  setMessages,
  appendMessages,
  prependMessage,
  updateMessage,
  deleteMessage,
  clearMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
