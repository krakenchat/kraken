import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "../features/auth/authSlice";
import { usersApi } from "../features/users/usersSlice";
import { communityApi } from "../features/community/communityApiSlice";
import { channelApi } from "../features/channel/channelApiSlice";
import { messagesApi } from "../features/messages/messagesApiSlice";
import { rolesApi } from "../features/roles/rolesApiSlice";
import { livekitApi } from "../features/livekit/livekitApiSlice";
import { voicePresenceApi } from "../features/voice-presence/voicePresenceApiSlice";
import { presenceApi } from "../features/presence/presenceApiSlice";
import { membershipApi, channelMembershipApi } from "../features/membership";
import { inviteApi } from "../features/invite/inviteApiSlice";
import { publicInviteApi } from "../features/invite/publicInviteApiSlice";
import { onboardingApi } from "../features/onboarding/onboardingApiSlice";
import { directMessagesApi } from "../features/directMessages/directMessagesApiSlice";
import { readReceiptsApi } from "../features/readReceipts/readReceiptsApiSlice";
import messagesReducer from "../features/messages/messagesSlice";
import voiceReducer from "../features/voice/voiceSlice";
import readReceiptsReducer from "../features/readReceipts/readReceiptsSlice";

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
    [presenceApi.reducerPath]: presenceApi.reducer,
    [membershipApi.reducerPath]: membershipApi.reducer,
    [channelMembershipApi.reducerPath]: channelMembershipApi.reducer,
    [inviteApi.reducerPath]: inviteApi.reducer,
    [publicInviteApi.reducerPath]: publicInviteApi.reducer,
    [onboardingApi.reducerPath]: onboardingApi.reducer,
    [directMessagesApi.reducerPath]: directMessagesApi.reducer,
    [readReceiptsApi.reducerPath]: readReceiptsApi.reducer,
    messages: messagesReducer,
    voice: voiceReducer,
    readReceipts: readReceiptsReducer,
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
      presenceApi.middleware,
      membershipApi.middleware,
      channelMembershipApi.middleware,
      inviteApi.middleware,
      publicInviteApi.middleware,
      onboardingApi.middleware,
      directMessagesApi.middleware,
      readReceiptsApi.middleware
    ),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
