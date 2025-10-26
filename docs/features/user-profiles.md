# User Profiles Feature

> **Status:** ✅ Fully Implemented (2025-01-05)
> **Backend:** NestJS + Prisma + MongoDB
> **Frontend:** React + RTK Query + Material-UI

## Overview

The User Profiles feature allows users to view and edit their profile information, including display name, avatar, and banner image. It provides a Discord-like profile viewing experience with authenticated image loading, file uploads, and automatic cache invalidation.

## Feature Components

### Backend Implementation

#### Database Schema (`backend/prisma/schema.prisma`)

```prisma
model User {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  username    String   @unique
  email       String   @unique
  displayName String?
  avatarUrl   String?  // File ID reference
  bannerUrl   String?  // File ID reference
  // ... other fields
}
```

**Key Fields:**
- **`displayName`** - Optional custom display name (1-32 characters)
- **`avatarUrl`** - File ID for user's avatar image (not direct URL)
- **`bannerUrl`** - File ID for user's banner image (not direct URL)

#### API Endpoints

##### GET /api/users/profile
- **Purpose:** Fetch current authenticated user's profile
- **Auth:** Required (JWT)
- **Response:** Full user object
- **RTK Query Hook:** `useProfileQuery()`

##### GET /api/users/:userId
- **Purpose:** Fetch any user's profile by ID
- **Auth:** Required (JWT)
- **Response:** User object (limited fields for privacy)
- **RTK Query Hook:** `useGetUserByIdQuery(userId)`

##### PATCH /api/users/profile
- **Purpose:** Update current user's profile
- **Auth:** Required (JWT)
- **Body:** `UpdateProfileDto`
  ```typescript
  {
    displayName?: string;  // 1-32 chars
    avatar?: string;       // File ID
    banner?: string;       // File ID
  }
  ```
- **Response:** Updated user object
- **RTK Query Hook:** `useUpdateProfileMutation()`

#### DTO Validation (`backend/src/user/dto/update-profile.dto.ts`)

```typescript
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;  // File ID, validated by backend

  @IsOptional()
  @IsString()
  banner?: string;  // File ID, validated by backend
}
```

#### Backend Module Structure

```
backend/src/user/
├── user.controller.ts      # HTTP endpoints
├── user.service.ts         # Business logic
├── user.module.ts          # Module definition
└── dto/
    └── update-profile.dto.ts  # DTO definitions
```

### Frontend Implementation

#### Pages

##### ProfilePage (`frontend/src/pages/ProfilePage.tsx`)
- **Route:** `/profile/:userId`
- **Purpose:** View any user's profile
- **Features:**
  - Displays profile header with banner, avatar, display name, username
  - Conditional "Edit Profile" button for own profile
  - Back navigation button
- **Docs:** [ProfilePage.md](../components/profile/ProfilePage.md)

##### ProfileEditPage (`frontend/src/pages/ProfileEditPage.tsx`)
- **Route:** `/profile/edit`
- **Purpose:** Edit current user's profile
- **Features:**
  - Form with display name, avatar upload, banner upload
  - File upload progress and error handling
  - Automatic navigation to profile view after save
- **Docs:** [ProfileEditPage.md](../components/profile/ProfileEditPage.md)

#### Components

##### ProfileHeader (`frontend/src/components/Profile/ProfileHeader.tsx`)
- **Purpose:** Display user profile header
- **Features:**
  - Banner image (200px height)
  - Avatar (120px, overlaps banner)
  - Display name and username
  - Authenticated image loading
- **Docs:** [ProfileHeader.md](../components/profile/ProfileHeader.md)

##### ProfileEditForm (`frontend/src/components/Profile/ProfileEditForm.tsx`)
- **Purpose:** Presentation component for profile editing form
- **Features:**
  - Banner upload, avatar upload, display name field
  - Validation error display
  - Controlled component pattern
- **Docs:** [ProfileEditForm.md](../components/profile/ProfileEditForm.md)

##### UserAvatarUpload (`frontend/src/components/Profile/UserAvatarUpload.tsx`)
- **Purpose:** File upload for avatar images
- **Features:**
  - Circular avatar display (120px)
  - Camera icon button overlay
  - Local blob preview + authenticated image loading
