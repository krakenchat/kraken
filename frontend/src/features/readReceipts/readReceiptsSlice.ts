import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UnreadCount } from "../../types/read-receipt.type";
import { RootState } from "../../app/store";

interface ReadReceiptState {
  channelId?: string;
  directMessageGroupId?: string;
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;
}

interface ReadReceiptsState {
  byId: {
    [key: string]: ReadReceiptState; // key is channelId or directMessageGroupId
  };
}

const initialState: ReadReceiptsState = {
  byId: {},
};

const readReceiptsSlice = createSlice({
  name: "readReceipts",
  initialState,
  reducers: {
    setUnreadCounts: (state, action: PayloadAction<UnreadCount[]>) => {
      action.payload.forEach((count) => {
        const id = count.channelId || count.directMessageGroupId;
        if (id) {
          state.byId[id] = {
            channelId: count.channelId,
            directMessageGroupId: count.directMessageGroupId,
            unreadCount: count.unreadCount,
            lastReadMessageId: count.lastReadMessageId,
            lastReadAt: count.lastReadAt,
          };
        }
      });
    },

    updateUnreadCount: (state, action: PayloadAction<UnreadCount>) => {
      const id =
        action.payload.channelId || action.payload.directMessageGroupId;
      if (id) {
        state.byId[id] = {
          channelId: action.payload.channelId,
          directMessageGroupId: action.payload.directMessageGroupId,
          unreadCount: action.payload.unreadCount,
          lastReadMessageId: action.payload.lastReadMessageId,
          lastReadAt: action.payload.lastReadAt,
        };
      }
    },

    markAsRead: (
      state,
      action: PayloadAction<{
        channelId?: string;
        directMessageGroupId?: string;
        lastReadMessageId: string;
      }>
    ) => {
      const id = action.payload.channelId || action.payload.directMessageGroupId;
      if (id) {
        state.byId[id] = {
          channelId: action.payload.channelId,
          directMessageGroupId: action.payload.directMessageGroupId,
          unreadCount: 0,
          lastReadMessageId: action.payload.lastReadMessageId,
          lastReadAt: new Date(),
        };
      }
    },

    incrementUnreadCount: (
      state,
      action: PayloadAction<{ channelId?: string; directMessageGroupId?: string }>
    ) => {
      const id = action.payload.channelId || action.payload.directMessageGroupId;
      if (id) {
        if (!state.byId[id]) {
          state.byId[id] = {
            channelId: action.payload.channelId,
            directMessageGroupId: action.payload.directMessageGroupId,
            unreadCount: 1,
          };
        } else {
          state.byId[id].unreadCount += 1;
        }
      }
    },

    resetUnreadCount: (
      state,
      action: PayloadAction<{ channelId?: string; directMessageGroupId?: string }>
    ) => {
      const id = action.payload.channelId || action.payload.directMessageGroupId;
      if (id && state.byId[id]) {
        state.byId[id].unreadCount = 0;
      }
    },
  },
});

export const {
  setUnreadCounts,
  updateUnreadCount,
  markAsRead,
  incrementUnreadCount,
  resetUnreadCount,
} = readReceiptsSlice.actions;

export default readReceiptsSlice.reducer;

// Selectors
export const selectUnreadCount = (
  state: RootState,
  id?: string
): number => {
  if (!id) return 0;
  return state.readReceipts.byId[id]?.unreadCount || 0;
};

export const selectLastReadMessageId = (
  state: RootState,
  id?: string
): string | undefined => {
  if (!id) return undefined;
  return state.readReceipts.byId[id]?.lastReadMessageId;
};

export const selectHasUnread = (
  state: RootState,
  id?: string
): boolean => {
  if (!id) return false;
  return (state.readReceipts.byId[id]?.unreadCount || 0) > 0;
};

export const selectAllUnreadCounts = (
  state: RootState
): { [key: string]: number } => {
  const counts: { [key: string]: number } = {};
  Object.entries(state.readReceipts.byId).forEach(([id, receipt]) => {
    counts[id] = receipt.unreadCount;
  });
  return counts;
};
