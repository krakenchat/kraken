import { Request, Response } from 'express';

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
  refreshToken: {
    name: 'refreshToken',
    options: {
      path: '/', // For production, use '/auth/api/refresh-tokens'. We use '/' for localhost in order to work on Chrome.
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days; must match Refresh JWT expiration.
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

export const extractRefreshTokenFromCookies = (req: Request) => {
  const cookies = req.headers.cookie?.split('; ');
  if (!cookies?.length) {
    return null;
  }

  const refreshTokenCookie = cookies.find((cookie) =>
    cookie.startsWith(`${cookieConfig.refreshToken.name}=`),
  );

  if (!refreshTokenCookie) {
    return null;
  }

  return refreshTokenCookie.split('=')[1];
};
