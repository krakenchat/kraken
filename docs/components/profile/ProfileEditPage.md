# ProfileEditPage

> **Location:** `frontend/src/pages/ProfileEditPage.tsx`
> **Type:** Page Component (Container)
> **Feature:** profile

## Overview

`ProfileEditPage` is the profile editing interface that allows authenticated users to update their display name, avatar, and banner image. This page component orchestrates form state management, file uploads, profile updates via RTK Query, and navigation. It provides a complete user experience with loading states, error handling, and automatic navigation after successful profile updates.

**Key Features:**
- Display name editing with validation
- Avatar image upload with live preview
- Banner image upload with live preview
- Multi-step process: file upload → profile update → navigation
- Loading states during uploads and mutations
- Error display for failed operations
- Navigation to profile view after save

## Component Structure

```
ProfileEditPage
├── useProfileQuery (RTK Query - fetch current user)
├── useUpdateProfileMutation (RTK Query - save profile changes)
├── useFileUpload (custom hook - upload files)
├── useProfileForm (custom hook - form state)
└── ProfileEditForm (presentation component)
```

## Props Interface

```typescript
// This is a page component with no props
// It uses route-based rendering via React Router
```

**Route Configuration:**
```tsx
// In App.tsx or routes configuration
<Route path="/profile/edit" element={<ProfileEditPage />} />
```

## Usage Examples

### Basic Usage - Route Integration

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProfileEditPage from '@/pages/ProfileEditPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        {/* other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Navigation to Edit Page

```tsx
import { useNavigate } from 'react-router-dom';

function ProfileHeader({ user, currentUser }) {
  const navigate = useNavigate();
  const isOwnProfile = currentUser?.id === user.id;

  return (
    <div>
      <h1>{user.displayName}</h1>
      {isOwnProfile && (
        <button onClick={() => navigate('/profile/edit')}>
          Edit Profile
        </button>
      )}
    </div>
  );
}
```

## State Management

### RTK Query Integration

```typescript
// Fetch current user profile
const {
  data: currentUser,
  isLoading: isLoadingProfile
} = useProfileQuery();

// Profile update mutation
const [
  updateProfile,
  {
    isLoading: isUpdating,
    error: updateError
  }
] = useUpdateProfileMutation();
```

### Form State Hook

```typescript
const {
  formData,        // { displayName, avatar, banner }
  previewUrls,     // { avatar, banner } blob URLs
  formErrors,      // { displayName?: string }
  handleInputChange,
  validateForm,
  setFormData,
  setPreviewUrls,
} = useProfileForm();
```

### File Upload Hook

```typescript
const {
  uploadFile,      // (file, metadata) => Promise<UploadedFile>
  isUploading,     // boolean
  error: uploadError
} = useFileUpload();
```

## Component Logic Flow

### 1. Initial Load & Data Hydration

```typescript
useEffect(() => {
  if (currentUser) {
    setFormData({
      displayName: currentUser.displayName || currentUser.username,
      avatar: null,  // File inputs always start null
      banner: null,
    });
    setPreviewUrls({
      avatar: currentUser.avatarUrl || null,    // File ID
      banner: currentUser.bannerUrl || null,    // File ID
    });
  }
}, [currentUser, setFormData, setPreviewUrls]);
```

**Flow:**
1. Page loads, `useProfileQuery` fetches current user
2. When user data arrives, populate form with existing values
3. Display name set to `displayName || username`
4. Preview URLs set to existing file IDs (not blobs)

### 2. Form Submission Process

```typescript
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();

  // Step 1: Validate form
  if (!validateForm() || !currentUser) {
    return;
  }

  try {
    // Step 2: Upload avatar if selected
    let avatarFileId: string | null = null;
    if (formData.avatar) {
      const uploadedAvatar = await uploadFile(formData.avatar, {
        resourceType: "USER_AVATAR",
        resourceId: currentUser.id,
      });
      avatarFileId = uploadedAvatar.id;
    }

    // Step 3: Upload banner if selected
    let bannerFileId: string | null = null;
    if (formData.banner) {
      const uploadedBanner = await uploadFile(formData.banner, {
        resourceType: "USER_BANNER",
        resourceId: currentUser.id,
      });
      bannerFileId = uploadedBanner.id;
    }

    // Step 4: Build update DTO
    const updateProfileDto: {
      displayName?: string;
      avatar?: string;
      banner?: string;
    } = {
      displayName: formData.displayName.trim(),
    };

    if (avatarFileId) {
      updateProfileDto.avatar = avatarFileId;
    }

    if (bannerFileId) {
      updateProfileDto.banner = bannerFileId;
    }

    // Step 5: Update profile
    await updateProfile(updateProfileDto).unwrap();

    // Step 6: Navigate to profile page
    navigate(`/profile/${currentUser.id}`);
  } catch (err) {
    console.error("Failed to update profile:", err);
  }
};
```

