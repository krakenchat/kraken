# UserAvatarUpload

> **Location:** `frontend/src/components/Profile/UserAvatarUpload.tsx`
> **Type:** Form Input Component (File Upload)
> **Feature:** profile

## Overview

`UserAvatarUpload` is a specialized file upload component for user avatar images. It displays a large circular avatar (120px) with a camera icon button overlay, shows preview of selected files, handles both local blob previews and authenticated image loading for existing avatars, and provides a clean interface for avatar selection in profile editing forms.

**Key Features:**
- Large circular avatar display (120px)
- Camera icon button for file selection
- Dual preview modes: local blob URLs for new selections, authenticated URLs for existing avatars
- Fallback initials when no avatar image
- Memoized for performance (React.memo)
- Accessible file input with label association
- Upload prompt text

## Props Interface

```typescript
interface UserAvatarUploadProps {
  previewUrl: string | null;     // Blob URL (local) or file ID (existing)
  displayName: string;            // For fallback initials
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
```

**Props Details:**

- **`previewUrl`** - Avatar image URL or file ID
  - Local blob URL (starts with `"blob:"`) - Shows immediate preview of newly selected file
  - File ID (e.g., `"file-abc-123"`) - Existing avatar, fetched via useAuthenticatedImage
  - `null` - No avatar, shows fallback initials

- **`displayName`** - User's display name
  - Used to generate fallback initials (first 2 uppercase characters)
  - Example: "John Doe" → "JO"

- **`onChange`** - File input change handler
  - Called when user selects a new image file
  - Parent should handle file storage and blob URL creation

## Usage Examples

### Basic Usage

```tsx
import UserAvatarUpload from '@/components/Profile/UserAvatarUpload';

function ProfileForm() {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <UserAvatarUpload
      previewUrl={previewUrl}
      displayName="John Doe"
      onChange={handleAvatarChange}
    />
  );
}
```

### With useProfileForm Hook

```tsx
import UserAvatarUpload from '@/components/Profile/UserAvatarUpload';
import { useProfileForm } from '@/hooks/useProfileForm';

function ProfileEditor() {
  const {
    formData,
    previewUrls,
    handleInputChange,
  } = useProfileForm("John Doe");

  return (
    <UserAvatarUpload
      previewUrl={previewUrls.avatar}
      displayName={formData.displayName}
      onChange={handleInputChange("avatar")}
    />
  );
}
```

### Integration in ProfileEditForm

```tsx
// From ProfileEditForm.tsx
import UserAvatarUpload from './UserAvatarUpload';

function ProfileEditForm({ formData, previewUrls, onAvatarChange }) {
  return (
    <Box>
      <UserBannerUpload {...bannerProps} />

      <UserAvatarUpload
        previewUrl={previewUrls.avatar}
        displayName={formData.displayName}
        onChange={onAvatarChange}
      />

      <TextField {...displayNameProps} />
    </Box>
  );
}
```

### With Existing Avatar (File ID)

```tsx
function EditWithExistingAvatar() {
  const { data: user } = useProfileQuery();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Initialize with existing avatar file ID
    setPreviewUrl(user?.avatarUrl || null);
  }, [user]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Replace with new local preview
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <UserAvatarUpload
      previewUrl={previewUrl}
      displayName={user?.displayName || user?.username || ""}
      onChange={handleChange}
    />
  );
}
```

## Component Structure

```tsx
<AvatarSection>
  {/* Avatar with overlay button */}
  <AvatarUpload>
    {/* Large circular avatar */}
    <Avatar src={displayUrl || undefined}>
      {displayName.slice(0, 2).toUpperCase() || "U"}
    </Avatar>

    {/* Hidden file input */}
    <AvatarInput
      accept="image/*"
      id="avatar-upload"
      type="file"
      onChange={onChange}
    />

    {/* Camera button overlay */}
    <label htmlFor="avatar-upload">
      <IconButton component="span">
        <PhotoCamera />
      </IconButton>
    </label>
  </AvatarUpload>

  {/* Upload prompt text */}
  <Typography variant="body2" color="text.secondary">
    Upload a profile picture
  </Typography>
</AvatarSection>
```

