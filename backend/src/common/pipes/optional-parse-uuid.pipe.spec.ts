import { BadRequestException } from '@nestjs/common';
import { OptionalParseUUIDPipe } from './optional-parse-uuid.pipe';

describe('OptionalParseUUIDPipe', () => {
  let pipe: OptionalParseUUIDPipe;

  beforeEach(() => {
    pipe = new OptionalParseUUIDPipe();
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

  it('should return the value for a valid UUID v4', () => {
    const validId = '550e8400-e29b-41d4-a716-446655440000';
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('should return the value for an uppercase UUID', () => {
    const validId = '550E8400-E29B-41D4-A716-446655440000';
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('should throw BadRequestException for an invalid UUID', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for a partial UUID', () => {
    expect(() => pipe.transform('550e8400-e29b')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for a MongoDB ObjectId', () => {
    expect(() => pipe.transform('507f1f77bcf86cd799439011')).toThrow(
      BadRequestException,
    );
  });
});
