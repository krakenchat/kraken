# UserBannerUpload

> **Location:** `frontend/src/components/Profile/UserBannerUpload.tsx`
> **Type:** Form Input Component (File Upload)
> **Feature:** profile

## Overview

`UserBannerUpload` is a specialized file upload component for user profile banner images. It displays a large rectangular upload area (200px height), shows previews of selected files, handles both local blob previews and authenticated image loading for existing banners, and provides visual feedback with upload icon and recommended dimensions.

**Key Features:**
- Large rectangular upload area (full width × 200px height)
- Click-to-upload interface with visual feedback
- Dual preview modes: local blob URLs for new selections, authenticated URLs for existing banners
- Upload icon and instructional text when no image
- Recommended dimensions display (600×200px)
- Memoized for performance (React.memo)
- Accessible file input with label association
- Hover state for better UX

## Props Interface

```typescript
interface UserBannerUploadProps {
  previewUrl: string | null;     // Blob URL (local) or file ID (existing)
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
```

**Props Details:**

- **`previewUrl`** - Banner image URL or file ID
  - Local blob URL (starts with `"blob:"`) - Shows immediate preview of newly selected file
  - File ID (e.g., `"file-abc-123"`) - Existing banner, fetched via useAuthenticatedImage
  - `null` - No banner, shows upload prompt

- **`onChange`** - File input change handler
  - Called when user selects a new image file
  - Parent should handle file storage and blob URL creation

## Usage Examples

### Basic Usage

```tsx
import UserBannerUpload from '@/components/Profile/UserBannerUpload';

function ProfileForm() {
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <UserBannerUpload
      previewUrl={previewUrl}
      onChange={handleBannerChange}
    />
  );
}
```

### With useProfileForm Hook

```tsx
import UserBannerUpload from '@/components/Profile/UserBannerUpload';
import { useProfileForm } from '@/hooks/useProfileForm';

function ProfileEditor() {
  const {
    previewUrls,
    handleInputChange,
  } = useProfileForm();

  return (
    <UserBannerUpload
      previewUrl={previewUrls.banner}
      onChange={handleInputChange("banner")}
    />
  );
}
```

### Integration in ProfileEditForm

```tsx
// From ProfileEditForm.tsx
import UserBannerUpload from './UserBannerUpload';

function ProfileEditForm({ formData, previewUrls, onBannerChange }) {
  return (
    <Box>
      {/* Banner upload at top */}
      <UserBannerUpload
        previewUrl={previewUrls.banner}
        onChange={onBannerChange}
      />

      {/* Avatar and other fields below */}
      <UserAvatarUpload {...avatarProps} />
      <TextField {...displayNameProps} />
    </Box>
  );
}
```

### With Existing Banner (File ID)

```tsx
function EditWithExistingBanner() {
  const { data: user } = useProfileQuery();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Initialize with existing banner file ID
    setPreviewUrl(user?.bannerUrl || null);
  }, [user]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Replace with new local preview
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <UserBannerUpload
      previewUrl={previewUrl}
      onChange={handleChange}
    />
  );
}
```

## Component Structure