## Preview URL Logic

### Dual Mode Display

```tsx
// Check if previewUrl is a local blob URL or a file ID
const isLocalBlob = previewUrl?.startsWith("blob:");

// Only fetch authenticated image if it's NOT a local blob AND previewUrl exists
const { blobUrl: authenticatedUrl } = useAuthenticatedImage(
  !isLocalBlob && previewUrl ? previewUrl : null
);

// Use local blob for previews, authenticated URL for existing images
const displayUrl = isLocalBlob ? previewUrl : authenticatedUrl;
```

**Logic Flow:**
1. **New file selected** → `previewUrl` = `"blob:http://localhost/xyz"` → Use directly
2. **Existing avatar** → `previewUrl` = `"file-abc-123"` → Fetch via useAuthenticatedImage
3. **No avatar** → `previewUrl` = `null` → Show fallback initials

**Why Dual Mode?**
- Local blobs provide instant preview without network delay
- File IDs require authentication and fetching
- Prevents unnecessary fetches for local previews

### Flow Diagram

```
User Selects File
       ↓
onChange handler creates blob URL
       ↓
previewUrl = "blob:http://..."
       ↓
isLocalBlob = true
       ↓
Display blob URL directly (no fetch)
```

```
Existing Avatar
       ↓
previewUrl = "file-abc-123"
       ↓
isLocalBlob = false
       ↓
useAuthenticatedImage fetches file
       ↓
Display authenticated blob URL
```

## Styled Components

### AvatarSection

```typescript
const AvatarSection = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
}));
```

**Layout:**
- Horizontal flexbox (avatar + text side-by-side)
- 16px gap between avatar and text
- 24px bottom margin

### AvatarUpload

```typescript
const AvatarUpload = styled(Box)(() => ({
  position: "relative",
  display: "inline-block",
}));
```

**Purpose:**
- Position relative for absolute button positioning
- Inline-block to wrap avatar size

### AvatarInput

```typescript
const AvatarInput = styled("input")({
  display: "none",
});
```

**Hidden Input:**
- Visually hidden but accessible
- Triggered by label click
- Standard pattern for custom file input UI

## Avatar Styling

```tsx
<Avatar
  src={displayUrl || undefined}
  sx={{
    width: 120,
    height: 120,
    bgcolor: "primary.main",
    fontSize: 48,
    fontWeight: 600,
  }}
>
  {displayName.slice(0, 2).toUpperCase() || "U"}
</Avatar>
```

**Style Properties:**
- **Size**: 120px × 120px (large, profile edit size)
- **Background**: Primary color for fallback
- **Font**: 48px bold for initials (large for readability)
- **Fallback**: "U" if displayName is empty

## Camera Button Overlay

```tsx
<label htmlFor="avatar-upload">
  <IconButton
    component="span"
    sx={{
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: "background.paper",
      border: "2px solid",
      borderColor: "divider",
      "&:hover": {
        backgroundColor: "grey.100",
      },
    }}
  >
    <PhotoCamera />
  </IconButton>
</label>
```

**Button Positioning:**
- Absolutely positioned at bottom-right of avatar
- Background matches page background (stands out from avatar)
- 2px border for definition
- Hover state changes background to light grey

**Accessibility:**
- Label wraps IconButton and associates with hidden input
- Clicking button triggers file input
- Keyboard accessible via label/input association

## Fallback Initials Logic

```tsx
{displayName.slice(0, 2).toUpperCase() || "U"}
```

**Behavior:**
- Takes first 2 characters of displayName
- Converts to uppercase
- Falls back to "U" if displayName is empty
- Examples:
  - "John Doe" → "JO"
  - "alice" → "AL"
  - "" → "U"

## Memoization

```tsx
const UserAvatarUpload: React.FC<UserAvatarUploadProps> = React.memo(({
  previewUrl,
  displayName,
  onChange,
}) => {
  // Component implementation
});

UserAvatarUpload.displayName = "UserAvatarUpload";
```