**Process Summary:**
1. **Validate**: Check form data is valid
2. **Upload Avatar**: If new avatar selected, upload and get file ID
3. **Upload Banner**: If new banner selected, upload and get file ID
4. **Update Profile**: Send display name + file IDs to backend
5. **Navigate**: Redirect to profile view on success

### 3. Navigation Actions

```typescript
const handleGoBack = () => {
  navigate(-1); // Go to previous page in history
};

// Called after successful profile update
navigate(`/profile/${currentUser.id}`);
```

## Render Logic

### Loading State

```tsx
if (isLoadingProfile) {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    </Container>
  );
}
```

### Error State

```tsx
if (!currentUser) {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Alert severity="error">
        Failed to load profile. Please try again.
      </Alert>
    </Container>
  );
}
```

### Error Display During Form Interaction

```tsx
{(updateError || uploadError) && (
  <Alert severity="error" sx={{ mb: 2 }}>
    {uploadError
      ? `File upload failed: ${uploadError.message}`
      : "Failed to update profile. Please try again."}
  </Alert>
)}
```

### Main Form Rendering

```tsx
<Box component="form" onSubmit={handleSubmit}>
  <ProfileEditForm
    formData={formData}
    previewUrls={previewUrls}
    formErrors={formErrors}
    onDisplayNameChange={handleInputChange("displayName")}
    onAvatarChange={handleInputChange("avatar")}
    onBannerChange={handleInputChange("banner")}
  />

  <Box mt={3} display="flex" gap={2}>
    <Button
      type="submit"
      variant="contained"
      size="large"
      disabled={isUpdating || isUploading || !formData.displayName.trim()}
      fullWidth
    >
      {isUploading ? "Uploading..." : isUpdating ? "Saving..." : "Save Changes"}
    </Button>
    <Button
      variant="outlined"
      size="large"
      onClick={handleGoBack}
      disabled={isUpdating || isUploading}
    >
      Cancel
    </Button>
  </Box>
</Box>
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Container` - Page width constraint (maxWidth="md")
  - `Box` - Layout and spacing
  - `Paper` - Elevated card for form
  - `Button` - Submit, cancel, and back actions
  - `Typography` - Page title
  - `CircularProgress` - Loading spinner
  - `Alert` - Error message display

- **Layout Pattern:**
  - Centered container with max-width constraint
  - Back button at top
  - Form in elevated Paper component
  - Submit/Cancel buttons at bottom

```tsx
<Container maxWidth="md" sx={{ py: 3 }}>
  <Box mb={3}>
    <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack}>
      Back
    </Button>
  </Box>

  <Paper sx={{ p: 4 }}>
    <Typography variant="h4" gutterBottom fontWeight={600}>
      Edit Profile
    </Typography>
    {/* Form content */}
  </Paper>
</Container>
```

## Dependencies

### Internal Dependencies
- `@/hooks/useProfileForm` - Form state management
- `@/hooks/useFileUpload` - File upload functionality
- `@/features/users/usersSlice` - RTK Query endpoints (useProfileQuery, useUpdateProfileMutation)
- `@/components/Profile/ProfileEditForm` - Form presentation component

### External Dependencies
- `@mui/material` - UI components
- `react-router-dom` - Navigation (useNavigate)

## File Upload Flow

### Upload Metadata

```typescript
await uploadFile(file, {
  resourceType: "USER_AVATAR",  // or "USER_BANNER"
  resourceId: currentUser.id,
});
```

**Resource Types:**
- `USER_AVATAR` - Profile avatar images
- `USER_BANNER` - Profile banner images

**Backend Endpoint:**
- `POST /api/file/upload`
- Multipart form-data
- Returns: `{ id: string, filename: string, size: number, ... }`

### Conditional Upload Logic

