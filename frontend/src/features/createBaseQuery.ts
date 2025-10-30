import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getApiBaseUrl } from "../config/env";
import getBaseAuthedQuery, { prepareHeaders } from "./AuthedBaseQuery";

/**
 * Create an authenticated base query for an API slice
 * @param endpoint - The API endpoint path (e.g., 'users', 'auth', 'channels')
 * @returns Configured base query with authentication
 */
export const createAuthedBaseQuery = (endpoint: string) => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  return getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: `${baseUrl}/${cleanEndpoint}`,
      prepareHeaders,
    })
  );
};

/**
 * Create a simple base query without authentication
 * @param endpoint - The API endpoint path (e.g., 'public', 'health')
 * @returns Configured base query without authentication
 */
export const createSimpleBaseQuery = (endpoint: string) => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  return fetchBaseQuery({
    baseUrl: `${baseUrl}/${cleanEndpoint}`,
  });
};
