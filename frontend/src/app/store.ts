import { configureStore } from "@reduxjs/toolkit";
import voiceReducer from "../features/voice/voiceSlice";
import readReceiptsReducer from "../features/readReceipts/readReceiptsSlice";
import notificationsReducer from "../features/notifications/notificationsSlice";
import threadsReducer from "../features/threads/threadsSlice";

export const store = configureStore({
  reducer: {
    voice: voiceReducer,
    readReceipts: readReceiptsReducer,
    notifications: notificationsReducer,
    threads: threadsReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
