# 04 — Frontend Architecture & Design

> React 19 + TypeScript + Vite 6.4 + Material-UI 7. `frontend/src/`.

---

## Table of Contents

- [App Bootstrap](#app-bootstrap)
- [Routing](#routing)
- [Provider Hierarchy](#provider-hierarchy)
- [State Management](#state-management)
- [API Client](#api-client)
- [Theme System](#theme-system)
- [Platform Separation](#platform-separation)
- [Code Splitting](#code-splitting)
- [Responsive Design](#responsive-design)
- [Auth Flow (Frontend)](#auth-flow-frontend)

---

## App Bootstrap

### Entry Point (`main.tsx`)

```
1. initTelemetry()           — OpenObserve setup (optional)
2. configureApiClient()      — Auth interceptors, base URL
3. registerServiceWorker()   — PWA (web only, not Electron)
4. ReactDOM.createRoot()     — Render app
     └─ StrictMode
          └─ QueryClientProvider
               └─ HashRouter    ← HashRouter for Electron file:// compatibility
                    └─ App
```

### App Component (`App.tsx`)

```
<ThemeProvider>
  <Routes>
    ├─ /login           (eager)
    ├─ /register        (eager)
    ├─ /onboarding      (eager)
    ├─ /join/:code      (lazy)
    │
    └─ <AuthGate>       ← Auth boundary
         └─ <Layout>    ← Responsive shell
              ├─ /                          (HomePage)
              ├─ /direct-messages           (DMPage)
              ├─ /friends                   (FriendsPage)
              ├─ /settings                  (SettingsPage)
              ├─ /profile/edit              (ProfileEditPage)
              ├─ /profile/:userId           (ProfilePage)
              ├─ /community/create          (CreateCommunityPage)
              ├─ /community/:id             (CommunityPage)
              ├─ /community/:id/edit        (EditCommunityPage)
              ├─ /community/:id/channel/:id (CommunityPage)
              │
              ├─ /admin                     (AdminLayout)
              │   ├─ /admin/users
              │   ├─ /admin/communities
              │   ├─ /admin/invites
              │   ├─ /admin/roles
              │   ├─ /admin/storage
              │   └─ /admin/settings
              │
              └─ /debug/notifications       (debug)
  </Routes>
</ThemeProvider>
```

---

## Routing

### Public vs Authenticated Routes

| Type | Wrapper | Behavior |
|------|---------|----------|
| Public | `<PublicRoute>` | Redirects to `/` if already authenticated |
| Auth | `<AuthGate>` | Validates token, shows login if invalid |
| Admin | Nested under `/admin` | `<AdminLayout>` with sidebar nav |

### Key Routing Decisions

- **HashRouter** (not BrowserRouter) — Required for Electron `file://` protocol
- **Lazy loading** — All authenticated routes are lazy-loaded except login/register
- **Nested layouts** — `<Layout>` provides sidebar + top bar; `<AdminLayout>` provides admin sidebar
- **No dedicated router file** — Routes defined inline in `App.tsx`

> **Review Point:** Using HashRouter means URLs have `#` prefix (e.g., `/#/community/123`). This works for Electron but makes SSR impossible and affects SEO. Since this is a SPA, it's acceptable, but deep links from push notifications need to handle the hash format.

---

## Provider Hierarchy

Providers are layered by lifecycle:

### Layer 1: App Level (always mounted)

| Provider | Purpose |
|----------|---------|
| `QueryClientProvider` | TanStack Query instance |
| `HashRouter` | React Router |
| `ThemeProvider` | Dark/light mode, accent colors, intensity |

### Layer 2: After Authentication (in `AuthGate`)

| Provider | Purpose | State Type |
|----------|---------|-----------|
| `SocketProvider` | WebSocket connection state | useState |
| `AvatarCacheProvider` | File/avatar blob cache (LRU) | useRef Map |
| `NotificationProvider` | Toast snackbar notifications | useState |
| `VoiceProvider` | Voice connection state | useReducer (split state/dispatch) |
| `RoomProvider` | LiveKit Room instance | useRef |
| `ThreadPanelProvider` | Thread sidebar open/close | useState |
| `UserProfileProvider` | User profile modal state | useState |

### Layer 3: Layout Level

| Provider | Purpose |
|----------|---------|
| `ReplayBufferProvider` | Replay buffer active state |
| `SocketHubProvider` | WebSocket event bus (cache handlers + re-emit) |
| `IncomingCallProvider` | Incoming DM call UI state + auto-dismiss timer |
| `VideoOverlayProvider` | Video container refs for persistent overlay |

**Total: 15 context providers.**

> **Review Point:** `VoiceProvider` uses a split state/dispatch pattern — `VoiceStateContext` and `VoiceDispatchContext` are separate contexts. This prevents re-renders in components that only need to dispatch actions without reading state.

---

## State Management

### Strategy: TanStack Query (Server State) + Context (UI State)

**No Redux store.** All API data flows through TanStack Query.

### QueryClient Configuration (`queryClient.ts`)

```typescript
{
  defaultOptions: {
    queries: {
      staleTime: 30_000,             // 30 seconds
      retry: 1,                       // Retry once on failure
      refetchOnWindowFocus: false,    // Don't refetch on tab focus
    }
  }
}
```

### Server State Pattern

| Pattern | Tool | When |
|---------|------|------|
| Read data | `useQuery` | GET operations |
| Paginated data | `useInfiniteQuery` | Message lists (continuation tokens) |
| Mutate data | `useMutation` | POST/PUT/PATCH/DELETE |
| Direct cache update | `queryClient.setQueryData` | High-frequency WS events |
| Invalidate cache | `queryClient.invalidateQueries` | Structural changes |

### UI State (Contexts)

| Context | What It Manages |
|---------|----------------|
| Theme | Mode, accent color, intensity |
| Voice | Connection state, device IDs, deafen |
| Thread Panel | Open thread message ID |
| User Profile | Selected user ID for modal |
| Incoming Call | Caller info, dismiss timer |
| Video Overlay | Container refs |
| Notification | Toast queue |

---

## API Client

### Generated SDK

Auto-generated from OpenAPI spec via `@hey-api/openapi-ts`:

```
backend/openapi.json  →  frontend/src/api-client/
                            ├── client.gen.ts        (client singleton)
                            ├── types.gen.ts          (TypeScript types)
                            └── @tanstack/react-query.gen.ts  (query hooks)
```

### Configuration (`api-client-config.ts`)

```typescript
configureApiClient() {
  // 1. Base URL: empty for web (proxy), server URL for Electron
  // 2. Request interceptor: adds Bearer token to Authorization header
  // 3. Response interceptor:
  //    - 401 on auth endpoints → bad credentials (don't retry)
  //    - 401 elsewhere → expired token → refresh + retry
  //    - Refresh failure → notify AuthGate → logout
}
```

### Usage

```typescript
// Generated hooks (preferred)
const { data } = useQuery(userControllerGetProfile());
const mutation = useMutation(authControllerLoginMutation());

// Generated functions (for non-hook contexts)
const response = await channelsControllerFindAll({ path: { communityId } });
```

---

## Theme System

### Configuration

| Setting | Options | Default |
|---------|---------|---------|
| **Mode** | `dark`, `light` | `dark` |
| **Accent Color** | 12 colors: teal, purple, orange, blue, rose, emerald, red, amber, indigo, cyan, lime, slate | `blue` |
| **Intensity** | `minimal`, `balanced`, `vibrant` | `minimal` |

### Color Palette Structure

Each accent color defines: `primary`, `light`, `dark`, `lighter`, `subtle` variants.

### Intensity Effects

| Element | Minimal | Balanced | Vibrant |
|---------|---------|----------|---------|
| Background | Flat | Subtle gradient | Strong gradient |
| Borders | Low opacity | Medium | Glow effects |
| Buttons | Flat | Subtle gradient | Full gradient |
| Shadows | None | Light | Pronounced |

### Storage & Sync

- **Local:** `localStorage` key `kraken-theme`
- **Server:** `useThemeSync` hook syncs with `/appearance-settings` endpoint
- Theme context methods: `setMode()`, `setAccentColor()`, `setIntensity()`, `toggleMode()`

### MUI Integration

Custom theme created via `createTheme()` with:
- Semantic colors (`semantic.status.positive/negative`, `semantic.overlay.*`)
- Component overrides for Paper, Card, Button, ListItemButton, Chip, Drawer, AppBar, TextField, Switch

---

## Platform Separation

### Detection Utility (`utils/platform.ts`)

```typescript
isElectron()            // window.electronAPI?.isElectron
isWeb()                 // !isElectron()
isMobile()              // User agent check
isDesktopBrowser()      // Web + not mobile
isWayland()             // Electron + Linux Wayland
supportsScreenCapture() // Feature detection
supportsSystemAudio()   // Windows/macOS Electron only
hasElectronFeature(name) // Check specific API method
getElectronAPI()        // Get window.electronAPI
```

### Platform-Specific Code

| Feature | Web | Electron |
|---------|-----|----------|
| Screen sharing | Browser native `getDisplayMedia` | Custom source picker dialog |
| Notifications | Web push (VAPID) | Native notifications via IPC |
| Token storage | httpOnly cookies | OS keychain (safeStorage) |
| Audio loopback | Not supported | `electron-audio-loopback` |
| Auto-updater | N/A (PWA) | `electron-updater` |
| System tray | N/A | Close to tray + tray icon |
| File:// URLs | N/A | Signed URLs for CORS |

### Platform-Specific Components

- `components/Electron/AutoUpdater.tsx` — Update prompt + progress
- `components/Electron/ConnectionWizard.tsx` — Server URL selection
- `components/PWA/PWAInstallPrompt.tsx` — "Add to Home Screen"

---

## Code Splitting

### Eager Imports (Critical Path)

- `LoginPage` — First paint for unauthenticated users
- `RegisterPage`
- `OnboardingPage`

### Lazy-Loaded Routes (All Others)

```typescript
const HomePage = lazy(() => import('./pages/HomePage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const AdminLayout = lazy(() => import('./components/Admin/AdminLayout'));
// ... 15+ lazy routes
```

**Fallback:** `<CircularProgress>` spinner during chunk loading.

> **Review Point:** There's no error boundary around `<Suspense>` for lazy routes. If a chunk fails to load (network error), the user will see an unhandled error. Consider wrapping with an `<ErrorBoundary>` that offers a retry.

---

## Responsive Design

### Breakpoints

| Device | Width | Layout |
|--------|-------|--------|
| Mobile | < 768px | `MobileLayout` (drawer nav, bottom nav) |
| Tablet | 768–1199px | `TabletLayout` (sidebar + content) |
| Desktop | ≥ 1200px | Full layout (sidebar + top bar + content) |

### Layout Constants (`constants/layout.ts`)

| Constant | Value |
|----------|-------|
| `APPBAR_HEIGHT` | 64px |
| `SIDEBAR_WIDTH` | 280px |
| `VOICE_BAR_HEIGHT` | 120px |

### Desktop Layout Structure

```
┌─────────────────────────────────────────┐
│  AppBar (Logo │ NavLinks │ Theme │ Bell │ Profile)
├──────────┬──────────────────────────────┤
│ Sidebar  │  Content Area (<Outlet />)   │
│ (280px)  │  + Thread Panel (optional)   │
│          │                               │
├──────────┴──────────────────────────────┤
│  VoiceBottomBar (120px, when connected)  │
│  AudioRenderer + PersistentVideoOverlay  │
└─────────────────────────────────────────┘
```

### Mobile-Specific Features

- Bottom navigation bar (Chat, Communities, Friends, Profile)
- Swipeable drawers for community/channel selection
- Long-press gestures
- Pull-to-refresh
- Haptic feedback (`useHapticFeedback`)
- Touch-optimized targets

---

## Auth Flow (Frontend)

### AuthGate Component

```
AuthGate mounts
    │
    ├─ 1. Check onboarding status (public API, no auth)
    │      └─ If not onboarded → redirect to /onboarding
    │
    ├─ 2. Validate existing token
    │      ├─ In-memory token exists → try /profile
    │      ├─ No token → attempt silent refresh (cookie or Electron keychain)
    │      └─ All fail → redirect to /login
    │
    ├─ 3. Token valid → mount providers
    │      └─ SocketProvider, VoiceProvider, etc.
    │
    └─ 4. Token expired during session
           └─ API interceptor catches 401
           └─ Attempts refresh
           └─ Success → retry request
           └─ Failure → AuthGate logout
```

### Logout Flow

```
1. Leave voice if connected
2. Disconnect socket
3. POST /auth/logout (with refresh token for Electron)
4. Clear all tokens (in-memory + cookies/keychain)
5. Navigate to /login
```

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.0.0 | UI framework |
| @mui/material | 7.0.2 | Component library |
| @tanstack/react-query | 5.90.20 | Server state |
| react-router-dom | 7.5.3 | Routing |
| socket.io-client | 4.8.3 | Real-time |
| livekit-client | 2.13.3 | Voice/video |
| @livekit/components-react | 2.9.17 | LiveKit React |
| hls.js | 1.6.15 | HLS playback |
| @hey-api/openapi-ts | 0.92.3 | API client generation |
| vite-plugin-pwa | 1.2.0 | PWA support |
| electron | 38.8.2 | Desktop app |

---

## Cross-References

- Component inventory → [05-frontend-components.md](./05-frontend-components.md)
- Hooks & state → [08-frontend-hooks-and-state.md](./08-frontend-hooks-and-state.md)
- WebSocket event handling → [06-websocket-system.md](./06-websocket-system.md)
- Voice/video UI → [07-voice-and-media.md](./07-voice-and-media.md)
- Auth backend → [03-auth-and-rbac.md](./03-auth-and-rbac.md)
