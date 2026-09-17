const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
      throw new Error('Session expired. Please log in again.');
    }

    if (res.status === 429) {
      throw new Error('Too many failed attempts. Account temporarily locked for 15 minutes.');
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