```typescript
// Only upload if user selected a new file
if (formData.avatar) {
  const uploadedAvatar = await uploadFile(formData.avatar, {
    resourceType: "USER_AVATAR",
    resourceId: currentUser.id,
  });
  avatarFileId = uploadedAvatar.id;
}

// Only include in update DTO if uploaded
if (avatarFileId) {
  updateProfileDto.avatar = avatarFileId;
}
```

**Why Conditional?**
- User may only change display name (no file upload needed)
- User may only change avatar (skip banner upload)
- Reduces unnecessary uploads and API calls

## Error Handling

### Error Sources

1. **Profile Query Error**
   ```typescript
   const { data: currentUser, error: queryError } = useProfileQuery();

   if (!currentUser) {
     return <Alert severity="error">Failed to load profile</Alert>;
   }
   ```

2. **File Upload Error**
   ```typescript
   const { uploadFile, error: uploadError } = useFileUpload();

   {uploadError && (
     <Alert severity="error">
       File upload failed: {uploadError.message}
     </Alert>
   )}
   ```

3. **Profile Update Error**
   ```typescript
   const [updateProfile, { error: updateError }] = useUpdateProfileMutation();

   {updateError && (
     <Alert severity="error">
       Failed to update profile. Please try again.
     </Alert>
   )}
   ```

### Error Recovery

```typescript
try {
  // Upload files and update profile
  await updateProfile(updateProfileDto).unwrap();
  navigate(`/profile/${currentUser.id}`);
} catch (err) {
  console.error("Failed to update profile:", err);
  // Error displayed via updateError or uploadError state
}
```

## Button States

### Submit Button

```tsx
<Button
  type="submit"
  variant="contained"
  size="large"
  disabled={isUpdating || isUploading || !formData.displayName.trim()}
  fullWidth
>
  {isUploading ? "Uploading..." : isUpdating ? "Saving..." : "Save Changes"}
</Button>
```

**Button States:**
- **Disabled when:**
  - `isUploading === true` (files uploading)
  - `isUpdating === true` (profile update in progress)
  - `formData.displayName.trim() === ""` (invalid form)

- **Label:**
  - "Uploading..." - during file upload
  - "Saving..." - during profile update mutation
  - "Save Changes" - default state

### Cancel Button

```tsx
<Button
  variant="outlined"
  size="large"
  onClick={handleGoBack}
  disabled={isUpdating || isUploading}
>
  Cancel
</Button>
```

**Behavior:**
- Navigates back to previous page
- Disabled during uploads/updates to prevent data loss

## Performance Considerations

### Optimistic Updates

Currently not implemented, but could be added:

```typescript
// Potential optimization: Optimistic update before mutation
const [updateProfile] = useUpdateProfileMutation({
  onSuccess: () => {
    // Update cache optimistically
  },
});
```

### File Upload Efficiency

- Files only uploaded if selected (conditional logic)
- Uploads happen sequentially (avatar then banner) to avoid overwhelming network
- Could be optimized to parallel uploads with Promise.all

### Cache Invalidation

```typescript
// RTK Query automatically invalidates these tags:
invalidatesTags: (result) =>
  result
    ? ["Profile", { type: "User", id: result.id }]
    : ["Profile"]
```

**Effect:**
- After successful update, profile page automatically refetches
- Ensures UI shows latest data without manual refresh

## Accessibility

- **Form Semantics**: Uses proper `<form>` element with onSubmit
- **Button States**: Disabled state prevents invalid submissions
- **Error Messages**: Alert components with `severity="error"` for screen readers
- **Navigation**: Back button with clear icon and label

## Common Patterns

### Pattern 1: Full Profile Edit Flow

```tsx
function ProfileEditFlow() {
  const navigate = useNavigate();
  const { data: user } = useProfileQuery();
  const [updateProfile] = useUpdateProfileMutation();
  const { uploadFile } = useFileUpload();
  const form = useProfileForm();

  const handleSubmit = async () => {
    if (!form.validateForm()) return;

    // Upload files if selected
    const avatarId = form.formData.avatar
      ? (await uploadFile(form.formData.avatar, { ... })).id
      : null;

    const bannerId = form.formData.banner
      ? (await uploadFile(form.formData.banner, { ... })).id
      : null;

    // Update profile
    await updateProfile({
      displayName: form.formData.displayName,
      ...(avatarId && { avatar: avatarId }),
      ...(bannerId && { banner: bannerId }),
    }).unwrap();

    navigate(`/profile/${user.id}`);
  };

  return <ProfileEditForm {...form} onSubmit={handleSubmit} />;
}
```