```tsx
<BannerSection>
  {/* Hidden file input */}
  <BannerInput
    accept="image/*"
    id="banner-upload"
    type="file"
    onChange={onChange}
  />

  {/* Click area (entire banner) */}
  <label htmlFor="banner-upload" style={{ /* full size */ }}>
    {displayUrl ? (
      // Image preview
      <BannerPreview src={displayUrl} alt="Banner preview" />
    ) : (
      // Upload prompt
      <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
        <Upload sx={{ fontSize: 48, color: "text.secondary" }} />
        <Typography variant="body2" color="text.secondary">
          Click to upload banner image
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Recommended: 600x200px
        </Typography>
      </Box>
    )}
  </label>
</BannerSection>
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
2. **Existing banner** → `previewUrl` = `"file-abc-123"` → Fetch via useAuthenticatedImage
3. **No banner** → `previewUrl` = `null` → Show upload prompt

**Why Dual Mode?**
- Local blobs provide instant preview without network delay
- File IDs require authentication and fetching
- Prevents unnecessary fetches for local previews

## Styled Components

### BannerSection

```typescript
const BannerSection = styled(Box)(({ theme }) => ({
  position: "relative",
  height: 200,
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(3),
  border: `2px dashed ${theme.palette.divider}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: theme.palette.background.default,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));
```

**Styling:**
- **Height**: 200px (matches ProfileHeader banner height)
- **Border**: 2px dashed divider color (indicates upload area)
- **Cursor**: Pointer (indicates clickable)
- **Hover**: Light background color change
- **Overflow**: Hidden (crops image to container)
- **Layout**: Flexbox center for upload prompt

### BannerPreview

```typescript
const BannerPreview = styled("img")({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});
```

**Styling:**
- **Size**: 100% width and height (fills container)
- **Object Fit**: Cover (maintains aspect ratio, crops to fit)
- **Result**: Banner image fills 200px height, may crop sides

### BannerInput

```typescript
const BannerInput = styled("input")({
  display: "none",
});
```

**Hidden Input:**
- Visually hidden but accessible
- Triggered by label click
- Standard pattern for custom file input UI

## Upload Prompt Design

### Empty State (No Banner)

```tsx
<Box display="flex" flexDirection="column" alignItems="center" gap={1}>
  {/* Large upload icon */}
  <Upload sx={{ fontSize: 48, color: "text.secondary" }} />

  {/* Primary instruction */}
  <Typography variant="body2" color="text.secondary">
    Click to upload banner image
  </Typography>

  {/* Recommended dimensions */}
  <Typography variant="caption" color="text.disabled">
    Recommended: 600x200px
  </Typography>
</Box>
```

**Visual Hierarchy:**
1. **Upload Icon** (48px) - Large, immediately recognizable
2. **Instruction Text** (body2) - Clear action prompt
3. **Dimensions Hint** (caption) - Smaller, secondary info

### Preview State (With Banner)

```tsx
<BannerPreview src={displayUrl} alt="Banner preview" />
```

**Behavior:**
- Image fills entire area
- Clicking image allows changing banner
- No visible UI controls (clean preview)

## Recommended Dimensions

### Why 600×200?

```
Aspect Ratio: 3:1
Display Height: 200px
Display Width: Varies (responsive, but typically 600-900px)
```

**Rationale:**
- Matches ProfileHeader banner display (200px height)
- 3:1 aspect ratio prevents excessive cropping
- 600px minimum width ensures quality on most screens
- Scales well on larger displays

### User Guidance

```tsx
<Typography variant="caption" color="text.disabled">
  Recommended: 600x200px
</Typography>
```

**Benefits:**
- Helps users select appropriate images
- Reduces extreme aspect ratio issues
- Improves visual consistency across profiles

## Label Click Area

### Full-Size Clickable Area

```tsx
<label
  htmlFor="banner-upload"
  style={{
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  {/* Content */}
</label>
```

**UX Benefits:**
- Entire 200px height is clickable (large target)
- Full width provides generous click area
- Intuitive - users can click anywhere on banner

## Memoization

```tsx
const UserBannerUpload: React.FC<UserBannerUploadProps> = React.memo(({
  previewUrl,
  onChange,
}) => {
  // Component implementation
});

UserBannerUpload.displayName = "UserBannerUpload";
```

**Benefits:**
- Prevents re-render when parent re-renders for unrelated reasons
- Props should be stable or memoized
- Display name set for better debugging

## Dependencies

### Internal Dependencies
- `@/hooks/useAuthenticatedImage` - Fetches existing banner images with authentication

### External Dependencies
- `@mui/material/Box` - Layout container
- `@mui/material/Typography` - Text display
- `@mui/icons-material/Upload` - Upload icon
- `@mui/material/styled` - Component styling

## Performance Considerations

### Optimizations

1. **React.memo** - Prevents unnecessary re-renders
2. **Conditional Fetching** - Only fetches authenticated images when needed
3. **Blob URL Caching** - FileCacheContext prevents duplicate fetches
4. **Local Preview** - New files shown instantly without upload

### Rendering Performance

- **Small Component**: Minimal JSX, fast rendering
- **Cached Images**: Existing banners fetched once, reused
- **Simple Logic**: String check for blob vs file ID

## File Input Pattern

### Accessibility

```tsx
{/* Hidden but accessible input */}
<BannerInput
  accept="image/*"
  id="banner-upload"
  type="file"
  onChange={onChange}
/>

{/* Label triggers input and spans full area */}
<label htmlFor="banner-upload" style={{ width: "100%", height: "100%" }}>
  {/* Visual content */}
</label>
```

**Pattern Benefits:**
- Native file input accessible to screen readers
- Custom UI for visual users
- Label association provides large click target
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

### Pattern 1: Standalone Banner Upload

```tsx
function StandaloneBannerUpload() {
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
    <UserBannerUpload
      previewUrl={preview}
      onChange={handleChange}
    />
  );
}
```

### Pattern 2: Upload with Validation

```tsx
function ValidatedBannerUpload() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("File must be an image");
      return;
    }

    // Optionally validate dimensions
    const img = new Image();
    img.onload = () => {
      if (img.width < 600 || img.height < 200) {
        setError("Image must be at least 600x200 pixels");
        return;
      }
      setError(null);
      setPreview(URL.createObjectURL(file));
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div>
      <UserBannerUpload
        previewUrl={preview}
        onChange={handleChange}
      />
      {error && <Typography color="error">{error}</Typography>}
    </div>
  );
}
```

### Pattern 3: Clear/Reset Banner

```tsx
function BannerUploadWithClear() {
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleClear = () => {
    setPreview(null);
    // Clear file input
    const input = document.getElementById("banner-upload") as HTMLInputElement;
    if (input) input.value = "";
  };

  return (
    <div>
      <UserBannerUpload
        previewUrl={preview}
        onChange={handleChange}
      />
      {preview && (
        <Button onClick={handleClear} variant="text" color="error">
          Remove Banner
        </Button>
      )}
    </div>
  );
}
```

## Testing

### Test Examples

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserBannerUpload from './UserBannerUpload';

describe('UserBannerUpload', () => {
  const defaultProps = {
    previewUrl: null,
    onChange: jest.fn(),
  };

  it('should render upload prompt when no preview', () => {
    render(<UserBannerUpload {...defaultProps} />);
    expect(screen.getByText('Click to upload banner image')).toBeInTheDocument();
    expect(screen.getByText('Recommended: 600x200px')).toBeInTheDocument();
  });

  it('should render upload icon', () => {
    render(<UserBannerUpload {...defaultProps} />);
    // Upload icon from MUI should be present
    const uploadIcon = screen.getByTestId('UploadIcon'); // Adjust based on MUI implementation
    expect(uploadIcon).toBeInTheDocument();
  });

  it('should call onChange when file selected', () => {
    const onChange = jest.fn();
    render(<UserBannerUpload {...defaultProps} onChange={onChange} />);

    const file = new File(['banner'], 'banner.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

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
    render(<UserBannerUpload {...defaultProps} previewUrl={blobUrl} />);

    const preview = screen.getByAltText('Banner preview');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', blobUrl);
  });

  it('should not show upload prompt when preview exists', () => {
    const blobUrl = "blob:http://localhost/abc-123";
    render(<UserBannerUpload {...defaultProps} previewUrl={blobUrl} />);

    expect(screen.queryByText('Click to upload banner image')).not.toBeInTheDocument();
  });

  it('should fetch authenticated image for file ID', async () => {
    const fileId = "file-banner-123";

    // Mock useAuthenticatedImage
    jest.mock('@/hooks/useAuthenticatedImage', () => ({
      useAuthenticatedImage: (id) => ({
        blobUrl: id ? `blob:authenticated-${id}` : null,
        isLoading: false,
        error: null,
      }),
    }));

    render(<UserBannerUpload {...defaultProps} previewUrl={fileId} />);

    await waitFor(() => {
      const preview = screen.getByAltText('Banner preview');
      expect(preview).toHaveAttribute('src', expect.stringContaining('authenticated'));
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **File input not triggering**
   - **Cause:** Label not associated with input, or input ID mismatch
   - **Solution:** Ensure label `htmlFor` matches input `id`

   ```tsx
   <BannerInput id="banner-upload" type="file" onChange={onChange} />
   <label htmlFor="banner-upload">{/* Content */}</label>
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

3. **Existing banner not loading**
   - **Cause:** File ID not fetched via useAuthenticatedImage
   - **Solution:** Ensure previewUrl is file ID (not blob URL) for existing banners

   ```tsx
   // ❌ Wrong - passing blob URL for existing banner
   <UserBannerUpload previewUrl="blob:..." />

   // ✅ Correct - passing file ID
   <UserBannerUpload previewUrl="file-abc-123" />
   ```

4. **Banner image distorted or cropped badly**
   - **Cause:** Image aspect ratio very different from 3:1
   - **Solution:** Guide users to upload 600×200 (3:1) images

   ```tsx
   // Already displayed in component
   <Typography variant="caption">Recommended: 600x200px</Typography>
   ```

5. **Click area not responsive**
   - **Cause:** Label not styled to fill container
   - **Solution:** Ensure label has full width/height

   ```tsx
   <label
     htmlFor="banner-upload"
     style={{
       width: "100%",
       height: "100%",
       display: "flex",
       // ...
     }}
   >
   ```

### Best Practices

- **Blob URL Cleanup**: Parent should revoke blob URLs when component unmounts
- **File Validation**: Validate file size and type before upload
- **Dimension Guidance**: Show recommended dimensions prominently
- **Error Handling**: Display user-friendly error messages for invalid files
- **Accessibility**: Keep input in DOM (hidden) for screen reader access
- **Image Optimization**: Consider backend image resizing/optimization
- **File Size Limits**: Suggest reasonable limits (e.g., 10MB max)
- **Aspect Ratio**: Recommend 3:1 (width:height) for best display

## Related Components

- **Parent Components:**
  - `ProfileEditForm` - Uses this component for banner upload
  - `ProfileEditPage` - Manages form state including banner

- **Similar Components:**
  - `UserAvatarUpload` - Avatar upload with similar pattern
  - `CommunityBannerUpload` - Similar component for community banners (if exists)

- **Related Components:**
  - `ProfileHeader` - Displays uploaded banner in profile view

## Recent Changes

- **2025-01-05:** Initial implementation for profile editing
- **2025-01-05:** Added dual-mode preview (local blob + authenticated fetch)
- **2025-01-05:** Memoized component for performance
- **2025-01-05:** Added recommended dimensions guidance (600×200px)
- **2025-01-05:** Implemented hover state for better UX

## Related Documentation

- [ProfileEditForm Component](./ProfileEditForm.md) - Parent form component
- [ProfileEditPage Component](./ProfileEditPage.md) - Page container
- [UserAvatarUpload Component](./UserAvatarUpload.md) - Similar upload component
- [ProfileHeader Component](./ProfileHeader.md) - Displays banner in profile view
- [useProfileForm Hook](../../hooks/useProfileForm.md) - Form state management
- [useAuthenticatedImage Hook](../../hooks/useAuthenticatedImage.md) - Image loading
- [User Profiles Feature](../../features/user-profiles.md) - Feature overview
