# Kraken File Upload Postman Collection

## Setup

1. **Import Collection**: Import `file-upload.postman_collection.json` into Postman
2. **Set Variables**: Update collection variables before testing:
   - `baseUrl`: Default is `http://localhost:3001`
   - `channelId`: Get from existing channel (required for message tests)
   - `communityId`: Get from existing community (required for emoji tests)

## Testing Flow

### Quick Start (Happy Path)

1. **Login** → Saves `accessToken` automatically
2. **Create Message with Pending Attachments** → Saves `messageId`
3. **Upload Image** → Saves `imageFileId`
4. **Add Attachment to Message (Success)** → Adds file to message, decrements counter
5. **Get Message** → Verify attachment was added

### Full Workflow

```
Auth
├── Login (sets accessToken, userId)

Messages with Attachments
├── Create Message with Pending Attachments (pendingAttachments: 2)
│
File Upload (upload files in parallel)
├── Upload Image → imageFileId
├── Upload Video → videoFileId
│
Add Attachments
├── Add Attachment (Success) → adds imageFileId, pendingAttachments: 1
├── Add Attachment (Failure) → no fileId, pendingAttachments: 0
│
Verify
└── Get Message → check attachments array & pendingAttachments
```

## Collection Structure

### 1. Auth
- **Login**: Authenticates and saves access token

### 2. File Upload
Tests different resource types:
- **Message Attachment** (images, videos, archives)
- **User Avatar** (10MB limit)
- **Custom Emoji** (256KB limit, PNG/GIF only)

### 3. Messages with Attachments
- **Create Message**: With `pendingAttachments: 2`
- **Add Attachment (Success)**: Includes `fileId`
- **Add Attachment (Failure)**: Omits `fileId` (simulates failed upload)
- **Get Message**: Verify attachments and counter

### 4. File Access
- **Get File**: Download file (tests access control)
- **Delete File**: Soft delete

### 5. Validation Tests
Test error cases:
- **File Too Large** (>500MB) → 413 Payload Too Large
- **Wrong MIME Type** (PDF as emoji) → 422 Unprocessable Entity
- **Exceeds Resource Limit** (>10MB avatar) → 422 Unprocessable Entity

## File Size Limits by Resource Type

| Resource Type | Max Size | Allowed Types |
|--------------|----------|---------------|
| MESSAGE_ATTACHMENT (video) | 500MB | video/* |
| MESSAGE_ATTACHMENT (image) | 25MB | image/* |
| MESSAGE_ATTACHMENT (audio) | 50MB | audio/* |
| MESSAGE_ATTACHMENT (docs) | 100MB | application/*, text/* |
| USER_AVATAR | 10MB | image/* (JPEG, PNG, GIF, WebP) |
| USER_BANNER | 10MB | image/* (JPEG, PNG, GIF, WebP) |
| COMMUNITY_AVATAR | 25MB | image/* |
| COMMUNITY_BANNER | 25MB | image/* |
| CUSTOM_EMOJI | 256KB | PNG, GIF, WebP only |

## Example: Testing Message Attachments

1. **Before starting**, set collection variable:
   ```
   channelId = "your-channel-id-here"
   ```

2. Run **Login** request

3. Run **Create Message with Pending Attachments**:
   ```json
   {
     "channelId": "{{channelId}}",
     "spans": [{"type": "PLAINTEXT", "text": "Uploading files..."}],
     "attachments": [],
     "pendingAttachments": 2
   }
   ```

4. Upload files (run both in parallel if desired):
   - **Upload Image** (saves imageFileId)
   - **Upload Video** (saves videoFileId)

5. Add first attachment:
   ```json
   POST /messages/{{messageId}}/attachments
   { "fileId": "{{imageFileId}}" }
   ```
   Result: `pendingAttachments: 1`, `attachments: [imageFileId]`

6. Simulate failed upload (no fileId):
   ```json
   POST /messages/{{messageId}}/attachments
   { }
   ```
   Result: `pendingAttachments: 0`, `attachments: [imageFileId]`

7. **Get Message** to verify final state

## Testing File Access Control

The `Get File by ID` request tests the FileAccessGuard:

- ✅ **Owner can access** their own message attachments
- ✅ **Channel members can access** attachments in their channels
- ❌ **Non-members denied** access to private channel attachments
- ✅ **User avatars** are publicly accessible

## Notes

- Replace `/path/to/your/file.jpg` with actual file paths
- Auto-saves tokens and IDs via test scripts
- All uploads require authentication (except public files)
- WebSocket events are emitted on successful operations

## Environment Variables

The collection uses these auto-populated variables:

| Variable | Set By | Used In |
|----------|--------|---------|
| accessToken | Login test script | All authenticated requests |
| userId | Login test script | User avatar uploads |
| messageId | Create Message script | Add attachment, Get message |
| imageFileId | Upload Image script | Add attachment success |
| videoFileId | Upload Video script | Manual testing |
| channelId | Manual setup | Message creation |
| communityId | Manual setup | Emoji uploads |
