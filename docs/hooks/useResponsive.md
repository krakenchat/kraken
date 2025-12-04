# useResponsive

> **Location:** `frontend/src/hooks/useResponsive.ts`
> **Type:** Utility Hook
> **Category:** ui

## Overview

Provides responsive breakpoint detection for adapting UI to different screen sizes. Uses Material-UI breakpoints.

## Usage

```tsx
import { useResponsive } from '@/hooks/useResponsive';

function ResponsiveComponent() {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  if (isMobile) {
    return <MobileLayout />;
  }

  return <DesktopLayout />;
}
```

## Breakpoints

- `isMobile`: < 600px (xs)
- `isTablet`: 600px - 960px (sm, md)
- `isDesktop`: > 960px (lg, xl)

## Related

- Mobile components
- Layout components
