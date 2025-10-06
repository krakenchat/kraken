# File API

> **Base URL:** `/api/file`
> **Controller:** `backend/src/file/file.controller.ts`
> **Service:** `backend/src/file/file.service.ts`

## Overview

The File API handles secure file uploads and retrieval with resource-based access control. It supports multiple file types (images, videos, audio, documents) with size validation based on MIME types and resource purposes.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | Access Control |
|--------|----------|-------------|----------------|
| POST | `/file-upload` | Upload file with validation | Authenticated users |
| GET | `/:id` | Retrieve file (streaming) | FileAccessGuard (strategy-based) |

---

## POST `/api/file-upload`

**Description:** Uploads a file with automatic validation, file type detection, and checksum generation

### Request

**Content-Type:** `multipart/form-data`

**Form Fields:**
```typescript
{
  file: File;                    // Binary file data (required)
  resourceType: ResourceType;     // Resource type enum (required)
  resourceId?: string;           // ID of associated resource (optional)
}
```

**ResourceType Values:**
- `USER_AVATAR` - User profile picture
- `USER_BANNER` - User profile banner
- `COMMUNITY_AVATAR` - Community profile picture
- `COMMUNITY_BANNER` - Community banner image
- `MESSAGE_ATTACHMENT` - File attached to message
- `CUSTOM_EMOJI` - Custom emoji for community

**File Validation Rules by Resource Type:**

