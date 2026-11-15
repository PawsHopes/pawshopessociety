export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // In local development, allow testing with VITE_DEV_USER_EMAIL
  const devEmail = import.meta.env.VITE_DEV_USER_EMAIL;
  if (devEmail && !headers.has('X-Dev-User-Email')) {
    headers.set('X-Dev-User-Email', devEmail);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    const responseText = await res.text();
    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: {
          code: res.status === 401 ? 'UNAUTHORIZED' : 'INVALID_RESPONSE',
          message: res.redirected
            ? 'Your session may have expired. Sign in again and retry.'
            : `The ERP API returned an unexpected response (HTTP ${res.status}).`,
        },
      };
    }
    if (payload && typeof payload === 'object' && 'success' in payload) {
      return payload as ApiResponse<T>;
    }
    return {
      success: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: `The ERP API returned an unexpected response (HTTP ${res.status}).`,
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the ERP API. Check your connection and try again.',
      },
    };
  }
}
