# useCommunityForm

> **Location:** `frontend/src/hooks/useCommunityForm.ts`  
> **Type:** State Hook  
> **Category:** forms

## Overview

A comprehensive form management hook designed specifically for community creation and editing forms. It handles form state management, file uploads with preview generation, validation, error handling, and supports both create and edit modes. This hook provides a complete solution for managing community forms with image uploads for avatars and banners.

## Hook Signature

```typescript
function useCommunityForm(props?: UseCommunityFormProps): UseCommunityFormReturn
```

### Parameters

```typescript
interface UseCommunityFormProps {
  initialData?: {
    name: string;
    description: string;
    avatar: string | null;
    banner: string | null;
  };
}
```

- `initialData` - Optional initial form data for editing existing communities

### Return Value

```typescript
interface UseCommunityFormReturn {
  // Form state
  formData: CreateCommunityFormData;
  previewUrls: PreviewUrls;
  formErrors: FormErrors;
  
  // Form actions
  handleInputChange: (field: keyof CreateCommunityFormData) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  validateForm: () => boolean;
  updateFormData: (data: Partial<CreateCommunityFormData>) => void;
  updatePreviewUrls: (urls: Partial<PreviewUrls>) => void;
  setFormData: React.Dispatch<React.SetStateAction<CreateCommunityFormData>>;
  setPreviewUrls: React.Dispatch<React.SetStateAction<PreviewUrls>>;
}

interface CreateCommunityFormData {
  name: string;
  description: string;
  avatar: File | null;
  banner: File | null;
}

interface PreviewUrls {
  avatar: string | null;
  banner: string | null;
}

interface FormErrors {
  name?: string;
  description?: string;
}
```

## Usage Examples

### Basic Community Creation Form

```tsx
import { useCommunityForm } from '@/hooks/useCommunityForm';

function CreateCommunityForm() {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
  } = useCommunityForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      
      if (formData.avatar) {
        formDataToSend.append('avatar', formData.avatar);
      }
      
      if (formData.banner) {
        formDataToSend.append('banner', formData.banner);
      }

      await createCommunity(formDataToSend);
      console.log('Community created successfully!');
    } catch (error) {
      console.error('Failed to create community:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="community-form">
      <div className="form-group">
        <label htmlFor="name">Community Name *</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleInputChange('name')}
          placeholder="Enter community name"
          className={formErrors.name ? 'error' : ''}
        />
        {formErrors.name && (
          <span className="error-message">{formErrors.name}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={formData.description}
          onChange={handleInputChange('description')}
          placeholder="Describe your community"
          className={formErrors.description ? 'error' : ''}
        />
        {formErrors.description && (
          <span className="error-message">{formErrors.description}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="avatar">Community Avatar</label>
        <input
          id="avatar"
          type="file"
          accept="image/*"
          onChange={handleInputChange('avatar')}
        />
        {previewUrls.avatar && (
          <div className="image-preview">
            <img src={previewUrls.avatar} alt="Avatar preview" />
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="banner">Community Banner</label>
        <input
          id="banner"
          type="file"
          accept="image/*"
          onChange={handleInputChange('banner')}
        />
        {previewUrls.banner && (
          <div className="image-preview banner">
            <img src={previewUrls.banner} alt="Banner preview" />
          </div>
        )}
      </div>

      <button type="submit">Create Community</button>
    </form>
  );
}
```

### Community Edit Form