### Pattern 2: Error Boundary Integration

```tsx
function ProfileEditWithErrorBoundary() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ProfileEditPage />
    </ErrorBoundary>
  );
}
```

## Testing

### Test Scenarios

```typescript
describe('ProfileEditPage', () => {
  it('should load current user profile on mount', async () => {
    const { getByDisplayValue } = render(<ProfileEditPage />);
    await waitFor(() => {
      expect(getByDisplayValue('John Doe')).toBeInTheDocument();
    });
  });

  it('should upload files and update profile on submit', async () => {
    const mockUploadFile = jest.fn().mockResolvedValue({ id: 'file-123' });
    const mockUpdateProfile = jest.fn().mockResolvedValue({ ... });

    const { getByRole } = render(<ProfileEditPage />);

    // Interact with form
    const submitButton = getByRole('button', { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalled();
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
  });

  it('should display error when upload fails', async () => {
    const mockUploadFile = jest.fn().mockRejectedValue(new Error('Upload failed'));

    const { getByText } = render(<ProfileEditPage />);

    // Trigger upload
    await waitFor(() => {
      expect(getByText(/file upload failed/i)).toBeInTheDocument();
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Profile not loading**
   - **Cause:** User not authenticated or profile query failing
   - **Solution:** Ensure user is logged in and `/api/users/profile` endpoint accessible

   ```tsx
   // Debug: Check authentication state
   console.log('Current user:', currentUser);
   console.log('Query error:', queryError);
   ```

2. **Form not submitting**
   - **Cause:** Validation failing or buttons disabled
   - **Solution:** Check validation logic and button disabled conditions

   ```tsx
   // Debug: Check validation
   console.log('Form data:', formData);
   console.log('Form errors:', formErrors);
   console.log('Is valid:', validateForm());
   ```

3. **File upload failing**
   - **Cause:** File too large, invalid format, or network error
   - **Solution:** Check file size limits and accepted file types

   ```tsx
   // Debug upload errors
   console.log('Upload error:', uploadError);
   console.log('File size:', formData.avatar?.size);
   ```

4. **Navigation not working after save**
   - **Cause:** Profile update failed silently or navigation path incorrect
   - **Solution:** Check that updateProfile mutation succeeded and user ID exists

   ```tsx
   // Debug navigation
   console.log('Update result:', updateResult);
   console.log('Navigating to:', `/profile/${currentUser.id}`);
   ```

### Best Practices

- **Validate Before Upload**: Call `validateForm()` before starting file uploads
- **Handle All Error States**: Display errors from query, upload, and mutation
- **Disable During Operations**: Prevent double submissions with button disabled states
- **Navigate After Success**: Only redirect after confirming update succeeded
- **Preserve Data on Error**: Don't clear form if upload/update fails

## Related Components

- **Child Components:**
  - `ProfileEditForm` - Form presentation and input fields
  - `UserAvatarUpload` - Avatar file upload with preview
  - `UserBannerUpload` - Banner file upload with preview

- **Related Pages:**
  - `ProfilePage` - Profile viewing page (redirect target)

- **Similar Components:**
  - `CommunityEditPage` - Similar pattern for community editing (if exists)

## Recent Changes

- **2025-01-05:** Initial implementation of profile editing page
- **2025-01-05:** Integrated useProfileForm hook for form state
- **2025-01-05:** Added file upload flow for avatar and banner
- **2025-01-05:** Implemented RTK Query cache invalidation after update

## Related Documentation

- [ProfileEditForm Component](./ProfileEditForm.md) - Form presentation component
- [ProfilePage Component](./ProfilePage.md) - Profile viewing page
- [UserAvatarUpload Component](./UserAvatarUpload.md) - Avatar upload component
- [UserBannerUpload Component](./UserBannerUpload.md) - Banner upload component
- [useProfileForm Hook](../../hooks/useProfileForm.md) - Form state hook
- [useFileUpload Hook](../../hooks/useFileUpload.md) - File upload hook
- [User API](../../api/user.md) - Profile update endpoint
- [usersApi State](../../state/usersApi.md) - RTK Query endpoints
- [User Profiles Feature](../../features/user-profiles.md) - Feature overview
