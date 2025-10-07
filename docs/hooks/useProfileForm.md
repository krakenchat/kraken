# useProfileForm

> **Location:** `frontend/src/hooks/useProfileForm.ts`
> **Type:** Custom Logic Hook / Form State Hook
> **Category:** profile

## Overview

`useProfileForm` is a form state management hook specifically designed for user profile editing. It manages form data (display name, avatar, banner), local file preview URLs, and validation errors for profile update forms. The hook provides a clean interface for handling both text input and file upload inputs with real-time preview generation.

## Hook Signature

```typescript
function useProfileForm(initialDisplayName: string = ""): ProfileFormReturn
```

### Parameters

```typescript
interface UseProfileFormParams {
  initialDisplayName?: string; // Optional: Initial value for display name field (default: "")
}
```

**Parameter Details:**
- **`initialDisplayName`** - Initial display name to populate the form. Typically the user's current display name when editing an existing profile.

### Return Value

```typescript
interface ProfileFormData {
  displayName: string;
  avatar: File | null;
  banner: File | null;
}

interface ProfilePreviewUrls {
  avatar: string | null;
  banner: string | null;
}

interface ProfileFormErrors {
  displayName?: string;
}

interface ProfileFormReturn {
  // Form data state
  formData: ProfileFormData;
  previewUrls: ProfilePreviewUrls;
  formErrors: ProfileFormErrors;

  // Actions
  handleInputChange: (field: keyof ProfileFormData) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  validateForm: () => boolean;

  // Manual state setters (for programmatic updates)
  setFormData: Dispatch<SetStateAction<ProfileFormData>>;
  setPreviewUrls: Dispatch<SetStateAction<ProfilePreviewUrls>>;
}
```

**Return Value Details:**

- **`formData`** - Current form state containing displayName, avatar File, and banner File
- **`previewUrls`** - Blob URLs for local preview of selected avatar/banner images
- **`formErrors`** - Validation error messages for form fields
- **`handleInputChange`** - Curried function that returns event handler for specific field
- **`validateForm`** - Validates form data and updates formErrors state, returns true if valid
- **`setFormData`** - Direct state setter for programmatic form data updates
- **`setPreviewUrls`** - Direct state setter for programmatic preview URL updates

## Usage Examples

### Basic Usage

```tsx
import { useProfileForm } from '@/hooks/useProfileForm';

function ProfileEditForm() {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
  } = useProfileForm("Initial Display Name");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      console.error("Validation failed:", formErrors);
      return;
    }

    console.log("Form data:", {
      displayName: formData.displayName,
      avatarFile: formData.avatar,
      bannerFile: formData.banner,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.displayName}
        onChange={handleInputChange("displayName")}
        placeholder="Display Name"
      />
      {formErrors.displayName && (
        <span className="error">{formErrors.displayName}</span>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange("avatar")}
      />
      {previewUrls.avatar && (
        <img src={previewUrls.avatar} alt="Avatar preview" />
      )}

      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange("banner")}
      />
      {previewUrls.banner && (
        <img src={previewUrls.banner} alt="Banner preview" />
      )}

      <button type="submit">Save Profile</button>
    </form>
  );
}
```

### Advanced Usage - Full Profile Edit Page