**Benefits:**
- Prevents re-render when parent re-renders for unrelated reasons
- Props should be stable or memoized
- Display name set for better debugging

## Dependencies

### Internal Dependencies
- `@/hooks/useAuthenticatedImage` - Fetches existing avatar images with authentication

### External Dependencies
- `@mui/material/Box` - Layout container
- `@mui/material/Typography` - Text display
- `@mui/material/Avatar` - Avatar component
- `@mui/material/IconButton` - Camera button
- `@mui/icons-material/PhotoCamera` - Camera icon
- `@mui/material/styled` - Component styling

## Performance Considerations

### Optimizations

1. **React.memo** - Prevents unnecessary re-renders
2. **Conditional Fetching** - Only fetches authenticated images when needed
3. **Blob URL Caching** - FileCacheContext prevents duplicate fetches
4. **Local Preview** - New files shown instantly without upload

### Rendering Performance

- **Small Component**: Minimal JSX, fast rendering
- **Cached Images**: Existing avatars fetched once, reused
- **No Heavy Computation**: Simple string checks and slicing

## File Input Pattern

### Accessibility

```tsx
{/* Hidden but accessible input */}
<input
  accept="image/*"
  id="avatar-upload"
  type="file"
  style={{ display: "none" }}
/>

{/* Label triggers input */}
<label htmlFor="avatar-upload">
  <IconButton component="span">
    <PhotoCamera />
  </IconButton>
</label>
```

**Pattern Benefits:**
- Native file input accessible to screen readers
- Custom UI button for visual users
- Label association provides click target
- Standard HTML pattern

### File Type Restriction

```tsx
accept="image/*"
```

**Behavior:**
- File picker shows only image files by default
- Users can still select "All Files" if desired
- Backend should validate file types for security

## Common Patterns

### Pattern 1: Standalone Avatar Upload

```tsx
function StandaloneAvatarUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  return (
    <UserAvatarUpload
      previewUrl={preview}
      displayName="User"
      onChange={handleChange}
    />
  );
}
```

### Pattern 2: Upload with Validation

```tsx
function ValidatedAvatarUpload() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("File must be an image");
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div>
      <UserAvatarUpload
        previewUrl={preview}
        displayName="User"
        onChange={handleChange}
      />
      {error && <Typography color="error">{error}</Typography>}
    </div>
  );
}
```

### Pattern 3: Clear/Reset Avatar

```tsx
function AvatarUploadWithClear() {
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleClear = () => {
    setPreview(null);
    // Also clear file input
    const input = document.getElementById("avatar-upload") as HTMLInputElement;
    if (input) input.value = "";
  };

  return (
    <div>
      <UserAvatarUpload
        previewUrl={preview}
        displayName="User"
        onChange={handleChange}
      />
      {preview && (
        <Button onClick={handleClear}>Remove Avatar</Button>
      )}
    </div>
  );
}
```

## Testing

### Test Examples

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserAvatarUpload from './UserAvatarUpload';

