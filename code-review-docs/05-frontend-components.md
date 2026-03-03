# 05 — Frontend Component Inventory

> **~175 React components** across **188 `.tsx` files** — components, pages, providers, and layouts.

---

## Table of Contents

- [Summary](#summary)
- [Root / App Level (3)](#root--app-level-3)
- [Auth & Route Guards (4)](#auth--route-guards-4)
- [Pages (22)](#pages-22)
- [Channel (5)](#channel-5)
- [Common (6)](#common-6)
- [Community (21)](#community-21)
- [CommunityList (3)](#communitylist-3)
- [DirectMessage — Voice (3)](#directmessage--voice-3)
- [DirectMessages — Chat (5)](#directmessages--chat-5)
- [Electron (2)](#electron-2)
- [Friends (6)](#friends-6)
- [Message (30)](#message-30)
- [Mobile (18)](#mobile-18)
- [Moderation (8)](#moderation-8)
- [Navbar (2)](#navbar-2)
- [Notifications (2)](#notifications-2)
- [Onboarding (6)](#onboarding-6)
- [Profile (7)](#profile-7)
- [PWA (1)](#pwa-1)
- [Settings (4)](#settings-4)
- [ThemeToggle (1)](#themetoggle-1)
- [Thread (3)](#thread-3)
- [Voice (14)](#voice-14)
- [Context Providers (13)](#context-providers-13)
- [Utility Components (2)](#utility-components-2)

---

## Summary

```
Message    ██████████████████████████████████ 30 (17%)
Pages      █████████████████████████          22 (13%)
Community  ████████████████████████           21 (12%)
Mobile     █████████████████████              18 (10%)
Voice      ████████████████                   14  (8%)
Providers  ███████████████                    13  (7%)
Moderation █████████████                       8  (5%)
Profile    ██████████                          7  (4%)
Friends    ████████                            6  (4%)
Common     ████████                            6  (3%)
Onboarding ████████                            6  (3%)
Channel    ██████                              5  (3%)
DMessages  ██████                              5  (3%)
Settings   █████                               4  (2%)
Others     ████████████                       10  (6%)
```

### By type

| Type | Count | Description |
|------|-------|-------------|
| Page/Route | 22 | Top-level route targets (`pages/`) |
| Layout | 7 | `App`, `Layout`, `MobileLayout`, `TabletLayout`, `AdminLayout`, `TwoColumnLayout`, `CommunityFormLayout` |
| Provider | 13 | Context providers that render children |
| Feature | ~90 | Domain-specific, coupled to API/business logic |
| Shared/Reusable | ~35 | Generic UI building blocks |

---

## Root / App Level (3)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `App.tsx` | `App` | Route layout | Root component; defines all React Router routes, wraps with `ThemeProvider`, mounts `AuthGate`, `AutoUpdater`, `PWAInstallPrompt`, Electron `ConnectionWizard` |
| `Layout.tsx` | `Layout`, `LayoutContentArea`, `LayoutHooksBridge` | Layout | Desktop app shell: `AppBar`, `CommunityToggle` sidebar, `Outlet` content area, `VoiceBottomBar`, `AudioRenderer`, `PersistentVideoOverlay`; responsive branching to `MobileLayout`/`TabletLayout` |
| `main.tsx` | _(entry point)_ | Entry | Bootstraps React root with `QueryClientProvider` + `HashRouter` |

---

## Auth & Route Guards (4)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/AuthGate.tsx` | `AuthGate` | Route guard | Validates JWT, handles silent refresh, checks onboarding status; mounts all authenticated providers (`SocketProvider`, `VoiceProvider`, `NotificationProvider`, etc.) and renders `<Outlet>` |
| `components/PublicRoute.tsx` | `PublicRoute` | Route guard | Wraps public routes (`/login`, `/register`); redirects authenticated users to `/` |
| `components/ConnectionStatusBanner.tsx` | `ConnectionStatusBanner` | Shared | Fixed-position chip when Socket.IO is disconnecting/reconnecting |
| `components/ErrorBoundary.tsx` | `ErrorBoundary` | Shared | Class-based React error boundary; catches render errors, shows fallback UI, reports to telemetry |

---

## Pages (22)

### Main Pages (15)

| File | Component | Purpose |
|------|-----------|---------|
| `pages/LoginPage.tsx` | `LoginPage` | Login form: username + password, calls auth API, stores token, navigates to `/` |
| `pages/RegisterPage.tsx` | `RegisterPage` | Self-registration form: username, display name, password; OR instance-invite flow |
| `pages/OnboardingPage.tsx` | `OnboardingPage` | Wraps `OnboardingWizard`; redirects after completion; guards against re-running |
| `pages/JoinInvitePage.tsx` | `JoinInvitePage` | Community invite landing: shows community info, handles existing-user join or new account registration |
| `pages/HomePage.tsx` | `HomePage` | Authenticated home: community list, user info card, quick actions |
| `pages/CommunityPage.tsx` | `CommunityPage` | Community view: `TwoColumnLayout` with `ChannelList` sidebar + `ChannelMessageContainer` or `VoiceChannelUserList` |
| `pages/CreateCommunityPage.tsx` | `CreateCommunityPage` | Form page to create a new community |
| `pages/EditCommunityPage.tsx` | `EditCommunityPage` | Tabbed community settings: General, Channels, Roles, Members, Invites, Alias Groups, Private Channels, Bans, Timeouts, Mod Log |
| `pages/DirectMessagesPage.tsx` | `DirectMessagesPage` | DM hub: `TwoColumnLayout` with DM list sidebar + active DM chat, tabbed DM/Friends toggle |
| `pages/FriendsPage.tsx` | `FriendsPage` | Standalone friends page wrapping `FriendsPanel` |
| `pages/SettingsPage.tsx` | `SettingsPage` | User settings: appearance, voice/audio, notifications, sessions, account |
| `pages/ProfilePage.tsx` | `ProfilePage` | Public profile view: `ProfileHeader` + `ClipLibrary`; own profile gets "Edit" button |
| `pages/ProfileEditPage.tsx` | `ProfileEditPage` | Authenticated profile edit: `ProfileEditForm` with avatar/banner upload |
| `pages/AdminInvitePage.tsx` | `AdminInvitePage` | Admin instance-invite management: create/delete/copy invite links with max-uses/expiry |
| `pages/NotFoundPage.tsx` | `NotFoundPage` | 404 page with "Go Home" button |

### Admin Pages (6)

| File | Component | Purpose |
|------|-----------|---------|
| `pages/admin/AdminDashboard.tsx` | `AdminDashboard` | Instance stats: user count, community count, channels, messages, invites, bans, storage |
| `pages/admin/AdminUsersPage.tsx` | `AdminUsersPage` | User management table: search, activate/deactivate, delete, assign instance roles |
| `pages/admin/AdminCommunitiesPage.tsx` | `AdminCommunitiesPage` | Community management table: search, view, delete |
| `pages/admin/AdminRolesPage.tsx` | `AdminRolesPage` | Instance-level roles: create/edit/delete with permission checkboxes |
| `pages/admin/AdminSettingsPage.tsx` | `AdminSettingsPage` | Instance settings: name, registration mode, max upload size, global config |
| `pages/admin/AdminStoragePage.tsx` | `AdminStoragePage` | File storage browser: table of all uploaded files with size, uploader, delete |

### Debug Pages (1)

| File | Component | Purpose |
|------|-----------|---------|
| `pages/debug/NotificationDebugPage.tsx` | `NotificationDebugPage` | Admin-only debug panel: platform info, test notification buttons, push subscription list |

---

## Channel (5)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Channel/Channel.tsx` | `Channel` | Feature | Single channel list item: navigation, voice join, unread/mention badge |
| `components/Channel/ChannelCategoryList.tsx` | `ChannelCategoryList` | Shared | Grouped collapsible channel list (Text/Voice categories); used by mobile and tablet |
| `components/Channel/ChannelList.tsx` | `ChannelList`, `CategoryHeader`, `LoadingSkeleton` | Feature | Fetches and renders all channels for a community, grouped into text/voice |
| `components/Channel/ChannelMessageContainer.tsx` | `ChannelMessageContainer` | Feature | Main channel chat: header, pinned messages drawer, search popover, thread panel, messages + input |
| `components/Channel/ChannelNotificationMenu.tsx` | `ChannelNotificationMenu` | Feature | Per-channel notification level override dropdown (all/mentions/none/default) |

---

## Common (6)

Reusable shared components.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Common/AuthenticatedImage.tsx` | `AuthenticatedImage` | Shared | Fetches file from authenticated API, renders as `<img>` or MUI `<Avatar>`; loading/error states |
| `components/Common/ConfirmDialog.tsx` | `ConfirmDialog` | Shared | Generic confirmation dialog with configurable title, description, button label/color, loading state |
| `components/Common/EmptyState.tsx` | `EmptyState` | Shared | Standardized empty-state with preset variants (messages, dm, clips, notifications, search, members, channels, generic) |
| `components/Common/TwoColumnLayout.tsx` | `TwoColumnLayout` | Shared | Fixed sidebar + scrollable main content layout; used by `CommunityPage` and `DirectMessagesPage` |
| `components/Common/UserAvatar.tsx` | `UserAvatar` | Shared | Authenticated avatar with size variants (sm/md/lg/xl), online indicator, skeleton loading, click-to-profile |
| `components/Common/UserSearchAutocomplete.tsx` | `UserSearchAutocomplete` | Shared | MUI Autocomplete wrapping user search API; single/multi select, debounced query, avatar chips |

---

## Community (21)

Community/server management and configuration.

### Main Components (14)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Community/CommunityFormContent.tsx` | `CommunityFormContent` | Shared | Composes banner + avatar + form fields into one form body |
| `components/Community/CommunityFormFields.tsx` | `CommunityFormFields` | Shared | Name + description text fields |
| `components/Community/CommunityFormLayout.tsx` | `CommunityFormLayout` | Shared | Page-level form container with back button, title, submit/cancel, error alert |
| `components/Community/CommunitySettingsForm.tsx` | `CommunitySettingsForm` | Feature | Settings form wrapper with submit/cancel; used in `EditCommunityPage` |
| `components/Community/CommunityAvatarUpload.tsx` | `CommunityAvatarUpload` | Shared | Avatar upload widget with preview, camera icon overlay |
| `components/Community/CommunityBannerUpload.tsx` | `CommunityBannerUpload` | Feature | Banner image upload with drag/drop and preview |
| `components/Community/EditCommunityButton.tsx` | `EditCommunityButton` | Feature | Permission-gated settings icon that navigates to community edit page |
| `components/Community/ChannelManagement.tsx` | `ChannelManagement` | Feature | Admin panel: reorder channels (up/down), delete; create/edit dialogs |
| `components/Community/CreateChannelDialog.tsx` | `CreateChannelDialog` | Feature | New channel: name, type (text/voice), private toggle |
| `components/Community/EditChannelDialog.tsx` | `EditChannelDialog` | Feature | Edit channel: name, private toggle |
| `components/Community/InviteManagement.tsx` | `InviteManagement` | Feature | Invite link management: list, copy, delete, create with max-uses/expiry |
| `components/Community/MemberManagement.tsx` | `MemberManagement` | Feature | Member list with add/remove, role assignment dialog |
| `components/Community/PrivateChannelMembership.tsx` | `PrivateChannelMembership` | Feature | Per-channel membership for private channels: channel picker, member list, add members |
| `components/Community/RoleManagement.tsx` | `RoleManagement` | Feature | Table of community roles; create/edit/delete |

### Sub-Components (7)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Community/RoleEditor.tsx` | `RoleEditor` | Feature | Role create/edit form: name + permission checkboxes grouped by category (accordion) |
| `components/Community/RoleAssignmentDialog.tsx` | `RoleAssignmentDialog` | Feature | Dialog to assign/remove roles to a member via checkboxes |
| `components/Community/AliasGroupEditor.tsx` | `AliasGroupEditor` | Feature | Create/edit alias group: name + member checklist with search |
| `components/Community/AliasGroupManagement.tsx` | `AliasGroupManagement` | Feature | Table of alias groups; create/edit/delete |
| `components/Community/components/AddChannelMembers.tsx` | `AddChannelMembers` | Feature | Shows community members not in a private channel, allows adding |
| `components/Community/components/ChannelMembersList.tsx` | `ChannelMembersList` | Feature | Current private channel members with remove button |
| `components/Community/components/ChannelSelector.tsx` | `ChannelSelector` | Shared | Dropdown select for choosing a private channel |

---

## CommunityList (3)

Sidebar community navigation.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/CommunityList/CommunityListItem.tsx` | `CommunityListItem` | Feature | Single community in sidebar: avatar/initials, name, navigation |
| `components/CommunityList/CommunityToggle.tsx` | `CommunityToggle` | Feature | Full sidebar drawer: joined communities, DM/Friends/Admin nav icons, expandable |
| `components/CommunityList/CreateCommunityButton.tsx` | `CreateCommunityButton` | Feature | "+" button at bottom of community list; navigates to `/community/create` |

---

## DirectMessage — Voice (3)

DM voice call components.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/DirectMessage/DMVoiceControls.tsx` | `DMVoiceControls` | Feature | Phone/video call buttons in DM header; active call chip if already in DM voice |
| `components/DirectMessage/IncomingCallBanner.tsx` | `IncomingCallBanner` | Feature | Floating pulsing banner for incoming DM voice calls with accept/decline |
| `components/DirectMessage/IncomingCallListener.tsx` | `IncomingCallListener` | Feature | Invisible listener: subscribes to `call:incoming` WS events, plays ringtone, triggers incoming call UI |

---

## DirectMessages — Chat (5)

DM group management and chat.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/DirectMessages/DirectMessageContainer.tsx` | `DirectMessageContainer` | Feature | DM chat view: fetches DM group, renders `MessageContainerWrapper` |
| `components/DirectMessages/DirectMessageList.tsx` | `DirectMessageList` | Feature | Left-side list of all DM conversations with unread badges; "+" to create new DM |
| `components/DirectMessages/DmListItem.tsx` | `DmListItem` | Shared | Single DM row: avatars (group or 1:1), name, online status, call indicator, unread badge |
| `components/DirectMessages/DMChatHeader.tsx` | `DMChatHeader` | Feature | DM header bar: group name, back button, voice/video call controls |
| `components/DirectMessages/CreateDmDialog.tsx` | `CreateDmDialog` | Feature | Dialog to create new DM: multi-user search autocomplete + optional group name |

---

## Electron (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Electron/AutoUpdater.tsx` | `AutoUpdater` | Feature | Listens to auto-updater IPC events, shows download progress snackbar and "restart to update" prompt |
| `components/Electron/ConnectionWizard.tsx` | `ConnectionWizard` | Feature | Setup wizard dialog for configuring backend server URL on first launch |

---

## Friends (6)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Friends/FriendsPanel.tsx` | `FriendsPanel` | Feature | Top-level friends panel with tabs (Friends/Requests) and "Add Friend" button |
| `components/Friends/FriendList.tsx` | `FriendList` | Feature | List of accepted friends using `FriendCard`; empty state if none |
| `components/Friends/FriendCard.tsx` | `FriendCard` | Feature | Single friend row: avatar, display name; three-dot menu for "Message" (creates DM) and "Remove Friend" |
| `components/Friends/FriendRequestList.tsx` | `FriendRequestList` | Feature | Tabbed list (Incoming/Outgoing) of pending friend requests |
| `components/Friends/FriendRequestCard.tsx` | `FriendRequestCard` | Feature | Pending request row: accept/decline (incoming) or cancel (outgoing) |
| `components/Friends/AddFriendDialog.tsx` | `AddFriendDialog` | Feature | Dialog to send friend request: user search, excludes existing friends/pending |

---

## Message (30)

The largest component group — handles the core chat experience.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Message/MessageContainer.tsx` | `MessageContainer` | Feature | Virtualized message list with infinite scroll upward, unread divider, "scroll to bottom" FAB, read receipt tracking |
| `components/Message/MessageContainerWrapper.tsx` | `MessageContainerWrapper` | Feature | Composes `MessageContainer` + `MessageInput` + optional right-side member list panel |
| `components/Message/MessageComponent.tsx` | `MessageComponent` | Feature | Full message row: avatar, author, timestamp, spans, attachments, reactions, thread badge; hover toolbar; edit/delete |
| `components/Message/MessageComponentStyles.tsx` | `Container` _(styled)_ | Shared | Styled `div` for message row with hover highlight, delete animation, mention highlight flash |
| `components/Message/MessageInput.tsx` | `MessageInput` | Feature | Unified compose box: text field with `@mention` autocomplete, file picker, file previews, drop zone |
| `components/Message/MessageInputStyles.tsx` | `StyledPaper`, `StyledTextField` _(styled)_ | Shared | Styled MUI components for `MessageInput` layout |
| `components/Message/MessageEditForm.tsx` | `MessageEditForm` | Shared | Inline editing form: textfield, save/cancel icons, attachment removal chips |
| `components/Message/MessageSpan.tsx` | `MessageSpan` | Shared | Single message span: plain text, user mention, `@here`/`@channel`, channel mention, alias group mention |
| `components/Message/MessageToolbar.tsx` | `MessageToolbar` | Feature | Floating action toolbar on hover: emoji react, thread, pin/unpin, edit, delete (with inline confirmation) |
| `components/Message/MessageReactions.tsx` | `MessageReactions`, `SingleReactionChip` | Shared | Emoji reaction chips row; highlights current user's reactions, hover tooltip |
| `components/Message/ReactionTooltip.tsx` | `ReactionTooltip`, `UserName` | Shared | Tooltip showing list of users who reacted with a given emoji; lazy-loads display names |
| `components/Message/MessageAttachments.tsx` | `MessageAttachments` | Shared | Renders all attachments in grid or single layout; opens `ImageLightbox` on image click |
| `components/Message/AttachmentPreview.tsx` | `AttachmentPreview` | Shared | Dispatches to `AudioPlayer`, `VideoPreview`, or `DownloadLink` based on MIME type |
| `components/Message/FilePreview.tsx` | `FilePreview` | Shared | Shows selected file chips/image thumbnails before sending in `MessageInput` |
| `components/Message/ImageLightbox.tsx` | `ImageLightbox` | Shared | Full-screen image lightbox portal with prev/next, close button, keyboard support |
| `components/Message/VideoPreview.tsx` | `VideoPreview` | Shared | Authenticated video preview card with thumbnail + play button; file icon fallback |
| `components/Message/AudioPlayer.tsx` | `AudioPlayer` | Shared | Authenticated audio player card with waveform-style UI, download button |
| `components/Message/DownloadLink.tsx` | `DownloadLink` | Shared | Download card for non-previewable files: file type icon, name, size, download button |
| `components/Message/DropZoneOverlay.tsx` | `DropZoneOverlay` | Shared | Full-area drag-and-drop target overlay shown when dragging files over message area |
| `components/Message/EmojiPicker.tsx` | `EmojiPicker` | Shared | Popover emoji picker with searchable grid; used in toolbar for reactions |
| `components/Message/MentionDropdown.tsx` | `MentionDropdown` | Shared | Autocomplete dropdown for `@mention` suggestions (users, alias groups, `@here`, `@channel`) |
| `components/Message/MemberList.tsx` | `MemberList` | Feature | Collapsible sidebar list of online/offline members with avatar, status, profile click, mod context menu |
| `components/Message/MemberListContainer.tsx` | `MemberListContainer` | Feature | Data container: fetches community members or DM group members + presence |
| `components/Message/MessageSearch.tsx` | `MessageSearch` | Feature | Popover search: text input, channel/all toggle, results list with click-to-navigate-and-highlight |
| `components/Message/MessageSkeleton.tsx` | `MessageSkeleton` | Shared | Placeholder skeleton row (avatar circle + text lines) while messages load |
| `components/Message/TypingIndicator.tsx` | `TypingIndicator` | Feature | Animated "X is typing..." indicator below message input |
| `components/Message/ReadStatusIndicator.tsx` | `ReadStatusIndicator` | Shared | Grey/blue eye icon indicating sent vs read status for DM messages |
| `components/Message/SeenByTooltip.tsx` | `SeenByTooltip` | Feature | Wraps `ReadStatusIndicator` with hover-loaded "seen by [names]" tooltip for DMs |
| `components/Message/UnreadMessageDivider.tsx` | `UnreadMessageDivider` | Shared | "NEW MESSAGES" divider with optional count between read and unread messages |
| `components/Message/UserStatusIndicator.tsx` | `UserStatusIndicator` | Shared | Small green dot shown on avatar when user is online |

**Key hooks:** `useMessages`, `useMessageFileUpload`, `useSendMessage`, `useMessagePermissions`, `useTypingUsers`, `useMentionAutocomplete`, `useFileUpload`, `useMessageVisibility`

---

## Mobile (18)

Responsive layouts for phone and tablet.

### Core (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Mobile/MobileLayout.tsx` | `MobileLayout` | Layout | Mobile root: `MobileNavigationProvider` + `MobileCommunityDrawer` + `MobileScreenContainer` + `MobileBottomNavigation` + voice components |
| `components/Mobile/MobileAppBar.tsx` | `MobileAppBar` | Layout | Contextual top app bar: back button, title, optional action icons |

### Navigation (3)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Mobile/Navigation/MobileBottomNavigation.tsx` | `MobileBottomNavigation` | Feature | 4-tab bottom nav (Home/Messages/Notifications/Profile) with unread badges |
| `components/Mobile/Navigation/MobileCommunityDrawer.tsx` | `MobileCommunityDrawer` | Feature | Swipeable drawer from left edge: community list, DM/Friends/Admin nav |
| `components/Mobile/Navigation/MobileNavigationContext.tsx` | `MobileNavigationProvider`, `useMobileNavigation` | Provider | Screen-based navigation state: current tab, screen stack (max 2 deep), community/channel selection |

### Panels (4)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Mobile/Panels/MobileChannelsPanel.tsx` | `MobileChannelsPanel` | Feature | Mobile channel list for selected community with header, settings menu |
| `components/Mobile/Panels/MobileChatPanel.tsx` | `MobileChatPanel` | Feature | Mobile chat for channel and DM; `MobileAppBar`, member list sheet, pinned messages, thread panel |
| `components/Mobile/Panels/MobileMessagesPanel.tsx` | `MobileMessagesPanel` | Feature | Mobile DM list with FAB to create new DM |
| `components/Mobile/Panels/MobileProfilePanel.tsx` | `MobileProfilePanel` | Feature | Mobile profile/settings: avatar, username, quick links to edit and settings |

### Screens (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Mobile/Screens/MobileScreenContainer.tsx` | `MobileScreenContainer` | Feature | Routes mobile screen state to correct panel with slide animation |
| `components/Mobile/Screens/NotificationsScreen.tsx` | `NotificationsScreen` | Feature | Mobile notification list: mark all read, individual dismiss/navigate |

### Common (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Mobile/common/MobileListItem.tsx` | `MobileListItem` | Shared | Touch-friendly list item with adequate hit target, avatar, text, optional icon |
| `components/Mobile/common/MobileSheet.tsx` | `MobileSheet` | Shared | Swipeable bottom sheet (`SwipeableDrawer`) with handle indicator and close button |

### Tablet (3)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Mobile/Tablet/TabletLayout.tsx` | `TabletLayout` | Layout | Tablet root: sidebar + content side by side; voice components + community drawer + bottom nav |
| `components/Mobile/Tablet/TabletSidebar.tsx` | `TabletSidebar` | Feature | Always-visible left sidebar: community name, channel list via `ChannelCategoryList` |
| `components/Mobile/Tablet/TabletContentArea.tsx` | `TabletContentArea` | Layout | Right-side content area for tablet split view |

---

## Moderation (8)

Community moderation tools.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Moderation/BanDialog.tsx` | `BanDialog` | Feature | Ban user: reason text field, permanent or temporary with expiry date |
| `components/Moderation/BanListPanel.tsx` | `BanListPanel` | Feature | List of banned users with unban action |
| `components/Moderation/KickConfirmDialog.tsx` | `KickConfirmDialog` | Feature | Kick confirmation with optional reason |
| `components/Moderation/TimeoutDialog.tsx` | `TimeoutDialog` | Feature | Timeout user: reason, preset or custom duration |
| `components/Moderation/TimeoutListPanel.tsx` | `TimeoutListPanel` | Feature | Currently timed-out users with early removal |
| `components/Moderation/PinnedMessagesPanel.tsx` | `PinnedMessagesPanel` | Feature | Drawer listing pinned messages with unpin action |
| `components/Moderation/ModerationLogsPanel.tsx` | `ModerationLogsPanel` | Feature | Audit log panel; filterable by action type |
| `components/Moderation/UserModerationMenu.tsx` | `UserModerationMenu` | Feature | Right-click context menu: kick, timeout, ban with permission checks |

---

## Navbar (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/NavBar/NavigationLinks.tsx` | `NavigationLinks` | Feature | Top nav links (DMs, Friends, Admin — if permitted) in `Layout` |
| `components/NavBar/ProfileIcon.tsx` | `ProfileIcon` | Feature | Avatar icon button in nav; dropdown: My Profile / Settings / Logout |

---

## Notifications (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Notifications/NotificationBadge.tsx` | `NotificationBadge` | Feature | Bell icon with unread count badge in top nav |
| `components/Notifications/NotificationCenter.tsx` | `NotificationCenter` | Feature | Drawer listing notifications: mark read, dismiss, navigate to source |

---

## Onboarding (6)

First-time instance setup wizard.

| File | Component | Step | Purpose |
|------|-----------|------|---------|
| `components/Onboarding/OnboardingWizard.tsx` | `OnboardingWizard` | — | Multi-step wizard container (MUI `Stepper`) |
| `components/Onboarding/WelcomeStep.tsx` | `WelcomeStep` | 1 | Welcome screen explaining Kraken features |
| `components/Onboarding/AdminSetupStep.tsx` | `AdminSetupStep` | 2 | Admin account creation (username, email, password) |
| `components/Onboarding/InstanceSetupStep.tsx` | `InstanceSetupStep` | 3 | Instance name configuration |
| `components/Onboarding/CommunitySetupStep.tsx` | `CommunitySetupStep` | 4 | Initial community name with channel preview |
| `components/Onboarding/CompletionStep.tsx` | `CompletionStep` | 5 | Summary + submit; calls onboarding API |

---

## Profile (7)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Profile/ProfileHeader.tsx` | `ProfileHeader` | Feature | Banner + avatar + username display section |
| `components/Profile/ProfileEditForm.tsx` | `ProfileEditForm` | Feature | Edit profile: avatar, banner, display name, bio, status |
| `components/Profile/UserAvatarUpload.tsx` | `UserAvatarUpload` | Shared | User avatar upload with preview and camera overlay |
| `components/Profile/UserBannerUpload.tsx` | `UserBannerUpload` | Shared | User banner upload widget |
| `components/Profile/UserProfileModal.tsx` | `UserProfileModal` | Feature | Modal showing another user's profile: banner, avatar, name, status, bio, friend/DM actions |
| `components/Profile/ClipLibrary.tsx` | `ClipLibrary` | Feature | Grid of recorded clips: download, delete, share, toggle public/private |
| `components/Profile/ShareClipDialog.tsx` | `ShareClipDialog` | Feature | Share clip to community channel or as public link |

---

## PWA (1)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/PWA/PWAInstallPrompt.tsx` | `PWAInstallPrompt` | Feature | Non-intrusive Snackbar prompt to install as PWA; handles browser install event + iOS manual instructions |

---

## Settings (4)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Settings/AudioVideoSettingsPanel.tsx` | `AudioVideoSettingsPanel` | Feature | Device picker (mic, camera, speakers), volume sliders, noise suppression, mic test level meter |
| `components/Settings/NotificationSettings.tsx` | `NotificationSettings` | Feature | DND, desktop notifications, sound, default channel notification level |
| `components/Settings/SessionsSettings.tsx` | `SessionsSettings` | Feature | Active sessions with device/platform info; revoke individual or all other sessions |
| `components/Settings/VoiceSettings.tsx` | `VoiceSettings` | Feature | Wrapper rendering `AudioVideoSettingsPanel` inside a Card for settings page |

---

## ThemeToggle (1)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/ThemeToggle/ThemeToggle.tsx` | `ThemeToggle` | Shared | Light/dark mode toggle icon button in top nav |

---

## Thread (3)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Thread/ThreadPanel.tsx` | `ThreadPanel` | Feature | Side drawer: parent message, reply count, scrollable replies, `ThreadMessageInput` |
| `components/Thread/ThreadMessageInput.tsx` | `ThreadMessageInput` | Feature | Simple text input + send button for thread replies (plain text, no file attachments) |
| `components/Thread/ThreadReplyBadge.tsx` | `ThreadReplyBadge` | Shared | "N replies - last reply X ago" clickable badge under threaded messages |

---

## Voice (14)

Voice/video call UI and controls.

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `components/Voice/VoiceBottomBar.tsx` | `VoiceBottomBar` | Feature | Persistent bottom bar: mute, deafen, camera, screen-share; channel name, participant count, leave; opens replay/device dialogs |
| `components/Voice/VideoTiles.tsx` | `VideoTiles` | Feature | Grid of `VideoTile` components; layout modes (grid/focus/sidebar), draggable pinning |
| `components/Voice/VideoTile.tsx` | `VideoTile` | Feature | Single participant video: video element, speaking ring, mic/video/screen badges, pin button |
| `components/Voice/PersistentVideoOverlay.tsx` | `PersistentVideoOverlay` | Feature | Draggable/resizable floating video overlay showing `VideoTiles`; minimize/maximize/fullscreen |
| `components/Voice/AudioRenderer.tsx` | `AudioRenderer`, `ParticipantAudio` | Feature | Invisible tree attaching LiveKit remote audio tracks to `<audio>` elements |
| `components/Voice/VoiceChannelJoinButton.tsx` | `VoiceChannelJoinButton` | Feature | Join/leave button on voice channel pages; adapts for audio-only or video |
| `components/Voice/VoiceChannelUserList.tsx` | `VoiceChannelUserList` | Feature | Participants in a voice channel shown under channel in sidebar; mic/video/screen indicators |
| `components/Voice/VoiceUserContextMenu.tsx` | `VoiceUserContextMenu` | Feature | Right-click menu: view profile, mute for self, set volume, kick/timeout/ban (permissioned) |
| `components/Voice/VoiceDebugPanel.tsx` | `VoiceDebugPanel` | Feature | Debug panel: LiveKit room state, mic track status, speaking detection, audio levels |
| `components/Voice/ScreenSourcePicker.tsx` | `ScreenSourcePicker` | Feature | Electron-only dialog: screen/window source picker with thumbnail grid |
| `components/Voice/CaptureReplayModal.tsx` | `CaptureReplayModal` | Feature | Replay buffer trim modal: quick save or custom trim, community/channel destination |
| `components/Voice/TrimPreview.tsx` | `TrimPreview` | Feature | HLS.js video player for previewing selected trim range of captured replay |
| `components/Voice/TrimTimeline.tsx` | `TrimTimeline` | Shared | Visual timeline with start/end handle drag for replay trim |
| `components/Voice/DeviceSettingsDialog.tsx` | `DeviceSettingsDialog` | Feature | Dialog wrapping `AudioVideoSettingsPanel` for quick device changes from voice bar |

**Key hooks:** `useVoiceConnection`, `useScreenShare`, `useLocalMediaState`, `useSpeakingDetection`, `usePushToTalk`, `useDeafenEffect`, `useReplayBuffer`

---

## Context Providers (13)

Provider components that render children and supply context.

| File | Component | Purpose |
|------|-----------|---------|
| `contexts/ThemeContext.tsx` | `ThemeProvider` | Theme state: mode (light/dark/system), accent colour, intensity; wraps MUI `ThemeProvider` |
| `contexts/VoiceContext.tsx` | `VoiceProvider` | Global voice state (connected, channel, mute/deafen/video, screen share) via `useReducer` |
| `contexts/RoomContext.tsx` | `RoomProvider` | LiveKit `Room` instance lifecycle; reconnects on voice state changes |
| `contexts/NotificationContext.tsx` | `NotificationProvider` | Global `showNotification(message, severity)` toast via MUI `Snackbar`/`Alert` |
| `contexts/AvatarCacheContext.tsx` | `FileCacheProvider` / `AvatarCacheProvider` | In-memory blob URL cache (LRU, max 100) for authenticated file fetches |
| `contexts/IncomingCallContext.tsx` | `IncomingCallProvider` | Incoming DM voice call state; auto-dismiss after 30s |
| `contexts/ReplayBufferContext.tsx` | `ReplayBufferProvider` | Exposes `isReplayBufferActive` from `useReplayBuffer` hook |
| `contexts/ThreadPanelContext.tsx` | `ThreadPanelProvider` | Tracks open thread panel (`openThreadId`); provides `openThread`/`closeThread` |
| `contexts/UserProfileContext.tsx` | `UserProfileProvider` | Manages `UserProfileModal` open state; `openProfile(userId)` |
| `contexts/VideoOverlayContext.tsx` | `VideoOverlayProvider` | Tracks default and page-specific container elements for floating video overlay |
| `utils/SocketProvider.tsx` | `SocketProvider` | Initializes Socket.IO singleton; auth failure handling, exponential backoff reconnection |
| `socket-hub/SocketHubProvider.tsx` | `SocketHubProvider` | Creates shared `EventBus` for WebSocket event distribution; runs `useSocketHub` |
| `components/Mobile/Navigation/MobileNavigationContext.tsx` | `MobileNavigationProvider` | Mobile screen-based navigation state |

---

## Utility Components (2)

| File | Component | Type | Purpose |
|------|-----------|------|---------|
| `features/roles/RoleBasedComponents.tsx` | `RoleBasedComponent`, `CommunityRoleDisplay`, `ConditionalButton` | Shared | RBAC utility components: conditional render by actions, role chip display, conditional button |
| `components/admin/AdminLayout.tsx` | `AdminLayout` | Layout | Admin section layout: left drawer nav (Dashboard, Users, Communities, Invites, Roles, Storage, Settings) + `<Outlet>` |

---

## Cross-References

- Hook dependencies → [08-frontend-hooks-and-state.md](./08-frontend-hooks-and-state.md)
- Voice components → [07-voice-and-media.md](./07-voice-and-media.md)
- WebSocket handlers → [06-websocket-system.md](./06-websocket-system.md)
- Theme system → [04-frontend-architecture.md](./04-frontend-architecture.md)
- Route definitions → [04-frontend-architecture.md](./04-frontend-architecture.md)