```tsx
import { useCommunityForm } from '@/hooks/useCommunityForm';

function EditCommunityForm({ community }: { community: Community }) {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
    updateFormData
  } = useCommunityForm({
    initialData: {
      name: community.name,
      description: community.description,
      avatar: community.avatarUrl,
      banner: community.bannerUrl,
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      
      // Only include files if they're new uploads
      if (formData.avatar instanceof File) {
        formDataToSend.append('avatar', formData.avatar);
      }
      
      if (formData.banner instanceof File) {
        formDataToSend.append('banner', formData.banner);
      }

      await updateCommunity(community.id, formDataToSend);
      showSuccessNotification('Community updated successfully!');
    } catch (error) {
      console.error('Failed to update community:', error);
      showErrorNotification('Failed to update community');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    updateFormData({
      name: community.name,
      description: community.description,
      avatar: null,
      banner: null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="edit-community-form">
      <h2>Edit Community</h2>
      
      <div className="form-section">
        <h3>Basic Information</h3>
        
        <div className="form-group">
          <label htmlFor="name">Community Name *</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange('name')}
            disabled={isSubmitting}
            className={formErrors.name ? 'error' : ''}
          />
          {formErrors.name && (
            <span className="error-message">{formErrors.name}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={handleInputChange('description')}
            disabled={isSubmitting}
            rows={3}
            className={formErrors.description ? 'error' : ''}
          />
          {formErrors.description && (
            <span className="error-message">{formErrors.description}</span>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3>Community Images</h3>
        
        <div className="image-upload-group">
          <div className="image-upload">
            <label>Avatar</label>
            <div className="current-image">
              <img 
                src={previewUrls.avatar || community.avatarUrl} 
                alt="Current avatar"
                className="avatar-preview"
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleInputChange('avatar')}
              disabled={isSubmitting}
            />
          </div>

          <div className="image-upload">
            <label>Banner</label>
            <div className="current-image">
              <img 
                src={previewUrls.banner || community.bannerUrl} 
                alt="Current banner"
                className="banner-preview"
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleInputChange('banner')}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button 
          type="button" 
          onClick={handleReset}
          disabled={isSubmitting}
        >
          Reset Changes
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="primary"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
```

### Advanced Form with Custom Validation

```tsx
import { useCommunityForm } from '@/hooks/useCommunityForm';

function AdvancedCommunityForm() {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    updateFormData,
    setFormData
  } = useCommunityForm();

  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Custom validation beyond the built-in validation
  const customValidateForm = async (): Promise<boolean> => {
    setIsValidating(true);
    const errors: Record<string, string> = {};

    // Check if community name is unique
    if (formData.name) {
      try {
        const exists = await checkCommunityNameExists(formData.name);
        if (exists) {
          errors.name = 'A community with this name already exists';
        }
      } catch (error) {
        console.error('Name validation error:', error);
      }
    }

    // Validate file sizes
    if (formData.avatar && formData.avatar.size > 5 * 1024 * 1024) {
      errors.avatar = 'Avatar file size must be less than 5MB';
    }

    if (formData.banner && formData.banner.size > 10 * 1024 * 1024) {
      errors.banner = 'Banner file size must be less than 10MB';
    }

    // Validate image dimensions
    if (formData.avatar) {
      const dimensions = await getImageDimensions(formData.avatar);
      if (dimensions.width < 100 || dimensions.height < 100) {
        errors.avatar = 'Avatar must be at least 100x100 pixels';
      }
    }

    setCustomErrors(errors);
    setIsValidating(false);
    
    return Object.keys(errors).length === 0;
  };

  const handleAdvancedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Run both built-in and custom validation
    const basicValid = validateForm();
    const customValid = await customValidateForm();
    
    if (!basicValid || !customValid) {
      console.log('Validation failed');
      return;
    }

    // Proceed with submission
    await submitCommunityForm();
  };

  const handleFileChange = (field: 'avatar' | 'banner') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      // Clear any previous errors for this field
      setCustomErrors(prev => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
      
      // Update form data and preview
      handleInputChange(field)(event);
      
      // Validate file in real-time
      if (field === 'avatar' && file.size > 5 * 1024 * 1024) {
        setCustomErrors(prev => ({
          ...prev,
          avatar: 'Avatar file size must be less than 5MB'
        }));
      } else if (field === 'banner' && file.size > 10 * 1024 * 1024) {
        setCustomErrors(prev => ({
          ...prev,
          banner: 'Banner file size must be less than 10MB'
        }));
      }
    }
  };

  const generateRandomName = () => {
    const adjectives = ['Awesome', 'Cool', 'Epic', 'Amazing', 'Fantastic'];
    const nouns = ['Community', 'Guild', 'Tribe', 'Collective', 'Alliance'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    
    updateFormData({
      name: `${randomAdjective} ${randomNoun}`,
    });
  };

  return (
    <form onSubmit={handleAdvancedSubmit} className="advanced-community-form">
      <div className="form-header">
        <h2>Create Your Community</h2>
        <button 
          type="button" 
          onClick={generateRandomName}
          className="secondary small"
        >
          Generate Random Name
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="name">Community Name *</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleInputChange('name')}
          className={formErrors.name || customErrors.name ? 'error' : ''}
        />
        {(formErrors.name || customErrors.name) && (
          <span className="error-message">
            {formErrors.name || customErrors.name}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={handleInputChange('description')}
          placeholder="Tell others what your community is about..."
          rows={4}
        />
        <small>Optional: Describe the purpose and goals of your community</small>
      </div>

      <div className="image-upload-section">
        <div className="image-upload-group">
          <div className="upload-item">
            <label>Community Avatar</label>
            <div className="upload-area">
              {previewUrls.avatar ? (
                <div className="image-preview">
                  <img src={previewUrls.avatar} alt="Avatar preview" />
                  <button 
                    type="button" 
                    onClick={() => updateFormData({ avatar: null })}
                    className="remove-image"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <span>Click to upload avatar</span>
                  <small>Recommended: 512x512px, max 5MB</small>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange('avatar')}
                className="file-input"
              />
            </div>
            {customErrors.avatar && (
              <span className="error-message">{customErrors.avatar}</span>
            )}
          </div>

          <div className="upload-item">
            <label>Community Banner</label>
            <div className="upload-area banner">
              {previewUrls.banner ? (
                <div className="image-preview">
                  <img src={previewUrls.banner} alt="Banner preview" />
                  <button 
                    type="button" 
                    onClick={() => updateFormData({ banner: null })}
                    className="remove-image"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <span>Click to upload banner</span>
                  <small>Recommended: 1920x1080px, max 10MB</small>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange('banner')}
                className="file-input"
              />
            </div>
            {customErrors.banner && (
              <span className="error-message">{customErrors.banner}</span>
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button 
          type="button" 
          onClick={() => setFormData({
            name: '',
            description: '',
            avatar: null,
            banner: null,
          })}
        >
          Clear Form
        </button>
        <button 
          type="submit" 
          disabled={isValidating}
          className="primary"
        >
          {isValidating ? 'Validating...' : 'Create Community'}
        </button>
      </div>
    </form>
  );
}
```

