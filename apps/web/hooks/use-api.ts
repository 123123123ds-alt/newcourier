'use client';

import { useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
).replace(/\/$/, '');

type FetchOptions = RequestInit & { raw?: boolean };

async function parseResponse<T>(response: Response, raw = false): Promise<T> {
  if (raw) {
    return (await response.text()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function useApi() {
  const { auth, refreshTokens, logout } = useAuth();

  const apiFetch = useCallback(
    async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
      const request = async (token?: string) => {
        const headers = new Headers(options.headers ?? {});
        const body = options.body;

        if (body && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        } else if (auth?.accessToken) {
          headers.set('Authorization', `Bearer ${auth.accessToken}`);
        }

        return fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers
        });
      };

      let response = await request();

      if (response.status === 401 && auth?.refreshToken) {
        const refreshed = await refreshTokens();
        if (refreshed) {
          response = await request(refreshed.accessToken);
        } else {
          logout();
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const payload = await parseResponse<{ message?: string; msg?: string } | string>(
          response,
          options.raw
        );

        const message =
          typeof payload === 'string' ? payload : payload?.message ?? payload?.msg ?? 'Request failed';
        throw new Error(message);
      }

      return parseResponse<T>(response, options.raw);
    },
    [auth?.accessToken, auth?.refreshToken, logout, refreshTokens]
  );

  return { apiFetch };
}
