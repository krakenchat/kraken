import { Message } from "../../types/message.type";
import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";

/**
 * Container for messages in a conversation context.
 * A "context" can be either a channel or a DM group.
 */
interface ConversationMessages {
  messages: Message[];
  continuationToken?: string;
}

/**
 * Messages state organized by context ID.
 * The contextId can be either a channelId or a directMessageGroupId.
 */
interface MessagesState {
  /** Messages indexed by context ID (channel or DM group) */
  byContextId: {
    [contextId: string]: ConversationMessages;
  };
  /** Index for O(1) message lookup: messageId -> contextId */
  messageIndex: Record<string, string>;
}

const initialState: MessagesState = {
  byContextId: {},
  messageIndex: {},
};

const MAX_MESSAGES = 1000;

const messagesSlice = createSlice({
  name: "messagesSlice",
  initialState,
  reducers: {
    /**
     * Replace all messages for a context (used for initial loads)
     * @param contextId - Channel ID or DM group ID
     */
    setMessages(
      state,
      action: PayloadAction<{
        contextId: string;
        messages: Message[];
        continuationToken?: string;
      }>
    ) {
      const { contextId, messages, continuationToken } = action.payload;

      // Remove old messages from index
      const oldMessages = state.byContextId[contextId]?.messages || [];
      oldMessages.forEach((msg) => {
        delete state.messageIndex[msg.id];
      });

      // Add new messages to index
      const slicedMessages = messages.slice(-MAX_MESSAGES);
      slicedMessages.forEach((msg) => {
        state.messageIndex[msg.id] = contextId;
      });

      // Replace all messages for this context
      state.byContextId[contextId] = {
        messages: slicedMessages,
        continuationToken,
      };
    },
    /**
     * Append older messages (for pagination)
     * @param contextId - Channel ID or DM group ID
     */
    appendMessages(
      state,
      action: PayloadAction<{
        contextId: string;
        messages: Message[];
        continuationToken?: string;
      }>
    ) {
      const { contextId, messages, continuationToken } = action.payload;
      const existing = state.byContextId[contextId]?.messages || [];

      // Create a Set of existing message IDs for fast lookup
      const existingIds = new Set(existing.map((msg) => msg.id));

      // Filter out messages that already exist
      const newMessages = messages.filter((msg) => !existingIds.has(msg.id));

      // Add new messages to index
      newMessages.forEach((msg) => {
        state.messageIndex[msg.id] = contextId;
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

      state.byContextId[contextId] = {
        messages: combinedMessages,
        continuationToken,
      };
    },
    /**
     * Add a new message to the front (real-time messages)
     * @param contextId - Channel ID or DM group ID
     */
    prependMessage(
      state,
      action: PayloadAction<{ contextId: string; message: Message }>
    ) {
      const { contextId, message } = action.payload;
      const existing = state.byContextId[contextId]?.messages || [];

      // Check if message already exists
      const messageExists = existing.some((msg) => msg.id === message.id);
      if (messageExists) {
        return;
      }

      // Add new message to index
      state.messageIndex[message.id] = contextId;

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

      state.byContextId[contextId] = {
        ...state.byContextId[contextId],
        messages: combinedMessages,
      };
    },
    /**
     * Update an existing message (edits, reactions, etc.)
     * @param contextId - Channel ID or DM group ID
     */
    updateMessage(
      state,
      action: PayloadAction<{ contextId: string; message: Message }>
    ) {
      const { contextId, message } = action.payload;
      const existing = state.byContextId[contextId]?.messages || [];
      state.byContextId[contextId] = {
        ...state.byContextId[contextId],
        messages: existing.map((msg) =>
          msg.id === message.id ? message : msg
        ),
      };
    },
    /**
     * Remove a message
     * @param contextId - Channel ID or DM group ID
     */
    deleteMessage(
      state,
      action: PayloadAction<{ contextId: string; id: string }>
    ) {
      const { contextId, id } = action.payload;
      const existing = state.byContextId[contextId]?.messages || [];

      // Remove from index
      delete state.messageIndex[id];

      state.byContextId[contextId] = {
        ...state.byContextId[contextId],
        messages: existing.filter((msg) => msg.id !== id),
      };
    },
    /**
     * Clear all messages for a context
     * @param contextId - Channel ID or DM group ID
     */
    clearMessages(state, action: PayloadAction<{ contextId: string }>) {
      const { contextId } = action.payload;

      // Remove all messages for this context from index
      const messages = state.byContextId[contextId]?.messages || [];
      messages.forEach((msg) => {
        delete state.messageIndex[msg.id];
      });

      delete state.byContextId[contextId];
    },
  },
});

/**
 * Memoized selector factory for messages by context ID.
 * Works with both channel IDs and DM group IDs.
 * @example
 * const selectMessages = useMemo(() => makeSelectMessagesByContext(), []);
 * const messages = useAppSelector((state) => selectMessages(state, contextId));
 */
export const makeSelectMessagesByContext = () =>
  createSelector(
    [
      (state: RootState) => state.messages.byContextId,
      (_: RootState, contextId: string) => contextId,
    ],
    (byContextId, contextId) => byContextId[contextId]?.messages || []
  );

/**
 * Memoized selector factory for continuation token by context ID.
 * Works with both channel IDs and DM group IDs.
 */
export const makeSelectContinuationTokenByContext = () =>
  createSelector(
    [
      (state: RootState) => state.messages.byContextId,
      (_: RootState, contextId: string) => contextId,
    ],
    (byContextId, contextId) => byContextId[contextId]?.continuationToken
  );

/**
 * Selector for message index (O(1) message lookup).
 * Returns a map of messageId -> contextId.
 */
export const selectMessageIndex = (state: RootState) =>
  state.messages.messageIndex;

/**
 * Selector for raw byContextId state (used by WebSocket hooks).
 */
export const selectMessagesByContextId = (state: RootState) =>
  state.messages.byContextId;

export const {
  setMessages,
  appendMessages,
  prependMessage,
  updateMessage,
  deleteMessage,
  clearMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
