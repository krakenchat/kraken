# useSwipeGesture

> **Location:** `frontend/src/hooks/useSwipeGesture.ts`
> **Type:** Utility Hook
> **Category:** ui

## Overview

Detects swipe gestures for mobile navigation. Used for opening/closing sidebars on touch devices.

## Usage

```tsx
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

function MobileLayout() {
  const {
    handlers,
    swipeDirection
  } = useSwipeGesture({
    onSwipeLeft: () => closeSidebar(),
    onSwipeRight: () => openSidebar(),
    threshold: 50
  });

  return (
    <div {...handlers}>
      {/* content */}
    </div>
  );
}
```

## Parameters

- `onSwipeLeft`: Callback for left swipe
- `onSwipeRight`: Callback for right swipe
- `threshold`: Minimum distance (px) to trigger swipe

## Related

- Mobile components
- [useResponsive](./useResponsive.md)
