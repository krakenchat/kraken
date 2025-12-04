# instance

> **Location:** `backend/src/instance/`
> **Type:** NestJS Module
> **Category:** Configuration

## Overview

Manages instance-wide settings (name, description, registration mode) and provides admin statistics. Uses singleton pattern for settings storage.

## Key Exports

- `InstanceService` - Get/update instance settings, fetch stats
- `InstanceController` - REST endpoints for settings management
- `UpdateInstanceSettingsDto` - DTO for updating settings

## Usage

```typescript
// Get or create instance settings (singleton)
const settings = await instanceService.getSettings();
// Returns: { name, description, registrationMode }

// Update instance settings
await instanceService.updateSettings({
  name: 'My Kraken',
  registrationMode: 'INVITE_ONLY'
});

// Get admin statistics
const stats = await instanceService.getStats();
// Returns: { totalUsers, totalCommunities, totalChannels, totalMessages, activeInvites, bannedUsers }
```

## Registration Modes

- `OPEN` - Anyone can register
- `INVITE_ONLY` - Requires instance invite code

## Related

- [Onboarding Module](./onboarding.md)
- [Invite System](../api/invites.md)
