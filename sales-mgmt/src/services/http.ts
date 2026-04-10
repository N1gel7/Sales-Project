import axios, { type Method } from 'axios';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export const axiosInstance = axios.create({
  // Base configuration can go here
});

function extractApiErrorMessage(error: any): string {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data.details === 'string' && data.details.trim()) return data.details;
  }
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return 'Request failed. Please try again.';
}

// Configure Axios Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Configure Axios Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      // Redirect to login only if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Wrapper to maintain compatibility with the existing API structure
export async function http<T = unknown>(path: string, options: { method?: HttpMethod; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const { method = 'GET', body, headers } = options;

  try {
    const res = await axiosInstance({
      url: path,
      method: method as Method,
      data: body,
      headers: headers,
    });
    return res.data;
  } catch (error: any) {
    throw new Error(extractApiErrorMessage(error));
  }
}

