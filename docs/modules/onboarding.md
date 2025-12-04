# onboarding

> **Location:** `backend/src/onboarding/`
> **Type:** NestJS Module
> **Category:** Setup

## Overview

Handles first-time instance setup when no users exist. Creates admin user, default community with channels, welcome message, and initial invite code.

## Key Exports

- `OnboardingService` - Setup wizard logic
- `OnboardingController` - Public endpoints for setup flow
- `SetupInstanceDto` - DTO with admin credentials and instance config

## Usage

```typescript
// Check if instance needs setup
const needsSetup = await onboardingService.needsSetup();

// Generate temporary setup token (stored in Redis, 15min TTL)
const token = await onboardingService.generateSetupToken();

// Complete setup with admin user and default community
const result = await onboardingService.completeSetup({
  adminUsername: 'admin',
  adminEmail: 'admin@example.com',
  adminPassword: 'securePassword',
  instanceName: 'My Kraken',
  createDefaultCommunity: true,
  defaultCommunityName: 'General'
}, setupToken);
```

## Setup Flow

1. Frontend detects no users → shows setup wizard
2. Backend generates setup token (Redis, 15min TTL)
3. User submits admin credentials + instance name
4. Creates admin user with OWNER role
5. Creates default community with general/announcements/voice channels
6. Creates welcome instance invite
7. Clears setup token

## Related

- [Instance Module](./instance.md)
- [Auth Module](../api/auth.md)
