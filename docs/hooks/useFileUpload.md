# useFileUpload

> **Location:** `frontend/src/hooks/useFileUpload.ts`
> **Type:** State Hook
> **Category:** files

## Overview

Handles file upload operations with progress tracking and error handling. Used by message input for attaching files.

## Usage

```tsx
import { useFileUpload } from '@/hooks/useFileUpload';

function FileUploader() {
  const { uploadFile, progress, isUploading, error } = useFileUpload();

  const handleFileSelect = async (file: File) => {
    const result = await uploadFile(file);
    console.log('Uploaded:', result.fileId);
  };

  return (
    <div>
      <input type="file" onChange={e => handleFileSelect(e.target.files[0])} />
      {isUploading && <progress value={progress} max={100} />}
    </div>
  );
}
```

## Related

- [File API](../api/file.md)
- [FileCacheContext](../contexts/FileCacheContext.md)
