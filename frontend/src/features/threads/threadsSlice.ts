import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import { Message } from "../../types/message.type";

/**
 * State for thread replies for a specific parent message
 */
interface ThreadReplies {
  replies: Message[];
  continuationToken?: string;
  isLoading: boolean;
}

/**
 * Threads state
 */
interface ThreadsState {
  /** Currently open thread parent message ID */
  openThreadId: string | null;
  /** Thread replies indexed by parent message ID */
  byParentId: {
    [parentMessageId: string]: ThreadReplies;
  };
  /** User subscription status for threads */
  subscriptions: Record<string, boolean>;
}

const initialState: ThreadsState = {
  openThreadId: null,
  byParentId: {},
  subscriptions: {},
};

const threadsSlice = createSlice({
  name: "threads",
  initialState,
  reducers: {
    /**
     * Open a thread panel for a parent message
     */
    openThread(state, action: PayloadAction<string>) {
      state.openThreadId = action.payload;
    },

    /**
     * Close the thread panel
     */
    closeThread(state) {
      state.openThreadId = null;
    },

    /**
     * Set loading state for a thread
     */
    setThreadLoading(
      state,
      action: PayloadAction<{ parentMessageId: string; isLoading: boolean }>
    ) {
      const { parentMessageId, isLoading } = action.payload;
      if (!state.byParentId[parentMessageId]) {
        state.byParentId[parentMessageId] = {
          replies: [],
          isLoading,
        };
      } else {
        state.byParentId[parentMessageId].isLoading = isLoading;
      }
    },

    /**
     * Set replies for a thread (initial load)
     */
    setThreadReplies(
      state,
      action: PayloadAction<{
        parentMessageId: string;
        replies: Message[];
        continuationToken?: string;
      }>
    ) {
      const { parentMessageId, replies, continuationToken } = action.payload;
      state.byParentId[parentMessageId] = {
        replies,
        continuationToken,
        isLoading: false,
      };
    },

    /**
     * Append more replies to a thread (pagination)
     */
    appendThreadReplies(
      state,
      action: PayloadAction<{
        parentMessageId: string;
        replies: Message[];
        continuationToken?: string;
      }>
    ) {
      const { parentMessageId, replies, continuationToken } = action.payload;
      const thread = state.byParentId[parentMessageId];
      if (thread) {
        // Append to existing replies (replies come oldest first, so append at end)
        thread.replies = [...thread.replies, ...replies];
        thread.continuationToken = continuationToken;
        thread.isLoading = false;
      }
    },

    /**
     * Add a new reply to a thread (real-time via WebSocket)
     */
    addThreadReply(
      state,
      action: PayloadAction<{
        parentMessageId: string;
        reply: Message;
      }>
    ) {
      const { parentMessageId, reply } = action.payload;
      if (!state.byParentId[parentMessageId]) {
        state.byParentId[parentMessageId] = {
          replies: [reply],
          isLoading: false,
        };
      } else {
        // Add to end since replies are sorted oldest to newest
        state.byParentId[parentMessageId].replies.push(reply);
      }
    },

    /**
     * Update a reply in a thread
     */
    updateThreadReply(
      state,
      action: PayloadAction<{
        parentMessageId: string;
        reply: Message;
      }>
    ) {
      const { parentMessageId, reply } = action.payload;
      const thread = state.byParentId[parentMessageId];
      if (thread) {
        const index = thread.replies.findIndex((r) => r.id === reply.id);
        if (index !== -1) {
          thread.replies[index] = reply;
        }
      }
    },

    /**
     * Delete a reply from a thread
     */
    deleteThreadReply(
      state,
      action: PayloadAction<{
        parentMessageId: string;
        replyId: string;
      }>
    ) {
      const { parentMessageId, replyId } = action.payload;
      const thread = state.byParentId[parentMessageId];
      if (thread) {
        thread.replies = thread.replies.filter((r) => r.id !== replyId);
      }
    },

    /**
     * Set subscription status for a thread
     */
    setSubscription(
      state,
      action: PayloadAction<{
        parentMessageId: string;
        isSubscribed: boolean;
      }>
    ) {
      const { parentMessageId, isSubscribed } = action.payload;
      state.subscriptions[parentMessageId] = isSubscribed;
    },

    /**
     * Clear thread data (for cleanup)
     */
    clearThread(state, action: PayloadAction<string>) {
      delete state.byParentId[action.payload];
      delete state.subscriptions[action.payload];
    },
  },
});

export const {
  openThread,
  closeThread,
  setThreadLoading,
  setThreadReplies,
  appendThreadReplies,
  addThreadReply,
  updateThreadReply,
  deleteThreadReply,
  setSubscription,
  clearThread,
} = threadsSlice.actions;

export default threadsSlice.reducer;

// Selectors
export const selectOpenThreadId = (state: RootState) => state.threads.openThreadId;

export const selectThreadReplies = (parentMessageId: string) =>
  createSelector(
    (state: RootState) => state.threads.byParentId[parentMessageId],
    (thread) => thread?.replies || []
  );

export const selectThreadLoading = (parentMessageId: string) =>
  createSelector(
    (state: RootState) => state.threads.byParentId[parentMessageId],
    (thread) => thread?.isLoading || false
  );

export const selectThreadContinuationToken = (parentMessageId: string) =>
  createSelector(
    (state: RootState) => state.threads.byParentId[parentMessageId],
    (thread) => thread?.continuationToken
  );

export const selectIsSubscribed = (parentMessageId: string) =>
  createSelector(
    (state: RootState) => state.threads.subscriptions[parentMessageId],
    (isSubscribed) => isSubscribed || false
  );
