# Push Notification Action Buttons — Design (Issue #397)

Date: 2026-08-09
Scope: "Mark as read" action button on push notifications. Inline reply is
explicitly out of scope (see Non-Goals).

## Problem

Push notifications (web push via the service worker) currently support only
one interaction: clicking the body opens/focuses the app at the relevant
channel/DM. Users cannot dismiss a mention without opening the app. The SW
deliberately stores no JWT, so any action that hits the backend needs its own
auth strategy.

## Design

### Auth: scoped HMAC action token in the push payload

The backend embeds a single-purpose signed token in each push payload
(`data.markReadToken`). Properties:

- **Payload**: `{ u: userId, n: notificationId, exp: epochSeconds }` with a
  7-day expiry (push delivery TTL is 24h, but a displayed notification can be
  clicked days later).
- **Format**: `base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))`.
- **Key**: derived from `JWT_SECRET` via `HMAC-SHA256(key=JWT_SECRET,
  msg="semaphore-push-action-v1")`. Never the raw `JWT_SECRET` — a token
  signed with the raw secret and a `sub` claim could be replayed as an API
  access token against the passport JWT strategy.
- **Verification**: constant-time signature compare (`timingSafeEqual`), then
  expiry check. Returns `{ userId, notificationId }` or `null`.
- **Replay**: not single-use. Marking a notification read is idempotent and
  authorizes nothing else, so replay within the expiry window is harmless.
  This avoids any Redis/DB state for token tracking.

Implemented as `createActionToken` / `verifyActionToken` on
`PushNotificationsService` (it already has `ConfigService`).

### Backend endpoint

New controller `PushActionsController` in the notifications module (avoids a
circular import: NotificationsModule already imports PushNotificationsModule):

- `POST /notifications/push/mark-read`, body `{ token: string }` (DTO with
  `@IsString()` validation), **no JwtAuthGuard** — the token is the auth.
- Invalid/expired token → 401. Valid token → existing
  `NotificationsService.markAsRead(notificationId, userId)` (which also emits
  the WS `notificationRead` event so open clients stay in sync). Deleted
  notification → 404 (acceptable).
- Response: `SuccessMessageDto`.

`NotificationsService.sendPushNotification` adds
`markReadToken: this.pushNotificationsService.createActionToken(...)` to
`data`.

### Service worker

`frontend/src/sw-custom.ts`:

- **push handler**: when `data.data.markReadToken` is present and the platform
  supports notification actions (feature-detect via `'maxActions' in
  Notification && Notification.maxActions > 0`), add
  `actions: [{ action: 'mark-read', title: 'Mark as read' }]`. iOS Safari
  lacks action support and degrades to a plain notification.
- **notificationclick handler**: branch on `event.action`:
  - `'mark-read'` → close the notification and `fetch('/api/notifications/push/mark-read')`
    with the token, best-effort (errors swallowed). Do NOT open a window. Do
    not clear the app badge (other unreads may exist; the app corrects the
    badge next launch).
  - default (body click) → existing open/focus behavior.
- Pure decision logic is extracted to `frontend/src/utils/swPush.ts`
  (`buildNotificationOptions`, `getNavigationHash`, action detection) so it is
  unit-testable under Vitest; the SW file keeps only event wiring.

### Testing

- Backend: token round-trip / tamper / expiry / malformed cases on
  `PushNotificationsService`; new `push-actions.controller.spec.ts` (valid →
  markAsRead called, invalid → 401); `notifications.service.spec.ts` asserts
  the payload carries `markReadToken`.
- Frontend: Vitest unit tests for `swPush.ts` helpers.
- `backend/openapi.json` regenerated (new endpoint).

## Non-Goals

- **Inline reply**: requires an unauthenticated token that authorizes sending
  messages as the user — a materially riskier capability than idempotent
  mark-read, and unsupported on iOS anyway. Deferred pending an explicit
  security decision (tracked in #397).
- Single-use token enforcement (see Replay above).
