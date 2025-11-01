import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import axios from "axios";
import { getCachedItem, setCachedItem } from "../utils/storage";
import { getApiUrl } from "../config/env";

// Track refresh attempts to prevent infinite loops
let isRefreshing = false;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 1;

const redirectToLogin = () => {
  localStorage.removeItem("accessToken");
  // Use hash for HashRouter compatibility (especially in Electron)
  if (window.location.hash !== "#/login") {
    window.location.hash = "#/login";
  }
};

const getBaseAuthedQuery = (
  baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> => {
  return async function (args, api, extraOptions) {
    const result = await baseQuery(args, api, extraOptions);

    if (
      result.error &&
      (result.error.status === 401 || result.error.data === "Unauthorized")
    ) {
      // If we're already refreshing or have exceeded max attempts, redirect to login
      if (isRefreshing || refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.log("Authentication failed - redirecting to login");
        redirectToLogin();
        return result; // Return the original error
      }

      console.log("Unauthorized, trying to refresh token");
      isRefreshing = true;
      refreshAttempts++;

      try {
        // Try to refresh - check if we're in Electron
        const isElectron = typeof window !== 'undefined' &&
          (window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron;

        let refreshResponse;
        if (isElectron) {
          const refreshToken = localStorage.getItem("refreshToken");
          if (refreshToken) {
            // For Electron, send refresh token in body
            refreshResponse = await axios.post<{ accessToken: string; refreshToken?: string }>(
              getApiUrl("/auth/refresh"),
              { refreshToken }
            );
          } else {
            throw new Error("No refresh token available for Electron client");
          }
        } else {
          // For web clients, use cookie-based refresh
          refreshResponse = await axios.post<{ accessToken: string }>(
            getApiUrl("/auth/refresh"),
            {},
            { withCredentials: true }
          );
        }

        console.log("Refresh response", refreshResponse);
        if (refreshResponse?.data?.accessToken) {
          setCachedItem("accessToken", refreshResponse.data.accessToken);

          // Update stored refresh token for Electron
          if (isElectron && refreshResponse.data.refreshToken) {
            localStorage.setItem("refreshToken", refreshResponse.data.refreshToken);
          }

          // Reset attempts on successful refresh
          refreshAttempts = 0;
          isRefreshing = false;

          // Retry the original request with new token
          return baseQuery(args, api, extraOptions);
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshError) {
        console.log("Token refresh failed:", refreshError);
        isRefreshing = false;
        redirectToLogin();
        return result; // Return the original 401 error
      }
    }

    return result;
  };
};

export const prepareHeaders = (headers: Headers) => {
  const token = getCachedItem<string>("accessToken");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");
  return headers;
};

export default getBaseAuthedQuery;
