# NotificationSettings

> **Location:** `frontend/src/components/Settings/NotificationSettings.tsx`
> **Type:** Settings Component
> **Category:** settings

## Overview

Settings page for managing notification preferences. Configures desktop notifications, DND mode, sound settings, and default channel notification level.

## Usage

```tsx
import { NotificationSettings } from '@/components/Settings/NotificationSettings';

<NotificationSettings />
```

## Settings Options

| Setting | Type | Description |
|---------|------|-------------|
| Desktop Enabled | Switch | Enable/disable all desktop notifications |
| Sound Enabled | Switch | Enable/disable notification sounds |
| DM Notifications | Switch | Notify on direct messages |
| Default Channel Level | Radio | all / mentions / none |
| Do Not Disturb | Switch | Enable quiet hours |
| DND Start/End Time | Time | Quiet hours window |

## Features

- Browser notification permission request button
- Shows permission status (granted/denied/unsupported)
- Save button with loading state
- Error/success feedback

## API Integration

- `useGetSettingsQuery` - Load current settings
- `useUpdateSettingsMutation` - Save settings

## Related

- [Notifications Module](../../modules/notifications.md)
- [useNotificationPermission Hook](../../hooks/useNotificationPermission.md)
