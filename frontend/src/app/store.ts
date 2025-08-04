import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "../features/auth/authSlice";
import { usersApi } from "../features/users/usersSlice";
import { communityApi } from "../features/community/communityApiSlice";
import { channelApi } from "../features/channel/channelApiSlice";
import { messagesApi } from "../features/messages/messagesApiSlice";
import { rolesApi } from "../features/roles/rolesApiSlice";
import { livekitApi } from "../features/livekit/livekitApiSlice";
import { voicePresenceApi } from "../features/voice-presence/voicePresenceApiSlice";
import { membershipApi, channelMembershipApi } from "../features/membership";
import { inviteApi } from "../features/invite/inviteApiSlice";
import messagesReducer from "../features/messages/messagesSlice";
import voiceReducer from "../features/voice/voiceSlice";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [communityApi.reducerPath]: communityApi.reducer,
    [channelApi.reducerPath]: channelApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
    [rolesApi.reducerPath]: rolesApi.reducer,
    [livekitApi.reducerPath]: livekitApi.reducer,
    [voicePresenceApi.reducerPath]: voicePresenceApi.reducer,
    [membershipApi.reducerPath]: membershipApi.reducer,
    [channelMembershipApi.reducerPath]: channelMembershipApi.reducer,
    [inviteApi.reducerPath]: inviteApi.reducer,
    messages: messagesReducer,
    voice: voiceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      usersApi.middleware,
      communityApi.middleware,
      channelApi.middleware,
      messagesApi.middleware,
      rolesApi.middleware,
      livekitApi.middleware,
      voicePresenceApi.middleware,
      membershipApi.middleware,
      channelMembershipApi.middleware,
      inviteApi.middleware
    ),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
