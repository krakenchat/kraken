import { client } from './api-client/client.gen';
import { getApiBaseUrl } from './config/env';
import { getAuthToken } from './utils/auth';
import { refreshToken, redirectToLogin } from './utils/tokenService';

export function configureApiClient() {
  client.setConfig({ baseUrl: getApiBaseUrl() });

  client.interceptors.request.use((request) => {
    const token = getAuthToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  });

  client.interceptors.response.use(async (response, request) => {
    if (response.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        // Retry the original request with the new token
        const retryRequest = request.clone();
        retryRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(retryRequest);
      }
      redirectToLogin();
    }
    return response;
  });
}