describe('UserAvatarUpload', () => {
  const defaultProps = {
    previewUrl: null,
    displayName: "John Doe",
    onChange: jest.fn(),
  };

  it('should render avatar with fallback initials', () => {
    render(<UserAvatarUpload {...defaultProps} />);
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('should render upload prompt text', () => {
    render(<UserAvatarUpload {...defaultProps} />);
    expect(screen.getByText('Upload a profile picture')).toBeInTheDocument();
  });

  it('should call onChange when file selected', () => {
    const onChange = jest.fn();
    render(<UserAvatarUpload {...defaultProps} onChange={onChange} />);

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload a profile picture/i, { selector: 'input' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          files: expect.arrayContaining([file])
        })
      })
    );
  });

  it('should display local blob preview', () => {
    const blobUrl = "blob:http://localhost/abc-123";
    render(<UserAvatarUpload {...defaultProps} previewUrl={blobUrl} />);

    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('src', blobUrl);
  });

  it('should fetch authenticated image for file ID', async () => {
    const fileId = "file-avatar-123";

    // Mock useAuthenticatedImage
    jest.mock('@/hooks/useAuthenticatedImage', () => ({
      useAuthenticatedImage: (id) => ({
        blobUrl: id ? `blob:authenticated-${id}` : null,
        isLoading: false,
        error: null,
      }),
    }));

    render(<UserAvatarUpload {...defaultProps} previewUrl={fileId} />);

    await waitFor(() => {
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', expect.stringContaining('authenticated'));
    });
  });

  it('should use "U" fallback when displayName is empty', () => {
    render(<UserAvatarUpload {...defaultProps} displayName="" />);
    expect(screen.getByText('U')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **File input not triggering**
   - **Cause:** Label not associated with input, or input ID mismatch
   - **Solution:** Ensure label `htmlFor` matches input `id`

   ```tsx
   <AvatarInput id="avatar-upload" type="file" onChange={onChange} />
   <label htmlFor="avatar-upload">{/* Button */}</label>
   ```

2. **Preview not showing after file selection**
   - **Cause:** Parent not creating blob URL or updating previewUrl prop
   - **Solution:** Create blob URL in onChange handler

   ```tsx
   const handleChange = (e) => {
     const file = e.target.files[0];
     if (file) {
       setPreviewUrl(URL.createObjectURL(file));
     }
   };
   ```

3. **Existing avatar not loading**
   - **Cause:** File ID not fetched via useAuthenticatedImage
   - **Solution:** Ensure previewUrl is file ID (not blob URL) for existing avatars

   ```tsx
   // ❌ Wrong - passing blob URL for existing avatar
   <UserAvatarUpload previewUrl="blob:..." />

   // ✅ Correct - passing file ID
   <UserAvatarUpload previewUrl="file-abc-123" />
   ```

4. **Camera button not clickable**
   - **Cause:** z-index or pointer-events issue
   - **Solution:** Ensure button not blocked by other elements

   ```tsx
   // Button should be position: absolute with proper z-index
   sx={{ position: "absolute", bottom: 0, right: 0 }}
   ```

5. **Fallback initials showing wrong characters**
   - **Cause:** displayName prop not updated or empty
   - **Solution:** Ensure displayName prop receives current value

   ```tsx
   <UserAvatarUpload
     displayName={formData.displayName}  // Must be current value
     {...otherProps}
   />
   ```

### Best Practices

- **Blob URL Cleanup**: Parent should revoke blob URLs when component unmounts
- **File Validation**: Validate file size and type before upload
- **Error Handling**: Show user-friendly error messages for invalid files
- **Accessibility**: Keep input in DOM (hidden) for screen reader access
- **Image Dimensions**: Recommend square images for best display
- **File Size**: Suggest reasonable limits (e.g., 5MB max)

## Related Components

- **Parent Components:**
  - `ProfileEditForm` - Uses this component for avatar upload
  - `ProfileEditPage` - Manages form state including avatar

- **Similar Components:**
  - `UserBannerUpload` - Banner upload with similar pattern
  - `UserAvatar` - Display-only avatar component

- **Related Components:**
  - `ProfileHeader` - Displays uploaded avatar in profile view

## Recent Changes

- **2025-01-05:** Initial implementation for profile editing
- **2025-01-05:** Added dual-mode preview (local blob + authenticated fetch)
- **2025-01-05:** Memoized component for performance
- **2025-01-05:** Added camera icon overlay for file selection

## Related Documentation

- [ProfileEditForm Component](./ProfileEditForm.md) - Parent form component
- [ProfileEditPage Component](./ProfileEditPage.md) - Page container
- [UserBannerUpload Component](./UserBannerUpload.md) - Similar upload component
- [useProfileForm Hook](../../hooks/useProfileForm.md) - Form state management
- [useAuthenticatedImage Hook](../../hooks/useAuthenticatedImage.md) - Image loading
- [User Profiles Feature](../../features/user-profiles.md) - Feature overview
