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
  // Index for O(1) message lookup: messageId -> channelId
  messageIndex: Record<string, string>;
}

const initialState: MessagesState = {
  byChannelId: {},
  messageIndex: {},
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

      // Remove old messages from index
      const oldMessages = state.byChannelId[channelId]?.messages || [];
      oldMessages.forEach((msg) => {
        delete state.messageIndex[msg.id];
      });

      // Add new messages to index
      const slicedMessages = messages.slice(-MAX_MESSAGES);
      slicedMessages.forEach((msg) => {
        state.messageIndex[msg.id] = channelId;
      });

      // Replace all messages for this channel (used for initial loads)
      state.byChannelId[channelId] = {
        messages: slicedMessages,
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

      // Add new messages to index
      newMessages.forEach((msg) => {
        state.messageIndex[msg.id] = channelId;
      });

      // Combine and slice
      const combinedMessages = [...existing, ...newMessages].slice(-MAX_MESSAGES);

      // Remove messages that were trimmed from the index
      if (combinedMessages.length < existing.length + newMessages.length) {
        const keptIds = new Set(combinedMessages.map((msg) => msg.id));
        [...existing, ...newMessages].forEach((msg) => {
          if (!keptIds.has(msg.id)) {
            delete state.messageIndex[msg.id];
          }
        });
      }

      state.byChannelId[channelId] = {
        messages: combinedMessages,
        continuationToken,
      };
    },
    prependMessage(
      state,
      action: PayloadAction<{ channelId: string; message: Message }>
    ) {
      const { channelId, message } = action.payload;
      const existing = state.byChannelId[channelId]?.messages || [];

      // Check if message already exists
      const messageExists = existing.some((msg) => msg.id === message.id);
      if (messageExists) {
        return;
      }

      // Add new message to index
      state.messageIndex[message.id] = channelId;

      // Combine and slice
      const combinedMessages = [message, ...existing].slice(0, MAX_MESSAGES);

      // Remove message that was trimmed from the index (last one if we exceeded MAX)
      if (combinedMessages.length > existing.length) {
        const keptIds = new Set(combinedMessages.map((msg) => msg.id));
        [...existing, message].forEach((msg) => {
          if (!keptIds.has(msg.id)) {
            delete state.messageIndex[msg.id];
          }
        });
      }

      state.byChannelId[channelId] = {
        ...state.byChannelId[channelId],
        messages: combinedMessages,
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

      // Remove from index
      delete state.messageIndex[id];

      state.byChannelId[channelId] = {
        ...state.byChannelId[channelId],
        messages: existing.filter((msg) => msg.id !== id),
      };
    },
    clearMessages(state, action: PayloadAction<{ channelId: string }>) {
      const { channelId } = action.payload;

      // Remove all messages for this channel from index
      const messages = state.byChannelId[channelId]?.messages || [];
      messages.forEach((msg) => {
        delete state.messageIndex[msg.id];
      });

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

// Memoized selector for continuation token by channelId
export const makeSelectContinuationTokenByChannel = () =>
  createSelector(
    [
      (state: RootState) => state.messages.byChannelId,
      (_: RootState, channelId: string) => channelId,
    ],
    (byChannelId, channelId) => byChannelId[channelId]?.continuationToken
  );

// Selector for message index (O(1) message lookup)
export const selectMessageIndex = (state: RootState) =>
  state.messages.messageIndex;

export const {
  setMessages,
  appendMessages,
  prependMessage,
  updateMessage,
  deleteMessage,
  clearMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