## Implementation Details

### Form State Management

```typescript
const [formData, setFormData] = useState<CreateCommunityFormData>({
  name: props?.initialData?.name || "",
  description: props?.initialData?.description || "",
  avatar: null,
  banner: null,
});

const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({
  avatar: props?.initialData?.avatar || null,
  banner: props?.initialData?.banner || null,
});

const [formErrors, setFormErrors] = useState<FormErrors>({});
```

### Input Change Handler

The hook provides a flexible input change handler that handles both text inputs and file inputs:

```typescript
const handleInputChange = (field: keyof CreateCommunityFormData) => 
  (event: React.ChangeEvent<HTMLInputElement>) => {
    if (field === "avatar" || field === "banner") {
      const file = event.target.files?.[0] || null;
      setFormData((prev) => ({
        ...prev,
        [field]: file,
      }));

      // Create preview URL
      if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrls((prev) => ({ ...prev, [field]: url }));
      } else {
        setPreviewUrls((prev) => ({ ...prev, [field]: null }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));

      // Clear error when user starts typing
      if (field in formErrors && formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    }
  };
```

### Form Validation

```typescript
const validateForm = (): boolean => {
  const errors: FormErrors = {};

  if (!formData.name.trim()) {
    errors.name = "Community name is required";
  } else if (formData.name.trim().length < 2) {
    errors.name = "Community name must be at least 2 characters";
  }

  setFormErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### Dependencies

#### Internal Hooks
- `useState` - Manages form data, preview URLs, and validation errors
- `React.ChangeEvent` - Types for form input events

#### External Dependencies  
- File API - For creating object URLs for image previews
- Form data handling utilities

## File Upload Management

### Preview URL Generation

The hook automatically generates preview URLs for uploaded images using the browser's File API:

```typescript
// Create preview URL when file is selected
if (file) {
  const url = URL.createObjectURL(file);
  setPreviewUrls((prev) => ({ ...prev, [field]: url }));
}
```

### Memory Management

When using object URLs for previews, it's important to clean them up:

```tsx
useEffect(() => {
  // Clean up object URLs when component unmounts
  return () => {
    if (previewUrls.avatar) {
      URL.revokeObjectURL(previewUrls.avatar);
    }
    if (previewUrls.banner) {
      URL.revokeObjectURL(previewUrls.banner);
    }
  };
}, []);
```

## Error Handling

### Real-time Validation

The hook clears validation errors as the user types:

```typescript
// Clear error when user starts typing
if (field in formErrors && formErrors[field as keyof FormErrors]) {
  setFormErrors((prev) => ({
    ...prev,
    [field]: undefined,
  }));
}
```

### Form Submission Error Handling

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) {
    // Focus first error field
    const firstErrorField = Object.keys(formErrors)[0];
    document.getElementById(firstErrorField)?.focus();
    return;
  }

  try {
    await submitForm(formData);
  } catch (error) {
    if (error.response?.status === 400) {
      // Handle validation errors from server
      setFormErrors(error.response.data.errors);
    } else {
      // Handle other errors
      console.error('Submit error:', error);
    }
  }
};
```

