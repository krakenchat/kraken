import { cookieConfig, extractRefreshTokenFromCookies } from './cookie-helper';
import { Request } from 'express';

describe('cookie-helper', () => {
  describe('cookieConfig', () => {
    it('should have refreshToken configuration', () => {
      expect(cookieConfig.refreshToken).toBeDefined();
      expect(cookieConfig.refreshToken.name).toBe('refreshToken');
    });

    it('should have correct cookie options', () => {
      const options = cookieConfig.refreshToken.options;

      expect(options.path).toBe('/');
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('strict');
      expect(options.secure).toBe(true);
      expect(options.maxAge).toBe(1000 * 60 * 60 * 24 * 30); // 30 days
    });

    it('should have maxAge of 30 days', () => {
      const thirtyDaysInMs = 1000 * 60 * 60 * 24 * 30;
      expect(cookieConfig.refreshToken.options.maxAge).toBe(thirtyDaysInMs);
    });
  });

  describe('extractRefreshTokenFromCookies', () => {
    it('should extract refresh token from cookies', () => {
      const mockRequest = {
        headers: {
          cookie: 'refreshToken=test-token-123',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('test-token-123');
    });

    it('should extract refresh token from multiple cookies', () => {
      const mockRequest = {
        headers: {
          cookie:
            'sessionId=abc123; refreshToken=my-refresh-token; userId=user-456',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('my-refresh-token');
    });

    it('should return null when no cookies present', () => {
      const mockRequest = {
        headers: {},
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when cookie header is undefined', () => {
      const mockRequest = {
        headers: {
          cookie: undefined,
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when refresh token cookie not found', () => {
      const mockRequest = {
        headers: {
          cookie: 'sessionId=abc123; userId=user-456',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when cookies array is empty', () => {
      const mockRequest = {
        headers: {
          cookie: '',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBeNull();
    });

    it('should handle token with equals sign in value', () => {
      const mockRequest = {
        headers: {
          cookie:
            'refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      );
    });

    it('should handle refresh token as first cookie', () => {
      const mockRequest = {
        headers: {
          cookie: 'refreshToken=first-token; sessionId=abc123',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('first-token');
    });

    it('should handle refresh token as last cookie', () => {
      const mockRequest = {
        headers: {
          cookie: 'sessionId=abc123; userId=user-456; refreshToken=last-token',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('last-token');
    });

    it('should handle cookie with similar name but different prefix', () => {
      const mockRequest = {
        headers: {
          cookie: 'notRefreshToken=fake; refreshToken=real-token',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('real-token');
    });

    it('should handle empty token value', () => {
      const mockRequest = {
        headers: {
          cookie: 'refreshToken=',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('');
    });

    it('should handle whitespace in cookie values', () => {
      const mockRequest = {
        headers: {
          cookie: 'sessionId=abc; refreshToken=token-with-spaces',
        },
      } as Request;

      const result = extractRefreshTokenFromCookies(mockRequest);

      expect(result).toBe('token-with-spaces');
    });
  });
});
