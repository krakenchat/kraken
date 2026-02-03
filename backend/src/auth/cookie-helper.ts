import { Response } from 'express';

export const cookieConfig = {
  accessToken: {
    name: 'access_token',
    options: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax' as const, // 'lax' allows cookies for same-site navigation and CORS GET requests
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60, // 1 hour; must match Access JWT expiration.
    },
  },
};

export const setAccessTokenCookie = (res: Response, token: string) => {
  res.cookie(
    cookieConfig.accessToken.name,
    token,
    cookieConfig.accessToken.options,
  );
};

export const clearAccessTokenCookie = (res: Response) => {
  res.clearCookie(cookieConfig.accessToken.name, {
    path: cookieConfig.accessToken.options.path,
  });
};