```tsx
import { useEffect } from 'react';
import { useProfileForm } from '@/hooks/useProfileForm';
import { useProfileQuery, useUpdateProfileMutation } from '@/features/users/usersSlice';
import { useFileUpload } from '@/hooks/useFileUpload';

function ProfileEditPage() {
  const { data: currentUser, isLoading: isLoadingProfile } = useProfileQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();
  const { uploadFile, isUploading } = useFileUpload();

  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
    setFormData,
    setPreviewUrls,
  } = useProfileForm();

  // Populate form when user data loads
  useEffect(() => {
    if (currentUser) {
      setFormData({
        displayName: currentUser.displayName || currentUser.username,
        avatar: null,
        banner: null,
      });
      setPreviewUrls({
        avatar: currentUser.avatarUrl || null,
        banner: currentUser.bannerUrl || null,
      });
    }
  }, [currentUser, setFormData, setPreviewUrls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !currentUser) return;

    try {
      // Upload avatar if selected
      let avatarFileId: string | null = null;
      if (formData.avatar) {
        const uploadedAvatar = await uploadFile(formData.avatar, {
          resourceType: "USER_AVATAR",
          resourceId: currentUser.id,
        });
        avatarFileId = uploadedAvatar.id;
      }

      // Upload banner if selected
      let bannerFileId: string | null = null;
      if (formData.banner) {
        const uploadedBanner = await uploadFile(formData.banner, {
          resourceType: "USER_BANNER",
          resourceId: currentUser.id,
        });
        bannerFileId = uploadedBanner.id;
      }

      // Update profile with file IDs
      await updateProfile({
        displayName: formData.displayName.trim(),
        ...(avatarFileId && { avatar: avatarFileId }),
        ...(bannerFileId && { banner: bannerFileId }),
      }).unwrap();

      console.log("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  if (isLoadingProfile) return <div>Loading...</div>;
  if (!currentUser) return <div>Failed to load profile</div>;

  return (
    <form onSubmit={handleSubmit}>
      <h1>Edit Profile</h1>

      {/* Display name field */}
      <label>
        Display Name
        <input
          type="text"
          value={formData.displayName}
          onChange={handleInputChange("displayName")}
          required
        />
        {formErrors.displayName && (
          <span className="error">{formErrors.displayName}</span>
        )}
      </label>

      {/* Avatar upload with preview */}
      <label>
        Avatar
        <input
          type="file"
          accept="image/*"
          onChange={handleInputChange("avatar")}
        />
        {previewUrls.avatar && (
          <img
            src={previewUrls.avatar}
            alt="Avatar preview"
            style={{ width: 120, height: 120, borderRadius: '50%' }}
          />
        )}
      </label>

      {/* Banner upload with preview */}
      <label>
        Banner
        <input
          type="file"
          accept="image/*"
          onChange={handleInputChange("banner")}
        />
        {previewUrls.banner && (
          <img
            src={previewUrls.banner}
            alt="Banner preview"
            style={{ width: '100%', height: 200 }}
          />
        )}
      </label>

      <button
        type="submit"
        disabled={isUpdating || isUploading || !formData.displayName.trim()}
      >
        {isUploading ? "Uploading..." : isUpdating ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
```

## Implementation Details

### Internal State

The hook manages three primary state values:

```typescript
const [formData, setFormData] = useState<ProfileFormData>({
  displayName: initialDisplayName,
  avatar: null,
  banner: null,
});

const [previewUrls, setPreviewUrls] = useState<ProfilePreviewUrls>({
  avatar: null,
  banner: null,
});

const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});
```

### Dependencies

#### Internal Hooks
- `useState` - Manages form data, preview URLs, and validation errors
- `useCallback` - Memoizes handleInputChange and validateForm to prevent unnecessary re-renders

#### External Dependencies
- None - Pure React hook with no external dependencies

## Form Field Handling

### Input Change Handler Pattern

The hook uses a curried function pattern for field-specific event handlers:

```typescript
const handleInputChange = useCallback(
  (field: keyof ProfileFormData) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Handle file inputs (avatar/banner)
      if (event.target instanceof HTMLInputElement && event.target.files) {
        const file = event.target.files[0];
        if (file) {
          // Update form data with File object
          setFormData((prev) => ({
            ...prev,
            [field]: file,
          }));

          // Create preview URL for image files
          const objectUrl = URL.createObjectURL(file);
          setPreviewUrls((prev) => ({
            ...prev,
            [field]: objectUrl,
          }));
        }
      }
      // Handle text inputs (displayName)
      else {
        setFormData((prev) => ({
          ...prev,
          [field]: event.target.value,
        }));
      }
    },
  []
);
```

**Pattern Benefits:**
- Single handler for all form fields
- Automatic preview URL generation for file uploads
- Type-safe field targeting
- Zero external dependencies in useCallback

### Validation Logic

```typescript
const validateForm = useCallback((): boolean => {
  const errors: ProfileFormErrors = {};

  // Validate display name
  if (formData.displayName.trim() === "") {
    errors.displayName = "Display name is required";
  } else if (formData.displayName.trim().length > 32) {
    errors.displayName = "Display name must be 32 characters or less";
  }

  setFormErrors(errors);
  return Object.keys(errors).length === 0;
}, [formData]);
```

**Validation Rules:**
- **Display Name Required**: Must not be empty after trimming whitespace
- **Display Name Length**: Maximum 32 characters (matches backend DTO constraint)

## Preview URL Management

### Automatic Blob URL Generation

When a user selects an image file for avatar or banner:

1. **File Storage**: File object stored in `formData[field]`
2. **Preview Creation**: `URL.createObjectURL(file)` generates a local blob URL
3. **Preview Storage**: Blob URL stored in `previewUrls[field]`
4. **UI Display**: Component can immediately show preview without uploading

```typescript
// Example: User selects avatar file
<input
  type="file"
  onChange={handleInputChange("avatar")}
/>

// Result in state:
formData.avatar = File { name: "avatar.jpg", size: 52340, ... }
previewUrls.avatar = "blob:http://localhost:5173/abc-123-def"
```