## Performance Considerations

### Image Preview Optimization

- **Object URL Usage**: Efficient for local file previews without loading into memory
- **URL Cleanup**: Proper cleanup prevents memory leaks
- **File Size Validation**: Early validation prevents uploading oversized files

### Form State Optimization

- **Selective Updates**: Only updates changed fields to prevent unnecessary re-renders
- **Error State Management**: Efficiently manages validation state
- **Input Handler Memoization**: Input handlers are stable references

## Testing

### Test Examples

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useCommunityForm } from '../useCommunityForm';

describe('useCommunityForm', () => {
  it('should initialize with empty form data', () => {
    const { result } = renderHook(() => useCommunityForm());
    
    expect(result.current.formData).toEqual({
      name: '',
      description: '',
      avatar: null,
      banner: null,
    });
  });

  it('should initialize with provided initial data', () => {
    const initialData = {
      name: 'Test Community',
      description: 'Test Description',
      avatar: 'avatar-url',
      banner: 'banner-url',
    };

    const { result } = renderHook(() => useCommunityForm({ initialData }));
    
    expect(result.current.formData.name).toBe('Test Community');
    expect(result.current.formData.description).toBe('Test Description');
    expect(result.current.previewUrls.avatar).toBe('avatar-url');
    expect(result.current.previewUrls.banner).toBe('banner-url');
  });

  it('should validate required fields', () => {
    const { result } = renderHook(() => useCommunityForm());
    
    act(() => {
      const isValid = result.current.validateForm();
      expect(isValid).toBe(false);
      expect(result.current.formErrors.name).toBe('Community name is required');
    });
  });

  it('should update form data when input changes', () => {
    const { result } = renderHook(() => useCommunityForm());
    
    act(() => {
      const mockEvent = {
        target: { value: 'New Community Name' }
      } as React.ChangeEvent<HTMLInputElement>;
      
      result.current.handleInputChange('name')(mockEvent);
    });
    
    expect(result.current.formData.name).toBe('New Community Name');
  });
});
```

### Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateCommunityForm from '../CreateCommunityForm';

describe('CreateCommunityForm', () => {
  it('should show validation error for empty name', async () => {
    render(<CreateCommunityForm />);
    
    const submitButton = screen.getByText('Create Community');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Community name is required')).toBeInTheDocument();
    });
  });

  it('should handle file upload', async () => {
    render(<CreateCommunityForm />);
    
    const fileInput = screen.getByLabelText('Community Avatar');
    const file = new File(['test'], 'avatar.png', { type: 'image/png' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByAltText('Avatar preview')).toBeInTheDocument();
    });
  });
});
```

## Common Patterns