- **Docs:** [UserAvatarUpload.md](../components/profile/UserAvatarUpload.md)

##### UserBannerUpload (`frontend/src/components/Profile/UserBannerUpload.tsx`)
- **Purpose:** File upload for banner images
- **Features:**
  - Rectangular upload area (full width × 200px)
  - Click-to-upload interface
  - Recommended dimensions (600×200px)
- **Docs:** [UserBannerUpload.md](../components/profile/UserBannerUpload.md)

##### UserAvatar (`frontend/src/components/Common/UserAvatar.tsx`)
- **Purpose:** Unified avatar component used throughout app
- **Features:**
  - Multiple sizes (small: 32px, medium: 40px, large: 48px, xlarge: 120px)
  - Authenticated image loading with caching
  - Optional presence indicator
  - Fallback initials
- **Docs:** [UserAvatar.md](../components/common/UserAvatar.md)

#### Hooks

##### useProfileForm (`frontend/src/hooks/useProfileForm.ts`)
- **Purpose:** Form state management for profile editing
- **Features:**
  - Form data state (displayName, avatar, banner)
  - Preview URL state for file previews
  - Validation logic (display name required, max 32 chars)
  - Input change handlers with automatic blob URL creation
- **Docs:** [useProfileForm.md](../hooks/useProfileForm.md)

##### useAuthenticatedImage (`frontend/src/hooks/useAuthenticatedImage.ts`)
- **Purpose:** Fetch and cache images with JWT authentication
- **Features:**
  - Fetches file by ID from `/api/file/:fileId`
  - Returns blob URL for display
  - Automatic caching via FileCacheContext
  - Loading and error states
- **Docs:** [useAuthenticatedImage.md](../hooks/useAuthenticatedImage.md)

##### useFileUpload (`frontend/src/hooks/useFileUpload.ts`)
- **Purpose:** Upload files to backend
- **Features:**
  - Uploads to `/api/file/upload`
  - Returns file ID for database storage
  - Resource type and ID metadata
  - Upload progress and error handling

#### State Management

##### usersApi (`frontend/src/features/users/usersSlice.ts`)

**RTK Query Endpoints:**

```typescript
export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: authedBaseQuery,
  tagTypes: ["Profile", "User"],
  endpoints: (builder) => ({
    // GET /api/users/profile
    profile: builder.query<User, void>({
      query: () => "/profile",
      providesTags: ["Profile"],
    }),

    // GET /api/users/:userId
    getUserById: builder.query<User, string>({
      query: (userId) => `/${userId}`,
      providesTags: (result, _error, userId) => [
        { type: "User", id: userId }
      ],
    }),

    // PATCH /api/users/profile
    updateProfile: builder.mutation<
      User,
      { displayName?: string; avatar?: string; banner?: string }
    >({
      query: (body) => ({
        url: "/profile",
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result) =>
        result
          ? ["Profile", { type: "User", id: result.id }]
          : ["Profile"],
    }),
  }),
});

export const {
  useProfileQuery,
  useGetUserByIdQuery,
  useUpdateProfileMutation,
} = usersApi;
```

**Cache Invalidation:**
- `updateProfile` mutation invalidates `"Profile"` tag
- Also invalidates specific user tag: `{ type: "User", id: userId }`
- Ensures profile page auto-refreshes after edit

**Docs:** [usersApi.md](../state/usersApi.md)

#### Context

##### FileCacheContext (`frontend/src/contexts/AvatarCacheContext.tsx`)
- **Purpose:** Centralized blob caching for authenticated files
- **Features:**
  - Singleton cache (Map) of file ID → blob URL
  - Promise deduplication prevents race conditions
  - Used by useAuthenticatedImage hook
  - Cleanup on unmount
- **Docs:** [FileCacheContext.md](../contexts/FileCacheContext.md)

## Feature Flow

### Profile Viewing Flow

```
User navigates to /profile/:userId
         ↓
ProfilePage component renders
         ↓
useGetUserByIdQuery(userId) fetches user
         ↓
ProfileHeader displays user data
         ↓
useAuthenticatedImage fetches avatar & banner
         ↓
FileCacheContext checks cache
         ↓
If cached: Return blob URL instantly
If not cached: Fetch from /api/file/:fileId
         ↓
Display images in ProfileHeader
```

