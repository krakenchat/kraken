import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { getAuthToken } from "../utils/auth";
import { logger } from "../utils/logger";
import { trackNetworkError } from "../services/telemetry";
import {
  refreshToken,
  isRefreshing,
  redirectToLogin,
} from "../utils/tokenService";

const getBaseAuthedQuery = (
  baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> => {
  return async function (args, api, extraOptions) {
    const result = await baseQuery(args, api, extraOptions);

    if (
      result.error &&
      (result.error.status === 401 || result.error.data === "Unauthorized")
    ) {
      // If we're already refreshing, wait for it to complete
      if (isRefreshing()) {
        logger.dev("Token refresh already in progress, waiting...");
        const newToken = await refreshToken();
        if (newToken) {
          // Retry the original request with new token
          return baseQuery(args, api, extraOptions);
        }
        redirectToLogin();
        return result;
      }

      logger.dev("Unauthorized, trying to refresh token");

      // Use centralized token refresh
      const newToken = await refreshToken();

      if (newToken) {
        // Retry the original request with new token
        return baseQuery(args, api, extraOptions);
      } else {
        logger.dev("Authentication failed - redirecting to login");
        redirectToLogin();
        return result; // Return the original error
      }
    }

    // Track non-auth errors to telemetry (skip 401s as they're handled above)
    if (result.error && result.error.status !== 401) {
      const endpoint =
        typeof args === "string" ? args : (args as FetchArgs).url || "unknown";
      const status =
        typeof result.error.status === "number" ? result.error.status : 0;
      trackNetworkError(endpoint, status, result.error.data);
    }

    return result;
  };
};

export const prepareHeaders = (headers: Headers) => {
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");
  return headers;
};

export default getBaseAuthedQuery;