| Resource Type | Allowed MIME Types | Max Size |
|--------------|-------------------|----------|
| `USER_AVATAR` | image/* (jpeg, png, gif, webp) | 10MB |
| `USER_BANNER` | image/* | 10MB |
| `COMMUNITY_AVATAR` | image/* | 10MB |
| `COMMUNITY_BANNER` | image/* | 10MB |
| `MESSAGE_ATTACHMENT` | image/*, video/*, audio/*, application/*, text/* | 500MB video, 25MB image, 100MB audio, 50MB document |
| `CUSTOM_EMOJI` | image/* | 5MB |

**Example (cURL):**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/file.jpg" \
  -F "resourceType=MESSAGE_ATTACHMENT" \
  -F "resourceId=null" \
  "http://localhost:3001/api/file-upload"
```

**Example (Postman):**
```
POST http://localhost:3001/api/file-upload
Headers:
  Authorization: Bearer {{authToken}}
Body (form-data):
  file: [select file]
  resourceType: MESSAGE_ATTACHMENT
  resourceId: (empty or resource ID)
```

**Example (JavaScript fetch):**
```javascript
const formData = new FormData();
formData.append('file', fileInputElement.files[0]);
formData.append('resourceType', 'MESSAGE_ATTACHMENT');
formData.append('resourceId', null);

const response = await fetch('/api/file-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const uploadedFile = await response.json();
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "filename": "example.jpg",
  "mimeType": "image/jpeg",
  "fileType": "IMAGE",
  "size": 1048576,
  "checksum": "a1b2c3d4e5f6...",
  "uploadedById": "64f7b1234567890abcdef456",
  "uploadedAt": "2024-01-01T12:34:56.789Z",
  "resourceType": "MESSAGE_ATTACHMENT",
  "resourceId": null,
  "storageType": "LOCAL",
  "storagePath": "uploads/1704110096789-example.jpg",
  "deletedAt": null
}
```

**Error Responses:**

**413 Payload Too Large** - File exceeds hard limit (500MB):
```json
{
  "statusCode": 413,
  "message": "File too large",
  "error": "Payload Too Large"
}
```

**422 Unprocessable Entity** - Validation failed:
```json
{
  "statusCode": 422,
  "message": "Validation failed (expected max size: 25MB for image/*)",
  "error": "Unprocessable Entity"
}
```

**400 Bad Request** - Invalid resource type:
```json
{
  "statusCode": 400,
  "message": ["resourceType must be a valid enum value"],
  "error": "Bad Request"
}
```

**401 Unauthorized** - Missing or invalid token

**500 Internal Server Error** - Server error (file cleaned up automatically)

---

## GET `/api/file/:id`

**Description:** Retrieves file contents as a stream with access control validation

### Request

**Path Parameters:**
- `id` (string, required) - File ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/file/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
- **Content-Type:** File's MIME type (e.g., `image/jpeg`, `video/mp4`)
- **Content-Disposition:** `inline; filename="original-filename.jpg"`
- **Body:** Binary file stream

**Example Response Headers:**
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Disposition: inline; filename="example.jpg"
Content-Length: 1048576
```

**Error Responses:**

**401 Unauthorized** - Missing or invalid token

**403 Forbidden** - User doesn't have access to this file:
```json
{
  "statusCode": 403,
  "message": "Access denied to this file",
  "error": "Forbidden"
}
```

**404 Not Found** - File doesn't exist or was deleted:
```json
{
  "statusCode": 404,
  "message": "File not found",
  "error": "Not Found"
}
```

---

## File Access Control

Files are protected by the `FileAccessGuard` which uses different strategies based on `resourceType`:

| Resource Type | Access Rule | Description |
|--------------|-------------|-------------|
| `USER_AVATAR` | **Public** | Anyone authenticated can view |
| `USER_BANNER` | **Public** | Anyone authenticated can view |
| `COMMUNITY_AVATAR` | **Community Members** | Must be member of community |
| `COMMUNITY_BANNER` | **Community Members** | Must be member of community |
| `MESSAGE_ATTACHMENT` | **Channel/DM Members** | Must have access to message's channel or DM group (respects private channels) |
| `CUSTOM_EMOJI` | **Community Admins** | Must be admin/owner of community |

### Access Validation Examples

**Public File (User Avatar):**
```
GET /api/file/:fileId
✅ Any authenticated user can access
```

**Community File (Community Avatar):**
```
GET /api/file/:fileId
1. Get file metadata → resourceType = COMMUNITY_AVATAR, resourceId = communityId
2. Check if user is member of community
3. ✅ Allow if member, ❌ Deny if not
```

**Message Attachment (Private Channel):**
```
GET /api/file/:fileId
1. Get file metadata → resourceType = MESSAGE_ATTACHMENT, resourceId = messageId
2. Get message → find channelId
3. Get channel → check if private
4. If public: Check community membership
5. If private: Check community membership AND channel membership
6. ✅ Allow if all checks pass
```

## File Upload Flow

### Pattern 1: Direct Upload (Avatars/Banners)

```typescript
// 1. Upload file
POST /api/file-upload
{
  file: <binary>,
  resourceType: "USER_AVATAR",
  resourceId: userId
}

// Response: { id: "fileId123", ... }

// 2. Update user with file ID
PUT /api/user/:userId
{
  avatarUrl: "fileId123"
}
```

### Pattern 2: Async Upload (Message Attachments)

```typescript
// 1. Create message with pendingAttachments counter
POST /api/messages
{
  channelId: "channelId123",
  spans: [{ type: "PLAINTEXT", text: "Uploading 2 files..." }],
  attachments: [],
  pendingAttachments: 2  // Expecting 2 file uploads
}

// Response: { id: "messageId456", ... }

// 2. Upload files (can be parallel)
POST /api/file-upload
{
  file: <binary1>,
  resourceType: "MESSAGE_ATTACHMENT",
  resourceId: null
}

POST /api/file-upload
{
  file: <binary2>,
  resourceType: "MESSAGE_ATTACHMENT",
  resourceId: null
}

// Responses: { id: "fileId789", ... }, { id: "fileId012", ... }

// 3. Confirm each upload (decrements pendingAttachments, adds to attachments[])
POST /api/messages/messageId456/attachments
{
  fileId: "fileId789"
}

POST /api/messages/messageId456/attachments
{
  fileId: "fileId012"
}

// Final message state:
// {
//   attachments: ["fileId789", "fileId012"],
//   pendingAttachments: 0
// }
```

### Pattern 3: Failed Upload Handling

```typescript
// If upload fails, still decrement pendingAttachments
POST /api/messages/:messageId/attachments
{
  // No fileId = failed upload, just decrement counter
}

// This prevents messages from being stuck with pendingAttachments > 0
```

## Validation Layers

### Layer 1: Multer (DOS Prevention)
```typescript
limits: {
  fileSize: 500 * 1024 * 1024  // 500MB hard limit
}
```

### Layer 2: Decorator Validators
```typescript
@ParseFilePipe({
  validators: [
    new MimeTypeAwareSizeValidator({}),  // MIME-based size limits
    new FileTypeValidator({              // Allowed MIME patterns
      fileType: /(image|video|audio|application|text)\//
    }),
  ],
})
```

### Layer 3: Service Validation
```typescript
const validator = new ResourceTypeFileValidator({
  resourceType: dto.resourceType
});

if (!await validator.isValid(file)) {
  await cleanupFile(file.path);  // Delete from disk
  throw new UnprocessableEntityException(...);
}
```

## Error Handling & Cleanup

All file upload errors trigger automatic file cleanup to prevent disk abuse:

```typescript
try {
  // Validate & create database record
} catch (error) {
  await this.cleanupFile(file.path);  // Delete file from disk
  throw error;  // Re-throw error
}
```

## Security Considerations

### File Type Validation
- MIME type validated against allowed patterns
- Resource-specific validation strategies
- Extension implicitly validated via MIME type

### Size Limits
- Hard 500MB limit at Multer level (DOS prevention)
- MIME-aware limits (e.g., 25MB for images, 500MB for videos)
- Resource-specific limits (e.g., 10MB for avatars)

### Access Control
- JWT authentication required for all operations
- Strategy-based access validation on retrieval
- Respects private channel memberships
- Community/DM group membership checks

### Storage Security
- Files stored in configured upload directory
- Path traversal prevented by Multer
- Checksum generated for integrity verification
- Soft delete support (deletedAt field)

## Performance Considerations

- **Streaming:** Files served as streams for efficient large file delivery
- **Checksum:** SHA-256 generated via streaming to avoid memory issues
- **Cleanup:** Async file deletion doesn't block responses
- **Access Checks:** Single database query per file retrieval

## Usage Examples

### Frontend: Upload Message Attachment

```typescript
async function uploadMessageAttachment(file: File, messageId: string) {
  // 1. Upload file
  const formData = new FormData();
  formData.append('file', file);
  formData.append('resourceType', 'MESSAGE_ATTACHMENT');

  const uploadResponse = await fetch('/api/file-upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  const uploadedFile = await uploadResponse.json();

  // 2. Confirm attachment
  await fetch(`/api/messages/${messageId}/attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId: uploadedFile.id }),
  });

  return uploadedFile;
}
```

### Frontend: Upload User Avatar

```typescript
async function uploadAvatar(file: File, userId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('resourceType', 'USER_AVATAR');
  formData.append('resourceId', userId);

  const response = await fetch('/api/file-upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  const uploadedFile = await response.json();

  // Update user profile
  await fetch(`/api/user/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ avatarUrl: uploadedFile.id }),
  });

  return uploadedFile;
}
```

### Frontend: Display File

```typescript
function FileDisplay({ fileId }: { fileId: string }) {
  const fileUrl = `/api/file/${fileId}`;
  const token = useAuthToken();

  return (
    <img
      src={fileUrl}
      onLoad={(e) => {
        // Add auth header via fetch and blob URL
        fetch(fileUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
          .then(res => res.blob())
          .then(blob => {
            e.currentTarget.src = URL.createObjectURL(blob);
          });
      }}
    />
  );
}
```

## Related Documentation

- [File Module](../modules/file.md) - File retrieval and access control
- [File Upload Module](../modules/file-upload.md) - Upload processing and validation
- [Messages API](./messages.md) - Message attachment integration
- [Database Schema](../architecture/database.md#file) - File model structure
