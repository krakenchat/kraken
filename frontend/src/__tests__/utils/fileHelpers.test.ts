import { describe, it, expect } from 'vitest';
import { getFileUrl } from '../../utils/fileHelpers';

describe('getFileUrl', () => {
  it('returns /api/file/<id> for a valid file ID', () => {
    expect(getFileUrl('abc')).toBe('/api/file/abc');
  });

  it('returns null when fileId is null', () => {
    expect(getFileUrl(null)).toBeNull();
  });

  it('returns null when fileId is undefined', () => {
    expect(getFileUrl(undefined)).toBeNull();
  });
});
