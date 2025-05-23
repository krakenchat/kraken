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
      state.byChannelId[channelId] = {
        messages: [...existing, ...messages].slice(-MAX_MESSAGES),
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
  appendMessages,
  prependMessage,
  updateMessage,
  deleteMessage,
  clearMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
