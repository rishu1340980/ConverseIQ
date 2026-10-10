const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://converseiq.onrender.com/api/v1';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('converseiq_token');
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('converseiq_token', token);
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('converseiq_token');
    localStorage.removeItem('converseiq_user');
  }
}

export async function logoutSession(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      // Safe fallback on network failure
      console.warn('Backend revocation unreachable, proceeding with client-side cleanup', e);
    }
  }
  removeAuthToken();
}

export function getCurrentStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('converseiq_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('converseiq_user', JSON.stringify(user));
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      removeAuthToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired or invalidated. Please log in again.');
    }

    if (res.status === 423) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || 'Account is temporarily locked. Please wait before retrying.');
    }

    if (res.status === 429) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || 'Too many authentication attempts. Please wait a minute before trying again.');
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
      throw new Error(`Backend server is not running at ${BASE_URL}. Please ensure the backend is running on port 8001.`);
    }
    throw err;
  }
}

export async function downloadFile(endpoint: string, fallbackFilename: string = 'document.pdf'): Promise<void> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Download failed with status ${res.status}`);
  }

  // Extract filename from Content-Disposition if present
  let filename = fallbackFilename;
  const disposition = res.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const matches = disposition.match(/filename="?([^";]+)"?/);
    if (matches && matches[1]) {
      filename = matches[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}

