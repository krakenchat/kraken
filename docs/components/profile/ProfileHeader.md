# ProfileHeader

> **Location:** `frontend/src/components/Profile/ProfileHeader.tsx`
> **Type:** UI Component (Display)
> **Feature:** profile

## Overview

`ProfileHeader` is a display component that renders a user's profile header with banner image, avatar, display name, and username. It handles authenticated image loading for both banner and avatar, provides fallback states for missing images, and creates a visually appealing Discord-like profile header layout.

**Key Features:**
- Banner image display (200px height, full width)
- Overlapping avatar (120px, positioned over banner)
- Display name and username display
- Authenticated image loading with useAuthenticatedImage
- Fallback primary color banner when no image
- Fallback initials avatar when no image
- Material-UI styled components for consistent theming

## Props Interface

```typescript
import type { User } from '@/types/auth.type';

interface ProfileHeaderProps {
  user: User;  // Required: User object with profile data
}
```

**User Type:**
```typescript
interface User {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;  // File ID
  bannerUrl?: string | null;  // File ID
  // ... other user fields
}
```

## Usage Examples

### Basic Usage

```tsx
import { ProfileHeader } from '@/components/Profile';

function ProfilePage({ user }) {
  return (
    <div>
      <ProfileHeader user={user} />
      {/* Additional profile content */}
    </div>
  );
}
```

### With RTK Query

```tsx
import { ProfileHeader } from '@/components/Profile';
import { useGetUserByIdQuery } from '@/features/users/usersSlice';

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useGetUserByIdQuery(userId);

  if (isLoading) return <Skeleton variant="rectangular" height={320} />;
  if (!user) return <div>User not found</div>;

  return <ProfileHeader user={user} />;
}
```

### In ProfilePage Component

```tsx
// From ProfilePage.tsx
import { ProfileHeader } from '@/components/Profile';
import { Paper } from '@mui/material';

function ProfilePage() {
  const { userId } = useParams();
  const { data: profileUser } = useGetUserByIdQuery(userId!);

  return (
    <Container maxWidth="md">
      <Paper>
        <ProfileHeader user={profileUser} />
      </Paper>
    </Container>
  );
}
```

## Component Structure

```tsx
<Box>
  {/* 1. Banner Section */}
  <BannerContainer>
    {bannerUrl && <BannerImage src={bannerUrl} alt="Profile banner" />}
    {/* If no banner: shows primary.dark background */}
  </BannerContainer>

  {/* 2. Profile Content Section */}
  <ProfileContent>
    {/* Avatar positioned absolutely over banner edge */}
    <AvatarContainer>
      <Avatar src={avatarUrl || undefined}>
        {/* Fallback: First 2 letters of display name/username */}
      </Avatar>
    </AvatarContainer>

    {/* User info positioned to right of avatar */}
    <Box ml={17}>
      <Typography variant="h4" fontWeight={600}>
        {user.displayName || user.username}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        @{user.username}
      </Typography>
    </Box>
  </ProfileContent>
</Box>
```

## Styled Components

### BannerContainer

```typescript
const BannerContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  height: 200,
  width: "100%",
  backgroundColor: theme.palette.primary.dark,
  borderRadius: theme.spacing(1, 1, 0, 0),
  overflow: "hidden",
}));
```

**Styling:**
- Fixed 200px height
- Full width container
- Primary dark background (fallback when no banner image)
- Top corners rounded, bottom corners square
- Overflow hidden for image cropping

### BannerImage

```typescript
const BannerImage = styled("img")({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});
```

**Styling:**
- 100% width and height (fills container)
- `object-fit: cover` - Maintains aspect ratio, crops to fit
- No border radius (handled by parent container overflow)

### ProfileContent

```typescript
const ProfileContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingTop: theme.spacing(8),
  position: "relative",
}));
```

**Styling:**
- 24px padding on all sides
- 64px padding top (accommodates avatar overlap)
- Position relative (for absolute avatar positioning)

