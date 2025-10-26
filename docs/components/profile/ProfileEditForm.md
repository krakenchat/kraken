# ProfileEditForm

> **Location:** `frontend/src/components/Profile/ProfileEditForm.tsx`
> **Type:** Presentation Component (Form)
> **Feature:** profile

## Overview

`ProfileEditForm` is a presentation component that renders the form fields for profile editing. It displays the banner upload section, avatar upload section, and display name text field in a cohesive layout. This component is purely presentational—it receives all state and event handlers via props and doesn't manage any internal state.

**Key Features:**
- Presentational/controlled component pattern
- Integrates UserBannerUpload, UserAvatarUpload, and TextField
- Validation error display
- Prop-driven state and event handling
- Reusable across different form contexts

## Props Interface

```typescript
import type {
  ProfileFormData,
  ProfilePreviewUrls,
  ProfileFormErrors
} from '@/hooks/useProfileForm';

interface ProfileEditFormProps {
  // Form state
  formData: ProfileFormData;
  previewUrls: ProfilePreviewUrls;
  formErrors: ProfileFormErrors;

  // Event handlers
  onDisplayNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBannerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
```

**Type Definitions:**
```typescript
// From useProfileForm hook
interface ProfileFormData {
  displayName: string;
  avatar: File | null;
  banner: File | null;
}

interface ProfilePreviewUrls {
  avatar: string | null;  // Blob URL or file ID
  banner: string | null;  // Blob URL or file ID
}

interface ProfileFormErrors {
  displayName?: string;  // Validation error message
}
```

## Usage Examples

### Basic Usage

```tsx
import { ProfileEditForm } from '@/components/Profile';
import { useProfileForm } from '@/hooks/useProfileForm';

function ProfileEditor() {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
  } = useProfileForm("John Doe");

  return (
    <form onSubmit={handleSubmit}>
      <ProfileEditForm
        formData={formData}
        previewUrls={previewUrls}
        formErrors={formErrors}
        onDisplayNameChange={handleInputChange("displayName")}
        onAvatarChange={handleInputChange("avatar")}
        onBannerChange={handleInputChange("banner")}
      />
      <button type="submit">Save</button>
    </form>
  );
}
```

### Advanced Usage - Custom Validation

```tsx
import { ProfileEditForm } from '@/components/Profile';
import { useState } from 'react';

function CustomProfileEditor() {
  const [formData, setFormData] = useState({
    displayName: "",
    avatar: null,
    banner: null,
  });
  const [previewUrls, setPreviewUrls] = useState({
    avatar: null,
    banner: null,
  });
  const [formErrors, setFormErrors] = useState({});

  const handleDisplayNameChange = (e) => {
    setFormData(prev => ({ ...prev, displayName: e.target.value }));

    // Custom validation
    if (e.target.value.length < 3) {
      setFormErrors({ displayName: "Name must be at least 3 characters" });
    } else {
      setFormErrors({});
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, avatar: file }));
      setPreviewUrls(prev => ({
        ...prev,
        avatar: URL.createObjectURL(file)
      }));
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, banner: file }));
      setPreviewUrls(prev => ({
        ...prev,
        banner: URL.createObjectURL(file)
      }));
    }
  };

  return (
    <form>
      <ProfileEditForm
        formData={formData}
        previewUrls={previewUrls}
        formErrors={formErrors}
        onDisplayNameChange={handleDisplayNameChange}
        onAvatarChange={handleAvatarChange}
        onBannerChange={handleBannerChange}
      />
    </form>
  );
}
```

### Integration with ProfileEditPage

```tsx
// From ProfileEditPage.tsx
import { ProfileEditForm } from '@/components/Profile';
import { useProfileForm } from '@/hooks/useProfileForm';

function ProfileEditPage() {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
  } = useProfileForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Upload files and update profile
    // ...
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <ProfileEditForm
        formData={formData}
        previewUrls={previewUrls}
        formErrors={formErrors}
        onDisplayNameChange={handleInputChange("displayName")}
        onAvatarChange={handleInputChange("avatar")}
        onBannerChange={handleInputChange("banner")}
      />

      <Button type="submit">Save Changes</Button>
    </Box>
  );
}
```

