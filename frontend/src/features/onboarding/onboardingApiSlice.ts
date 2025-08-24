import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface OnboardingStatus {
  needsSetup: boolean;
  hasUsers: boolean;
  setupToken?: string;
}

export interface SetupInstanceRequest {
  adminUsername: string;
  adminPassword: string;
  adminEmail?: string;
  instanceName: string;
  instanceDescription?: string;
  defaultCommunityName?: string;
  createDefaultCommunity?: boolean;
  setupToken: string;
}

export interface SetupInstanceResponse {
  success: boolean;
  message: string;
  adminUserId: string;
  defaultCommunityId?: string;
}

const baseQuery = fetchBaseQuery({
  baseUrl: '/api/onboarding',
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

export const onboardingApi = createApi({
  reducerPath: 'onboardingApi',
  baseQuery,
  tagTypes: ['OnboardingStatus'],
  endpoints: (builder) => ({
    getOnboardingStatus: builder.query<OnboardingStatus, void>({
      query: () => 'status',
      providesTags: ['OnboardingStatus'],
    }),
    setupInstance: builder.mutation<SetupInstanceResponse, SetupInstanceRequest>({
      query: (setupData) => ({
        url: 'setup',
        method: 'POST',
        body: setupData,
      }),
      invalidatesTags: ['OnboardingStatus'],
    }),
  }),
});

export const {
  useGetOnboardingStatusQuery,
  useSetupInstanceMutation,
} = onboardingApi;