### AvatarContainer

```typescript
const AvatarContainer = styled(Box)(() => ({
  position: "absolute",
  top: -60,
  left: 24,
}));
```

**Positioning:**
- Absolutely positioned within ProfileContent
- Top: -60px (pulls avatar up over banner edge)
- Left: 24px (standard padding alignment)
- Avatar 120px tall, so 60px overlaps banner

## Visual Layout

```
┌─────────────────────────────────────────────┐
│                                             │
│         Banner Image (200px)                │
│                                             │
│    ┌────────┐                               │ ← Avatar overlaps banner by 60px
│    │        │  Display Name                 │
│    │ Avatar │  @username                    │
│    │ 120px  │                               │
│    └────────┘                               │
│                                             │
└─────────────────────────────────────────────┘
```

**Layout Measurements:**
- Banner height: 200px
- Avatar size: 120px × 120px
- Avatar top offset: -60px (50% overlap)
- Avatar left offset: 24px
- Avatar border: 4px solid background.paper
- Content left margin: 17 spacing units (136px) to clear avatar

## Image Loading

### Authenticated Image Hooks

```tsx
const { blobUrl: bannerUrl } = useAuthenticatedImage(
  user.bannerUrl || null
);

const { blobUrl: avatarUrl } = useAuthenticatedImage(
  user.avatarUrl || null
);
```

**Loading Behavior:**
- If `user.bannerUrl` is null/undefined → `bannerUrl` is null (shows fallback)
- If file ID provided → Fetches from `/api/file/:fileId` with JWT auth
- Returns cached blob URL if already fetched (via FileCacheContext)
- Shows loading skeleton during fetch (not implemented in this component)

### Fallback States

**Banner Fallback:**
```tsx
<BannerContainer>
  {bannerUrl && <BannerImage src={bannerUrl} alt="Profile banner" />}
  {/* If no bannerUrl: shows primary.dark background color */}
</BannerContainer>
```

**Avatar Fallback:**
```tsx
<Avatar src={avatarUrl || undefined}>
  {(user.displayName || user.username).slice(0, 2).toUpperCase()}
</Avatar>
```

**Fallback Initials:**
- Takes first 2 characters of display name (or username if no display name)
- Converts to uppercase
- Example: "John Doe" → "JO", "username" → "US"

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` - Layout containers
  - `Avatar` - Profile avatar display
  - `Typography` - Text display (h4 for name, body1 for username)
  - `styled` - Component styling with theme access

- **Theme Variables:**
  - `theme.palette.primary.dark` - Banner fallback background
  - `theme.palette.primary.main` - Avatar fallback background
  - `theme.palette.text.secondary` - Username color
  - `theme.spacing()` - Consistent spacing
  - `theme.palette.background.paper` - Avatar border color

## Avatar Styling

```tsx
<Avatar
  src={avatarUrl || undefined}
  sx={{
    width: 120,
    height: 120,
    border: "4px solid",
    borderColor: "background.paper",
    bgcolor: "primary.main",
    fontSize: 48,
    fontWeight: 600,
  }}
>
  {(user.displayName || user.username).slice(0, 2).toUpperCase()}
</Avatar>
```

**Style Properties:**
- **Size**: 120px × 120px
- **Border**: 4px solid, matches page background color (creates separation from banner)
- **Background**: Primary color (when no image)
- **Font**: 48px, weight 600 (for fallback initials)

## Typography Hierarchy

```tsx
{/* Display name - Large, bold */}
<Typography variant="h4" fontWeight={600} gutterBottom>
  {user.displayName || user.username}
</Typography>

{/* Username - Smaller, secondary color */}
<Typography variant="body1" color="text.secondary">
  @{user.username}