## Component Structure

```tsx
<Box>
  {/* 1. Banner upload at top */}
  <UserBannerUpload
    previewUrl={previewUrls.banner}
    onChange={onBannerChange}
  />

  {/* 2. Avatar upload below banner */}
  <UserAvatarUpload
    previewUrl={previewUrls.avatar}
    displayName={formData.displayName}
    onChange={onAvatarChange}
  />

  {/* 3. Display name text field */}
  <TextField
    fullWidth
    label="Display Name"
    value={formData.displayName}
    onChange={onDisplayNameChange}
    error={!!formErrors.displayName}
    helperText={formErrors.displayName || "Your display name (1-32 characters)"}
    margin="normal"
    required
  />
</Box>
```

## Field Ordering Rationale

The component renders fields in this specific order:

1. **Banner (top)** - Visually sits at the top of profile, so edit at top
2. **Avatar (middle)** - Overlaps banner, positioned logically below
3. **Display Name (bottom)** - Text input naturally follows visual elements

This order mirrors the visual hierarchy of the profile display.

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` - Container for form fields
  - `TextField` - Display name input

- **Layout:**
  - Vertical stacking with natural spacing
  - Banner upload: Full width, 200px height
  - Avatar upload: Centered with description
  - TextField: Full width with margin="normal"

```tsx
<Box>
  {/* Children naturally stack vertically */}
  {/* No custom spacing needed - components handle their own margins */}
</Box>
```

## Form Validation Display

### Error Prop Pattern

```tsx
<TextField
  error={!!formErrors.displayName}  // Boolean: true if error exists
  helperText={
    formErrors.displayName ||        // Show error message if exists
    "Your display name (1-32 characters)"  // Otherwise show hint
  }
/>
```

**Behavior:**
- **No Error**: TextField normal state, shows hint text
- **With Error**: TextField red border, shows error message

### Validation State

```typescript
// Example error states
formErrors = {};  // No errors, shows "Your display name (1-32 characters)"

formErrors = {
  displayName: "Display name is required"
};  // Error state, shows error message in red
```

## Child Components

### UserBannerUpload

```tsx
<UserBannerUpload
  previewUrl={previewUrls.banner}  // Blob URL or file ID
  onChange={onBannerChange}         // File input change handler
/>
```

**Props:**
- `previewUrl` - Current banner image (blob URL for preview, file ID for existing)
- `onChange` - Called when user selects new banner file

**See:** [UserBannerUpload.md](./UserBannerUpload.md)

### UserAvatarUpload

```tsx
<UserAvatarUpload
  previewUrl={previewUrls.avatar}  // Blob URL or file ID
  displayName={formData.displayName}  // For fallback initials
  onChange={onAvatarChange}         // File input change handler
/>
```

**Props:**
- `previewUrl` - Current avatar image
- `displayName` - Used to generate fallback initials if no image
- `onChange` - Called when user selects new avatar file

**See:** [UserAvatarUpload.md](./UserAvatarUpload.md)

### TextField (Material-UI)

```tsx
<TextField
  fullWidth
  label="Display Name"
  value={formData.displayName}
  onChange={onDisplayNameChange}
  error={!!formErrors.displayName}
  helperText={formErrors.displayName || "Your display name (1-32 characters)"}
  margin="normal"
  required
/>
```

**Material-UI TextField Props:**
- `fullWidth` - Spans container width
- `margin="normal"` - Standard vertical spacing
- `required` - Shows asterisk indicator
- `error` - Red border when true
- `helperText` - Text below input (error or hint)

## Dependencies

### Internal Dependencies
- `@/components/Profile/UserAvatarUpload` - Avatar file upload component
- `@/components/Profile/UserBannerUpload` - Banner file upload component
- `@/hooks/useProfileForm` - Type definitions for props

### External Dependencies
- `@mui/material/TextField` - Text input component
- `@mui/material/Box` - Layout container

## Performance Considerations

### Pure Presentation Component

```typescript
// Component could be memoized if needed
import React from 'react';