### Profile Editing Flow

```
User clicks "Edit Profile" button
         ↓
Navigate to /profile/edit
         ↓
ProfileEditPage renders
         ↓
useProfileQuery fetches current user
         ↓
useProfileForm initialized with current data
         ↓
User edits display name / selects avatar / selects banner
         ↓
useProfileForm creates blob URLs for local preview
         ↓
User clicks "Save Changes"
         ↓
validateForm() checks display name
         ↓
If avatar selected: uploadFile(avatar, metadata)
         ↓
If banner selected: uploadFile(banner, metadata)
         ↓
updateProfile({ displayName, avatar: fileId, banner: fileId })
         ↓
RTK Query invalidates cache tags
         ↓
Navigate to /profile/:userId
         ↓
ProfilePage auto-refreshes with new data
```

### File Upload Flow

```
User selects file via UserAvatarUpload/UserBannerUpload
         ↓
onChange handler creates blob URL with URL.createObjectURL
         ↓
useProfileForm stores File object and blob URL
         ↓
Component displays blob URL immediately (local preview)
         ↓
User clicks "Save Changes"
         ↓
useFileUpload.uploadFile(file, {
  resourceType: "USER_AVATAR" | "USER_BANNER",
  resourceId: userId
})
         ↓
POST /api/file/upload (multipart/form-data)
         ↓
Backend stores file and returns file ID
         ↓
updateProfile({ avatar: fileId }) stores file ID in database
         ↓
Profile page displays image via useAuthenticatedImage(fileId)
         ↓
GET /api/file/:fileId with JWT auth returns image blob
```

## Authentication & Security

### File Access Control

**Endpoint:** `GET /api/file/:fileId`

**Security Measures:**
1. **JWT Authentication Required**: All file fetches require valid JWT token
2. **File ID Validation**: Backend validates file ID format
3. **Resource Ownership**: Backend checks user has access to resource
4. **No Direct URLs**: File IDs stored in DB, not direct URLs
5. **Blob URLs Ephemeral**: Client-side blob URLs never exposed to other users

### RBAC Integration

**Profile Editing:**
- Only authenticated users can edit their own profile
- No RBAC actions required (implicit ownership check)

**Profile Viewing:**
- All authenticated users can view other profiles
- Limited fields exposed for privacy (no email, etc.)

## Performance Optimizations

### Image Caching Strategy

**FileCacheContext Optimization:**

```typescript
// Before optimization: 50 messages with same avatar = 50 fetches
// After optimization: 50 messages with same avatar = 1 fetch

const cacheRef = useRef<Map<string, string>>(new Map());
const pendingRef = useRef<Map<string, Promise<string>>>(new Map());

const fetchBlob = async (fileId: string): Promise<string> => {
  // 1. Return cached blob URL if exists
  const cached = cacheRef.current.get(fileId);
  if (cached) return cached;

  // 2. Return in-flight promise (prevents duplicate fetches!)
  const pending = pendingRef.current.get(fileId);
  if (pending) return pending;

  // 3. Start new fetch and track it
  const fetchPromise = (async () => { /* fetch logic */ })();
  pendingRef.current.set(fileId, fetchPromise);
  return fetchPromise;
};
```

**Benefits:**
- Eliminates race conditions
- Single fetch per unique file ID across entire app
- Instant image display for cached files

### RTK Query Cache Tags

**Automatic Cache Invalidation:**

```typescript
updateProfile: builder.mutation({
  invalidatesTags: (result) =>
    result
      ? ["Profile", { type: "User", id: result.id }]
      : ["Profile"],
})
```

**Benefits:**
- Profile pages auto-refresh after edit
- No manual cache management required
- Consistent data across tabs/components

### Component Memoization

**Optimized Components:**
- `UserAvatar` - No internal state, pure rendering
- `UserAvatarUpload` - React.memo prevents unnecessary re-renders
- `UserBannerUpload` - React.memo prevents unnecessary re-renders

## File Storage Architecture

### Storage Flow

```
User uploads file
       ↓
POST /api/file/upload (multipart/form-data)
       ↓
Backend stores file (filesystem or cloud storage)
       ↓
Backend creates File record in database
       ↓
Returns file ID (not direct URL)
       ↓
Frontend stores file ID in User model
       ↓
Frontend fetches file via GET /api/file/:fileId
       ↓
Backend validates JWT and file access
       ↓
Returns file blob
       ↓
Frontend creates blob URL and caches
```