</Typography>
```

**Text Display Logic:**
- **Display Name**: Shows `displayName` if set, otherwise falls back to `username`
- **Username**: Always shown with @ prefix

## Dependencies

### Internal Dependencies
- `@/hooks/useAuthenticatedImage` - Fetches banner and avatar images with authentication
- `@/types/auth.type` - User type definition

### External Dependencies
- `@mui/material/Box` - Layout container
- `@mui/material/Avatar` - Avatar display
- `@mui/material/Typography` - Text display
- `@mui/material/styled` - Component styling with theme

## Performance Considerations

### Image Caching

```tsx
// Both calls use FileCacheContext for automatic deduplication
const { blobUrl: bannerUrl } = useAuthenticatedImage(user.bannerUrl || null);
const { blobUrl: avatarUrl } = useAuthenticatedImage(user.avatarUrl || null);
```

**Optimization:**
- Each file ID fetched only once across entire app
- Blob URLs cached and reused
- No duplicate network requests for same file ID

### Component Memoization

```tsx
// Could be memoized if needed
const ProfileHeader: React.FC<ProfileHeaderProps> = React.memo(({ user }) => {
  // Component implementation
});
```

**Memoization Benefits:**
- Prevents re-render when parent re-renders for unrelated reasons
- User object reference must be stable for effective memoization

## Accessibility

- **Image Alt Text**: Banner has descriptive alt text
- **Avatar Fallback**: Initials provide accessible alternative
- **Semantic HTML**: Uses proper heading hierarchy (h4 for name)
- **Color Contrast**: Text colors meet accessibility standards

## Common Patterns

### Pattern 1: Profile Card

```tsx
function ProfileCard({ userId }) {
  const { data: user } = useGetUserByIdQuery(userId);

  return (
    <Paper elevation={3}>
      <ProfileHeader user={user} />
      <Box p={3}>
        {/* Additional profile information */}
      </Box>
    </Paper>
  );
}
```

### Pattern 2: Profile Modal

```tsx
function ProfileModal({ user, open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <ProfileHeader user={user} />
      <DialogContent>
        {/* Profile details */}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
```

### Pattern 3: Profile Hover Card

```tsx
function UserHoverCard({ user }) {
  return (
    <Popover>
      <Paper sx={{ width: 400 }}>
        <ProfileHeader user={user} />
        <Box p={2}>
          <Typography variant="body2">
            Bio or additional info
          </Typography>
        </Box>
      </Paper>
    </Popover>
  );
}
```

## Testing

### Test Examples

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme';

describe('ProfileHeader', () => {
  const mockUser = {
    id: 'user-123',
    username: 'johndoe',
    displayName: 'John Doe',
    avatarUrl: 'file-avatar-123',
    bannerUrl: 'file-banner-456',
  };

  const renderWithTheme = (component) => {
    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    );
  };

  it('should render user display name', () => {
    renderWithTheme(<ProfileHeader user={mockUser} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render username with @ prefix', () => {
    renderWithTheme(<ProfileHeader user={mockUser} />);
    expect(screen.getByText('@johndoe')).toBeInTheDocument();
  });

  it('should use username as fallback for display name', () => {
    const userWithoutDisplayName = { ...mockUser, displayName: null };
    renderWithTheme(<ProfileHeader user={userWithoutDisplayName} />);
    expect(screen.getByText('johndoe')).toBeInTheDocument();
  });

  it('should render banner image when URL provided', async () => {
    // Mock useAuthenticatedImage to return blob URL
    jest.mock('@/hooks/useAuthenticatedImage', () => ({
      useAuthenticatedImage: (fileId) => ({
        blobUrl: fileId ? `blob:http://localhost/${fileId}` : null,
        isLoading: false,
        error: null,
      }),
    }));

    renderWithTheme(<ProfileHeader user={mockUser} />);

    await waitFor(() => {
      const bannerImg = screen.getByAltText('Profile banner');
      expect(bannerImg).toHaveAttribute('src', expect.stringContaining('blob'));
    });
  });

  it('should render avatar with fallback initials', () => {
    const userWithoutAvatar = { ...mockUser, avatarUrl: null };
    renderWithTheme(<ProfileHeader user={userWithoutAvatar} />);

    // Avatar should show "JO" (first 2 letters of "John Doe")
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('should use first 2 chars of username for initials when no display name', () => {
    const userWithoutDisplayName = {
      ...mockUser,
      displayName: null,
      avatarUrl: null,
    };
    renderWithTheme(<ProfileHeader user={userWithoutDisplayName} />);

    // Should show "JO" from "johndoe"
    expect(screen.getByText('JO')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **Banner or avatar not loading**
   - **Cause:** Invalid file ID or authentication failure
   - **Solution:** Check that file IDs exist and `/api/file/:fileId` is accessible

   ```tsx
   // Debug: Check file IDs and blob URLs
   console.log('Banner file ID:', user.bannerUrl);
   console.log('Avatar file ID:', user.avatarUrl);
   console.log('Banner blob URL:', bannerUrl);
   console.log('Avatar blob URL:', avatarUrl);
   ```

2. **Avatar not overlapping banner**
   - **Cause:** CSS positioning or spacing issues
   - **Solution:** Verify AvatarContainer top offset and ProfileContent paddingTop

   ```tsx
   // Avatar should overlap by 60px
   top: -60px  // in AvatarContainer
   paddingTop: theme.spacing(8)  // 64px in ProfileContent
   ```

3. **Text cut off by avatar**
   - **Cause:** Insufficient left margin on user info
   - **Solution:** Adjust ml (margin-left) on text container

   ```tsx
   // Current: ml={17} (136px)
   // If avatar changes size, adjust this value
   <Box ml={17}>
     <Typography>{displayName}</Typography>
   </Box>
   ```

4. **Banner image distorted**
   - **Cause:** `object-fit: cover` may crop incorrectly for extreme aspect ratios
   - **Solution:** Use recommended banner dimensions (600×200 or similar 3:1 ratio)

   ```tsx
   // BannerImage uses object-fit: cover
   // Works best with 3:1 aspect ratio images
   ```

5. **Missing fallback initials**
   - **Cause:** Both `displayName` and `username` are empty/null
   - **Solution:** Ensure at least `username` is always present (required field)

   ```tsx
   // Username should always exist (required by User type)
   {(user.displayName || user.username).slice(0, 2).toUpperCase()}
   ```

### Best Practices

- **Banner Dimensions**: Recommend 600×200 or similar 3:1 aspect ratio
- **Avatar Dimensions**: Works best with square images
- **File IDs**: Always pass file IDs (not blob URLs) in user object
- **Theme Consistency**: Use theme variables for colors, not hardcoded values
- **Accessibility**: Ensure alt text is descriptive for images
- **Error States**: Consider adding error boundaries for failed image loads

## Related Components

- **Parent Components:**
  - `ProfilePage` - Uses ProfileHeader to display user profile

- **Similar Components:**
  - `UserAvatar` - Smaller avatar component used throughout app
  - `CommunityHeader` - Similar pattern for community banners (if exists)

- **Related Components:**
  - `ProfileEditPage` - Allows editing of displayed data
  - `UserAvatarUpload` - Upload component for avatar
  - `UserBannerUpload` - Upload component for banner

## Recent Changes

- **2025-01-05:** Initial implementation for profile viewing
- **2025-01-05:** Integrated useAuthenticatedImage for banner and avatar
- **2025-01-05:** Added fallback states for missing images
- **2025-01-05:** Styled with Material-UI and theme variables

## Related Documentation

- [ProfilePage Component](./ProfilePage.md) - Parent page component
- [UserAvatar Component](../common/UserAvatar.md) - Unified avatar component
- [useAuthenticatedImage Hook](../../hooks/useAuthenticatedImage.md) - Image loading
- [User API](../../api/user.md) - User endpoints
- [User Profiles Feature](../../features/user-profiles.md) - Feature overview