### Pattern 1: Multi-step Form Integration

```tsx
function MultiStepCommunityForm() {
  const communityForm = useCommunityForm();
  const [step, setStep] = useState(1);

  const canProceedToStep2 = () => {
    return communityForm.formData.name.length >= 2;
  };

  const canProceedToStep3 = () => {
    return communityForm.validateForm();
  };

  return (
    <div className="multi-step-form">
      {step === 1 && (
        <BasicInfoStep 
          formData={communityForm.formData}
          formErrors={communityForm.formErrors}
          handleInputChange={communityForm.handleInputChange}
          onNext={() => canProceedToStep2() && setStep(2)}
        />
      )}
      
      {step === 2 && (
        <ImageUploadStep 
          formData={communityForm.formData}
          previewUrls={communityForm.previewUrls}
          handleInputChange={communityForm.handleInputChange}
          onNext={() => canProceedToStep3() && setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      
      {step === 3 && (
        <ReviewStep 
          formData={communityForm.formData}
          previewUrls={communityForm.previewUrls}
          onSubmit={handleFinalSubmit}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}
```

### Pattern 2: Form with Auto-save

```tsx
function AutoSaveCommunityForm() {
  const communityForm = useCommunityForm();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save form data to localStorage
  useEffect(() => {
    const autoSave = async () => {
      setIsSaving(true);
      localStorage.setItem('communityFormDraft', JSON.stringify({
        name: communityForm.formData.name,
        description: communityForm.formData.description,
        // Note: Files can't be serialized, only text data
      }));
      setLastSaved(new Date());
      setIsSaving(false);
    };

    const timeoutId = setTimeout(autoSave, 2000);
    return () => clearTimeout(timeoutId);
  }, [communityForm.formData.name, communityForm.formData.description]);

  const loadDraft = () => {
    const saved = localStorage.getItem('communityFormDraft');
    if (saved) {
      const draft = JSON.parse(saved);
      communityForm.updateFormData(draft);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('communityFormDraft');
    setLastSaved(null);
  };

  return (
    <div>
      <div className="auto-save-status">
        {isSaving ? (
          <span>Saving draft...</span>
        ) : lastSaved ? (
          <span>Draft saved at {lastSaved.toLocaleTimeString()}</span>
        ) : null}
        <button onClick={loadDraft}>Load Draft</button>
        <button onClick={clearDraft}>Clear Draft</button>
      </div>
      
      {/* Rest of form */}
    </div>
  );
}
```

## Related Hooks

- **useCommunityJoin** - Handles joining communities after creation
- **React Hook Form** - Alternative form management library
- **Custom validation hooks** - For advanced validation scenarios

## Troubleshooting

### Common Issues

1. **File previews not showing**
   - **Symptoms:** Image uploads don't show preview
   - **Cause:** Object URLs not created or revoked prematurely
   - **Solution:** Ensure proper URL creation and cleanup

2. **Form validation not clearing**
   - **Symptoms:** Error messages persist after fixing input
   - **Cause:** Error clearing logic not triggered
   - **Solution:** Verify handleInputChange clears errors for the field

3. **Memory leaks with image previews**
   - **Symptoms:** Browser memory usage increases over time
   - **Cause:** Object URLs not properly revoked
   - **Solution:** Implement proper cleanup in useEffect

### Best Practices

- **File Size Limits**: Always validate file sizes before upload
- **Image Format Validation**: Restrict file types to supported formats
- **Preview Cleanup**: Clean up object URLs to prevent memory leaks
- **Progressive Enhancement**: Provide fallbacks for file upload functionality
- **Accessibility**: Ensure form is keyboard navigable and screen reader friendly

## Version History

- **1.0.0:** Initial implementation with basic form management
- **1.1.0:** Added file upload support with previews
- **1.2.0:** Enhanced validation and error handling
- **1.3.0:** Added support for edit mode with initial data

## Related Documentation

- [Community API](../api/community.md)
- [File Upload Guide](../guides/file-uploads.md)
- [Form Validation Patterns](../guides/form-validation.md)
- [Community Components](../components/community/README.md)