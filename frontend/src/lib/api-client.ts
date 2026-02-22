// When empty or unset, API calls use relative URLs (same origin via nginx proxy)
// Set NEXT_PUBLIC_API_URL only when backend is on a different origin
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseURL: string;
  private isRefreshing: boolean = false;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async refreshToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.isRefreshing) return false; // Prevent concurrent refresh

    this.isRefreshing = true;

    try {
      // ✅ Call refresh endpoint (uses refreshToken cookie automatically)
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // ✅ CRITICAL - sends refreshToken cookie
      });

      this.isRefreshing = false;

      if (response.ok) {
        // Backend has set new accessToken cookie
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed', error);
      this.isRefreshing = false;
    }

    return false;
  }

  async fetch<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config: RequestInit = {
      ...options,
      credentials: 'include', // ✅ CRITICAL - sends/receives cookies automatically
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    let response = await fetch(`${this.baseURL}${endpoint}`, config);

    // Handle 401 - Try refresh token
    if (response.status === 401 && typeof window !== 'undefined') {
      const refreshed = await this.refreshToken();

      if (refreshed) {
        // Retry request with new accessToken cookie (automatic)
        response = await fetch(`${this.baseURL}${endpoint}`, config);
      } else {
        // Refresh failed - clear cache and redirect to login
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new ApiError(401, 'Session expired');
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, error.message || 'An error occurred', error);
    }

    return response.json();
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data: any): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T = any>(endpoint: string, data: any): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T = any>(endpoint: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      credentials: 'include', // ✅ CRITICAL
      body: formData,
      // ✅ NO Content-Type header for FormData (browser sets multipart/form-data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, error.message || 'Upload failed', error);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_URL);
