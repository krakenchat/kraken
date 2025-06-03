import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "../features/auth/authSlice";
import { usersApi } from "../features/users/usersSlice";
import { communityApi } from "../features/community/communityApiSlice";
import { channelApi } from "../features/channel/channelApiSlice";
import { messagesApi } from "../features/messages/messagesApiSlice";
import { rolesApi } from "../features/roles/rolesApiSlice";
import messagesReducer from "../features/messages/messagesSlice";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [communityApi.reducerPath]: communityApi.reducer,
    [channelApi.reducerPath]: channelApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
    [rolesApi.reducerPath]: rolesApi.reducer,
    messages: messagesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      usersApi.middleware,
      communityApi.middleware,
      channelApi.middleware,
      messagesApi.middleware,
      rolesApi.middleware
    ),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
