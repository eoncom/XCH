// When empty or unset, API calls use relative URLs (same origin via nginx proxy)
// Set NEXT_PUBLIC_API_URL only when backend is on a different origin
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'aborted' | 'unknown';

export class ApiError extends Error {
  public readonly kind: ApiErrorKind;

  constructor(
    public status: number,
    message: string,
    public data?: any,
    kind: ApiErrorKind = 'http'
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

function classifyFetchFailure(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  // AbortController.abort() raises DOMException 'AbortError'.
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ApiError(0, 'Délai dépassé, réessayez', undefined, 'timeout');
  }
  // fetch() throws TypeError on network failure (DNS, offline, CORS preflight refused).
  if (err instanceof TypeError) {
    return new ApiError(0, 'Connexion indisponible', undefined, 'network');
  }
  const message = err instanceof Error ? err.message : 'Erreur inconnue';
  return new ApiError(0, message, undefined, 'unknown');
}

class ApiClient {
  private baseURL: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Get the active delegation ID from localStorage.
   * Used to inject X-Delegation-Id header on operational requests.
   */
  private getActiveDelegationId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('xch-active-delegation');
  }

  /**
   * Refresh access token. When multiple concurrent requests hit 401 at the same
   * time, they all await the same in-flight refresh promise rather than one of
   * them short-circuiting to /login.
   */
  private async refreshToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Concurrent callers share the same refresh attempt
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return response.ok;
      } catch (error) {
        console.error('Token refresh failed', error);
        return false;
      } finally {
        // Clear after a tick so simultaneous awaiters still see the same promise
        setTimeout(() => { this.refreshPromise = null; }, 0);
      }
    })();

    return this.refreshPromise;
  }

  async fetch<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Inject X-Delegation-Id header on operational requests (skip admin routes)
    const delegationHeaders: Record<string, string> = {};
    if (!endpoint.startsWith('/api/admin/') && !endpoint.startsWith('/api/auth/') && !endpoint.startsWith('/api/setup')) {
      const delegationId = this.getActiveDelegationId();
      if (delegationId) {
        delegationHeaders['X-Delegation-Id'] = delegationId;
      }
    }

    // Compose AbortController: outer timeout + caller's signal (if any).
    const callerSignal = options.signal ?? null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const config: RequestInit = {
      ...options,
      credentials: 'include', // ✅ CRITICAL - sends/receives cookies automatically
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...delegationHeaders,
        ...options.headers,
      },
    };

    try {
      let response: Response;
      try {
        response = await fetch(`${this.baseURL}${endpoint}`, config);
      } catch (err) {
        throw classifyFetchFailure(err);
      }

      // Handle 401 - Try refresh token
      if (response.status === 401 && typeof window !== 'undefined') {
        const refreshed = await this.refreshToken();

        if (refreshed) {
          // Retry request with new accessToken cookie (automatic)
          try {
            response = await fetch(`${this.baseURL}${endpoint}`, config);
          } catch (err) {
            throw classifyFetchFailure(err);
          }
        } else {
          // Refresh failed - clear cache and redirect to login
          localStorage.removeItem('user');
          window.location.href = '/login';
          throw new ApiError(401, 'Session expirée');
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new ApiError(response.status, error.message || `HTTP ${response.status}`, error);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
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

  private async uploadInternal<T = any>(
    endpoint: string,
    formData: FormData,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
          signal: controller.signal,
          // ✅ NO Content-Type header for FormData (browser sets multipart/form-data)
        });
      } catch (err) {
        throw classifyFetchFailure(err);
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new ApiError(response.status, error.message || `HTTP ${response.status}`, error);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async upload<T = any>(endpoint: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    return this.uploadInternal<T>(endpoint, formData);
  }

  async uploadWithFields<T = any>(
    endpoint: string,
    file: File,
    fields?: Record<string, string | undefined>,
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== null && v !== '') formData.append(k, v);
      }
    }
    return this.uploadInternal<T>(endpoint, formData);
  }
}

export const apiClient = new ApiClient(API_URL);
