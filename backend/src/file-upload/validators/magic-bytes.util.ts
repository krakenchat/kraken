import { open } from 'fs/promises';

/**
 * Number of leading bytes needed to identify all supported image formats
 * (WebP needs 12: "RIFF" + size + "WEBP").
 */
export const MAGIC_BYTES_HEADER_LENGTH = 16;

const isJpeg = (b: Buffer): boolean =>
  b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * SVG is XML text with no binary signature. Accept if the first
 * non-whitespace byte (after an optional UTF-8 BOM) is '<', which rules out
 * renamed binaries while keeping legitimate SVG attachments working.
 */
const isSvgLike = (b: Buffer): boolean => {
  let i = 0;
  // Skip UTF-8 BOM
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    i = 3;
  }
  // Skip leading whitespace
  while (i < b.length && [0x09, 0x0a, 0x0d, 0x20].includes(b[i])) {
    i++;
  }
  return i < b.length && b[i] === 0x3c; // '<'
};

const IMAGE_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': isJpeg,
  'image/jpg': isJpeg, // non-standard alias accepted by the strategies
  'image/png': (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  'image/gif': (b) =>
    b.length >= 6 && b.subarray(0, 3).toString('ascii') === 'GIF',
  'image/webp': (b) =>
    b.length >= 12 &&
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP',
  'image/svg+xml': isSvgLike,
};

/**
 * For image MIME claims, verify the file content actually starts with that
 * format's magic bytes. Non-image MIME types pass through (attachments are
 * arbitrary); unknown image/* subtypes fail closed.
 */
export function matchesDeclaredImageType(
  bytes: Buffer,
  mimetype: string,
): boolean {
  if (!mimetype.startsWith('image/')) return true;
  const check = IMAGE_SIGNATURES[mimetype];
  if (!check) return false;
  return check(bytes);
}

/**
 * Read the leading bytes of an uploaded file. Multer is configured with disk
 * storage (`dest`), so `file.buffer` is normally absent and the header is
 * read from `file.path`. Falls back to `file.buffer` when present (e.g.
 * memory storage or tests). Returns an empty buffer (fails closed for
 * images) when the content cannot be read.
 */
export async function readFileHeader(
  file: Express.Multer.File,
): Promise<Buffer> {
  if (file.buffer && file.buffer.length > 0) {
    return file.buffer.subarray(0, MAGIC_BYTES_HEADER_LENGTH);
  }

  if (!file.path) {
    return Buffer.alloc(0);
  }

  try {
    const handle = await open(file.path, 'r');
    try {
      const buffer = Buffer.alloc(MAGIC_BYTES_HEADER_LENGTH);
      const { bytesRead } = await handle.read(
        buffer,
        0,
        MAGIC_BYTES_HEADER_LENGTH,
        0,
      );
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch {
    return Buffer.alloc(0);
  }
}
