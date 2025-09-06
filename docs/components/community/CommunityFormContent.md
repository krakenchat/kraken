# CommunityFormContent

> **Location:** `frontend/src/components/Community/CommunityFormContent.tsx`  
> **Type:** Form Container Component  
> **Feature:** community

## Overview

The CommunityFormContent component orchestrates the community creation/editing form by combining banner upload, avatar upload, and form fields into a cohesive layout. It serves as a container that manages the visual arrangement and data flow between the various form sections.

## Props Interface

```typescript
interface FormErrors {
  name?: string;
  description?: string;
}

interface CommunityFormContentProps {
  formData: {
    name: string;
    description: string;
  };
  previewUrls: {
    avatar: string | null;
    banner: string | null;
  };
  formErrors: FormErrors;
  onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBannerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
```

## Usage Examples

### Basic Usage
```tsx
import CommunityFormContent from '@/components/Community/CommunityFormContent';

function CommunityForm() {
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [previewUrls, setPreviewUrls] = useState({ avatar: null, banner: null });
  const [formErrors, setFormErrors] = useState({});

  const handleNameChange = (event) => {
    setFormData(prev => ({ ...prev, name: event.target.value }));
  };

  return (
    <CommunityFormContent
      formData={formData}
      previewUrls={previewUrls}
      formErrors={formErrors}
      onNameChange={handleNameChange}
      onDescriptionChange={handleDescriptionChange}
      onAvatarChange={handleAvatarChange}
      onBannerChange={handleBannerChange}
    />
  );
}
```

### Integration with Community Form Hook
```tsx
// CreateCommunityPage.tsx usage
const {
  formData,
  previewUrls,
  formErrors,
  handleNameChange,
  handleDescriptionChange,
  handleAvatarChange,
  handleBannerChange,
} = useCommunityForm();

<CommunityFormContent
  formData={formData}
  previewUrls={previewUrls}
  formErrors={formErrors}
  onNameChange={handleNameChange}
  onDescriptionChange={handleDescriptionChange}
  onAvatarChange={handleAvatarChange}
  onBannerChange={handleBannerChange}
/>
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (container with styled wrapper)
- **Styled Components:**
  - `FormContent` - uses MUI theme spacing for consistent gaps
- **Layout Pattern:** Flexbox column with theme-based spacing

```tsx
// Styled component definition
const FormContent = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3), // 24px gap between sections
}));
```

## State Management

- **Local State:** None - pure presentational component
- **Props-based State:** Receives all form state and handlers from parent
- **Form Data Flow:** Passes specific props to each child component

## Dependencies

### Internal Dependencies
- `@/components/Community/CommunityBannerUpload` - banner image upload
- `@/components/Community/CommunityAvatarUpload` - avatar image upload  
- `@/components/Community/CommunityFormFields` - name and description inputs

### External Dependencies
- `@mui/material` (Box, styled) - layout and styling
- `react` - component framework

## Related Components

- **Parent Components:** CommunityFormLayout, CreateCommunityPage, EditCommunityPage
- **Child Components:** CommunityBannerUpload, CommunityAvatarUpload, CommunityFormFields
- **Form Components:** Works with useCommunityForm hook for state management

## Common Patterns

### Pattern 1: Controlled Component Orchestration
```tsx
// Each child receives specific props for its functionality
<CommunityBannerUpload
  previewUrl={previewUrls.banner}
  onChange={onBannerChange}
/>

<CommunityAvatarUpload
  previewUrl={previewUrls.avatar}
  communityName={formData.name}
  onChange={onAvatarChange}
/>

<CommunityFormFields
  name={formData.name}
  description={formData.description}
  onNameChange={onNameChange}
  onDescriptionChange={onDescriptionChange}
  errors={formErrors}
/>
```

### Pattern 2: Theme-based Styling
```tsx
const FormContent = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3), // Uses theme for consistent spacing
}));
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - All child components render correctly
  - Props passed correctly to each child
  - Layout maintains proper spacing
  - Form data flows correctly between components

```tsx
// Example test pattern
test('should render all form sections', () => {
  // Render with mock props
  // Assert CommunityBannerUpload is present
  // Assert CommunityAvatarUpload is present  
  // Assert CommunityFormFields is present
});

test('should pass correct props to child components', () => {
  // Render with specific prop values
  // Assert each child receives expected props
});
```

## Accessibility

- **ARIA Labels:** Handled by child components
- **Keyboard Navigation:** Flows naturally through child components
- **Screen Reader Support:** Semantic structure maintained by child components

## Performance Considerations

- **Memoization:** None implemented (could benefit from React.memo)
- **Bundle Size:** Minimal - primarily a layout component
- **Rendering:** Re-renders when form data or preview URLs change

## Form Section Responsibilities

### Banner Upload Section
- Handles community banner image selection and preview
- Displays image upload area with drag-and-drop support
- Shows banner preview when image selected

### Avatar Upload Section  
- Handles community avatar image selection and preview
- Uses community name for avatar fallback display
- Provides circular avatar preview

### Form Fields Section
- Renders name and description input fields
- Handles form validation error display
- Provides required field indicators

## Troubleshooting

### Common Issues
1. **Child components not receiving props**
   - **Cause:** Parent not passing required props correctly
   - **Solution:** Verify all props are passed with correct names and types

2. **Layout spacing inconsistent**
   - **Cause:** Theme not available or spacing values changed
   - **Solution:** Ensure component wrapped in ThemeProvider

3. **Form data not updating**
   - **Cause:** Event handlers not connected properly
   - **Solution:** Verify parent component implements all required handlers

## Recent Changes

- **Current:** Basic form orchestration with image upload integration
- **Needs:** Better responsive layout, drag-and-drop enhancements

## Related Documentation

- [CommunityFormFields](./CommunityFormFields.md)
- [CommunityBannerUpload](./CommunityBannerUpload.md)
- [CommunityAvatarUpload](./CommunityAvatarUpload.md)
- [useCommunityForm Hook](../../hooks/useCommunityForm.md)
- [Community Creation Flow](../../features/community.md)