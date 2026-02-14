import { BadRequestException } from '@nestjs/common';
import { OptionalParseObjectIdPipe } from './optional-parse-object-id.pipe';

describe('OptionalParseObjectIdPipe', () => {
  let pipe: OptionalParseObjectIdPipe;

  beforeEach(() => {
    pipe = new OptionalParseObjectIdPipe();
  });

  it('should return undefined for undefined input', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
  });

  it('should return undefined for null input', () => {
    expect(pipe.transform(null)).toBeUndefined();
  });

  it('should return undefined for empty string input', () => {
    expect(pipe.transform('')).toBeUndefined();
  });

  it('should return the value for a valid 24-char hex ObjectId', () => {
    const validId = '507f1f77bcf86cd799439011';
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('should throw BadRequestException for an invalid ObjectId', () => {
    expect(() => pipe.transform('not-an-id')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for a short hex string', () => {
    expect(() => pipe.transform('507f1f')).toThrow(BadRequestException);
  });
});
