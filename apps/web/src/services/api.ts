// =============================================================================
// api.ts — Axios-based API client with auth-aware interceptors
// Implements: REQ-UI-01 (API client), DR-045 (no redirect on 500)
// =============================================================================

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAuthToken, clearAuthToken } from './auth.js';

/** Base API URL — configurable via environment variable. */
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Creates and configures the Axios API client instance.
 * - Adds Authorization header from stored token
 * - Intercepts 401/403 responses to trigger logout (DR-045: ONLY 401/403)
 * - 5xx errors do NOT redirect — they surface as error states
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({ baseURL: API_BASE_URL });

  // Request interceptor: attach auth token
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: handle auth failures ONLY (DR-045)
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      // DR-045: Only redirect on 401/403, NOT on 500 or other errors
      if (status === 401 || status === 403) {
        clearAuthToken();
        window.location.href = '/login';
      }
      // 5xx and other errors are NOT redirected — caller handles them
      return Promise.reject(error);
    }
  );

  return client;
}

/** Singleton API client instance. */
export const apiClient = createApiClient();
