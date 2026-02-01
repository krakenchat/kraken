import { cookieConfig } from './cookie-helper';

describe('cookie-helper', () => {
  describe('cookieConfig', () => {
    it('should have accessToken configuration', () => {
      expect(cookieConfig.accessToken).toBeDefined();
      expect(cookieConfig.accessToken.name).toBe('access_token');
    });

    it('should have correct access token cookie options', () => {
      const options = cookieConfig.accessToken.options;

      expect(options.path).toBe('/');
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.maxAge).toBe(1000 * 60 * 60); // 1 hour
    });
  });
});