### Blob URL Lifecycle

**Creation:**
- Created automatically when file is selected
- Stored in `previewUrls` state

**Usage:**
- Used by profile upload components (UserAvatarUpload, UserBannerUpload)
- Distinguished from file IDs by `blob:` prefix

**Cleanup:**
- Caller responsible for revoking blob URLs when component unmounts
- Or relying on browser cleanup when navigating away

## Performance Considerations

### Memoization

```typescript
// Event handler memoized with empty dependency array
const handleInputChange = useCallback(
  (field: keyof ProfileFormData) => (event) => { /* ... */ },
  [] // No dependencies - function is stable
);

// Validation function depends only on formData
const validateForm = useCallback((): boolean => {
  // Validation logic
}, [formData]); // Re-created only when formData changes
```

### Optimization Notes

- **No Re-render Triggers**: Hook doesn't subscribe to external state
- **Stable Event Handlers**: handleInputChange never changes, preventing child re-renders
- **Minimal State**: Only essential form state tracked
- **Synchronous Updates**: All state updates are synchronous for immediate UI feedback

## Error Handling

### Validation Errors

```typescript
interface ProfileFormErrors {
  displayName?: string; // Only field with validation currently
}

// Possible error messages:
// - "Display name is required"
// - "Display name must be 32 characters or less"
```

### Error Display Pattern

```tsx
function ProfileForm() {
  const { formErrors, formData, handleInputChange } = useProfileForm();

  return (
    <div>
      <input
        type="text"
        value={formData.displayName}
        onChange={handleInputChange("displayName")}
        aria-invalid={!!formErrors.displayName}
        aria-describedby="displayName-error"
      />
      {formErrors.displayName && (
        <span id="displayName-error" role="alert" className="error">
          {formErrors.displayName}
        </span>
      )}
    </div>
  );
}
```

## Testing

### Test Examples

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useProfileForm } from '../useProfileForm';

