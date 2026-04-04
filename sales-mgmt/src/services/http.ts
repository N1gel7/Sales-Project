import axios, { type Method } from 'axios';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export const axiosInstance = axios.create({
  // Base configuration can go here
});

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
    const errorMessage = error.response?.data?.message || typeof error.response?.data === 'string' ? error.response.data : error.message || 'An HTTP error occurred';
    throw new Error(errorMessage);
  }
}

