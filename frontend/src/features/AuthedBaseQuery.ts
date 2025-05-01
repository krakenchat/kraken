import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import axios from "axios";

const getBaseAuthedQuery = (
  baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> => {
  return async function (args, api, extraOptions) {
    const result = await baseQuery(args, api, extraOptions);

    if (
      result.error &&
      (result.error.status === 401 || result.error.data === "Unauthorized")
    ) {
      console.log("Unauthorized, trying to refresh token");
      // Try to refresh
      const refreshResponse = await axios.post<{ accessToken: string }>(
        "/api/auth/refresh"
      );

      console.log("Refresh response", refreshResponse);
      if (refreshResponse.data) {
        localStorage.setItem("accessToken", refreshResponse.data.accessToken);
      }

      return baseQuery(args, api, extraOptions);
    }

    return result;
  };
};

export const prepareHeaders = (headers: Headers) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");
  return headers;
};

export default getBaseAuthedQuery;