describe('useProfileForm', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useProfileForm("Test User"));

    expect(result.current.formData).toEqual({
      displayName: "Test User",
      avatar: null,
      banner: null,
    });
    expect(result.current.previewUrls).toEqual({
      avatar: null,
      banner: null,
    });
    expect(result.current.formErrors).toEqual({});
  });

  it('should handle display name change', () => {
    const { result } = renderHook(() => useProfileForm());

    act(() => {
      const event = {
        target: { value: "New Name" }
      } as React.ChangeEvent<HTMLInputElement>;
      result.current.handleInputChange("displayName")(event);
    });

    expect(result.current.formData.displayName).toBe("New Name");
  });

  it('should validate empty display name', () => {
    const { result } = renderHook(() => useProfileForm(""));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm();
    });

    expect(isValid).toBe(false);
    expect(result.current.formErrors.displayName).toBe("Display name is required");
  });

  it('should validate display name length', () => {
    const longName = "a".repeat(33); // 33 characters
    const { result } = renderHook(() => useProfileForm(longName));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm();
    });

    expect(isValid).toBe(false);
    expect(result.current.formErrors.displayName).toBe(
      "Display name must be 32 characters or less"
    );
  });

  it('should validate successfully with valid data', () => {
    const { result } = renderHook(() => useProfileForm("Valid Name"));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm();
    });

    expect(isValid).toBe(true);
    expect(result.current.formErrors).toEqual({});
  });

  it('should handle file input change', () => {
    const { result } = renderHook(() => useProfileForm());
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

    act(() => {
      const event = {
        target: {
          files: [file]
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      result.current.handleInputChange("avatar")(event);
    });

    expect(result.current.formData.avatar).toBe(file);
    expect(result.current.previewUrls.avatar).toBe('blob:mock-url');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
  });
});
```

## Common Patterns

### Pattern 1: Form Initialization with Existing Data

```tsx
function EditProfileWithExistingData() {
  const { data: user } = useProfileQuery();
  const {
    setFormData,
    setPreviewUrls,
    formData,
    handleInputChange,
    validateForm
  } = useProfileForm();

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || user.username,
        avatar: null, // File inputs always start null
        banner: null,
      });

      // Show existing images as previews (file IDs, not blob URLs)
      setPreviewUrls({
        avatar: user.avatarUrl || null,
        banner: user.bannerUrl || null,
      });
    }
  }, [user, setFormData, setPreviewUrls]);

  // Rest of component...
}
```

### Pattern 2: Conditional File Upload

```tsx
function ConditionalFileUpload() {
  const { formData, validateForm } = useProfileForm();
  const { uploadFile } = useFileUpload();
  const [updateProfile] = useUpdateProfileMutation();

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Only upload files if user selected new ones
    const updates: { displayName: string; avatar?: string; banner?: string } = {
      displayName: formData.displayName.trim(),
    };

    if (formData.avatar) {
      const uploaded = await uploadFile(formData.avatar, { ... });
      updates.avatar = uploaded.id;
    }

    if (formData.banner) {
      const uploaded = await uploadFile(formData.banner, { ... });
      updates.banner = uploaded.id;
    }

    await updateProfile(updates).unwrap();
  };
}
```

### Pattern 3: Real-time Validation Display

```tsx
function RealtimeValidation() {
  const { formData, formErrors, handleInputChange, validateForm } = useProfileForm();
  const [showValidation, setShowValidation] = useState(false);

  // Validate on every change after first submit attempt
  useEffect(() => {
    if (showValidation) {
      validateForm();
    }
  }, [formData.displayName, showValidation, validateForm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowValidation(true);

    if (validateForm()) {
      // Submit form
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.displayName}
        onChange={handleInputChange("displayName")}
      />
      {showValidation && formErrors.displayName && (
        <span className="error">{formErrors.displayName}</span>
      )}
    </form>
  );
}
```

## Related Hooks

- **useFileUpload** - Used to upload avatar and banner files to backend after form submission
- **useProfileQuery** - Fetches current user profile data to populate form
- **useUpdateProfileMutation** - RTK Query mutation to save profile changes
- **useAuthenticatedImage** - Displays existing avatar/banner from file IDs (used in preview components)

## Troubleshooting

### Common Issues

1. **Preview images not displaying**
   - **Symptoms:** File selected but no preview shown
   - **Cause:** Component not reading `previewUrls` state
   - **Solution:** Ensure component uses `previewUrls.avatar` or `previewUrls.banner`, not `formData`

   ```tsx
   // ❌ Wrong - trying to display File object
   <img src={formData.avatar} alt="Preview" />

   // ✅ Correct - using blob URL
   <img src={previewUrls.avatar} alt="Preview" />
   ```

2. **Validation not triggering**
   - **Symptoms:** Form submits with invalid data
   - **Cause:** `validateForm()` not called before submission
   - **Solution:** Always call `validateForm()` in submit handler

   ```tsx
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();

     // ✅ Validate before proceeding
     if (!validateForm()) {
       return;
     }

     // Proceed with submission
   };
   ```

3. **Display name not initializing**
   - **Symptoms:** Form starts empty despite passing initialDisplayName
   - **Cause:** Parent component not passing initial value
   - **Solution:** Pass current user's display name or username

   ```tsx
   // ❌ Wrong - no initial value
   const form = useProfileForm();

   // ✅ Correct - initialize with current name
   const form = useProfileForm(user?.displayName || user?.username || "");
   ```

4. **Form not updating when user data loads**
   - **Symptoms:** Form remains empty after user data fetches
   - **Cause:** Not using `setFormData` and `setPreviewUrls` in useEffect
   - **Solution:** Programmatically populate form when data loads

   ```tsx
   useEffect(() => {
     if (user) {
       setFormData({
         displayName: user.displayName || user.username,
         avatar: null,
         banner: null,
       });
       setPreviewUrls({
         avatar: user.avatarUrl || null,
         banner: user.bannerUrl || null,
       });
     }
   }, [user, setFormData, setPreviewUrls]);
   ```

### Best Practices

- **Initialize with Current Data**: Always populate form with existing profile data when editing
- **Validate Before Submit**: Call `validateForm()` before processing form submission
- **Handle Loading States**: Show loading indicators during file uploads and profile updates
- **Clear File Inputs**: Reset `formData.avatar` and `formData.banner` to null after successful upload
- **Error Display**: Show validation errors inline near their respective form fields
- **Accessibility**: Use proper ARIA attributes for error messages and form validation

## Version History

- **1.0.0:** 2025-01-05 - Initial implementation for profile editing feature
- Supports display name validation (required, max 32 chars)
- Automatic preview URL generation for avatar and banner files
- Curried event handler pattern for type-safe field updates

## Related Documentation

- [ProfileEditPage Component](../components/profile/ProfileEditPage.md)
- [ProfileEditForm Component](../components/profile/ProfileEditForm.md)
- [UserAvatarUpload Component](../components/profile/UserAvatarUpload.md)
- [UserBannerUpload Component](../components/profile/UserBannerUpload.md)
- [useFileUpload Hook](./useFileUpload.md)
- [useAuthenticatedImage Hook](./useAuthenticatedImage.md)
- [User API Documentation](../api/user.md)
- [usersApi State](../state/usersApi.md)
