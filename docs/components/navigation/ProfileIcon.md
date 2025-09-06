# ProfileIcon

> **Location:** `frontend/src/components/NavBar/ProfileIcon.tsx`  
> **Type:** UI Component  
> **Feature:** navigation

## Overview

The ProfileIcon component renders a user's avatar in the top navigation bar with an associated dropdown menu. It displays the user's profile picture or initials in a circular avatar and provides a menu with user settings options when clicked.

## Props Interface

```typescript
interface ProfileIconProps {
  userData: { displayName?: string; avatarUrl?: string } | undefined;  // User profile data
  anchorElUser: null | HTMLElement;                                    // Menu anchor element
  handleOpenUserMenu: (event: React.MouseEvent<HTMLElement>) => void; // Menu open handler
  handleCloseUserMenu: () => void;                                     // Menu close handler
  settings: string[];                                                  // Menu items array
}
```

## Usage Examples

### Basic Usage
```tsx
import ProfileIcon from '@/components/NavBar/ProfileIcon';

function Navigation() {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const settings = ["Profile", "Account", "Dashboard", "Logout"];
  
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <ProfileIcon
      userData={{ displayName: "John Doe", avatarUrl: "https://example.com/avatar.jpg" }}
      anchorElUser={anchorElUser}
      handleOpenUserMenu={handleOpenUserMenu}
      handleCloseUserMenu={handleCloseUserMenu}
      settings={settings}
    />
  );
}
```

### Layout Integration
```tsx
// Layout.tsx usage
const settings = ["Profile", "Account", "Dashboard", "Logout"];
const profileUserData = userData ? {
  displayName: userData.displayName ?? undefined,
  avatarUrl: userData.avatarUrl ?? undefined,
} : undefined;

<ProfileIcon
  userData={profileUserData}
  anchorElUser={anchorElUser}
  handleOpenUserMenu={handleOpenUserMenu}
  handleCloseUserMenu={handleCloseUserMenu}
  settings={settings}
/>
```

## Styling & Theming

- **Material-UI Components Used:**
  - `IconButton` (avatar container)
  - `Tooltip` (hover tooltip)
  - `Avatar` (profile picture display)
  - `Menu` (dropdown menu)
  - `MenuItem` (menu options)
  - `Typography` (menu item text)
- **Custom Styles:** Inline sx props for menu positioning and padding
- **Theme Variables:** Uses MUI theme defaults for Avatar and Menu styling

```tsx
// Key styling patterns
<IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
  <Avatar alt={userData?.displayName || "User"} src={userData?.avatarUrl} />
</IconButton>

<Menu
  sx={{ mt: "45px" }}
  anchorOrigin={{ vertical: "top", horizontal: "right" }}
  transformOrigin={{ vertical: "top", horizontal: "right" }}
>
```

## State Management

- **Local State:** None - receives all state via props
- **External State:** 
  - `anchorElUser` managed by parent component
  - Menu open/close handlers managed by parent

## Dependencies

### Internal Dependencies
- None (pure UI component)

### External Dependencies
- `@mui/material` - all UI components
- `react` - component framework and event types

## Related Components

- **Parent Components:** Layout (primary usage)
- **Child Components:** None (leaf component)
- **Similar Components:** NavigationLinks (navigation element)

## Common Patterns

### Pattern 1: Avatar with Fallback
```tsx
<Avatar
  alt={userData?.displayName || "User"}
  src={userData?.avatarUrl || undefined}
/>
// Shows initials if no avatarUrl, placeholder if no displayName
```

### Pattern 2: Menu Positioning
```tsx
<Menu
  anchorEl={anchorElUser}
  anchorOrigin={{ vertical: "top", horizontal: "right" }}
  transformOrigin={{ vertical: "top", horizontal: "right" }}
  open={Boolean(anchorElUser)}
>
```

### Pattern 3: Tooltip for Accessibility
```tsx
<Tooltip title="Open settings">
  <IconButton onClick={handleOpenUserMenu}>
    <Avatar />
  </IconButton>
</Tooltip>
```

### Pattern 4: Dynamic Menu Items
```tsx
{settings.map((setting) => (
  <MenuItem key={setting} onClick={handleCloseUserMenu}>
    <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
  </MenuItem>
))}
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Avatar displays user image when avatarUrl provided
  - Avatar shows initials when no image but displayName exists
  - Menu opens when avatar clicked
  - Menu closes when clicking outside or on menu item
  - All settings items render correctly

```tsx
// Example test patterns
test('should display avatar image when avatarUrl provided', () => {
  // Render with userData containing avatarUrl
  // Assert img element with correct src
});

test('should open menu when avatar clicked', () => {
  // Render component
  // Click avatar button
  // Assert handleOpenUserMenu was called
  // Assert menu is visible
});

test('should render all settings menu items', () => {
  // Render with open menu
  // Assert all settings items are present
});
```

## Accessibility

- **ARIA Labels:** 
  - Avatar alt text from displayName or "User" fallback
  - Tooltip provides "Open settings" context
- **Keyboard Navigation:** 
  - IconButton supports keyboard activation (Enter/Space)
  - Menu supports arrow key navigation
  - ESC key closes menu
- **Screen Reader Support:**
  - Menu properly announced when opened
  - Menu items have clear text content

## Performance Considerations

- **Memoization:** None implemented (could benefit from React.memo)
- **Bundle Size:** Uses standard MUI components
- **Rendering:** Re-renders when userData or menu state changes
- **Image Loading:** Avatar handles image loading states automatically

## Menu Management

### Menu State
- Controlled by parent component via `anchorElUser` prop
- Opens when IconButton clicked (sets anchor element)
- Closes when clicking outside, pressing ESC, or selecting menu item

### Menu Positioning
- Anchored to the avatar IconButton
- Appears below and to the right of avatar
- Uses MUI's built-in positioning system

### Menu Content
- Dynamic based on `settings` prop array
- Currently non-functional (items don't perform actions)
- Closes menu on any item selection

## Troubleshooting

### Common Issues
1. **Avatar image not loading**
   - **Cause:** Invalid avatarUrl or CORS issues
   - **Solution:** Validate image URLs, add error handling

2. **Menu not opening**
   - **Cause:** handleOpenUserMenu not setting anchorElUser correctly
   - **Solution:** Verify event.currentTarget is passed to handler

3. **Menu positioning issues**
   - **Cause:** CSS conflicts or viewport constraints
   - **Solution:** Adjust anchorOrigin and transformOrigin values

4. **Menu items not functional**
   - **Cause:** No action handlers implemented for menu items
   - **Solution:** Add onClick handlers for each setting type

## Recent Changes

- **Current:** Basic avatar display with non-functional dropdown menu
- **Needs:** Menu item action handlers, profile editing, user settings navigation

## Related Documentation

- [NavigationLinks](./NavigationLinks.md)
- [Layout](../layout/Layout.md)
- [User Profile](../layout/HomePage.md)
- [User Management API](../../api/users.md)