import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";
import type { ThemeMode, AccentColor, ThemeIntensity } from "../../theme/constants";

export interface AppearanceSettings {
  id: string;
  userId: string;
  themeMode: ThemeMode;
  accentColor: AccentColor;
  intensity: ThemeIntensity;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAppearanceSettingsDto {
  themeMode?: ThemeMode;
  accentColor?: AccentColor;
  intensity?: ThemeIntensity;
}

export const appearanceApi = createApi({
  reducerPath: "appearanceApi",
  baseQuery: createAuthedBaseQuery("appearance-settings"),
  tagTypes: ["AppearanceSettings"],
  endpoints: (builder) => ({
    getAppearanceSettings: builder.query<AppearanceSettings, void>({
      query: () => ({
        url: "/",
        method: "GET",
      }),
      providesTags: ["AppearanceSettings"],
    }),
    updateAppearanceSettings: builder.mutation<AppearanceSettings, UpdateAppearanceSettingsDto>({
      query: (body) => ({
        url: "/",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AppearanceSettings"],
    }),
  }),
});

export const {
  useGetAppearanceSettingsQuery,
  useUpdateAppearanceSettingsMutation,
} = appearanceApi;