const ProfileEditForm: React.FC<ProfileEditFormProps> = React.memo(({
  formData,
  previewUrls,
  formErrors,
  onDisplayNameChange,
  onAvatarChange,
  onBannerChange,
}) => {
  // Component implementation
});
```

**Benefits of Memoization:**
- Prevents re-renders when parent re-renders for unrelated reasons
- All props are primitive or stable functions
- No internal state or side effects

### Optimization Notes

- **No Internal State**: Completely controlled by parent
- **No Side Effects**: Pure rendering based on props
- **Stable Event Handlers**: Parent should memoize handlers with useCallback
- **Child Component Performance**: UserAvatarUpload and UserBannerUpload are already memoized

## Common Patterns

### Pattern 1: Standalone Form Usage

```tsx
function StandaloneProfileForm() {
  const form = useProfileForm("Initial Name");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.validateForm()) {
      console.log("Valid data:", form.formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <ProfileEditForm
        formData={form.formData}
        previewUrls={form.previewUrls}
        formErrors={form.formErrors}
        onDisplayNameChange={form.handleInputChange("displayName")}
        onAvatarChange={form.handleInputChange("avatar")}
        onBannerChange={form.handleInputChange("banner")}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Pattern 2: Multi-Step Wizard Integration

```tsx
function ProfileWizardStep({ onNext }) {
  const form = useProfileForm();
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(form.validateForm());
  }, [form.formData.displayName]);

  return (
    <div>
      <h2>Step 1: Profile Information</h2>
      <ProfileEditForm
        formData={form.formData}
        previewUrls={form.previewUrls}
        formErrors={form.formErrors}
        onDisplayNameChange={form.handleInputChange("displayName")}
        onAvatarChange={form.handleInputChange("avatar")}
        onBannerChange={form.handleInputChange("banner")}
      />
      <button onClick={() => onNext(form.formData)} disabled={!isValid}>
        Next
      </button>
    </div>
  );
}
```

### Pattern 3: Inline Validation

```tsx
function InlineValidatedForm() {
  const form = useProfileForm();
  const [touched, setTouched] = useState(false);

  const handleDisplayNameBlur = () => {
    setTouched(true);
    form.validateForm();
  };

  return (
    <ProfileEditForm
      formData={form.formData}
      previewUrls={form.previewUrls}
      formErrors={touched ? form.formErrors : {}}  // Only show errors after blur
      onDisplayNameChange={(e) => {
        form.handleInputChange("displayName")(e);
        if (touched) form.validateForm();
      }}
      onAvatarChange={form.handleInputChange("avatar")}
      onBannerChange={form.handleInputChange("banner")}
    />
  );
}
```

## Testing

### Test Examples

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileEditForm from './ProfileEditForm';

describe('ProfileEditForm', () => {
  const defaultProps = {
    formData: {
      displayName: "John Doe",
      avatar: null,
      banner: null,
    },
    previewUrls: {
      avatar: null,
      banner: null,
    },
    formErrors: {},
    onDisplayNameChange: jest.fn(),
    onAvatarChange: jest.fn(),
    onBannerChange: jest.fn(),
  };

  it('should render all form fields', () => {
    render(<ProfileEditForm {...defaultProps} />);

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByText(/upload a profile picture/i)).toBeInTheDocument();
    expect(screen.getByText(/click to upload banner/i)).toBeInTheDocument();
  });

  it('should display form data values', () => {
    render(<ProfileEditForm {...defaultProps} />);

    const displayNameInput = screen.getByLabelText(/display name/i);
    expect(displayNameInput).toHaveValue("John Doe");
  });

  it('should call onDisplayNameChange when typing', () => {
    const onDisplayNameChange = jest.fn();

    render(
      <ProfileEditForm
        {...defaultProps}
        onDisplayNameChange={onDisplayNameChange}
      />
    );

    const input = screen.getByLabelText(/display name/i);
    fireEvent.change(input, { target: { value: "Jane Doe" } });

    expect(onDisplayNameChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: "Jane Doe" })
      })
    );
  });

  it('should display validation errors', () => {
    const propsWithError = {
      ...defaultProps,
      formErrors: {
        displayName: "Display name is required",
      },
    };

    render(<ProfileEditForm {...propsWithError} />);

    expect(screen.getByText("Display name is required")).toBeInTheDocument();
  });

  it('should show helper text when no errors', () => {
    render(<ProfileEditForm {...defaultProps} />);

    expect(
      screen.getByText(/your display name \(1-32 characters\)/i)
    ).toBeInTheDocument();
  });

  it('should render preview URLs for avatar and banner', () => {
    const propsWithPreviews = {
      ...defaultProps,
      previewUrls: {
        avatar: "blob:http://localhost/avatar-123",
        banner: "blob:http://localhost/banner-456",
      },
    };

    render(<ProfileEditForm {...propsWithPreviews} />);

    // Avatar and banner components will render images with these blob URLs
    // Specific assertions depend on UserAvatarUpload and UserBannerUpload implementations
  });
});
```

## Accessibility

- **Form Labels**: TextField has proper label association
- **Required Fields**: Required prop adds visual and semantic requirement indicator
- **Error Messages**: helperText provides accessible error descriptions
- **File Inputs**: UserAvatarUpload and UserBannerUpload handle file input accessibility

## Troubleshooting

### Common Issues

1. **Form fields not updating**
   - **Cause:** Event handlers not properly bound or not updating parent state
   - **Solution:** Ensure parent passes stable, memoized event handlers

   ```tsx
   // ❌ Wrong - creates new function on every render
   onDisplayNameChange={(e) => setDisplayName(e.target.value)}

   // ✅ Correct - use useCallback or useProfileForm
   const handleChange = useCallback((e) => setDisplayName(e.target.value), []);
   onDisplayNameChange={handleChange}
   ```

2. **Validation errors not showing**
   - **Cause:** formErrors prop not passed or empty object
   - **Solution:** Ensure parent calls validateForm() and passes result

   ```tsx
   const form = useProfileForm();

   const handleSubmit = () => {
     form.validateForm();  // This updates formErrors
   };

   <ProfileEditForm formErrors={form.formErrors} />
   ```

3. **Preview images not displaying**
   - **Cause:** previewUrls not updated when files selected
   - **Solution:** Ensure parent creates blob URLs when files change

   ```tsx
   // Should create blob URL when file selected
   const handleFileChange = (e) => {
     const file = e.target.files[0];
     setPreviewUrls(prev => ({
       ...prev,
       avatar: URL.createObjectURL(file)
     }));
   };
   ```

4. **TextField value out of sync**
   - **Cause:** Parent state not updated in onChange handler
   - **Solution:** Ensure onChange handler updates parent state

   ```tsx
   const handleDisplayNameChange = (e) => {
     // Must update parent state
     setFormData(prev => ({
       ...prev,
       displayName: e.target.value
     }));
   };
   ```

### Best Practices

- **Controlled Component**: Always pass current state via props
- **Stable Handlers**: Memoize event handlers with useCallback
- **Validation Timing**: Validate on blur for better UX, or on submit
- **Error Display**: Show errors after first submit attempt, not immediately
- **Type Safety**: Use TypeScript interfaces from useProfileForm for consistency
- **Accessibility**: Ensure all inputs have labels and error messages are descriptive

## Related Components

- **Parent Components:**
  - `ProfileEditPage` - Page container that uses this form

- **Child Components:**
  - `UserAvatarUpload` - Avatar file upload with preview
  - `UserBannerUpload` - Banner file upload with preview

- **Related Hooks:**
  - `useProfileForm` - Provides state and handlers for this component

## Recent Changes

- **2025-01-05:** Initial implementation as presentational form component
- **2025-01-05:** Integrated UserAvatarUpload and UserBannerUpload components
- **2025-01-05:** Added display name validation error display
- **2025-01-05:** Designed for controlled component pattern with useProfileForm

## Related Documentation

- [ProfileEditPage Component](./ProfileEditPage.md) - Parent page component
- [UserAvatarUpload Component](./UserAvatarUpload.md) - Avatar upload component
- [UserBannerUpload Component](./UserBannerUpload.md) - Banner upload component
- [useProfileForm Hook](../../hooks/useProfileForm.md) - Form state management
- [User Profiles Feature](../../features/user-profiles.md) - Feature overview