### Why File IDs Instead of URLs?

**Security:**
- File access always authenticated
- Can revoke access by deleting File record
- No direct URL exposure

**Flexibility:**
- Easy to migrate storage backend
- Can add CDN without changing frontend
- Can implement access control per file

**Privacy:**
- Files only accessible to authenticated users
- Can implement granular permissions later

## Testing Strategy

### Backend Tests

**Test Files:**
- `backend/src/user/user.controller.spec.ts`
- `backend/src/user/user.service.spec.ts`

**Test Scenarios:**
- ✅ GET /profile returns current user
- ✅ GET /:userId returns user by ID
- ✅ PATCH /profile updates display name
- ✅ PATCH /profile updates avatar and banner
- ✅ PATCH /profile validates display name length
- ✅ PATCH /profile requires authentication

### Frontend Tests

**Test Files:**
- `frontend/src/pages/__tests__/ProfilePage.test.tsx`
- `frontend/src/pages/__tests__/ProfileEditPage.test.tsx`
- `frontend/src/hooks/__tests__/useProfileForm.test.ts`

**Test Scenarios:**
- ✅ ProfilePage displays user data
- ✅ ProfilePage shows edit button for own profile
- ✅ ProfileEditPage loads current user data
- ✅ ProfileEditPage validates display name
- ✅ useProfileForm creates blob URLs for file previews
- ✅ useProfileForm validates form data

## Known Limitations

1. **No Profile Privacy Settings**
   - All profiles visible to authenticated users
   - Future: Add privacy controls

2. **No Avatar Cropping**
   - Users must crop images before upload
   - Future: Add in-app image cropping tool

3. **Limited File Validation**
   - Basic file type and size checks
   - Future: Add image dimension validation, aspect ratio checking

4. **No Profile Fields Customization**
   - Fixed set of fields (displayName, avatar, banner)
   - Future: Add bio, location, website, etc.

5. **No Profile History**
   - No tracking of profile changes
   - Future: Add audit log for profile edits

## Future Enhancements

### Short Term
- [ ] Add bio/about section
- [ ] Add profile badges or achievements
- [ ] Implement image cropping UI
- [ ] Add file dimension validation
- [ ] Profile status (online/offline/busy/away)

### Medium Term
- [ ] Custom profile themes
- [ ] Profile activity timeline
- [ ] Mutual friends/communities list
- [ ] Profile privacy settings
- [ ] Verified badge system

### Long Term
- [ ] Profile customization (backgrounds, layouts)
- [ ] Profile analytics (profile views, etc.)
- [ ] Profile sharing (public URLs)
- [ ] Profile import/export

## Related Documentation

### Components
- [ProfilePage Component](../components/profile/ProfilePage.md)
- [ProfileEditPage Component](../components/profile/ProfileEditPage.md)
- [ProfileHeader Component](../components/profile/ProfileHeader.md)
- [ProfileEditForm Component](../components/profile/ProfileEditForm.md)
- [UserAvatarUpload Component](../components/profile/UserAvatarUpload.md)
- [UserBannerUpload Component](../components/profile/UserBannerUpload.md)
- [UserAvatar Component](../components/common/UserAvatar.md)

### Hooks
- [useProfileForm Hook](../hooks/useProfileForm.md)
- [useAuthenticatedImage Hook](../hooks/useAuthenticatedImage.md)
- [useFileUpload Hook](../hooks/useFileUpload.md)

### State & Context
- [usersApi State](../state/usersApi.md)
- [FileCacheContext](../contexts/FileCacheContext.md)

### API
- [User API Documentation](../api/user.md)
- [File API Documentation](../api/file.md)

### Architecture
- [Frontend Architecture](../architecture/frontend.md)
- [Backend Architecture](../architecture/backend.md)

## Changelog

- **2025-01-05:** Initial implementation
  - User profile viewing and editing
  - Avatar and banner upload
  - Display name customization
  - Authenticated image loading
  - FileCacheContext for performance
  - RTK Query cache invalidation
  - Unified UserAvatar component
